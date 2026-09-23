/* ============================================================
   Oceania Adventure Guild - shared site behaviour
   SIT774 Website Project, Part 2 (Task 7.2D)

   Loaded on every page. Contains only behaviour that every page
   needs: the shopping cart, the header cart count, the header
   account controls, the guild hall opening hours, the home page
   greeting, and the footer revision date.

   Page specific behaviour lives in its own file, so that a page
   loads only the code it actually uses.

   Everything is wrapped in an IIFE so that no variables leak
   into the global scope. The one deliberate export is
   window.guildGuild, which page scripts and the developer
   console both use.
   ============================================================ */

(function () {
  'use strict';

  /* ==========================================================
     SHOPPING CART

     The cart is held in localStorage for this stage of the
     project. That is deliberate rather than ideal: a real
     storefront keeps the cart on the server, because a cart in
     the browser can be edited by the visitor and cannot follow
     them to another device. Prices are therefore never trusted
     from storage at checkout. The cart moves server side in
     Part 3, at which point a stored cart is merged into the
     account's cart on login.
     ========================================================== */

  var CART_KEY = 'oag-cart';
  var MAX_QUANTITY = 99;

  /**
   * Reads the cart from storage.
   * Storage can be unavailable (private browsing) or hold
   * malformed data (hand edited, or written by an older version
   * of the site), so every read is defensive and falls back to
   * an empty cart rather than throwing.
   *
   * @returns {Array<Object>} the stored cart, or an empty array
   */
  function readCart() {
    var raw;

    try {
      raw = window.localStorage.getItem(CART_KEY);
    } catch (error) {
      // Storage is blocked. The cart simply does not persist.
      return [];
    }

    if (!raw) {
      return [];
    }

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return [];
    }

    if (!Array.isArray(parsed)) {
      return [];
    }

    /* Discard any entry that is not a well formed line item.
       The list price and the image are optional, so that a cart
       stored by an earlier version of the site is still usable
       rather than being silently emptied. */
    return parsed
      .filter(function (line) {
        return line
          && typeof line.id === 'string'
          && typeof line.name === 'string'
          && Number.isFinite(line.price)
          && Number.isInteger(line.quantity)
          && line.quantity > 0;
      })
      .map(function (line) {
        return {
          id: line.id,
          name: line.name,
          price: line.price,
          listPrice: Number.isFinite(line.listPrice) ? line.listPrice : line.price,
          image: typeof line.image === 'string' ? line.image : '',
          quantity: Math.min(line.quantity, MAX_QUANTITY)
        };
      });
  }

  /**
   * Writes the cart to storage.
   *
   * @param {Array<Object>} cart the cart to store
   * @returns {boolean} true if the write succeeded
   */
  function writeCart(cart) {
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
      return true;
    } catch (error) {
      // Storage full or blocked. The cart still works for this
      // page view; it just will not survive navigation.
      return false;
    }
  }

  /**
   * Adds an item to the cart, or raises the quantity if it is
   * already present.
   *
   * @param {Object} details the item to add
   * @param {string} details.id        the item's identifier
   * @param {string} details.name      the item's display name
   * @param {number} details.price     the price paid per unit, in gold
   * @param {number} [details.listPrice] the full ticket price, where
   *        the item is discounted. Defaults to the price paid.
   * @param {string} [details.image]   path to the item's image
   * @param {number} [details.quantity] how many to add, default one
   * @returns {number} the item's new quantity in the cart
   */
  function addItem(details) {
    var cart = readCart();
    var wanted = Number.isInteger(details.quantity) ? details.quantity : 1;
    var existing = null;
    var index;

    for (index = 0; index < cart.length; index += 1) {
      if (cart[index].id === details.id) {
        existing = cart[index];
        break;
      }
    }

    if (existing) {
      existing.quantity = Math.min(existing.quantity + wanted, MAX_QUANTITY);
    } else {
      cart.push({
        id: details.id,
        name: details.name,
        price: details.price,
        listPrice: Number.isFinite(details.listPrice)
          ? details.listPrice
          : details.price,
        image: details.image || '',
        quantity: Math.min(Math.max(wanted, 1), MAX_QUANTITY)
      });
      existing = cart[cart.length - 1];
    }

    writeCart(cart);
    updateCartCount();
    return existing.quantity;
  }

  /**
   * Sets a line item's quantity outright, rather than adding to it.
   * Backs the quantity stepper on the cart page.
   *
   * @param {string} id the item's identifier
   * @param {number} quantity the quantity wanted
   * @returns {number} the quantity actually stored, after clamping
   */
  function setQuantity(id, quantity) {
    var cart = readCart();
    var wanted = Math.min(Math.max(Math.round(quantity), 1), MAX_QUANTITY);
    var index;

    for (index = 0; index < cart.length; index += 1) {
      if (cart[index].id === id) {
        cart[index].quantity = wanted;
        writeCart(cart);
        updateCartCount();
        return wanted;
      }
    }

    return 0;
  }

  /**
   * Totals the cart.
   *
   * Prices are read from storage, which the visitor can edit. They
   * are trusted here only to render the page. In Part 3 every price
   * is looked up again on the server before an order is accepted,
   * so a tampered cart cannot change what anything costs.
   *
   * @returns {{items: number, subtotal: number, total: number, saved: number}}
   */
  function cartTotals() {
    return readCart().reduce(function (totals, line) {
      totals.items += line.quantity;
      totals.subtotal += line.listPrice * line.quantity;
      totals.total += line.price * line.quantity;
      totals.saved += (line.listPrice - line.price) * line.quantity;
      return totals;
    }, { items: 0, subtotal: 0, total: 0, saved: 0 });
  }

  /**
   * Removes an item from the cart entirely.
   *
   * @param {string} id the item's identifier
   */
  function removeItem(id) {
    var cart = readCart().filter(function (line) {
      return line.id !== id;
    });

    writeCart(cart);
    updateCartCount();
  }

  /**
   * Empties the cart. This backs the reset control on the cart
   * page, and is also useful from the console when preparing a
   * clean screenshot.
   */
  function clearCart() {
    try {
      window.localStorage.removeItem(CART_KEY);
    } catch (error) {
      // Nothing to do; the cart was never stored.
    }
    updateCartCount();
  }

  /**
   * Counts the total number of units in the cart.
   *
   * @returns {number} the total quantity across all line items
   */
  function countItems() {
    return readCart().reduce(function (total, line) {
      return total + line.quantity;
    }, 0);
  }

  /**
   * Writes the current cart total into the header badge. Called
   * on load and after every change, so the count stays correct
   * across full page navigations.
   */
  function updateCartCount() {
    var badge = document.getElementById('cart-count');

    if (!badge) {
      return;
    }

    badge.textContent = String(countItems());
  }


  /* ==========================================================
     QUANTITY STEPPER

     A shared control used on the cart page and on an item detail
     page. Rather than each page writing its own, this attaches to
     any element carrying the qty-stepper class inside a given
     container.

     Expected markup:

       <div class="qty-stepper" data-item-id="item-3">
         <button type="button" class="qty-down" aria-label="...">-</button>
         <label class="visually-hidden" for="qty-item-3">...</label>
         <input type="number" class="qty-input" id="qty-item-3"
                name="quantity" value="1" min="1" max="99" step="1">
         <button type="button" class="qty-up" aria-label="...">+</button>
       </div>

     A number input accepts anything the visitor types or pastes, so
     the value is validated on every change: it must be a whole
     number between one and the maximum. An unusable value is
     restored to the last good one rather than reported as an error,
     because there is nothing useful for the visitor to do about it.
     ========================================================== */

  /**
   * Clamps a quantity to a whole number within the allowed range.
   *
   * @param {*} value the raw value from the input
   * @param {number} fallback the value to use if nothing usable
   * @returns {number} a usable quantity
   */
  function clampQuantity(value, fallback) {
    var parsed = parseInt(value, 10);

    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.min(Math.max(parsed, 1), MAX_QUANTITY);
  }

  /**
   * Enables or disables a stepper's buttons at the range bounds, so
   * that a control which cannot do anything does not look as though
   * it can.
   *
   * @param {HTMLElement} stepper the stepper wrapper
   */
  function refreshStepperBounds(stepper) {
    var input = stepper.querySelector('.qty-input');
    var down = stepper.querySelector('.qty-down');
    var up = stepper.querySelector('.qty-up');
    var value;

    // Guarded before the input is read, not after.
    if (!input) {
      return;
    }

    value = clampQuantity(input.value, 1);

    if (down) {
      down.disabled = (value <= 1);
    }

    if (up) {
      up.disabled = (value >= MAX_QUANTITY);
    }
  }

  /**
   * Wires up every quantity stepper inside a container.
   *
   * @param {HTMLElement} root the container to search
   * @param {Function} [onChange] called with (itemId, quantity)
   *        whenever a stepper settles on a new value
   */
  function attachSteppers(root, onChange) {
    var steppers = Array.prototype.slice.call(
      root.querySelectorAll('.qty-stepper')
    );

    steppers.forEach(function (stepper) {
      var input = stepper.querySelector('.qty-input');
      var itemId;
      var lastGood;

      // Guarded before the input is read, not after.
      if (!input) {
        return;
      }

      itemId = stepper.dataset.itemId || '';
      lastGood = clampQuantity(input.value, 1);

      /**
       * Applies a new value, keeping the input, the bounds and the
       * caller in step.
       *
       * @param {number} next the value wanted
       */
      function apply(next) {
        var value = clampQuantity(next, lastGood);

        lastGood = value;
        input.value = String(value);
        refreshStepperBounds(stepper);

        if (typeof onChange === 'function') {
          onChange(itemId, value);
        }
      }

      stepper.addEventListener('click', function (event) {
        var button = event.target.closest('button');

        if (!button || button.disabled) {
          return;
        }

        if (button.classList.contains('qty-up')) {
          apply(clampQuantity(input.value, lastGood) + 1);
        } else if (button.classList.contains('qty-down')) {
          apply(clampQuantity(input.value, lastGood) - 1);
        }
      });

      /* Typing is allowed to leave the field temporarily empty, so
         the value is only settled once the field is left or the
         visitor presses Enter. Otherwise clearing the field to type
         a new number would immediately snap it back to 1. */
      input.addEventListener('blur', function () {
        apply(input.value);
      });

      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          apply(input.value);
        }
      });

      refreshStepperBounds(stepper);
    });
  }

  /**
   * Formats an amount of gold with thousands separators.
   *
   * @param {number} amount the amount in gold
   * @returns {string} for example "1,400 gold"
   */
  function formatGold(amount) {
    return Math.round(amount).toLocaleString('en-AU') + ' gold';
  }


  /**
   * Describes a filtered result set in words.
   *
   * "Showing 1 of 6 items" is ambiguous: it reads as easily as
   * "item 1 of 6" as it does "1 matched out of 6". Using "match" as
   * a noun removes that reading, and also sidesteps the awkward
   * verb agreement of "1 items match".
   *
   * @param {number} shown how many passed the filters
   * @param {number} total how many exist in total
   * @param {string} noun the plural noun, for example "items"
   * @param {boolean} filtered whether any filter is currently set
   * @returns {string} the sentence to display
   */
  function describeResults(shown, total, noun, filtered) {
    if (!filtered) {
      return 'Showing all ' + total + ' ' + noun;
    }

    if (shown === 0) {
      return 'No matches out of ' + total + ' ' + noun;
    }

    if (shown === 1) {
      return '1 match out of ' + total + ' ' + noun;
    }

    return shown + ' matches out of ' + total + ' ' + noun;
  }


  /**
   * Describes one page of results from a paged list, for example
   * "Showing 13 to 24 of 28 quests". When every result fits on the
   * one page it falls back to describeResults, so a short list
   * reads the same as it always did.
   *
   * @param {number} first position of the first result on this page
   * @param {number} last position of the last result on this page
   * @param {number} matched how many results there are in all
   * @param {number} total how many exist before any filter
   * @param {string} noun the plural noun, for example "quests"
   * @param {boolean} filtered whether any filter is currently set
   * @returns {string} the sentence to display
   */
  function describePage(first, last, matched, total, noun, filtered) {
    if (first === 1 && last === matched) {
      return describeResults(matched, total, noun, filtered);
    }

    if (filtered) {
      return 'Showing ' + first + ' to ' + last + ' of ' + matched
        + ' matches out of ' + total + ' ' + noun;
    }

    return 'Showing ' + first + ' to ' + last + ' of ' + total + ' ' + noun;
  }


  /* ==========================================================
     PAGE BUTTONS

     Every list on the site that is served a page at a time draws
     its page buttons the same way, so the drawing lives here.
     ========================================================== */

  /**
   * Chooses which page buttons to show: the first, the last and
   * the ones either side of the current page, with a gap marked
   * by null wherever pages are left out.
   *
   * @param {number} current the page being shown
   * @param {number} total the number of pages
   * @returns {Array<number|null>} page numbers, with null for a gap
   */
  function pageNumbers(current, total) {
    var pages = [];
    var last = 0;
    var n;

    for (n = 1; n <= total; n += 1) {
      if (n === 1 || n === total || Math.abs(n - current) <= 1) {
        // A gap of a single page is filled in rather than hidden, since
        // an ellipsis that stands for one page saves no room.
        if (n - last === 2) {
          pages.push(last + 1);
        } else if (n - last > 2) {
          pages.push(null);
        }
        pages.push(n);
        last = n;
      }
    }

    return pages;
  }

  /**
   * Draws the page buttons into a container: Previous, the numbered
   * pages with gaps, and Next. A list that fits on one page gets
   * none. The buttons are real buttons, so they work from the
   * keyboard, and the current page is marked with aria-current.
   *
   * @param {HTMLElement} container the nav element to draw into
   * @param {number} page the page being shown
   * @param {number} totalPages how many pages there are
   * @param {function(number)} goToPage called with the page a button leads to
   */
  function drawPager(container, page, totalPages, goToPage) {
    var list;

    function addButton(text, label, target, disabled, active) {
      var item = document.createElement('li');
      var button = document.createElement('button');

      item.className = 'page-item' + (disabled ? ' disabled' : '') + (active ? ' active' : '');

      button.type = 'button';
      button.className = 'page-link';
      button.textContent = text;
      button.setAttribute('aria-label', label);
      button.disabled = disabled;

      if (active) {
        button.setAttribute('aria-current', 'page');
      }

      button.addEventListener('click', function () {
        goToPage(target);
      });

      item.appendChild(button);
      list.appendChild(item);
    }

    container.textContent = '';

    if (totalPages <= 1) {
      return;
    }

    list = document.createElement('ul');
    list.className = 'pagination justify-content-center flex-wrap';

    addButton('Previous', 'Previous page', page - 1, page === 1, false);

    pageNumbers(page, totalPages).forEach(function (n) {
      var gap;
      var mark;

      if (n === null) {
        gap = document.createElement('li');
        gap.className = 'page-item disabled';
        mark = document.createElement('span');
        mark.className = 'page-link';
        mark.textContent = '\u2026';
        gap.appendChild(mark);
        list.appendChild(gap);
        return;
      }

      addButton(String(n), 'Page ' + n, n, false, n === page);
    });

    addButton('Next', 'Next page', page + 1, page === totalPages, false);

    container.appendChild(list);
  }


  /**
   * Writes an ISO date such as 2026-09-28 the way a person would
   * say it: 28 September 2026.
   *
   * @param {string} isoDate a date in year-month-day form
   * @returns {string} the date in words
   */
  function formatDate(isoDate) {
    var parts = String(isoDate).split('-');

    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      .toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /**
   * Says in words whether an adventurer can take work.
   *
   * @param {{status: string, until: string|null}} availability from the server
   * @returns {string} for example "Available now" or "Unavailable until 28 September 2026"
   */
  function describeAvailability(availability) {
    if (availability.status === 'available') {
      return 'Available now';
    }

    if (availability.status === 'on_quest') {
      return 'On a quest';
    }

    return availability.until
      ? 'Unavailable until ' + formatDate(availability.until)
      : 'Unavailable';
  }


  /* ==========================================================
     HIRING

     Hiring an adventurer means posting a quest addressed to that
     one person, and only a customer account posts quests. So the
     Hire control is a real link for a customer, an invitation to
     log in for a stranger, and for anyone else no control at all,
     only a sentence saying why.

     The list preview and the profile page both call this, so the
     two can never disagree about who may hire. It only decides
     what to show: the server refuses the request from any other
     role, and the database refuses to store it.
     ========================================================== */

  /**
   * Decides what the Hire control should be for this visitor.
   *
   * @param {{id: number, isSelf: boolean}} adventurer the adventurer being looked at
   * @param {{role: string}|null} user who is logged in, or null
   * @returns {{href: string|null, label: string, shortLabel: string, note: string}}
   *   href is null when there is nothing to click, and note is a
   *   sentence to show instead
   */
  function hireOffer(adventurer, user) {
    if (!user) {
      return {
        href: 'login-register.html',
        label: 'Log in to hire this adventurer',
        shortLabel: 'Log in to hire',
        note: 'Adventurers are hired through a customer account.'
      };
    }

    if (user.role === 'customer') {
      return {
        href: '/post-quest?hire=' + encodeURIComponent(adventurer.id),
        label: 'Hire this adventurer',
        shortLabel: 'Hire',
        note: ''
      };
    }

    if (adventurer.isSelf) {
      return { href: null, label: '', shortLabel: '', note: 'This is your own entry on the register.' };
    }

    if (user.role === 'adventurer') {
      return {
        href: null,
        label: '',
        shortLabel: '',
        note: 'Adventurers cannot hire other adventurers. Hiring is done from a customer account.'
      };
    }

    return { href: null, label: '', shortLabel: '', note: 'Administrators do not hire adventurers.' };
  }


  /* ==========================================================
     GUILD HALL OPENING HOURS

     The same hours published in the table on the contact page.
     Expressed as minutes from midnight so that comparisons are
     straightforward.

     Index 0 is Sunday, matching Date.prototype.getDay().
     ========================================================== */

  var HOURS = [
    null,                 // Sunday, closed
    { open: 480, close: 1080 },  // Monday,    8:00am to 6:00pm
    { open: 480, close: 1080 },  // Tuesday
    { open: 480, close: 1080 },  // Wednesday
    { open: 480, close: 1080 },  // Thursday
    { open: 480, close: 1080 },  // Friday
    { open: 540, close: 960 }    // Saturday,  9:00am to 4:00pm
  ];

  var DAY_NAMES = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday',
    'Thursday', 'Friday', 'Saturday'
  ];

  /**
   * Formats minutes from midnight as a twelve hour clock time.
   *
   * @param {number} minutes minutes since midnight
   * @returns {string} for example "8:00am"
   */
  function formatTime(minutes) {
    var hour24 = Math.floor(minutes / 60);
    var minute = minutes % 60;
    var suffix = hour24 < 12 ? 'am' : 'pm';
    var hour12 = hour24 % 12;

    if (hour12 === 0) {
      hour12 = 12;
    }

    return hour12 + ':' + String(minute).padStart(2, '0') + suffix;
  }

  /**
   * Works out whether the guild hall is open, and when it next
   * opens if it is not.
   *
   * Public holidays are listed as closed on the contact page but
   * are not modelled here, because the holiday calendar is not
   * available to the page. The status therefore describes the
   * ordinary weekly pattern.
   *
   * @param {Date} [now] the moment to test, defaulting to now
   * @returns {{open: boolean, message: string}}
   */
  function hallStatus(now) {
    var moment = now || new Date();
    var day = moment.getDay();
    var minutes = (moment.getHours() * 60) + moment.getMinutes();
    var today = HOURS[day];
    var offset;
    var nextDay;
    var nextHours;

    if (today && minutes >= today.open && minutes < today.close) {
      return {
        open: true,
        message: 'The guild hall is open now, until ' + formatTime(today.close) + '.'
      };
    }

    // Closed. Find the next day that has opening hours, looking
    // at the rest of today first.
    if (today && minutes < today.open) {
      return {
        open: false,
        message: 'The guild hall is closed, and opens today at '
          + formatTime(today.open) + '.'
      };
    }

    for (offset = 1; offset <= 7; offset += 1) {
      nextDay = (day + offset) % 7;
      nextHours = HOURS[nextDay];

      if (nextHours) {
        return {
          open: false,
          message: 'The guild hall is closed, and opens '
            + (offset === 1 ? 'tomorrow' : 'on ' + DAY_NAMES[nextDay])
            + ' at ' + formatTime(nextHours.open) + '.'
        };
      }
    }

    // Unreachable while any day has hours, but returned rather
    // than left undefined.
    return { open: false, message: 'The guild hall is closed.' };
  }

  /**
   * Returns a greeting appropriate to the time of day.
   *
   * @param {Date} [now] the moment to test, defaulting to now
   * @returns {string} for example "Good afternoon"
   */
  function greeting(now) {
    var hour = (now || new Date()).getHours();

    if (hour < 12) {
      return 'Good morning';
    }

    if (hour < 18) {
      return 'Good afternoon';
    }

    return 'Good evening';
  }


  /* ==========================================================
     PAGE SET UP
     ========================================================== */

  /**
   * Writes the greeting and hall status into the home page hero.
   * Does nothing on pages that have no greeting element.
   */
  function setUpGreeting() {
    var element = document.getElementById('guild-greeting');

    if (!element) {
      return;
    }

    element.textContent = greeting() + '. ' + hallStatus().message;
  }

  /**
   * Writes the document's own last modified date into the footer.
   * Deriving it from the document rather than hardcoding it means
   * the stated revision date cannot fall out of step with the
   * page.
   */
  function setUpRevisionDate() {
    var element = document.getElementById('last-updated');
    var modified;

    if (!element) {
      return;
    }

    modified = new Date(document.lastModified);

    // Some servers omit the header, in which case the browser
    // reports the current time. Nothing sensible can be shown.
    if (Number.isNaN(modified.getTime())) {
      return;
    }

    element.textContent = 'Last updated ' + modified.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }) + '.';
  }

  /* ==========================================================
     ACCOUNT CONTROLS

     Every page carries a Login button in the header. The page
     itself is the same for everyone, so it asks the server who,
     if anyone, is logged in, and swaps the button for the
     visitor's name, a link to their account and a Log out
     button. Until the answer arrives, or if it never does, the
     Login button stays, which is always a safe thing to show.

     The name is written with textContent and never as markup,
     because it is text a member typed in when they registered.
     ========================================================== */

  var userRequest = null;

  /**
   * Asks the server who is logged in, once, and hands the same
   * answer to everyone who asks afterwards. The header uses it to
   * show the logged in controls, and page scripts use it to decide
   * what to offer, so the question is sent a single time however
   * many of them want the answer.
   *
   * Never rejects: if the server cannot be reached, the answer is
   * "nobody", which is always the safe thing to assume.
   *
   * @returns {Promise<{displayName: string, role: string}|null>}
   */
  function getUser() {
    if (!userRequest) {
      userRequest = (typeof fetch === 'function'
        ? fetch('/api/me', { headers: { Accept: 'application/json' } })
        : Promise.reject(new Error('fetch is not available'))
      ).then(function (response) {
        return response.ok ? response.json() : { user: null };
      }).then(function (data) {
        return (data && data.user) || null;
      }).catch(function () {
        return null;
      });
    }

    return userRequest;
  }

  /**
   * Replaces the Login link with the logged in controls.
   *
   * @param {HTMLElement} loginLink the Login link in the header
   * @param {{displayName: string, role: string}} user who is logged in
   */
  function showLoggedInControls(loginLink, user) {
    var who = document.createElement('span');
    var name = document.createElement('strong');
    var account = document.createElement('a');
    var logout = document.createElement('button');

    // The name is hidden on narrow screens, where the header has
    // no room for it, and the two buttons remain.
    who.className = 'small me-2 d-none d-md-inline';
    who.appendChild(document.createTextNode('Signed in as '));
    name.textContent = user.displayName;
    who.appendChild(name);

    account.className = 'btn btn-outline-secondary';
    account.href = '/my-account';
    account.textContent = 'My account';

    logout.type = 'button';
    logout.className = 'btn btn-outline-secondary';
    logout.textContent = 'Log out';

    logout.addEventListener('click', function () {
      logout.disabled = true;

      fetch('/api/logout', { method: 'POST' }).then(function (response) {
        if (!response.ok) {
          throw new Error('Logout refused');
        }

        // Home rather than a reload, since the page just left may
        // have been one that only a logged in visitor can see.
        window.location.href = '/index.html';
      }).catch(function () {
        // Pretending to be logged out while still logged in would
        // be worse than saying so, so the failure is shown.
        logout.disabled = false;
        logout.textContent = 'Log out failed, try again';
      });
    });

    loginLink.replaceWith(who, document.createTextNode(' '), account,
      document.createTextNode(' '), logout);
  }

  /**
   * Asks the server who is logged in and updates the header.
   */
  function setUpAccountControls() {
    var loginLink = document.querySelector('header a[href$="login-register.html"]');

    if (!loginLink) {
      return;
    }

    getUser().then(function (user) {
      if (user) {
        showLoggedInControls(loginLink, user);

        /* The guild does not buy from its own shop, so for an
           administrator the shopping controls are hidden by a class
           on the page and one rule in the stylesheet. That covers the
           header link and every Add to cart button, including ones
           drawn later. The server refuses an administrator's order as
           well, and so does the database. */
        if (user.role === 'admin') {
          document.body.classList.add('is-admin');
        }
      }
    });
  }

  /**
   * Runs the shared set up once the document is parsed.
   */
  function init() {
    updateCartCount();
    setUpAccountControls();
    setUpGreeting();
    setUpRevisionDate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }


  /* ==========================================================
     EXPORT

     Page scripts need the cart and the hours, so a single named
     object is placed on window rather than several loose
     globals.
     ========================================================== */

  window.guildGuild = {
    cart: {
      read: readCart,
      add: addItem,
      remove: removeItem,
      setQuantity: setQuantity,
      clear: clearCart,
      count: countItems,
      totals: cartTotals,
      maxQuantity: MAX_QUANTITY
    },
    attachSteppers: attachSteppers,
    formatGold: formatGold,
    describeResults: describeResults,
    describePage: describePage,
    drawPager: drawPager,
    describeAvailability: describeAvailability,
    formatDate: formatDate,
    hireOffer: hireOffer,
    getUser: getUser,
    hallStatus: hallStatus,
    greeting: greeting,
    formatTime: formatTime
  };

}());
