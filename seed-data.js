/* ============================================================
   Oceania Adventure Guild - seed content
   SIT774 Website Project, Part 3 (Task 10.2D)

   Every piece of sample content the site ships with, held apart
   from seed.js so that growing the content never touches
   working code.

   Content notes:

   - The nine quests, five adventurers, nine shop items and six
     news entries built in Part 2 are all preserved with their
     original wording. Everything after them is new, added so
     that filters, sorting and pagination have enough data to
     act on, and so Auto-Party has a real candidate pool rather
     than five people.

   - Distribution is deliberate. Quests spread across all six
     types, all three ranks plus unranked, ten locations and
     every status, weighted towards 'open' because that is the
     board's default view. Adventurers spread across five
     classes and all three ranks.

   - Dates sit between February and September 2026, matching the
     range established in Part 2 so the guild reads as an active
     business rather than a snapshot.

   - image fields name files under images/. Entries carried over
     from Part 2 point at files that already exist; new entries
     follow the same naming convention and need artwork adding,
     or will fall back to their alt text.
   ============================================================ */

// One password for every seeded account. Sample data for local
// development only; a real system would never hold credentials
// in source.
const DEMO_PASSWORD = 'guild1234';


/* ============================================================
   USERS
   The guild's own account is listed first. Official quests are
   posted by it, which is what gives them the seal badge and the
   brandy treatment, so no separate flag is needed.
   ============================================================ */

const ADMINS = [
  {
    email: 'guildmaster@oceaniaguild.com',
    display_name: 'The Guild',
    phone: '0355501234',
    bio: 'The Oceania Adventure Guild, chartered at Port Aldwin.',
    profile_image: 'images/guild-emblem.png'
  },
  {
    email: 'clerk@oceaniaguild.com',
    display_name: 'Wren Alderly',
    phone: '0355501235',
    bio: 'Keeps the register at Port Aldwin and answers the enquiry desk.',
    profile_image: 'images/staff-wren.jpg'
  }
];

const CUSTOMERS = [
  {
    email: 'bobby@greenhollowmill.com',
    display_name: 'Bobby Dale',
    phone: '0412000001',
    bio: 'Runs the mill at Greenhollow. Mostly posts short work close to home, '
       + 'and has been known to pay in flour when the season is lean.',
    profile_image: 'images/customer-1.jpg'
  },
  {
    email: 'marda@portaldwin.com',
    display_name: 'Marda Pell',
    phone: '0412000002',
    bio: 'Baker on the Port Aldwin waterfront. Opens at four, complains about it daily.',
    profile_image: 'images/customer-2.jpg'
  },
  {
    email: 'tobias.reeve@duskwater.com',
    display_name: 'Tobias Reeve',
    phone: '0412000003',
    bio: 'Duskwater harbourmaster. Posts what the tide turns up.',
    profile_image: 'images/customer-3.jpg'
  },
  {
    email: 'sella.crow@thornmoor.com',
    display_name: 'Sella Crow',
    phone: '0412000004',
    bio: 'Runs a caravan line inland. Needs escorts more often than she would like.',
    profile_image: 'images/customer-4.jpg'
  },
  {
    email: 'harl.mowbray@ironhollow.com',
    display_name: 'Harl Mowbray',
    phone: '0412000005',
    bio: 'Smith at Ironhollow. Buys ore, sells trouble.',
    profile_image: 'images/customer-5.jpg'
  },
  {
    email: 'anwen.fisk@saltmarsh.com',
    display_name: 'Anwen Fisk',
    phone: '0412000006',
    bio: 'Keeps bees and grievances out on the Saltmarsh road.',
    profile_image: 'images/customer-6.jpg'
  },
  {
    email: 'j.lantry@hollowmere.com',
    display_name: 'Jorem Lantry',
    phone: '0412000007',
    bio: 'Surveyor for the Hollowmere holdings. Precise about everything.',
    profile_image: 'images/customer-7.jpg'
  },
  {
    email: 'petra.vane@blackfen.com',
    display_name: 'Petra Vane',
    phone: '0412000008',
    bio: 'Apothecary at Blackfen. Pays in remedies as often as in coin.',
    profile_image: 'images/customer-8.jpg'
  }
];


/* ============================================================
   ADVENTURERS
   Each becomes a users row and an adventurer_profiles row, so
   every adventurer can log in, accept a quest, and be offered
   one by Auto-Party.

   Rank spread: 7 bronze, 8 silver, 5 gold. Deliberately
   bottom-heavy, so that rank filters narrow meaningfully and
   Auto-Party's rank-proximity ranking has real choices to make
   at the lower tiers where most quests sit.
   ============================================================ */

