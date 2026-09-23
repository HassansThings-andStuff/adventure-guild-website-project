/* ============================================================
   Oceania Adventure Guild - adventurer read routes
   SIT774 Website Project, Part 3 (Task 10.2D)

   Two routes, both open to everyone:

     GET /api/adventurers       the guild register: search, filter,
                                sort and pagination, all in SQL
     GET /api/adventurers/:id   one adventurer, for the profile page

   Used from server.js as:  require('./routes/adventurers')(app, db);

   The same rules apply here as on the quest routes. Every value in
   the query string is checked against a fixed list or a strict
   pattern first, reaches the database only through ? placeholders,
   and the ORDER BY is chosen from a table of ready made fragments.

   Only an adventurer's public register entry leaves the server.
   Email addresses and phone numbers do not: contact between a
   client and an adventurer is brokered through the guild.
   ============================================================ */

const resolveImage = require('./images')();

const PAGE_SIZE = 5;

const CLASSES = ['Fighter', 'Wizard', 'Rogue', 'Ranger', 'Cleric'];
const RANKS = ['bronze', 'silver', 'gold'];
const AVAILABILITY_FILTERS = ['now', 'week'];

// Each entry is a complete ORDER BY fragment. The id at the end
// breaks ties, so a page never shows someone twice or skips them.
const SORTS = {
  rank: "CASE a.rank WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 ELSE 3 END, u.display_name COLLATE NOCASE, a.id",
  name: 'u.display_name COLLATE NOCASE, a.id',
  member: "COALESCE(a.member_since, '9999'), u.display_name COLLATE NOCASE, a.id"
};

/* Someone who has been deactivated is off the register, so every
   query starts from this. */
const ON_THE_REGISTER = 'u.is_active = 1';

const MAX_SEARCH_LENGTH = 80;
const MAX_LABEL_LENGTH = 80;
const BLURB_LENGTH = 170;


