/* ============================================================
   Oceania Adventure Guild - database inspection
   SIT774 Website Project, Part 3 (Task 10.2D)

   Reads every table back out and prints it to the terminal.
   This is the evidence that a page's content genuinely came
   from the database rather than from the markup: a browser
   screenshot shows what rendered, and this shows what is
   actually stored behind it.

   Run:
     node display.js              summary of every table
     node display.js quests       one table in full
     node display.js quests 5     one table, first 5 rows

   Tables: users, adventurers, quests, items, enquiries,
           orders, gear, saved, news
   ============================================================ */

const { DatabaseSync } = require('node:sqlite');
const { DB_PATH } = require('./create');

const db = new DatabaseSync(DB_PATH);
const DIVIDER = '-'.repeat(74);


/* Each view names the table it counts and the query used to
   list it. Keeping them in one object means adding a table
   later is one entry rather than a new branch. */
const VIEWS = {
  users: {
    table: 'users',
    label: 'Users',
    query: `SELECT id, email, role, display_name,
                   substr(password_hash, 1, 7) AS hash_prefix,
                   length(password_hash) AS hash_len
            FROM users ORDER BY id`
  },
  adventurers: {
    table: 'adventurer_profiles',
    label: 'Adventurer profiles',
    query: `SELECT a.id, u.display_name, a.class, a.rank, a.availability,
                   a.auto_party_opt_in AS opt_in
            FROM adventurer_profiles a
            JOIN users u ON u.id = a.user_id
            ORDER BY a.id`
  },
  quests: {
    table: 'quests',
    label: 'Quests',
    query: `SELECT q.id, q.title, q.quest_type AS type, q.location,
                   COALESCE(q.rank_requirement, 'any') AS rank, q.status,
                   p.display_name AS posted_by,
                   COALESCE(au.display_name, '-') AS accepted_by
            FROM quests q
            JOIN users p ON p.id = q.posted_by
            LEFT JOIN adventurer_profiles a ON a.id = q.accepted_by
            LEFT JOIN users au ON au.id = a.user_id
            ORDER BY q.id`
  },
  items: {
    table: 'items',
    label: 'Shop items',
    query: `SELECT id, name, category, subcategory, price,
                   COALESCE(member_price, '-') AS member_price,
                   COALESCE(badge, '-') AS badge
            FROM items ORDER BY id`
  },
  enquiries: {
    table: 'enquiries',
    label: 'Enquiries',
    query: `SELECT id, name, email, enquiry_type, status, created_at
            FROM enquiries ORDER BY created_at DESC`
  },
  orders: {
    table: 'orders',
    label: 'Orders',
    query: `SELECT o.id, u.display_name AS customer, o.payment_method,
                   o.total, o.status, o.created_at,
                   COUNT(oi.id) AS lines
            FROM orders o
            JOIN users u ON u.id = o.user_id
            LEFT JOIN order_items oi ON oi.order_id = o.id
            GROUP BY o.id ORDER BY o.created_at DESC`
  },
  gear: {
    table: 'adventurer_gear',
    label: 'Adventurer gear',
    query: `SELECT g.id, u.display_name AS adventurer, i.name AS item, g.equipped
            FROM adventurer_gear g
            JOIN adventurer_profiles a ON a.id = g.adventurer_id
            JOIN users u ON u.id = a.user_id
            JOIN items i ON i.id = g.item_id
            ORDER BY u.display_name, g.equipped DESC, i.name`
  },
  saved: {
    table: 'saved_quests',
    label: 'Saved quests',
    query: `SELECT u.display_name AS adventurer, q.title AS quest
            FROM saved_quests s
            JOIN adventurer_profiles a ON a.id = s.adventurer_id
            JOIN users u ON u.id = a.user_id
            JOIN quests q ON q.id = s.quest_id
            ORDER BY u.display_name`
  },
  news: {
    table: 'news',
    label: 'News',
    query: `SELECT id, title, category, published_at, is_featured
            FROM news ORDER BY published_at DESC`
  }
};


/**
 * Counts the rows in a table, returning null if it does not
 * exist yet rather than throwing.
 */
function countRows(table) {
  try {
    return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  } catch {
    return null;
  }
}

/**
 * Prints the row count of every table, plus a short breakdown
 * of the fields the site filters on most. This is the view to
 * screenshot before and after a database interaction.
 */
function printSummary() {
  console.log(`\nDatabase: ${DB_PATH}`);
  console.log(DIVIDER);

  const rows = Object.values(VIEWS).map(view => ({
    table: view.table,
    rows: countRows(view.table) ?? 'missing'
  }));

  console.table(rows);

  // Breakdowns, so a screenshot shows the spread the filters
  // act on rather than just a total.
  const breakdowns = [
    ['Quests by status', 'SELECT status, COUNT(*) AS n FROM quests GROUP BY status ORDER BY n DESC'],
    ['Quests by type', 'SELECT quest_type AS type, COUNT(*) AS n FROM quests GROUP BY quest_type ORDER BY n DESC'],
    ['Adventurers by rank', 'SELECT rank, COUNT(*) AS n FROM adventurer_profiles GROUP BY rank'],
    ['Enquiries by status', 'SELECT status, COUNT(*) AS n FROM enquiries GROUP BY status']
  ];

  for (const [label, sql] of breakdowns) {
    try {
      const result = db.prepare(sql).all();

      if (result.length > 0) {
        console.log(`\n${label}`);
        console.table(result);
      }
    } catch {
      // Table not created yet; the summary above already says so.
    }
  }

  console.log(`\nRun 'node display.js <table>' for the full contents of one table.`);
  console.log(`Tables: ${Object.keys(VIEWS).join(', ')}\n`);
}

/**
 * Prints one table in full, or its first n rows.
 */
function printTable(name, limit) {
  const view = VIEWS[name];

  if (!view) {
    console.log(`\nUnknown table: "${name}"`);
    console.log(`Try one of: ${Object.keys(VIEWS).join(', ')}\n`);
    process.exitCode = 1;
    return;
  }

  let rows;

  try {
    rows = db.prepare(view.query).all();
  } catch (err) {
    console.log(`\nCould not read ${view.table}: ${err.message}`);
    console.log('Run create.js and seed.js first.\n');
    process.exitCode = 1;
    return;
  }

  const shown = limit ? rows.slice(0, limit) : rows;

  console.log(`\n${view.label} (${view.table})`);
  console.log(`${rows.length} row(s)${limit && rows.length > limit ? `, showing first ${limit}` : ''}`);
  console.log(DIVIDER);
  console.table(shown);
  console.log('');
}


const [name, limitArg] = process.argv.slice(2);

try {
  if (name) {
    printTable(name, limitArg ? Number(limitArg) : null);
  } else {
    printSummary();
  }
} finally {
  db.close();
}
