/* ============================================================
   Oceania Adventure Guild - quest write routes
   SIT774 Website Project, Part 3 (Task 10.2D)

   Three routes, all for a customer account, and all acting only on
   the customer's own quests:

     POST   /api/quests       write a new quest, as a draft or published
     PUT    /api/quests/:id   change a quest, and publish or unpublish it
     DELETE /api/quests/:id   remove a draft, or cancel a published quest

   Used from server.js as:  require('./routes/quests-write')(app, db, guards);

   Only customers post quests, so only customers reach these routes.
   The guard is what keeps an adventurer or an administrator out, and
   the database backs it up: a quest addressed to one adventurer is
   refused by a trigger unless a customer posted it.

   The browser checks the form first, and this repeats every check,
   because a request can be sent without using the form.
   ============================================================ */

const { makeRelease, makeTransaction } = require('./rules');

const QUEST_TYPES = ['combat', 'escort', 'retrieval', 'investigation', 'rescue', 'delivery'];
const RANKS = ['bronze', 'silver', 'gold'];
const DURATIONS = ['hours', 'day', 'few-days', 'week', 'week-plus'];
const INTENTS = ['publish', 'draft'];

const MAX_TITLE_LENGTH = 80;
const MIN_DESCRIPTION_LENGTH = 30;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_OBJECTIVES_LENGTH = 1000;
const MAX_LOCATION_LENGTH = 80;
const MAX_REWARD_LENGTH = 80;


