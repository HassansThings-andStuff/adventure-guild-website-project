/* ============================================================
   Oceania Adventure Guild - Auto-Party
   SIT774 Website Project, Task 10.3HD

   Built from the accepted design in SIT774_7_3HD_Auto-Party_v2.pdf
   (Task 7.3HD). Section references in the comments
   below point back to that document's own step numbers.

   Auto-Party opt-in matches a customer's quest to a suitable
   adventurer automatically: filtered by quest type, availability
   and rank, ordered by rank proximity to the quest's requirement
   with longest-waiting as the tiebreaker, and offered one
   candidate at a time. Declines and 60-second timeouts move the
   cascade to the next candidate without the customer or adventurer
   having to do anything. Accepting is the adventurer's own,
   confirmed choice; Auto-Party finds and proposes the match, it
   never commits one on the adventurer's behalf (Step 7,
   "Automatic acceptance").

   Routes:
     GET   /api/events                    the shared SSE connection
     GET   /api/match-offers/current       reconnect snapshot
     POST  /api/offers/:id/accept
     POST  /api/offers/:id/decline
     POST  /api/quests/:id/retrigger       customer retries an exhausted search
     PATCH /api/my/auto-party              adventurer's opt-in and preferences
     GET   /api/catch-up                   what happened while the user was away
     POST  /api/catch-up/seen              mark those items as shown
     POST  /api/me/auto-party-banner       dismiss the one-time launch banner

   Used from server.js as:
     const autoParty = require('./routes/auto-party')(app, db, guards);
   The returned object exposes advanceCascade, onQuestCancelled
   and voidOtherPendingOffers for the write routes that trigger or
   interrupt a cascade (posting a quest, manual accept, cancelling).
   server.js also starts the 60-second expiry sweep from it.

   Transport (Step 5): every logged-in browser holds one EventSource
   connection to GET /api/events, opened by a shared script on every
   page. The server pushes down that connection the moment something
   happens; nothing is ever polled. This file's push() writes
   directly to the response objects held open by that route, kept in
   an in-memory map keyed by user id. That is enough for a single
   Node process, which is what Step 6 (Performance) says this site
   needs; a second server process would need each to know about the
   other's connections, which this design does not attempt.

   WHERE AUTO-PARTY LIVES
   This file is the engine. Every other part of the feature is a
   small addition to a file that already existed, marked in that
   file's comments with "Auto-Party" or "Task 10.3HD":

   Server and database
     create.js               match_offers (one row per offer, with its
                             60-second deadline), adventurer_quest_
                             preferences (the quest types each adventurer
                             wants), users.auto_party_banner_dismissed,
                             adventurer_profiles.auto_party_opt_in and
                             available_since, quests.auto_party_enabled
     server.js               mounts this file, hands its functions to the
                             write routes, and starts the expiry sweep and
                             the return-from-unavailable sweep
     routes/quests-write.js  posting or publishing an Auto-Party quest
                             starts the cascade; editing is refused while
                             it is being matched; cancelling calls
                             onQuestCancelled
     routes/lifecycle.js     a quest being matched cannot be accepted from
                             the board; accepting any quest voids the
                             adventurer's other pending offers; the
                             guild's cancel calls onQuestCancelled; a
                             declined hire reuses push() and catch-up to
                             tell the customer
     routes/quests.js        reports autoParty so the board and quest page
                             can show the "Auto-Party matching" ribbon
     routes/account.js       PATCH /api/my/availability, which decides
                             whether an adventurer is a candidate at all;
                             the account pages' Auto-Party settings, and
                             the Retry and edit rules for each quest

   Browser
     public/js/auto-party.js the live connection, the offer banner with its
                             countdown, the other notices, and the two
                             screen reader live regions
     public/js/main.js       loads auto-party.js for customers and
                             adventurers, and provides confirmDialog, the
                             accessible confirm dialogue every action uses
     public/js/account-adventurer.js  the Availability panel, the
                             opt-in switch, quest types, Current Quest and
                             the catch-up banner
     public/js/account-customer.js    searching, matched and no-match
                             states, Retry, and the catch-up banner
     public/js/post-quest.js the "Use Auto-Party" checkbox and the locked
                             form once an Auto-Party quest is published
     public/js/quests.js and quest-detail.js  the ribbons, and the switched
                             off Accept button while a quest is matched
     public/css/style.css    the notice stack, ribbons and countdown
   ============================================================ */