const ADVENTURERS = [
  {
    email: 'kazuma.sato@oceaniaguild.com',
    display_name: 'Kazuma Sato',
    phone: '0413000001',
    class: 'Wizard',
    rank: 'silver',
    specialty: 'Fire magic',
    willing_to_travel: 'Port Aldwin',
    availability: 'on_quest',  // holds a matched quest below
    auto_party_opt_in: 1,
    member_since: '2025',
    bio: 'Kazuma joined the guild at nineteen after a brief and unsuccessful career '
       + 'as a merchant\'s clerk. He specialises in fire magic, which he is quick to '
       + 'point out is far more precise than its reputation suggests, and has a '
       + 'steady record on retrieval and investigation work.',
    profile_image: 'images/adventurer-kazuma.jpg'
  },
  {
    email: 'elara.thornwood@oceaniaguild.com',
    display_name: 'Elara Thornwood',
    phone: '0413000002',
    class: 'Ranger',
    rank: 'gold',
    specialty: 'Tracking and scouting',
    willing_to_travel: 'Anywhere',
    availability: 'available',
    auto_party_opt_in: 1,
    member_since: '2021',
    bio: 'Twelve years on the northern roads and a reputation for finding people who '
       + 'did not want finding. Prefers to work alone but will take a party if the '
       + 'ground is bad.',
    profile_image: 'images/adventurer-elara.jpg'
  },
  {
    email: 'dorin.stonebeard@oceaniaguild.com',
    display_name: 'Dorin Stonebeard',
    phone: '0413000003',
    class: 'Fighter',
    rank: 'gold',
    specialty: 'Close quarters',
    willing_to_travel: 'Ironhollow and inland',
    availability: 'on_quest',
    auto_party_opt_in: 0,
    member_since: '2019',
    bio: 'Came up through the Ironhollow forges and still talks like it. Has never '
       + 'once been first through a door, and says that is why he is still here.',
    profile_image: 'images/adventurer-dorin.jpg'
  },
  {
    email: 'bram.ottersby@oceaniaguild.com',
    display_name: 'Bram Ottersby',
    phone: '0413000004',
    class: 'Fighter',
    rank: 'bronze',
    specialty: 'Close quarters',
    willing_to_travel: 'Port Aldwin and surrounds',
    availability: 'on_quest',  // holds a matched quest below
    auto_party_opt_in: 1,
    member_since: '2026',
    bio: 'Two seasons in and keen enough for four. Takes everything the board offers '
       + 'and writes it all down afterwards.',
    profile_image: 'images/adventurer-bram.jpg'
  },
  {
    email: 'mira.duskrunner@oceaniaguild.com',
    display_name: 'Mira Duskrunner',
    phone: '0413000005',
    class: 'Rogue',
    rank: 'silver',
    specialty: 'Locks and traps',
    willing_to_travel: 'Duskwater and the coast',
    availability: 'unavailable',
    unavailable_until: '2026-09-28',
    auto_party_opt_in: 1,
    member_since: '2024',
    bio: 'Grew up in the Duskwater warrens and knows which floors hold. Charges extra '
       + 'for anything below the waterline, on principle.',
    profile_image: 'images/adventurer-mira.jpg'
  },
  {
    email: 'sister.adela@oceaniaguild.com',
    display_name: 'Sister Adela',
    phone: '0413000006',
    class: 'Cleric',
    rank: 'gold',
    specialty: 'Field healing',
    willing_to_travel: 'Anywhere',
    availability: 'available',
    auto_party_opt_in: 1,
    member_since: '2020',
    bio: 'Attached to the guild rather than to any order. Has patched up most of the '
       + 'gold rank at one time or another and reminds them of it.',
    profile_image: 'images/adventurer-adela.jpg'
  },
  {
    email: 'nell.yarrow@oceaniaguild.com',
    display_name: 'Nell Yarrow',
    phone: '0413000007',
    class: 'Rogue',
    rank: 'silver',
    specialty: 'Locks and traps',
    willing_to_travel: 'Port Aldwin and surrounds',
    availability: 'available',
    auto_party_opt_in: 0,
    member_since: '2023',
    bio: 'Quiet, fast, and entirely uninterested in explaining how any of it was done.',
    profile_image: 'images/adventurer-nell.jpg'
  },
  {
    email: 'garrick.stonewell@oceaniaguild.com',
    display_name: 'Garrick Stonewell',
    phone: '0413000008',
    class: 'Fighter',
    rank: 'silver',
    specialty: 'Shield work',
    willing_to_travel: 'Greenhollow and inland',
    availability: 'available',
    auto_party_opt_in: 1,
    member_since: '2023',
    bio: 'Escort work almost exclusively. Says a caravan that arrives dull is a '
       + 'caravan that arrives.',
    profile_image: 'images/adventurer-garrick.jpg'
  },
  {
    email: 'tamsin.vale@oceaniaguild.com',
    display_name: 'Tamsin Vale',
    phone: '0413000009',
    class: 'Wizard',
    rank: 'bronze',
    specialty: 'Wards and detection',
    willing_to_travel: 'Port Aldwin and surrounds',
    availability: 'available',
    auto_party_opt_in: 1,
    member_since: '2026',
    bio: 'Came to the guild from the Hollowmere survey office and still prefers a '
       + 'problem she can measure.',
    profile_image: 'images/adventurer-tamsin.jpg'
  },
  {
    email: 'orin.blackfen@oceaniaguild.com',
    display_name: 'Orin Blackfen',
    phone: '0413000010',
    class: 'Ranger',
    rank: 'silver',
    specialty: 'Marsh and wetland',
    willing_to_travel: 'Blackfen and the fens',
    availability: 'available',
    auto_party_opt_in: 1,
    member_since: '2024',
    bio: 'Knows the fens well enough to be unimpressed by them. Takes delivery work '
       + 'nobody else will route.',
    profile_image: 'images/adventurer-orin.jpg'
  },
  {
    email: 'iseult.marr@oceaniaguild.com',
    display_name: 'Iseult Marr',
    phone: '0413000011',
    class: 'Cleric',
    rank: 'silver',
    specialty: 'Warding the sick',
    willing_to_travel: 'Anywhere',
    availability: 'available',
    auto_party_opt_in: 1,
    member_since: '2025',
    bio: 'Split her first three years between the Blackfen apothecary and the road, '
       + 'and has kept the habit.',
    profile_image: 'images/adventurer-iseult.jpg'
  },
  {
    email: 'rook.callan@oceaniaguild.com',
    display_name: 'Rook Callan',
    phone: '0413000012',
    class: 'Rogue',
    rank: 'bronze',
    specialty: 'Scouting ahead',
    willing_to_travel: 'Port Aldwin and surrounds',
    availability: 'available',
    auto_party_opt_in: 1,
    member_since: '2026',
    bio: 'Newly registered and taking everything short. Says he is saving for a horse.',
    profile_image: 'images/adventurer-rook.jpg'
  },
  {
    email: 'hedda.lang@oceaniaguild.com',
    display_name: 'Hedda Lang',
    phone: '0413000013',
    class: 'Fighter',
    rank: 'gold',
    specialty: 'Beasts and large game',
    willing_to_travel: 'Anywhere',
    availability: 'available',
    auto_party_opt_in: 0,
    member_since: '2018',
    bio: 'Longest continuous membership on the current roster. Has strong views on '
       + 'what counts as a dragon.',
    profile_image: 'images/adventurer-hedda.jpg'
  },
  {
    email: 'per.solvang@oceaniaguild.com',
    display_name: 'Per Solvang',
    phone: '0413000014',
    class: 'Ranger',
    rank: 'bronze',
    specialty: 'Coastal routes',
    willing_to_travel: 'Cape Serrin and the coast',
    availability: 'available',
    auto_party_opt_in: 1,
    member_since: '2026',
    bio: 'Fisherman for eleven years before the guild. Still reads the weather better '
       + 'than anyone at the hall.',
    profile_image: 'images/adventurer-per.jpg'
  },
  {
    email: 'lys.arden@oceaniaguild.com',
    display_name: 'Lys Arden',
    phone: '0413000015',
    class: 'Wizard',
    rank: 'gold',
    specialty: 'Old languages',
    willing_to_travel: 'Anywhere',
    availability: 'available',
    auto_party_opt_in: 1,
    member_since: '2020',
    bio: 'Called in whenever something is written down and nobody can read it. Has '
       + 'opinions about the Duskwater ledgers.',
    profile_image: 'images/adventurer-lys.jpg'
  },
  {
    email: 'corbin.ash@oceaniaguild.com',
    display_name: 'Corbin Ash',
    phone: '0413000016',
    class: 'Fighter',
    rank: 'bronze',
    specialty: 'Guard duty',
    willing_to_travel: 'Greenhollow and inland',
    availability: 'available',
    auto_party_opt_in: 1,
    member_since: '2026',
    bio: 'Steady on a gate, less certain off one. Working on it.',
    profile_image: 'images/adventurer-corbin.jpg'
  },
  {
    email: 'venna.tor@oceaniaguild.com',
    display_name: 'Venna Tor',
    phone: '0413000017',
    class: 'Rogue',
    rank: 'silver',
    specialty: 'Recovery and appraisal',
    willing_to_travel: 'Anywhere',
    availability: 'available',
    auto_party_opt_in: 1,
    member_since: '2024',
    bio: 'Retrieval work, almost always. Will tell a client what a thing is worth '
       + 'before she is asked.',
    profile_image: 'images/adventurer-venna.jpg'
  },
  {
    email: 'aldous.penn@oceaniaguild.com',
    display_name: 'Aldous Penn',
    phone: '0413000018',
    class: 'Cleric',
    rank: 'bronze',
    specialty: 'Burial rites',
    willing_to_travel: 'Port Aldwin and surrounds',
    availability: 'available',
    auto_party_opt_in: 0,
    member_since: '2025',
    bio: 'Attends the work nobody lists on a poster. The guild keeps him on retainer.',
    profile_image: 'images/adventurer-aldous.jpg'
  },
  {
    email: 'sana.brightwater@oceaniaguild.com',
    display_name: 'Sana Brightwater',
    phone: '0413000019',
    class: 'Ranger',
    rank: 'silver',
    specialty: 'Rivers and crossings',
    willing_to_travel: 'Duskwater and the coast',
    availability: 'on_quest',  // holds a matched quest below
    auto_party_opt_in: 1,
    member_since: '2023',
    bio: 'Grew up on the ferries. Has never lost a package to water and mentions it '
       + 'at every opportunity.',
    profile_image: 'images/adventurer-sana.jpg'
  },
  {
    email: 'fen.morrow@oceaniaguild.com',
    display_name: 'Fen Morrow',
    phone: '0413000020',
    class: 'Wizard',
    rank: 'bronze',
    specialty: 'Light and illusion',
    willing_to_travel: 'Anywhere',
    availability: 'available',
    auto_party_opt_in: 1,
    member_since: '2026',
    bio: 'Registered in the spring intake. Useful underground and knows it.',
    profile_image: 'images/adventurer-fen.jpg'
  }
];


/* ============================================================
   ITEMS
   The nine from Part 2 first, then fifteen more so the shop's
   category filter, subcategory row and price sorting have
   enough to work with.

   Prices are in gold. member_price is set on roughly a third,
   which is what puts the strikethrough treatment on some cards
   and not others.
   ============================================================ */

