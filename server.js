/* ============================================================
   Oceania Adventure Guild - application server
   SIT774 Website Project, Part 3 (Task 10.2D)

   Configuration, database, sessions, the authentication routes
   (register, log in, log out, who am I), the middleware that
   says who may reach what, the protected pages, and the
   handlers for missing pages and errors.

   Run with:  npm start   (or node server.js)
   ============================================================ */

const path = require('path');
const express = require('express');
const session = require('express-session');
const logger = require('morgan');
const bcrypt = require('bcrypt');
const { DatabaseSync } = require('node:sqlite');

// The schema and the seed content live in their own files so
// that they can also be run standalone. The server imports them
// rather than repeating them, so there is one definition of the
// tables and one path to the database file.
const { createTables, DB_PATH } = require('./create');
const { seedDatabase } = require('./seed');


/* ============================================================
   CONFIGURATION
   ============================================================ */

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Pages that must not be reachable without passing a route live here,
// outside public/, and are only ever sent by a route that checks first.
const VIEWS_DIR = path.join(__dirname, 'views');

const SESSION_COOKIE = 'oag.sid';
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

// Must match SALT_ROUNDS in seed.js, so that seeded and
// self-registered accounts are hashed on identical terms.
const BCRYPT_COST = 10;

/* The session secret signs the session cookie, so anyone who
   knows it can forge a login. It is therefore read from the
   environment rather than written in source, where it would end
   up in the repository.

   A fixed fallback keeps local development friction free, but a
   production server that quietly used a public fallback would be
   worse than one that refuses to start, so it refuses. */
const DEV_FALLBACK_SECRET = 'oag-development-only-secret';

if (IS_PRODUCTION && !process.env.SESSION_SECRET) {
  console.error('SESSION_SECRET must be set when NODE_ENV is production.');
  process.exit(1);
}

const SESSION_SECRET = process.env.SESSION_SECRET || DEV_FALLBACK_SECRET;


/* ============================================================
   DATABASE
   ============================================================ */

const db = new DatabaseSync(DB_PATH);

/* SQLite reads REFERENCES clauses and then ignores them unless
   this pragma is on, and the setting belongs to the connection,
   not to the database file. The connection create.js used to
   build the tables does not carry over to this one, so it has to
   be switched on here as well, or a row could point at a user
   that does not exist and nothing would complain. */
db.exec('PRAGMA foreign_keys = ON');

/* Both calls are safe to repeat. createTables leaves existing
   tables alone, and seedDatabase checks every record before
   inserting it. Running them on start means the server works on
   a machine where create.js and seed.js have never been run. */
createTables(db);

const seeded = seedDatabase(db);
const seededTotal = Object.values(seeded).reduce((sum, n) => sum + n, 0);

if (seededTotal > 0) {
  console.log(`Seeded ${seededTotal} rows into ${DB_PATH}`);
}

/* CREATE TABLE IF NOT EXISTS leaves an existing table exactly as it
   was, so a database made before a draft could be incomplete still
   insists on a quest type, and saving a draft with none would fail.
   The fix is to rebuild the file, which is safe because all of it is
   generated, and the server says so rather than failing later. */
const questTypeColumn = db.prepare('PRAGMA table_info(quests)').all()
  .find((column) => column.name === 'quest_type');

if (questTypeColumn && questTypeColumn.notnull === 1) {
  console.warn('This database was made before drafts could be incomplete.');
  console.warn('Rebuild it:  stop the server, delete guild.db, then run  node create.js  and  node seed.js');
}


/* ============================================================
   MIDDLEWARE
   Express runs these in the order they are registered, so the
   order below is deliberate.
   ============================================================ */

const app = express();

// The default header announces the framework and its version,
// which is information only an attacker has a use for.
app.disable('x-powered-by');

app.use(logger('dev'));

// Every form on the site is small, so a low ceiling costs
// nothing and stops an oversized body being parsed.
app.use(express.json({ limit: '10kb' }));

/* Static files come before the session, because a stylesheet or
   an image never depends on who is asking. Serving them first
   saves a session lookup on every asset.

   The consequence is that anything inside public/ is reachable
   by anyone, whatever a route says. Pages that must be
   protected therefore live in views/ and are sent by a route
   that checks the session first. */
