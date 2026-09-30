/* ============================================================
   Oceania Adventure Guild - customer account behaviour
   SIT774 Website Project, Part 3 (Task 10.2D)

   Loaded on the customer's My Account page only.

   The page is a shell. This file asks /api/my/account for the
   logged in customer's profile, their posted quests and their
   orders, and draws them. The server decides which account: it
   uses the login held in the session, and nothing in the address
   or the request can name a different one.

   What can be done to each quest is decided by the server too, and
   only drawn here. A draft can be edited or deleted, and a quest on
   the board can be edited or cancelled. A quest an adventurer holds
   can be cancelled until they say the work is done, and then the
   customer confirms it. Everything else is out of the customer's
   hands, and shows no action.

   Task 10.3HD adds Auto-Party (Task 7.3HD, Figure 6). A quest being
   matched shows that it is searching, and can be cancelled but not
   edited. A quest whose search found nobody can be searched again
   (Retry) or cancelled. The Current Quests panel names the adventurer
   on each quest under way, with their rank. The page is drawn again
   whenever an Auto-Party notice arrives, so a match shows up here
   without a reload. The catch-up banner is looked after by
   auto-party.js.

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
  var portrait = document.getElementById('account-portrait');
  var nameField = document.getElementById('account-name');
  var memberField = document.getElementById('account-member');
  var aboutField = document.getElementById('account-about');

  var questsCount = document.getElementById('quests-count');
  var questsNotice = document.getElementById('quests-notice');
  var questsFailure = document.getElementById('quests-failure');
  var filterButton = document.getElementById('quests-filter');

  var currentPanel = document.getElementById('current-quest');
  var currentList = document.getElementById('current-quest-list');

  var ordersEmpty = document.getElementById('orders-empty');
  var ordersTable = document.getElementById('orders-table');
  var ordersBody = document.getElementById('orders-body');

  var STATUS_LABELS = {
    draft: 'Draft',
    open: 'Open',
    matched: 'Matched',
    unmatched: 'No match found',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };

  var ORDER_STATUS_LABELS = {
    placed: 'Placed',
    in_progress: 'In progress',
    ready: 'Ready to collect',
    collected: 'Collected',
    cancelled: 'Cancelled'
  };

  // The quests as last received, and whether only drafts are shown.
  var quests = [];
  var draftsOnly = false;

  // Where a quest an adventurer holds has got to in the completion chain.
  var PROGRESS_LABELS = {
    in_progress: 'In progress',
    awaiting_confirmation: 'Marked done by adventurer',
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
   * Shows a message above the quests, and hides the other one, so the
   * outcome of an action never sits beside the outcome of the last.
   *
   * @param {HTMLElement} shown the message element to show
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


  /* ==========================================================
     THE PROFILE
     ========================================================== */

  /**
   * Draws the profile panel and the heading.
   *
   * @param {Object} profile the profile from the server
   */
  function drawProfile(profile) {
    subtitle.textContent = profile.name + ', customer, member since ' + profile.memberSince + '.';

    portrait.src = profile.image;
    portrait.alt = 'Portrait of ' + profile.name;

    nameField.textContent = profile.name;
    memberField.textContent = profile.memberSince;
    aboutField.textContent = profile.bio || 'No description has been written yet.';
  }


  /* ==========================================================
     THE POSTED QUESTS
     ========================================================== */

  /**
   * Sends an action on a quest, after asking first, tells the customer
   * what happened, and draws the list again. The list is drawn again
   * whatever the outcome, so a refusal shows the quest as it now is.
   *
   * @param {string} method DELETE or POST
   * @param {string} url the address
   * @param {Object} question the confirm dialogue: message, confirmLabel, and danger if it removes something
   * @param {function(Object): string} done says what happened, from the server's reply
   */
  function sendAction(method, url, question, done) {
    window.guildGuild.confirmDialog(question).then(function (confirmed) {
      if (!confirmed) {
        return;
      }

      announce(null, '');

      fetch(url, { method: method, headers: { Accept: 'application/json' } }).then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (data) {
          return { ok: response.ok, data: data };
        });
      }).then(function (result) {
        if (result.ok) {
          announce(questsNotice, done(result.data));
        } else {
          announce(questsFailure, result.data.error || 'Something went wrong. Please try again.');
        }

        load(true);
      }).catch(function () {
        announce(questsFailure, 'The guild hall could not be reached. Check your connection and try again.');
      });
    });
  }

  /**
   * Removes a quest: a draft is deleted, and a quest that has been on
   * the board is cancelled. Neither can be undone from here. An
   * Auto-Party quest is asked about in the words of Figure 9.
   *
   * @param {Object} quest the quest to remove
   */
  function removeQuest(quest) {
    var isDelete = quest.removeAction === 'delete';
    var message;

    if (isDelete) {
      message = 'Delete the draft "' + quest.title + '"? It cannot be recovered.';
    } else if (quest.autoParty) {
      message = 'Cancel ' + quest.title + '? This will end the search and notify any adventurer involved.';
    } else {
      message = 'Cancel "' + quest.title + '"? It will leave the quest board, and cannot be reopened.'
        + (quest.adventurer ? ' ' + quest.adventurer + ' will be released.' : '');
    }

    sendAction('DELETE', '/api/quests/' + encodeURIComponent(quest.id),
      { message: message, confirmLabel: isDelete ? 'Delete Draft' : 'Cancel Quest', danger: true },
      function (data) {
        return data.result === 'deleted'
          ? 'The draft "' + quest.title + '" has been deleted.'
          : '"' + quest.title + '" has been cancelled and is off the quest board.';
      });
  }

  /**
   * Confirms that the adventurer's work on a quest was done.
   *
   * @param {Object} quest the quest to confirm
   */
  function confirmQuest(quest) {
    sendAction('POST', '/api/quests/' + encodeURIComponent(quest.id) + '/confirm',
      {
        message: 'Confirm that ' + (quest.adventurer || 'the adventurer') + ' has done the work on "'
          + quest.title + '"? The guild then verifies it.',
        confirmLabel: 'Confirm Completion'
      },
      function () {
        return 'Thank you. "' + quest.title + '" is confirmed, and the guild verifies it next.';
      });
  }

  /**
   * Searches again for an adventurer for a quest whose Auto-Party
   * search found nobody (Figure 9, Retrigger). The same criteria are
   * used; adventurers who declined it are still left out.
   *
   * @param {Object} quest the quest to search for again
   */
  function retryQuest(quest) {
    sendAction('POST', '/api/quests/' + encodeURIComponent(quest.id) + '/retrigger',
      { message: 'Search for a new adventurer for ' + quest.title + '?', confirmLabel: 'Search Again' },
      function (data) {
        return data.quest && data.quest.status === 'unmatched'
          ? 'Auto-Party searched again for "' + quest.title + '", but there is still nobody suitable and free.'
          : 'Auto-Party is searching again for an adventurer for "' + quest.title + '".';
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
    var actionsCell = document.createElement('td');
    var link;
    var edit;
    var remove;
    var confirmButton;
    var searchAgain;

    // A draft has no public page of its own worth linking to from here,
    // but the customer can open it like any other of their quests.
    link = make('a', '', quest.title);
    link.href = 'quest-detail.html?id=' + encodeURIComponent(quest.id);
    titleCell.appendChild(link);

    if (quest.hiring) {
      titleCell.appendChild(make('div', 'small text-body-secondary', 'Addressed to ' + quest.hiring));
    } else if (quest.adventurer) {
      titleCell.appendChild(make('div', 'small text-body-secondary', 'Taken by ' + quest.adventurer));
    } else if (quest.autoParty && quest.status !== 'cancelled' && quest.status !== 'completed') {
      titleCell.appendChild(make('div', 'small text-body-secondary', 'Auto-Party'));
    }

    row.appendChild(titleCell);
    row.appendChild(make('td', '', quest.searching
      ? 'Searching for an adventurer'
      : (quest.status === 'matched' && PROGRESS_LABELS[quest.progress])
        || STATUS_LABELS[quest.status] || quest.status));

    if (quest.canRetrigger) {
      searchAgain = make('button', 'btn btn-sm btn-primary me-1', 'Retry');
      searchAgain.type = 'button';
      searchAgain.setAttribute('aria-label', 'Search again for an adventurer for ' + quest.title);
      searchAgain.addEventListener('click', function () {
        retryQuest(quest);
      });
      actionsCell.appendChild(searchAgain);
    }

    if (quest.canConfirm) {
      confirmButton = make('button', 'btn btn-sm btn-primary me-1', 'Confirm completion');
      confirmButton.type = 'button';
      confirmButton.setAttribute('aria-label', 'Confirm completion of ' + quest.title);
      confirmButton.addEventListener('click', function () {
        confirmQuest(quest);
      });
      actionsCell.appendChild(confirmButton);
    }

    if (quest.canEdit) {
      edit = make('a', 'btn btn-sm btn-outline-secondary me-1', 'Edit');
      edit.href = '/post-quest?id=' + encodeURIComponent(quest.id);
      edit.setAttribute('aria-label', 'Edit ' + quest.title);
      actionsCell.appendChild(edit);
    }

    if (quest.removeAction) {
      remove = make('button', 'btn btn-sm btn-outline-danger',
        quest.removeAction === 'delete' ? 'Delete' : 'Cancel');
      remove.type = 'button';
      remove.setAttribute('aria-label',
        (quest.removeAction === 'delete' ? 'Delete ' : 'Cancel ') + quest.title);
      remove.addEventListener('click', function () {
        removeQuest(quest);
      });
      actionsCell.appendChild(remove);
    }

    if (!quest.canEdit && !quest.removeAction && !quest.canConfirm && !quest.canRetrigger) {
      actionsCell.appendChild(make('span', 'text-body-secondary', 'None'));
    }

    row.appendChild(actionsCell);

    return row;
  }

  /**
   * Draws the quests table, showing every quest or only the drafts.
   */
  function drawQuests() {
    var shown = quests.filter(function (quest) {
      return !draftsOnly || quest.status === 'draft';
    });

    questsBody.textContent = '';

    shown.forEach(function (quest) {
      questsBody.appendChild(createRow(quest));
    });

    if (quests.length === 0) {
      questsCount.textContent = 'You have not posted any quests yet.';
    } else if (draftsOnly) {
      questsCount.textContent = shown.length === 0
        ? 'You have no drafts.'
        : 'Showing ' + shown.length + ' of ' + quests.length + ' quests, drafts only.';
    } else {
      questsCount.textContent = 'Showing all ' + quests.length + ' of your quests.';
    }

    document.getElementById('quests-table').classList.toggle('d-none', shown.length === 0);
    filterButton.textContent = draftsOnly ? 'Show all quests' : 'Show drafts only';
    filterButton.setAttribute('aria-pressed', draftsOnly ? 'true' : 'false');
  }


  /* ==========================================================
     CURRENT QUESTS (Task 7.3HD, Figure 6)
     ========================================================== */

  /**
   * Draws one row for each quest an adventurer is working on, naming
   * them and their rank, or hides the panel when there are none.
   */
  function drawCurrent() {
    var current = quests.filter(function (quest) {
      return quest.status === 'matched';
    });

    currentList.textContent = '';

    current.forEach(function (quest) {
      var item = make('li', 'd-flex flex-wrap align-items-center gap-2', '');
      var text = make('div', '', '');
      var who = make('div', 'small', '');
      var details = make('a', 'btn btn-sm btn-outline-secondary ms-auto', 'Quest details');
      var rank;

      text.appendChild(make('strong', '', quest.title));

      who.appendChild(document.createTextNode((quest.adventurer || 'An adventurer') + ' '));
      if (quest.adventurerRank) {
        rank = make('span', 'rank-badge rank-' + quest.adventurerRank,
          quest.adventurerRank.charAt(0).toUpperCase() + quest.adventurerRank.slice(1));
        who.appendChild(rank);
      }
      who.appendChild(document.createTextNode(' ' + (PROGRESS_LABELS[quest.progress] || 'In progress').toLowerCase() + '.'));
      text.appendChild(who);

      details.href = 'quest-detail.html?id=' + encodeURIComponent(quest.id);
      details.setAttribute('aria-label', 'Quest details for ' + quest.title);

      item.appendChild(text);
      item.appendChild(details);
      currentList.appendChild(item);
    });

    currentPanel.classList.toggle('d-none', current.length === 0);
  }


  /* ==========================================================
     THE ORDERS
     ========================================================== */

  /**
   * Draws the order history, one row for each order.
   *
   * @param {Array<Object>} orders the orders from the server
   */
  function drawOrders(orders) {
    ordersBody.textContent = '';

    orders.forEach(function (order) {
      var row = document.createElement('tr');
      var dateCell = document.createElement('td');
      var time = make('time', '', window.guildGuild.formatDate(order.placedAt));

      time.setAttribute('datetime', order.placedAt);
      dateCell.appendChild(time);

      row.appendChild(make('td', '', '#' + order.id));
      row.appendChild(make('td', '', order.lines.map(function (line) {
        return line.name + ' x ' + line.quantity;
      }).join(', ')));
      row.appendChild(dateCell);
      row.appendChild(make('td', '', order.total.toLocaleString('en-AU') + ' gold'));
      row.appendChild(make('td', '', ORDER_STATUS_LABELS[order.status] || order.status));
      ordersBody.appendChild(row);
    });

    ordersTable.classList.toggle('d-none', orders.length === 0);
    ordersEmpty.classList.toggle('d-none', orders.length > 0);
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
      if (!result.ok) {
        throw new Error('The server refused the request');
      }

      if (!keepNotice) {
        announce(null, '');
      }

      quests = result.data.quests;
      drawProfile(result.data.profile);
      drawCurrent();
      drawQuests();
      drawOrders(result.data.orders);
      errorNotice.classList.add('d-none');
    }).catch(function () {
      errorNotice.classList.remove('d-none');
      subtitle.textContent = 'Your account could not be loaded.';
    });
  }

  filterButton.addEventListener('click', function () {
    draftsOnly = !draftsOnly;
    drawQuests();
  });

  retryButton.addEventListener('click', function () {
    load(false);
  });

  // Every Auto-Party notice a customer receives changes a quest listed
  // here: searching, matched, no match found, or cancelled.
  window.addEventListener('guild:autoparty', function () {
    load(true);
  });

  load(false);

}());
