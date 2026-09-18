/* ============================================================
   Oceania Adventure Guild - database schema
   SIT774 Website Project, Part 3 (Task 10.2D)

   Creates every table the site needs. Safe to run repeatedly:
   CREATE TABLE IF NOT EXISTS leaves existing tables alone, so
   this never destroys data.

   Run standalone:  node create.js
   Or from server.js:  const { createTables, DB_PATH } = require('./create');

   Design notes that apply throughout:

   - Foreign keys are declared AND enforced. SQLite ignores them
     unless the pragma below is switched on for the connection,
     which is a common source of silent orphan rows.

   - CHECK constraints pin every field with a fixed vocabulary
     (roles, ranks, statuses, quest types) so an invalid value
     cannot reach the application. The database refuses states
     the site considers nonsense rather than trusting the code.

   - Columns an adventurer can occupy point at adventurer_profiles;
     columns any kind of user can occupy point at users. A quest
     holds both, because anyone may post one but only an
     adventurer may accept one.
   ============================================================ */

const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'guild.db');


/**
 * Creates every table, in dependency order so that each foreign
 * key target exists before the table referencing it.
 *
 * @param {DatabaseSync} db an open node:sqlite connection
 */
function createTables(db) {

  // Without this, SQLite parses REFERENCES clauses and then
  // ignores them. It is per-connection, so server.js must set it
  // too, not just this script.
  db.exec('PRAGMA foreign_keys = ON');


  /* ----------------------------------------------------------
     users
     One row per account, whatever its role.

     email is the login identifier and is therefore UNIQUE.
     display_name is what the site shows and is deliberately not
     unique, so two members may both be called Bram.

     bio and profile_image live here rather than on the
     adventurer profile because customers have them too; the
     customer account page shows both.

     is_active supports deactivating an account without deleting
     it, which matters because quests reference their poster.

     auto_party_banner_dismissed records that the user closed the
     Auto-Party launch banner, so it is not shown to them again.
     ---------------------------------------------------------- */
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id               INTEGER PRIMARY KEY,
      email            TEXT    NOT NULL UNIQUE,
      password_hash    TEXT    NOT NULL,
      role             TEXT    NOT NULL CHECK (role IN ('customer','adventurer','admin')),
      display_name     TEXT    NOT NULL,
      phone            TEXT,
      bio              TEXT,
      profile_image    TEXT,
      charter_accepted INTEGER NOT NULL DEFAULT 0 CHECK (charter_accepted IN (0,1)),
      auto_party_banner_dismissed INTEGER NOT NULL DEFAULT 0
                       CHECK (auto_party_banner_dismissed IN (0,1)),
      is_active        INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
      created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);


  /* ----------------------------------------------------------
     adventurer_profiles
     The adventurer-only half of an account. Its existence is
     what makes a user an adventurer; users.role carries the
     same fact so middleware can read it from the session
     without a second query.

     user_id is UNIQUE, enforcing one profile per account.

     availability has three values. available and on_quest are
     set by the system when a quest is accepted or completed.
     unavailable is set by the adventurer themselves, optionally
     with a date. Auto-Party's candidate filter excludes anything
     that is not 'available', which is what prevents
     double-booking across all three matching routes.

     available_since is the Auto-Party tiebreaker: among equally
     suitable candidates, the one waiting longest is offered
     first.
     ---------------------------------------------------------- */
  db.exec(`
    CREATE TABLE IF NOT EXISTS adventurer_profiles (
      id                INTEGER PRIMARY KEY,
      user_id           INTEGER NOT NULL UNIQUE REFERENCES users(id),
      class             TEXT    NOT NULL,
      rank              TEXT    NOT NULL CHECK (rank IN ('bronze','silver','gold')),
      specialty         TEXT,
      willing_to_travel TEXT,
      availability      TEXT    NOT NULL DEFAULT 'available'
                                CHECK (availability IN ('available','on_quest','unavailable')),
      unavailable_until TEXT,
      available_since   TEXT    NOT NULL DEFAULT (datetime('now')),
      auto_party_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (auto_party_opt_in IN (0,1)),
      member_since      TEXT
    )
  `);


  /* ----------------------------------------------------------
     quests
     The central table. One row is one piece of work, whether
     posted by a customer or by the guild itself.

     posted_by is the guild's own admin account for official
     quests, which is why no separate "is this a guild quest"
     flag is needed: the poster answers it.

     rank_requirement is nullable. NULL means any rank may take
     it, which the board already displays as "Rank required: Any".
     There is no match mode: the rank is advisory on the board and
     a minimum for Auto-Party, which is one rule rather than two.

     outcome_seen is the customer's half of the catch-up banner.
     It records whether they have seen the latest outcome on this
     quest, live or through the banner, so the banner lists only
     what they missed. It defaults to 1 because an outcome the
     user caused themselves is seen by definition.

     status values:
       draft      written but not published, visible to its poster only
       open       on the board, accepting adventurers
       matched    an adventurer is assigned
       unmatched  Auto-Party exhausted its candidates; off the board
       completed  all three sign-offs done
       cancelled  withdrawn by the poster or an admin, from any live state

     The three completion sign-offs are booleans rather than
     further status values. The chain runs adventurer marks done,
     poster confirms, admin verifies, and the account pages show
     wording derived from which flags are set. Modelling them as
     statuses would have turned six values into nine, most of
     which existed only to record which flags were true.
     ---------------------------------------------------------- */
  db.exec(`
    CREATE TABLE IF NOT EXISTS quests (
      id                     INTEGER PRIMARY KEY,
      title                  TEXT    NOT NULL,
      description            TEXT    NOT NULL,
      objectives             TEXT,
      additional_info        TEXT,
      quest_type             TEXT    NOT NULL
                                     CHECK (quest_type IN ('combat','escort','retrieval',
                                                           'investigation','rescue','delivery')),
      location               TEXT    NOT NULL,
      reward                 TEXT    NOT NULL,
      rank_requirement       TEXT    CHECK (rank_requirement IN ('bronze','silver','gold')),
      expected_duration      TEXT    CHECK (expected_duration IN ('hours','day','few-days',
                                                                 'week','week-plus')),
      image                  TEXT,
      status                 TEXT    NOT NULL DEFAULT 'draft'
                                     CHECK (status IN ('draft','open','matched','unmatched',
                                                       'completed','cancelled')),
      posted_by              INTEGER NOT NULL REFERENCES users(id),
      accepted_by            INTEGER REFERENCES adventurer_profiles(id),
      targeted_adventurer_id INTEGER REFERENCES adventurer_profiles(id),
      auto_party_enabled     INTEGER NOT NULL DEFAULT 0 CHECK (auto_party_enabled IN (0,1)),
      adventurer_marked_done INTEGER NOT NULL DEFAULT 0 CHECK (adventurer_marked_done IN (0,1)),
      poster_confirmed       INTEGER NOT NULL DEFAULT 0 CHECK (poster_confirmed IN (0,1)),
      admin_verified         INTEGER NOT NULL DEFAULT 0 CHECK (admin_verified IN (0,1)),
      outcome_seen           INTEGER NOT NULL DEFAULT 1 CHECK (outcome_seen IN (0,1)),
      accepted_at            TEXT,
      completed_at           TEXT,
      created_at             TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at             TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // The board's default view filters on status and sorts by date,
  // so this index covers the site's most frequent query.
  db.exec('CREATE INDEX IF NOT EXISTS idx_quests_status ON quests(status, created_at)');


  /* ----------------------------------------------------------
     items
     Shop stock. Everything is made to order, so there is no
     quantity column anywhere.

     member_price is nullable: an item without a member discount
     simply has none, and the card renders without the
     strikethrough rather than needing a second layout.

     badge drives the gold "New" and "Special" overlays, which
     are a stored property rather than something derivable.

     subcategory drives the conditional row that appears in the
     shop once a category is chosen.
     ---------------------------------------------------------- */
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id           INTEGER PRIMARY KEY,
      name         TEXT    NOT NULL,
      category     TEXT    NOT NULL,
      subcategory  TEXT,
      description  TEXT,
      how_its_made TEXT,
      material     TEXT,
      lead_time    TEXT,
      price        INTEGER NOT NULL CHECK (price >= 0),
      member_price INTEGER CHECK (member_price >= 0),
      badge        TEXT    CHECK (badge IN ('new','special')),
      image        TEXT,
      is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))
    )
  `);


  /* ----------------------------------------------------------
     enquiries
     Submissions from the contact form. Required by the 5.2D
     specification, which commits to storing query form data and
     giving guild staff a way to review it.

     user_id is nullable because the contact page is open to
     guests, who have no account. The name, email and phone
     columns hold what was typed, so an enquiry stays readable
     even if the account behind it is later deactivated.
     ---------------------------------------------------------- */
  db.exec(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id           INTEGER PRIMARY KEY,
      user_id      INTEGER REFERENCES users(id),
      name         TEXT    NOT NULL,
      email        TEXT    NOT NULL,
      phone        TEXT,
      enquiry_type TEXT,
      message      TEXT    NOT NULL,
      status       TEXT    NOT NULL DEFAULT 'new'
                           CHECK (status IN ('new','in_progress','closed')),
      admin_notes  TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);


  /* ----------------------------------------------------------
     orders and order_items
     Written when Place Order is pressed. The cart itself stays
     client-side as a staging area; the database records the
     order at the single moment it is confirmed.

     payment_method holds the parody methods established in the
     design document. Payment itself is settled at the guild hall
     counter, so nothing here models a transaction.
     ---------------------------------------------------------- */
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id             INTEGER PRIMARY KEY,
      user_id        INTEGER NOT NULL REFERENCES users(id),
      payment_method TEXT    NOT NULL,
      total          INTEGER NOT NULL CHECK (total >= 0),
      status         TEXT    NOT NULL DEFAULT 'placed'
                             CHECK (status IN ('placed','in_progress','ready','collected','cancelled')),
      created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  /* price_at_purchase is stored on the line rather than read
     back from items, so a past order does not silently change
     when a price is updated. */
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id                INTEGER PRIMARY KEY,
      order_id          INTEGER NOT NULL REFERENCES orders(id),
      item_id           INTEGER NOT NULL REFERENCES items(id),
      quantity          INTEGER NOT NULL CHECK (quantity > 0),
      price_at_purchase INTEGER NOT NULL CHECK (price_at_purchase >= 0)
    )
  `);


  /* ----------------------------------------------------------
     adventurer_gear
     Links adventurers to shop items. Equipped rows are the gear
     slots shown on the profile; unequipped rows are the
     inventory list beside them. One table answers both.

     There is no purchase gate: gear can be found, traded, or
     given as a quest reward, so ownership here is not evidence
     of an order.
     ---------------------------------------------------------- */
  db.exec(`
    CREATE TABLE IF NOT EXISTS adventurer_gear (
      id           INTEGER PRIMARY KEY,
      adventurer_id INTEGER NOT NULL REFERENCES adventurer_profiles(id),
      item_id      INTEGER NOT NULL REFERENCES items(id),
      equipped     INTEGER NOT NULL DEFAULT 0 CHECK (equipped IN (0,1)),
      UNIQUE (adventurer_id, item_id)
    )
  `);


  /* ----------------------------------------------------------
     saved_quests
     An adventurer bookmarking a quest for later. A composite
     primary key is the whole row: the pair is the fact, and it
     cannot be recorded twice.
     ---------------------------------------------------------- */
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_quests (
      adventurer_id INTEGER NOT NULL REFERENCES adventurer_profiles(id),
      quest_id      INTEGER NOT NULL REFERENCES quests(id),
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (adventurer_id, quest_id)
    )
  `);


  /* ----------------------------------------------------------
     news
     Dated guild announcements. The category drives the badge on
     each card and the brandy guild-voice treatment given to the
     featured announcement.
     ---------------------------------------------------------- */
  db.exec(`
    CREATE TABLE IF NOT EXISTS news (
      id           INTEGER PRIMARY KEY,
      title        TEXT    NOT NULL,
      category     TEXT    NOT NULL CHECK (category IN ('announcement','news','event')),
      summary      TEXT,
      body         TEXT    NOT NULL,
      author       TEXT,
      image        TEXT,
      is_featured  INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0,1)),
      published_at TEXT    NOT NULL
    )
  `);
}


// Only runs when this file is executed directly (`node create.js`),
// not when it is require()'d from server.js or seed.js.
if (require.main === module) {
  const db = new DatabaseSync(DB_PATH);

  try {
    createTables(db);
    console.log(`Database ready at: ${DB_PATH}`);
    console.log('Tables created (or already present):');
    console.log('  users, adventurer_profiles, quests, items, enquiries,');
    console.log('  orders, order_items, adventurer_gear, saved_quests, news');
  } catch (err) {
    console.error('Failed to create tables:', err.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

module.exports = { createTables, DB_PATH };