app.use(express.static(path.join(__dirname, 'public')));


/* ============================================================
   SESSIONS
   ============================================================ */

/* The session itself is kept in server memory, and the browser
   holds only a signed cookie carrying its id.

   httpOnly:  page scripts cannot read the cookie, so a script
              injected into a page cannot steal the session.
   sameSite:  the browser withholds the cookie on requests
              started from other sites, which blunts cross-site
              request forgery. 'lax' still allows an ordinary
              link from elsewhere to arrive logged in.
   secure:    the cookie travels only over HTTPS. It is off
              locally, where the site runs on plain http, and on
              in production.
   maxAge:    a lost or borrowed device stops being logged in
              after two hours rather than indefinitely.

   saveUninitialized is false so that a visitor who never logs
   in never receives a cookie at all. */
app.use(session({
  name: SESSION_COOKIE,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PRODUCTION,
    maxAge: TWO_HOURS_MS
  }
}));


/* A session remembers who someone was when they logged in, and an
   administrator can change that afterwards, by correcting a role or
   switching an account off. Trusting the session alone would leave a
   demoted adventurer holding an adventurer's powers for up to two
   hours, until it expired.

   So every request that carries a session checks the account again,
   with one lookup by primary key. A changed role or name is carried
   into the session at once, and an account that no longer exists or
   has been switched off is logged out. Static files are served above
   this and do not pay for it. */
const findSessionUser = db.prepare('SELECT role, display_name, is_active FROM users WHERE id = ?');

app.use((req, res, next) => {
  const user = req.session.user;

  if (!user) {
    return next();
  }

  const current = findSessionUser.get(user.id);

  if (!current || current.is_active !== 1) {
    // Regenerating leaves a new, empty session in place, so the code
    // below can carry on as though nobody were logged in.
    return req.session.regenerate(() => {
      res.clearCookie(SESSION_COOKIE);
      next();
    });
  }

  user.role = current.role;
  user.displayName = current.display_name;
  next();
});


/* ============================================================
   RESPONSES BY KIND OF REQUEST
   ============================================================ */

/* Requests under /api/ come from scripts and want JSON. Every
   other request comes from a person navigating, and wants a
   page. Deciding by the address, rather than by guessing from
   headers, keeps the rule easy to state and to test. */
function isApiRequest(req) {
  return req.originalUrl.startsWith('/api/');
}

/* Sends a page from views/. no-store stops the browser keeping
   a copy, so the Back button after logging out cannot bring a
   protected page back from the cache. */
function sendView(res, name, status = 200) {
  res.status(status).set('Cache-Control', 'no-store').sendFile(path.join(VIEWS_DIR, name));
}


/* ============================================================
   AUTHORISATION MIDDLEWARE
   Route level checks, used as  app.get(path, requireRole('admin'), handler).

   Each one looks for the session itself instead of trusting
   that requireLogin ran first. A security check that only works
   when it is listed in the right order fails as a crash the
   first time somebody forgets, and a crash is not a refusal.

   401 means "I do not know who you are" and 403 means "I know
   who you are, and the answer is no". Keeping them apart lets
   the site send a stranger to the login page and a logged in
   person to a page explaining why they cannot enter.
   ============================================================ */

/* One place decides what a refusal looks like, so that every
   guarded route refuses the same way. A script gets JSON. A
   person gets a page: the login page if they are a stranger, or
   the access denied page if they are logged in and not allowed. */
function deny(req, res, status) {
  if (isApiRequest(req)) {
    return res.status(status).json({
      error: status === 401 ? 'Please log in to continue.' : 'Your account cannot do that.'
    });
  }

  if (status === 401) {
    return res.redirect('/login-register.html');
  }

  return sendView(res, 'forbidden.html', 403);
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return deny(req, res, 401);
  }

  next();
}

/**
 * Builds a middleware that admits only the listed roles.
 * requireRole('customer') or requireRole('admin', 'adventurer').
 */
function requireRole(...roles) {
  return function (req, res, next) {
    const user = req.session.user;

    if (!user) {
      return deny(req, res, 401);
    }

    if (!roles.includes(user.role)) {
      return deny(req, res, 403);
    }

    next();
  };
}