const ITEMS = [
  { name: 'Healing Potion, pack of five', category: 'Potions', subcategory: 'Restoratives',
    price: 250, member_price: 180, badge: 'special', image: 'images/healing-potion.jpg',
    material: 'Glass, cork, alchemical reagents', lead_time: 'Within a week',
    description: 'Five stoppered vials of the guild\'s standard restorative, brewed in batches at Port Aldwin.',
    how_its_made: 'Blended to the charter recipe and rested a fortnight before sealing.' },

  { name: 'Weatherproof Bedroll', category: 'Adventuring supplies', subcategory: 'Camp',
    price: 220, member_price: null, badge: null, image: 'images/weatherproof-bedroll.jpg',
    material: 'Oiled canvas, wool lining', lead_time: 'Within a week',
    description: 'Wool lined and oilcloth wrapped. Sheds rain and most of the cold.',
    how_its_made: 'Cut and stitched to order, then oiled twice and hung to cure.' },

  { name: 'Antivenom Draught', category: 'Potions', subcategory: 'Restoratives',
    price: 320, member_price: 260, badge: 'special', image: 'images/antivenom-draught.jpg',
    material: 'Glass, cork, alchemical reagents', lead_time: 'Within a week',
    description: 'For marsh work and anything with fangs. Bitter enough that you will remember taking it.',
    how_its_made: 'Prepared from Blackfen stock and tested against three common venoms.' },

  { name: 'Oaken Round Shield', category: 'Weapons', subcategory: 'Shields',
    price: 480, member_price: null, badge: null, image: 'images/oaken-round-shield.jpg',
    material: 'Oak, iron boss, leather strapping', lead_time: 'Within a month',
    description: 'Iron bossed and rimmed, sized to the arm of whoever ordered it.',
    how_its_made: 'Planked, glued across the grain, and faced with hide before the boss is set.' },

  { name: 'Ashwood Quarterstaff', category: 'Weapons', subcategory: 'Staves',
    price: 540, member_price: null, badge: null, image: 'images/ashwood-quarterstaff.jpg',
    material: 'Ash, iron ferrules', lead_time: 'Within a month',
    description: 'Straight grained ash, iron shod at both ends, finished to the hand.',
    how_its_made: 'Turned from a single stave and balanced against the owner\'s height.' },

  { name: 'Boiled Leather Jerkin', category: 'Armour', subcategory: 'Light armour',
    price: 650, member_price: null, badge: null, image: 'images/boiled-leather-jerkin.jpg',
    material: 'Hardened leather, brass fittings', lead_time: 'Within a month',
    description: 'Hardened leather over the chest and shoulders, cut for movement rather than parade.',
    how_its_made: 'Moulded wet over a form, then dried slow so the shape holds.' },

  { name: 'Oilskin Travelling Cloak', category: 'Armour', subcategory: 'Cloaks',
    price: 900, member_price: 720, badge: 'special', image: 'images/travellers-leather-cloak.jpg',
    material: 'Oilskin, wool, horn toggles', lead_time: 'Within a month',
    description: 'Long enough to cover a pack, heavy enough to argue with the wind.',
    how_its_made: 'Wool woven at Greenhollow and oiled at the hall over three days.' },

  { name: 'Ironwood Shortsword', category: 'Weapons', subcategory: 'Swords',
    price: 1100, member_price: null, badge: null, image: 'images/ironwood-shortsword.jpg',
    material: 'Steel, ironwood grip', lead_time: 'Within a month',
    description: 'A close quarters blade with an ironwood grip that will outlast the edge.',
    how_its_made: 'Forged at Ironhollow and hilted at the guild hall to the buyer\'s grip.' },

  { name: 'Yew Longbow', category: 'Weapons', subcategory: 'Bows',
    price: 1400, member_price: null, badge: 'new', image: 'images/yew-longbow.png',
    material: 'Wood', lead_time: 'Within a month',
    description: 'Cut from a single stave of seasoned yew and finished with horn nocks, this is the bow the guild issues to rangers on the northern roster.',
    how_its_made: 'Guild bowyers work to order rather than to stock. A longbow takes roughly three weeks from measurement to collection, longer in the wet season when the timber is slower to season.' },

  { name: 'Lantern, shuttered', category: 'Adventuring supplies', subcategory: 'Light',
    price: 160, member_price: null, badge: null, image: 'images/item-lantern.jpg',
    material: 'Tin, horn panes', lead_time: 'Within a week',
    description: 'Four shutters and a horn pane. Throws a beam or hides one entirely.',
    how_its_made: 'Tinned and soldered at the hall, panes cut from Duskwater horn.' },

  { name: 'Rope and Grapple Set', category: 'Adventuring supplies', subcategory: 'Climbing',
    price: 180, member_price: null, badge: null, image: 'images/coiled-rope.jpg',
    material: 'Hemp, forged iron', lead_time: 'Within a week',
    description: 'Fifty feet of hemp and a four pronged grapple, tested to twice a laden pack.',
    how_its_made: 'Rope laid in three strands and load tested before it leaves the hall.' },

  { name: 'Trail Rations, six days', category: 'Adventuring supplies', subcategory: 'Provisions',
    price: 90, member_price: 70, badge: null, image: 'images/trail-rations.jpg',
    material: 'Dried meat, hard bread, fruit', lead_time: 'Within a week',
    description: 'Dull, dense and dependable. Six days of not thinking about food.',
    how_its_made: 'Packed at Greenhollow from the autumn drying.' },

  { name: 'Mana Potion, pack of three', category: 'Potions', subcategory: 'Restoratives',
    price: 420, member_price: 340, badge: null, image: 'images/mana-potion.jpg',
    material: 'Glass, cork, alchemical reagents', lead_time: 'Within a week',
    description: 'Three vials for the spellcasters. Tastes of copper and regret.',
    how_its_made: 'Distilled slowly, because the fast method is why the old shop burned down.' },

  { name: 'Smoke Flask', category: 'Potions', subcategory: 'Utility',
    price: 140, member_price: null, badge: 'new', image: 'images/item-smoke-flask.jpg',
    material: 'Clay, alchemical powder', lead_time: 'Within a week',
    description: 'Breaks on impact and fills a corridor. The guild asks that you warn your party first.',
    how_its_made: 'Thin walled clay filled and sealed the same day.' },

  { name: 'Chain Hauberk', category: 'Armour', subcategory: 'Heavy armour',
    price: 2400, member_price: 1950, badge: 'special', image: 'images/item-hauberk.jpg',
    material: 'Riveted steel rings, leather backing', lead_time: 'Two months',
    description: 'Riveted mail to the knee. Heavy, slow to make, and worth both.',
    how_its_made: 'Drawn, wound, cut and riveted ring by ring at Ironhollow.' },

  { name: 'Reinforced Pack', category: 'Adventuring supplies', subcategory: 'Camp',
    price: 260, member_price: null, badge: null, image: 'images/item-pack.jpg',
    material: 'Canvas, leather, brass', lead_time: 'Within a month',
    description: 'Framed and strapped for long carries. Holds its shape when it is empty.',
    how_its_made: 'Built around an ash frame and stitched through at every stress point.' },

  { name: 'Hunting Spear', category: 'Weapons', subcategory: 'Polearms',
    price: 620, member_price: null, badge: null, image: 'images/item-spear.jpg',
    material: 'Ash, forged steel head', lead_time: 'Within a month',
    description: 'Cross barred below the head, which is the part that matters when it works.',
    how_its_made: 'Head forged at Ironhollow, hafted and pinned at the hall.' },

  { name: 'Scout\'s Leathers', category: 'Armour', subcategory: 'Light armour',
    price: 780, member_price: 640, badge: null, image: 'images/item-leathers.jpg',
    material: 'Supple leather, waxed thread', lead_time: 'Within a month',
    description: 'Cut quiet. No buckles where a buckle would speak.',
    how_its_made: 'Assembled with waxed thread and horn fastenings throughout.' },

  { name: 'Warding Chalk, box of twelve', category: 'Potions', subcategory: 'Utility',
    price: 200, member_price: null, badge: null, image: 'images/item-chalk.jpg',
    material: 'Chalk, silver filings', lead_time: 'Within a week',
    description: 'Twelve sticks, silver threaded. For circles that need to hold overnight.',
    how_its_made: 'Cast in moulds with filings folded through while wet.' },

  { name: 'Guild Signet', category: 'Adventuring supplies', subcategory: 'Insignia',
    price: 340, member_price: 240, badge: null, image: 'images/item-signet.jpg',
    material: 'Bronze or silver, to rank', lead_time: 'Within a month',
    description: 'Struck to your rank. Proof of membership at any hall on the coast.',
    how_its_made: 'Struck from the charter dies and registered against your record.' },

  { name: 'Spellbook, blank', category: 'Adventuring supplies', subcategory: 'Scholarly',
    price: 460, member_price: null, badge: null, image: 'images/kazuma-spellbook.jpg',
    material: 'Vellum, leather, brass clasp', lead_time: 'Within a month',
    description: 'Two hundred vellum leaves, clasped and waxed against the weather.',
    how_its_made: 'Sewn in signatures and bound over boards at the hall bindery.' },

  { name: 'Climbing Irons', category: 'Adventuring supplies', subcategory: 'Climbing',
    price: 210, member_price: null, badge: null, image: 'images/item-irons.jpg',
    material: 'Forged steel, leather straps', lead_time: 'Within a week',
    description: 'Strap to the boot and take a wall the slow, certain way.',
    how_its_made: 'Forged in pairs and matched to the boot they will be worn with.' },

  { name: 'Ember Potion', category: 'Potions', subcategory: 'Utility',
    price: 380, member_price: null, badge: 'new', image: 'images/kazuma-orange-potion.jpg',
    material: 'Glass, cork, alchemical reagents', lead_time: 'Within a week',
    description: 'Holds a flame without fuel for an hour. Popular underground, banned in the reading room.',
    how_its_made: 'Charged from a kept fire at the hall and sealed while hot.' },

  { name: 'Enchanted Wand Holster', category: 'Armour', subcategory: 'Accessories',
    price: 560, member_price: 450, badge: null, image: 'images/kazuma-wand-holster.jpg',
    material: 'Leather, warded thread', lead_time: 'Within a month',
    description: 'Warded against damp and quick to the hand. Holds three wands or a short staff.',
    how_its_made: 'Stitched with warded thread and set for a season before release.' }
];


