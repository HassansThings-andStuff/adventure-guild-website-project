/* ============================================================
   Oceania Adventure Guild - adventurer profile behaviour
   SIT774 Website Project, Part 3 (Task 10.2D)

   Loaded on adventurer-profile.html only.

   The page is a shell. This file reads the adventurer's number from
   the address (adventurer-profile.html?id=4), asks /api/adventurers/4
   for the register entry, and fills the shell in.

   Every value from the server is written into the page as text,
   never as markup, because names and biographies are typed in by
   members.

   The panel at the foot depends on who is looking. It is decided by
   guildGuild.hireOffer in main.js, which the adventurers page uses
   as well, so the two always agree about who may hire.
   ============================================================ */

(function () {
  'use strict';

  var content = document.getElementById('profile-content');

  // Defensive guard, in case the script is loaded elsewhere.
  if (!content) {
    return;
  }

  var loading = document.getElementById('profile-loading');
  var notice = document.getElementById('profile-notice');
  var noticeHeading = document.getElementById('profile-notice-heading');
  var noticeText = document.getElementById('profile-notice-text');
  var crumb = document.getElementById('profile-crumb');
  var nameHeading = document.getElementById('profile-name');
  var subtitle = document.getElementById('profile-subtitle');
  var portrait = document.getElementById('profile-portrait');
  var facts = document.getElementById('profile-facts');
  var availability = document.getElementById('profile-availability');
  var availabilityNote = document.getElementById('profile-availability-note');
  var bio = document.getElementById('profile-bio');
  var history = document.getElementById('profile-history');
  var gearText = document.getElementById('profile-gear-text');
  var gear = document.getElementById('profile-gear');
  var hirePanel = document.getElementById('profile-hire');

  var AVAILABILITY_NOTES = {
    available: 'Free to take on new work.',
    on_quest: 'Working on a quest at the moment, and cannot take on more until it is done.',
    unavailable: 'Away from the guild, and not taking on work for now.'
  };


  /* ==========================================================
     SMALL BUILDERS
     ========================================================== */

  /**
   * Builds an element with a class and text.
   *
   * @param {string} tag the element name
   * @param {string} className the class attribute, or '' for none
   * @param {string} text the text inside, or '' for none
   * @returns {HTMLElement} the new element
   */
  function make(tag, className, text) {
    var element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text) {
      element.textContent = text;
    }

    return element;
  }

  /**
   * Adds one "Label: value" line to the register entry.
   *
   * @param {string} label the bold label
   * @param {Node|string} value the value, as text or a ready made element
   */
  function addFact(label, value) {
    var item = document.createElement('li');

    item.appendChild(make('strong', '', label + ':'));
    item.appendChild(document.createTextNode(' '));
    item.appendChild(typeof value === 'string' ? document.createTextNode(value) : value);
    facts.appendChild(item);
  }

  /* ==========================================================
     DRAWING THE PROFILE
     ========================================================== */

  /**
   * Draws the heading, portrait and register entry.
   *
   * @param {Object} person the adventurer from the server
   */
  function drawSummary(person) {
    var text = person.class + ', ' + person.rank + ' rank';

    if (person.specialty) {
      text += ', specialising in ' + person.specialty.charAt(0).toLowerCase() + person.specialty.slice(1);
    }

    nameHeading.textContent = person.name;
    subtitle.textContent = text + '.';

    portrait.src = person.portrait;
    portrait.alt = 'Portrait of ' + person.name;

    facts.textContent = '';
    addFact('Class', person.class);
    addFact('Specialty', person.specialty || 'None stated');
    addFact('Rank', make('span', 'rank-badge rank-' + person.rank,
      person.rank.charAt(0).toUpperCase() + person.rank.slice(1)));
    addFact('Willing to travel to', person.region || 'Not stated');
    addFact('Member since', person.memberSince || 'Not stated');

    availability.textContent = window.guildGuild.describeAvailability(person.availability);
    availabilityNote.textContent = AVAILABILITY_NOTES[person.availability.status] || '';
  }

  /**
   * Draws the biography, one paragraph for each blank line.
   *
   * @param {Object} person the adventurer from the server
   */
  function drawBiography(person) {
    bio.textContent = '';

    if (!person.bio) {
      bio.appendChild(make('p', '', 'No biography has been written yet.'));
      return;
    }

    person.bio.split(/\n{2,}/).forEach(function (paragraph) {
      bio.appendChild(make('p', '', paragraph.trim()));
    });
  }

  /**
   * Draws the quest history: a table of finished quests, or a line
   * saying there are none. Only titles are shown, and nothing links
   * to the quest itself, because a finished quest's own page is
   * private to the people involved.
   *
   * @param {Object} person the adventurer from the server
   */
  function drawHistory(person) {
    var table;
    var head;
    var body;

    history.textContent = '';

    if (person.history.length === 0) {
      history.appendChild(make('p', 'mb-0', 'No completed quests are recorded yet.'));
      return;
    }

    table = make('table', 'table table-striped mb-0');
    table.appendChild(make('caption', 'visually-hidden', 'Completed quests'));

    head = document.createElement('thead');
    head.appendChild(document.createElement('tr'));
    ['Quest', 'Date', 'Outcome'].forEach(function (title) {
      var cell = make('th', '', title);

      cell.setAttribute('scope', 'col');
      head.firstChild.appendChild(cell);
    });
    table.appendChild(head);

    body = document.createElement('tbody');
    person.history.forEach(function (quest) {
      var row = document.createElement('tr');
      var dateCell = document.createElement('td');
      var time;

      row.appendChild(make('td', '', quest.title));

      if (quest.completedAt) {
        time = make('time', '', window.guildGuild.formatDate(quest.completedAt));
        time.setAttribute('datetime', quest.completedAt);
        dateCell.appendChild(time);
      }
      row.appendChild(dateCell);

      row.appendChild(make('td', '', 'Completed'));
      body.appendChild(row);
    });
    table.appendChild(body);

    history.appendChild(table);
  }

  /**
   * Draws the equipped gear and the sentence above it.
   *
   * @param {Object} person the adventurer from the server
   */
  function drawGear(person) {
    var name = person.name;
    var text = 'Adventurers display a selection of their equipment. The number of slots '
      + 'rises with rank.';

    text += person.gear.length > 0
      ? ' ' + name + ' is showing ' + person.gear.length + '.'
      : ' ' + name + ' has nothing on display yet.';

    gearText.textContent = text;
    gear.textContent = '';

    person.gear.forEach(function (item) {
      var image = document.createElement('img');

      image.src = item.image;
      image.alt = item.name;
      image.title = item.name;
      gear.appendChild(image);
    });
  }

  /**
   * Draws the panel at the foot of the page. What it offers depends
   * on who is looking: a customer is offered the hire, a stranger is
   * invited to log in, and an adventurer or an administrator is told
   * why there is no button.
   *
   * @param {Object} person the adventurer from the server
   * @param {{role: string}|null} user who is logged in, or null
   */
  function drawHire(person, user) {
    var offer = window.guildGuild.hireOffer(person, user);
    var name = person.name;
    var action;

    hirePanel.textContent = '';

    if (!offer.href) {
      hirePanel.appendChild(make('h2', 'fs-5', 'Hiring'));
      hirePanel.appendChild(make('p', 'mb-0', offer.note));
      return;
    }

    hirePanel.appendChild(make('h2', 'fs-5', 'Want to work with ' + name + '?'));

    hirePanel.appendChild(make('p', '', user
      ? 'Hiring posts a quest addressed to ' + name + ' alone. It stays off the quest board, '
        + 'and the arrangements are brokered through the guild.'
      : offer.note));

    action = make('a', 'btn btn-primary btn-lg', offer.label);
    action.href = offer.href;
    hirePanel.appendChild(action);
  }

  /**
   * Draws the whole profile and reveals it.
   *
   * @param {Object} person the adventurer from the server
   */
  function show(person) {
    crumb.textContent = person.name;
    document.title = person.name + ' | Oceania Adventure Guild';

    drawSummary(person);
    drawBiography(person);
    drawHistory(person);
    drawGear(person);

    /* The hire panel waits for the server to say who is logged in,
       so a logged in adventurer is never shown an invitation to log
       in for a moment first. */
    window.guildGuild.getUser().then(function (user) {
      drawHire(person, user);
    });

    loading.classList.add('d-none');
    content.classList.remove('d-none');
  }

  /**
   * Shows the notice in place of a profile.
   *
   * @param {string} title the notice's heading
   * @param {string} text the notice's message
   */
  function showNotice(title, text) {
    noticeHeading.textContent = title;
    noticeText.textContent = text;
    document.title = title + ' | Oceania Adventure Guild';
    crumb.textContent = title;

    loading.classList.add('d-none');
    notice.classList.remove('d-none');
  }


  /* ==========================================================
     START UP
     ========================================================== */

  var id = new URLSearchParams(window.location.search).get('id');

  // An id that is not a plain positive integer cannot be an
  // adventurer, so no request is wasted on it.
  if (!/^[1-9][0-9]{0,9}$/.test(id || '')) {
    showNotice('Adventurer not found', 'That address does not point at an adventurer.');
    return;
  }

  fetch('/api/adventurers/' + id, { headers: { Accept: 'application/json' } }).then(function (response) {
    return response.json().then(function (data) {
      return { status: response.status, ok: response.ok, data: data };
    });
  }).then(function (result) {
    if (result.status === 404) {
      showNotice('Adventurer not found', 'That adventurer is not on the register.');
      return;
    }

    if (!result.ok) {
      throw new Error('The server could not supply the profile');
    }

    show(result.data.adventurer);
  }).catch(function () {
    showNotice('The profile could not be loaded', 'Please go back to the register and try again.');
  });

}());
