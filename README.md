# Oceania Adventure Guild

A website for a fictional adventurers' guild: customers post quests, adventurers
accept them, and the guild brokers the arrangement. Built as a student project
for SIT774 Web Technologies and Development at Deakin University.

The site is a three part project. Part 1 was the static pages, Part 2 added the
client side behaviour, and Part 3 (Task 10.2D) connected it to an SQLite
database. Auto-Party, the automatic matching feature proposed in Task 7.3HD and
implemented in Task 10.3HD, is built into the same site rather than standing
apart from it.

`DEVLOG.md` records what was built at each stage, what was decided and why, and
what broke along the way.


## Running it

Node.js 22 or newer is required, because the database layer uses the built in
`node:sqlite` module rather than a third party driver.

```
npm install
node server.js
```

Then open <http://localhost:3000>.

The server creates and seeds `guild.db` on first start, and reports how many
rows it inserted. Nothing else needs to be run by hand.

To start again from a clean database, stop the server, delete `guild.db` (along
with `guild.db-wal` and `guild.db-shm` if they are present), and start it again.
The file is generated, so it is deliberately not kept in version control.


## Accounts

Every seeded account uses the same password:

```
guild12345
```

| Role          | Email                             |
| ------------- | --------------------------------- |
| Administrator | `guildmaster@oceaniaguild.com`    |
| Customer      | `anwen.fisk@saltmarsh.com`        |
| Adventurer    | `elara.thornwood@oceaniaguild.com` |

The seed creates 30 accounts in total: 20 adventurers, 8 customers and 2
administrators.

Every seeded adventurer starts with Auto-Party switched off. To see it work,
log in as two or three adventurers, switch it on from My Account and tick the
quest types they want, then post a quest with "Use Auto-Party" ticked as a
customer. Each role needs its own browser or private window, because one
browser holds one login.


## What each role can do

A **customer** posts quests, saves drafts, edits and cancels them, hires an
adventurer directly, confirms that work has been done, and fills a cart in the
guild shop (checkout is not built yet).

An **adventurer** browses the quest board, accepts one quest at a time,
accepts or declines a hire, marks work as done, and keeps a public profile on
the register. From My Account they edit their profile, set themselves
unavailable (optionally until a date) in the Availability panel, and switch
Auto-Party on or off. A hire can be declined from the account page or from
the quest's own page, and the customer is told.

A **customer** or an **adventurer** can edit their own name, phone and
biography from My Account. For every role, an envelope with a number on the
header's My account button shows when something is waiting for them.

An **administrator** runs the guild rather than taking part in it. They verify
completed quests, cancel any quest, answer enquiries and correct a member's
role. They cannot post quests, accept them, hire anyone or buy from the shop;
the routes refuse it, and database triggers refuse it again underneath.


## Layout

```
server.js         the Express server: sessions, guards, authentication, views
create.js         the database schema, one CREATE TABLE per table
seed.js           loads seed-data.js into an empty database
seed-data.js      the seed content itself
display.js        prints a table's contents to the terminal
routes/           the API, one file per area of the site
tools/            builds the screenshots PDF and the code listing PDF
public/           pages, stylesheet, client scripts and images
views/            pages that require a login, served by the server rather than
                  as static files
```

`routes/rules.js` holds the few lifecycle rules that more than one route file
needs, so they cannot drift apart.


## Looking at the database

```
node display.js              a summary of every table
node display.js quests       one table in full
node display.js quests 5     one table, the first five rows
```

The table names it accepts are `users`, `adventurers`, `quests`, `items`,
`enquiries`, `orders`, `gear`, `saved` and `news`. It can be run while the
server is running.


## Making the submission PDFs

The screenshots PDF and the code listing PDF are generated, not assembled by
hand. Both need Python with a few packages, installed once:

```
pip install reportlab pillow pygments
```

Then, from the project root:

```
python tools/make-screenshots-pdf.py "path/to/screenshots folder"
python tools/make-code-listing.py
```

The author line on each PDF's title page comes from the `PDF_AUTHOR`
environment variable, so no name or student ID is kept in the repository:

```
PDF_AUTHOR="Your Name, student ID 123456789" python tools/make-code-listing.py
```

They write `screenshots.pdf` and `code-listing.pdf` to the project root, which
are not kept in version control. Each takes an output name as a second
argument instead.

What goes in them is set by two text files, so changing a PDF means editing
one of these rather than the scripts:

- `tools/screenshots.txt`: the sections, the order of the screenshots, and
  every caption. A screenshot in the folder that is not listed is still
  included, under "Not yet placed", so nothing is dropped by accident.
- `tools/listing.txt`: a line describing each file, which files are new or
  changed in Part 3, which are left out as unchanged, and the "Where to find
  it" table at the front. That table finds each line number by searching the
  file, so it stays right when the code moves; anything it cannot find is
  reported when the script runs.


## Auto-Party: how it works, and how to build something like it

Auto-Party is the feature proposed in Task 7.3HD and built in Task 10.3HD. A
customer ticks "Use Auto-Party" when posting a quest, and instead of waiting
for someone to accept it from the board, the guild offers it to suitable
adventurers one at a time until one accepts. This section is for a developer
who wants to understand it or build the same pattern elsewhere. The engine is
`routes/auto-party.js`, and its header lists every other file the feature
touches.

### The idea in one paragraph