module.exports = function mountAdventurerRoutes(app, db) {

  /* ==========================================================
     WHAT THE BROWSER RECEIVES
     ========================================================== */

  // The short line under a name in the preview, cut at a word.
  function blurb(bio) {
    const text = (bio || '').replace(/\s+/g, ' ').trim();

    if (text.length <= BLURB_LENGTH) {
      return text;
    }

    return text.slice(0, BLURB_LENGTH).replace(/\s+\S*$/, '') + '\u2026';
  }

  function portrait(row) {
    return resolveImage(row.profile_image, '/images/adventurer-default-' + row.class.toLowerCase() + '.svg');
  }

  function summary(row, gear, session) {
    return {
      id: row.id,
      name: row.display_name,
      class: row.class,
      rank: row.rank,
      specialty: row.specialty,
      region: row.willing_to_travel,
      memberSince: row.member_since,
      portrait: portrait(row),
      availability: { status: row.availability, until: row.unavailable_until },
      blurb: blurb(row.bio),
      gear: gear,
      // True only for the person looking at their own entry, so the
      // page can say so instead of offering them a Hire button.
      isSelf: Boolean(session.user) && session.user.id === row.user_id
    };
  }

  const gearFor = (adventurerIds) => {
    if (adventurerIds.length === 0) {
      return new Map();
    }

    const rows = db.prepare(
      'SELECT g.adventurer_id, i.name, i.image FROM adventurer_gear g JOIN items i ON i.id = g.item_id '
      + 'WHERE g.equipped = 1 AND g.adventurer_id IN (' + adventurerIds.map(() => '?').join(', ') + ') '
      + 'ORDER BY g.id'
    ).all(...adventurerIds);

    const byAdventurer = new Map();

    rows.forEach((row) => {
      if (!byAdventurer.has(row.adventurer_id)) {
        byAdventurer.set(row.adventurer_id, []);
      }
      byAdventurer.get(row.adventurer_id).push({
        name: row.name,
        image: resolveImage(row.image, '/images/item-default.svg')
      });
    });

    return byAdventurer;
  };


  /* ==========================================================
     READING THE QUERY STRING
     ========================================================== */

  function escapeLike(text) {
    return text.replace(/[\\%_]/g, (character) => '\\' + character);
  }

  function readListQuery(query) {
    const errors = {};
    const values = {};

    const text = (name) => {
      const raw = query[name];
      if (raw === undefined) {
        return '';
      }
      if (typeof raw !== 'string') {
        errors[name] = 'Send one value only.';
        return '';
      }
      return raw.trim();
    };

    values.search = text('search');
    if (values.search.length > MAX_SEARCH_LENGTH) {
      errors.search = 'Keep the search to ' + MAX_SEARCH_LENGTH + ' characters or fewer.';
    }

    // Class is stored capitalised, and asked for in any case.
    const requestedClass = text('class');
    values.class = CLASSES.find((name) => name.toLowerCase() === requestedClass.toLowerCase()) || '';
    if (requestedClass && !values.class) {
      errors.class = 'Unknown class.';
    }

    values.rank = text('rank').toLowerCase();
    if (values.rank && !RANKS.includes(values.rank)) {
      errors.rank = 'Unknown rank.';
    }

    values.availability = text('availability');
    if (values.availability && !AVAILABILITY_FILTERS.includes(values.availability)) {
      errors.availability = 'Unknown availability.';
    }

    // Specialty and region are free text in the database, so they
    // are matched exactly against whatever the visitor chose from
    // the lists the server itself supplied.
    values.specialty = text('specialty');
    if (values.specialty.length > MAX_LABEL_LENGTH) {
      errors.specialty = 'That specialty is too long.';
    }

    values.region = text('region');
    if (values.region.length > MAX_LABEL_LENGTH) {
      errors.region = 'That region is too long.';
    }

    values.sort = text('sort') || 'rank';
    if (!Object.hasOwn(SORTS, values.sort)) {
      errors.sort = 'Unknown sort order.';
    }

    values.page = 1;
    const page = text('page');
    if (page) {
      if (!/^\d{1,6}$/.test(page) || Number(page) < 1) {
        errors.page = 'Use a page number of 1 or more.';
      } else {
        values.page = Number(page);
      }
    }

    return { errors, values };
  }


  /* ==========================================================
     THE REGISTER
     ========================================================== */

  const SELECT_COLUMNS = 'a.id, a.user_id, a.class, a.rank, a.specialty, a.willing_to_travel, '
    + 'a.availability, a.unavailable_until, a.member_since, u.display_name, u.bio, u.profile_image';

  app.get('/api/adventurers', (req, res) => {
    const { errors, values } = readListQuery(req.query);

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'That search could not be understood.', fields: errors });
    }

    const conditions = [ON_THE_REGISTER];
    const args = [];

    if (values.search) {
      const pattern = '%' + escapeLike(values.search) + '%';
      conditions.push("(u.display_name LIKE ? ESCAPE '\\' OR a.specialty LIKE ? ESCAPE '\\' "
        + "OR a.class LIKE ? ESCAPE '\\' OR u.bio LIKE ? ESCAPE '\\')");
      args.push(pattern, pattern, pattern, pattern);
    }

    if (values.class) {
      conditions.push('a.class = ?');
      args.push(values.class);
    }

    if (values.rank) {
      conditions.push('a.rank = ?');
      args.push(values.rank);
    }

    if (values.specialty) {
      conditions.push('a.specialty = ?');
      args.push(values.specialty);
    }

    if (values.region) {
      conditions.push('a.willing_to_travel = ?');
      args.push(values.region);
    }

    /* "Available now" means free at this moment. "This week" also
       admits someone who is away but due back within seven days. An
       adventurer on a quest has no known return date, so they are
       in neither. */
    if (values.availability === 'now') {
      conditions.push("a.availability = 'available'");
    } else if (values.availability === 'week') {
      conditions.push("(a.availability = 'available' OR (a.availability = 'unavailable' "
        + "AND a.unavailable_until IS NOT NULL AND a.unavailable_until <= date('now', '+7 days')))");
    }

    const where = conditions.join(' AND ');
    const from = ' FROM adventurer_profiles a JOIN users u ON u.id = a.user_id ';

    const total = db.prepare('SELECT COUNT(*) AS n' + from + 'WHERE ' + where).get(...args).n;
    const totalAll = db.prepare('SELECT COUNT(*) AS n' + from + 'WHERE ' + ON_THE_REGISTER).get().n;

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(values.page, totalPages);

    const rows = db.prepare(
      'SELECT ' + SELECT_COLUMNS + from + 'WHERE ' + where
      + ' ORDER BY ' + SORTS[values.sort] + ' LIMIT ? OFFSET ?'
    ).all(...args, PAGE_SIZE, (page - 1) * PAGE_SIZE);

    const gear = gearFor(rows.map((row) => row.id));

    // The lists in the drop-downs come from the data, so they can
    // never offer a choice that matches nobody.
    const distinct = (column) => db.prepare(
      'SELECT DISTINCT ' + column + ' AS value' + from + 'WHERE ' + ON_THE_REGISTER
      + ' AND ' + column + ' IS NOT NULL ORDER BY ' + column + ' COLLATE NOCASE'
    ).all().map((row) => row.value);

    res.set('Cache-Control', 'no-store');

    res.json({
      adventurers: rows.map((row) => summary(row, gear.get(row.id) || [], req.session)),
      page,
      pageSize: PAGE_SIZE,
      totalPages,
      total,
      totalAll,
      filters: {
        specialties: distinct('a.specialty'),
        regions: distinct('a.willing_to_travel')
      }
    });
  });


  /* ==========================================================
     ONE ADVENTURER
     ========================================================== */

  const findAdventurer = db.prepare(
    'SELECT ' + SELECT_COLUMNS + ' FROM adventurer_profiles a JOIN users u ON u.id = a.user_id '
    + 'WHERE a.id = ? AND ' + ON_THE_REGISTER
  );

  // The quests this adventurer has finished. Titles only: a quest's
  // own page is private once it is over, so nothing links to it.
  const findHistory = db.prepare(
    "SELECT q.title, q.completed_at FROM quests q WHERE q.accepted_by = ? AND q.status = 'completed' "
    + 'ORDER BY q.completed_at DESC, q.id DESC'
  );

  app.get('/api/adventurers/:id', (req, res) => {
    res.set('Cache-Control', 'no-store');

    if (!/^[1-9][0-9]{0,9}$/.test(req.params.id)) {
      return res.status(404).json({ error: 'Adventurer not found.' });
    }

    const row = findAdventurer.get(Number(req.params.id));

    if (!row) {
      return res.status(404).json({ error: 'Adventurer not found.' });
    }

    const gear = gearFor([row.id]).get(row.id) || [];

    res.json({
      adventurer: Object.assign(summary(row, gear, req.session), {
        bio: row.bio || '',
        history: findHistory.all(row.id).map((quest) => ({
          title: quest.title,
          completedAt: quest.completed_at ? String(quest.completed_at).slice(0, 10) : null
        }))
      })
    });
  });

};
