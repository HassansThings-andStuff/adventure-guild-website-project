/* ============================================================
   Oceania Adventure Guild - adventurers page behaviour
   SIT774 Website Project, Part 3 (Task 10.2D)

   Loaded on adventurers.html only.

   Two features:

     The guild register. Searching, filtering, sorting and paging
     all happen on the server, in SQL. This file collects the
     controls into a query string, asks /api/adventurers, and
     draws whatever comes back.

     A preview panel that updates when a card is selected, so a
     visitor can compare adventurers without leaving the page. It
     is filled from the same answer as the list, so the two cannot
     drift out of step.

   Every value from the server is written into the page as text,
   never as markup, because names and biographies are typed in by
   members.

   The Hire control in the preview depends on who is looking, and
   is decided by guildGuild.hireOffer in main.js, which the profile
   page uses as well.
   ============================================================ */

(function () {
  'use strict';

  var form = document.getElementById('adventurer-filter-form');
  var results = document.getElementById('adventurer-results');

  // Defensive guard, in case the script is loaded elsewhere.
  if (!form || !results) {
    return;
  }

  var countLabel = document.getElementById('adventurer-result-count');
  var emptyNotice = document.getElementById('adventurer-empty');
  var errorNotice = document.getElementById('adventurer-error');
  var retryButton = document.getElementById('adventurer-retry');
  var pager = document.getElementById('adventurer-pagination');
  var panel = document.getElementById('preview-panel');
  var gearRegion = document.getElementById('preview-gear');

  var searchField = document.getElementById('advSearch');
  var classField = document.getElementById('advClass');
  var rankField = document.getElementById('advRank');
  var specialtyField = document.getElementById('advSpecialty');
  var availabilityField = document.getElementById('advAvailability');
  var regionField = document.getElementById('advRegion');
  var sortField = document.getElementById('advSort');

  // The names the server expects, matched to the controls they come from.
  var CONTROLS = {
    search: searchField,
    class: classField,
    rank: rankField,
    specialty: specialtyField,
    availability: availabilityField,
    region: regionField,
    sort: sortField
  };

  // Controls whose choices are filled from the server's first answer.
  var LISTED = { specialty: specialtyField, region: regionField };

  var preview = {
    image: document.getElementById('preview-image'),
    name: document.getElementById('preview-name'),
    cls: document.getElementById('preview-class'),
    rank: document.getElementById('preview-rank'),
    specialty: document.getElementById('preview-specialty'),
    member: document.getElementById('preview-member'),
    availability: document.getElementById('preview-availability'),
    region: document.getElementById('preview-region'),
    blurb: document.getElementById('preview-blurb'),
    profile: document.getElementById('preview-profile'),
    hire: document.getElementById('preview-hire')
  };

  var DEFAULT_SORT = 'rank';
  var SEARCH_DELAY_MS = 300;

  /* Every request is numbered. If the visitor changes a filter
     while an earlier request is still on its way, the earlier
     answer arrives late and is ignored. */
  var requestNumber = 0;
  var searchTimer = null;
  var currentPage = 1;
  var listsLoaded = false;
  var wantedChoices = { specialty: '', region: '' };

  var people = [];
  var selectedId = null;


  /* ==========================================================
     CONTROLS AND THE ADDRESS BAR
     ========================================================== */

  /**
   * Reads the current values of the controls. Until the server has
   * supplied the specialty and region lists, those two controls have
   * nothing to choose, so the choices named in the address stand in
   * for them and the very first request is already filtered.
   *
   * @returns {Object} each control's value, keyed by the name the server uses
   */
  function readControls() {
    var values = {};

    Object.keys(CONTROLS).forEach(function (name) {
      values[name] = CONTROLS[name].value.trim();
    });

    if (!listsLoaded) {
      values.specialty = wantedChoices.specialty;
      values.region = wantedChoices.region;
    }

    return values;
  }

  /**
   * Turns the controls into a query string, leaving out anything
   * still at its default so an unfiltered register has a clean address.
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

    ['class', 'rank', 'availability', 'sort'].forEach(function (name) {
      setSelect(CONTROLS[name], params.get(name) || '');
    });

    wantedChoices.specialty = params.get('specialty') || '';
    wantedChoices.region = params.get('region') || '';
  }

  /**
   * Reports whether any filter is narrowing the results. The sort
   * order does not count, since it hides nobody.
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
     DRAWING THE LIST
     ========================================================== */

  /**
   * Builds a rank badge.
   *
   * @param {string} rank bronze, silver or gold
   * @returns {HTMLElement} the badge
   */
  function rankBadge(rank) {
    var badge = document.createElement('span');

    badge.className = 'rank-badge rank-' + rank;
    badge.textContent = rank.charAt(0).toUpperCase() + rank.slice(1);

    return badge;
  }

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
   * Builds the card for one adventurer.
   *
   * @param {Object} person one entry from the server's list
   * @returns {HTMLElement} the finished card
   */
  function createCard(person) {
    var article = document.createElement('article');
    var row = document.createElement('div');
    var pictureColumn = document.createElement('div');
    var bodyColumn = document.createElement('div');
    var picture = document.createElement('img');
    var body = document.createElement('div');
    var heading = document.createElement('h3');
    var list = document.createElement('ul');
    var button = document.createElement('button');

    article.className = 'card mb-3 adventurer-item';
    article.setAttribute('data-id', String(person.id));

    row.className = 'row g-0';
    pictureColumn.className = 'col-4';
    bodyColumn.className = 'col-8';

    picture.className = 'img-fluid rounded-start';
    picture.src = person.portrait;
    picture.alt = 'Portrait of ' + person.name;
    pictureColumn.appendChild(picture);

    body.className = 'card-body py-2';
    heading.className = 'card-title fs-6 mb-1';
    heading.textContent = person.name;

    list.className = 'list-unstyled small mb-2';
    addRow(list, 'Class', person.class);
    addRow(list, 'Rank', rankBadge(person.rank));
    addRow(list, 'Specialty', person.specialty || 'None stated');
    addRow(list, 'Availability', window.guildGuild.describeAvailability(person.availability));

    button.type = 'button';
    button.className = 'btn btn-outline-secondary btn-sm preview-btn';
    button.textContent = 'Preview';

    body.appendChild(heading);
    body.appendChild(list);
    body.appendChild(button);
    bodyColumn.appendChild(body);

    row.appendChild(pictureColumn);
    row.appendChild(bodyColumn);
    article.appendChild(row);

    return article;
  }

  /**
   * Adds the specialties and regions named in the server's answer to
   * their lists. Done once, on the first answer, and then the choices
   * the address asked for, if any, are made.
   *
   * @param {{specialties: Array<string>, regions: Array<string>}} lists from the server
   * @returns {boolean} true if the address named a choice that no longer exists
   */
  function drawLists(lists) {
    var stale = false;

    if (listsLoaded) {
      return false;
    }

    [['specialty', lists.specialties], ['region', lists.regions]].forEach(function (pair) {
      var name = pair[0];
      var field = LISTED[name];

      pair[1].forEach(function (choice) {
        var option = document.createElement('option');

        option.value = choice;
        option.textContent = choice;
        field.appendChild(option);
      });
    });

    listsLoaded = true;

    Object.keys(LISTED).forEach(function (name) {
      setSelect(LISTED[name], wantedChoices[name]);

      // An old bookmark can name something that has since gone. The
      // control stays on its default, and the answer that was filtered
      // by the missing choice is not the one to show.
      if (wantedChoices[name] !== '' && LISTED[name].value !== wantedChoices[name]) {
        stale = true;
      }
    });

    wantedChoices = { specialty: '', region: '' };

    return stale;
  }


  /* ==========================================================
     THE PREVIEW PANEL
     ========================================================== */

  /**
   * Rebuilds the equipped gear region for one adventurer. Elements
   * are created rather than assembled as an HTML string, so the
   * data is never interpreted as markup.
   *
   * @param {Array<{name: string, image: string}>} gear the equipped items
   */
  function showGear(gear) {
    if (!gearRegion) {
      return;
    }

    gearRegion.textContent = '';

    gear.forEach(function (item) {
      var image = document.createElement('img');

      image.src = item.image;
      image.alt = item.name;
      image.title = item.name;
      gearRegion.appendChild(image);
    });
  }

  /**
   * Draws the Hire control for the previewed adventurer. What it is
   * depends on who is looking, and that is decided in main.js. It is
   * drawn once the server has said who is logged in, so a logged in
   * adventurer is never shown a login invitation for a moment first.
   *
   * @param {Object} person the adventurer being previewed
   */
  function showHire(person) {
    preview.hire.textContent = '';

    window.guildGuild.getUser().then(function (user) {
      var offer;
      var link;
      var note;

      // The visitor may have moved on to someone else while the
      // answer was on its way.
      if (selectedId !== person.id) {
        return;
      }

      offer = window.guildGuild.hireOffer(person, user);
      preview.hire.textContent = '';

      if (offer.href) {
        link = document.createElement('a');
        link.className = 'btn btn-primary';
        link.href = offer.href;
        link.textContent = offer.shortLabel;
        preview.hire.appendChild(link);
      }

      if (offer.note) {
        note = document.createElement('span');
        note.className = 'small text-body-secondary';
        note.textContent = offer.note;
        preview.hire.appendChild(note);
      }
    });
  }

  /**
   * Fills the preview panel from one adventurer and marks that
   * card as selected.
   *
   * @param {Object} person one entry from the server's list
   */
  function showPreview(person) {
    selectedId = person.id;

    Array.prototype.forEach.call(results.querySelectorAll('.adventurer-item'), function (card) {
      card.classList.toggle('adventurer-selected', card.getAttribute('data-id') === String(person.id));
    });

    preview.image.src = person.portrait;
    preview.image.alt = 'Portrait of ' + person.name;
    preview.name.textContent = person.name;
    preview.cls.textContent = person.class;
    preview.specialty.textContent = person.specialty || 'None stated';
    preview.member.textContent = person.memberSince || 'Not stated';
    preview.availability.textContent = window.guildGuild.describeAvailability(person.availability);
    preview.region.textContent = person.region || 'Not stated';
    preview.blurb.textContent = person.blurb;
    preview.profile.href = 'adventurer-profile.html?id=' + encodeURIComponent(person.id);

    /* The rank badge is rebuilt rather than having its text replaced,
       because the burnish class changes with the rank. */
    preview.rank.textContent = '';
    preview.rank.appendChild(rankBadge(person.rank));

    showGear(person.gear);
    showHire(person);
  }


  /* ==========================================================
     DRAWING THE ANSWER
     ========================================================== */

  /**
   * Draws the server's answer: the cards, the count, the empty
   * notice, the page buttons and the preview, and records the view
   * in the address bar.
   *
   * @param {Object} data the parsed reply from /api/adventurers
   * @param {Object} controls the controls as they were when it was asked
   */
  function show(data, controls) {
    var first = (data.page - 1) * data.pageSize + 1;
    var last = first + data.adventurers.length - 1;
    var query = toQuery(controls, data.page);
    var stillThere;

    if (drawLists(data.filters)) {
      load(1, false);
      return;
    }

    people = data.adventurers;

    results.textContent = '';
    people.forEach(function (person) {
      results.appendChild(createCard(person));
    });

    if (people.length === 0) {
      countLabel.textContent = window.guildGuild.describeResults(
        0, data.totalAll, 'adventurers', isFiltered(controls)
      );
    } else {
      countLabel.textContent = window.guildGuild.describePage(
        first, last, data.total, data.totalAll, 'adventurers', isFiltered(controls)
      );
    }

    emptyNotice.classList.toggle('d-none', people.length > 0);
    errorNotice.classList.add('d-none');
    window.guildGuild.drawPager(pager, data.page, data.totalPages, function (n) {
      load(n, true);
    });

    /* Leaving a preview of someone who is no longer on the page would
       be confusing, so the preview stays with the same person if they
       are still there, and otherwise moves to the first card. With no
       results at all the panel is hidden. */
    stillThere = people.filter(function (person) {
      return person.id === selectedId;
    })[0];

    panel.classList.toggle('d-none', people.length === 0);

    if (people.length > 0) {
      showPreview(stillThere || people[0]);
    }

    currentPage = data.page;

    // replaceState changes the address without adding a history entry,
    // so the Back button leaves the page instead of stepping through
    // every keystroke.
    window.history.replaceState(null, '', query.toString()
      ? '?' + query.toString()
      : window.location.pathname);
  }


  /* ==========================================================
     ASKING THE SERVER
     ========================================================== */

  /**
   * Asks the server for a page of adventurers using the current
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

    fetch('/api/adventurers?' + toQuery(controls, page).toString(), {
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

  results.addEventListener('click', function (event) {
    var button = event.target.closest('.preview-btn');
    var card = button ? button.closest('.adventurer-item') : null;
    var chosen;

    if (!card) {
      return;
    }

    chosen = people.filter(function (person) {
      return String(person.id) === card.getAttribute('data-id');
    })[0];

    if (!chosen) {
      return;
    }

    showPreview(chosen);

    /* Below the medium breakpoint the two columns stack, so the
       preview panel sits beneath the whole list and a selection
       would otherwise produce no visible change. Bringing the
       panel into view keeps the cause and effect connected. Above
       that breakpoint the panel is sticky and already visible. */
    if (window.matchMedia && window.matchMedia('(max-width: 767.98px)').matches) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    window.clearTimeout(searchTimer);
    load(1, false);
  });

  /* Searching as the visitor types makes the register feel
     immediate, but asking the server on every keystroke would be
     wasteful. The request goes out once they pause. */
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
  // the register is reloaded on the next tick.
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
