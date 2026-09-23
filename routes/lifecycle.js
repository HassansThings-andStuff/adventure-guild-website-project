/* ============================================================
   Oceania Adventure Guild - accepting a quest and finishing it
   SIT774 Website Project, Part 3 (Task 10.2D)

   The routes that move a quest from open to finished:

     POST /api/quests/:id/accept            an adventurer takes it
     POST /api/quests/:id/done              the adventurer says it is done
     POST /api/quests/:id/confirm           the customer who posted it agrees
     GET  /api/admin/quests/matched         the guild's list of quests under way
     POST /api/admin/quests/:id/verify      the guild signs it off
     POST /api/admin/quests/:id/cancel      the guild cancels any unfinished quest

   Used from server.js as:  require('./routes/lifecycle')(app, db, guards);

   The completion chain has three sign-offs, in order: the adventurer
   marks the work done, the customer confirms it, and the guild
   verifies it. Only the last makes the quest completed. A quest the
   guild posted itself has no customer to confirm, so the guild's one
   Verify does both jobs.

   The double-booking rule: an adventurer on a quest cannot accept
   another, and nothing overrides that. Accepting does override
   "unavailable", because taking work is the clearest sign someone is
   available. The adventurer goes back on the board when the quest
   ends, by being completed or cancelled.

   Every write states the condition it depends on in its own WHERE,
   and the route checks how many rows changed. A quest that has moved
   on since the page was drawn is refused with a message, and never
   overwritten.
   ============================================================ */

const { progressOf, makeRelease, makeTransaction } = require('./rules');

const idPattern = /^[1-9][0-9]{0,9}$/;


