/* ============================================================
   Oceania Adventure Guild - quest lifecycle rules shared by routes
   SIT774 Website Project, Part 3 (Task 10.2D)

   Two small things that more than one route file needs, kept in one
   place so they cannot drift apart:

     progressOf(row, official)  where a matched quest has got to
     makeRelease(db)            hands an adventurer back to the board
     makeTransaction(db)        runs several writes as one, or none

   Used as:  const { progressOf, makeRelease, makeTransaction } = require('./rules');
   ============================================================ */

/**
 * Says where a matched quest has got to in the completion chain. An
 * adventurer marks the work done, the customer who posted it confirms,
 * and the guild verifies. The three flags are stored, and this names
 * the stage they add up to.
 *
 * A quest the guild posted itself has no customer to confirm, so its
 * one Verify action does both jobs, and the stage after "marked done"
 * is the guild's own.
 *
 * @param {Object} row a quests row
 * @param {boolean} official whether the guild account posted it
 * @returns {string|null} 'in_progress', 'awaiting_confirmation',
 *   'awaiting_verification', or null for a quest that is not matched
 */
function progressOf(row, official) {
  if (row.status !== 'matched') {
    return null;
  }

  if (!row.adventurer_marked_done) {
    return 'in_progress';
  }

  if (!row.poster_confirmed && !official) {
    return 'awaiting_confirmation';
  }

  return 'awaiting_verification';
}

/**
 * Builds the statement that hands an adventurer back to the board when
 * a quest they held ends, by being completed or cancelled. Only an
 * adventurer who is on a quest is touched, so an adventurer who has
 * since set themselves unavailable is left as they chose, and one who
 * somehow holds another matched quest stays on it.
 *
 * @param {DatabaseSync} db the open database
 * @returns {function(number, number): void} release(adventurerId, endedQuestId)
 */
function makeRelease(db) {
  const statement = db.prepare(`
    UPDATE adventurer_profiles
    SET availability = 'available', available_since = datetime('now')
    WHERE id = ? AND availability = 'on_quest'
      AND NOT EXISTS (
        SELECT 1 FROM quests WHERE accepted_by = ? AND status = 'matched' AND id <> ?
      )
  `);

  return function release(adventurerId, endedQuestId) {
    statement.run(adventurerId, adventurerId, endedQuestId);
  };
}

/**
 * Builds a function that runs several writes as one. If any of them
 * throws, none of them are kept. Accepting a quest is two writes, the
 * quest and the adventurer, and a quest that says "matched" while the
 * adventurer still says "available" would be exactly the double
 * booking the rules exist to prevent.
 *
 * @param {DatabaseSync} db the open database
 * @returns {function(function): *} transaction(work) returns what work returns
 */
function makeTransaction(db) {
  return function transaction(work) {
    db.exec('BEGIN IMMEDIATE');

    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
}

module.exports = { progressOf, makeRelease, makeTransaction };