/* ============================================================
   QUESTS
   The nine from Part 2 first, keeping their original wording,
   then twenty-seven more.

   Status spread: 21 open, 4 matched, 3 completed, 3 draft,
   2 cancelled, 3 unmatched. Weighted to open because that is
   the board's default view, but every status has at least two
   rows so each filter and every account-page section has
   something to show.

   posted_by is an index into the combined poster list built in
   seed.js: 0 is the guild's own account, so those are the
   official quests carrying the seal.
   ============================================================ */

const QUESTS = [
  { title: 'Guard the Spring Fair', quest_type: 'combat', location: 'Port Aldwin',
    reward: '1,400 gold', rank_requirement: 'bronze', expected_duration: 'few-days',
    status: 'open', poster: 'Marda Pell', image: 'images/quest-spring-fair.jpg',
    description: 'The spring fair runs three days on the Port Aldwin common and draws every cutpurse on the coast. '
      + 'The fair committee wants a visible presence rather than an investigation.',
    objectives: 'Patrol the fairground through trading hours\nDeter theft at the stalls\nHand any detained persons to the harbour watch',
    additional_info: 'Guild colours to be worn. The committee provides meals.' },

  { title: 'Find the Baker\'s Cat', quest_type: 'retrieval', location: 'Port Aldwin',
    reward: '60 gold and a week of bread', rank_requirement: null, expected_duration: 'day',
    status: 'open', poster: 'Marda Pell', image: 'images/quest-bakers-cat.jpg',
    description: 'Tobias has not been seen for four days. He is grey, enormous, and answers to nothing. '
      + 'Last seen near the cooperage on Wharf Lane.',
    objectives: 'Locate the cat\nReturn him to the bakery unharmed',
    additional_info: 'He bites. The reward stands regardless.' },

  { title: 'Clear Wolves from the Orchard', quest_type: 'combat', location: 'Greenhollow',
    reward: '900 gold', rank_requirement: 'bronze', expected_duration: 'few-days',
    status: 'open', poster: 'Bobby Dale', image: 'images/quest-orchard-wolves.jpg',
    description: 'A pack has been working the orchard edge since the thaw and has taken two goats and a dog. '
      + 'The mill wants them moved on or dealt with.',
    objectives: 'Locate the pack\'s den\nRemove the threat to the orchard\nReport what was found',
    additional_info: 'Traps are permitted. The mill will house the party for the duration.' },

  { title: 'Clear the Old Dungeon', quest_type: 'combat', location: 'Hollowmere Hills',
    reward: '4,500 gold', rank_requirement: 'silver', expected_duration: 'week',
    status: 'open', poster: 'Jorem Lantry', image: 'images/quest-old-dungeon.jpg',
    description: 'The lower levels beneath the old holdfast have been sealed for thirty years. '
      + 'The survey needs them cleared before the structure above can be assessed.',
    objectives: 'Open and clear the lower levels\nMap what is found\nReport any structural damage',
    additional_info: 'Two or more strongly recommended. Bring light.' },

  { title: 'Escort the Salt Caravan', quest_type: 'escort', location: 'Greenhollow',
    reward: '2,200 gold', rank_requirement: 'bronze', expected_duration: 'week',
    status: 'open', poster: 'Sella Crow', image: 'images/quest-salt-caravan.jpg',
    description: 'Six waggons of salt from the Greenhollow pans to the Port Aldwin market, by the inland road.',
    objectives: 'Accompany the caravan for the full route\nKeep the waggons together at crossings\nDeliver to the market clerk',
    additional_info: 'Nine days if the weather holds. Sella pays on arrival, not before.' },

  { title: 'Survey the Sunken Wharf', quest_type: 'investigation', location: 'Port Aldwin',
    reward: '3,800 gold', rank_requirement: 'silver', expected_duration: 'few-days',
    status: 'open', poster: 'The Guild', image: 'images/quest-sunken-wharf.jpg',
    description: 'The eastern wharf gave way in the winter storms and the harbour office needs to know what is left below.',
    objectives: 'Assess the remaining piles\nRecover anything of value from the collapse\nReport whether rebuilding is possible',
    additional_info: 'The guild has arranged for a boat and a diver\'s bell.' },

  { title: 'Investigate the Lighthouse', quest_type: 'investigation', location: 'Cape Serrin',
    reward: '12,000 gold', rank_requirement: 'gold', expected_duration: 'week-plus',
    status: 'open', poster: 'The Guild', image: 'images/quest-lighthouse.jpg',
    description: 'The lighthouse at Cape Serrin has burned every night for four hundred years. '
      + 'Eleven days ago it went dark, and the keeper has not been seen since. Two fishing boats have run aground on the rocks below in the time since.\n\n'
      + 'The guild is treating this as an investigation rather than a rescue, though adventurers should prepare for both. '
      + 'The coast road is passable but slow, and the weather this season has been poor.',
    objectives: 'Reach the lighthouse and determine why the light has failed\nLocate the keeper, or establish what became of them\nRestore the light if it can safely be done',
    additional_info: 'Parties of two or more are recommended. The guild will reimburse reasonable travel costs on presentation of receipts. '
      + 'Any items recovered from the lighthouse remain the property of the Keepers\' Trust.' },

  { title: 'Recover the Duskwater Ledgers', quest_type: 'retrieval', location: 'Duskwater',
    reward: '5,600 gold', rank_requirement: 'silver', expected_duration: 'week',
    status: 'open', poster: 'The Guild', image: 'images/quest-duskwater-ledgers.jpg',
    description: 'The counting house flooded in the spring and the ledgers went down with the lower floor. '
      + 'The guild needs them recovered and legible.',
    objectives: 'Recover the ledgers from the lower floor\nDry and stabilise what survives\nDeliver to the Duskwater clerk',
    additional_info: 'Water damage is expected. Someone who can read old script would help.' },

  { title: 'Map the Hollowmere Caves', quest_type: 'investigation', location: 'Hollowmere Hills',
    reward: '7,200 gold', rank_requirement: 'gold', expected_duration: 'week-plus',
    status: 'open', poster: 'The Guild', image: 'images/quest-hollowmere-caves.jpg',
    description: 'The cave system under the Hollowmere ridge has never been properly surveyed and three separate parties have '
      + 'returned with three different accounts of it.',
    objectives: 'Produce a survey of the accessible system\nMark water and air hazards\nReport on the lower galleries if they can be reached',
    additional_info: 'The guild supplies chalk, line and lamps. Do not split the party below the second gallery.' },

  { title: 'Deliver the Blackfen Remedies', quest_type: 'delivery', location: 'Blackfen',
    reward: '480 gold', rank_requirement: null, expected_duration: 'few-days',
    status: 'open', poster: 'Petra Vane', image: 'images/quest-remedies.jpg',
    description: 'A case of prepared remedies to the Greenhollow midwife, by the fen road, before they turn.',
    objectives: 'Collect the case from the Blackfen apothecary\nDeliver to the Greenhollow midwife within four days',
    additional_info: 'Keep it cold and do not open it.' },

  { title: 'Escort the Ore Waggons', quest_type: 'escort', location: 'Ironhollow',
    reward: '1,800 gold', rank_requirement: 'bronze', expected_duration: 'few-days',
    status: 'open', poster: 'Harl Mowbray', image: 'images/quest-ore.jpg',
    description: 'Four waggons of ore down from the Ironhollow cut to the forge yard. The pass road has been quiet, but quiet is not the same as safe.',
    objectives: 'Accompany the waggons from the cut to the forge yard\nReport any obstruction on the pass road',
    additional_info: 'Harl feeds the party at both ends.' },

  { title: 'Find the Missing Surveyor', quest_type: 'rescue', location: 'Hollowmere Hills',
    reward: '3,200 gold', rank_requirement: 'silver', expected_duration: 'week',
    status: 'open', poster: 'Jorem Lantry', image: 'images/quest-surveyor.jpg',
    description: 'One of the survey team did not return from the northern ridge eight days ago. He was working alone, against instruction.',
    objectives: 'Search the northern ridge\nLocate the surveyor or establish what happened\nRecover his instruments and notes',
    additional_info: 'He was carrying a red-cased theodolite, which is distinctive.' },

  { title: 'Clear the Well at Thornmoor', quest_type: 'combat', location: 'Thornmoor',
    reward: '1,100 gold', rank_requirement: 'bronze', expected_duration: 'day',
    status: 'open', poster: 'Sella Crow', image: 'images/quest-well.jpg',
    description: 'Something has taken up residence in the village well and the village has taken up drinking from the stream.',
    objectives: 'Determine what is in the well\nRemove it\nConfirm the water runs clean',
    additional_info: 'The village will not pay until the water is drunk in front of them.' },

  { title: 'Retrieve the Wreck Manifest', quest_type: 'retrieval', location: 'Cape Serrin',
    reward: '2,600 gold', rank_requirement: 'silver', expected_duration: 'few-days',
    status: 'open', poster: 'Tobias Reeve', image: 'images/quest-manifest.jpg',
    description: 'The Marigold went down on the Serrin rocks with her manifest aboard. The harbour office needs it for the insurers.',
    objectives: 'Reach the wreck at low water\nRecover the manifest from the captain\'s locker',
    additional_info: 'Two hours of workable tide each day. Do not attempt it in weather.' },

  { title: 'Guard the Night Market', quest_type: 'combat', location: 'Duskwater',
    reward: '760 gold', rank_requirement: null, expected_duration: 'hours',
    status: 'open', poster: 'Tobias Reeve', image: 'images/quest-night-market.jpg',
    description: 'One night of visible presence at the Duskwater night market. Nothing has happened yet, which is the point.',
    objectives: 'Patrol the market from dusk until close\nRemain visible',
    additional_info: 'A single night. Good work for a new member.' },

  { title: 'Carry the Charter Copies', quest_type: 'delivery', location: 'Port Aldwin',
    reward: '520 gold', rank_requirement: null, expected_duration: 'few-days',
    status: 'open', poster: 'The Guild', image: 'images/quest-charter.jpg',
    description: 'Sealed copies of the revised charter rates to the halls at Greenhollow and Duskwater, by hand.',
    objectives: 'Deliver to the Greenhollow clerk\nDeliver to the Duskwater clerk\nReturn both signed receipts',
    additional_info: 'The seals must arrive unbroken.' },

  { title: 'Escort the Apothecary', quest_type: 'escort', location: 'Blackfen',
    reward: '1,300 gold', rank_requirement: 'bronze', expected_duration: 'few-days',
    status: 'open', poster: 'Petra Vane', image: 'images/quest-apothecary.jpg',
    description: 'Petra is collecting stock from the deep fen and will not be talked out of going. She would like company that can swim.',
    objectives: 'Accompany the apothecary into the deep fen\nReturn her and her stock to Blackfen',
    additional_info: 'Three days. She sets the pace and it is slower than yours.' },

  { title: 'Break the Blockage at Saltmarsh Reach', quest_type: 'retrieval', location: 'Saltmarsh Reach',
    reward: '1,650 gold', rank_requirement: 'bronze', expected_duration: 'few-days',
    status: 'open', poster: 'Anwen Fisk', image: 'images/quest-blockage.jpg',
    description: 'The drainage channel has silted and taken half the road with it. The Reach wants it opened before the spring rains.',
    objectives: 'Clear the channel blockage\nRecover anything the silt has held\nConfirm the flow is restored',
    additional_info: 'Wet, heavy work. Anwen pays in coin and honey both.' },

  { title: 'Read the Wyrmspine Marker', quest_type: 'investigation', location: 'Wyrmspine Pass',
    reward: '4,100 gold', rank_requirement: 'gold', expected_duration: 'week',
    status: 'open', poster: 'The Guild', image: 'images/quest-marker.jpg',
    description: 'A carved marker at the head of the pass, in a script nobody at the hall recognises. The guild would like to know what it says before the road crews reach it.',
    objectives: 'Reach the marker at the head of the pass\nRecord the inscription in full\nTranslate it if that can be done',
    additional_info: 'Take rubbings. Do not move the stone.' },

  { title: 'Recover the Lost Waggon', quest_type: 'retrieval', location: 'Thornmoor',
    reward: '1,900 gold', rank_requirement: 'bronze', expected_duration: 'few-days',
    status: 'open', poster: 'Sella Crow', image: 'images/quest-waggon.jpg',
    description: 'A waggon came off the moor road in fog and has not been found. It was carrying bolt cloth worth more than the waggon.',
    objectives: 'Locate the waggon\nRecover the cargo\nReport on the driver',
    additional_info: 'The driver walked out. He is vague about where.' },

  { title: 'Sit the Ironhollow Watch', quest_type: 'combat', location: 'Ironhollow',
    reward: '880 gold', rank_requirement: null, expected_duration: 'few-days',
    status: 'open', poster: 'Harl Mowbray', image: 'images/quest-watch.jpg',
    description: 'The forge yard needs a night watch for a week while the regular man mends a leg.',
    objectives: 'Hold the forge yard gate overnight, seven nights\nLog anyone entering after dark',
    additional_info: 'Quiet work. Bring something to read.' },

  { title: 'Bring the Midwife to Hollowmere', quest_type: 'delivery', location: 'Greenhollow',
    reward: '640 gold', rank_requirement: null, expected_duration: 'day',
    status: 'open', poster: 'Bobby Dale', image: 'images/quest-midwife.jpg',
    description: 'A fast run up to the Hollowmere holdings with the Greenhollow midwife, tonight rather than tomorrow.',
    objectives: 'Escort the midwife to the Hollowmere holdings without delay',
    additional_info: 'Horses provided. Do not wait for the weather.' },

  { title: 'Trace the Fen Lights', quest_type: 'investigation', location: 'Blackfen',
    reward: '2,900 gold', rank_requirement: 'silver', expected_duration: 'week',
    status: 'open', poster: 'The Guild', image: 'images/quest-fen-lights.jpg',
    description: 'Lights over the Blackfen every night for a month, and two people who followed them have not come back.',
    objectives: 'Establish the source of the lights\nSearch for the two missing persons\nReport before pursuing anything further',
    additional_info: 'The guild is explicit that this is an investigation. Report first.' },

  { title: 'Retrieve the Signal Bell', quest_type: 'retrieval', location: 'Cape Serrin',
    reward: '1,450 gold', rank_requirement: 'bronze', expected_duration: 'day',
    status: 'open', poster: 'Tobias Reeve', image: 'images/quest-bell.jpg',
    description: 'The signal bell came off its mounting in the last blow and is somewhere below the headland path.',
    objectives: 'Locate the bell below the headland\nBring it up intact',
    additional_info: 'It weighs more than it looks. Bring line.' },

  // Matched: an adventurer is assigned, work under way.
  { title: 'Explore the Magic Cave', quest_type: 'investigation', location: 'Hollowmere Hills',
    reward: '3,400 gold', rank_requirement: 'silver', expected_duration: 'week',
    status: 'matched', poster: 'Bobby Dale', accepted_by: 'Kazuma Sato',
    image: 'images/quest-magic-cave.jpg', accepted_at: '2026-09-08',
    description: 'A cave opened in the hillside above the mill after the rains, and it is lit inside by something that is not daylight.',
    objectives: 'Determine the source of the light\nAssess whether the cave is safe\nReport to the mill',
    additional_info: 'The mill would like it to be safe. The mill is prepared for it not to be.' },

  { title: 'Escort the Bonded Courier', quest_type: 'escort', location: 'Wyrmspine Pass',
    reward: '2,750 gold', rank_requirement: 'silver', expected_duration: 'week',
    status: 'matched', poster: 'The Guild', accepted_by: 'Dorin Stonebeard',
    image: 'images/quest-courier.jpg', accepted_at: '2026-09-10',
    description: 'A bonded courier through the Wyrmspine Pass with documents the guild would rather arrived.',
    objectives: 'Accompany the courier for the full crossing\nDeliver them and the case to the far hall',
    additional_info: 'The case is not to be opened, by anyone, including you.' },

  { title: 'Hold the Greenhollow Gate', quest_type: 'combat', location: 'Greenhollow',
    reward: '1,200 gold', rank_requirement: 'bronze', expected_duration: 'few-days',
    status: 'matched', poster: 'Bobby Dale', accepted_by: 'Bram Ottersby',
    image: 'images/quest-gate.jpg', accepted_at: '2026-09-12',
    description: 'Three nights on the Greenhollow gate while the fair traffic passes through.',
    objectives: 'Hold the gate for three nights\nTurn away anyone without papers',
    additional_info: 'The village constable is nominally in charge and will not be there.' },

  { title: 'Survey the Flooded Undercroft', quest_type: 'investigation', location: 'Duskwater',
    reward: '2,300 gold', rank_requirement: 'silver', expected_duration: 'few-days',
    status: 'matched', poster: 'Tobias Reeve', accepted_by: 'Sana Brightwater',
    image: 'images/quest-undercroft.jpg', accepted_at: '2026-09-13',
    description: 'The undercroft below the old customs house has taken water and nobody knows how far back it runs.',
    objectives: 'Establish the extent of the flooding\nMark anything structurally unsound',
    additional_info: 'Cold water work. The harbour office provides a pump if one is wanted.' },

  // Completed: all three sign-offs done.
  { title: 'Find the Lost Cat', quest_type: 'retrieval', location: 'Port Aldwin',
    reward: '80 gold', rank_requirement: null, expected_duration: 'day',
    status: 'completed', poster: 'Marda Pell', accepted_by: 'Kazuma Sato',
    image: 'images/quest-lost-cat.jpg', accepted_at: '2026-08-20', completed_at: '2026-08-22',
    description: 'An earlier and entirely separate cat. Marda has since been advised to keep the door shut.',
    objectives: 'Locate the cat\nReturn her to the bakery',
    additional_info: 'Resolved. The cat was in the flour store.' },

  { title: 'Clear Wolves from the North Field', quest_type: 'combat', location: 'Greenhollow',
    reward: '850 gold', rank_requirement: 'bronze', expected_duration: 'few-days',
    status: 'completed', poster: 'Bobby Dale', accepted_by: 'Bram Ottersby',
    image: 'images/quest-north-field.jpg', accepted_at: '2026-07-14', completed_at: '2026-07-19',
    description: 'An earlier incursion at the north field, dealt with before the orchard pack appeared.',
    objectives: 'Locate the pack\nRemove the threat to the field',
    additional_info: 'Resolved. The mill believes the two packs were related.' },

  { title: 'Escort the Salt Caravan, spring run', quest_type: 'escort', location: 'Greenhollow',
    reward: '2,100 gold', rank_requirement: 'bronze', expected_duration: 'week',
    status: 'completed', poster: 'Sella Crow', accepted_by: 'Garrick Stonewell',
    image: 'images/quest-spring-caravan.jpg', accepted_at: '2026-04-01', completed_at: '2026-04-10',
    description: 'The spring run of the salt caravan, completed without incident.',
    objectives: 'Accompany the caravan for the full route\nDeliver to the market clerk',
    additional_info: 'Resolved. Sella has posted the autumn run separately.' },

  // Unmatched: Auto-Party ran out of candidates.
  { title: 'Descend the Duskwater Shaft', quest_type: 'investigation', location: 'Duskwater',
    reward: '6,800 gold', rank_requirement: 'gold', expected_duration: 'week-plus',
    status: 'unmatched', poster: 'Tobias Reeve', auto_party_enabled: 1,
    image: 'images/quest-shaft.jpg',
    description: 'The old shaft below the harbour runs further than the records allow for, and the harbour office would like to know where it goes.',
    objectives: 'Descend the shaft as far as is safe\nMap the descent\nReport on the lower workings',
    additional_info: 'Gold rank. The guild will not offer this below that.' },

  { title: 'Winter the Cape Serrin Light', quest_type: 'delivery', location: 'Cape Serrin',
    reward: '3,900 gold', rank_requirement: 'gold', expected_duration: 'week-plus',
    status: 'unmatched', poster: 'The Guild', auto_party_enabled: 1,
    image: 'images/quest-winter-light.jpg',
    description: 'Six months of stores carried out to the Cape Serrin light before the weather closes the coast road.',
    objectives: 'Carry the winter stores to the light\nConfirm the keeper is provisioned through to spring',
    additional_info: 'Nobody available has taken this. The guild is considering raising the reward.' },

  { title: 'Settle the Thornmoor Dispute', quest_type: 'escort', location: 'Thornmoor',
    reward: '2,400 gold', rank_requirement: 'gold', expected_duration: 'week',
    status: 'unmatched', poster: 'Sella Crow', auto_party_enabled: 1,
    image: 'images/quest-dispute.jpg',
    description: 'Two Thornmoor families have stopped speaking and started fencing. Sella wants a neutral presence while the boundary is walked.',
    objectives: 'Accompany the boundary walk\nKeep both parties separated\nWitness the agreed line',
    additional_info: 'Nobody has taken this on. Sella is aware why.' },

  // Cancelled.
  { title: 'Drain the Lower Orchard', quest_type: 'retrieval', location: 'Greenhollow',
    reward: '700 gold', rank_requirement: 'bronze', expected_duration: 'few-days',
    status: 'cancelled', poster: 'Bobby Dale', image: 'images/quest-orchard-drain.jpg',
    description: 'Withdrawn. The water went down on its own and the mill would rather keep the coin.',
    objectives: 'Clear the orchard drainage',
    additional_info: 'Cancelled by the poster.' },

  { title: 'Recover the Strongbox', quest_type: 'retrieval', location: 'Saltmarsh Reach',
    reward: '3,100 gold', rank_requirement: 'silver', expected_duration: 'week',
    status: 'cancelled', poster: 'Anwen Fisk', image: 'images/quest-strongbox.jpg',
    description: 'Withdrawn by the guild after the ownership of the strongbox was disputed.',
    objectives: 'Recover the strongbox from the Reach',
    additional_info: 'Cancelled pending the dispute. It may be reposted.' },

  // Drafts: written but not published, visible only to their poster.
  { title: 'Repair the Mill Race', quest_type: 'retrieval', location: 'Greenhollow',
    reward: '', rank_requirement: null, expected_duration: null,
    status: 'draft', poster: 'Bobby Dale', image: null,
    description: 'The race is silting again and I need someone in the water before the wheel binds. Still working out what I can pay.',
    objectives: 'Clear the race', additional_info: null },

  { title: 'Something About the Cellar', quest_type: 'investigation', location: 'Port Aldwin',
    reward: '', rank_requirement: null, expected_duration: null,
    status: 'draft', poster: 'Marda Pell', image: null,
    description: 'Noises under the bakery at night. Probably rats. Writing this down before I talk myself out of it.',
    objectives: '', additional_info: null },

  { title: 'Autumn Caravan, north road', quest_type: 'escort', location: 'Thornmoor',
    reward: '2,600 gold', rank_requirement: 'bronze', expected_duration: 'week',
    status: 'draft', poster: 'Sella Crow', image: null,
    description: 'The autumn run, north road this time rather than inland. Holding this until the road crews confirm the pass is open.',
    objectives: 'Accompany the caravan for the full route\nDeliver to the market clerk',
    additional_info: 'Not yet posted.' }
];


