/* ============================================================
   Oceania Adventure Guild - account route
   SIT774 Website Project, Part 3 (Task 10.2D),
   extended for Auto-Party (Task 10.3HD)

   Four routes, for a customer or an adventurer (the notices route
   answers an administrator too):

     GET   /api/my/account       the logged in member's own profile and
                                 everything of theirs that goes with it
     PATCH /api/my/profile       Edit profile: name, phone and biography,
                                 and an adventurer's specialty
     PATCH /api/my/availability  an adventurer's availability, which
                                 Auto-Party reads
     GET   /api/my/notices       what is waiting for this member, for the
                                 envelope on the header's My account
                                 button (all three Housekeeping 2,
                                 Task 10.3HD)

   Used from server.js as:  require('./routes/account')(app, db, guards);

   For a customer: their posted quests and their orders. For an
   adventurer: their profile, their gear, the quests they hold or have
   finished, and any quest they have been hired for. An administrator
   has no account of this kind, and is refused.

   Everything is looked up by the id held in the session, never by an
   id sent in the request, so there is nothing a member could change
   in the address to see someone else's account.
   ============================================================ */

const resolveImage = require('./images')();
const { progressOf, makeTransaction } = require('./rules');


module.exports = function mountAccountRoutes(app, db, guards) {

  const { requireLogin } = guards;
  const transaction = makeTransaction(db);


  /* ==========================================================
     CUSTOMERS
     ========================================================== */

  const findProfile = db.prepare(`
    SELECT display_name, phone, bio, profile_image, substr(created_at, 1, 4) AS member_since
    FROM users
    WHERE id = ?
  `);

  /* A quest may name an adventurer in two ways, and they mean different
     things: one who was hired (the quest is addressed to them), and one
     who has accepted it. Both are shown by name, which is public on the
     register anyway. */
  const findQuests = db.prepare(`
    SELECT q.id, q.title, q.status, q.quest_type, q.location, q.reward, q.updated_at,
           q.adventurer_marked_done, q.poster_confirmed, q.auto_party_enabled,
           hu.display_name AS hired_name, au.display_name AS accepted_name, aa.rank AS accepted_rank,
           du.display_name AS declined_name
    FROM quests q
    LEFT JOIN adventurer_profiles ha ON ha.id = q.targeted_adventurer_id
    LEFT JOIN users hu ON hu.id = ha.user_id
    LEFT JOIN adventurer_profiles da ON da.id = q.hire_declined_by
    LEFT JOIN users du ON du.id = da.user_id
    LEFT JOIN adventurer_profiles aa ON aa.id = q.accepted_by
    LEFT JOIN users au ON au.id = aa.user_id
    WHERE q.posted_by = ?
    ORDER BY q.updated_at DESC, q.id DESC
  `);

  const findOrders = db.prepare(`
    SELECT id, payment_method, total, status, created_at
    FROM orders
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
  `);

  const findLines = db.prepare(`
    SELECT i.name, oi.quantity
    FROM order_items oi JOIN items i ON i.id = oi.item_id
    WHERE oi.order_id = ?
    ORDER BY oi.id
  `);

  /* What the customer may do with each quest, decided here so the page
     does not have to know the lifecycle. A draft or an open quest can
     be edited. A draft is deleted, and an open, unmatched or accepted
     quest is cancelled, though not once the adventurer has said the
     work is done. Once it is done, the customer confirms it. */
  function customerActions(quest) {
    const status = quest.status;
    const done = quest.adventurer_marked_done === 1;
    const autoParty = quest.auto_party_enabled === 1;

    return {
      progress: progressOf(quest, false),
      // A published Auto-Party quest is searched for on the terms it
      // was published with, so only its draft can be edited.
      canEdit: status === 'draft' || (status === 'open' && !autoParty),
      canConfirm: status === 'matched' && done && quest.poster_confirmed === 0,
      // An exhausted search can be run again, from here or from the
      // no-match banner (Figure 6).
      canRetrigger: status === 'unmatched' && autoParty,
      autoParty: autoParty,
      searching: status === 'open' && autoParty,
      removeAction: status === 'draft' ? 'delete'
        : (status === 'open' || status === 'unmatched' || (status === 'matched' && !done)) ? 'cancel'
          : null
    };
  }

  function customerAccount(userId) {
    const profile = findProfile.get(userId);

    return {
      role: 'customer',
      profile: {
        name: profile.display_name,
        phone: profile.phone || '',
        memberSince: profile.member_since,
        bio: profile.bio || '',
        image: resolveImage(profile.profile_image, '/images/portrait-default.svg')
      },
      quests: findQuests.all(userId).map((quest) => Object.assign({
        id: quest.id,
        title: quest.title,
        status: quest.status,
        type: quest.quest_type,
        location: quest.location,
        reward: quest.reward,
        updatedAt: String(quest.updated_at).slice(0, 10),
        hiring: quest.hired_name,
        // Set when a hired adventurer declined and the quest came back
        // as a draft (Housekeeping 2).
        declinedBy: quest.declined_name,
        adventurer: quest.accepted_name,
        adventurerRank: quest.accepted_rank
      }, customerActions(quest))),
      orders: findOrders.all(userId).map((order) => ({
        id: order.id,
        placedAt: String(order.created_at).slice(0, 10),
        total: order.total,
        status: order.status,
        paymentMethod: order.payment_method,
        lines: findLines.all(order.id)
      }))
    };
  }


  /* ==========================================================
     ADVENTURERS
     ========================================================== */

  const findAdventurer = db.prepare(`
    SELECT a.id, a.class, a.rank, a.specialty, a.availability, a.unavailable_until, a.auto_party_opt_in,
           COALESCE(a.member_since, substr(u.created_at, 1, 4)) AS member_since,
           u.display_name, u.phone, u.bio, u.profile_image
    FROM adventurer_profiles a JOIN users u ON u.id = a.user_id
    WHERE u.id = ?
  `);

  const findGear = db.prepare(`
    SELECT g.equipped, i.name, i.image
    FROM adventurer_gear g JOIN items i ON i.id = g.item_id
    WHERE g.adventurer_id = ?
    ORDER BY g.equipped DESC, g.id
  `);

  // Quests this adventurer holds come first, then the finished ones.
  const findHeld = db.prepare(`
    SELECT q.id, q.title, q.status, q.location, q.reward, q.updated_at, q.completed_at,
           q.adventurer_marked_done, q.poster_confirmed,
           pu.display_name AS poster_name, pu.role AS poster_role
    FROM quests q JOIN users pu ON pu.id = q.posted_by
    WHERE q.accepted_by = ?
    ORDER BY (q.status = 'matched') DESC, q.updated_at DESC, q.id DESC
  `);

  // A hire is a quest addressed to this adventurer alone, still waiting
  // for an answer.
  const findHires = db.prepare(`
    SELECT q.id, q.title, q.location, q.reward, q.rank_requirement, q.created_at,
           pu.display_name AS poster_name
    FROM quests q JOIN users pu ON pu.id = q.posted_by
    WHERE q.targeted_adventurer_id = ? AND q.status = 'open'
    ORDER BY q.created_at DESC, q.id DESC
  `);

  const findPreferences = db.prepare(
    'SELECT quest_type FROM adventurer_quest_preferences WHERE adventurer_id = ? ORDER BY quest_type'
  );

  function adventurerAccount(userId) {
    const me = findAdventurer.get(userId);

    if (!me) {
      return null;
    }

    const gear = findGear.all(me.id).map((row) => ({
      name: row.name,
      image: resolveImage(row.image, '/images/item-default.svg'),
      equipped: row.equipped === 1
    }));

    return {
      role: 'adventurer',
      profile: {
        name: me.display_name,
        phone: me.phone || '',
        memberSince: me.member_since,
        bio: me.bio || '',
        image: resolveImage(me.profile_image, '/images/adventurer-default-' + me.class.toLowerCase() + '.svg'),
        class: me.class,
        rank: me.rank,
        specialty: me.specialty || '',
        availability: me.availability,
        unavailableUntil: me.unavailable_until
      },
      gear: {
        equipped: gear.filter((item) => item.equipped),
        inventory: gear.filter((item) => !item.equipped)
      },
      // The account-level Auto-Party setting (Figure 2).
      autoParty: {
        optIn: me.auto_party_opt_in === 1,
        questTypes: findPreferences.all(me.id).map((row) => row.quest_type)
      },
      quests: findHeld.all(me.id).map((quest) => ({
        id: quest.id,
        title: quest.title,
        status: quest.status,
        location: quest.location,
        reward: quest.reward,
        postedBy: quest.poster_name,
        official: quest.poster_role === 'admin',
        progress: progressOf(quest, quest.poster_role === 'admin'),
        canMarkDone: quest.status === 'matched' && quest.adventurer_marked_done === 0,
        finishedAt: quest.completed_at ? String(quest.completed_at).slice(0, 10) : null
      })),
      hires: findHires.all(me.id).map((quest) => ({
        id: quest.id,
        title: quest.title,
        location: quest.location,
        reward: quest.reward,
        rank: quest.rank_requirement,
        postedBy: quest.poster_name,
        postedAt: String(quest.created_at).slice(0, 10),
        canAccept: me.availability !== 'on_quest'
      }))
    };
  }


  /* ==========================================================
     THE ROUTE
     ========================================================== */

  app.get('/api/my/account', requireLogin, (req, res) => {
    const user = req.session.user;
    let account = null;

    res.set('Cache-Control', 'no-store');

    if (user.role === 'customer') {
      account = customerAccount(user.id);
    } else if (user.role === 'adventurer') {
      account = adventurerAccount(user.id);
    } else {
      return res.status(403).json({
        error: 'Administrators have no member account. The administration page is theirs.'
      });
    }

    if (!account) {
      return res.status(404).json({ error: 'No account was found.' });
    }

    res.json(account);
  });


  /* ==========================================================
     EDIT PROFILE (Housekeeping 2, Task 10.3HD)

     A member changes their own name, phone and biography, and an
     adventurer their specialty too. Availability has its own route
     below, because it changes far more often than a profile does
     and it is what Auto-Party reads.
     ========================================================== */

  // The same limits and patterns as registration in server.js.
  const MAX_NAME_LENGTH = 80;
  const PHONE_PATTERN = /^[0-9]{8,15}$/;
  const MAX_BIO_LENGTH = 600;
  const MAX_SPECIALTY_LENGTH = 60;
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  const updateUser = db.prepare(
    'UPDATE users SET display_name = ?, phone = ?, bio = ? WHERE id = ?'
  );
  const updateSpecialty = db.prepare(
    'UPDATE adventurer_profiles SET specialty = ? WHERE id = ?'
  );

  const text = (value) => (typeof value === 'string' ? value.trim() : '');

  /**
   * Checks an Edit profile body. Every value is type checked, since a
   * request can be sent without the form.
   *
   * @param {Object} body the request body
   * @param {boolean} adventurer whether the member is an adventurer
   * @returns {{errors: Object, values: Object}}
   */
  function validateProfile(body, adventurer) {
    const input = body ?? {};
    const errors = {};

    const values = {
      name: text(input.name),
      phone: typeof input.phone === 'string' ? input.phone.replace(/\s/g, '') : '',
      bio: text(input.bio),
      specialty: text(input.specialty)
    };

    if (values.name === '') {
      errors.name = 'Enter your name.';
    } else if (values.name.length > MAX_NAME_LENGTH) {
      errors.name = `Keep your name to ${MAX_NAME_LENGTH} characters or fewer.`;
    }

    if (!PHONE_PATTERN.test(values.phone)) {
      errors.phone = 'Enter between 8 and 15 digits.';
    }

    if (values.bio.length > MAX_BIO_LENGTH) {
      errors.bio = `Keep your biography to ${MAX_BIO_LENGTH} characters or fewer.`;
    }

    if (adventurer && values.specialty.length > MAX_SPECIALTY_LENGTH) {
      errors.specialty = `Keep your specialty to ${MAX_SPECIALTY_LENGTH} characters or fewer.`;
    }

    return { errors, values };
  }

  app.patch('/api/my/profile', requireLogin, (req, res, next) => {
    const user = req.session.user;

    res.set('Cache-Control', 'no-store');

    if (user.role !== 'customer' && user.role !== 'adventurer') {
      return res.status(403).json({
        error: 'Administrators have no member profile to edit.'
      });
    }

    const adventurer = user.role === 'adventurer';
    const { errors, values } = validateProfile(req.body, adventurer);

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Please correct the highlighted fields.', fields: errors });
    }

    const me = adventurer ? findAdventurer.get(user.id) : null;

    if (adventurer && !me) {
      return res.status(404).json({ error: 'No account was found.' });
    }

    // The account row and the adventurer row are saved together or not at all.
    try {
      transaction(() => {
        updateUser.run(values.name, values.phone, values.bio || null, user.id);

        if (adventurer) {
          updateSpecialty.run(values.specialty || null, me.id);
        }
      });
    } catch (err) {
      return next(err);
    }

    // The session carries the display name for the header; the next
    // request would refresh it anyway, but this one should be right.
    user.displayName = values.name;

    res.json(adventurer ? adventurerAccount(user.id) : customerAccount(user.id));
  });


  /* ==========================================================
     AVAILABILITY (Housekeeping 2, Task 10.3HD)

     Auto-Party only offers quests to adventurers who are
     'available', so an adventurer going away sets themselves
     'unavailable', optionally with the date they are back. The
     server returns them to 'available' on that date (see the
     availability sweep in server.js).

     'on_quest' is never chosen here. The site sets it when a quest
     is accepted and clears it when the quest ends, so while it
     holds, availability cannot be changed.
     ========================================================== */

  /* Going back to available restarts the Auto-Party waiting time,
     the same as being released from a quest (rules.js), because
     time spent away is not time spent waiting for work. Staying
     available leaves it alone. */
  const setAvailable = db.prepare(`
    UPDATE adventurer_profiles
    SET available_since = CASE WHEN availability = 'available' THEN available_since ELSE datetime('now') END,
        availability = 'available', unavailable_until = NULL
    WHERE id = ? AND availability <> 'on_quest'
  `);
  const setUnavailable = db.prepare(`
    UPDATE adventurer_profiles
    SET availability = 'unavailable', unavailable_until = ?
    WHERE id = ? AND availability <> 'on_quest'
  `);

  // An Auto-Party offer still inside its 60 seconds.
  const findLiveOffer = db.prepare(`
    SELECT 1 FROM match_offers
    WHERE adventurer_id = ? AND status = 'pending'
      AND offered_at > datetime('now', '-60 seconds')
  `);

  // The local calendar date, for comparing against a return date.
  const findToday = db.prepare(
    "SELECT date('now', 'localtime') AS today, date('now', 'localtime', '+1 year') AS limit_day"
  );

  /**
   * Checks an availability body.
   *
   * @param {Object} body the request body
   * @returns {{errors: Object, values: {availability: string, until: string}}}
   */
  function validateAvailability(body) {
    const input = body ?? {};
    const errors = {};
    const values = { availability: input.availability, until: text(input.unavailableUntil) };

    if (values.availability !== 'available' && values.availability !== 'unavailable') {
      errors.availability = 'Choose available or unavailable.';
      return { errors, values };
    }

    if (values.availability === 'available') {
      values.until = '';
      return { errors, values };
    }

    if (values.until !== '') {
      const { today, limit_day: limitDay } = findToday.get();
      const parsed = new Date(values.until + 'T00:00:00Z');

      // The pattern alone would accept 2026-02-31, so the date is
      // also read back to check it is the same day it claims to be.
      if (!DATE_PATTERN.test(values.until) || Number.isNaN(parsed.getTime())
          || parsed.toISOString().slice(0, 10) !== values.until) {
        errors.unavailableUntil = 'Enter a real date.';
      } else if (values.until <= today) {
        errors.unavailableUntil = 'Choose a date after today.';
      } else if (values.until > limitDay) {
        errors.unavailableUntil = 'Choose a date within the next year.';
      }
    }

    return { errors, values };
  }

  app.patch('/api/my/availability', requireLogin, (req, res, next) => {
    const user = req.session.user;

    res.set('Cache-Control', 'no-store');

    if (user.role !== 'adventurer') {
      return res.status(403).json({ error: 'Only an adventurer has availability to set.' });
    }

    const { errors, values } = validateAvailability(req.body);

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Please correct the highlighted fields.', fields: errors });
    }

    const me = findAdventurer.get(user.id);

    if (!me) {
      return res.status(404).json({ error: 'No account was found.' });
    }

    if (me.availability === 'on_quest') {
      return res.status(409).json({
        error: 'You are on a quest, so your availability cannot be changed until it is finished.'
      });
    }

    /* An Auto-Party offer is waiting for this adventurer's answer.
       Going unavailable underneath it would leave the offer showing
       for a quest they can no longer be matched to, so they answer
       it first. It lasts a minute at most. */
    if (values.availability === 'unavailable' && findLiveOffer.get(me.id)) {
      return res.status(409).json({
        error: 'You have an Auto-Party offer waiting. Accept or decline it first, then set yourself unavailable.'
      });
    }

    try {
      const changed = values.availability === 'available'
        ? setAvailable.run(me.id).changes
        : setUnavailable.run(values.until || null, me.id).changes;

      // The WHERE refuses an adventurer who went on a quest between
      // the check above and this write.
      if (changed !== 1) {
        return res.status(409).json({
          error: 'You are on a quest, so your availability cannot be changed until it is finished.'
        });
      }
    } catch (err) {
      return next(err);
    }

    res.json(adventurerAccount(user.id));
  });


  /* ==========================================================
     NOTICES (Housekeeping 2.1c, Task 10.3HD)

     A count of what is waiting for this member, drawn as an envelope
     with a number on the header's My account button, on every page.
     Only things that need the member's attention or have not been
     seen yet are counted, so the number goes down as they deal with
     them:

       adventurer     Auto-Party offers waiting for an answer, hire
                      requests waiting for an answer, and outcomes
                      they missed while away (expired offers, quests
                      cancelled from under them)
       customer       quests waiting for them to confirm the work,
                      declined hires and searches that found nobody
                      (each waits for them to post it again, retry or
                      cancel), and cancellations they missed
       administrator  new enquiries, and quests waiting for the guild
                      to verify

     A declined hire or an exhausted search is counted until the
     customer deals with it, even if they saw the live notice at the
     time, because the quest sits waiting on them either way. A
     cancellation needs nothing from them, so it is counted only until
     it has been seen, by the same test the catch-up banner uses.
     ========================================================== */

  const countOffers = db.prepare(`
    SELECT COUNT(*) AS n FROM match_offers
    WHERE adventurer_id = ? AND status = 'pending' AND offered_at > datetime('now', '-60 seconds')
  `);
  const countHires = db.prepare(
    "SELECT COUNT(*) AS n FROM quests WHERE targeted_adventurer_id = ? AND status = 'open'"
  );
  const countMissedOffers = db.prepare(
    'SELECT COUNT(*) AS n FROM match_offers WHERE adventurer_id = ? AND seen = 0'
  );
  const countToConfirm = db.prepare(`
    SELECT COUNT(*) AS n FROM quests
    WHERE posted_by = ? AND status = 'matched' AND adventurer_marked_done = 1 AND poster_confirmed = 0
  `);
  const countDeclinedHires = db.prepare(
    "SELECT COUNT(*) AS n FROM quests WHERE posted_by = ? AND status = 'draft' AND hire_declined_by IS NOT NULL"
  );
  const countNoMatch = db.prepare(
    "SELECT COUNT(*) AS n FROM quests WHERE posted_by = ? AND status = 'unmatched'"
  );
  const countMissedCancellations = db.prepare(
    "SELECT COUNT(*) AS n FROM quests WHERE posted_by = ? AND status = 'cancelled' AND outcome_seen = 0"
  );
  const countNewEnquiries = db.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE status = 'new'");
  // A customer's quest is verified once they have confirmed it; the
  // guild's own quest has no customer, so it is ready once marked done.
  const countToVerify = db.prepare(`
    SELECT COUNT(*) AS n FROM quests q JOIN users pu ON pu.id = q.posted_by
    WHERE q.status = 'matched' AND q.adventurer_marked_done = 1 AND q.admin_verified = 0
      AND (q.poster_confirmed = 1 OR pu.role = 'admin')
  `);

  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  app.get('/api/my/notices', requireLogin, (req, res) => {
    const user = req.session.user;
    const parts = [];

    res.set('Cache-Control', 'no-store');

    if (user.role === 'adventurer') {
      const me = findAdventurer.get(user.id);

      if (me) {
        parts.push(plural(countOffers.get(me.id).n, 'Auto-Party offer', 'Auto-Party offers'));
        parts.push(plural(countHires.get(me.id).n, 'hire request', 'hire requests'));
        parts.push(plural(countMissedOffers.get(me.id).n, 'missed update', 'missed updates'));
      }
    } else if (user.role === 'customer') {
      parts.push(plural(countToConfirm.get(user.id).n, 'quest to confirm', 'quests to confirm'));
      parts.push(plural(countDeclinedHires.get(user.id).n, 'declined hire', 'declined hires'));
      parts.push(plural(countNoMatch.get(user.id).n, 'search with no match', 'searches with no match'));
      parts.push(plural(countMissedCancellations.get(user.id).n, 'missed cancellation', 'missed cancellations'));
    } else if (user.role === 'admin') {
      parts.push(plural(countNewEnquiries.get().n, 'new enquiry', 'new enquiries'));
      parts.push(plural(countToVerify.get().n, 'quest to verify', 'quests to verify'));
    }

    const waiting = parts.filter((part) => !part.startsWith('0 '));
    const count = waiting.reduce((sum, part) => sum + Number(part.split(' ')[0]), 0);

    res.json({ count, items: waiting });
  });

};