module.exports = function mountLifecycleRoutes(app, db, guards) {

  const { requireAdventurer, requireCustomer, requireAdmin } = guards;
  const release = makeRelease(db);
  const transaction = makeTransaction(db);


  /* ==========================================================
     LOOKING THINGS UP
     ========================================================== */

  const findProfile = db.prepare('SELECT id, availability FROM adventurer_profiles WHERE user_id = ?');

  const findQuest = db.prepare(`
    SELECT q.*, pu.role AS poster_role
    FROM quests q JOIN users pu ON pu.id = q.posted_by
    WHERE q.id = ?
  `);

  /**
   * Finds a quest from the id in the address, or null. An id that is
   * not a plain positive whole number is treated as no quest at all.
   */
  function lookup(text) {
    return idPattern.test(text) ? (findQuest.get(Number(text)) || null) : null;
  }

  const notFound = (res) => res.status(404).json({ error: 'Quest not found.' });


  /* ==========================================================
     ACCEPTING A QUEST
     ========================================================== */

  /* The quest and the adventurer are written together. The quest is
     taken only if it is still open, is not offered through Auto-Party,
     and is either for anyone or addressed to this very adventurer. The
     adventurer is put on the quest only if they were not already on
     one. */
  const takeQuest = db.prepare(`
    UPDATE quests
    SET status = 'matched', accepted_by = ?, accepted_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ? AND status = 'open' AND accepted_by IS NULL AND auto_party_enabled = 0
      AND (targeted_adventurer_id IS NULL OR targeted_adventurer_id = ?)
  `);

  const occupy = db.prepare(`
    UPDATE adventurer_profiles
    SET availability = 'on_quest', unavailable_until = NULL
    WHERE id = ? AND availability <> 'on_quest'
  `);

  app.post('/api/quests/:id/accept', requireAdventurer, (req, res, next) => {
    const quest = lookup(req.params.id);
    const me = findProfile.get(req.session.user.id);

    if (!quest || !me) {
      return notFound(res);
    }

    // A quest the adventurer could not see is "not found" to them, as
    // it is on the quest board. A hired quest belongs to the one hired,
    // and a finished or private one to whoever held it.
    const visible = (quest.status === 'open' || quest.status === 'matched')
      ? (quest.targeted_adventurer_id === null || quest.targeted_adventurer_id === me.id)
      : quest.accepted_by === me.id;

    if (!visible) {
      return notFound(res);
    }

    if (quest.status === 'matched') {
      return res.status(409).json({
        error: quest.accepted_by === me.id
          ? 'You have already accepted this quest.'
          : 'Another adventurer has already taken this quest.'
      });
    }

    if (quest.status !== 'open') {
      return res.status(409).json({ error: 'This quest is no longer open.' });
    }

    if (quest.auto_party_enabled === 1) {
      return res.status(409).json({
        error: 'This quest is offered through Auto-Party, so it cannot be accepted from the board.'
      });
    }

    if (me.availability === 'on_quest') {
      return res.status(409).json({
        error: 'You are already on a quest, so you cannot take another until it is finished.'
      });
    }

    try {
      const taken = transaction(() => {
        if (takeQuest.run(me.id, quest.id, me.id).changes !== 1) {
          return false;
        }

        if (occupy.run(me.id).changes !== 1) {
          // Undo the quest as well. Throwing rolls the transaction back.
          throw new Error('adventurer already on a quest');
        }

        return true;
      });

      if (!taken) {
        return res.status(409).json({ error: 'That quest was taken a moment ago.' });
      }
    } catch (err) {
      if (err.message === 'adventurer already on a quest') {
        return res.status(409).json({
          error: 'You are already on a quest, so you cannot take another until it is finished.'
        });
      }

      return next(err);
    }

    res.json({ quest: { id: quest.id, status: 'matched' } });
  });


  /* ==========================================================
     THE ADVENTURER SAYS IT IS DONE
     ========================================================== */

  const markDone = db.prepare(`
    UPDATE quests SET adventurer_marked_done = 1, updated_at = datetime('now')
    WHERE id = ? AND accepted_by = ? AND status = 'matched' AND adventurer_marked_done = 0
  `);

  app.post('/api/quests/:id/done', requireAdventurer, (req, res, next) => {
    const quest = lookup(req.params.id);
    const me = findProfile.get(req.session.user.id);

    // Only the adventurer who holds the quest can say it is done. To
    // everyone else it is "not found".
    if (!quest || !me || quest.accepted_by !== me.id) {
      return notFound(res);
    }

    if (quest.status !== 'matched') {
      return res.status(409).json({ error: 'This quest is finished, so it cannot be marked as done.' });
    }

    if (quest.adventurer_marked_done === 1) {
      return res.status(409).json({ error: 'You have already marked this quest as done.' });
    }

    let result;

    try {
      result = markDone.run(quest.id, me.id);
    } catch (err) {
      return next(err);
    }

    if (result.changes !== 1) {
      return res.status(409).json({ error: 'That quest has changed, so it was not marked as done.' });
    }

    res.json({ quest: { id: quest.id, progress: progressOf(
      Object.assign({}, quest, { adventurer_marked_done: 1 }), quest.poster_role === 'admin') } });
  });


  /* ==========================================================
     THE CUSTOMER CONFIRMS
     ========================================================== */

  const confirmDone = db.prepare(`
    UPDATE quests SET poster_confirmed = 1, updated_at = datetime('now')
    WHERE id = ? AND posted_by = ? AND status = 'matched'
      AND adventurer_marked_done = 1 AND poster_confirmed = 0
  `);

  app.post('/api/quests/:id/confirm', requireCustomer, (req, res, next) => {
    const quest = lookup(req.params.id);

    if (!quest || quest.posted_by !== req.session.user.id) {
      return notFound(res);
    }

    if (quest.status !== 'matched') {
      return res.status(409).json({ error: 'This quest is not in progress.' });
    }

    if (quest.adventurer_marked_done !== 1) {
      return res.status(409).json({ error: 'The adventurer has not marked this quest as done yet.' });
    }

    if (quest.poster_confirmed === 1) {
      return res.status(409).json({ error: 'You have already confirmed this quest.' });
    }

    let result;

    try {
      result = confirmDone.run(quest.id, req.session.user.id);
    } catch (err) {
      return next(err);
    }

    if (result.changes !== 1) {
      return res.status(409).json({ error: 'That quest has changed, so it was not confirmed.' });
    }

    res.json({ quest: { id: quest.id, progress: 'awaiting_verification' } });
  });


  /* ==========================================================
     THE GUILD
     ========================================================== */

  const listMatched = db.prepare(`
    SELECT q.id, q.title, q.status, q.adventurer_marked_done, q.poster_confirmed, q.updated_at,
           pu.display_name AS poster_name, pu.role AS poster_role, au.display_name AS adventurer_name
    FROM quests q
    JOIN users pu ON pu.id = q.posted_by
    LEFT JOIN adventurer_profiles a ON a.id = q.accepted_by
    LEFT JOIN users au ON au.id = a.user_id
    WHERE q.status = 'matched'
    ORDER BY q.adventurer_marked_done DESC, q.updated_at, q.id
  `);

  app.get('/api/admin/quests/matched', requireAdmin, (req, res) => {
    res.set('Cache-Control', 'no-store');

    res.json({
      quests: listMatched.all().map((quest) => {
        const official = quest.poster_role === 'admin';
        const progress = progressOf(quest, official);

        return {
          id: quest.id,
          title: quest.title,
          poster: quest.poster_name,
          official: official,
          adventurer: quest.adventurer_name,
          progress: progress,
          canVerify: progress === 'awaiting_verification'
        };
      })
    });
  });

  // Verifying finishes the quest. The one Verify on a quest the guild
  // posted itself records the customer's confirmation too, since there
  // is no customer.
  const finishQuest = db.prepare(`
    UPDATE quests
    SET poster_confirmed = 1, admin_verified = 1, status = 'completed',
        completed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ? AND status = 'matched' AND adventurer_marked_done = 1 AND admin_verified = 0
      AND (poster_confirmed = 1 OR ? = 1)
  `);

  app.post('/api/admin/quests/:id/verify', requireAdmin, (req, res, next) => {
    const quest = lookup(req.params.id);

    if (!quest || quest.status === 'draft') {
      return notFound(res);
    }

    const official = quest.poster_role === 'admin';

    if (quest.status !== 'matched') {
      return res.status(409).json({ error: 'This quest is not in progress, so there is nothing to verify.' });
    }

    if (quest.adventurer_marked_done !== 1) {
      return res.status(409).json({ error: 'The adventurer has not marked this quest as done yet.' });
    }

    if (quest.poster_confirmed !== 1 && !official) {
      return res.status(409).json({ error: 'The customer has not confirmed completion yet.' });
    }

    try {
      const finished = transaction(() => {
        if (finishQuest.run(quest.id, official ? 1 : 0).changes !== 1) {
          return false;
        }

        release(quest.accepted_by, quest.id);
        return true;
      });

      if (!finished) {
        return res.status(409).json({ error: 'That quest has changed, so it was not verified.' });
      }
    } catch (err) {
      return next(err);
    }

    res.json({ quest: { id: quest.id, status: 'completed' } });
  });

  // The guild may cancel any quest that is not yet finished. A private
  // draft is not the guild's to see, so it is "not found".
  const cancelAny = db.prepare(`
    UPDATE quests SET status = 'cancelled', updated_at = datetime('now')
    WHERE id = ? AND status IN ('open', 'unmatched', 'matched')
  `);

  app.post('/api/admin/quests/:id/cancel', requireAdmin, (req, res, next) => {
    const quest = lookup(req.params.id);

    if (!quest || quest.status === 'draft') {
      return notFound(res);
    }

    if (quest.status === 'completed' || quest.status === 'cancelled') {
      return res.status(409).json({ error: 'This quest is already finished.' });
    }

    try {
      const cancelled = transaction(() => {
        if (cancelAny.run(quest.id).changes !== 1) {
          return false;
        }

        if (quest.accepted_by !== null) {
          release(quest.accepted_by, quest.id);
        }

        return true;
      });

      if (!cancelled) {
        return res.status(409).json({ error: 'That quest has changed, so it was not cancelled.' });
      }
    } catch (err) {
      return next(err);
    }

    res.json({ quest: { id: quest.id, status: 'cancelled' } });
  });

};