/* ============================================================
   NEWS
   The six entries from Part 2, plus six more so the news page
   and its search have enough to work with.
   ============================================================ */

const NEWS = [
  { title: 'Spring Intake Opens at Every Hall', category: 'announcement', is_featured: 1,
    published_at: '2026-08-18', author: 'the Guild Master', image: 'images/news-intake.jpg',
    summary: 'Registration opens on the first of September at every guild hall.',
    body: 'The spring intake opens on the first of September at every guild hall. Members due for rank assessment '
      + 'should present themselves at Port Aldwin with their completed quest record. The charter rates are unchanged '
      + 'for the coming season.\n\nHalls at Greenhollow and Duskwater will take registrations in the same week. '
      + 'Anyone whose membership lapsed during the flooding should speak to the clerk rather than registering again.' },

  { title: 'Spring Registration Now Open', category: 'news', is_featured: 0,
    published_at: '2026-08-12', author: 'Wren Alderly', image: 'images/news-registration.jpg',
    summary: 'The guild is accepting new adventurers for the spring intake.',
    body: 'The guild is accepting new adventurers for the spring intake. Bring proof of training, a weapon of your '
      + 'choosing, and a tolerance for paperwork.' },

  { title: 'Northern Road Reopened', category: 'news', is_featured: 0,
    published_at: '2026-08-04', author: 'Wren Alderly', image: 'images/news-road.jpg',
    summary: 'The northern trade road is open again after six weeks of escort work.',
    body: 'Following six weeks of escort work, the northern trade road is open again. The guild thanks every '
      + 'adventurer who took a shift on the caravan roster.' },

  { title: 'New Potion Range in the Shop', category: 'news', is_featured: 0,
    published_at: '2026-07-28', author: 'Wren Alderly', image: 'images/news-potions.jpg',
    summary: 'The alchemists have expanded the restorative range.',
    body: 'Our alchemists have expanded the restorative range. Members receive discounted pricing on all new lines '
      + 'for the remainder of the season.' },

  { title: 'Rank Assessments at Port Aldwin', category: 'event', is_featured: 0,
    published_at: '2026-07-19', author: 'Wren Alderly', image: 'images/news-assessments.jpg',
    summary: 'Assessments run for three days at the end of the month.',
    body: 'Assessments run for three days at the end of the month. Members due for advancement should bring a '
      + 'completed quest record and two witnesses.' },

  { title: 'Duskwater Hall Reopens After Flooding', category: 'news', is_featured: 0,
    published_at: '2026-07-02', author: 'Wren Alderly', image: 'images/news-duskwater.jpg',
    summary: 'The Duskwater hall is taking quests again after eleven weeks of repairs.',
    body: 'The Duskwater hall is taking quests again after eleven weeks of repairs. The ledgers recovered from the '
      + 'counting house are still being dried.' },

  { title: 'Charter Rates Confirmed for the Season', category: 'announcement', is_featured: 0,
    published_at: '2026-06-24', author: 'the Guild Master', image: 'images/news-rates.jpg',
    summary: 'The published rates are unchanged for the coming season.',
    body: 'The published rates are unchanged for the coming season. The full schedule is set out in the guild '
      + 'charter, available from the footer of any page.' },

  { title: 'Wyrmspine Road Crews Begin Work', category: 'news', is_featured: 0,
    published_at: '2026-09-02', author: 'Wren Alderly', image: 'images/news-wyrmspine.jpg',
    summary: 'Work begins on the Wyrmspine Pass road this week.',
    body: 'The road crews reach the head of the pass this week. The guild has asked that the carved marker at the '
      + 'summit be left undisturbed until it has been read.' },

  { title: 'Autumn Caravan Roster Now Posting', category: 'event', is_featured: 0,
    published_at: '2026-08-29', author: 'Wren Alderly', image: 'images/news-roster.jpg',
    summary: 'Escort shifts for the autumn caravan season are going up on the board.',
    body: 'Escort shifts for the autumn season are going up on the board over the next fortnight. Members who took '
      + 'the spring run have first refusal for three days before each posting opens generally.' },

  { title: 'Guild Shop Extends Lead Times', category: 'announcement', is_featured: 0,
    published_at: '2026-08-21', author: 'the Guild Master', image: 'images/news-lead-times.jpg',
    summary: 'Armour orders are running longer than usual this season.',
    body: 'Armour orders are running roughly two weeks longer than usual, owing to the volume of work at Ironhollow. '
      + 'Members with a quest pending should order early rather than at need.' },

  { title: 'Blackfen Lights Under Investigation', category: 'news', is_featured: 0,
    published_at: '2026-08-08', author: 'Wren Alderly', image: 'images/news-fen-lights.jpg',
    summary: 'The guild has posted an investigation quest for the Blackfen lights.',
    body: 'The lights over the Blackfen have now been reported every night for a month, and two persons who followed '
      + 'them have not returned. The guild has posted this as an investigation and asks that members not pursue the '
      + 'lights independently.' },

  { title: 'Cape Serrin Light Goes Dark', category: 'announcement', is_featured: 0,
    published_at: '2026-08-10', author: 'the Guild Master', image: 'images/news-lighthouse.jpg',
    summary: 'The Cape Serrin light has failed for the first time in four hundred years.',
    body: 'The light at Cape Serrin has not burned for eleven nights and the keeper has not been seen. Two fishing '
      + 'boats have run aground on the rocks below. The guild has posted this at gold rank and asks coastal traffic '
      + 'to route wide of the headland until further notice.' }
];


