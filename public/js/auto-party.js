/* ============================================================
   Oceania Adventure Guild - Auto-Party live notices
   SIT774 Website Project, Task 10.3HD

   Loaded by main.js on every page, for a logged in customer or
   adventurer only. Built from the accepted design in
   SIT774_7_3HD_Auto-Party_v2.pdf (Task 7.3HD); figure and step
   numbers in the comments point back to that document.

   What it does:

   1. Holds the one EventSource connection to GET /api/events that
      the server pushes Auto-Party events down (Step 5). The browser
      reconnects by itself after a drop, and every time the
      connection opens, this asks GET /api/match-offers/current for a
      snapshot, so an offer that is still pending is shown again with
      the time it has left, on this page or the next.

   2. Draws each event as a banner in a stack in the corner of the
      page (Figure 8). The quest name in every banner links to the
      quest's own page. The offer banner has Accept and Decline and a
      countdown, and nothing else; every other banner has a close
      button, and "No adventurer found" also has Retry.

   3. Announces each banner through a live region (Step 6,
      Accessibility): the offer assertively, because it has a time
      limit, and everything else politely.

   4. Tells the page it is on, through a "guild:autoparty" event on
      window, so that a page showing the same information (My
      Account, a quest's own page) can draw itself again.

   5. Looks after the two banners that belong to particular pages:
      the one-time launch banner (Figures 1 and 4) and the "While you
      were away" catch-up banner (Figures 3 and 7).

   The countdown (Step 5): the offer arrives with the seconds it has
   left rather than a clock time, so the adventurer's clock does not
   matter. The banner closes itself, and any accept or decline
   question with it, at 55 of the 60 seconds, and says the offer has
   expired. The last 5 seconds are an allowance for a reply made just
   before then to reach the server, which refuses anything after 60.
   The server does not send the expiry; the browser works it out.

   Every value from the server is written as text, never as markup,
   because quest titles and names are typed in by members.
   ============================================================ */

