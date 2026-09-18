/* ============================================================
   Oceania Adventure Guild - database seeding
   SIT774 Website Project, Part 3 (Task 10.2D)

   Fills the tables defined in create.js with the content held
   in seed-data.js.

   Run standalone:  node seed.js
   Or from server.js:  const { seedDatabase } = require('./seed');

   Two things this file is careful about:

   1. Idempotency. Every insert is guarded by an existence check
      on a natural key, so running it twice creates nothing
      twice. The server can call it on every start without
      accumulating duplicates.

   2. Name to key resolution. seed-data.js refers to people,
      items and quests by name, because a content file full of
      raw id numbers is unreadable and breaks the moment
      anything is reordered. This file builds lookup maps as it
      inserts, then resolves those names into foreign keys. A
      name that does not resolve raises an error naming itself,
      rather than quietly writing a null.

   Passwords are hashed with bcrypt before insertion, at the
   same cost factor the register route uses, so seeded and
   self-registered accounts are hashed on identical terms.
   ============================================================ */

const bcrypt = require('bcrypt');
const { DatabaseSync } = require('node:sqlite');
const { createTables, DB_PATH } = require('./create');
const data = require('./seed-data');

const SALT_ROUNDS = 10;


/**
 * Inserts every seed record, skipping anything already present.
 *
 * @param {DatabaseSync} db an open node:sqlite connection
 */
