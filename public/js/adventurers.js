/* ============================================================
   Oceania Adventure Guild - adventurers page behaviour
   SIT774 Website Project, Part 2 (Task 7.2D)

   Loaded on adventurers.html only.

   Two features:

     Search and filter over the guild register, as required by the
     project specification.

     A preview panel that updates when a card is selected, so a
     visitor can compare adventurers without leaving the page.
     The panel is filled from the card's own data attributes, so
     the list and the panel cannot drift out of step.
   ============================================================ */

(function () {
  'use strict';

  var form = document.getElementById('adventurer-filter-form');
  var results = document.getElementById('adventurer-results');

  // Defensive guard, in case the script is loaded elsewhere.
  if (!form || !results) {
    return;
  }

  var people = Array.prototype.slice.call(
    results.querySelectorAll('.adventurer-item')
  );
  var countLabel = document.getElementById('adventurer-result-count');
  var emptyNotice = document.getElementById('adventurer-empty');

  var searchField = document.getElementById('advSearch');
  var classField = document.getElementById('advClass');
  var rankField = document.getElementById('advRank');
  var specialtyField = document.getElementById('advSpecialty');
  var availabilityField = document.getElementById('advAvailability');
  var experienceField = document.getElementById('advExperience');
  var regionField = document.getElementById('advRegion');

  var panel = document.getElementById('preview-panel');
  var gearRegion = document.getElementById('preview-gear');

  var preview = {
    image: document.getElementById('preview-image'),
    name: document.getElementById('preview-name'),
    cls: document.getElementById('preview-class'),
    rank: document.getElementById('preview-rank'),
    specialty: document.getElementById('preview-specialty'),
    completed: document.getElementById('preview-completed'),
    availability: document.getElementById('preview-availability'),
    region: document.getElementById('preview-region'),
    blurb: document.getElementById('preview-blurb')
  };


  /* ==========================================================
     FILTERING
     ========================================================== */

  /**
   * Reads the current filter values from the form.
   *
   * @returns {Object} the filter values, normalised
   */
  function readFilters() {
    return {
      search: searchField.value.trim().toLowerCase(),
      cls: classField.value,
      rank: rankField.value,
      specialty: specialtyField.value,
      availability: availabilityField.value,
      completed: experienceField.value === '' ? null : Number(experienceField.value),
      region: regionField.value
    };
  }

  /**
   * Tests one adventurer against the current filter values.
   *
   * @param {HTMLElement} person the adventurer's wrapper element
   * @param {Object} filters the current filter values
   * @returns {boolean} true if the adventurer should be shown
   */
  function matches(person, filters) {
    var name = (person.dataset.name || '').toLowerCase();
    var specialty = (person.dataset.specialty || '').toLowerCase();
    var completed = Number(person.dataset.completed);
    var availability = person.dataset.availability;

    // Searching matches the specialty as well as the name, since a
    // visitor is as likely to look for "healing" as for a person.
    if (filters.search
        && name.indexOf(filters.search) === -1
        && specialty.indexOf(filters.search) === -1) {
      return false;
    }

    if (filters.cls && person.dataset.class !== filters.cls) {
      return false;
    }

    if (filters.rank && person.dataset.rank !== filters.rank) {
      return false;
    }

    if (filters.specialty && person.dataset.specialty !== filters.specialty) {
      return false;
    }

    /* Someone available now is also available this week, so the
       narrower option is the stricter filter. */
    if (filters.availability === 'now' && availability !== 'now') {
      return false;
    }

    if (filters.availability === 'week'
        && availability !== 'now' && availability !== 'week') {
      return false;
    }

    if (filters.completed !== null && completed <= filters.completed) {
      return false;
    }

    /* An adventurer willing to travel anywhere satisfies every
       region, so they are never filtered out by region. */
    if (filters.region
        && person.dataset.region !== filters.region
        && person.dataset.region !== 'Anywhere') {
      return false;
    }

    return true;
  }

  /**
   * Reports whether any filter is currently narrowing the results.
   *
   * @param {Object} filters the current filter values
   * @returns {boolean} true if at least one filter is set
   */
  function isFiltered(filters) {
    return Boolean(
      filters.search || filters.cls || filters.rank || filters.specialty
      || filters.availability || filters.region || filters.completed !== null
    );
  }

  /**
   * Applies the current filters, updates the count and the empty
   * notice, and moves the preview to the first visible card if
   * the previewed adventurer has been filtered out.
   */
  function applyFilters() {
    var filters = readFilters();
    var visible = [];
    var stillVisible = false;

    people.forEach(function (person) {
      if (matches(person, filters)) {
        person.classList.remove('d-none');
        visible.push(person);
        if (person.classList.contains('adventurer-selected')) {
          stillVisible = true;
        }
      } else {
        person.classList.add('d-none');
      }
    });

    countLabel.textContent = window.guildGuild.describeResults(
      visible.length, people.length, 'adventurers', isFiltered(filters)
    );
    emptyNotice.classList.toggle('d-none', visible.length > 0);

    // Leaving a preview of someone no longer in the results would
    // be confusing, so it follows the list.
    if (!stillVisible && visible.length > 0) {
      showPreview(visible[0]);
    }
  }


  /* ==========================================================
     PREVIEW PANEL
     ========================================================== */

  /**
   * Reads an adventurer's gear from its data attribute.
   *
   * The attribute holds JSON, so a malformed value would throw and
   * stop the whole preview from rendering. It is parsed defensively
   * and falls back to no gear rather than breaking the panel.
   *
   * @param {HTMLElement} person the adventurer's wrapper element
   * @returns {Array<Object>} the gear entries, possibly empty
   */
  function readGear(person) {
    var parsed;

    if (!person.dataset.gear) {
      return [];
    }

    try {
      parsed = JSON.parse(person.dataset.gear);
    } catch (error) {
      return [];
    }

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(function (entry) {
      return entry && typeof entry.src === 'string' && typeof entry.alt === 'string';
    });
  }

  /**
   * Rebuilds the equipped gear region for one adventurer.
   *
   * Elements are created rather than assembled as an HTML string,
   * so the data is never interpreted as markup.
   *
   * @param {HTMLElement} person the adventurer's wrapper element
   */
  function showGear(person) {
    var gear = readGear(person);
    var fragment = document.createDocumentFragment();

    if (!gearRegion) {
      return;
    }

    // Removing the children rather than setting innerHTML keeps the
    // container itself and any classes on it intact.
    while (gearRegion.firstChild) {
      gearRegion.removeChild(gearRegion.firstChild);
    }

    gear.forEach(function (entry) {
      var image = document.createElement('img');
      image.src = entry.src;
      image.alt = entry.alt;
      image.title = entry.alt;
      fragment.appendChild(image);
    });

    gearRegion.appendChild(fragment);
  }

  /**
   * Fills the preview panel from one adventurer's data attributes
   * and marks that card as selected.
   *
   * @param {HTMLElement} person the adventurer's wrapper element
   */
  function showPreview(person) {
    var rank = person.dataset.rank;
    var badge;

    people.forEach(function (other) {
      other.classList.remove('adventurer-selected');
    });
    person.classList.add('adventurer-selected');

    preview.image.src = person.dataset.image;
    preview.image.alt = 'Portrait of ' + person.dataset.name;
    preview.name.textContent = person.dataset.name;
    preview.cls.textContent = person.dataset.class;
    preview.specialty.textContent = person.dataset.specialty;
    preview.completed.textContent = person.dataset.completed;
    preview.blurb.textContent = person.dataset.blurb;

    /* The rank badge is rebuilt rather than having its text
       replaced, because the burnish class changes with the rank.
       textContent is used rather than innerHTML so that the data
       is never treated as markup. */
    preview.rank.textContent = '';
    badge = document.createElement('span');
    badge.className = 'rank-badge rank-' + rank.toLowerCase();
    badge.textContent = rank;
    preview.rank.appendChild(badge);

    showGear(person);
  }

  results.addEventListener('click', function (event) {
    var button = event.target.closest('.preview-btn');
    var card;

    if (!button) {
      return;
    }

    card = button.closest('.adventurer-item');

    if (!card) {
      return;
    }

    showPreview(card);

    /* Below the medium breakpoint the two columns stack, so the
       preview panel sits beneath the whole list and a selection
       would otherwise produce no visible change. Bringing the
       panel into view keeps the cause and effect connected.
       Above that breakpoint the panel is sticky and already
       visible, so it is left alone. */
    if (panel && window.matchMedia('(max-width: 767.98px)').matches) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });


  /* ==========================================================
     WIRING
     ========================================================== */

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    applyFilters();
  });

  searchField.addEventListener('input', applyFilters);

  [classField, rankField, specialtyField, availabilityField,
    experienceField, regionField
  ].forEach(function (field) {
    field.addEventListener('change', applyFilters);
  });

  form.addEventListener('reset', function () {
    window.setTimeout(applyFilters, 0);
  });

  // The first adventurer is previewed on load, so the panel is
  // never empty.
  if (people.length > 0) {
    showPreview(people[0]);
  }

  applyFilters();

}());