module.exports = function mountQuestWriteRoutes(app, db, guards) {

  const { requireCustomer } = guards;
  const release = makeRelease(db);
  const transaction = makeTransaction(db);


  /* ==========================================================
     CHECKING A QUEST
     ========================================================== */

  const findAdventurer = db.prepare(`
    SELECT a.id
    FROM adventurer_profiles a JOIN users u ON u.id = a.user_id
    WHERE a.id = ? AND u.is_active = 1
  `);

  /**
   * Checks a quest body and returns the cleaned values along with any
   * problems, keyed by field name so the page can show each message
   * beside its field.
   *
   * There are two bars. A draft is unfinished by definition, so it
   * needs only a title, and whatever else is filled in is checked for
   * shape but is allowed to be missing. A quest that is being
   * published goes in front of the whole guild, so every field is
   * required.
   *
   * @param {Object} body the parsed JSON body
   * @param {boolean} allowHire whether a hire may be named, which is
   *   only when the quest is first written
   */
  function checkQuest(body, allowHire) {
    const input = body ?? {};
    const errors = {};

    const intent = input.intent;
    if (!INTENTS.includes(intent)) {
      errors.intent = 'Say whether to publish the quest or save it as a draft.';
    }
    const publishing = intent === 'publish';

    // Anything that arrives as something other than text is refused
    // rather than quietly turned into text.
    const text = (name) => {
      const raw = input[name];
      if (raw === undefined || raw === null) {
        return '';
      }
      if (typeof raw !== 'string') {
        errors[name] = 'Send text.';
        return '';
      }
      return raw.trim();
    };

    const title = text('title');
    if (title === '') {
      errors.title = 'Give the quest a title.';
    } else if (title.length > MAX_TITLE_LENGTH) {
      errors.title = 'Keep the title to ' + MAX_TITLE_LENGTH + ' characters or fewer.';
    }

    const description = text('description');
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      errors.description = 'Keep the description to ' + MAX_DESCRIPTION_LENGTH + ' characters or fewer.';
    } else if (publishing && description === '') {
      errors.description = 'Describe the quest.';
    } else if (publishing && description.length < MIN_DESCRIPTION_LENGTH) {
      errors.description = 'Tell adventurers a little more, at least ' + MIN_DESCRIPTION_LENGTH + ' characters.';
    }

    // One objective to a line. Blank lines are dropped, so stray
    // newlines never count as objectives.
    const objectives = text('objectives').split('\n').map((line) => line.trim()).filter(Boolean).join('\n');
    if (objectives.length > MAX_OBJECTIVES_LENGTH) {
      errors.objectives = 'Keep the objectives to ' + MAX_OBJECTIVES_LENGTH + ' characters or fewer.';
    } else if (publishing && objectives === '') {
      errors.objectives = 'List at least one objective.';
    }

    const type = text('type');
    if (type !== '' && !QUEST_TYPES.includes(type)) {
      errors.type = 'Unknown quest type.';
    } else if (publishing && type === '') {
      errors.type = 'Choose a quest type.';
    }

    const location = text('location');
    if (location.length > MAX_LOCATION_LENGTH) {
      errors.location = 'Keep the location to ' + MAX_LOCATION_LENGTH + ' characters or fewer.';
    } else if (publishing && location === '') {
      errors.location = 'Say where the quest takes place.';
    }

    const rank = text('rank');
    if (rank !== '' && !RANKS.includes(rank)) {
      errors.rank = 'Unknown rank.';
    } else if (publishing && rank === '') {
      errors.rank = 'Choose a recommended rank.';
    }

    const duration = text('duration');
    if (duration !== '' && !DURATIONS.includes(duration)) {
      errors.duration = 'Unknown duration.';
    } else if (publishing && duration === '') {
      errors.duration = 'Choose an expected duration.';
    }

    const reward = text('reward');
    if (reward.length > MAX_REWARD_LENGTH) {
      errors.reward = 'Keep the reward to ' + MAX_REWARD_LENGTH + ' characters or fewer.';
    } else if (publishing && reward === '') {
      errors.reward = 'State what you are offering.';
    }

    // Auto-Party is the next feature to be built. Until the search
    // that runs it exists, a quest flagged for it would sit on the
    // board with nobody able to take it, so it is refused.
    if (input.autoParty === true) {
      errors.autoParty = 'Auto-Party is not switched on yet.';
    }

    let hireId = null;
    if (allowHire && input.hireId !== undefined && input.hireId !== null) {
      const id = Number(input.hireId);

      if (!Number.isInteger(id) || id < 1 || !findAdventurer.get(id)) {
        errors.hireId = 'That adventurer is not on the register.';
      } else {
        hireId = id;
      }
    }

    return {
      errors,
      values: {
        intent, title, description, objectives, type, location, rank, duration, reward, hireId,
        status: publishing ? 'open' : 'draft'
      }
    };
  }

  const blankToNull = (value) => (value === '' ? null : value);

  const refuse = (res, errors) => res.status(400).json({
    error: 'Please correct the highlighted fields.',
    fields: errors
  });


  /* ==========================================================
     WRITING A NEW QUEST
     ========================================================== */

  const insertQuest = db.prepare(`
    INSERT INTO quests
      (title, description, objectives, quest_type, location, reward, rank_requirement,
       expected_duration, status, posted_by, targeted_adventurer_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  app.post('/api/quests', requireCustomer, (req, res, next) => {
    const { errors, values } = checkQuest(req.body, true);

    if (Object.keys(errors).length > 0) {
      return refuse(res, errors);
    }

    let result;

    try {
      result = insertQuest.run(
        values.title, values.description, blankToNull(values.objectives),
        blankToNull(values.type), values.location, values.reward,
        blankToNull(values.rank), blankToNull(values.duration),
        values.status, req.session.user.id, values.hireId
      );
    } catch (err) {
      return next(err);
    }

    res.status(201).json({
      quest: { id: Number(result.lastInsertRowid), status: values.status, hiring: values.hireId !== null }
    });
  });


  /* ==========================================================
     CHANGING A QUEST
     ========================================================== */

  // Only the poster's own quest is found. Someone else's quest, and
  // one that does not exist, both come back as "not found", so the
  // route cannot be used to find out which quests exist.
  const findOwnQuest = db.prepare(
    'SELECT id, status, accepted_by, adventurer_marked_done FROM quests WHERE id = ? AND posted_by = ?'
  );

  const updateQuest = db.prepare(`
    UPDATE quests
    SET title = ?, description = ?, objectives = ?, quest_type = ?, location = ?, reward = ?,
        rank_requirement = ?, expected_duration = ?, status = ?, updated_at = datetime('now')
    WHERE id = ? AND posted_by = ? AND status IN ('draft', 'open')
  `);

  const idPattern = /^[1-9][0-9]{0,9}$/;

  const cannotChange = (status) => (status === 'matched'
    ? 'An adventurer has accepted this quest, so it can no longer be changed.'
    : 'This quest is finished, so it can no longer be changed.');

  app.put('/api/quests/:id', requireCustomer, (req, res, next) => {
    if (!idPattern.test(req.params.id)) {
      return res.status(404).json({ error: 'Quest not found.' });
    }

    const own = findOwnQuest.get(Number(req.params.id), req.session.user.id);

    if (!own) {
      return res.status(404).json({ error: 'Quest not found.' });
    }

    if (own.status !== 'draft' && own.status !== 'open') {
      return res.status(409).json({ error: cannotChange(own.status) });
    }

    // Who is being hired is fixed when the quest is first written, so
    // a hire named here is ignored.
    const { errors, values } = checkQuest(req.body, false);

    if (Object.keys(errors).length > 0) {
      return refuse(res, errors);
    }

    let result;

    try {
      result = updateQuest.run(
        values.title, values.description, blankToNull(values.objectives),
        blankToNull(values.type), values.location, values.reward,
        blankToNull(values.rank), blankToNull(values.duration),
        values.status, own.id, req.session.user.id
      );
    } catch (err) {
      return next(err);
    }

    /* The statement itself only touches a draft or open quest. If it
       changed nothing, the quest was accepted between the check above
       and this write, and the customer is told so instead of being
       told their change was saved. */
    if (result.changes === 0) {
      return res.status(409).json({ error: cannotChange('matched') });
    }

    res.json({ quest: { id: own.id, status: values.status } });
  });


  /* ==========================================================
     REMOVING A QUEST
     One address, two operations. A draft nobody has seen is deleted
     outright. A quest that has been on the board is cancelled
     instead, so its record stays, and the two are the same button
     on the page.

     The customer may also cancel a quest an adventurer has accepted,
     until the adventurer says the work is done. Cancelling hands the
     adventurer back to the board. After that the work has been done,
     so the customer confirms it or the guild deals with it.
     ========================================================== */

  const deleteDraft = db.prepare("DELETE FROM quests WHERE id = ? AND posted_by = ? AND status = 'draft'");

  const cancelQuest = db.prepare(`
    UPDATE quests SET status = 'cancelled', updated_at = datetime('now')
    WHERE id = ? AND posted_by = ? AND status IN ('open', 'unmatched')
  `);

  const cancelAccepted = db.prepare(`
    UPDATE quests SET status = 'cancelled', updated_at = datetime('now')
    WHERE id = ? AND posted_by = ? AND status = 'matched' AND adventurer_marked_done = 0
  `);

  app.delete('/api/quests/:id', requireCustomer, (req, res, next) => {
    if (!idPattern.test(req.params.id)) {
      return res.status(404).json({ error: 'Quest not found.' });
    }

    const own = findOwnQuest.get(Number(req.params.id), req.session.user.id);

    if (!own) {
      return res.status(404).json({ error: 'Quest not found.' });
    }

    let result;

    try {
      if (own.status === 'draft') {
        result = deleteDraft.run(own.id, req.session.user.id);
        return result.changes === 1
          ? res.json({ result: 'deleted' })
          : res.status(409).json({ error: 'That quest has changed, so it was not deleted.' });
      }

      if (own.status === 'open' || own.status === 'unmatched') {
        result = cancelQuest.run(own.id, req.session.user.id);
        return result.changes === 1
          ? res.json({ result: 'cancelled' })
          : res.status(409).json({ error: 'That quest has changed, so it was not cancelled.' });
      }

      if (own.status === 'matched' && own.adventurer_marked_done === 0) {
        const cancelled = transaction(() => {
          if (cancelAccepted.run(own.id, req.session.user.id).changes !== 1) {
            return false;
          }

          release(own.accepted_by, own.id);
          return true;
        });

        return cancelled
          ? res.json({ result: 'cancelled' })
          : res.status(409).json({ error: 'That quest has changed, so it was not cancelled.' });
      }
    } catch (err) {
      return next(err);
    }

    res.status(409).json({
      error: own.status === 'matched'
        ? 'The adventurer has marked this quest as done, so it can no longer be cancelled here. '
          + 'Confirm it, or contact the guild.'
        : 'This quest is already finished.'
    });
  });

};
