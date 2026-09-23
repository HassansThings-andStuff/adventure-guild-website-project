/* ============================================================
   Oceania Adventure Guild - administration routes
   SIT774 Website Project, Part 3 (Task 10.2D)

   The guild's own tools, all for an administrator account:

     GET   /api/admin/enquiries          the enquiry inbox, filtered and paged
     PATCH /api/admin/enquiries/:id      set an enquiry's status and notes
     GET   /api/admin/users              the members, filtered and paged
     PATCH /api/admin/users/:id/role     correct a member's role

   Used from server.js as:  require('./routes/admin')(app, db, guards);

   Enquiries hold a name, an email address and a phone number, and a
   member list holds email addresses, so none of this is ever sent to
   anyone but an administrator, and none of it is cached.

   Role correction exists to fix a mistake made at registration, such
   as someone who signed up as a customer meaning to be an adventurer.
   It is deliberately not a way to rewrite a member's history. A role
   is only changed when nothing would be orphaned or lost by doing so,
   and otherwise the reason is given. Administrator roles are never
   changed from here.
   ============================================================ */

const { makeTransaction } = require('./rules');

const ENQUIRY_STATUSES = ['new', 'in_progress', 'closed'];
const ENQUIRY_SORTS = { newest: 'e.created_at DESC, e.id DESC', oldest: 'e.created_at ASC, e.id ASC' };
const ENQUIRY_PAGE_SIZE = 8;
const MAX_NOTES_LENGTH = 2000;

const USER_ROLES = ['customer', 'adventurer', 'admin'];
const USER_PAGE_SIZE = 10;

const MAX_SEARCH_LENGTH = 80;
const idPattern = /^[1-9][0-9]{0,9}$/;


