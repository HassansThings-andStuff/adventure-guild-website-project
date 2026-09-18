/* ============================================================
   Oceania Adventure Guild - quest board behaviour
   SIT774 Website Project, Part 2 (Task 7.2D)

   Loaded on quest-board.html only.

   Provides the search, filter and sort function required by the
   project specification. Filtering runs against the quests
   already present in the page, so no round trip to the server is
   needed. In Part 3 the same controls query the database.
   ============================================================ */

(function () {
  'use strict';

  var form = document.getElementById('quest-filter-form');
  var results = document.getElementById('quest-results');

  // Defensive guard, in case the script is loaded elsewhere.
  if (!form || !results) {
    return;
  }

  var quests = Array.prototype.slice.call(results.querySelectorAll('.quest-item'));
  var countLabel = document.getElementById('quest-result-count');
  var emptyNotice = document.getElementById('quest-empty');

  var searchField = document.getElementById('questSearch');
  var typeField = document.getElementById('questType');
  var locationField = document.getElementById('questLocation');
  var rankField = document.getElementById('questRank');
  var rewardField = document.getElementById('questReward');
  var postedField = document.getElementById('questPosted');
  var durationField = document.getElementById('questDuration');
  var posterField = document.getElementById('questPoster');
  var sortField = document.getElementById('questSort');


  /**
   * Reads the current filter values from the form.
   *
   * @returns {Object} the filter values, normalised
   */
  function readFilters() {
    var range = rewardField.value.split('-');
    var minReward = null;
    var maxReward = null;

    if (range.length === 2) {
      minReward = Number(range[0]);
      maxReward = Number(range[1]);
    }

    return {
      search: searchField.value.trim().toLowerCase(),
      type: typeField.value,
      location: locationField.value,
      rank: rankField.value,
      minReward: minReward,
      maxReward: maxReward,
      posted: postedField.value === '' ? null : Number(postedField.value),
      duration: durationField.value,
      poster: posterField.value
    };
  }

  /**
   * Tests one quest against the current filter values.
   *
   * @param {HTMLElement} quest the quest's wrapper element
   * @param {Object} filters the current filter values
   * @returns {boolean} true if the quest should be shown
   */
  function matches(quest, filters) {
    var title = (quest.dataset.title || '').toLowerCase();
    var reward = Number(quest.dataset.reward);
    var posted = Number(quest.dataset.posted);

    if (filters.search && title.indexOf(filters.search) === -1) {
      return false;
    }

    if (filters.type && quest.dataset.type !== filters.type) {
      return false;
    }

    if (filters.location && quest.dataset.location !== filters.location) {
      return false;
    }

    /* A quest marked "Any" accepts every rank, so it is shown
       whichever rank the visitor has selected. */
    if (filters.rank
        && quest.dataset.rank !== filters.rank
        && quest.dataset.rank !== 'Any') {
      return false;
    }

    if (filters.minReward !== null && reward < filters.minReward) {
      return false;
    }

    if (filters.maxReward !== null && reward > filters.maxReward) {
      return false;
    }

    if (filters.posted !== null && posted > filters.posted) {
      return false;
    }

    if (filters.duration && quest.dataset.duration !== filters.duration) {
      return false;
    }

    if (filters.poster && quest.dataset.poster !== filters.poster) {
      return false;
    }

    return true;
  }

  /**
   * Reorders the quests in the page according to the sort field.
   * The existing elements are moved rather than rebuilt, so every
   * image and listener stays intact.
   */
  function sortQuests() {
    var mode = sortField.value;
    var ordered = quests.slice();

    ordered.sort(function (a, b) {
      if (mode === 'title') {
        return (a.dataset.title || '').localeCompare(b.dataset.title || '');
      }
      if (mode === 'reward') {
        return Number(b.dataset.reward) - Number(a.dataset.reward);
      }
      // Most recent first, so the smallest number of days wins.
      return Number(a.dataset.posted) - Number(b.dataset.posted);
    });

    ordered.forEach(function (quest) {
      results.appendChild(quest);
    });
  }

  /**
   * Reports whether any filter is currently narrowing the results.
   *
   * @param {Object} filters the current filter values
   * @returns {boolean} true if at least one filter is set
   */
  function isFiltered(filters) {
    return Boolean(
      filters.search || filters.type || filters.location || filters.rank
      || filters.duration || filters.poster
      || filters.minReward !== null || filters.posted !== null
    );
  }

  /**
   * Applies the current filters and sort, then updates the result
   * count and the empty notice.
   */
  function applyFilters() {
    var filters = readFilters();
    var shown = 0;

    sortQuests();

    quests.forEach(function (quest) {
      if (matches(quest, filters)) {
        quest.classList.remove('d-none');
        shown += 1;
      } else {
        quest.classList.add('d-none');
      }
    });

    countLabel.textContent = window.guildGuild.describeResults(
      shown, quests.length, 'quests', isFiltered(filters)
    );
    emptyNotice.classList.toggle('d-none', shown > 0);
  }


  /* ==========================================================
     WIRING
     ========================================================== */

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    applyFilters();
  });

  // Filtering as the visitor types makes the search feel
  // immediate; the Search button remains for anyone who expects
  // to press it.
  searchField.addEventListener('input', applyFilters);

  [typeField, locationField, rankField, rewardField,
    postedField, durationField, posterField, sortField
  ].forEach(function (field) {
    field.addEventListener('change', applyFilters);
  });

  // The reset button clears the fields after this event fires, so
  // the filters are reapplied on the next tick.
  form.addEventListener('reset', function () {
    window.setTimeout(applyFilters, 0);
  });

  applyFilters();

}());
