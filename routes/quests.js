/* ============================================================
   Oceania Adventure Guild - quest read routes
   SIT774 Website Project, Part 3 (Task 10.2D)

   Two routes, both open to everyone:

     GET /api/quests       the quest board: search, filter, sort
                           and pagination, all done in SQL
     GET /api/quests/:id   one quest, for the detail page

   Used from server.js as:  require('./routes/quests')(app, db);

   Every value that arrives in a query string is checked against
   a fixed list or a strict pattern before it goes anywhere near
   SQL, and reaches the database only through ? placeholders.
   The one part of a query that cannot be a placeholder, the
   ORDER BY, is chosen from a small table of ready made
   fragments, never built from what the visitor sent.
   ============================================================ */

const { progressOf } = require('./rules');
const PAGE_SIZE = 12;

const QUEST_TYPES = ['combat', 'escort', 'retrieval', 'investigation', 'rescue', 'delivery'];
const RANKS = ['bronze', 'silver', 'gold'];

/* The board offers three duration choices, but the database holds
   five values, so each choice stands for a group of them. */
const DURATION_GROUPS = {
  day: ['hours', 'day'],
  days: ['few-days'],
  week: ['week', 'week-plus']
};

const POSTER_KINDS = ['guild', 'public'];

/* A reward is free text, such as "4,500 gold" or "60 gold and a
   week of bread", so its numeric value is read from the front of
   the text at query time: commas out, then everything up to the
   first non digit. A reward with no leading number counts as 0.
   Working it out here rather than storing it means the number
   can never drift out of step with the words. */
const REWARD_AMOUNT = "CAST(REPLACE(q.reward, ',', '') AS INTEGER)";

/* The whole of the board's visibility rule, stated once. A quest
   is on the board while it is open or matched, and never when it
   has been aimed at one particular adventurer. */
const ON_THE_BOARD = "q.status IN ('open','matched') AND q.targeted_adventurer_id IS NULL";

// Each entry is a complete ORDER BY fragment. The id at the end
// breaks ties, so a page never shows a quest twice or skips one.
const SORTS = {
  posted: 'q.created_at DESC, q.id DESC',
  reward: 'reward_amount DESC, q.id DESC',
  title: 'q.title COLLATE NOCASE ASC, q.id ASC'
};

const MAX_SEARCH_LENGTH = 80;
const MAX_LOCATION_LENGTH = 60;


