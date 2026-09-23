/* ============================================================
   Oceania Adventure Guild - account route
   SIT774 Website Project, Part 3 (Task 10.2D)

   One route, for a customer or an adventurer:

     GET /api/my/account   the logged in member's own profile and
                           everything of theirs that goes with it

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
const { progressOf } = require('./rules');


module.exports = function mountAccountRoutes(app, db, guards) {

  const { requireLogin } = guards;


  /* ==========================================================
     CUSTOMERS
     ========================================================== */

  const findProfile = db.prepare(`
    SELECT display_name, bio, profile_image, substr(created_at, 1, 4) AS member_since
    FROM users
    WHERE id = ?
  `);

  /* A quest may name an adventurer in two ways, and they mean different
     things: one who was hired (the quest is addressed to them), and one
     who has accepted it. Both are shown by name, which is public on the
     register anyway. */
  const findQuests = db.prepare(`
    SELECT q.id, q.title, q.status, q.quest_type, q.location, q.reward, q.updated_at,
           q.adventurer_marked_done, q.poster_confirmed,
           hu.display_name AS hired_name, au.display_name AS accepted_name
    FROM quests q
    LEFT JOIN adventurer_profiles ha ON ha.id = q.targeted_adventurer_id
    LEFT JOIN users hu ON hu.id = ha.user_id
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

    return {
      progress: progressOf(quest, false),
      canEdit: status === 'draft' || status === 'open',
      canConfirm: status === 'matched' && done && quest.poster_confirmed === 0,
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
        adventurer: quest.accepted_name
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
    SELECT a.id, a.class, a.rank, a.specialty, a.availability, a.unavailable_until,
           COALESCE(a.member_since, substr(u.created_at, 1, 4)) AS member_since,
           u.display_name, u.bio, u.profile_image
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

};
