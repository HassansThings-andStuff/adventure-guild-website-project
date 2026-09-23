/* ============================================================
   Oceania Adventure Guild - quest detail behaviour
   SIT774 Website Project, Part 3 (Task 10.2D)

   Loaded on quest-detail.html only.

   The page is a shell. This file reads the quest's number from
   the address (quest-detail.html?id=7), asks /api/quests/7 for
   it, and fills the shell in. Two things are decided by the
   server and simply drawn here: whether the quest exists, and
   whether this visitor may see it. A quest that does not exist
   and one the visitor may not see look identical, so the page
   cannot be used to find out which private quests are there.

   Every value from the server is written into the page as text,
   never as markup, because a quest's words are typed in by
   members.
   ============================================================ */

(function () {
  'use strict';

  var content = document.getElementById('quest-content');

  // Defensive guard, in case the script is loaded elsewhere.
  if (!content) {
    return;
  }

  var loading = document.getElementById('quest-loading');
  var notice = document.getElementById('quest-notice');
  var noticeHeading = document.getElementById('quest-notice-heading');
  var noticeText = document.getElementById('quest-notice-text');
  var crumb = document.getElementById('quest-crumb');
  var heading = document.getElementById('quest-heading');
  var description = document.getElementById('quest-description');
  var objectives = document.getElementById('quest-objectives');
  var additionalBlock = document.getElementById('quest-additional-block');
  var additional = document.getElementById('quest-additional');
  var image = document.getElementById('quest-image');
  var facts = document.getElementById('quest-facts');
  var acceptPanel = document.getElementById('quest-accept');

  var DURATION_LABELS = {
    hours: 'A few hours',
    day: 'About a day',
    'few-days': 'Two or three days',
    week: 'About a week',
    'week-plus': 'A week or more'
  };

  var STATUS_LABELS = {
    open: 'Open, accepting adventurers',
    matched: 'Matched, an adventurer has taken this quest',
    completed: 'Completed',
    cancelled: 'Cancelled',
    unmatched: 'Unmatched, no adventurer has been found',
    draft: 'Draft, visible only to you'
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
   * Adds one "Label: value" line to the details list.
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

  /**
   * Builds the rank: a coloured badge, or "Any" when none is named.
   *
   * @param {string|null} rank bronze, silver, gold or null
   * @returns {Node} the badge or the text
   */
  function rankNode(rank) {
    if (!rank) {
      return document.createTextNode('Any');
    }

    return make('span', 'rank-badge rank-' + rank, rank.charAt(0).toUpperCase() + rank.slice(1));
  }

  /**
   * Builds the posted date as a time element, so the machine
   * readable date and the human readable one travel together.
   *
   * @param {string} isoDate a date such as 2026-08-01
   * @returns {HTMLElement} the time element
   */
  function dateNode(isoDate) {
    var time = document.createElement('time');
    var parts = isoDate.split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));

    time.setAttribute('datetime', isoDate);
    time.textContent = date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    return time;
  }


  /* ==========================================================
     DRAWING THE QUEST
     ========================================================== */

  /**
   * Draws the heading. A quest posted by the guild itself carries
   * the guild voice treatment and a seal, and any other quest the
   * ordinary page plaque.
   *
   * @param {Object} quest the quest from the server
   */
  function drawHeading(quest) {
    var status = STATUS_LABELS[quest.status] || quest.status;
    var meta;
    var inner;

    heading.textContent = '';

    if (quest.isOfficial) {
      heading.className = 'guild-voice mb-4';
      heading.appendChild(make('p', 'mb-2')).appendChild(make('span', 'badge badge-seal', 'Official Guild Quest'));
      heading.appendChild(make('h1', '', quest.title));
      meta = make('p', 'guild-voice-meta mb-0');
      meta.appendChild(make('strong', '', 'Status:'));
      meta.appendChild(document.createTextNode(' ' + status));
      heading.appendChild(meta);
      return;
    }

    heading.className = 'page-plaque';
    inner = make('div', 'page-plaque-inner');
    inner.appendChild(make('h1', '', quest.title));
    inner.appendChild(make('p', 'page-plaque-subtitle', 'Status: ' + status));
    heading.appendChild(inner);
  }

  /**
   * Draws the body: description, objectives, extra information,
   * picture and the list of details.
   *
   * @param {Object} quest the quest from the server
   */
  function drawBody(quest) {
    /* A draft can be unfinished, so a blank description, objectives,
       type, location or reward is shown as a plain "not yet" rather
       than as an empty gap. */
    description.textContent = '';
    if (quest.description === '') {
      description.appendChild(make('p', '', 'No description has been written yet.'));
    }
    quest.description.split(/\n{2,}/).forEach(function (paragraph) {
      if (paragraph.trim() !== '') {
        description.appendChild(make('p', '', paragraph.trim()));
      }
    });

    objectives.textContent = '';
    if (quest.objectives.length === 0) {
      objectives.appendChild(make('li', '', 'No objectives have been listed yet.'));
    }
    quest.objectives.forEach(function (objective) {
      objectives.appendChild(make('li', '', objective));
    });

    additionalBlock.classList.toggle('d-none', !quest.additionalInfo);
    additional.textContent = quest.additionalInfo || '';

    image.src = quest.image;
    image.alt = 'Illustration for ' + quest.title;

    facts.textContent = '';
    addFact('Reward', quest.reward || 'Not stated');
    addFact('Location', quest.location || 'Not stated');
    addFact('Recommended rank', rankNode(quest.rank));
    addFact('Posted', dateNode(quest.postedAt));
    addFact('Quest type', quest.type
      ? quest.type.charAt(0).toUpperCase() + quest.type.slice(1)
      : 'Not chosen yet');
    addFact('Expected duration', DURATION_LABELS[quest.duration] || 'Not stated');
  }

  /* ==========================================================
     THE ACTION PANEL
     What the person looking at the quest may do with it. The server
     works out the options and sends them with the quest, and this only
     draws them. The server checks again when a button is pressed,
     because a page can be out of date, or not the page at all.
     ========================================================== */

  var UNREACHABLE = 'The guild hall could not be reached. Check your connection and try again.';

  // The quest and the person as last drawn, so the panel can be
  // redrawn after an action without asking for them again.
  var currentQuest = null;
  var currentUser = null;

  // The outcome of the last action, drawn under the panel.
  var panelMessage = null;
  var acting = false;

  /**
   * Builds a button that carries out an action, after asking first.
   *
   * @param {string} label the button's text
   * @param {string} className the button's classes
   * @param {Object} request what to send and say, see act
   * @returns {HTMLElement} the button
   */
  function actionButton(label, className, request) {
    var button = make('button', className, label);

    button.type = 'button';
    button.addEventListener('click', function () {
      act(request);
    });

    return button;
  }

  /**
   * Asks the customer to confirm, sends the action, and then draws
   * the quest afresh with the outcome beneath the panel. The quest is
   * fetched again whatever the outcome, so a refusal because someone
   * else got there first shows the quest as it now is.
   *
   * @param {Object} request url, question, done (the success message),
   *   and optionally link {href, text}
   */
  function act(request) {
    if (acting || !window.confirm(request.question)) {
      return;
    }

    acting = true;
    panelMessage = null;
    acceptPanel.setAttribute('aria-busy', 'true');

    fetch(request.url, { method: 'POST', headers: { Accept: 'application/json' } }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (data) {
        return { ok: response.ok, data: data };
      });
    }).then(function (result) {
      panelMessage = result.ok
        ? { kind: 'success', text: request.done, link: request.link }
        : { kind: 'error', text: result.data.error || 'Something went wrong. Please try again.' };

      return load();
    }).catch(function () {
      panelMessage = { kind: 'error', text: UNREACHABLE };
      drawAcceptPanel(currentQuest, currentUser);
    }).then(function () {
      acting = false;
      acceptPanel.removeAttribute('aria-busy');
    });
  }

  /**
   * Describes how far a matched quest has got, for the people
   * concerned.
   *
   * @param {Object} quest the quest from the server
   * @returns {string} a sentence
   */
  function progressText(quest) {
    var who = quest.adventurer ? quest.adventurer.name : 'The adventurer';

    return {
      in_progress: who + ' is working on this quest.',
      awaiting_confirmation: who + ' says the work is done, and the customer who posted the quest confirms next.',
      awaiting_verification: 'The work is done and confirmed, and the guild verifies it next.'
    }[quest.progress] || '';
  }

  /**
   * Draws the panel beside the quest.
   *
   * @param {Object} quest the quest from the server
   * @param {Object|null} user who is logged in, or null
   */
  function drawAcceptPanel(quest, user) {
    var title;
    var text;
    var actions = [];
    var viewer = quest.viewer;
    var url = '/api/quests/' + encodeURIComponent(quest.id);
    var account = make('a', 'btn btn-outline-secondary', 'My account');

    account.href = '/my-account';
    currentQuest = quest;
    currentUser = user;
    acceptPanel.textContent = '';

    if (user && user.role === 'admin'
      && (quest.status === 'open' || quest.status === 'unmatched' || quest.status === 'matched')) {
      // The guild does not take part in quests. It verifies the work
      // and can cancel any quest that is not yet finished.
      title = quest.status === 'matched' ? 'Quest in progress' : 'For adventurers';
      text = quest.status === 'matched'
        ? progressText(quest) + ' Verification and cancellation are the guild\'s to do.'
        : 'Administrators do not take part in quests. Verification and cancellation are '
          + 'handled from the administration page.';

      if (viewer.canVerify) {
        actions.push(actionButton('Verify completion', 'btn btn-primary me-2', {
          url: '/api/admin/quests/' + encodeURIComponent(quest.id) + '/verify',
          question: 'Verify this quest as complete? It will be marked completed and the adventurer '
            + 'will be free to take another.',
          done: 'The quest is verified and complete.'
        }));
      }

      if (viewer.canAdminCancel) {
        actions.push(actionButton('Cancel this quest', 'btn btn-outline-danger me-2', {
          url: '/api/admin/quests/' + encodeURIComponent(quest.id) + '/cancel',
          question: 'Cancel this quest? It cannot be reopened, and any adventurer on it is released.',
          done: 'The quest has been cancelled.'
        }));
      }

      account = make('a', 'btn btn-outline-secondary', 'Administration');
      account.href = '/admin';
      actions.push(account);
    } else if (quest.status === 'matched' && viewer.isAccepter) {
      title = 'You accepted this quest';
      text = quest.progress === 'in_progress'
        ? 'When the work is finished, mark it as done. The customer then confirms it, and the guild verifies it.'
        : progressText(quest);

      if (viewer.canMarkDone) {
        actions.push(actionButton('Mark as done', 'btn btn-primary me-2', {
          url: url + '/done',
          question: 'Mark this quest as done? The customer who posted it will be asked to confirm.',
          done: 'Marked as done. The customer who posted the quest confirms next.'
        }));
      }

      actions.push(account);
    } else if (quest.status === 'matched' && quest.isMine) {
      title = 'An adventurer has your quest';
      text = progressText(quest);

      if (viewer.canConfirm) {
        text += ' Confirm it once you are satisfied.';
        actions.push(actionButton('Confirm completion', 'btn btn-primary me-2', {
          url: url + '/confirm',
          question: 'Confirm that the work has been done? The guild then verifies it.',
          done: 'Thank you. The guild verifies the quest next.'
        }));
      }

      actions.push(account);
    } else if (quest.status !== 'open') {
      title = {
        matched: 'This quest has been taken',
        completed: 'This quest is complete',
        cancelled: 'This quest was cancelled',
        unmatched: 'No adventurer has been found',
        draft: 'This quest is a draft'
      }[quest.status] || 'This quest is not open';

      text = {
        matched: 'An adventurer has accepted this quest, so it is no longer open.',
        completed: 'The work has been done and signed off.',
        cancelled: 'The poster withdrew this quest.',
        unmatched: 'Auto-Party searched for a suitable adventurer and found none.',
        draft: 'Only you can see it. Finish it and publish it from your account to put it on the board.'
      }[quest.status] || '';

      if (quest.status === 'draft') {
        actions.push(make('a', 'btn btn-primary', 'Edit this draft'));
        actions[0].href = '/post-quest?id=' + encodeURIComponent(quest.id);
      }
    } else if (quest.isMine) {
      title = 'This is your quest';
      text = 'You can change it while it is open on the board, or cancel it if you no '
        + 'longer need it.';
      actions.push(make('a', 'btn btn-primary', 'Edit this quest'));
      actions[0].href = '/post-quest?id=' + encodeURIComponent(quest.id);
    } else if (quest.autoParty) {
      title = 'Offered through Auto-Party';
      text = 'The guild is offering this quest to suitable adventurers in turn, '
        + 'so it cannot be accepted from the board.';
    } else if (!user) {
      title = 'Interested in this quest?';
      text = 'Quests are accepted through your guild account.';
      actions.push(make('a', 'btn btn-primary btn-lg', 'Log in to accept this quest'));
      actions[0].href = 'login-register.html';
    } else if (user.role === 'adventurer' && viewer.canAccept) {
      title = viewer.hiredMe ? 'You have been hired for this quest' : 'Interested in this quest?';
      text = 'Accepting puts you on this quest, and you cannot take another until it is finished. '
        + 'Arrangements are brokered through the guild rather than by direct contact.';
      actions.push(actionButton('Accept this quest', 'btn btn-primary btn-lg', {
        url: url + '/accept',
        question: 'Accept this quest? You will be on it until it is finished, and cannot take another.',
        done: 'You have accepted this quest. It is now under My Quests on your account.',
        link: { href: '/my-account', text: 'Go to my account' }
      }));
    } else if (user.role === 'adventurer') {
      title = 'You are already on a quest';
      text = 'You can take another once your current quest is finished. Your quests are on your account page.';
      actions.push(account);
    } else {
      title = 'Posting, not accepting';
      text = 'Quests are accepted by adventurers. A customer account posts quests instead.';
      actions.push(make('a', 'btn btn-primary', 'Post a quest'));
      actions[0].href = '/post-quest';
    }

    acceptPanel.appendChild(make('h2', 'fs-5', title));
    acceptPanel.appendChild(make('p', actions.length > 0 ? '' : 'mb-0', text));

    actions.forEach(function (action) {
      acceptPanel.appendChild(action);
    });

    if (panelMessage) {
      drawPanelMessage();
    }
  }

  /**
   * Draws the outcome of the last action under the panel. The element
   * is added with its text already in it, and marked as a live region
   * so that a screen reader announces it.
   */
  function drawPanelMessage() {
    var box = make('p', 'alert mt-3 mb-0 ' + (panelMessage.kind === 'success' ? 'alert-success' : 'alert-danger'),
      panelMessage.text);

    box.setAttribute('role', panelMessage.kind === 'success' ? 'status' : 'alert');

    if (panelMessage.link) {
      box.appendChild(document.createTextNode(' '));
      box.appendChild(make('a', '', panelMessage.link.text));
      box.lastChild.href = panelMessage.link.href;
    }

    acceptPanel.appendChild(box);
  }

  /**
   * Draws the whole quest and reveals it.
   *
   * @param {Object} quest the quest from the server
   */
  function show(quest) {
    crumb.textContent = quest.title;
    document.title = quest.title + ' | Oceania Adventure Guild';

    drawHeading(quest);
    drawBody(quest);

    // The panel is drawn for a stranger first and redrawn once the
    // server says who is logged in, so it is never empty.
    drawAcceptPanel(quest, null);
    window.guildGuild.getUser().then(function (user) {
      drawAcceptPanel(quest, user);
    });

    loading.classList.add('d-none');
    content.classList.remove('d-none');
  }

  /**
   * Shows the notice in place of a quest.
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

  // An id that is not a plain positive integer cannot be a quest,
  // so no request is wasted on it.
  if (!/^[1-9][0-9]{0,9}$/.test(id || '')) {
    showNotice('Quest not found', 'That address does not point at a quest.');
    return;
  }

  /**
   * Fetches the quest and draws it. Called at the start, and again
   * after every action, so the page always shows the quest as the
   * server now has it.
   *
   * @returns {Promise} settles when the quest has been drawn
   */
  function load() {
    return fetch('/api/quests/' + id, { headers: { Accept: 'application/json' } }).then(function (response) {
      return response.json().then(function (data) {
        return { status: response.status, ok: response.ok, data: data };
      });
    }).then(function (result) {
      if (result.status === 404) {
        showNotice('Quest not found', 'That quest does not exist, or it is not open to you.');
        return;
      }

      if (!result.ok) {
        throw new Error('The server could not supply the quest');
      }

      show(result.data.quest);
    }).catch(function () {
      showNotice('The quest could not be loaded', 'Please go back to the quest board and try again.');
    });
  }

  load();

}());