/* ============================================================
   ENQUIRIES
   Contact form submissions, spread across the three statuses so
   the admin inbox has something to filter and action. Two come
   from guests, so their user_id stays null.
   ============================================================ */

const ENQUIRIES = [
  { name: 'Bobby Dale', email: 'bobby@greenhollowmill.com', phone: '0412000001',
    enquiry_type: 'Posting a quest', status: 'closed', created_at: '2026-08-14',
    message: 'How long does a quest normally sit on the board before somebody takes it? '
      + 'The orchard one has been up four days.',
    admin_notes: 'Answered. Advised typical turnaround and the Auto-Party option.' },

  { name: 'Marda Pell', email: 'marda@portaldwin.com', phone: '0412000002',
    enquiry_type: 'Posting a quest', status: 'closed', created_at: '2026-08-21',
    message: 'Can I repost the same quest if the cat gets out again? Asking in advance.',
    admin_notes: 'Answered. Yes, as a new posting.' },

  { name: 'Corwin Ashby', email: 'c.ashby@thornmoor.com', phone: '0412000101',
    enquiry_type: 'Membership', status: 'in_progress', created_at: '2026-09-03',
    message: 'I trained with the Thornmoor watch for six years. Does that count toward a starting rank, '
      + 'or do I begin at bronze like everyone else?',
    admin_notes: 'Referred to the clerk for assessment.' },

  { name: 'Harl Mowbray', email: 'harl.mowbray@ironhollow.com', phone: '0412000005',
    enquiry_type: 'Shop order', status: 'in_progress', created_at: '2026-09-07',
    message: 'The hauberk I ordered was quoted two months. Is that still accurate with the road crews '
      + 'taking so much of the forge time?',
    admin_notes: 'Checking with Ironhollow.' },

  { name: 'Anwen Fisk', email: 'anwen.fisk@saltmarsh.com', phone: '0412000006',
    enquiry_type: 'Hiring an adventurer', status: 'new', created_at: '2026-09-11',
    message: 'Is there a way to ask for the same adventurer twice? Orin did the fen road last year and '
      + 'I would rather not explain it again to somebody new.',
    admin_notes: null },

  { name: 'Delia Quorn', email: 'delia.quorn@example.com', phone: '0412000102',
    enquiry_type: 'General enquiry', status: 'new', created_at: '2026-09-13',
    message: 'Does the guild take work outside Oceania? I am writing on behalf of a party in the '
      + 'southern reaches and the distance may be prohibitive.',
    admin_notes: null },

  { name: 'Petra Vane', email: 'petra.vane@blackfen.com', phone: '0412000008',
    enquiry_type: 'Posting a quest', status: 'new', created_at: '2026-09-15',
    message: 'The remedies delivery needs to go out again next month. Can I set it up now and have it '
      + 'post later, or do I have to remember?',
    admin_notes: null },

  { name: 'Tobias Reeve', email: 'tobias.reeve@duskwater.com', phone: '0412000003',
    enquiry_type: 'Posting a quest', status: 'new', created_at: '2026-09-16',
    message: 'The shaft quest has had no takers for a fortnight. What are my options besides raising the reward?',
    admin_notes: null }
];


