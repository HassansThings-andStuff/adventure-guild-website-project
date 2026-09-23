/* ============================================================
   Oceania Adventure Guild - administration page behaviour
   SIT774 Website Project, Part 3 (Task 10.2D)

   Loaded on the administration page only, which only an
   administrator account can open.

   Draws the quests an adventurer has accepted and not yet finished,
   with the two things the guild does to them: verify the work once
   the adventurer has said it is done and the customer has confirmed
   it, and cancel a quest that should not go on.

   The server decides whether a quest can be verified, and this only
   draws the answer. It checks again when the button is pressed,
   because the page may be out of date. Every value from the server is
   written into the page as text, never as markup.
   ============================================================ */

(function () {
  'use strict';

  var body = document.getElementById('verify-body');

  // Defensive guard, in case the script is loaded elsewhere.
  if (!body) {
    return;
  }

  var table = document.getElementById('verify-table');
  var count = document.getElementById('verify-count');
  var notice = document.getElementById('verify-notice');
  var failure = document.getElementById('verify-failure');

  var STAGES = {
    in_progress: 'In progress',
    awaiting_confirmation: 'Marked done, awaiting the customer',
    awaiting_verification: 'Ready to verify'
  };


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
   * Shows one message above the table and hides the other.
   *
   * @param {HTMLElement|null} shown the message element to show, or null for none
   * @param {string} text what it says
   */
  function announce(shown, text) {
    notice.classList.add('d-none');
    failure.classList.add('d-none');

    if (shown) {
      shown.textContent = text;
      shown.classList.remove('d-none');
    }
  }

  /**
   * Sends one of the guild's actions on a quest, after asking first,
   * and then draws the list again.
   *
   * @param {Object} quest the quest, from the list
   * @param {string} action 'verify' or 'cancel'
   */
  function act(quest, action) {
    var question = action === 'verify'
      ? 'Verify "' + quest.title + '" as complete? It will be marked completed and the adventurer '
        + 'will be free to take another.'
      : 'Cancel "' + quest.title + '"? It cannot be reopened, and the adventurer is released.';

    if (!window.confirm(question)) {
      return;
    }

    announce(null, '');

    fetch('/api/admin/quests/' + encodeURIComponent(quest.id) + '/' + action, {
      method: 'POST',
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (data) {
        return { ok: response.ok, data: data };
      });
    }).then(function (result) {
      if (result.ok) {
        announce(notice, action === 'verify'
          ? '"' + quest.title + '" is verified and complete.'
          : '"' + quest.title + '" has been cancelled.');
      } else {
        announce(failure, result.data.error || 'Something went wrong. Please try again.');
      }

      load();
    }).catch(function () {
      announce(failure, 'The guild hall could not be reached. Check your connection and try again.');
    });
  }

  /**
   * Builds the row for one quest.
   *
   * @param {Object} quest one entry from the server's list
   * @returns {HTMLElement} the table row
   */
  function createRow(quest) {
    var row = document.createElement('tr');
    var titleCell = document.createElement('td');
    var posterCell = document.createElement('td');
    var actionsCell = document.createElement('td');
    var link = make('a', '', quest.title);
    var verify;
    var cancel;

    link.href = 'quest-detail.html?id=' + encodeURIComponent(quest.id);
    titleCell.appendChild(link);

    posterCell.textContent = quest.poster;

    if (quest.official) {
      posterCell.appendChild(make('div', 'small text-body-secondary', 'The guild (no customer step)'));
    }

    verify = make('button', 'btn btn-sm btn-primary me-1', 'Verify');
    verify.type = 'button';
    verify.disabled = !quest.canVerify;
    verify.setAttribute('aria-label', 'Verify ' + quest.title);
    verify.addEventListener('click', function () {
      act(quest, 'verify');
    });

    cancel = make('button', 'btn btn-sm btn-outline-danger', 'Cancel');
    cancel.type = 'button';
    cancel.setAttribute('aria-label', 'Cancel ' + quest.title);
    cancel.addEventListener('click', function () {
      act(quest, 'cancel');
    });

    actionsCell.appendChild(verify);
    actionsCell.appendChild(cancel);

    row.appendChild(titleCell);
    row.appendChild(posterCell);
    row.appendChild(make('td', '', quest.adventurer || 'Not recorded'));
    row.appendChild(make('td', '', STAGES[quest.progress] || quest.progress));
    row.appendChild(actionsCell);

    return row;
  }

  /**
   * Fetches the quests under way and draws them.
   */
  function load() {
    fetch('/api/admin/quests/matched', { headers: { Accept: 'application/json' } }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, data: data };
      });
    }).then(function (result) {
      var ready;

      if (!result.ok) {
        throw new Error('The server refused the request');
      }

      body.textContent = '';
      result.data.quests.forEach(function (quest) {
        body.appendChild(createRow(quest));
      });

      ready = result.data.quests.filter(function (quest) {
        return quest.canVerify;
      }).length;

      table.classList.toggle('d-none', result.data.quests.length === 0);
      count.textContent = result.data.quests.length === 0
        ? 'No quests are in progress.'
        : result.data.quests.length + (result.data.quests.length === 1 ? ' quest is' : ' quests are')
          + ' in progress, and ' + ready + (ready === 1 ? ' is' : ' are') + ' ready to verify.';
    }).catch(function () {
      count.textContent = 'The quests could not be loaded. Reload the page to try again.';
      table.classList.add('d-none');
    });
  }

  load();

}());
