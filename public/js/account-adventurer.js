/* ============================================================
   Oceania Adventure Guild - adventurer account behaviour
   SIT774 Website Project, Part 3 (Task 10.2D)

   Loaded on the adventurer's My Account page only.

   The page is a shell. This file asks /api/my/account for the logged
   in adventurer's profile, gear, the quests they hold or have
   finished, and any quest a customer has hired them for, and draws
   them. The server decides which account: it uses the login held in
   the session, and nothing in the address or the request can name a
   different one.

   Two things are the adventurer's to do here: answer a hire request by
   accepting it, and mark a quest they hold as done. The customer who
   posted it then confirms, and the guild verifies. Whether each button
   is offered is decided by the server and only drawn here, and the
   server checks again when it is pressed.

   Every value from the server is written into the page as text,
   never as markup, because names, quest titles and biographies are
   typed in by members.
   ============================================================ */

(function () {
  'use strict';

  var questsBody = document.getElementById('quests-body');

  // Defensive guard, in case the script is loaded elsewhere.
  if (!questsBody) {
    return;
  }

  var subtitle = document.getElementById('account-subtitle');
  var errorNotice = document.getElementById('account-error');
  var retryButton = document.getElementById('account-retry');

  var questsNotice = document.getElementById('quests-notice');
  var questsFailure = document.getElementById('quests-failure');
  var questsCount = document.getElementById('quests-count');
  var questsTable = document.getElementById('quests-table');

  var hiresBody = document.getElementById('hires-body');
  var hiresCount = document.getElementById('hires-count');
  var hiresTable = document.getElementById('hires-table');

  var STATUS_LABELS = {
    matched: 'In progress',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };

  var PROGRESS_LABELS = {
    in_progress: 'In progress',
    awaiting_confirmation: 'Marked done, awaiting the customer',
    awaiting_verification: 'Confirmed, awaiting the guild'
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
   * Shows one message above the quests and hides the other, so the
   * outcome of an action never sits beside the outcome of the last.
   *
   * @param {HTMLElement|null} shown the message element to show, or null for none
   * @param {string} text what it says
   */
  function announce(shown, text) {
    questsNotice.classList.add('d-none');
    questsFailure.classList.add('d-none');

    if (shown) {
      shown.textContent = text;
      shown.classList.remove('d-none');
    }
  }

  /**
   * Builds a link to a quest's own page.
   *
   * @param {Object} quest anything with an id and a title
   * @returns {HTMLElement} the link
   */
  function questLink(quest) {
    var link = make('a', '', quest.title);

    link.href = 'quest-detail.html?id=' + encodeURIComponent(quest.id);

    return link;
  }


  /* ==========================================================
     THE PROFILE AND GEAR
     ========================================================== */

  /**
   * Says how available the adventurer is, in a sentence.
   *
   * @param {Object} profile the profile from the server
   * @returns {string} the sentence
   */
  function availabilityText(profile) {
    if (profile.availability === 'on_quest') {
      return 'On a quest';
    }

    if (profile.availability === 'unavailable') {
      return profile.unavailableUntil
        ? 'Unavailable until ' + window.guildGuild.formatDate(profile.unavailableUntil)
        : 'Unavailable';
    }

    return 'Available for quests';
  }

  /**
   * Draws the profile panel and the heading.
   *
   * @param {Object} profile the profile from the server
   */
  function drawProfile(profile) {
    var rank = document.getElementById('account-rank');
    var portrait = document.getElementById('account-portrait');
    var label = profile.rank.charAt(0).toUpperCase() + profile.rank.slice(1);

    subtitle.textContent = profile.name + ', adventurer, member since ' + profile.memberSince + '.';

    portrait.src = profile.image;
    portrait.alt = 'Portrait of ' + profile.name;

    document.getElementById('account-name').textContent = profile.name;
    rank.className = 'rank-badge rank-' + profile.rank;
    rank.textContent = label;
    document.getElementById('account-class').textContent = profile.class;
    document.getElementById('account-specialty').textContent = profile.specialty || 'None stated';
    document.getElementById('account-availability').textContent = availabilityText(profile);
    document.getElementById('account-bio').textContent = profile.bio || 'No biography has been written yet.';
  }

  /**
   * Draws the equipped gear and the inventory beside it.
   *
   * @param {Object} gear the gear from the server, equipped and inventory
   */
  function drawGear(gear) {
    var equipped = document.getElementById('gear-equipped');
    var inventory = document.getElementById('gear-inventory');

    document.getElementById('gear-text').textContent = gear.equipped.length === 0
      ? 'No gear is equipped.'
      : 'You are showing ' + gear.equipped.length + (gear.equipped.length === 1 ? ' piece' : ' pieces')
        + ' of gear.';

    equipped.textContent = '';
    gear.equipped.forEach(function (item) {
      var image = make('img', '', '');

      image.src = item.image;
      image.alt = item.name;
      equipped.appendChild(image);
    });

    inventory.textContent = '';
    gear.inventory.forEach(function (item) {
      inventory.appendChild(make('li', 'list-group-item', item.name));
    });

    if (gear.inventory.length === 0) {
      inventory.appendChild(make('li', 'list-group-item', 'Nothing else in your inventory.'));
    }
  }


  /* ==========================================================
     ACTIONS
     ========================================================== */

  /**
   * Sends an action on a quest, after asking first, tells the
   * adventurer what happened, and draws the account again. It is drawn
   * again whatever the outcome, so a refusal because something changed
   * shows things as they now are.
   *
   * @param {string} url the address
   * @param {string} question what to ask before sending
   * @param {string} done what to say when it worked
   */
  function sendAction(url, question, done) {
    if (!window.confirm(question)) {
      return;
    }

    announce(null, '');

    fetch(url, { method: 'POST', headers: { Accept: 'application/json' } }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (data) {
        return { ok: response.ok, data: data };
      });
    }).then(function (result) {
      if (result.ok) {
        announce(questsNotice, done);
      } else {
        announce(questsFailure, result.data.error || 'Something went wrong. Please try again.');
      }

      load(true);
    }).catch(function () {
      announce(questsFailure, 'The guild hall could not be reached. Check your connection and try again.');
    });
  }


  /* ==========================================================
     HIRE REQUESTS
     ========================================================== */

  /**
   * Builds the row for one hire request.
   *
   * @param {Object} hire one entry from the server's list
   * @returns {HTMLElement} the table row
   */
  function createHireRow(hire) {
    var row = document.createElement('tr');
    var titleCell = document.createElement('td');
    var answerCell = document.createElement('td');
    var accept;

    titleCell.appendChild(questLink(hire));
    titleCell.appendChild(make('div', 'small text-body-secondary', hire.location));

    accept = make('button', 'btn btn-sm btn-primary', 'Accept');
    accept.type = 'button';
    accept.disabled = !hire.canAccept;
    accept.setAttribute('aria-label', 'Accept ' + hire.title);
    accept.addEventListener('click', function () {
      sendAction('/api/quests/' + encodeURIComponent(hire.id) + '/accept',
        'Accept "' + hire.title + '"? You will be on it until it is finished, and cannot take another.',
        'You have accepted "' + hire.title + '". It is now under My Quests.');
    });
    answerCell.appendChild(accept);

    if (!hire.canAccept) {
      answerCell.appendChild(make('div', 'small text-body-secondary', 'You are on a quest already.'));
    }

    row.appendChild(titleCell);
    row.appendChild(make('td', '', hire.postedBy));
    row.appendChild(make('td', '', hire.reward));
    row.appendChild(answerCell);

    return row;
  }

  /**
   * Draws the hire requests.
   *
   * @param {Array<Object>} hires the requests from the server
   */
  function drawHires(hires) {
    hiresBody.textContent = '';

    hires.forEach(function (hire) {
      hiresBody.appendChild(createHireRow(hire));
    });

    hiresTable.classList.toggle('d-none', hires.length === 0);
    hiresCount.textContent = hires.length === 0
      ? 'Nobody has hired you at the moment.'
      : hires.length + (hires.length === 1 ? ' quest is' : ' quests are') + ' addressed to you alone.';
  }


  /* ==========================================================
     THE QUESTS
     ========================================================== */

  /**
   * Builds the row for one quest the adventurer holds or held.
   *
   * @param {Object} quest one entry from the server's list
   * @returns {HTMLElement} the table row
   */
  function createQuestRow(quest) {
    var row = document.createElement('tr');
    var titleCell = document.createElement('td');
    var actionsCell = document.createElement('td');
    var done;
    var status;

    titleCell.appendChild(questLink(quest));
    titleCell.appendChild(make('div', 'small text-body-secondary',
      quest.official ? 'Posted by the guild' : 'Posted by ' + quest.postedBy));

    status = (quest.status === 'matched' && PROGRESS_LABELS[quest.progress])
      || STATUS_LABELS[quest.status] || quest.status;

    if (quest.status === 'completed' && quest.finishedAt) {
      status += ' on ' + window.guildGuild.formatDate(quest.finishedAt);
    }

    if (quest.canMarkDone) {
      done = make('button', 'btn btn-sm btn-primary', 'Mark as done');
      done.type = 'button';
      done.setAttribute('aria-label', 'Mark ' + quest.title + ' as done');
      done.addEventListener('click', function () {
        sendAction('/api/quests/' + encodeURIComponent(quest.id) + '/done',
          'Mark "' + quest.title + '" as done? The customer who posted it will be asked to confirm.',
          '"' + quest.title + '" is marked as done. The customer confirms next.');
      });
      actionsCell.appendChild(done);
    } else {
      actionsCell.appendChild(make('span', 'text-body-secondary', 'None'));
    }

    row.appendChild(titleCell);
    row.appendChild(make('td', '', status));
    row.appendChild(actionsCell);

    return row;
  }

  /**
   * Draws the quests table.
   *
   * @param {Array<Object>} quests the quests from the server
   */
  function drawQuests(quests) {
    questsBody.textContent = '';

    quests.forEach(function (quest) {
      questsBody.appendChild(createQuestRow(quest));
    });

    questsTable.classList.toggle('d-none', quests.length === 0);
    questsCount.textContent = quests.length === 0
      ? 'You have not accepted any quests yet.'
      : 'Showing all ' + quests.length + (quests.length === 1 ? ' quest' : ' quests') + ', the ones under way first.';
  }


  /* ==========================================================
     ASKING THE SERVER
     ========================================================== */

  /**
   * Fetches the account and draws it.
   *
   * @param {boolean} keepNotice whether to leave the message about the
   *   action that caused this reload on the page
   */
  function load(keepNotice) {
    fetch('/api/my/account', { headers: { Accept: 'application/json' } }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, data: data };
      });
    }).then(function (result) {
      if (!result.ok || result.data.role !== 'adventurer') {
        throw new Error('The server refused the request');
      }

      if (!keepNotice) {
        announce(null, '');
      }

      drawProfile(result.data.profile);
      drawGear(result.data.gear);
      drawHires(result.data.hires);
      drawQuests(result.data.quests);
      errorNotice.classList.add('d-none');
    }).catch(function () {
      errorNotice.classList.remove('d-none');
      subtitle.textContent = 'Your account could not be loaded.';
    });
  }

  retryButton.addEventListener('click', function () {
    load(false);
  });

  load(false);

}());
