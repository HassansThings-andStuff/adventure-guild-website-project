/* ============================================================
   Oceania Adventure Guild - news page behaviour
   SIT774 Website Project, Part 2 (Task 7.2D)

   Loaded on news.html only.

   A news feed is read rather than shopped, so this page carries a
   search box alone rather than the full filter panel used on the
   three listing pages. The search matches the headline, the body
   text and the kind of item, so that typing "announcement" or
   "event" narrows the feed without needing a separate control.
   ============================================================ */

(function () {
  'use strict';

  var form = document.getElementById('news-search-form');
  var results = document.getElementById('news-results');

  // Defensive guard, in case the script is loaded elsewhere.
  if (!form || !results) {
    return;
  }

  var items = Array.prototype.slice.call(results.querySelectorAll('.news-item'));
  var searchField = document.getElementById('newsSearch');
  var countLabel = document.getElementById('news-result-count');
  var emptyNotice = document.getElementById('news-empty');

  /**
   * Tests one item against the search term.
   *
   * @param {HTMLElement} item the item's wrapper element
   * @param {string} term the lower cased search term
   * @returns {boolean} true if the item should be shown
   */
  function matches(item, term) {
    var haystack = [
      item.dataset.title || '',
      item.dataset.body || '',
      item.dataset.kind || ''
    ].join(' ').toLowerCase();

    return haystack.indexOf(term) !== -1;
  }

  /**
   * Applies the search and updates the count and empty notice.
   */
  function applySearch() {
    var term = searchField.value.trim().toLowerCase();
    var shown = 0;

    items.forEach(function (item) {
      if (term === '' || matches(item, term)) {
        item.classList.remove('d-none');
        shown += 1;
      } else {
        item.classList.add('d-none');
      }
    });

    countLabel.textContent = window.guildGuild.describeResults(
      shown, items.length, 'items', term !== ''
    );
    emptyNotice.classList.toggle('d-none', shown > 0);
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    applySearch();
  });

  // Searching as the visitor types makes the feed feel immediate;
  // the Search button remains for anyone who expects to press it.
  searchField.addEventListener('input', applySearch);

  applySearch();

}());
