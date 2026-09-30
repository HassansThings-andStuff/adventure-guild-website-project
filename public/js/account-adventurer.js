/* ============================================================
   Oceania Adventure Guild - adventurer account behaviour
   SIT774 Website Project, Part 3 (Task 10.2D),
   extended for Auto-Party (Task 10.3HD)

   Loaded on the adventurer's My Account page only.

   The page is a shell. This file asks /api/my/account for the logged
   in adventurer's profile, gear, the quests they hold or have
   finished, and any quest a customer has hired them for, and draws
   them. The server decides which account: it uses the login held in
   the session, and nothing in the address or the request can name a
   different one.

   The adventurer's own actions here: answer a hire request by
   accepting or declining it, mark a quest they hold as done, edit
   their profile (profile-edit.js) and set their availability in its
   own panel beside Auto-Party. Declining, editing and availability
   were added in Housekeeping 2. The customer who
   posted it then confirms, and the guild verifies. Whether each button
   is offered is decided by the server and only drawn here, and the
   server checks again when it is pressed.

   Task 10.3HD adds the Current Quest panel and the Auto-Party switch
   with its quest-type preferences (Task 7.3HD, Figure 2). Each change
   to the switch or a quest type is saved as it is made. The page is
   drawn again whenever an Auto-Party notice arrives, so a match made
   from the banner shows up here without a reload. The catch-up and
   launch banners on this page are looked after by auto-party.js.

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

  var currentPanel = document.getElementById('current-quest');
  var currentList = document.getElementById('current-quest-list');

  var toggle = document.getElementById('auto-party-toggle');
  var typeSet = document.getElementById('auto-party-types');
  var typeList = document.getElementById('auto-party-type-list');
  var autoPartyState = document.getElementById('auto-party-state');

  // The six quest types, in the order the Post a Quest form lists them.
  var QUEST_TYPES = [
    { value: 'combat', label: 'Combat' },
    { value: 'escort', label: 'Escort' },
    { value: 'retrieval', label: 'Retrieval' },
    { value: 'investigation', label: 'Investigation' },
    { value: 'rescue', label: 'Rescue' },
    { value: 'delivery', label: 'Delivery' }
  ];

  // Whether the adventurer is on a quest, or has set themselves
  // unavailable, for the sentence under the Auto-Party switch.
  var onQuest = false;
  var away = false;

  // Edit profile (profile-edit.js). Saving returns the whole account,
  // which is drawn the same way as a load. Declared before draw uses it.
  var profileEditor = window.guildProfileEditor
    ? window.guildProfileEditor({ onSaved: function (account) { draw(account); } })
    : { fill: function () {} };

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
  function describeAvailability(profile) {
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
    document.getElementById('account-availability').textContent = describeAvailability(profile);
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
   * @param {string} label the confirm button, naming the action
   * @param {string} done what to say when it worked
   */
  function sendAction(url, question, label, done) {
    window.guildGuild.confirmDialog({ message: question, confirmLabel: label }).then(function (confirmed) {
      if (confirmed) {
        send(url, done);
      }
    });
  }

  /**
   * Sends an action that has been confirmed. See sendAction.
   *
   * @param {string} url the address
   * @param {string} done what to say when it worked
   */
  function send(url, done) {
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
    var decline;

    titleCell.appendChild(questLink(hire));
    titleCell.appendChild(make('div', 'small text-body-secondary', hire.location));

    accept = make('button', 'btn btn-sm btn-primary', 'Accept');
    accept.type = 'button';
    accept.disabled = !hire.canAccept;
    accept.setAttribute('aria-label', 'Accept ' + hire.title);
    accept.addEventListener('click', function () {
      sendAction('/api/quests/' + encodeURIComponent(hire.id) + '/accept',
        'Accept "' + hire.title + '"? You will be on it until it is finished, and cannot take another.',
        'Accept',
        'You have accepted "' + hire.title + '". It is now under My Quests.');
    });
    answerCell.appendChild(accept);

    // Declining a hire (Housekeeping 2) mirrors Auto-Party's decline.
    // The quest goes back to the customer as a draft.
    decline = make('button', 'btn btn-sm btn-outline-secondary ms-1', 'Decline');
    decline.type = 'button';
    decline.setAttribute('aria-label', 'Decline ' + hire.title);
    decline.addEventListener('click', function () {
      sendAction('/api/quests/' + encodeURIComponent(hire.id) + '/decline-hire',
        'Decline "' + hire.title + '"? It goes back to ' + hire.postedBy
          + ', who can post it to the board or hire someone else.',
        'Decline',
        'You have declined "' + hire.title + '". It has gone back to ' + hire.postedBy + ', who has been told.');
    });
    answerCell.appendChild(decline);

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
          'Mark as done',
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
     CURRENT QUEST (Task 7.3HD, Figure 2)
     ========================================================== */

  /**
   * Draws the quest the adventurer is on now, or hides the panel when
   * there is none.
   *
   * @param {Array<Object>} quests the quests from the server
   */
  function drawCurrent(quests) {
    var current = quests.filter(function (quest) {
      return quest.status === 'matched';
    });

    currentList.textContent = '';

    current.forEach(function (quest) {
      var item = make('li', 'd-flex flex-wrap align-items-center gap-2', '');
      var details = make('a', 'btn btn-sm btn-outline-secondary ms-auto', 'Quest details');
      var text = make('div', '', '');

      details.href = 'quest-detail.html?id=' + encodeURIComponent(quest.id);
      details.setAttribute('aria-label', 'Quest details for ' + quest.title);

      text.appendChild(make('strong', '', quest.title));
      text.appendChild(make('div', 'small text-body-secondary',
        (quest.official ? 'Posted by the guild' : 'Posted by ' + quest.postedBy)
        + '. ' + (PROGRESS_LABELS[quest.progress] || 'In progress') + '.'));

      item.appendChild(text);
      item.appendChild(details);
      currentList.appendChild(item);
    });

    currentPanel.classList.toggle('d-none', current.length === 0);
  }


  /* ==========================================================
     AUTO-PARTY SETTINGS (Task 7.3HD, Figures 1 and 2)
     ========================================================== */

  /**
   * Builds the six quest-type checkboxes, once.
   */
  function buildTypeList() {
    QUEST_TYPES.forEach(function (type) {
      var column = make('div', 'col', '');
      var wrap = make('div', 'form-check', '');
      var box = make('input', 'form-check-input', '');
      var label = make('label', 'form-check-label', type.label);

      box.type = 'checkbox';
      box.id = 'auto-party-type-' + type.value;
      box.value = type.value;
      box.name = 'questTypes';
      label.htmlFor = box.id;

      box.addEventListener('change', saveAutoParty);

      wrap.appendChild(box);
      wrap.appendChild(label);
      column.appendChild(wrap);
      typeList.appendChild(column);
    });
  }

  /**
   * The quest types currently ticked.
   *
   * @returns {Array<string>} their values
   */
  function chosenTypes() {
    return Array.prototype.filter.call(typeList.querySelectorAll('input'), function (box) {
      return box.checked;
    }).map(function (box) {
      return box.value;
    });
  }

  /**
   * Says in a sentence what the saved setting means.
   *
   * @param {{optIn: boolean, questTypes: Array<string>}} setting as saved
   * @returns {string} the sentence
   */
  function describeSetting(setting) {
    var names;

    if (!setting.optIn) {
      return 'Auto-Party is off. You will not be offered quests automatically.';
    }

    if (setting.questTypes.length === 0) {
      return 'Auto-Party is on, but no quest types are chosen, so no offers will come. '
        + 'Tick at least one quest type.';
    }

    names = QUEST_TYPES.filter(function (type) {
      return setting.questTypes.indexOf(type.value) !== -1;
    }).map(function (type) {
      return type.label.toLowerCase();
    });

    // "combat", "combat and escort", "combat, escort and rescue"
    names = names.length > 1
      ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
      : names[0];

    // Availability decides whether offers arrive now or later.
    return 'Auto-Party is on. You will be offered ' + names + ' quests'
      + (onQuest ? ' once your current quest is finished.'
        : away ? ' once you are available again (see Availability above).'
          : ' while you are free.');
  }

  /**
   * Puts the saved setting on the switch and the checkboxes.
   *
   * @param {{optIn: boolean, questTypes: Array<string>}} setting as saved
   */
  function drawAutoParty(setting) {
    toggle.checked = setting.optIn;
    typeSet.disabled = !setting.optIn;

    typeList.querySelectorAll('input').forEach(function (box) {
      box.checked = setting.questTypes.indexOf(box.value) !== -1;
    });

    autoPartyState.textContent = describeSetting(setting);
  }

  /**
   * Saves the switch and the quest types together, as they stand.
   * While the request is out, the controls are held, so two quick
   * changes cannot arrive in the wrong order. Whatever the server
   * then says was saved is drawn, so the page never shows a setting
   * that was not kept.
   */
  function saveAutoParty() {
    var wanted = { optIn: toggle.checked, questTypes: chosenTypes() };

    typeSet.disabled = true;
    toggle.disabled = true;
    autoPartyState.textContent = 'Saving';

    fetch('/api/my/auto-party', {
      method: 'PATCH',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(wanted)
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (data) {
        return { ok: response.ok, data: data };
      });
    }).then(function (result) {
      toggle.disabled = false;

      if (!result.ok) {
        throw new Error(result.data.error || 'refused');
      }

      drawAutoParty(result.data.autoParty);
    }).catch(function () {
      // Left as the adventurer set it, so trying again is one click,
      // with a sentence saying it was not kept.
      toggle.disabled = false;
      typeSet.disabled = !toggle.checked;
      autoPartyState.textContent = 'Your Auto-Party setting could not be saved. '
        + 'Check your connection and try again.';
    });
  }


  /* ==========================================================
     AVAILABILITY (Housekeeping 2, Task 10.3HD)

     Its own panel beside Auto-Party, because it is what decides
     whether Auto-Party offers this adventurer anything. Change
     availability opens the choice in place; saving sends it to
     PATCH /api/my/availability, which checks it again and answers
     with the whole account, drawn like any other load.
     ========================================================== */

  var availabilityLine = document.getElementById('availability-text');
  var availabilityButton = document.getElementById('availability-change');
  var availabilityLocked = document.getElementById('availability-locked');
  var availabilityForm = document.getElementById('availability-form');
  var availabilitySaved = document.getElementById('availability-saved');
  var availabilityFailure = document.getElementById('availability-failure');
  var untilWrap = document.getElementById('availability-until-wrap');
  var untilField = document.getElementById('availability-until');
  var untilError = document.getElementById('availability-until-error');
  var currentProfile = null;

  /**
   * Today's date plus a number of days, as YYYY-MM-DD in local time.
   *
   * @param {number} days how many days ahead
   * @returns {string} the date
   */
  function dayFromToday(days) {
    var date = new Date();

    date.setDate(date.getDate() + days);

    return date.getFullYear() + '-'
      + String(date.getMonth() + 1).padStart(2, '0') + '-'
      + String(date.getDate()).padStart(2, '0');
  }

  function chosenAvailability() {
    var picked = availabilityForm.querySelector('input[name="availability"]:checked');

    return picked ? picked.value : 'available';
  }

  // The return date only means something when unavailable.
  function showUntil() {
    untilWrap.classList.toggle('d-none', chosenAvailability() !== 'unavailable');
  }

  function clearUntilError() {
    untilError.textContent = '';
    untilField.classList.remove('is-invalid');
    untilField.removeAttribute('aria-invalid');
  }

  /**
   * Draws the panel. On a quest, the Change button is switched off
   * with a sentence saying why, the same way a quest's Accept button
   * is switched off when it cannot be used.
   *
   * @param {Object} profile the profile from the server
   */
  function drawAvailability(profile) {
    currentProfile = profile;
    availabilityLine.textContent = 'Right now: ' + describeAvailability(profile) + '.';
    availabilityButton.disabled = profile.availability === 'on_quest';
    availabilityLocked.classList.toggle('d-none', profile.availability !== 'on_quest');

    if (profile.availability === 'on_quest') {
      closeAvailability(false);
    }
  }

  function openAvailability() {
    var value = currentProfile.availability === 'unavailable' ? 'unavailable' : 'available';

    availabilityForm.querySelector('input[value="' + value + '"]').checked = true;
    untilField.value = currentProfile.unavailableUntil || '';
    untilField.min = dayFromToday(1);
    untilField.max = dayFromToday(365);
    clearUntilError();
    availabilityFailure.classList.add('d-none');
    availabilitySaved.classList.add('d-none');
    showUntil();

    availabilityForm.classList.remove('d-none');
    availabilityButton.setAttribute('aria-expanded', 'true');
    availabilityForm.querySelector('input[name="availability"]:checked').focus();
  }

  function closeAvailability(returnFocus) {
    availabilityForm.classList.add('d-none');
    availabilityButton.setAttribute('aria-expanded', 'false');

    if (returnFocus) {
      availabilityButton.focus();
    }
  }

  function saveAvailability(event) {
    var submit = availabilityForm.querySelector('button[type="submit"]');
    var wanted = { availability: chosenAvailability(), unavailableUntil: '' };

    event.preventDefault();
    clearUntilError();
    availabilityFailure.classList.add('d-none');

    if (wanted.availability === 'unavailable') {
      wanted.unavailableUntil = untilField.value;

      // Checked here first; the server checks again.
      if (wanted.unavailableUntil && (wanted.unavailableUntil < dayFromToday(1)
          || wanted.unavailableUntil > dayFromToday(365))) {
        untilError.textContent = wanted.unavailableUntil < dayFromToday(1)
          ? 'Choose a date after today.'
          : 'Choose a date within the next year.';
        untilField.classList.add('is-invalid');
        untilField.setAttribute('aria-invalid', 'true');
        untilField.focus();
        return;
      }
    }

    submit.disabled = true;

    fetch('/api/my/availability', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(wanted)
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (data) {
        return { ok: response.ok, data: data };
      });
    }).then(function (result) {
      submit.disabled = false;

      if (!result.ok) {
        if (result.data.fields && result.data.fields.unavailableUntil) {
          untilError.textContent = result.data.fields.unavailableUntil;
          untilField.classList.add('is-invalid');
          untilField.setAttribute('aria-invalid', 'true');
        }

        availabilityFailure.textContent = result.data.error || 'Your availability could not be saved.';
        availabilityFailure.classList.remove('d-none');
        return;
      }

      closeAvailability(true);
      draw(result.data);
      availabilitySaved.textContent = 'Availability saved: ' + describeAvailability(result.data.profile) + '.';
      availabilitySaved.classList.remove('d-none');
    }).catch(function () {
      submit.disabled = false;
      availabilityFailure.textContent = 'The guild could not be reached. Please try again.';
      availabilityFailure.classList.remove('d-none');
    });
  }


  /* ==========================================================
     ASKING THE SERVER
     ========================================================== */

  /**
   * Draws the whole account from the server's answer. Used by load,
   * and by Edit profile, whose save returns the account.
   *
   * @param {Object} account the account from the server
   */
  function draw(account) {
    onQuest = account.profile.availability === 'on_quest';
    away = account.profile.availability === 'unavailable';

    drawProfile(account.profile);
    drawCurrent(account.quests);
    drawGear(account.gear);
    drawHires(account.hires);
    drawQuests(account.quests);
    drawAvailability(account.profile);
    drawAutoParty(account.autoParty);
    profileEditor.fill(account.profile);
    errorNotice.classList.add('d-none');
    window.guildGuild.refreshNotices();
  }

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

      draw(result.data);
    }).catch(function () {
      errorNotice.classList.remove('d-none');
      subtitle.textContent = 'Your account could not be loaded.';
    });
  }

  retryButton.addEventListener('click', function () {
    load(false);
  });

  toggle.addEventListener('change', saveAutoParty);

  availabilityButton.addEventListener('click', function () {
    if (availabilityForm.classList.contains('d-none')) {
      openAvailability();
    } else {
      closeAvailability(true);
    }
  });
  document.getElementById('availability-cancel').addEventListener('click', function () {
    closeAvailability(true);
  });
  availabilityForm.addEventListener('change', showUntil);
  untilField.addEventListener('input', clearUntilError);
  availabilityForm.addEventListener('submit', saveAvailability);

  // An Auto-Party notice can change this page: an accepted offer puts
  // the adventurer on a quest, and a cancellation takes them off one.
  window.addEventListener('guild:autoparty', function (event) {
    var name = event.detail.event;

    if (name === 'matched' || name === 'quest_unavailable') {
      load(true);
    }
  });

  buildTypeList();
  load(false);

}());
