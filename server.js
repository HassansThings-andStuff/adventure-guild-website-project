const express = require('express');
const session = require('express-session');
const logger = require('morgan');
const path = require('path');
const bcrypt = require('bcrypt');
const { DatabaseSync } = require('node:sqlite');

// Initialize Express app
const app = express();
const PORT = 3000;

// Middleware for logging and parsing JSON
app.use(logger('dev'));
app.use(express.json());

// Session setup
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false
}));

// Serve public static files
app.use(express.static('public'));

// SQLite database (Node built-in)
const db = new DatabaseSync('database.db');

// -----------------------------------------------------------------------------
// Database initialization & Seeding
// The same work is also available as standalone scripts (create.js, seed.js,
// display.js). It is repeated here so the server can start successfully on a
// machine where those scripts have not been run yet.

// Step 1: Create users table if it doesn't exist
// UNIQUE on username enforces one account per name at the database level.
// The CHECK on role means only a role the authorisation middleware
// understands can ever be stored.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('admin', 'member'))
  )
`);

// Step 2: Seed initial users (admin + member)
// Each account is inserted only if it is missing, so restarting the server
// never duplicates or overwrites existing accounts.
const SEED_USERS = [
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'member', password: 'member123', role: 'member' }
];

for (const user of SEED_USERS) {
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(user.username);

  if (!exists) {
    // Cost factor 10 matches the /api/register route below, so seeded and
    // self-registered accounts are hashed on identical terms.
    const passwordHash = bcrypt.hashSync(user.password, 10);

    db.prepare(`
      INSERT INTO users (username, password_hash, role)
      VALUES (?, ?, ?)
    `).run(user.username, passwordHash, user.role);

    console.log(`Seeded user '${user.username}' with role '${user.role}'.`);
  }
}

// -----------------------------------------------------------------------------

// Middleware

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireAdmin(req, res, next) {
  // Optional chaining guards against req.session.user being undefined. As
  // written, every route pairs requireLogin before requireAdmin so this can
  // never happen, but relying on call order for a security check is fragile:
  // if the pair were ever separated, reading .role of undefined would throw
  // a 500 instead of returning a clean 403.
  if (req.session.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Authentication routes

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);

  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Store session
  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  res.json({ message: 'Login successful' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out' });
  });
});

// API Route to Register new user
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;

  // Basic validation
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Check if user already exists
  const existingUser = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username);

  if (existingUser) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  // Hash password
  const passwordHash = bcrypt.hashSync(password, 10);

  // Insert new user (default role = member)
  db.prepare(`
    INSERT INTO users (username, password_hash, role)
    VALUES (?, ?, ?)
  `).run(username, passwordHash, 'member');

  // Registration does not create a session, so the user is not logged in at
  // this point. register.html redirects them to the login page, which is the
  // safer of the two behaviours: it proves the new credentials work.
  res.json({ message: 'Registration successful' });
});

// API route to get current user
app.get('/api/user', requireLogin, (req, res) => {
  res.json({ user: req.session.user });
});


// Protected Pages

// Members page (any logged-in user)
//
// members.html was moved from public/ to views/ during this task. Anything
// inside public/ is served directly by express.static, which meant the page
// could be reached at /members.html without ever passing through
// requireLogin. Files that a route is supposed to protect must live outside
// the static folder, which is why the starter code already kept
// profile.html in views/.
app.get('/members', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/members.html'));
});

// Admin-only profile page
app.get('/profile', requireLogin, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/profile.html'));
});


// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Type Ctrl+C to stop the server');
});