(function () {
  'use strict';

  var guild = window.guildGuild;

  // Loaded twice (a slow page and a fast click) must not mean two
  // connections and two of every banner.
  if (!guild || guild.autoParty || typeof window.EventSource !== 'function') {
    return;
  }

  // Seconds taken off the server's 60 before the banner closes (Step 5).
  var TRANSIT_ALLOWANCE = 5;

  // Enough to keep the stack readable. The oldest closable banner
  // goes first; an offer is never pushed out.
  var MAX_BANNERS = 5;

  var stack = null;
  var politeRegion = null;
  var assertiveRegion = null;

  // Offer banners on screen, by offer id, so that the snapshot and the
  // push cannot draw the same offer twice.
  var offers = {};


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
   * Builds a link to a quest's own page (Figure 8: the quest name in
   * every banner links to Quest Detail).
   *
   * @param {{questId: number, title: string}} data from the event
   * @returns {HTMLElement} the link
   */
  function questLink(data) {
    var link = make('a', 'auto-party-quest', data.title);

    link.href = '/quest-detail.html?id=' + encodeURIComponent(data.questId);

    return link;
  }

  /**
   * Builds a sentence with the quest's link in it, from text either
   * side of the title.
   *
   * @param {string} before text before the title
   * @param {Object} data from the event
   * @param {string} after text after the title
   * @returns {HTMLElement} the paragraph
   */
  function sentence(before, data, after) {
    var text = make('p', 'auto-party-text', '');

    if (before) {
      text.appendChild(document.createTextNode(before));
    }

    text.appendChild(questLink(data));

    if (after) {
      text.appendChild(document.createTextNode(after));
    }

    return text;
  }

  /**
   * Writes the countdown as minutes and seconds, as in Figure 8.
   *
   * @param {number} seconds seconds left
   * @returns {string} for example "0:42"
   */
  function clock(seconds) {
    var whole = Math.max(0, Math.ceil(seconds));

    return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
  }


  /* ==========================================================
     THE STACK AND THE LIVE REGIONS

     The live regions exist from the moment the page starts, empty,
     because a screen reader only announces a change to a region it
     already knows about. They are separate from the banners, so a
     banner can be closed or redrawn without anything being read out
     again.
     ========================================================== */

  /**
   * Adds the banner stack and the two live regions to the page.
   */
  function setUpRegions() {
    stack = make('section', 'auto-party-stack', '');
    stack.setAttribute('aria-label', 'Auto-Party notices');

    politeRegion = make('div', 'visually-hidden', '');
    politeRegion.setAttribute('aria-live', 'polite');
    politeRegion.setAttribute('aria-atomic', 'true');
    politeRegion.id = 'auto-party-polite';

    assertiveRegion = make('div', 'visually-hidden', '');
    assertiveRegion.setAttribute('aria-live', 'assertive');
    assertiveRegion.setAttribute('aria-atomic', 'true');
    assertiveRegion.id = 'auto-party-assertive';

    document.body.appendChild(stack);
    document.body.appendChild(politeRegion);
    document.body.appendChild(assertiveRegion);
  }

  /**
   * Reads a message out through one of the live regions. The region
   * is emptied first and written a moment later, so that the same
   * words twice in a row are still announced the second time.
   *
   * @param {string} text what to say
   * @param {boolean} urgent true for the assertive region
   */
  function announce(text, urgent) {
    var region = urgent ? assertiveRegion : politeRegion;

    region.textContent = '';
    window.setTimeout(function () {
      region.textContent = text;
    }, 100);
  }

  /**
   * Removes a banner. If focus was inside it, focus moves to the main
   * content rather than being lost with the banner.
   *
   * @param {HTMLElement} banner the banner to remove
   */
  function removeBanner(banner) {
    var hadFocus = banner.contains(document.activeElement);
    var main;

    banner.remove();

    if (hadFocus) {
      main = document.getElementById('main-content');

      if (main) {
        if (!main.hasAttribute('tabindex')) {
          main.setAttribute('tabindex', '-1');
        }
        main.focus();
      }
    }
  }

  /**
   * Adds a banner to the top of the stack, making room if needed.
   *
   * @param {HTMLElement} banner the banner to add
   */
  function addBanner(banner) {
    var closable;

    stack.insertBefore(banner, stack.firstChild);
    closable = stack.querySelectorAll('.auto-party-banner:not(.is-offer)');

    while (stack.children.length > MAX_BANNERS && closable.length > 0) {
      removeBanner(closable[closable.length - 1]);
      closable = stack.querySelectorAll('.auto-party-banner:not(.is-offer)');
    }
  }

  /**
   * Builds and shows an ordinary banner: a sentence, a close button,
   * and optionally one action. It is announced politely.
   *
   * @param {Object} details
   * @param {HTMLElement} details.text the sentence, from sentence()
   * @param {string} details.kind a class for its colour: info, success or warning
   * @param {string} [details.questId] the quest it is about, for replacing an older one
   * @param {HTMLElement} [details.action] an extra button, such as Retry
   * @returns {HTMLElement} the banner
   */
  function showBanner(details) {
    var banner = make('div', 'auto-party-banner is-' + details.kind, '');
    var close = make('button', 'btn-close auto-party-close', '');
    var older;

    // A newer notice about the same quest replaces the older one, so
    // the stack never says two things about one quest at once.
    if (details.questId) {
      older = stack.querySelector('.auto-party-banner:not(.is-offer)[data-quest-id="'
        + details.questId + '"]');
      if (older) {
        removeBanner(older);
      }
      banner.setAttribute('data-quest-id', details.questId);
    }

    close.type = 'button';
    close.setAttribute('aria-label', 'Close this notice');
    close.addEventListener('click', function () {
      removeBanner(banner);
    });

    banner.appendChild(close);
    banner.appendChild(details.text);

    if (details.action) {
      banner.appendChild(details.action);
    }

    addBanner(banner);
    announce(details.text.textContent, false);

    return banner;
  }

  /**
   * Tells the page something has happened, so a page showing the same
   * information can draw itself again.
   *
   * @param {string} event the event name
   * @param {Object} data what came with it
   */
  function tellPage(event, data) {
    var custom;

    try {
      custom = new CustomEvent('guild:autoparty', { detail: { event: event, data: data } });
    } catch (error) {
      return;
    }

    window.dispatchEvent(custom);
  }


  /* ==========================================================
     SENDING
     ========================================================== */

  /**
   * Posts to the server and resolves with the outcome, whether
   * accepted or refused. Rejects only when the server cannot be
   * reached at all.
   *
   * @param {string} url the address
   * @returns {Promise<{ok: boolean, data: Object}>}
   */
  function post(url) {
    return fetch(url, { method: 'POST', headers: { Accept: 'application/json' } }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (data) {
        return { ok: response.ok, data: data };
      });
    });
  }

  /**
   * Shows a refusal or a failed connection as a banner of its own.
   *
   * @param {Object} data the quest the action was about
   * @param {string} message what went wrong
   */
  function showProblem(data, message) {
    showBanner({
      kind: 'warning',
      questId: data.questId,
      text: sentence('', data, ': ' + message)
    });
  }

  var UNREACHABLE = 'the guild hall could not be reached. Check your connection and try again.';


  /* ==========================================================
     THE OFFER (Figure 8, first banner; Step 5)
     ========================================================== */

  /**
   * Removes an offer's banner, and closes its question if one is open.
   *
   * @param {number} offerId the offer
   */
  function endOffer(offerId) {
    var offer = offers[offerId];

    if (!offer) {
      return;
    }

    window.clearInterval(offer.timer);
    delete offers[offerId];
    guild.closeConfirm('offer-' + offerId);
    removeBanner(offer.banner);
  }

  /**
   * Ends every offer banner for a quest. Used when the quest is
   * answered in another tab, or cancelled.
   *
   * @param {number} questId the quest
   */
  function endOffersFor(questId) {
    Object.keys(offers).forEach(function (id) {
      if (offers[id].data.questId === questId) {
        endOffer(id);
      }
    });
  }

  /**
   * Answers an offer, after the confirm question in Figure 9.
   *
   * @param {Object} data the offer
   * @param {boolean} accepting true to accept, false to decline
   */
  function answerOffer(data, accepting) {
    guild.confirmDialog({
      message: accepting
        ? 'Accept this quest? You\'ll be assigned to ' + data.title + ' once confirmed.'
        : 'Decline this offer for ' + data.title + '? This can\'t be undone.',
      confirmLabel: accepting ? 'Accept' : 'Decline',
      danger: !accepting,
      owner: 'offer-' + data.offerId
    }).then(function (confirmed) {
      var offer = offers[data.offerId];

      // Gone while the question was open: expired, or answered in
      // another tab. Nothing to send.
      if (!confirmed || !offer) {
        return;
      }

      offer.banner.querySelectorAll('button').forEach(function (button) {
        button.disabled = true;
      });

      post('/api/offers/' + encodeURIComponent(data.offerId) + (accepting ? '/accept' : '/decline'))
        .then(function (result) {
          endOffer(data.offerId);

          // A success needs nothing here: the server pushes "Match
          // confirmed" or the decline receipt, which draw their own
          // banners, only once the answer is really saved.
          if (!result.ok) {
            showProblem(data, result.data.error || 'something went wrong. Please try again.');
          }
        }).catch(function () {
          // Not answered, so the offer stands. The buttons come back
          // so the adventurer can try again before the countdown ends.
          offer.banner.querySelectorAll('button').forEach(function (button) {
            button.disabled = false;
          });
          showProblem(data, UNREACHABLE);
        });
    });
  }

  /**
   * Shows the offer banner with its countdown.
   *
   * @param {{offerId: number, questId: number, title: string, secondsRemaining: number}} data
   */
  function showOffer(data) {
    var existing = offers[data.offerId];
    var closesAt = Date.now() + (data.secondsRemaining - TRANSIT_ALLOWANCE) * 1000;
    var banner;
    var countdown;
    var buttons;
    var accept;
    var decline;
    var offer;

    // Already on screen (the snapshot and the push both brought it):
    // only the time is brought up to date.
    if (existing) {
      existing.closesAt = closesAt;
      return;
    }

    // Too little time left to answer. It is shown as expired straight
    // away rather than as an offer that cannot be taken.
    if (closesAt <= Date.now()) {
      expireOffer(data);
      return;
    }

    banner = make('div', 'auto-party-banner is-offer', '');
    banner.setAttribute('data-quest-id', data.questId);

    countdown = make('p', 'auto-party-countdown', '');
    buttons = make('div', 'auto-party-actions', '');

    accept = make('button', 'btn btn-sm btn-primary', 'Accept');
    accept.type = 'button';
    accept.setAttribute('aria-label', 'Accept the offer for ' + data.title);
    accept.addEventListener('click', function () {
      answerOffer(data, true);
    });

    decline = make('button', 'btn btn-sm btn-outline-secondary', 'Decline');
    decline.type = 'button';
    decline.setAttribute('aria-label', 'Decline the offer for ' + data.title);
    decline.addEventListener('click', function () {
      answerOffer(data, false);
    });

    buttons.appendChild(accept);
    buttons.appendChild(decline);
    banner.appendChild(sentence('You\'ve received a match offer for ', data, ''));
    banner.appendChild(countdown);
    banner.appendChild(buttons);

    offer = { data: data, banner: banner, closesAt: closesAt, timer: null };
    offers[data.offerId] = offer;

    /**
     * Redraws the countdown, and ends the offer when it reaches zero.
     */
    function tick() {
      var left = (offer.closesAt - Date.now()) / 1000;

      if (left <= 0) {
        endOffer(data.offerId);
        expireOffer(data);
        return;
      }

      countdown.textContent = clock(left) + ' remaining';
    }

    tick();
    offer.timer = window.setInterval(tick, 1000);

    addBanner(banner);
    announce('You\'ve received a match offer for ' + data.title + '. You have '
      + Math.ceil((closesAt - Date.now()) / 1000) + ' seconds to accept or decline.', true);
  }

  /**
   * Says an offer has expired. Generated here, when the countdown
   * ends, and not sent by the server (Step 5).
   *
   * @param {Object} data the offer
   */
  function expireOffer(data) {
    showBanner({
      kind: 'info',
      questId: data.questId,
      text: sentence('The offer for ', data, ' has expired')
    });
    tellPage('offer_expired', data);
  }


  /* ==========================================================
     THE OTHER EVENTS (Figure 8)
     ========================================================== */

  /**
   * Searches again for a quest whose search ran out, after the
   * question in Figure 9. Used by the Retry button on the banner.
   *
   * @param {Object} data the quest
   * @param {HTMLElement} banner the banner the button is on
   */
  function retry(data, banner) {
    guild.confirmDialog({
      message: 'Search for a new adventurer for ' + data.title + '?',
      confirmLabel: 'Search Again'
    }).then(function (confirmed) {
      if (!confirmed) {
        return;
      }

      post('/api/quests/' + encodeURIComponent(data.questId) + '/retrigger').then(function (result) {
        removeBanner(banner);

        if (!result.ok) {
          showProblem(data, result.data.error || 'something went wrong. Please try again.');
        }

        tellPage('retriggered', data);
      }).catch(function () {
        showProblem(data, UNREACHABLE);
      });
    });
  }

  var handlers = {

    offer: function (data) {
      showOffer(data);
    },

    searching: function (data) {
      showBanner({ kind: 'info', questId: data.questId, text: sentence('Searching for an adventurer for ', data, '') });
    },

    matched: function (data) {
      var who;

      endOffersFor(data.questId);

      // The customer's copy names the adventurer and their rank, and
      // nothing more (Step 6). The adventurer's own copy says "you".
      if (data.adventurer) {
        who = data.adventurer + (data.rank
          ? ' (' + data.rank.charAt(0).toUpperCase() + data.rank.slice(1) + ' rank)'
          : '');
      } else {
        who = 'you';
      }

      showBanner({
        kind: 'success',
        questId: data.questId,
        text: sentence('Match confirmed! ', data, ' is now assigned to ' + who)
      });
    },

    decline_receipt: function (data) {
      endOffersFor(data.questId);
      showBanner({ kind: 'info', questId: data.questId, text: sentence('You declined the offer for ', data, '') });
    },

    no_match: function (data) {
      var retryButton = make('button', 'btn btn-sm btn-primary', 'Retry');
      var banner;

      retryButton.type = 'button';
      retryButton.setAttribute('aria-label', 'Search again for an adventurer for ' + data.title);

      banner = showBanner({
        kind: 'warning',
        questId: data.questId,
        text: sentence('No adventurer found for ', data, ''),
        action: retryButton
      });

      retryButton.addEventListener('click', function () {
        retry(data, banner);
      });
    },

    // Housekeeping 2.1c: a customer has hired this adventurer. Not an
    // Auto-Party offer (there is no countdown), but announced the same way.
    hire_request: function (data) {
      showBanner({
        kind: 'info',
        questId: data.questId,
        text: sentence(data.customer + ' has hired you for ', data, '. Answer it from the quest page or My Account')
      });
    },

    // Housekeeping 2: a hired adventurer said no. Not an Auto-Party
    // outcome, but the customer is told the same way.
    hire_declined: function (data) {
      showBanner({
        kind: 'warning',
        questId: data.questId,
        text: sentence(data.adventurer + ' declined your hire for ', data, '. It is back in your drafts')
      });
    },

    quest_cancelled: function (data) {
      showBanner({ kind: 'info', questId: data.questId, text: sentence('', data, ' has been cancelled') });
    },

    quest_unavailable: function (data) {
      endOffersFor(data.questId);
      showBanner({
        kind: 'info',
        questId: data.questId,
        text: sentence('', data, ' has been cancelled and is no longer available')
      });
    }
  };


  /* ==========================================================
     THE CONNECTION
     ========================================================== */

  /**
   * Asks for the current state and shows any pending offer with the
   * time it has left. Run every time the connection opens, the first
   * time and after every reconnection (Step 5, "On reconnect").
   */
  function catchUpOnOffers() {
    fetch('/api/match-offers/current', { headers: { Accept: 'application/json' } }).then(function (response) {
      return response.ok ? response.json() : {};
    }).then(function (data) {
      var pending = data.pendingOffers || (data.pendingOffer ? [data.pendingOffer] : []);

      pending.forEach(showOffer);
    }).catch(function () {
      // Nothing to show. The next reconnection asks again.
    });
  }

  /**
   * Opens the connection and listens for every event.
   */
  function connect() {
    var source = new window.EventSource('/api/events');

    source.addEventListener('open', catchUpOnOffers);

    Object.keys(handlers).forEach(function (name) {
      source.addEventListener(name, function (message) {
        var data;

        try {
          data = JSON.parse(message.data);
        } catch (error) {
          return;
        }

        handlers[name](data);
        tellPage(name, data);
      });
    });

    // Closed properly when the page goes, so the server drops this
    // tab from its list at once rather than at its next write.
    window.addEventListener('pagehide', function () {
      source.close();
    });

    return source;
  }

  // A page brought back with the Back button is restored as it was
  // left, connection closed, so it opens a new one.
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      guild.autoParty.connection = connect();
    }
  });

  /* ==========================================================
     THE PAGE BANNERS

     Two banners belong to particular pages rather than to the live
     stack, and are looked after here so that both account pages and
     Post a Quest share one version of each. A page that has the
     markup gets the banner; a page without it is left alone.
     ========================================================== */

  /**
   * Moves focus to a sensible place after a banner holding it closes.
   *
   * @param {string} [id] the element to move to, if it exists
   */
  function focusAfterClose(id) {
    var target = id ? document.getElementById(id) : null;

    if (target && !target.disabled) {
      target.focus();
      return;
    }

    target = document.getElementById('main-content');

    if (target) {
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }
      target.focus();
    }
  }

  /**
   * The one-time launch banner (Figures 1 and 4). Shown until closed,
   * and closing it is stored on the account, so it does not come back
   * on this device or any other.
   *
   * @param {{autoPartyBannerDismissed: boolean}} user who is logged in
   */
  function setUpLaunchBanner(user) {
    var banner = document.getElementById('auto-party-launch');
    var close = document.getElementById('auto-party-launch-close');

    if (!banner || !close || user.autoPartyBannerDismissed) {
      return;
    }

    banner.classList.remove('d-none');

    close.addEventListener('click', function () {
      banner.classList.add('d-none');
      focusAfterClose(banner.getAttribute('data-focus-after'));

      fetch('/api/me/auto-party-banner', { method: 'POST', headers: { Accept: 'application/json' } })
        .catch(function () {
          // Closed for this page either way. If it could not be stored,
          // it simply shows again next time.
        });
    });
  }

  /**
   * The catch-up banner (Figures 3 and 7): what happened while the
   * user was away, read once when the page loads. It is ordinary page
   * content, not a live region (Step 6). Everything shown is then
   * marked seen, by naming exactly those items, so an outcome that
   * arrives in between is not marked without being shown.
   */
  function setUpCatchUp() {
    var banner = document.getElementById('catch-up');
    var list = document.getElementById('catch-up-list');
    var close = document.getElementById('catch-up-close');

    if (!banner || !list) {
      return;
    }

    fetch('/api/catch-up', { headers: { Accept: 'application/json' } }).then(function (response) {
      return response.ok ? response.json() : { items: [] };
    }).then(function (data) {
      var seen = { offers: [], quests: [] };

      if (!data.items || data.items.length === 0) {
        return;
      }

      list.textContent = '';

      data.items.forEach(function (item) {
        var line = make('li', '', '');
        var link = questLink(item);

        if (item.event === 'expired') {
          line.appendChild(document.createTextNode('An offer for '));
          line.appendChild(link);
          line.appendChild(document.createTextNode(' expired'));
        } else if (item.event === 'no_match') {
          line.appendChild(document.createTextNode('No adventurer was found for '));
          line.appendChild(link);
          line.appendChild(document.createTextNode('. You can retry or cancel it under My Posted Quests'));
        } else if (item.event === 'hire_declined') {
          line.appendChild(document.createTextNode((item.adventurer || 'The adventurer') + ' declined your hire for '));
          line.appendChild(link);
          line.appendChild(document.createTextNode('. It is back in your drafts'));
        } else {
          line.appendChild(link);
          line.appendChild(document.createTextNode(' was cancelled'));
        }

        list.appendChild(line);
        (item.kind === 'offer' ? seen.offers : seen.quests).push(item.id);
      });

      banner.classList.remove('d-none');

      fetch('/api/catch-up/seen', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(seen)
      }).then(function () {
        // Seen now, so no longer counted on the header's envelope.
        guild.refreshNotices();
      }).catch(function () {
        // Not marked, so it is simply shown again next time.
      });
    }).catch(function () {
      // Nothing to show.
    });

    if (close) {
      close.addEventListener('click', function () {
        banner.classList.add('d-none');
        focusAfterClose(null);
      });
    }
  }

  setUpRegions();
  guild.getUser().then(function (user) {
    if (user) {
      setUpLaunchBanner(user);
    }
  });
  setUpCatchUp();

  guild.autoParty = {
    connection: connect(),
    // For the tests and the developer console.
    showOffer: showOffer,
    handlers: handlers
  };

}());