/* ============================================================
   ORDERS
   Bobby Dale's three orders from the Part 2 account page, plus
   a few more so the order history has depth. Items are named
   rather than keyed, and seed.js resolves them.
   ============================================================ */

const ORDERS = [
  { customer: 'Bobby Dale', payment_method: 'Dragon-Coin', status: 'collected',
    created_at: '2026-06-02',
    lines: [{ item: 'Healing Potion, pack of five', quantity: 10 }] },

  { customer: 'Bobby Dale', payment_method: 'Cash', status: 'collected',
    created_at: '2026-04-14',
    lines: [{ item: 'Rope and Grapple Set', quantity: 1 }] },

  { customer: 'Bobby Dale', payment_method: 'Magic Pay', status: 'collected',
    created_at: '2026-03-03',
    lines: [{ item: 'Weatherproof Bedroll', quantity: 2 }] },

  { customer: 'Kazuma Sato', payment_method: 'Magic Pay', status: 'ready',
    created_at: '2026-09-09',
    lines: [{ item: 'Mana Potion, pack of three', quantity: 2 },
            { item: 'Warding Chalk, box of twelve', quantity: 1 }] },

  { customer: 'Elara Thornwood', payment_method: 'Credit', status: 'in_progress',
    created_at: '2026-09-12',
    lines: [{ item: 'Yew Longbow', quantity: 1 },
            { item: 'Scout\'s Leathers', quantity: 1 }] },

  { customer: 'Harl Mowbray', payment_method: 'Dragon-Coin', status: 'placed',
    created_at: '2026-09-14',
    lines: [{ item: 'Chain Hauberk', quantity: 1 }] }
];


