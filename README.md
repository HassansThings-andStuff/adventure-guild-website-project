# Oceania Adventure Guild

A website for a fictional adventurers' guild: customers post quests, adventurers
accept them, and the guild brokers the arrangement. Built for SIT774 Web
Technologies and Development at Deakin University by Hassan Mohamed
(student ID 226283244).

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
guild1234
```

| Role          | Email                             |
| ------------- | --------------------------------- |
| Administrator | `guildmaster@oceaniaguild.com`    |
| Customer      | `anwen.fisk@saltmarsh.com`        |
| Adventurer    | `elara.thornwood@oceaniaguild.com` |

The seed creates 30 accounts in total: 20 adventurers, 8 customers and 2
administrators.

Note that `guild1234` is nine characters, while registration requires ten. The
seeded accounts predate that rule and are demonstration data, so they are left
as they are; an account created through the registration form will need a
longer password.


## What each role can do

A **customer** posts quests, saves drafts, edits and cancels them, hires an
adventurer directly, confirms that work has been done, and buys from the guild
shop.

An **adventurer** browses the quest board, accepts one quest at a time, marks
work as done, and keeps a public profile on the register. Auto-Party is opt in
from their account page.

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
- The Sort by box on the Quest Board and the Adventurers page starts blank
  when the address names no sort. Sorting works; only the box's first value is
  wrong. It is fixed in the next stage.
