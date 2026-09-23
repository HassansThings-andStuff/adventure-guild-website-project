# Development Log

Oceania Adventure Guild — SIT774 Website Project, Part 3 (Task 10.2D)
and the Awesome Feature implementation (Task 10.3HD).

Newest entries first. Each entry records what was built, what was
decided and why, and anything that broke along the way.

---

## 20 September 2026 — Enquiry inbox, role correction and sessions that follow the account

**Built**

- `routes/admin.js`: the enquiry inbox (`GET /api/admin/enquiries` with status
  filter, search, order and paging, and `PATCH /api/admin/enquiries/:id` to set
  the status and keep notes), and the member list (`GET /api/admin/users`) with
  `PATCH /api/admin/users/:id/role` to correct a role.
- The administration page is now three sections under one row of links: Quests
  in progress, Enquiry inbox (with a badge of how many are new) and Role
  correction. The two new ones are `admin-enquiries.js` and `admin-roles.js`.
- Administrators no longer see the header cart link or any Add to cart button.
  `main.js` puts `is-admin` on the page and one rule in the stylesheet hides
  both, including buttons drawn later when the shop becomes database driven.
- `server.js` now checks the account behind every session on every request that
  carries one.

**Decisions**

- **A session must not outlive a role change.** A session remembers the role
  from login, so an adventurer demoted to customer would have kept an
  adventurer's powers for up to two hours. Every request with a session now
  looks the account up by primary key. A changed role or name is carried into
  the session at once, and an account that is gone or switched off is logged
  out. Static files are served above it and pay nothing. The alternative, finding
  and destroying the affected member's sessions, cannot be done with the
  in-memory session store, which cannot list sessions by member. This also makes
  `is_active` mean something, though nothing sets it yet.
- **Role correction fixes a mistake at registration. It does not rewrite
  history.** A customer can become an adventurer (the guild chooses a class,
  rank starts at bronze, as registration does) only if they have no unfinished
  quests, because an adventurer cannot manage quests posted as a customer. An
  adventurer can become a customer only if nothing points at their profile:
  no accepted quests, hire requests, gear or saved quests. Otherwise the change
  is refused and the reason is given, such as "1 quest accepted, 3 items of
  gear". Two alternatives were rejected: erasing that history, and keeping the
  profile on a customer, who would then still appear on the register.
- **Administrator roles are not changed from here,** in either direction. That
  also stops the guild locking itself out. Making an administrator is a
  database job.
- **Both changes are all or nothing.** The profile and the role are one
  transaction. I made the second write fail on purpose and checked that the
  profile just written was undone.
- **Enquiries are closed, never deleted.** They are the guild's correspondence
  record. There is a status and a notes field and no delete.
- **Saving an enquiry sends the update time it was opened at.** If it has changed
  since, by another administrator, nothing is written, the current version is
  shown, and they are told. The limit is that `updated_at` has one second
  resolution, so two saves inside the same second would not be told apart.
- **The `ORDER BY` still comes from a fixed table and `LIKE` wildcards are
  escaped,** as on the quest board, so a search for `100%` looks for those
  characters.

**Found while testing**

Every seeded customer has at least one unfinished quest, so role correction
cannot be shown on a seeded customer, and correctly refuses. The tests register
new customers through the real form, which is also what a real mistake looks like.
To demonstrate it for the screenshots, register a customer, then correct them.

**Tested**

- 64 checks of the routes: who may use them, filtering, searching, paging and
  hostile input, every rule for changing a role, the forced failure, and a live
  session following a role change and a switched off account. 45 checks with a
  simulated browser (jsdom, not real Chrome): the inbox, the member list, hostile
  text, and the shop boundary for an administrator, a customer and a stranger.
  With the earlier suites, 522 checks across 10 pass.

**Not built**