/* ============================================================
   GEAR
   Equipped rows become the gear slots on a profile; unequipped
   rows become the inventory list beside them. Slot count rises
   with rank, so a silver member such as Kazuma shows four.
   ============================================================ */

const GEAR = [
  { adventurer: 'Kazuma Sato', item: 'Enchanted Wand Holster', equipped: 1 },
  { adventurer: 'Kazuma Sato', item: 'Oilskin Travelling Cloak', equipped: 1 },
  { adventurer: 'Kazuma Sato', item: 'Spellbook, blank', equipped: 1 },
  { adventurer: 'Kazuma Sato', item: 'Ember Potion', equipped: 1 },
  { adventurer: 'Kazuma Sato', item: 'Mana Potion, pack of three', equipped: 0 },
  { adventurer: 'Kazuma Sato', item: 'Healing Potion, pack of five', equipped: 0 },
  { adventurer: 'Kazuma Sato', item: 'Rope and Grapple Set', equipped: 0 },
  { adventurer: 'Kazuma Sato', item: 'Trail Rations, six days', equipped: 0 },

  { adventurer: 'Elara Thornwood', item: 'Yew Longbow', equipped: 1 },
  { adventurer: 'Elara Thornwood', item: 'Scout\'s Leathers', equipped: 1 },
  { adventurer: 'Elara Thornwood', item: 'Reinforced Pack', equipped: 1 },
  { adventurer: 'Elara Thornwood', item: 'Lantern, shuttered', equipped: 1 },
  { adventurer: 'Elara Thornwood', item: 'Climbing Irons', equipped: 1 },
  { adventurer: 'Elara Thornwood', item: 'Trail Rations, six days', equipped: 0 },

  { adventurer: 'Dorin Stonebeard', item: 'Chain Hauberk', equipped: 1 },
  { adventurer: 'Dorin Stonebeard', item: 'Oaken Round Shield', equipped: 1 },
  { adventurer: 'Dorin Stonebeard', item: 'Ironwood Shortsword', equipped: 1 },
  { adventurer: 'Dorin Stonebeard', item: 'Guild Signet', equipped: 1 },
  { adventurer: 'Dorin Stonebeard', item: 'Healing Potion, pack of five', equipped: 0 },

  { adventurer: 'Bram Ottersby', item: 'Boiled Leather Jerkin', equipped: 1 },
  { adventurer: 'Bram Ottersby', item: 'Hunting Spear', equipped: 1 },
  { adventurer: 'Bram Ottersby', item: 'Weatherproof Bedroll', equipped: 0 },

  { adventurer: 'Mira Duskrunner', item: 'Scout\'s Leathers', equipped: 1 },
  { adventurer: 'Mira Duskrunner', item: 'Climbing Irons', equipped: 1 },
  { adventurer: 'Mira Duskrunner', item: 'Smoke Flask', equipped: 1 },
  { adventurer: 'Mira Duskrunner', item: 'Lantern, shuttered', equipped: 1 },
  { adventurer: 'Mira Duskrunner', item: 'Antivenom Draught', equipped: 0 },

  { adventurer: 'Sister Adela', item: 'Guild Signet', equipped: 1 },
  { adventurer: 'Sister Adela', item: 'Warding Chalk, box of twelve', equipped: 1 },
  { adventurer: 'Sister Adela', item: 'Healing Potion, pack of five', equipped: 1 },
  { adventurer: 'Sister Adela', item: 'Antivenom Draught', equipped: 1 },
  { adventurer: 'Sister Adela', item: 'Reinforced Pack', equipped: 0 }
];


/* ============================================================
   SAVED QUESTS
   Adventurers bookmarking work for later.
   ============================================================ */

const SAVED_QUESTS = [
  { adventurer: 'Bram Ottersby', quest: 'Clear the Old Dungeon' },
  { adventurer: 'Bram Ottersby', quest: 'Guard the Spring Fair' },
  { adventurer: 'Rook Callan', quest: 'Guard the Night Market' },
  { adventurer: 'Rook Callan', quest: 'Find the Baker\'s Cat' },
  { adventurer: 'Tamsin Vale', quest: 'Map the Hollowmere Caves' },
  { adventurer: 'Venna Tor', quest: 'Retrieve the Wreck Manifest' },
  { adventurer: 'Lys Arden', quest: 'Read the Wyrmspine Marker' },
  { adventurer: 'Orin Blackfen', quest: 'Trace the Fen Lights' }
];


module.exports = {
  DEMO_PASSWORD,
  ADMINS,
  CUSTOMERS,
  ADVENTURERS,
  ITEMS,
  QUESTS,
  NEWS,
  ENQUIRIES,
  ORDERS,
  GEAR,
  SAVED_QUESTS
};