function seedDatabase(db) {

  // Foreign keys are per-connection, and this file writes rows
  // that depend on each other, so the pragma matters here too.
  db.exec('PRAGMA foreign_keys = ON');

  const counts = {
    users: 0, adventurers: 0, items: 0, quests: 0,
    news: 0, enquiries: 0, orders: 0, gear: 0, saved: 0
  };

  // Hashing is the slow part of seeding, so the one demo
  // password is hashed once and reused rather than hashed per
  // account. Every seeded account shares it.
  const demoHash = bcrypt.hashSync(data.DEMO_PASSWORD, SALT_ROUNDS);

  /* Lookup maps, filled as rows are inserted and read back when
     later rows need to reference them. */
  const userIdByName = new Map();        // display_name -> users.id
  const adventurerIdByName = new Map();  // display_name -> adventurer_profiles.id
  const itemIdByName = new Map();        // name -> items.id
  const questIdByTitle = new Map();      // title -> quests.id


  /* ----------------------------------------------------------
     Prepared statements
     Compiled once and reused. The placeholders are also what
     prevents SQL injection, since values never become part of
     the statement text.
     ---------------------------------------------------------- */
  const findUserByEmail = db.prepare('SELECT id, display_name FROM users WHERE email = ?');
  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, role, display_name, phone, bio,
                       profile_image, charter_accepted)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const findProfileByUser = db.prepare('SELECT id FROM adventurer_profiles WHERE user_id = ?');
  const insertProfile = db.prepare(`
    INSERT INTO adventurer_profiles (user_id, class, rank, specialty, willing_to_travel,
                                     availability, unavailable_until, auto_party_opt_in,
                                     member_since)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const findItemByName = db.prepare('SELECT id FROM items WHERE name = ?');
  const insertItem = db.prepare(`
    INSERT INTO items (name, category, subcategory, description, how_its_made, material,
                       lead_time, price, member_price, badge, image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const findQuestByTitle = db.prepare('SELECT id FROM quests WHERE title = ?');
  const insertQuest = db.prepare(`
    INSERT INTO quests (title, description, objectives, additional_info, quest_type,
                        location, reward, rank_requirement,
                        expected_duration, image, status, posted_by, accepted_by,
                        auto_party_enabled, adventurer_marked_done, poster_confirmed,
                        admin_verified, accepted_at, completed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const findNewsByTitle = db.prepare('SELECT id FROM news WHERE title = ?');
  const insertNews = db.prepare(`
    INSERT INTO news (title, category, summary, body, author, image, is_featured, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const findEnquiry = db.prepare('SELECT id FROM enquiries WHERE email = ? AND created_at = ?');
  const insertEnquiry = db.prepare(`
    INSERT INTO enquiries (user_id, name, email, phone, enquiry_type, message,
                           status, admin_notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const findOrder = db.prepare('SELECT id FROM orders WHERE user_id = ? AND created_at = ?');
  const insertOrder = db.prepare(`
    INSERT INTO orders (user_id, payment_method, total, status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (order_id, item_id, quantity, price_at_purchase)
    VALUES (?, ?, ?, ?)
  `);

  const findGear = db.prepare('SELECT id FROM adventurer_gear WHERE adventurer_id = ? AND item_id = ?');
  const insertGear = db.prepare(`
    INSERT INTO adventurer_gear (adventurer_id, item_id, equipped) VALUES (?, ?, ?)
  `);

  const findSaved = db.prepare('SELECT quest_id FROM saved_quests WHERE adventurer_id = ? AND quest_id = ?');
  const insertSaved = db.prepare(`
    INSERT INTO saved_quests (adventurer_id, quest_id) VALUES (?, ?)
  `);


  /**
   * Inserts a user if their email is not already taken, and
   * records the resulting id against their display name.
   *
   * @returns {number} the users.id, new or existing
   */
  function upsertUser(person, role) {
    const existing = findUserByEmail.get(person.email);

    if (existing) {
      userIdByName.set(existing.display_name, existing.id);
      return existing.id;
    }

    const result = insertUser.run(
      person.email, demoHash, role, person.display_name,
      person.phone ?? null, person.bio ?? null, person.profile_image ?? null
    );

    const id = Number(result.lastInsertRowid);
    userIdByName.set(person.display_name, id);
    counts.users += 1;
    return id;
  }

  /**
   * Looks a name up in a map and fails loudly if it is missing,
   * so a typo in seed-data.js surfaces immediately instead of
   * becoming a null foreign key.
   */
  function resolve(map, name, what) {
    const id = map.get(name);

    if (id === undefined) {
      throw new Error(`Seed data refers to an unknown ${what}: "${name}"`);
    }

    return id;
  }


  /* ----------------------------------------------------------
     1. Users
     Admins first, so the guild's own account exists before any
     official quest references it as its poster.
     ---------------------------------------------------------- */
  for (const admin of data.ADMINS) {
    upsertUser(admin, 'admin');
  }

  for (const customer of data.CUSTOMERS) {
    upsertUser(customer, 'customer');
  }


  /* ----------------------------------------------------------
     2. Adventurers
     Each needs a users row and an adventurer_profiles row, so
     they are created together. user_id is NOT NULL on the
     profile because an adventurer without an account could
     never accept a quest or answer an Auto-Party offer.
     ---------------------------------------------------------- */
  for (const adv of data.ADVENTURERS) {
    const userId = upsertUser(adv, 'adventurer');
    const existing = findProfileByUser.get(userId);

    if (existing) {
      adventurerIdByName.set(adv.display_name, existing.id);
      continue;
    }

    const result = insertProfile.run(
      userId, adv.class, adv.rank, adv.specialty ?? null,
      adv.willing_to_travel ?? null, adv.availability ?? 'available',
      adv.unavailable_until ?? null, adv.auto_party_opt_in ?? 0,
      adv.member_since ?? null
    );

    adventurerIdByName.set(adv.display_name, Number(result.lastInsertRowid));
    counts.adventurers += 1;
  }


  /* ----------------------------------------------------------
     3. Items
     Inserted before quests and orders, both of which may
     reference them.
     ---------------------------------------------------------- */
  for (const item of data.ITEMS) {
    const existing = findItemByName.get(item.name);

    if (existing) {
      itemIdByName.set(item.name, existing.id);
      continue;
    }

    const result = insertItem.run(
      item.name, item.category, item.subcategory ?? null,
      item.description ?? null, item.how_its_made ?? null, item.material ?? null,
      item.lead_time ?? null, item.price, item.member_price ?? null,
      item.badge ?? null, item.image ?? null
    );

    itemIdByName.set(item.name, Number(result.lastInsertRowid));
    counts.items += 1;
  }


  /* ----------------------------------------------------------
     4. Quests
     The three completion sign-offs are derived from status
     rather than listed per quest, because they move together:
     a completed quest has all three, and nothing else has any.
     Keeping that rule here means the content file cannot record
     an impossible combination.
     ---------------------------------------------------------- */
  for (const quest of data.QUESTS) {
    if (findQuestByTitle.get(quest.title)) {
      const existing = findQuestByTitle.get(quest.title);
      questIdByTitle.set(quest.title, existing.id);
      continue;
    }

    const postedBy = resolve(userIdByName, quest.poster, 'quest poster');
    const acceptedBy = quest.accepted_by
      ? resolve(adventurerIdByName, quest.accepted_by, 'adventurer')
      : null;

    const done = quest.status === 'completed' ? 1 : 0;

    const result = insertQuest.run(
      quest.title, quest.description, quest.objectives || null,
      quest.additional_info ?? null, quest.quest_type, quest.location,
      quest.reward ?? '', quest.rank_requirement ?? null,
      quest.expected_duration ?? null,
      quest.image ?? null, quest.status, postedBy, acceptedBy,
      quest.auto_party_enabled ?? 0,
      done, done, done,
      quest.accepted_at ?? null, quest.completed_at ?? null,
      quest.created_at ?? quest.accepted_at ?? '2026-08-01'
    );

    questIdByTitle.set(quest.title, Number(result.lastInsertRowid));
    counts.quests += 1;
  }


  /* ----------------------------------------------------------
     5. News
     ---------------------------------------------------------- */
  for (const entry of data.NEWS) {
    if (findNewsByTitle.get(entry.title)) {
      continue;
    }

    insertNews.run(
      entry.title, entry.category, entry.summary ?? null, entry.body,
      entry.author ?? null, entry.image ?? null, entry.is_featured ?? 0,
      entry.published_at
    );

    counts.news += 1;
  }


  /* ----------------------------------------------------------
     6. Enquiries
     user_id is filled where the sender has an account and left
     null where they do not, since the contact form is open to
     guests. The typed name and email are stored either way, so
     an enquiry stays readable if the account is later closed.
     ---------------------------------------------------------- */
  for (const enquiry of data.ENQUIRIES) {
    if (findEnquiry.get(enquiry.email, enquiry.created_at)) {
      continue;
    }

    const known = findUserByEmail.get(enquiry.email);

    insertEnquiry.run(
      known ? known.id : null, enquiry.name, enquiry.email,
      enquiry.phone ?? null, enquiry.enquiry_type ?? null, enquiry.message,
      enquiry.status ?? 'new', enquiry.admin_notes ?? null, enquiry.created_at
    );

    counts.enquiries += 1;
  }


  /* ----------------------------------------------------------
     7. Orders
     The total is calculated from the lines rather than stated
     in the content file, so the two can never disagree. Member
     pricing applies to adventurers, matching the shop.
     ---------------------------------------------------------- */
  for (const order of data.ORDERS) {
    const userId = resolve(userIdByName, order.customer, 'order customer');

    if (findOrder.get(userId, order.created_at)) {
      continue;
    }

    const isMember = adventurerIdByName.has(order.customer);

    // Line prices are read first so the total is known before
    // the order row is written.
    const lines = order.lines.map(line => {
      const itemId = resolve(itemIdByName, line.item, 'order item');
      const item = db.prepare('SELECT price, member_price FROM items WHERE id = ?').get(itemId);
      const unit = (isMember && item.member_price != null) ? item.member_price : item.price;

      return { itemId, quantity: line.quantity, unit };
    });

    const total = lines.reduce((sum, line) => sum + (line.unit * line.quantity), 0);

    const result = insertOrder.run(
      userId, order.payment_method, total, order.status ?? 'placed', order.created_at
    );

    const orderId = Number(result.lastInsertRowid);

    for (const line of lines) {
      insertOrderItem.run(orderId, line.itemId, line.quantity, line.unit);
    }

    counts.orders += 1;
  }


  /* ----------------------------------------------------------
     8. Gear
     ---------------------------------------------------------- */
  for (const entry of data.GEAR) {
    const advId = resolve(adventurerIdByName, entry.adventurer, 'gear owner');
    const itemId = resolve(itemIdByName, entry.item, 'gear item');

    if (findGear.get(advId, itemId)) {
      continue;
    }

    insertGear.run(advId, itemId, entry.equipped ?? 0);
    counts.gear += 1;
  }


  /* ----------------------------------------------------------
     9. Saved quests
     ---------------------------------------------------------- */
  for (const entry of data.SAVED_QUESTS) {
    const advId = resolve(adventurerIdByName, entry.adventurer, 'saving adventurer');
    const questId = resolve(questIdByTitle, entry.quest, 'saved quest');

    if (findSaved.get(advId, questId)) {
      continue;
    }

    insertSaved.run(advId, questId);
    counts.saved += 1;
  }

  return counts;
}


// Only runs when this file is executed directly (`node seed.js`),
// not when it is require()'d from server.js.
if (require.main === module) {
  const db = new DatabaseSync(DB_PATH);

  try {
    // Ensures the tables exist even if seed.js is run before
    // create.js, so the order of the two never matters.
    createTables(db);

    const counts = seedDatabase(db);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    if (total === 0) {
      console.log('Nothing to seed: every record is already present.');
    } else {
      console.log('Seeding complete. Rows inserted:');
      for (const [table, n] of Object.entries(counts)) {
        if (n > 0) {
          console.log(`  ${table.padEnd(12)} ${n}`);
        }
      }
      console.log(`\nAll seeded accounts share the password: ${data.DEMO_PASSWORD}`);
    }
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

module.exports = { seedDatabase };