const requireAdmin = requireRole('admin');
const requireCustomer = requireRole('customer');
const requireAdventurer = requireRole('adventurer');


/* ============================================================
   AUTHENTICATION
   ============================================================ */

/* Same limits and pattern as the checks in js/auth.js. The
   browser checks are a convenience for the person typing. These
   are the ones that count, because anyone can send a request
   without using the form at all. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^[0-9]{8,15}$/;
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 120;
const MIN_PASSWORD_LENGTH = 10;

/* bcrypt reads only the first 72 bytes of a password. Anything
   longer would be silently cut short, so two long passwords that
   differ only after byte 72 would be the same password. Refusing
   them is more honest than truncating. */
const MAX_PASSWORD_BYTES = 72;

// Roles a visitor may choose for themselves. Admin is not on the
// list, because an admin account is granted by another admin.
const SELF_SERVICE_ROLES = ['customer', 'adventurer'];
const ADVENTURER_CLASSES = ['Fighter', 'Wizard', 'Rogue', 'Ranger', 'Cleric'];

/* A real hash of a password nobody holds. Login compares the
   submitted password against it when no account matches, so a
   missing account costs the same bcrypt work as a wrong
   password. Without that, the response time would tell an
   attacker which emails are registered. Built once at start up,
   because hashing is deliberately slow. */
const DUMMY_HASH = bcrypt.hashSync('not-the-password-of-any-account', BCRYPT_COST);

/* Prepared once and reused. Values only ever reach the database
   through the ? placeholders, never by joining strings, so a
   hostile email address cannot change what the query means. */
const findUserByEmail = db.prepare(`
  SELECT id, email, password_hash, role, display_name, is_active
  FROM users
  WHERE email = ?
`);

const insertUser = db.prepare(`
  INSERT INTO users (email, password_hash, role, display_name, phone, charter_accepted)
  VALUES (?, ?, ?, ?, ?, 1)
`);

// New adventurers start at bronze, and earn every rank after it.
const insertAdventurerProfile = db.prepare(`
  INSERT INTO adventurer_profiles (user_id, class, rank, member_since)
  VALUES (?, ?, 'bronze', ?)
`);

// Emails are compared in lower case so that Ann@x.com and
// ann@x.com cannot become two accounts.
function normaliseEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * Checks a registration body and returns the cleaned values
 * along with any problems, keyed by field name so the page can
 * show each message beside its field.
 *
 * Every value is type checked before it is used. Express 5
 * leaves req.body undefined when no JSON arrived, and a JSON
 * body can hold an object or an array where a string is
 * expected, which would crash bcrypt or the database driver.
 */