Matching is a queue of offers, not a search result. The server picks the best
candidate, offers the quest to them alone with a 60-second deadline, and waits.
Accept ends the search. Decline, timeout, or the candidate becoming unavailable
moves on to the next candidate. If nobody is left, the quest is marked
unmatched and the customer can retry. The adventurer always makes the final
choice; Auto-Party proposes a match and never commits one for them.

### The pieces

1. **Opt-in and preferences (data).** Adventurers opt in
   (`adventurer_profiles.auto_party_opt_in`) and choose quest types
   (`adventurer_quest_preferences`, one row per type). Customers opt in per
   quest (`quests.auto_party_enabled`). Opting in is deliberate on both
   sides, so everyone starts switched off.
2. **The matching query.** `selectCandidate` filters by four things: opted
   in, `availability = 'available'`, wants this quest type, and rank at or
   above the quest's. It then sorts by rank closest to the quest's, so senior
   adventurers are not spent on easy work, and breaks ties by
   `available_since`, so whoever has waited longest goes first. Anyone already
   offered this quest is excluded.
3. **The offer record.** Every offer is a row in `match_offers` with a status
   (`pending`, `accepted`, `declined`, `expired`, `voided`) and the time it was
   made. The deadline is `offered_at` plus 60 seconds, enforced on the server
   when an accept arrives. The countdown in the browser is only a display.
4. **The cascade.** `advanceCascade(questId)` is the one function that moves
   a search forward. Every trigger calls it: posting, declining, an offer
   expiring, an offer being voided, and a retry. Keeping it in one place
   means a fix is made once.
5. **The sweep.** Every 10 seconds the server expires pending offers past
   their deadline and advances those cascades. One interval is simpler and
   survives restarts better than a timer per offer.
6. **Live push.** Each logged-in browser opens one Server-Sent Events
   connection (`GET /api/events`). The server writes offers and outcomes down
   it the moment they happen, so nothing polls. SSE was chosen over WebSockets
   because messages only flow one way, from server to browser; answers go
   back as ordinary POST requests.
7. **Catch-up.** A notice only reaches a connected browser, so anything
   missed while away (an offer that expired, a search that ran out) is
   recorded and shown on My Account at the next visit (`GET /api/catch-up`).
8. **Interface and accessibility.** `public/js/auto-party.js` draws each
   notice as a banner in a stack. The offer banner has Accept, Decline and a
   countdown. Offers are announced through an assertive live region and
   everything else through a polite one, so screen reader users hear them.
   Every confirmation uses one accessible dialogue (`confirmDialog` in
   `main.js`): focus moves into it, Tab is trapped, Escape cancels, and focus
   returns afterwards.

### Building the same pattern elsewhere

The pattern fits anything where one party's request should be offered to one
suitable person at a time: shift cover, tutoring requests, delivery jobs.

1. Add the opt-in columns and a preferences table. Default opt-in to off.
2. Add an offers table with a status, a timestamp and a unique pair of
   (request, person), so the same person is never offered the same request
   twice in one search.
3. Write the candidate query and test it on its own with seeded data before
   anything else. Most of the behaviour lives here.
4. Write one `advance` function that offers to the next candidate or marks
   the request unmatched, and call it from every trigger.
5. Enforce the deadline on the server when an answer arrives, and add a
   sweep for offers nobody answered.
6. Wrap every multi-row change (accepting an offer marks the offer, the
   quest and the adventurer) in a transaction, and put the condition each
   write depends on in its `WHERE`, checking how many rows changed. That is
   what stops two people accepting the same quest.
7. Only then add SSE and the banners. The feature should already work with
   plain requests and a page refresh; live push makes it immediate.

### Trying it

1. Delete `guild.db` and start the server, so the seed data is fresh.
2. In three separate browsers or private windows, log in as the customer
   `anwen.fisk@saltmarsh.com` and two available adventurers of different
   ranks, for example `tamsin.vale@oceaniaguild.com` (Bronze) and
   `nell.yarrow@oceaniaguild.com` (Silver). The password is `guild12345`.
   Adventurers who are already on a quest, such as Kazuma Sato, are not
   offered anything until it ends.
3. As each adventurer, open My Account, switch Auto-Party on and tick
   Combat.
4. As the customer, post a Combat quest at Bronze with "Use Auto-Party"
   ticked. The Bronze adventurer, whose rank is closest, gets the offer
   within a second. Decline it, and the Silver adventurer gets it next. Let
   an offer run out, and it moves on by itself within about 10 seconds.
5. Set an adventurer unavailable from the Availability panel, and they are
   no longer offered anything.


## Known limitations

These are deliberate, and are recorded here rather than left to be discovered.

- The guild shop, the news pages and checkout still render from hardcoded
  content. The `items`, `news`, `orders` and `order_items` tables exist and are
  seeded, and the customer account page already reads real order history, but
  the pages themselves were left for after the portfolio submission.
- Sessions are held in memory, so everyone is logged out when the server
  restarts. `SESSION_SECRET` falls back to a development value when the
  environment variable is not set, and the server refuses to start in
  production without it.
- There is no rate limiting on the login or enquiry forms, and no CSRF token
  beyond the session cookie's `SameSite` setting.
- Several images are placeholders drawn as SVG rather than artwork.
- `saved_quests` is in the schema and no page uses it yet. `is_active` is
  honoured by the session check but nothing sets it.
- Gear is stored and shown on the adventurer's account and profile, but there
  is no way to change the loadout from the site yet.
- Auto-Party holds its live connections in one Node process's memory, which
  is right for one server and would need a shared message channel for more
  than one.