const { makeTransaction } = require('./rules');

const QUEST_TYPES = ['combat', 'escort', 'retrieval', 'investigation', 'rescue', 'delivery'];
const RANK_VALUE = { bronze: 1, silver: 2, gold: 3 };

const OFFER_WINDOW_SECONDS = 60;
const SWEEP_INTERVAL_MS = 10000;

const idPattern = /^[1-9][0-9]{0,9}$/;


module.exports = function mountAutoPartyRoutes(app, db, guards) {

  const { requireLogin, requireCustomer, requireAdventurer } = guards;
  const transaction = makeTransaction(db);


  /* ==========================================================
     THE CONNECTION REGISTRY
     One entry per logged-in user with at least one tab open, each
     holding every response stream that user currently has (more
     than one if they have the site open in more than one tab).
     ========================================================== */

  const connections = new Map();

  function addConnection(userId, res) {
    if (!connections.has(userId)) {
      connections.set(userId, new Set());
    }

    connections.get(userId).add(res);
  }

  function removeConnection(userId, res) {
    const set = connections.get(userId);

    if (!set) {
      return;
    }

    set.delete(res);

    if (set.size === 0) {
      connections.delete(userId);
    }
  }

  function isConnected(userId) {
    return connections.has(userId);
  }

  /**
   * Pushes one event to every open tab a user has, if any.
   *
   * @param {number} userId who to tell
   * @param {string} event the SSE event name
   * @param {Object} data the payload, sent as JSON
   * @returns {boolean} whether anyone was actually listening
   */
  function push(userId, event, data) {
    const set = connections.get(userId);

    if (!set || set.size === 0) {
      return false;
    }

    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    // A response can fail mid-write if the tab closed a moment ago
    // and the server has not yet been told. That tab is dropped
    // from the set rather than letting one bad connection stop the
    // message reaching the others.
    set.forEach((res) => {
      try {
        res.write(frame);
      } catch (err) {
        set.delete(res);
      }
    });

    return set.size > 0;
  }

  app.get('/api/events', requireLogin, (req, res) => {
    const userId = req.session.user.id;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive',
      // Nginx and similar buffer proxies hold SSE output back
      // unless told not to, which would defeat the whole point.
      'X-Accel-Buffering': 'no'
    });

    // A line starting with a colon is an SSE comment: invisible to
    // the page, but it opens the stream at once instead of leaving
    // the browser to decide when the connection is "really" open.
    res.write(':connected\n\n');
    addConnection(userId, res);

    // A dead connection with nothing being pushed down it can sit
    // unnoticed by both ends for a long time otherwise; many
    // proxies and browsers close an idle connection well before
    // that. A comment every 20 seconds keeps it visibly alive.
    const heartbeat = setInterval(() => {
      try {
        res.write(':heartbeat\n\n');
      } catch (err) {
        clearInterval(heartbeat);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeConnection(userId, res);
    });
  });


  /* ==========================================================
     THE MATCHING QUERY (Step 5, "Matching Logic")

     Four criteria filter the field: opted in, available, wanting
     this quest type, and at or above the quest's recommended rank,
     which Auto-Party treats as a minimum rather than the advisory
     figure it is on the open board. Among who is left, the
     candidate whose rank sits closest to that minimum is offered
     first, so the guild's most capable adventurers are not spent
     on work that does not need them; ties go to whoever has been
     waiting longest, read from available_since.

     Done as one SQL fetch (the preference join already narrows the
     field to people who want this kind of work) followed by a JS
     sort, rather than an ORDER BY expression computing rank
     distance in SQL. At the guild's scale this is the more
     readable choice; Step 6 (Performance) notes that a much larger
     adventurer pool would be the point to move the ordering into
     the query itself.
     ========================================================== */

  const findQuest = db.prepare('SELECT * FROM quests WHERE id = ?');

  const findCandidates = db.prepare(`
    SELECT a.id, a.rank, a.available_since, u.id AS user_id, u.display_name
    FROM adventurer_profiles a
    JOIN adventurer_quest_preferences p ON p.adventurer_id = a.id AND p.quest_type = ?
    JOIN users u ON u.id = a.user_id
    WHERE a.auto_party_opt_in = 1 AND a.availability = 'available'
  `);

  // Continuing an existing cascade excludes anyone already offered
  // this quest, whatever the outcome. A manual retrigger is looser:
  // a decline stays excluded for good, but an expired offer becomes
  // eligible again, exactly as the design document specifies.
  const excludedForContinue = db.prepare('SELECT adventurer_id FROM match_offers WHERE quest_id = ?');
  const excludedForRetrigger = db.prepare(
    "SELECT adventurer_id FROM match_offers WHERE quest_id = ? AND status = 'declined'"
  );

  /**
   * Picks the best candidate for a quest, or null if nobody is
   * eligible.
   *
   * @param {Object} quest a quests row
   * @param {boolean} isRetrigger whether this is a manual retry
   * @returns {Object|null} the chosen candidate row, or null
   */
  function selectCandidate(quest, isRetrigger) {
    const excluded = new Set(
      (isRetrigger ? excludedForRetrigger : excludedForContinue).all(quest.id).map((row) => row.adventurer_id)
    );
    // A quest with no rank set accepts any rank. Publishing requires a
    // rank, so this only guards against an older or hand-made row, which
    // would otherwise compare against undefined and match nobody.
    const minimum = RANK_VALUE[quest.rank_requirement] || RANK_VALUE.bronze;

    const eligible = findCandidates.all(quest.quest_type).filter(
      (candidate) => !excluded.has(candidate.id) && RANK_VALUE[candidate.rank] >= minimum
    );

    eligible.sort((a, b) => {
      const distance = (RANK_VALUE[a.rank] - minimum) - (RANK_VALUE[b.rank] - minimum);

      if (distance !== 0) {
        return distance;
      }

      // available_since is an ISO-style "YYYY-MM-DD HH:MM:SS" string,
      // so it sorts correctly as plain text; no parsing needed.
      return a.available_since < b.available_since ? -1 : a.available_since > b.available_since ? 1 : 0;
    });

    return eligible[0] || null;
  }


  /* ==========================================================
     THE CASCADE (Step 5, "Offer Lifecycle"; Step 4, "Interact")
     ========================================================== */

  const upsertOffer = db.prepare(`
    INSERT INTO match_offers (quest_id, adventurer_id, status, seen, offered_at, responded_at)
    VALUES (?, ?, 'pending', 1, datetime('now'), NULL)
    ON CONFLICT (quest_id, adventurer_id) DO UPDATE SET
      status = 'pending', seen = 1, offered_at = datetime('now'), responded_at = NULL
  `);

  const countOffers = db.prepare('SELECT COUNT(*) AS n FROM match_offers WHERE quest_id = ?');

  const markUnmatched = db.prepare(`
    UPDATE quests SET status = 'unmatched', outcome_seen = ?, updated_at = datetime('now') WHERE id = ?
  `);

  /**
   * Advances one quest's cascade by one step: offers the next
   * eligible candidate, or marks the quest unmatched if nobody is
   * left. Called at every one of the design document's five
   * trigger points (posted, declined, timed out, an offer voided,
   * and manual retrigger), always through this one function, so a
   * fix made once applies everywhere rather than needing to be
   * repeated at each call site.
   *
   * Quietly does nothing for a quest that is not presently an open
   * Auto-Party search, which happens when two trigger points reach
   * a quest close together, such as a decline arriving the same
   * moment the sweep expires it; whichever runs second finds
   * nothing left to advance.
   *
   * @param {number} questId
   * @param {boolean} [isRetrigger] whether this call is the manual retry
   */
  function advanceCascade(questId, isRetrigger) {
    const quest = findQuest.get(questId);

    if (!quest || quest.status !== 'open' || quest.auto_party_enabled !== 1) {
      return;
    }

    const isFirstOffer = countOffers.get(questId).n === 0;
    const candidate = selectCandidate(quest, Boolean(isRetrigger));

    if (!candidate) {
      const delivered = push(quest.posted_by, 'no_match', { questId, title: quest.title });

      markUnmatched.run(delivered ? 1 : 0, questId);
      return;
    }

    upsertOffer.run(questId, candidate.id);
    push(candidate.user_id, 'offer', {
      offerId: db.prepare('SELECT id FROM match_offers WHERE quest_id = ? AND adventurer_id = ?')
        .get(questId, candidate.id).id,
      questId,
      title: quest.title,
      secondsRemaining: OFFER_WINDOW_SECONDS
    });

    // The searching notice is shown once, with the first offer,
    // never repeated as the cascade works through further
    // candidates (Step 4). Declines mid-cascade stay invisible to
    // the customer.
    if (isFirstOffer) {
      push(quest.posted_by, 'searching', { questId, title: quest.title });
    }
  }


  /* ==========================================================
     ACCEPT AND DECLINE
     ========================================================== */

  const findMyProfile = db.prepare('SELECT id FROM adventurer_profiles WHERE user_id = ?');

  const findOwnOffer = db.prepare(`
    SELECT m.*, q.title, q.posted_by
    FROM match_offers m JOIN quests q ON q.id = m.quest_id
    WHERE m.id = ? AND m.adventurer_id = ?
  `);

  const acceptOffer = db.prepare(`
    UPDATE match_offers SET status = 'accepted', responded_at = datetime('now')
    WHERE id = ? AND status = 'pending'
  `);

  const matchQuest = db.prepare(`
    UPDATE quests SET status = 'matched', accepted_by = ?, accepted_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ? AND status = 'open'
  `);

  const occupyAdventurer = db.prepare(`
    UPDATE adventurer_profiles SET availability = 'on_quest' WHERE id = ? AND availability = 'available'
  `);

  app.post('/api/offers/:id/accept', requireAdventurer, (req, res, next) => {
    if (!idPattern.test(req.params.id)) {
      return res.status(404).json({ error: 'Offer not found.' });
    }

    const me = findMyProfile.get(req.session.user.id);
    const offer = me && findOwnOffer.get(Number(req.params.id), me.id);

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found.' });
    }

    if (offer.status !== 'pending') {
      return res.status(409).json({
        error: offer.status === 'accepted'
          ? 'You have already accepted this offer.'
          : 'This offer is no longer available.'
      });
    }

    // The deadline is enforced exactly here, to the second, and
    // again by the sweep below; the countdown shown in the browser
    // is only ever an estimate of this moment (Step 5).
    const deadline = new Date(offer.offered_at.replace(' ', 'T') + 'Z').getTime() + OFFER_WINDOW_SECONDS * 1000;

    if (Date.now() > deadline) {
      return res.status(409).json({ error: 'This offer has expired.' });
    }

    let accepted;

    try {
      accepted = transaction(() => {
        if (acceptOffer.run(offer.id).changes !== 1) {
          return false;
        }

        if (matchQuest.run(offer.adventurer_id, offer.quest_id).changes !== 1) {
          throw new Error('quest no longer open');
        }

        if (occupyAdventurer.run(offer.adventurer_id).changes !== 1) {
          throw new Error('adventurer no longer available');
        }

        return true;
      });
    } catch (err) {
      return next(err);
    }

    if (!accepted) {
      return res.status(409).json({ error: 'This offer is no longer available.' });
    }

    // Accepting this offer is itself a route into on_quest, so any
    // other offer the same adventurer was separately holding is
    // voided here too, exactly as a manual board or hire accept
    // does (Step 5, "State Changes").
    voidOtherPendingOffers(offer.adventurer_id, offer.quest_id);

    // The adventurer gets their own confirmation because acceptance
    // just went through a database transaction: this message means
    // the match was actually saved, not only that the click was
    // received (Step 4).
    push(req.session.user.id, 'matched', { questId: offer.quest_id, title: offer.title });
    // The match reveal is the adventurer's name and rank and nothing
    // else, the same limit the guild applies everywhere (Step 6, "Data
    // Management, Privacy, and Security").
    push(offer.posted_by, 'matched', {
      questId: offer.quest_id,
      title: offer.title,
      adventurer: req.session.user.displayName,
      rank: db.prepare('SELECT rank FROM adventurer_profiles WHERE id = ?').get(offer.adventurer_id).rank
    });

    res.json({ offer: { id: offer.id, quest: { id: offer.quest_id, status: 'matched' } } });
  });

  const declineOffer = db.prepare(`
    UPDATE match_offers SET status = 'declined', responded_at = datetime('now'), seen = 1
    WHERE id = ? AND status = 'pending'
  `);

  app.post('/api/offers/:id/decline', requireAdventurer, (req, res, next) => {
    if (!idPattern.test(req.params.id)) {
      return res.status(404).json({ error: 'Offer not found.' });
    }

    const me = findMyProfile.get(req.session.user.id);
    const offer = me && findOwnOffer.get(Number(req.params.id), me.id);

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found.' });
    }

    if (offer.status !== 'pending') {
      return res.status(409).json({ error: 'This offer has already been answered.' });
    }

    try {
      if (declineOffer.run(offer.id).changes !== 1) {
        return res.status(409).json({ error: 'This offer has already been answered.' });
      }

      // The customer is not told about a decline (Step 4); only the
      // adventurer gets a receipt, for their own record.
      push(req.session.user.id, 'decline_receipt', { questId: offer.quest_id, title: offer.title });
      advanceCascade(offer.quest_id, false);
    } catch (err) {
      return next(err);
    }

    res.json({ offer: { id: offer.id, status: 'declined' } });
  });


  /* ==========================================================
     RETRIGGER
     ========================================================== */

  const findOwnQuestForRetrigger = db.prepare('SELECT id, title, status FROM quests WHERE id = ? AND posted_by = ?');
  const reopenQuest = db.prepare("UPDATE quests SET status = 'open', updated_at = datetime('now') WHERE id = ?");

  app.post('/api/quests/:id/retrigger', requireCustomer, (req, res, next) => {
    if (!idPattern.test(req.params.id)) {
      return res.status(404).json({ error: 'Quest not found.' });
    }

    const quest = findOwnQuestForRetrigger.get(Number(req.params.id), req.session.user.id);

    if (!quest) {
      return res.status(404).json({ error: 'Quest not found.' });
    }

    if (quest.status !== 'unmatched') {
      return res.status(409).json({
        error: 'This quest is not an exhausted Auto-Party search, so there is nothing to retry.'
      });
    }

    try {
      reopenQuest.run(quest.id);
      advanceCascade(quest.id, true);
    } catch (err) {
      return next(err);
    }

    res.json({ quest: { id: quest.id, status: findQuest.get(quest.id).status } });
  });


  /* ==========================================================
     RECONNECT SNAPSHOT (Step 5, "On reconnect")
     ========================================================== */

  const findPendingForAdventurer = db.prepare(`
    SELECT m.id, m.quest_id, m.offered_at, q.title
    FROM match_offers m JOIN quests q ON q.id = m.quest_id
    WHERE m.adventurer_id = ? AND m.status = 'pending'
  `);

  const findSearchingForCustomer = db.prepare(`
    SELECT id, title FROM quests
    WHERE posted_by = ? AND status = 'open' AND auto_party_enabled = 1
      AND EXISTS (SELECT 1 FROM match_offers WHERE quest_id = quests.id)
  `);

  app.get('/api/match-offers/current', requireLogin, (req, res) => {
    const user = req.session.user;

    res.set('Cache-Control', 'no-store');

    if (user.role === 'adventurer') {
      const me = findMyProfile.get(user.id);

      // Two cascades can reach the same adventurer before they answer
      // either, so every pending offer is returned, not only the first.
      const pendingOffers = (me ? findPendingForAdventurer.all(me.id) : []).map((offer) => {
        const deadline = new Date(offer.offered_at.replace(' ', 'T') + 'Z').getTime()
          + OFFER_WINDOW_SECONDS * 1000;

        return {
          offerId: offer.id,
          questId: offer.quest_id,
          title: offer.title,
          secondsRemaining: Math.max(0, Math.round((deadline - Date.now()) / 1000))
        };
      });

      return res.json({
        role: 'adventurer',
        pendingOffer: pendingOffers[0] || null,
        pendingOffers
      });
    }

    if (user.role === 'customer') {
      return res.json({
        role: 'customer',
        searching: findSearchingForCustomer.all(user.id).map((row) => ({ id: row.id, title: row.title }))
      });
    }

    res.json({ role: user.role });
  });


  /* ==========================================================
     THE ADVENTURER'S OPT-IN AND PREFERENCES
     ========================================================== */

  const findProfileByUser = db.prepare('SELECT id, auto_party_opt_in FROM adventurer_profiles WHERE user_id = ?');
  const findPreferences = db.prepare('SELECT quest_type FROM adventurer_quest_preferences WHERE adventurer_id = ?');
  // The waiting time restarts only when Auto-Party goes from off to
  // on. Changing which quest types are wanted while it is on does not
  // send the adventurer to the back of the queue.
  const setOptIn = db.prepare(`
    UPDATE adventurer_profiles
    SET available_since = CASE WHEN auto_party_opt_in = 0 AND ? = 1 THEN datetime('now') ELSE available_since END,
        auto_party_opt_in = ?
    WHERE id = ?
  `);
  const clearPreferences = db.prepare('DELETE FROM adventurer_quest_preferences WHERE adventurer_id = ?');
  const insertPreference = db.prepare('INSERT INTO adventurer_quest_preferences (adventurer_id, quest_type) VALUES (?, ?)');

  app.patch('/api/my/auto-party', requireAdventurer, (req, res, next) => {
    const input = req.body ?? {};
    const errors = {};

    if (typeof input.optIn !== 'boolean') {
      errors.optIn = 'Say whether Auto-Party should be switched on.';
    }

    const types = Array.isArray(input.questTypes) ? input.questTypes : [];
    const unknown = types.filter((type) => !QUEST_TYPES.includes(type));

    if (!Array.isArray(input.questTypes)) {
      errors.questTypes = 'Send a list of quest types.';
    } else if (unknown.length > 0) {
      errors.questTypes = 'Unknown quest type: ' + unknown[0] + '.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Please correct the highlighted fields.', fields: errors });
    }

    const me = findProfileByUser.get(req.session.user.id);

    try {
      transaction(() => {
        // available_since is refreshed when Auto-Party is switched
        // on, since it marks how long this adventurer has been
        // waiting in the matching pool, not merely whether they are
        // free right now (Step 5, "Matching Logic").
        setOptIn.run(input.optIn ? 1 : 0, input.optIn ? 1 : 0, me.id);
        clearPreferences.run(me.id);
        Array.from(new Set(types)).forEach((type) => insertPreference.run(me.id, type));
      });
    } catch (err) {
      return next(err);
    }

    res.json({
      autoParty: { optIn: input.optIn, questTypes: findPreferences.all(me.id).map((row) => row.quest_type) }
    });
  });


  /* ==========================================================
     CATCH-UP (Step 4, "Interact"; Figures 3 and 7)

     Live notices only reach a browser that is connected. What happened
     while the user was away is found here instead, at their next visit
     to My Account: for an adventurer, offers that expired and quests
     cancelled from under them; for a customer, searches that ran out
     and cancellations they did not make, and (Housekeeping 2) hires
     an adventurer declined. Only outcomes not already seen live are
     listed.

     Reading the list does not change it. The page marks the items it
     showed with a separate POST, naming them, so an outcome arriving
     between the two requests is not marked seen without being shown.
     ========================================================== */

  const findAdventurerCatchUp = db.prepare(`
    SELECT m.id, m.status AS offer_status, q.id AS quest_id, q.title, q.status AS quest_status
    FROM match_offers m JOIN quests q ON q.id = m.quest_id
    WHERE m.adventurer_id = ? AND m.seen = 0
    ORDER BY COALESCE(m.responded_at, m.offered_at) DESC
  `);

  // A declined hire (Housekeeping 2) is a draft with hire_declined_by
  // set, and is owed to the customer the same way.
  const findCustomerCatchUp = db.prepare(`
    SELECT q.id, q.title, q.status, du.display_name AS declined_by
    FROM quests q
    LEFT JOIN adventurer_profiles da ON da.id = q.hire_declined_by
    LEFT JOIN users du ON du.id = da.user_id
    WHERE q.posted_by = ? AND q.outcome_seen = 0
      AND (q.status IN ('unmatched', 'cancelled')
        OR (q.status = 'draft' AND q.hire_declined_by IS NOT NULL))
    ORDER BY q.updated_at DESC
  `);

  app.get('/api/catch-up', requireLogin, (req, res) => {
    const user = req.session.user;
    const items = [];

    res.set('Cache-Control', 'no-store');

    if (user.role === 'adventurer') {
      const me = findMyProfile.get(user.id);

      findAdventurerCatchUp.all(me.id).forEach((row) => {
        items.push({
          kind: 'offer',
          id: row.id,
          questId: row.quest_id,
          title: row.title,
          event: row.quest_status === 'cancelled' ? 'cancelled' : 'expired'
        });
      });
    } else if (user.role === 'customer') {
      findCustomerCatchUp.all(user.id).forEach((row) => {
        items.push({
          kind: 'quest',
          id: row.id,
          questId: row.id,
          title: row.title,
          event: row.status === 'unmatched' ? 'no_match'
            : row.status === 'draft' ? 'hire_declined' : 'cancelled',
          adventurer: row.declined_by || undefined
        });
      });
    }

    res.json({ items });
  });

  app.post('/api/catch-up/seen', requireLogin, (req, res, next) => {
    const user = req.session.user;
    const input = req.body ?? {};
    const ids = (list) => (Array.isArray(list) ? list : [])
      .filter((value) => Number.isInteger(value) && value > 0)
      .slice(0, 200);

    try {
      if (user.role === 'adventurer') {
        const me = findMyProfile.get(user.id);
        const mark = db.prepare('UPDATE match_offers SET seen = 1 WHERE id = ? AND adventurer_id = ?');
        ids(input.offers).forEach((id) => mark.run(id, me.id));
      } else if (user.role === 'customer') {
        const mark = db.prepare('UPDATE quests SET outcome_seen = 1 WHERE id = ? AND posted_by = ?');
        ids(input.quests).forEach((id) => mark.run(id, user.id));
      }
    } catch (err) {
      return next(err);
    }

    res.json({ ok: true });
  });


  /* ==========================================================
     THE LAUNCH BANNER (Step 4, "Discover"; Figures 1 and 4)
     Shown once, where the feature is switched on: the adventurer's
     account page, and the customer's Post a Quest page. Closing it
     records that here, so it never comes back on any device.
     ========================================================== */

  app.post('/api/me/auto-party-banner', requireLogin, (req, res, next) => {
    try {
      db.prepare('UPDATE users SET auto_party_banner_dismissed = 1 WHERE id = ?').run(req.session.user.id);
    } catch (err) {
      return next(err);
    }

    req.session.user.autoPartyBannerDismissed = true;
    res.json({ ok: true });
  });


  /* ==========================================================
     HOOKS FOR OTHER ROUTE FILES
     ========================================================== */

  /**
   * Tells everyone a cancellation affects, whoever cancelled and
   * whatever state the quest was in (Step 5, "State Changes"). Called
   * by both cancel routes, the customer's and the guild's, after the
   * quest has been marked cancelled.
   *
   * - An adventurer holding a pending offer on it has the offer voided
   *   and is told the quest is no longer available.
   * - An adventurer who had accepted it is told the same. Their
   *   release back to the board is done by the cancel route itself, in
   *   its own transaction.
   * - The customer who posted it is told it has been cancelled.
   *
   * No notice says who cancelled (Step 6). Each outcome is marked seen
   * straight away when the person caused it themselves or was
   * connected to receive it live, and otherwise left unseen for the
   * catch-up banner at their next login.
   *
   * @param {number} questId the quest just cancelled
   * @param {number} cancelledBy the user id of whoever cancelled it
   */
  function onQuestCancelled(questId, cancelledBy) {
    const quest = db.prepare('SELECT id, title, posted_by, accepted_by FROM quests WHERE id = ?').get(questId);

    if (!quest) {
      return;
    }

    const pending = db.prepare(`
      SELECT m.id, u.id AS user_id
      FROM match_offers m
      JOIN adventurer_profiles a ON a.id = m.adventurer_id
      JOIN users u ON u.id = a.user_id
      WHERE m.quest_id = ? AND m.status = 'pending'
    `).get(questId);

    if (pending) {
      const delivered = push(pending.user_id, 'quest_unavailable', { questId, title: quest.title });

      db.prepare(`
        UPDATE match_offers SET status = 'voided', responded_at = datetime('now'), seen = ? WHERE id = ?
      `).run(delivered ? 1 : 0, pending.id);
    }

    if (quest.accepted_by !== null) {
      const holder = db.prepare('SELECT user_id FROM adventurer_profiles WHERE id = ?').get(quest.accepted_by);
      const delivered = push(holder.user_id, 'quest_unavailable', { questId, title: quest.title });

      // If the match came through Auto-Party, its accepted offer row is
      // kept as history, and a new outcome on it resets its seen flag.
      db.prepare(`
        UPDATE match_offers SET seen = ? WHERE quest_id = ? AND adventurer_id = ? AND status = 'accepted'
      `).run(delivered ? 1 : 0, questId, quest.accepted_by);
    }

    const posterDelivered = push(quest.posted_by, 'quest_cancelled', { questId, title: quest.title });
    const posterSaw = cancelledBy === quest.posted_by || posterDelivered;

    db.prepare('UPDATE quests SET outcome_seen = ? WHERE id = ?').run(posterSaw ? 1 : 0, questId);
  }

  /**
   * Voids every OTHER pending offer an adventurer is holding, and
   * advances each of those quests to the next candidate. Called
   * after an adventurer is committed to a quest by any route other
   * than accepting the offer itself (a direct hire or a manual
   * board accept), so the same person cannot end up matched to one
   * quest while still holding a live offer on another.
   *
   * More than one pending offer can genuinely exist for the same
   * adventurer at once: nothing stops two different cascades
   * reaching them before either is answered, since holding an
   * offer does not change availability the way accepting one does.
   * This function, run the moment they are committed anywhere, is
   * what actually closes that gap, not a database constraint (see
   * the note in create.js on match_offers for why an earlier
   * constraint attempting the same thing was removed).
   *
   * @param {number} adventurerId
   * @param {number} justAcceptedQuestId the quest not to touch
   */
  function voidOtherPendingOffers(adventurerId, justAcceptedQuestId) {
    const rows = db.prepare(
      "SELECT id, quest_id FROM match_offers WHERE adventurer_id = ? AND status = 'pending' AND quest_id <> ?"
    ).all(adventurerId, justAcceptedQuestId);

    rows.forEach((row) => {
      // This is the adventurer's own doing, indirectly, so there is
      // nothing to catch up on later.
      db.prepare(
        "UPDATE match_offers SET status = 'voided', responded_at = datetime('now'), seen = 1 WHERE id = ?"
      ).run(row.id);
      advanceCascade(row.quest_id, false);
    });
  }

  /**
   * Runs every SWEEP_INTERVAL_MS: finds every offer past its
   * 60-second deadline, expires it, and advances that quest's
   * cascade. Exact to the second is not the sweep's job; that is
   * enforced when an accept arrives. The sweep's job is only to
   * make sure the next candidate is not kept waiting (Step 5,
   * "Offer Lifecycle").
   */
  function sweepExpiredOffers() {
    const stale = db.prepare(`
      SELECT m.id, m.quest_id, u.id AS user_id, q.title
      FROM match_offers m
      JOIN quests q ON q.id = m.quest_id
      JOIN adventurer_profiles a ON a.id = m.adventurer_id
      JOIN users u ON u.id = a.user_id
      WHERE m.status = 'pending' AND m.offered_at <= datetime('now', '-' || ? || ' seconds')
    `).all(OFFER_WINDOW_SECONDS);

    stale.forEach((offer) => {
      // Nothing is pushed for an expiry: the adventurer's own browser
      // counted the offer down and has already told them (Step 5). The
      // server only needs to know whether they were connected to see
      // it, which decides whether it is owed to them at catch-up.
      const delivered = isConnected(offer.user_id);

      db.prepare(
        "UPDATE match_offers SET status = 'expired', responded_at = datetime('now'), seen = ? WHERE id = ?"
      ).run(delivered ? 1 : 0, offer.id);

      advanceCascade(offer.quest_id, false);
    });
  }

  return { advanceCascade, onQuestCancelled, voidOtherPendingOffers, sweepExpiredOffers, isConnected, push };

};