function validateRegistration(body) {
  const input = body ?? {};
  const errors = {};

  const role = input.role;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = normaliseEmail(input.email);
  const password = typeof input.password === 'string' ? input.password : '';
  const phone = typeof input.phone === 'string' ? input.phone.replace(/\s/g, '') : '';
  const adventurerClass = input.adventurerClass;

  if (!SELF_SERVICE_ROLES.includes(role)) {
    errors.role = 'Choose customer or adventurer.';
  }

  if (name === '') {
    errors.name = 'Enter your name.';
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `Keep your name to ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  if (!EMAIL_PATTERN.test(email) || email.length > MAX_EMAIL_LENGTH) {
    errors.email = 'Enter a valid email address.';
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    errors.password = 'That password is too long. Use 72 bytes or fewer.';
  }

  if (!PHONE_PATTERN.test(phone)) {
    errors.phone = 'Enter between 8 and 15 digits.';
  }

  if (input.charter !== true) {
    errors.charter = 'Please acknowledge the guild charter.';
  }

  // The class is only asked of adventurers, and is ignored for
  // customers rather than rejected, since a customer has none.
  if (role === 'adventurer' && !ADVENTURER_CLASSES.includes(adventurerClass)) {
    errors.adventurerClass = 'Choose a class.';
  }

  return {
    errors,
    values: { role, name, email, password, phone, adventurerClass }
  };
}

/* SQLite reports a broken UNIQUE constraint with the extended
   result code 2067. Relying on the database to refuse a
   duplicate is safer than looking first and inserting after,
   because two requests could both look, both see nothing, and
   both insert. The constraint cannot be raced. */
function isUniqueViolation(err) {
  return err.errcode === 2067 || /UNIQUE constraint failed/.test(err.message);
}


/* ------------------------------------------------------------
   Register
   ------------------------------------------------------------ */

app.post('/api/register', (req, res, next) => {
  const { errors, values } = validateRegistration(req.body);

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      error: 'Please correct the highlighted fields.',
      fields: errors
    });
  }

  // Hashed before the transaction opens, because hashing is the
  // slow step and the transaction should be as short as it can.
  const passwordHash = bcrypt.hashSync(values.password, BCRYPT_COST);

  /* An adventurer is two rows, a user and a profile, and either
     both exist or neither does. Without the transaction, a
     failure between the two inserts would leave a user who can
     log in but appears nowhere in the guild, and who could
     never register again because the email is taken.

     DatabaseSync blocks, so no other request can run between
     BEGIN and COMMIT. */
  try {
    db.exec('BEGIN');

    const result = insertUser.run(
      values.email, passwordHash, values.role, values.name, values.phone
    );

    if (values.role === 'adventurer') {
      insertAdventurerProfile.run(
        Number(result.lastInsertRowid),
        values.adventurerClass,
        String(new Date().getFullYear())
      );
    }

    db.exec('COMMIT');
  } catch (err) {
    // A failed statement does not end the transaction by
    // itself, so it is rolled back explicitly.
    if (db.isTransaction) {
      db.exec('ROLLBACK');
    }

    if (isUniqueViolation(err)) {
      return res.status(409).json({
        error: 'An account with that email address already exists.',
        fields: { email: 'An account with that email address already exists.' }
      });
    }

    return next(err);
  }

  /* No session is created here. Sending the new member to the
     login page proves that the credentials they just chose
     work, and keeps "who is logged in" changing in one place. */
  res.status(201).json({
    message: 'Account created. You can now log in.',
    user: { displayName: values.name, role: values.role }
  });
});


/* ------------------------------------------------------------
   Log in
   ------------------------------------------------------------ */

app.post('/api/login', (req, res, next) => {
  const input = req.body ?? {};

  // Refuse anything that is not text before it reaches bcrypt
  // or the database driver, both of which throw on an object.
  if (typeof input.email !== 'string' || typeof input.password !== 'string'
      || input.email.trim() === '' || input.password === '') {
    return res.status(400).json({ error: 'Enter your email address and password.' });
  }

  const user = findUserByEmail.get(normaliseEmail(input.email));

  // The comparison always runs, against a real hash when there
  // is no account, so both failures take about as long.
  const hash = user ? user.password_hash : DUMMY_HASH;
  const passwordMatches = bcrypt.compareSync(input.password, hash);

  /* One message for every kind of failure. Saying "no such
     account" or "wrong password" separately would let anyone
     test which emails are registered. A deactivated account is
     refused the same way, since it too is not one to describe. */
  if (!user || !user.is_active || !passwordMatches) {
    return res.status(401).json({ error: 'Incorrect email address or password.' });
  }

  /* regenerate() throws away the old session and issues a new
     id. If an attacker had planted a session id in the browser
     before login, that id stops meaning anything, so it cannot
     be used to ride in on the victim's login (session
     fixation). */
  req.session.regenerate((err) => {
    if (err) {
      return next(err);
    }

    /* Only what later requests need to identify the person and
       decide what they may do. The password hash and the rest of
       the row stay in the database, so a change made there is
       not shadowed by a stale copy held in the session. */
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.display_name
    };

    res.json({ user: { displayName: user.display_name, role: user.role } });
  });
});


/* ------------------------------------------------------------
   Log out
   ------------------------------------------------------------ */

app.post('/api/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }

    // Destroying the session makes the cookie worthless on the
    // server. Clearing it also tidies the browser.
    res.clearCookie(SESSION_COOKIE);
    res.json({ message: 'Logged out.' });
  });
});


/* ------------------------------------------------------------
   Who am I
   Lets a page ask whether anyone is logged in. A visitor who is
   not gets 200 with user null rather than 401, because a 401
   appears in the browser console as an error on every page a
   stranger opens, and the site is meant to run without any.
   ------------------------------------------------------------ */

app.get('/api/me', (req, res) => {
  const user = req.session.user;

  // The answer changes the moment someone logs in or out, so
  // no browser or proxy may keep a copy of it.
  res.set('Cache-Control', 'no-store');

  res.json({
    user: user ? { displayName: user.displayName, role: user.role } : null
  });
});


/* ============================================================
   READ ROUTES
   The quest board, the guild register and their detail pages
   read from here.
   They live in their own files so that server.js stays about
   wiring: what the app is made of, not every question it can
   answer.
   ============================================================ */

require('./routes/quests')(app, db);
require('./routes/adventurers')(app, db);


/* ============================================================
   WRITE ROUTES
   What visitors and members send to the guild: enquiries, quests,
   accepting and finishing them, and the member's own account. Each takes the guards it needs
   from here, so the rules about who may do what are still stated
   in one place, above, and not scattered through the files.
   ============================================================ */

require('./routes/enquiries')(app, db);
require('./routes/quests-write')(app, db, { requireCustomer });
require('./routes/lifecycle')(app, db, { requireAdventurer, requireCustomer, requireAdmin });
require('./routes/account')(app, db, { requireLogin });
require('./routes/admin')(app, db, { requireAdmin, adventurerClasses: ADVENTURER_CLASSES });


/* ============================================================
   PROTECTED PAGES
   Each is sent from views/ by a route that checks the session
   first. Because none of these files is inside public/, there
   is no address that reaches them without passing the check.
   ============================================================ */

/* One address for everyone's account page. Which page arrives
   depends on the role held by the account, so a visitor never
   has to know which one is theirs. Administrators have no
   personal account page and go to the administration page. */
app.get('/my-account', requireLogin, (req, res) => {
  const role = req.session.user.role;

  if (role === 'admin') {
    return res.redirect('/admin');
  }

  sendView(res, role === 'customer' ? 'my-account-customer.html' : 'my-account-adventurer.html');
});

// Only customers post quests. Adventurers accept them.
app.get('/post-quest', requireCustomer, (req, res) => {
  sendView(res, 'post-quest.html');
});

app.get('/admin', requireAdmin, (req, res) => {
  sendView(res, 'admin.html');
});


/* ============================================================
   NOT FOUND AND ERRORS
   These come last, because Express tries handlers in order and
   these are only reached when nothing above has answered.
   ============================================================ */

// Nothing matched: no static file, no route.
app.use((req, res) => {
  if (isApiRequest(req)) {
    return res.status(404).json({ error: 'Not found.' });
  }

  sendView(res, 'not-found.html', 404);
});

/* Express identifies this as the error handler by its four
   arguments, so `next` must stay even though it is unused.

   The real error is written to the server log for the developer
   and kept out of the response, because a stack trace or a
   database message tells an attacker about the internals. */
app.use((err, req, res, next) => {
  // Headers already sent means a reply is half written. The only
  // safe move is to hand over to Express, which closes it.
  if (res.headersSent) {
    return next(err);
  }

  /* Faults caused by the request rather than by the server, such
     as JSON that will not parse or a body over the size limit,
     carry a 4xx status. They are the sender's to fix, so they are
     answered plainly and are not logged as server errors. */
  const status = Number.isInteger(err.status) ? err.status : 500;

  if (status >= 400 && status < 500) {
    if (isApiRequest(req)) {
      return res.status(status).json({
        error: status === 413 ? 'That request is too large.' : 'That request could not be understood.'
      });
    }

    // A malformed address is, to a visitor, a page that is not there.
    return sendView(res, 'not-found.html', 404);
  }

  console.error(err.stack);

  if (isApiRequest(req)) {
    return res.status(500).json({ error: 'Something went wrong at the guild hall.' });
  }

  sendView(res, 'error.html', 500);
});


/* ============================================================
   START
   ============================================================ */

app.listen(PORT, () => {
  console.log(`Oceania Adventure Guild running at http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);

  if (!process.env.SESSION_SECRET) {
    console.warn('SESSION_SECRET is not set; using the development fallback.');
  }

  console.log('Press Ctrl+C to stop the server.');
});