module.exports = function mountQuestRoutes(app, db) {

  /* ==========================================================
     ARTWORK
     A quest whose named image file does not exist yet gets the
     default picture for its type, so no card shows a broken image.
     ========================================================== */

  const resolveImage = require('./images')();

  function questImage(row) {
    // A draft may have no type yet, and gets the unfinished scroll.
    return resolveImage(row.image, '/images/quest-default-' + (row.quest_type || 'draft') + '.svg');
  }


  /* ==========================================================
     WHAT THE BROWSER RECEIVES
     Only what the pages show. Nobody's email, phone number or
     internal id leaves the server: a quest says whether the
     guild posted it, not who at the guild.
     ========================================================== */

  function summary(row) {
    return {
      id: row.id,
      title: row.title,
      type: row.quest_type,
      location: row.location,
      reward: row.reward,
      rank: row.rank_requirement,
      duration: row.expected_duration,
      image: questImage(row),
      status: row.status,
      isOfficial: row.is_official === 1,
      postedAt: String(row.created_at).slice(0, 10)
    };
  }

  const findHiredAdventurer = db.prepare(`
    SELECT a.id, u.display_name AS name
    FROM adventurer_profiles a JOIN users u ON u.id = a.user_id
    WHERE a.id = ?
  `);

  /**
   * Works out what the person looking at a quest may do with it, so
   * the page can offer the right button without knowing the rules. The
   * server decides here and again when the button is pressed, because
   * the page could be out of date, or not the page at all.
   *
   * @param {Object} row the quest row, with is_official
   * @param {Object|null} user the session user, if logged in
   * @returns {Object} the viewer's options
   */
  function viewerOptions(row, user) {
    const options = {
      canAccept: false,     // an adventurer who may take it now
      busy: false,          // one who could, but is already on a quest
      hiredMe: false,       // one who has been hired for it
      isAccepter: false,    // the adventurer who holds it
      canMarkDone: false,
      canConfirm: false,    // the customer who posted it, once it is done
      canVerify: false,     // the guild, once it is done and confirmed
      canAdminCancel: false
    };

    if (!user) {
      return options;
    }

    if (user.role === 'adventurer') {
      const me = findAdventurerProfile.get(user.id);

      if (me) {
        const takeable = row.status === 'open' && row.auto_party_enabled === 0
          && (row.targeted_adventurer_id === null || row.targeted_adventurer_id === me.id);

        options.isAccepter = row.accepted_by === me.id;
        options.hiredMe = row.targeted_adventurer_id === me.id;
        options.canAccept = takeable && me.availability !== 'on_quest';
        options.busy = takeable && me.availability === 'on_quest';
        options.canMarkDone = options.isAccepter && row.status === 'matched'
          && row.adventurer_marked_done === 0;
      }
    } else if (user.role === 'customer') {
      options.canConfirm = row.posted_by === user.id && row.status === 'matched'
        && row.adventurer_marked_done === 1 && row.poster_confirmed === 0;
    } else if (user.role === 'admin') {
      options.canVerify = progressOf(row, row.is_official === 1) === 'awaiting_verification';
      options.canAdminCancel = ['open', 'unmatched', 'matched'].includes(row.status);
    }

    return options;
  }

  /* What the page needs to edit the quest is only sent to the person
     who posted it: whether it is theirs, and who they are hiring. To
     anyone else, both are simply absent. How far a matched quest has
     got, and who holds it, go to the people concerned and the guild,
     and to no one else. */
  function detail(row, user) {
    const isMine = Boolean(user) && row.posted_by === user.id;
    const viewer = viewerOptions(row, user);
    const concerned = isMine || viewer.isAccepter || (Boolean(user) && user.role === 'admin');
    const hired = isMine && row.targeted_adventurer_id !== null
      ? findHiredAdventurer.get(row.targeted_adventurer_id)
      : null;
    const holder = concerned && row.accepted_by !== null
      ? findHiredAdventurer.get(row.accepted_by)
      : null;

    return Object.assign(summary(row), {
      description: row.description,
      objectives: (row.objectives || '').split('\n').map((line) => line.trim()).filter(Boolean),
      additionalInfo: row.additional_info,
      autoParty: row.auto_party_enabled === 1,
      isMine: isMine,
      hiring: hired ? { id: hired.id, name: hired.name } : null,
      progress: concerned ? progressOf(row, row.is_official === 1) : null,
      adventurer: holder ? { id: holder.id, name: holder.name } : null,
      viewer: viewer
    });
  }


  /* ==========================================================
     READING THE QUERY STRING
     ========================================================== */

  // % and _ are wildcards in LIKE. A visitor searching for
  // "50%" means the characters, so each is escaped.
  function escapeLike(text) {
    return text.replace(/[\\%_]/g, (character) => '\\' + character);
  }

  /**
   * Checks every parameter and returns the cleaned values, or the
   * problems found, keyed by parameter name. Anything that is not
   * a plain string is refused, because ?type=a&type=b arrives as
   * an array and would otherwise be passed along untested.
   */
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

    values.location = text('location');
    if (values.location.length > MAX_LOCATION_LENGTH) {
      errors.location = 'That location is too long.';
    }

    values.type = text('type').toLowerCase();
    if (values.type && !QUEST_TYPES.includes(values.type)) {
      errors.type = 'Unknown quest type.';
    }

    values.rank = text('rank').toLowerCase();
    if (values.rank && !RANKS.includes(values.rank)) {
      errors.rank = 'Unknown rank.';
    }

    values.duration = text('duration');
    if (values.duration && !Object.hasOwn(DURATION_GROUPS, values.duration)) {
      errors.duration = 'Unknown duration.';
    }

    values.poster = text('poster');
    if (values.poster && !POSTER_KINDS.includes(values.poster)) {
      errors.poster = 'Unknown poster.';
    }

    values.sort = text('sort') || 'posted';
    if (!Object.hasOwn(SORTS, values.sort)) {
      errors.sort = 'Unknown sort order.';
    }

    values.minReward = null;
    values.maxReward = null;
    const reward = text('reward');
    if (reward) {
      const range = /^(\d{1,8})-(\d{1,8})$/.exec(reward);
      if (!range || Number(range[1]) > Number(range[2])) {
        errors.reward = 'Use a range such as 1000-5000.';
      } else {
        values.minReward = Number(range[1]);
        values.maxReward = Number(range[2]);
      }
    }

    values.posted = null;
    const posted = text('posted');
    if (posted) {
      if (!/^\d{1,3}$/.test(posted) || Number(posted) < 1) {
        errors.posted = 'Use a number of days.';
      } else {
        values.posted = Number(posted);
      }
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
     THE BOARD
     ========================================================== */

  app.get('/api/quests', (req, res) => {
    const { errors, values } = readListQuery(req.query);

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'That search could not be understood.', fields: errors });
    }

    // Each condition is added only when the visitor set that
    // filter, and each brings its own values, in order.
    const conditions = [ON_THE_BOARD];
    const args = [];

    if (values.search) {
      const pattern = '%' + escapeLike(values.search) + '%';
      conditions.push("(q.title LIKE ? ESCAPE '\\' OR q.description LIKE ? ESCAPE '\\' OR q.location LIKE ? ESCAPE '\\')");
      args.push(pattern, pattern, pattern);
    }

    if (values.type) {
      conditions.push('q.quest_type = ?');
      args.push(values.type);
    }

    if (values.location) {
      conditions.push('q.location = ?');
      args.push(values.location);
    }

    /* A quest with no rank set accepts anyone, so it stays in the
       results whichever rank is chosen. */
    if (values.rank) {
      conditions.push('(q.rank_requirement = ? OR q.rank_requirement IS NULL)');
      args.push(values.rank);
    }

    if (values.minReward !== null) {
      conditions.push(REWARD_AMOUNT + ' BETWEEN ? AND ?');
      args.push(values.minReward, values.maxReward);
    }

    if (values.posted !== null) {
      conditions.push("julianday('now') - julianday(q.created_at) <= ?");
      args.push(values.posted);
    }

    if (values.duration) {
      const group = DURATION_GROUPS[values.duration];
      conditions.push('q.expected_duration IN (' + group.map(() => '?').join(', ') + ')');
      args.push(...group);
    }

    // The guild is whoever holds an admin account.
    if (values.poster === 'guild') {
      conditions.push("u.role = 'admin'");
    } else if (values.poster === 'public') {
      conditions.push("u.role <> 'admin'");
    }

    const where = conditions.join(' AND ');

    const total = db.prepare(
      'SELECT COUNT(*) AS n FROM quests q JOIN users u ON u.id = q.posted_by WHERE ' + where
    ).get(...args).n;

    // The whole board with no filters, so the page can say
    // "3 matches out of 28 quests".
    const totalOnBoard = db.prepare(
      'SELECT COUNT(*) AS n FROM quests q WHERE ' + ON_THE_BOARD
    ).get().n;

    // A page number past the end lands on the last page rather
    // than on an empty one.
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(values.page, totalPages);

    const rows = db.prepare(
      'SELECT q.id, q.title, q.quest_type, q.location, q.reward, q.rank_requirement, '
      + 'q.expected_duration, q.image, q.status, q.created_at, '
      + REWARD_AMOUNT + ' AS reward_amount, (u.role = \'admin\') AS is_official '
      + 'FROM quests q JOIN users u ON u.id = q.posted_by '
      + 'WHERE ' + where + ' ORDER BY ' + SORTS[values.sort] + ' LIMIT ? OFFSET ?'
    ).all(...args, PAGE_SIZE, (page - 1) * PAGE_SIZE);

    // The location list comes from the data, so it can never
    // offer a place with no quests, or miss one that has some.
    const locations = db.prepare(
      'SELECT DISTINCT q.location FROM quests q WHERE ' + ON_THE_BOARD
      + ' ORDER BY q.location COLLATE NOCASE'
    ).all().map((row) => row.location);

    // The board changes whenever anyone posts or accepts a
    // quest, so no copy of it may be kept.
    res.set('Cache-Control', 'no-store');

    res.json({
      quests: rows.map(summary),
      page,
      pageSize: PAGE_SIZE,
      totalPages,
      total,
      totalOnBoard,
      filters: { locations }
    });
  });


  /* ==========================================================
     ONE QUEST
     ========================================================== */

  const findQuest = db.prepare(`
    SELECT q.*, (u.role = 'admin') AS is_official
    FROM quests q
    JOIN users u ON u.id = q.posted_by
    WHERE q.id = ?
  `);

  const findAdventurerProfile = db.prepare('SELECT id, availability FROM adventurer_profiles WHERE user_id = ?');

  /* Who may see a quest that is not on the board.

     A draft belongs to the person who wrote it and nobody else,
     administrators included. Anything else that has left the
     board, a finished or cancelled quest or one aimed at a single
     adventurer, is visible to the poster, to the adventurer it
     concerns, and to an administrator. Everyone else is told it
     does not exist, which is also the answer for an id that
     really does not exist, so the difference cannot be probed. */
  function canSee(quest, user) {
    const onTheBoard = (quest.status === 'open' || quest.status === 'matched')
      && quest.targeted_adventurer_id === null;

    if (onTheBoard) {
      return true;
    }

    if (!user) {
      return false;
    }

    if (quest.posted_by === user.id) {
      return true;
    }

    if (quest.status === 'draft') {
      return false;
    }

    if (user.role === 'admin') {
      return true;
    }

    const profile = findAdventurerProfile.get(user.id);

    return Boolean(profile)
      && (quest.accepted_by === profile.id || quest.targeted_adventurer_id === profile.id);
  }

  app.get('/api/quests/:id', (req, res) => {
    res.set('Cache-Control', 'no-store');

    // An id that is not a plain positive integer cannot exist.
    if (!/^[1-9][0-9]{0,9}$/.test(req.params.id)) {
      return res.status(404).json({ error: 'Quest not found.' });
    }

    const quest = findQuest.get(Number(req.params.id));

    if (!quest || !canSee(quest, req.session.user)) {
      return res.status(404).json({ error: 'Quest not found.' });
    }

    res.json({ quest: detail(quest, req.session.user) });
  });

};
