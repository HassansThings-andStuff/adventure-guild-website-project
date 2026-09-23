/* ============================================================
   Oceania Adventure Guild - quest board behaviour
   SIT774 Website Project, Part 3 (Task 10.2D)

   Loaded on quest-board.html only.

   Searching, filtering, sorting and paging all happen on the
   server, in SQL. This file collects the controls into a query
   string, asks /api/quests, and draws whatever comes back: the
   cards, the result count and the page buttons.

   The page is a plain shell until that answer arrives, so nothing
   here decides which quests exist. Every value from the server is
   written into the page as text, never as markup, because a
   quest's title and location are text that members typed in.

   The controls are also written into the address bar, so a
   filtered view can be bookmarked or shared, and the same address
   restores it.
   ============================================================ */

(function () {
  'use strict';

  var form = document.getElementById('quest-filter-form');
  var results = document.getElementById('quest-results');

  // Defensive guard, in case the script is loaded elsewhere.
  if (!form || !results) {
    return;
  }

  var countLabel = document.getElementById('quest-result-count');
  var emptyNotice = document.getElementById('quest-empty');
  var errorNotice = document.getElementById('quest-error');
  var retryButton = document.getElementById('quest-retry');
  var pager = document.getElementById('quest-pagination');

  var searchField = document.getElementById('questSearch');
  var typeField = document.getElementById('questType');
  var locationField = document.getElementById('questLocation');
  var rankField = document.getElementById('questRank');
  var rewardField = document.getElementById('questReward');
  var postedField = document.getElementById('questPosted');
  var durationField = document.getElementById('questDuration');
  var posterField = document.getElementById('questPoster');
  var sortField = document.getElementById('questSort');

  // The names the server expects, matched to the controls they come from.
  var CONTROLS = {
    search: searchField,
    type: typeField,
    location: locationField,
    rank: rankField,
    reward: rewardField,
    posted: postedField,
    duration: durationField,
    poster: posterField,
    sort: sortField
  };

  var DEFAULT_SORT = 'posted';
  var SEARCH_DELAY_MS = 300;

  var STATUS_LABELS = { open: 'Open', matched: 'Matched' };

  /* Every request is numbered. If the visitor changes a filter
     while an earlier request is still on its way, the earlier
     answer arrives late and is ignored, instead of overwriting
     the newer one. */
  var requestNumber = 0;
  var searchTimer = null;
  var currentPage = 1;
  var locationsLoaded = false;
  var wantedLocation = '';


  /* ==========================================================
     CONTROLS AND THE ADDRESS BAR
     ========================================================== */

  /**
   * Reads the current values of the controls.
   *
   * @returns {Object} each control's value, keyed by the name the server uses
   */
  function readControls() {
    var values = {};

    Object.keys(CONTROLS).forEach(function (name) {
      values[name] = CONTROLS[name].value.trim();
    });

    /* The location list is filled from the server's first answer, so
       until then the control has nothing to choose and reads as
       empty. The place the address asked for stands in for it, so
       the first request is already filtered the way the address says. */
    if (!locationsLoaded) {
      values.location = wantedLocation;
    }

    return values;
  }

  /**
   * Turns the controls into a query string. Controls left at their
   * default are left out, so an unfiltered board has a clean
   * address.
   *
   * @param {Object} controls the values from readControls
   * @param {number} page the page wanted
   * @returns {URLSearchParams} the query string
   */
  function toQuery(controls, page) {
    var query = new URLSearchParams();

    Object.keys(controls).forEach(function (name) {
      if (controls[name] !== '' && !(name === 'sort' && controls[name] === DEFAULT_SORT)) {
        query.set(name, controls[name]);
      }
    });

    if (page > 1) {
      query.set('page', String(page));
    }

    return query;
  }

  /**
   * Sets a drop-down to a value, but only if it offers that value.
   * An address edited by hand, or an old bookmark, can name
   * something that no longer exists, and that should leave the
   * control on its default rather than blank.
   *
   * @param {HTMLSelectElement} select the drop-down
   * @param {string} value the value wanted
   */
  function setSelect(select, value) {
    select.value = value;

    if (select.value !== value) {
      select.value = '';
    }
  }

  /**
   * Fills the controls from the address, so that a shared or
   * bookmarked view restores itself.
   *
   * @param {URLSearchParams} params the query string of the page address
   */
  function applyAddressToControls(params) {
    searchField.value = params.get('search') || '';

    ['type', 'rank', 'reward', 'posted', 'duration', 'poster', 'sort'].forEach(function (name) {
      setSelect(CONTROLS[name], params.get(name) || '');
    });

    // The location list is filled from the server's answer, so it
    // cannot be chosen yet. It is remembered and applied then.
    wantedLocation = params.get('location') || '';
  }

  /**
   * Reports whether any filter is currently narrowing the results.
   * The sort order does not count, since it hides nothing.
   *
   * @param {Object} controls the values from readControls
   * @returns {boolean} true if at least one filter is set
   */
  function isFiltered(controls) {
    return Object.keys(controls).some(function (name) {
      return name !== 'sort' && controls[name] !== '';
    });
  }


  /* ==========================================================
     DRAWING
     ========================================================== */

  /**
   * Adds one "Label: value" line to a card's list.
   *
   * @param {HTMLElement} list the list to add to
   * @param {string} label the bold label
   * @param {Node|string} value the value, as text or a ready made element
   */
  function addRow(list, label, value) {
    var item = document.createElement('li');
    var strong = document.createElement('strong');

    strong.textContent = label + ':';
    item.appendChild(strong);
    item.appendChild(document.createTextNode(' '));
    item.appendChild(typeof value === 'string' ? document.createTextNode(value) : value);
    list.appendChild(item);
  }

  /**
   * Builds the rank shown on a card: a coloured badge, or the
   * word "Any" for a quest that names no rank.
   *
   * @param {string|null} rank bronze, silver, gold or null
   * @returns {Node} the badge or the text
   */
  function rankNode(rank) {
    var badge;

    if (!rank) {
      return document.createTextNode('Any');
    }

    badge = document.createElement('span');
    badge.className = 'rank-badge rank-' + rank;
    badge.textContent = rank.charAt(0).toUpperCase() + rank.slice(1);

    return badge;
  }

  /**
   * Builds the card for one quest.
   *
   * @param {Object} quest one entry from the server's list
   * @returns {HTMLElement} the finished card
   */
  function createCard(quest) {
    var article = document.createElement('article');
    var card = document.createElement('div');
    var image = document.createElement('img');
    var body = document.createElement('div');
    var heading = document.createElement('h3');
    var link = document.createElement('a');
    var list = document.createElement('ul');
    var sealLine;
    var seal;

    article.className = 'col-md-4 mb-4 quest-item';

    // Quests posted by the guild itself carry a heavier border and a seal.
    card.className = quest.isOfficial ? 'card h-100 border-3 border-dark' : 'card h-100';

    image.className = 'card-img-top';
    image.src = quest.image;
    image.alt = 'Illustration for ' + quest.title;

    body.className = 'card-body';

    if (quest.isOfficial) {
      sealLine = document.createElement('p');
      sealLine.className = 'mb-2';
      seal = document.createElement('span');
      seal.className = 'badge badge-seal';
      seal.textContent = 'Official Guild Quest';
      sealLine.appendChild(seal);
      body.appendChild(sealLine);
    }

    heading.className = 'card-title fs-5';
    link.href = 'quest-detail.html?id=' + encodeURIComponent(quest.id);
    link.textContent = quest.title;
    heading.appendChild(link);
    body.appendChild(heading);

    list.className = 'list-unstyled mb-0';
    addRow(list, 'Reward', quest.reward);
    addRow(list, 'Location', quest.location);
    addRow(list, 'Status', STATUS_LABELS[quest.status] || quest.status);
    addRow(list, 'Rank required', rankNode(quest.rank));
    body.appendChild(list);

    card.appendChild(image);
    card.appendChild(body);
    article.appendChild(card);

    return article;
  }

  /**
   * Adds the places named in the server's answer to the location
   * list. Done once, on the first answer, and then the place the
   * address asked for, if any, is chosen.
   *
   * @param {Array<string>} locations every place that has a quest on the board
   * @returns {boolean} true if the address named a place that has no quests
   */
  function drawLocations(locations) {
    if (locationsLoaded) {
      return false;
    }

    locations.forEach(function (place) {
      var option = document.createElement('option');

      option.value = place;
      option.textContent = place;
      locationField.appendChild(option);
    });

    locationsLoaded = true;
    setSelect(locationField, wantedLocation);

    /* An old bookmark can name a place that no longer has a quest.
       The control then stays on "All locations", and the answer that
       was filtered by the missing place is not the one to show. */
    if (wantedLocation !== '' && locationField.value !== wantedLocation) {
      wantedLocation = '';
      return true;
    }

    return false;
  }

  /**
   * Draws the server's answer: the cards, the count, the empty
   * notice and the page buttons, and records the view in the
   * address bar.
   *
   * @param {Object} data the parsed reply from /api/quests
   * @param {Object} controls the controls as they were when it was asked
   */
  function show(data, controls) {
    var first = (data.page - 1) * data.pageSize + 1;
    var last = first + data.quests.length - 1;
    var query = toQuery(controls, data.page);

    if (drawLocations(data.filters.locations)) {
      load(1, false);
      return;
    }

    results.textContent = '';
    data.quests.forEach(function (quest) {
      results.appendChild(createCard(quest));
    });

    if (data.quests.length === 0) {
      countLabel.textContent = window.guildGuild.describeResults(
        0, data.totalOnBoard, 'quests', isFiltered(controls)
      );
    } else {
      countLabel.textContent = window.guildGuild.describePage(
        first, last, data.total, data.totalOnBoard, 'quests', isFiltered(controls)
      );
    }

    emptyNotice.classList.toggle('d-none', data.quests.length > 0);
    errorNotice.classList.add('d-none');
    window.guildGuild.drawPager(pager, data.page, data.totalPages, function (n) {
      load(n, true);
    });

    currentPage = data.page;

    // replaceState changes the address without adding a history entry,
    // so the Back button leaves the board instead of stepping through
    // every keystroke.
    window.history.replaceState(null, '', query.toString()
      ? '?' + query.toString()
      : window.location.pathname);
  }


  /* ==========================================================
     ASKING THE SERVER
     ========================================================== */

  /**
   * Asks the server for a page of quests using the current
   * controls, and draws the answer.
   *
   * @param {number} page the page wanted
   * @param {boolean} scroll whether to bring the results into view afterwards
   */
  function load(page, scroll) {
    var controls = readControls();
    var thisRequest = requestNumber + 1;

    requestNumber = thisRequest;
    results.setAttribute('aria-busy', 'true');

    fetch('/api/quests?' + toQuery(controls, page).toString(), {
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, data: data };
      });
    }).then(function (result) {
      // A newer request has been made since this one, so this
      // answer is out of date.
      if (thisRequest !== requestNumber) {
        return;
      }

      if (!result.ok) {
        throw new Error('The server refused the request');
      }

      show(result.data, controls);

      if (scroll) {
        countLabel.scrollIntoView({ block: 'start' });
      }
    }).catch(function () {
      if (thisRequest === requestNumber) {
        errorNotice.classList.remove('d-none');
      }
    }).then(function () {
      if (thisRequest === requestNumber) {
        results.setAttribute('aria-busy', 'false');
      }
    });
  }


  /* ==========================================================
     WIRING
     ========================================================== */

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    window.clearTimeout(searchTimer);
    load(1, false);
  });

  /* Searching as the visitor types makes the board feel immediate,
     but asking the server on every keystroke would be wasteful.
     The request goes out once they pause. The Search button stays
     for anyone who expects to press it. */
  searchField.addEventListener('input', function () {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(function () {
      load(1, false);
    }, SEARCH_DELAY_MS);
  });

  Object.keys(CONTROLS).forEach(function (name) {
    if (name !== 'search') {
      CONTROLS[name].addEventListener('change', function () {
        load(1, false);
      });
    }
  });

  // The reset button clears the fields after this event fires, so
  // the board is reloaded on the next tick.
  form.addEventListener('reset', function () {
    window.clearTimeout(searchTimer);
    window.setTimeout(function () {
      load(1, false);
    }, 0);
  });

  retryButton.addEventListener('click', function () {
    load(currentPage, false);
  });

  var address = new URLSearchParams(window.location.search);

  applyAddressToControls(address);
  load(Number(address.get('page')) > 0 ? Number(address.get('page')) : 1, false);

}());