module.exports = function mountAdminRoutes(app, db, guards) {

  const { requireAdmin, adventurerClasses } = guards;
  const transaction = makeTransaction(db);


  /* ==========================================================
     SMALL HELPERS
     ========================================================== */

  /**
   * Escapes the characters LIKE treats as wildcards, so that a search
   * for 100% looks for those characters and not for "100 followed by
   * anything".
   */
  function escapeLike(text) {
    return text.replace(/[\\%_]/g, (character) => '\\' + character);
  }

  /**
   * Reads a page number from the query string. Anything that is not a
   * plain positive whole number is page one.
   */
  function pageFrom(value) {
    return /^[1-9][0-9]{0,5}$/.test(String(value || '')) ? Number(value) : 1;
  }

  /**
   * Reads the search text from the query string, or null when there is
   * none or it is too long to be a real search.
   */
  function searchFrom(value) {
    const text = typeof value === 'string' ? value.trim() : '';

    return text === '' ? null : text.slice(0, MAX_SEARCH_LENGTH);
  }

  const refuse = (res, fields) => res.status(400).json({
    error: 'Please correct the highlighted fields.',
    fields: fields
  });


  /* ==========================================================
     THE ENQUIRY INBOX
     ========================================================== */

  function enquiryShape(row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      type: row.enquiry_type,
      message: row.message,
      status: row.status,
      adminNotes: row.admin_notes || '',
      receivedAt: row.created_at,
      // Sent back with a change, so the server can tell the change was
      // made to the enquiry as it now is and not as it once was.
      updatedAt: row.updated_at,
      member: row.member_name
    };
  }

  const ENQUIRY_COLUMNS = `
    e.id, e.name, e.email, e.phone, e.enquiry_type, e.message, e.status, e.admin_notes,
    e.created_at, e.updated_at, u.display_name AS member_name
  `;

  const findEnquiry = db.prepare(`
    SELECT ${ENQUIRY_COLUMNS} FROM enquiries e LEFT JOIN users u ON u.id = e.user_id WHERE e.id = ?
  `);

  const countByStatus = db.prepare('SELECT status, COUNT(*) AS n FROM enquiries GROUP BY status');

  app.get('/api/admin/enquiries', requireAdmin, (req, res) => {
    const status = ENQUIRY_STATUSES.includes(req.query.status) ? req.query.status : 'all';
    const sort = Object.hasOwn(ENQUIRY_SORTS, req.query.sort) ? req.query.sort : 'newest';
    const search = searchFrom(req.query.search);
    const conditions = [];
    const values = [];

    if (status !== 'all') {
      conditions.push('e.status = ?');
      values.push(status);
    }

    if (search) {
      const pattern = '%' + escapeLike(search) + '%';

      conditions.push("(e.name LIKE ? ESCAPE '\\' OR e.email LIKE ? ESCAPE '\\' OR e.message LIKE ? ESCAPE '\\')");
      values.push(pattern, pattern, pattern);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = db.prepare('SELECT COUNT(*) AS n FROM enquiries e ' + where).get(...values).n;
    const totalPages = Math.max(1, Math.ceil(total / ENQUIRY_PAGE_SIZE));
    const page = Math.min(pageFrom(req.query.page), totalPages);

    // The ORDER BY comes from a fixed table, never from the request.
    const rows = db.prepare(
      'SELECT ' + ENQUIRY_COLUMNS + ' FROM enquiries e LEFT JOIN users u ON u.id = e.user_id '
      + where + ' ORDER BY ' + ENQUIRY_SORTS[sort] + ' LIMIT ? OFFSET ?'
    ).all(...values, ENQUIRY_PAGE_SIZE, (page - 1) * ENQUIRY_PAGE_SIZE);

    const counts = { new: 0, in_progress: 0, closed: 0, all: 0 };
    countByStatus.all().forEach((row) => {
      counts[row.status] = row.n;
      counts.all += row.n;
    });

    res.set('Cache-Control', 'no-store');
    res.json({
      enquiries: rows.map(enquiryShape),
      page: page,
      pageSize: ENQUIRY_PAGE_SIZE,
      totalPages: totalPages,
      total: total,
      counts: counts
    });
  });

  /* The change is made only if the enquiry is still as the administrator
     last saw it. If it was changed in the meantime, by another
     administrator, nothing is written and they are told, rather than one
     silently overwriting the other. */
  const updateEnquiry = db.prepare(`
    UPDATE enquiries
    SET status = ?, admin_notes = ?, updated_at = datetime('now')
    WHERE id = ? AND (? IS NULL OR updated_at = ?)
  `);

  app.patch('/api/admin/enquiries/:id', requireAdmin, (req, res, next) => {
    if (!idPattern.test(req.params.id)) {
      return res.status(404).json({ error: 'Enquiry not found.' });
    }

    const id = Number(req.params.id);
    const existing = findEnquiry.get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Enquiry not found.' });
    }

    const input = req.body ?? {};
    const errors = {};

    const status = input.status;
    if (!ENQUIRY_STATUSES.includes(status)) {
      errors.status = 'Choose new, in progress or closed.';
    }

    let notes = '';
    if (input.adminNotes !== undefined && input.adminNotes !== null) {
      if (typeof input.adminNotes !== 'string') {
        errors.adminNotes = 'Send text.';
      } else {
        notes = input.adminNotes.trim();

        if (notes.length > MAX_NOTES_LENGTH) {
          errors.adminNotes = 'Keep the notes to ' + MAX_NOTES_LENGTH + ' characters or fewer.';
        }
      }
    }

    const seen = typeof input.updatedAt === 'string' ? input.updatedAt : null;

    if (Object.keys(errors).length > 0) {
      return refuse(res, errors);
    }

    let result;

    try {
      result = updateEnquiry.run(status, notes === '' ? null : notes, id, seen, seen);
    } catch (err) {
      return next(err);
    }

    if (result.changes !== 1) {
      return res.status(409).json({
        error: 'This enquiry was changed by someone else after you opened it. It has been reloaded.',
        enquiry: enquiryShape(findEnquiry.get(id))
      });
    }

    res.json({ enquiry: enquiryShape(findEnquiry.get(id)) });
  });


  /* ==========================================================
     THE MEMBER LIST
     ========================================================== */

  const countByRole = db.prepare('SELECT role, COUNT(*) AS n FROM users GROUP BY role');

  app.get('/api/admin/users', requireAdmin, (req, res) => {
    const role = USER_ROLES.includes(req.query.role) ? req.query.role : 'all';
    const search = searchFrom(req.query.search);
    const conditions = [];
    const values = [];

    if (role !== 'all') {
      conditions.push('u.role = ?');
      values.push(role);
    }

    if (search) {
      const pattern = '%' + escapeLike(search) + '%';

      conditions.push("(u.display_name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')");
      values.push(pattern, pattern);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = db.prepare('SELECT COUNT(*) AS n FROM users u ' + where).get(...values).n;
    const totalPages = Math.max(1, Math.ceil(total / USER_PAGE_SIZE));
    const page = Math.min(pageFrom(req.query.page), totalPages);

    const rows = db.prepare(
      'SELECT u.id, u.display_name, u.email, u.role, u.is_active, substr(u.created_at, 1, 10) AS joined, '
      + 'a.class AS adventurer_class '
      + 'FROM users u LEFT JOIN adventurer_profiles a ON a.user_id = u.id '
      + where + ' ORDER BY u.id LIMIT ? OFFSET ?'
    ).all(...values, USER_PAGE_SIZE, (page - 1) * USER_PAGE_SIZE);

    const counts = { customer: 0, adventurer: 0, admin: 0, all: 0 };
    countByRole.all().forEach((row) => {
      counts[row.role] = row.n;
      counts.all += row.n;
    });

    res.set('Cache-Control', 'no-store');
    res.json({
      users: rows.map((row) => ({
        id: row.id,
        name: row.display_name,
        email: row.email,
        role: row.role,
        active: row.is_active === 1,
        joinedAt: row.joined,
        class: row.adventurer_class
      })),
      page: page,
      pageSize: USER_PAGE_SIZE,
      totalPages: totalPages,
      total: total,
      counts: counts,
      // The classes an administrator may give a new adventurer, so the
      // page never carries a list of its own that could drift.
      classes: adventurerClasses
    });
  });


  /* ==========================================================
     CORRECTING A ROLE
     ========================================================== */

  const findUser = db.prepare('SELECT id, role, display_name FROM users WHERE id = ?');

  // Quests a customer has posted that are still live. A customer who
  // became an adventurer could no longer manage them, since posting and
  // confirming are for customers.
  const countLivePosted = db.prepare(
    "SELECT COUNT(*) AS n FROM quests WHERE posted_by = ? AND status IN ('draft', 'open', 'matched', 'unmatched')"
  );

  // Everything that points at an adventurer's profile. If any of it
  // exists, removing the profile would either fail or erase a history.
  const findProfileUse = db.prepare(`
    SELECT a.id AS profile_id,
           (SELECT COUNT(*) FROM quests WHERE accepted_by = a.id) AS accepted,
           (SELECT COUNT(*) FROM quests WHERE targeted_adventurer_id = a.id) AS hired,
           (SELECT COUNT(*) FROM adventurer_gear WHERE adventurer_id = a.id) AS gear,
           (SELECT COUNT(*) FROM saved_quests WHERE adventurer_id = a.id) AS saved
    FROM adventurer_profiles a WHERE a.user_id = ?
  `);

  const insertProfile = db.prepare(`
    INSERT INTO adventurer_profiles (user_id, class, rank, member_since) VALUES (?, ?, 'bronze', ?)
  `);
  const deleteProfile = db.prepare('DELETE FROM adventurer_profiles WHERE id = ?');
  const setRole = db.prepare('UPDATE users SET role = ? WHERE id = ?');

  /**
   * Lists what stands in the way of turning an adventurer into a
   * customer, in words an administrator can act on.
   */
  function whyAdventurerCannotChange(use) {
    const reasons = [];

    if (use.accepted > 0) {
      reasons.push(use.accepted + (use.accepted === 1 ? ' quest' : ' quests') + ' accepted');
    }
    if (use.hired > 0) {
      reasons.push(use.hired + (use.hired === 1 ? ' hire request' : ' hire requests'));
    }
    if (use.gear > 0) {
      reasons.push(use.gear + (use.gear === 1 ? ' item of gear' : ' items of gear'));
    }
    if (use.saved > 0) {
      reasons.push(use.saved + ' saved ' + (use.saved === 1 ? 'quest' : 'quests'));
    }

    return reasons;
  }

  app.patch('/api/admin/users/:id/role', requireAdmin, (req, res, next) => {
    if (!idPattern.test(req.params.id)) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    const target = findUser.get(Number(req.params.id));

    if (!target) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    const input = req.body ?? {};
    const errors = {};
    const role = input.role;

    if (role !== 'customer' && role !== 'adventurer') {
      errors.role = 'Choose customer or adventurer.';
    }

    const adventurerClass = typeof input.class === 'string' ? input.class : '';

    if (role === 'adventurer' && !adventurerClasses.includes(adventurerClass)) {
      errors.class = 'Choose a class for the new adventurer.';
    }

    if (Object.keys(errors).length > 0) {
      return refuse(res, errors);
    }

    if (target.role === 'admin') {
      return res.status(409).json({ error: 'Administrator roles are not changed from here.' });
    }

    if (target.role === role) {
      return res.status(409).json({ error: target.display_name + ' is already a ' + role + '.' });
    }

    try {
      if (role === 'adventurer') {
        // Customer to adventurer.
        const live = countLivePosted.get(target.id).n;

        if (live > 0) {
          return res.status(409).json({
            error: target.display_name + ' has ' + live + ' unfinished '
              + (live === 1 ? 'quest' : 'quests') + ' posted as a customer. They would no longer be able '
              + 'to manage ' + (live === 1 ? 'it' : 'them') + ', so the role was not changed. '
              + 'Ask them to finish or cancel ' + (live === 1 ? 'it' : 'them') + ' first.'
          });
        }

        transaction(() => {
          insertProfile.run(target.id, adventurerClass, String(new Date().getFullYear()));
          setRole.run('adventurer', target.id);
        });
      } else {
        // Adventurer to customer.
        const use = findProfileUse.get(target.id);
        const reasons = use ? whyAdventurerCannotChange(use) : [];

        if (reasons.length > 0) {
          return res.status(409).json({
            error: target.display_name + ' already has a history on the site (' + reasons.join(', ')
              + '), and changing the role would erase it, so the role was not changed.'
          });
        }

        transaction(() => {
          if (use) {
            deleteProfile.run(use.profile_id);
          }

          setRole.run('customer', target.id);
        });
      }
    } catch (err) {
      return next(err);
    }

    res.json({ user: { id: target.id, name: target.display_name, role: role } });
  });

};
