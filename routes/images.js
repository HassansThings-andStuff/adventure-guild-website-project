/* ============================================================
   Oceania Adventure Guild - artwork lookup
   SIT774 Website Project, Part 3 (Task 10.2D)

   The database names an image file for a quest, an adventurer or
   an item, but not every named file exists yet. This turns the
   name into an address that works: the file itself if it is on
   disk, and a stated default picture if it is not.

   The images folder is listed once, when the server starts, so
   a lookup is a set membership test and never touches the disk.
   A file added while the server is running is noticed on the next
   start.

   Used from a routes file as:
     const resolveImage = require('./images')();
     resolveImage(row.image, '/images/quest-default-combat.svg');
   ============================================================ */

const fs = require('fs');
const path = require('path');

module.exports = function makeImageResolver() {
  const imageDir = path.join(__dirname, '..', 'public', 'images');
  const known = new Set(fs.readdirSync(imageDir));

  /**
   * @param {string|null} stored the path saved in the database, such as images/quest-cat.jpg
   * @param {string} fallback the address of the default picture
   * @returns {string} an address that exists
   */
  return function resolveImage(stored, fallback) {
    // Only a plain file directly inside images/ is accepted, so a
    // stored value can never point anywhere else on the site.
    const match = /^images\/([^/]+)$/.exec(stored || '');

    if (match && known.has(match[1])) {
      return '/images/' + match[1];
    }

    return fallback;
  };
};