There is no way to switch an account off, no reply from the site (the inbox
links to the sender's email address), and no promotion to administrator.

---

## 20 September 2026 — Accepting quests and the completion chain

**Built**

- `routes/lifecycle.js`: `POST /api/quests/:id/accept`, `/done` and `/confirm`,
  and for the guild `GET /api/admin/quests/matched`, `POST /api/admin/quests/:id/verify`
  and `/cancel`. `routes/rules.js` holds what more than one route needs: where a
  matched quest has got to, handing an adventurer back to the board, and running
  several writes as one.
- The quest page's action panel is now real. The server works out what the
  person looking may do (`viewer` in the quest reply) and the page draws it: an
  enabled Accept, "You are already on a quest", Mark as done, Confirm completion,
  and Verify and Cancel for the guild. The server checks again when a button is
  pressed.
- The adventurer's My Account page is real data, as the customer's now is:
  profile, gear, hire requests (with Accept), and My Quests (with Mark as done).
  The customer's page shows how far each quest has got, and adds Confirm
  completion. The administration page has a Quests in progress panel with
  Verify and Cancel.

**Decisions**

- **The double-booking rule is enforced in the write, not only in the checks
  before it.** The `UPDATE` that takes a quest states that it is still open, is
  not Auto-Party, and is for anyone or for this adventurer. The one that puts the
  adventurer on the quest states they were not already on one. Accepting
  overrides "unavailable" and clears the date, as decided on 18 September.
- **Accepting is all or nothing.** The quest and the adventurer are written in
  one transaction. To prove it I made the second write fail on purpose, and the
  quest was left open with nobody on it. Without that a quest could say matched
  while the adventurer said available, which is the double booking again.
- **The sign-offs are in order, and the routes enforce it.** The adventurer marks
  it done, then the customer confirms, then the guild verifies, and only the
  last makes it completed. Confirming or verifying early is refused with the
  reason. On a quest the guild posted itself, the one Verify records the
  confirmation too, as decided earlier, and the guild's list shows it ready at
  once.
- **Rank stays advisory when accepting from the board.** No check is made,
  matching the 7.3HD rule recorded on 18 September.
- **Progress and who holds a quest are sent only to the people concerned:** the
  poster, the adventurer who holds it, and the guild. Everyone else sees only
  that it has been taken.
- **A hire is answered by accepting it.** A hired quest is invisible to
  everyone but the poster and the adventurer hired, and only that adventurer can
  accept it.

**Provisional, to confirm.** Nothing in the recorded design settled these, so I
chose the smaller change in each case. Each is one condition to alter.

- **An adventurer is handed back on completion or cancellation, not when they
  mark it done.** The quest is still matched until the guild signs it off, so
  the adventurer is still on it. The way out for a customer who never confirms
  is the guild's cancel. The alternative lets an adventurer take new work
  while the last quest is unverified.
- **A customer can cancel an accepted quest until the adventurer marks it done.**
  After that the work has been done, so the customer confirms it or the guild
  deals with it. Cancelling releases the adventurer.
- **There is no Decline for a hire.** The design has three ways into acceptance
  and none of them declines. A customer can cancel a hire request. Whether the
  hired adventurer needs a Decline is an open question.

**Found in the seed**

Kazuma, Bram and Sana each held a matched quest but were listed as available,
which contradicts the double-booking rule. All three are now `on_quest`. They
read "On a quest" on the register, and the adventurers test that expected Kazuma
to be available was changed to say so. Dorin was already correct.

**Changed on the way**

Six older checks encoded behaviour that is now different on purpose: Accept was
switched off, an administrator had no buttons at all (there is now Cancel), a
customer could not cancel an accepted quest, and an adventurer had no account
data. They were rewritten to state the new behaviour, and one new check covers
Kazuma as the adventurer who cannot accept.

**Tested**

- 70 checks of the routes directly, including who may act, the order of the
  sign-offs, the forced failure, and every change setting `updated_at`. 49 checks
  with a simulated browser (jsdom, not real Chrome) of the quest page, both
  account pages and the administration page, including "someone else got there
  first" and hostile text. With the earlier suites, 413 checks across 8 pass.
  61 internal links and files resolve on 19 pages, and every page still parses.

**Status**

Notifications are still only what each account page shows. There is no
`notifications` table, by the 7.3HD design, so a poster sees that a quest has
been accepted or done when they next open their account.

---

## 20 September 2026 — Enquiry form, Post a Quest and the customer account write to the database

**Built**

- `routes/enquiries.js`: `POST /api/enquiries`. A guest or a logged in member may
  send one. A guest's enquiry is stored with no account, a member's is tied to
  theirs, and the id comes back as a reference the sender can quote.
- `routes/quests-write.js`: `POST /api/quests` writes a draft or a published
  quest, `PUT /api/quests/:id` changes one and publishes or unpublishes it, and
  `DELETE /api/quests/:id` removes a draft or cancels a published quest.
- `routes/account.js`: `GET /api/my/account` returns the logged in customer's
  profile, their quests with what may be done to each, and their orders.
- `contact.js` and `post-quest.js` now send to those routes. `account-customer.js`
  is new, and `my-account-customer.html` is a shell it fills. The page no longer
  shows a made up customer.

**Decisions**

- **A draft needs only a title, so the schema had to say so.** `quests.quest_type`
  was `NOT NULL`, which meant a half finished draft could not be stored. It is
  now nullable, with a table `CHECK` that a quest which is not a draft must have
  a type, a description, a location and a reward. The database states the rule
  as well as the route. Two alternatives were rejected: a placeholder type for
  drafts, which would make an unfinished quest read as a retrieval quest, and
  requiring a type on every draft, which would quietly change the earlier
  decision that a draft needs only a title.
- **The cost is a rebuild.** `CREATE TABLE IF NOT EXISTS` leaves an existing table
  as it was, so a database made before this change still insists on a type. The
  server checks for that on start and prints how to rebuild it, rather than
  failing later on a draft.
- **One address, two operations.** `DELETE` deletes a draft nobody has seen and
  cancels a quest that has been on the board, so its record stays. It is one
  button on the page, as the lifecycle diagram noted. Cancelling a quest an
  adventurer has accepted is refused for now with a message to contact the
  guild, because the adventurer has to be released too, and that belongs to the
  accept step.
- **Someone else's quest is "not found", not "forbidden".** The routes cannot be
  used to find out which quests exist. The same applies to the page.
- **A write cannot overwrite a quest that has moved on.** Each `UPDATE` and
  `DELETE` repeats the status it expects in its `WHERE`, and the route checks
  how many rows changed. A quest accepted between the check and the write is
  refused with a message, not silently overwritten.
- **Who is hired is fixed when the quest is written.** `PUT` ignores a hire. The
  detail route sends the hired adventurer's name to the poster only.
- **Auto-Party is switched off for now.** The checkbox is disabled and the server
  refuses it. A quest flagged for Auto-Party has no manual Accept, and the
  cascade that would offer it to people does not exist yet, so it would sit on
  the board with nobody able to take it. It comes on with 10.3HD.
- **Confirmation uses the browser's own dialog,** for publishing a quest for the
  first time, returning one to draft, and deleting or cancelling. Validation
  errors still go beside the field and never into a popup. The native dialog
  needs no dependency and can be tested. A styled modal is possible polish.
- **After the first save the page becomes an edit of that quest.** The address
  changes to `?id=`, so a second press of Save updates the quest and a reload
  opens it, instead of writing a duplicate.
- **The Confirm completion column is out of My Posted Quests for now.** It comes
  back with the completion chain. The table shows Edit, Delete and Cancel
  according to what the server says each quest allows.
- **Admin boundaries:** administrators are refused by every one of these routes
  (403), and on the contact page a note replaces the form.

**Changed on the way**

- The adventurers test asserted that Auto-Party was left available on an
  ordinary quest. It is now off for every quest until it is built, so the check
  was changed to say that. This was a deliberate change to the behaviour, not a
  failing test being made to pass.

**Tested**

- 52 checks of the routes directly: who may write, both bars, hiring, editing,
  deleting, and the account reply. 64 checks with a simulated browser (jsdom,
  not real Chrome): the enquiry form, publishing, drafts, editing, removing,
  hiring, the account page and hostile text. The earlier suites still pass
  (30, 18, 64 and 65 checks). 63 distinct links and files on 19 pages resolve.
  The one 403 is the customers only Post a Quest page, checked as an administrator.

**Status**

Enquiries are stored but there is no inbox yet. Auto-Party and cancelling an
accepted quest are held back on purpose.

---

## 20 September 2026 — Quest board, adventurers register and the hire control

**Built**

- `routes/quests.js` and `routes/adventurers.js` read from the database. The
  quest board, quest detail, adventurers register and adventurer profile are
  shells filled from `/api`, with search, filters, sorting and paging done as
  queries.
- Filters and sorting are validated against fixed lists. The `ORDER BY` comes
  from a lookup table and never from the request, and a search is escaped for
  `LIKE`, so a `%` or a `_` is searched for as itself.
- `routes/images.js` lists `public/images/` at start and uses a default when a
  seeded image is not on disk. Fifteen item paths and seven quest paths in
  `seed-data.js` were corrected to match files that exist.
- Three database triggers: a hire may only be written by a customer (on insert
  and on update of `quests`), and an administrator cannot place an order.

**Decisions**

- **Board visibility is one rule:** open or matched, and not addressed to a
  particular adventurer. A hired quest stays off the board. A draft is visible
  to its poster only. Completed, cancelled and hired quests are visible to the
  poster, the adventurer concerned and an administrator. Everyone else gets
  "not found".
- **Locations, specialties and regions come from the data,** never from a list
  in the page, so the drop-downs cannot drift from what is stored.
- **The reward filter compares numbers.** `reward` is text such as `1,200 gold`,
  so the query strips the commas and casts it. Nothing extra is stored.
- **Quests completed is dropped** from the adventurer profile, and so is the
  weekly availability table (a three value status replaces it). A count derived
  from the seed would have been misleading, with three completed quests.
- **The Hire control depends on who is looking.** A customer gets a real link to
  Post a Quest. A stranger is sent to log in. An adventurer is told adventurers
  cannot hire adventurers, and on their own entry is told so. An administrator
  is told administrators do not hire. `isSelf` comes from the server.
- **A profile's quest history lists titles, not links,** because a completed
  quest's page is private.
- **Hiring and Auto-Party are separate ways of finding an adventurer.** Opening
  Post a Quest to hire someone switches Auto-Party off.
- **Default artwork is drawn as code.** The 12 placeholder pictures (quest
  types, adventurer classes, items) are SVG files made by Claude in the site's
  colours. They are placeholders and not artwork. Real images dropped into
  `public/images/` under the names the seed already uses replace them without
  any change to the code.

**Tested**

- Quest board and detail 64 checks, adventurers register, profile, hire and
  Post a Quest 65 checks, with a simulated browser. Injection tests (SQL,
  `LIKE` wildcards, script in text) were all safe.

---

## 20 September 2026 — Admin boundaries

**Raised**

While testing the protected pages I noticed a gap. Admin has full control of
the site, but should never act as a user of it: no buying, no hiring, no accepting
quests, so the guild account never appears in the database as a party to a
transaction.

**What the schema already does, and does not, enforce**

- `accepted_by`, `targeted_adventurer_id`, `adventurer_gear` and
  `saved_quests` all point at `adventurer_profiles`, and an admin has no
  profile. The database already refuses an admin accepting a quest, being
  hired, holding gear or saving a quest.
- `orders.user_id` and `quests.posted_by` point at `users`, so the database
  would accept an admin buyer, or an admin posting or hiring. These need a
  rule of their own.
- The first-pass permission matrix had admin as "yes" on Place order. That was
  the real gap. Hiring is a targeted quest, so it sits under posting, where
  admin was already "no".

**Decisions**

- **Admin cannot** buy, add to cart, hire, accept, mark done, confirm
  completion as a customer, save quests, hold a profile, gear or Auto-Party
  settings, or submit an enquiry (admin has the inbox instead).
- **Admin can** browse, run the enquiry inbox, verify completion, cancel any
  quest and change roles.
- **Three layers, not one.** Route guards are the real control. A trigger on
  `orders` will make the database itself refuse an admin buyer, in keeping with
  the principle in `create.js` that the database refuses states the site
  considers nonsense. The interface hides Cart, Add to cart, Accept and Hire
  for admin, because every public page is shared between roles.
- **Official quests stay as seed data.** The seed holds 9 quests posted by the
  guild account: 7 open, 1 matched and 1 unmatched with Auto-Party on. The
  18 September rule stands, so they are identified by their poster with no
  separate flag. The seeded Auto-Party row is left alone, since the cascade
  works on any quest whoever posted it.
- **The guild is both poster and verifier on its own quests,** so the
  completion chain needs one rule. On an official quest the admin's single
  Verify action sets `poster_confirmed` and `admin_verified` together. The
  guild acts as an institution there, not as a customer. This is the one
  exception to admin not confirming completion.
- **Admin posting deferred.** Reusing the Post a Quest page for admin is small
  once the customer write path exists (a role check on the route and API, a
  page variation, and a list of official quests on the admin page) and
  expensive before it. To revisit after Post a Quest writes to the database.
- **A privileges flag or permissions table rejected.** `users.role` is already
  the privilege system, and one exception is simpler as a role rule in code
  than as data. It would also reopen the "no separate flag" decision.

**Status**

Recorded, not built. None of the routes it guards exist yet, so each guard is
added as its route is built.

**Update, later on 20 September**

Partly built. The hire and administrator buyer rules are triggers in
`create.js`. The quest, enquiry and account routes each refuse an administrator,
the adventurers page tells an administrator they do not hire, and the contact
page shows a note in place of the form. Still to do: Cart and Add to cart for
administrators, and the official quest completion rule.

**Update, after the completion chain**

The official quest completion rule is built: the guild's one Verify on a quest
the guild posted sets both the confirmation and the verification. The guild can
cancel any unfinished quest, which releases the adventurer on it. The guild does
not accept, mark done or confirm, and every route for those refuses it. Still to
do: Cart and Add to cart for administrators.

**Update, after the inbox**

Cart and Add to cart are hidden for administrators. The boundary is now complete
except for the checkout route, which will refuse an administrator when it is
built. The database trigger on `orders` is already in place.

---

## 20 September 2026 — Protected pages, role guards and header login state

**Built**

- `views/` beside `public/`, holding the pages that must not be reachable
  without passing a route: `my-account-adventurer.html`,
  `my-account-customer.html` and `post-quest.html` (moved out of `public/`),
  plus new `admin.html`, `forbidden.html`, `not-found.html` and `error.html`.
- Guarded routes in `server.js`: `/my-account` (any logged in role, sends each
  role its own view, and admins on to `/admin`), `/post-quest` (customers only)
  and `/admin` (admins only).
- One function, `deny()`, decides what a refusal looks like. Requests under
  `/api/` get JSON. Everything else gets a page: a stranger is redirected to the
  login page (401) and a logged in person with the wrong role gets the access
  denied page (403).
- A 404 handler, and an error handler that logs the real error and shows the
  visitor only a generic page or message.
- Header account controls in `main.js`. On every page the Login button is
  replaced by "Signed in as", My account and Log out once the server says
  someone is logged in.
- The "Draft page control" notices are gone from the account pages and Post a
  Quest. The customer account's Post a quest button is now a working link, and
  the login redirect goes to one address, `/my-account`.

**Decisions**

- **One address for everyone's account.** The server picks the view by role.
  Merging the two views into one data driven page is still outstanding.
- **The response is chosen by address, not by headers.** `/api/` means JSON and
  anything else means a page. That is simple to state and to test.
- **The error pages use root-absolute links.** They can be sent for any
  address, however deep, and a relative path would resolve against the address
  that failed, so the page would arrive without its stylesheet.
- **Views are sent with `Cache-Control: no-store`,** so the Back button after
  logging out cannot bring a protected page back from the browser cache.
- **Faults caused by the request are answered plainly** (400 for JSON that will
  not parse, 413 for a body over the size limit) and are not logged as server
  errors. A malformed address is treated as not found.
- **The name in the header is written with `textContent`.** It is text a member
  typed at registration, so it is never inserted as markup.
- **A logout that fails says so** rather than pretending the visitor is logged
  out.

**Problems and fixes**

- Until this stage an unexpected server error returned Express's default error
  page, which includes a stack trace and file paths. It surfaced when a
  registration was forced to fail on its second insert during testing. The
  error handler fixes it, and a forced error in a scratch copy confirmed the
  response held no internals while the log kept them.
- `/my-account/post-quest` returned a 404 when I tried it as an adventurer. The
  page lives at `/post-quest`, so the 404 was correct. It also showed that the
  header keeps the logged in state on an error page.

**Verified**

- Scripted checks, run against a working copy of the repository: every role
  against every guarded page gave the expected result. A stranger is redirected
  to the login page each time, and the wrong role gets the access denied page.
  The same guards on API routes answer in JSON (401, 403, 200).
- The old addresses (`/my-account.html`, `/my-account-customer.html`,
  `/post-quest.html`), `/views/...`, `/server.js`, `/create.js`, `/guild.db` and
  a path traversal attempt all return 404.
- 439 links across every page were checked and none are broken. The new and
  moved pages parse strictly as HTML, with no duplicate ids.
- 48 scripted checks in a simulated browser (jsdom) pass: 18 for the header
  controls in each state, including a hostile display name shown as text, plus
  the 30 login and register checks re-run after `auth.js` changed. jsdom is not
  a real browser, so the visual side was checked by hand in Chrome: a customer
  reaches Post a Quest, an admin reaches `/admin`, `/my-account.html` is a 404,
  and the console shows no errors.

**Evidence captured**

- Before: login and register page with the Part 2 success message and draft
  note; `my-account.html` open to a logged out visitor; the users table at 30
  rows; the guild shop showing 9 items; the server log of a home, quests,
  adventurers and shop visit with no `/api` requests.
- After: the class field; the duplicate email error; the adventurer success
  message; the `oag.sid` cookie (HttpOnly, SameSite Lax); customer Post a Quest;
  the admin page; the 404 at `/my-account.html` with its server log line; the
  404 while signed in at `/my-account/post-quest`.
- Still to take: the access denied page (an adventurer at `/post-quest`), the
  users and adventurers tables after registration, and the login failure
  message.

---

## 20 September 2026 — Login and register wired to the server

**Built**

- `login-register.html`: a Class dropdown that appears only when Adventurer is
  chosen, a general error region for failures that belong to no single field,
  and `role="alert"` on the login error so screen readers announce it.
- `auth.js`: a valid form is sent to `/api/login` or `/api/register` as JSON.
  Server refusals appear beside the field they belong to, matched by field
  name. Buttons are disabled while a request is out, and an unreachable server
  or a reply that is not JSON produces a friendly message.

**Decisions**

- **The browser checks stay, and the server repeats every one,** because a
  request can be sent without using the form at all.
- **The confirm password box is never sent.** It is a typing check for the
  person and means nothing to the server. The password itself is sent exactly
  as typed, since trimming it would change what the member chose.
- **The class is asked of adventurers only,** and is ignored for customers
  rather than rejected.
- **No auto-login after registering.** The member is told to log in, which
  proves the credentials they chose work. This is the same choice as 10.1P.

**Problems and fixes**

- The Part 2 success message said a confirmation email had been sent and that
  accounts become active in Part 3. No email is sent, so it now reads "Your
  account has been created. You can now log in with ...". The "Draft page
  note" beside the login form was removed, and the password reset note reworded
  because reset does not exist.
- The registration form had no class field, although
  `adventurer_profiles.class` is NOT NULL. The field is added.

**Verified**

- By hand in Chrome: an adventurer registration, a duplicate email caught with
  different capitals, the success message, and the session cookie with HttpOnly
  and SameSite Lax and no console errors.
- 30 scripted checks in a simulated browser, run against a working copy, pass.
  They cover empty forms, a
  wrong password, a duplicate email, a server only rule (a 100 character name
  passes the browser and is refused by the server), the class field showing and
  hiding, an unreachable server, an HTML 500 reply, and the rows landing in the
  database.

---

## 20 September 2026 — Application server rebuilt

**Problem found first**

The 18 September entry lists `server.js` as rebuilt into the application
server. The file on GitHub, and the one on my machine, were byte for byte the
10.1P server: username login, admin and member roles only, its own
`database.db` and a hardcoded session secret. The rebuilt version had never
been copied out of the working session into the project folder. Everything else
in the repository matched this log, including the data layer, which reproduced
the same row counts.

It was rebuilt fresh in the repository, in stages, rather than pasted in as
roughly 400 lines that had not been read. The old file stays in git history.

**Note to self**

Check the pushed copy against the notes, not the notes against memory.

**Built**

`server.js`, about 630 lines once the guarded pages were added, in this order:

- Configuration, database, middleware and sessions.
- Authorisation middleware: `requireLogin`, `requireRole(...roles)` and the
  shortcuts `requireAdmin`, `requireCustomer` and `requireAdventurer`.
- Authentication routes: `/api/register`, `/api/login`, `/api/logout` and
  `/api/me`.

**Decisions**

- **One definition of the schema and one database path.** The server imports
  `createTables`, `DB_PATH` and `seedDatabase` instead of repeating them, and
  runs both on every start. Both are safe to repeat, so a fresh clone runs
  without the scripts being run first.
- **The foreign key pragma is set again on the server's own connection.** It
  belongs to the connection, not the file, so the one `create.js` used does not
  carry over.
- **The session secret comes from the environment.** A fixed fallback keeps
  local development easy, and the server refuses to start in production
  without a real one.
- **Static files are served before the session,** so an image never costs a
  session lookup. The consequence is that anything in `public/` is reachable by
  anyone, which is why protected pages live in `views/`.
- **Session cookie:** `httpOnly`, `sameSite: 'lax'`, `secure` in production, two
  hours, named `oag.sid`. `saveUninitialized` is false, so a visitor who never
  logs in never receives a cookie.
- **Each authorisation check looks for the session itself** rather than trusting
  that `requireLogin` ran first. 401 means the person is unknown and 403 means
  they are known and refused.
- **Registration repeats every browser check,** with each value type checked
  first because Express 5 leaves `req.body` undefined when no JSON arrives.
  Admin is not a role a visitor can choose. Passwords over 72 bytes are refused,
  since bcrypt would silently cut them off.
- **Emails are stored and compared in lower case,** so two capitalisations
  cannot become two accounts.
- **Uniqueness is left to the database.** A duplicate email is caught as a
  UNIQUE violation and answered with 409, not by looking first and inserting
  after, which two requests could both pass.
- **An adventurer is two rows written in one transaction.** Either both exist or
  neither does. The password is hashed before the transaction opens so the
  transaction stays short. New adventurers start at bronze.
- **Login gives one message for every kind of failure,** and compares against a
  real dummy hash when no account matches, so a missing account takes about as
  long as a wrong password. A deactivated account is refused the same way.
- **The session is regenerated on login,** so a session id planted beforehand
  stops meaning anything. It holds four fields: id, email, role and display
  name.
- **`/api/me` returns 200 with `user: null` for a stranger,** not 401, so the
  browser console stays free of errors on every page a visitor opens. It is
  sent with `no-store`.

**Known limits, recorded rather than fixed**

- No rate limiting or lockout on login. The bcrypt cost slows guessing but does
  not stop it.
- Sessions live in server memory, so a restart logs everyone out, and
  express-session warns that the memory store is not for production.
- Registration reveals whether an email is already taken. Avoiding that needs
  email sending, which is out of scope.

**Verified**

- Scripted requests, run against a working copy of the repository.
  Registration: an empty body, an admin role, objects where strings belong, a
  73 byte password, a duplicate email in different capitals and an adventurer
  with no class were all refused with the right message. A valid customer and a
  valid adventurer were stored correctly (lower case email, hashed password,
  charter recorded, rank bronze).
- Login: a wrong password and an unknown email give the identical message and
  took about the same time (roughly 63 ms against 66 ms). The cookie carries
  HttpOnly and SameSite Lax with a two hour expiry. Logging in a second time
  issues a new session id and the old cookie no longer identifies anyone, logout
  ends the session on the server, the seeded accounts log in, and a deactivated
  account is refused.
- Transaction: with a trigger forcing the second insert to fail, registering an
  adventurer returned a 500 and left no user row behind, and the same email then
  registered cleanly.
- On my machine: `curl` login, who-am-I and logout returned the expected replies
  and the server logged three 200s.

---

## 18 September 2026 — Repository and environment

**Built**

- Project put under version control and pushed to GitHub at
  `HassansThings-andStuff/adventure-guild-website-project`.
- `express-session` and `bcrypt` added as dependencies.

**Problems and fixes**

- The project folder was a copy of the unit's server template, so it
  already contained a `.git` directory pointing at Deakin's
  repository. `git init` reported "reinitialized" rather than
  creating anything. Fixed by removing the remote with
  `git remote remove origin` and adding my own.
- The two template commits were kept rather than wiping the history.
  They are honest provenance: the project did start from the unit
  template, and GitHub lists the template's author as a second
  contributor as a result.
- First push was rejected with `GH007`: my GitHub account has email
  privacy enabled, but git was configured with my real address, so
  the commits would have published it. Fixed by setting
  `user.email` to the GitHub no-reply address and rewriting the
  commit with `git commit --amend --reset-author`.
- Authentication over HTTPS needed a personal access token rather
  than an account password, which GitHub stopped accepting in 2021.
  Terminal password prompts display nothing while typing, which
  initially looked like a frozen prompt.
- `bcrypt`'s native build script was blocked by npm's newer default,
  producing an install warning. The prebuilt binary was used anyway
  and `require('bcrypt')` succeeded, so no rebuild was needed.
- Two moderate npm advisories reported. Left unaddressed
  deliberately: `npm audit fix` can upgrade across major versions,
  and the risk to a local teaching prototype does not justify that.

**Note to self**

`.gitignore` extended to exclude `guild.db` and SQLite's working
files, since the database is generated by `create.js` and `seed.js`
and would otherwise commit password hashes and conflict on every
pull.

---

## 18 September 2026 — Data layer built and verified

**Built**

- `create.js` — ten tables: `users`, `adventurer_profiles`, `quests`,
  `items`, `enquiries`, `orders`, `order_items`, `adventurer_gear`,
  `saved_quests`, `news`. Exports `createTables(db)` and `DB_PATH`.
- `seed-data.js` — all seed content, held apart from the seeding
  logic so that growing the content never touches working code.
- `seed.js` — inserts every record, resolving names to foreign keys.
- `display.js` — reads the database back out, either as a summary
  with distribution breakdowns or one table in full.
- `server.js` — rebuilt from the unit template into the application
  server: sessions, authorisation middleware, registration, login,
  logout, and role-gated page routes.

**Verified**

First execution ran clean. 30 users, 20 adventurers, 24 items,
39 quests, 12 news entries, 8 enquiries, 6 orders, 32 gear rows,
8 saved quests. Re-running `seed.js` reported nothing to seed,
confirming idempotency. Running `display.js` against a deleted
database reported every table as missing rather than throwing.

**Decisions**

- **Names, not ids, in the content file.** `seed-data.js` refers to
  people, items and quests by name; `seed.js` builds lookup maps as
  it inserts and resolves them. A content file full of raw id
  numbers is unreadable and breaks the moment anything is reordered.
  An unresolved name throws an error naming itself rather than
  writing a null foreign key.
- **Completion sign-offs derived, not stated.** The three booleans
  are set from `status` inside `seed.js` rather than listed per
  quest, so the content file cannot record an impossible
  combination such as a completed quest missing its verification.
- **Order totals calculated at seed time** from the line prices, so
  the stored total and the lines can never disagree. Member pricing
  applies where the customer is an adventurer, matching the shop.
- **Seed content sized deliberately.** 24 open quests makes
  pagination a real feature rather than an artificial one. The rank
  spread is bottom-heavy (7 bronze, 8 silver, 5 gold) so rank
  filters narrow meaningfully and Auto-Party's rank-proximity
  ranking has real choices at the tiers where most quests sit.

**Evidence workflow established**

`rm guild.db` → `display.js` (before) → `create.js` → `seed.js` →
`display.js` (after). Repeatable in under a minute, which solves the
usual problem of needing a "before" state after the work is already
done.

---

## 18 September 2026 — Schema decisions

Reconstructed from the 7.3HD planning sessions, then checked against
the submitted 7.3HD report.

**Settled**

- **Login identifier is `email`, UNIQUE.** `display_name` is separate
  and deliberately not unique, so two members may share a name. The
  `username` column inherited from the 10.1P starter was dropped: the
  registration form never collected one.
- **Shared fields on `users`, adventurer-specific fields on
  `adventurer_profiles`.** `bio` and `profile_image` moved up to
  `users`, because the customer account page gives customers both.
  A symmetric `customer_profiles` table was considered and rejected:
  it would have been empty or duplicated columns already on `users`.
- **Foreign key rule.** A column any user can occupy points at
  `users`; a column only an adventurer can occupy points at
  `adventurer_profiles`. `quests` holds both — anyone may post, only
  an adventurer may accept — which encodes a real constraint rather
  than an inconsistency.
- **Six quest statuses** (`draft`, `open`, `matched`, `unmatched`,
  `completed`, `cancelled`) plus three completion booleans. Modelling
  the sign-offs as statuses would have taken six values to nine, most
  existing only to record which flags were true.
- **Danger tier derived, not stored.** Storing both a danger tier and
  a rank requirement would allow two stored facts to contradict each
  other. A display mapping from rank costs nothing and cannot.
- **Official guild quests identified by their poster.** The guild has
  its own admin account, so `posted_by` answers the question and no
  separate flag is needed. Guild quests are not necessarily
  high-risk; the badge reflects who posted it, the rank reflects who
  can take it.
- **Three-value availability.** `available` and `on_quest` are
  system-driven; `unavailable` is set by the adventurer with an
  optional date. Accepting a quest overrides `unavailable`, because
  taking work is the clearest signal of availability. Nothing
  overrides `on_quest` — that is the double-booking rule.
- **Adventurer profiles require a user account** (`user_id NOT NULL`).
  A display-only adventurer could never accept a quest or answer an
  Auto-Party offer, so would be dead weight in the candidate pool.
- **No `feedback` table.** Feedback deferred to guild email
  correspondence, consistent with the site's existing principle that
  arrangements are brokered through the guild.
- **No `notifications` table.** The 7.3HD report settled this:
  boolean seen-flags on `match_offers` and `quests` plus a catch-up
  banner, chosen over a table that would duplicate information
  already held.

**Reversed after checking the report**

- **`rank_match_mode` removed.** I had added a minimum-versus-exact
  mode to the schema and to the Post a Quest page. The submitted
  report has no such thing: rank is advisory on the board and a
  minimum for Auto-Party, one rule rather than two. Keeping it would
  have meant the implementation contradicting a stated mechanic in a
  submitted document.
- **`auto_accept` confirmed out.** Already absent from the report,
  which argues in Step 7 that auto-accepting would diminish the
  adventurer's agency.

**Added after checking the report**

- `quests.outcome_seen` and `users.auto_party_banner_dismissed`, both
  required by the catch-up banner design and both missing from my
  reconstruction.

**Still open**

- Image strategy. Either generate artwork for the new seed content,
  or fall back by category with a handful of generic defaults.
  Parked until the read paths are built.

---

## 18 September 2026 — Quest lifecycle diagram

Drew a state diagram for the quest lifecycle, since the base site had
wireframes and a site map but no process diagram, and four mechanisms
meet at the quest: posting and drafts, three routes into acceptance,
the completion chain, and cancellation.

It surfaced four things:

1. The `matched` to `completed` arrow was hiding three sequential
   sign-offs. This is what settled the status question.
2. Draft and cancelled do not connect. Deleting a draft nobody has
   seen is a real delete; cancelling a published quest is a status
   change. One button, two operations.
3. `unmatched` can only be produced by the Auto-Party route. A
   non-Auto-Party quest nobody takes sits at `open` indefinitely.
4. Board visibility needed stating once:
   `WHERE status IN ('open','matched') AND targeted_adventurer_id IS NULL`.

A full set of swimlanes for the rest of the site was considered and
rejected — most of the site is ordinary reads and writes, where a
diagram would restate what the wireframes already show.

---

## 18 September 2026 — Post a Quest page

Built `post-quest.html` and `js/post-quest.js`, closing a page
deferred since 5.2D. Not yet tested in a browser.

**Decisions**

- **Publish and draft have different bars.** Publishing requires
  every field; a draft requires only a title and lists what is still
  outstanding. Holding drafts to the same standard would make the
  draft feature pointless.
- **Edit mode reuses the same form**, opened with `?id=`. One form to
  maintain rather than two that drift apart. The id is checked
  against a positive-integer pattern, so anything else is treated as
  no id at all.

**Problem**

Rules of dashes inside HTML comments are illegal, so the `-----`
separators used initially failed the W3C parser. The existing pages
use `~~~~~` and `=====` for exactly that reason.

---

## 16 September 2026 — Task 10.1P submitted

Authentication and authorisation demonstration, on the unit's starter
repository. `create.js` and `seed.js` written as dual-purpose modules,
runnable standalone and importable by `server.js`, which is the
pattern carried into this project.

**Carried forward into the guild site**

- Session holds `{ id, email, role, displayName }`.
- Middleware composed into the route signature.
- bcrypt at cost factor 10 on both the seed and register paths.
- Protected pages must live outside `public/`, since anything
  `express.static` can reach is reachable without passing a route.

**Changed for the guild site**

- Each middleware now checks for a session itself rather than relying
  on being paired with `requireLogin`. A security check that depends
  on call order fails as a 500 rather than a 401 the first time
  somebody forgets.
- Session secret read from `process.env.SESSION_SECRET` rather than
  written in source, with the server refusing to start in production
  without one.
- Login runs `bcrypt.compareSync` against a throwaway hash even when
  no account is found, so a missing account is not measurably faster
  to reject than a wrong password.
- Session regenerated on login, which is what defeats session
  fixation.

---

## Outstanding

**10.2D build**

- Read paths still hardcoded: the shop, its item detail page and the news pages.
  The quest board and the adventurers are done.
- Checkout, the one write path left, which must refuse an administrator. The
  enquiry form, Post a Quest, the accept and completion chain, the enquiry
  inbox and role correction are done.
- Account pages: both are real data now. They are still two files behind one
  address, and merging them into one role aware page is optional.
- Decide what becomes of Edit profile and Edit loadout, disabled with "Not
  available yet" on the account pages. Build them or remove them.
- Decide whether a hired adventurer needs a Decline (see the completion chain).
- `saved_quests` exists in the schema and no page uses it.
- `is_active` is honoured by sessions and set by nothing.
- Cart modal focus conflict, deferred from 7.2D.
- A sweep for leftover "Part 3" notes: the cart page ("arrive in Part 3"), and
  comments in `guild-shop.html`, `shop.js`, `cart.js`, `main.js` and
  `post-quest.html`.
- Resize `guild-emblem.png` (2.6 MB, loaded on every page) and
  `yew-longbow.png` (2.4 MB). Every other image is about 100 KB.
- `README.md` for the repository, including that the seeded accounts use the
  demo password, which is one character shorter than registration now requires.
- Real artwork for the quests, adventurers and items that fall back to the
  placeholders.

**10.2D deliverables**

- Report (PDF) listing the major improvements.
- Screenshots (PDF) of every improved page at `localhost:3000`, including the
  database before and after.
- Code listing (PDF) of all the html, css and js of the improved pages.

**10.3HD**

- `match_offers` and `adventurer_quest_preferences` are not in `create.js` yet.
- The cascade, server-sent events and the offer banner.
- Walkthrough video (10 minutes at most, on Deakin Panopto, visible to Deakin),
  and a PDF with an introduction, the GitHub link, the video link and a short
  how-to for another developer.
- The submitted 7.3HD PDF is needed as the authority for the mechanics.

**10.4P and the portfolio**

- Draft Learning Summary from the template, the alignment tool check, and the
  portfolio built in OnTrack. The portfolio is due Friday 2 October at 8pm.
- Check OnTrack for the last day to get feedback on the SIT774 tasks.
