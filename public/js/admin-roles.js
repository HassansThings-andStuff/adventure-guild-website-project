/* ============================================================
   Oceania Adventure Guild - role correction behaviour
   SIT774 Website Project, Part 3 (Task 10.2D)

   Loaded on the administration page only, which only an
   administrator account can open.

   Lists the members, with a role filter and a search done by the
   server, and lets the guild correct a role. It is for putting right
   a mistake made at registration. The server refuses a change that
   would erase a member's history or strand their work, and says why,
   and this page shows the reason as it was given.

   The member's own login is updated by the server on their next
   request, so a demoted member does not keep their old powers until
   their session runs out.

   Every value from the server is written into the page as text,
   never as markup, because a name is typed in by the member.
   ============================================================ */

(function () {
  'use strict';

  var body = document.getElementById('roles-body');

  // Defensive guard, in case the script is loaded elsewhere.
  if (!body) {
    return;
  }

  var roleFilter = document.getElementById('roles-role');
  var searchBox = document.getElementById('roles-search');
  var count = document.getElementById('roles-count');
  var table = document.getElementById('roles-table');
  var pager = document.getElementById('roles-pager');
  var notice = document.getElementById('roles-notice');
  var failure = document.getElementById('roles-failure');

  var ROLE_LABELS = {
    customer: 'Customer',
    adventurer: 'Adventurer',
    admin: 'Administrator'
  };

  var state = { role: 'all', search: '', page: 1 };
  var latest = 0;
  var searchTimer = null;


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


  /* ==========================================================
     CHANGING A ROLE
     ========================================================== */

  /**
   * Sends a role change, after asking first, and draws the list again.
   * The list is drawn again whatever the outcome, so a refusal shows
   * things as they now are.
   *
   * @param {Object} member the member, from the list
   * @param {string} role the role to give them
   * @param {string} [adventurerClass] the class, when making an adventurer
   */
  function changeRole(member, role, adventurerClass) {
    var question = role === 'adventurer'
      ? 'Make ' + member.name + ' an adventurer (' + adventurerClass + ', bronze rank)?'
      : 'Make ' + member.name + ' a customer? Their adventurer profile will be removed.';

    if (!window.confirm(question)) {
      return;
    }

    announce(null, '');

    fetch('/api/admin/users/' + encodeURIComponent(member.id) + '/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ role: role, class: adventurerClass })
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (data) {
        return { ok: response.ok, data: data };
      });
    }).then(function (result) {
      if (result.ok) {
        announce(notice, member.name + ' is now ' + (role === 'adventurer' ? 'an adventurer.' : 'a customer.'));
      } else {
        announce(failure, (result.data.fields && (result.data.fields.class || result.data.fields.role))
          || result.data.error || 'Something went wrong. Please try again.');
      }

      load();
    }).catch(function () {
      announce(failure, 'The guild hall could not be reached. Check your connection and try again.');
    });
  }


  /* ==========================================================
     THE LIST
     ========================================================== */

  /**
   * Builds the cell holding what can be done to a member. A customer
   * can become an adventurer, which needs a class, and an adventurer
   * can become a customer. An administrator cannot be changed here.
   *
   * @param {Object} member one entry from the server's list
   * @param {Array<string>} classes the classes a new adventurer may have
   * @returns {HTMLElement} the table cell
   */
  function createChangeCell(member, classes) {
    var cell = document.createElement('td');
    var group;
    var picker;
    var button;

    if (member.role === 'admin') {
      cell.appendChild(make('span', 'text-body-secondary', 'Not changed from here'));
      return cell;
    }

    if (member.role === 'customer') {
      group = make('div', 'd-flex flex-wrap gap-1 align-items-center', '');
      picker = make('select', 'form-select form-select-sm w-auto', '');
      picker.setAttribute('aria-label', 'Class for ' + member.name);

      classes.forEach(function (name) {
        var option = make('option', '', name);

        option.value = name;
        picker.appendChild(option);
      });

      button = make('button', 'btn btn-sm btn-outline-primary', 'Make adventurer');
      button.type = 'button';
      button.setAttribute('aria-label', 'Make ' + member.name + ' an adventurer');
      button.addEventListener('click', function () {
        changeRole(member, 'adventurer', picker.value);
      });

      group.appendChild(picker);
      group.appendChild(button);
      cell.appendChild(group);
      return cell;
    }

    button = make('button', 'btn btn-sm btn-outline-primary', 'Make customer');
    button.type = 'button';
    button.setAttribute('aria-label', 'Make ' + member.name + ' a customer');
    button.addEventListener('click', function () {
      changeRole(member, 'customer');
    });
    cell.appendChild(button);

    return cell;
  }

  /**
   * Builds the row for one member.
   *
   * @param {Object} member one entry from the server's list
   * @param {Array<string>} classes the classes a new adventurer may have
   * @returns {HTMLElement} the table row
   */
  function createRow(member, classes) {
    var row = document.createElement('tr');
    var roleCell = document.createElement('td');

    roleCell.textContent = ROLE_LABELS[member.role];

    if (member.class) {
      roleCell.appendChild(make('div', 'small text-body-secondary', member.class));
    }

    row.appendChild(make('td', '', member.name));
    row.appendChild(make('td', '', member.email));
    row.appendChild(roleCell);
    row.appendChild(createChangeCell(member, classes));

    return row;
  }

  /**
   * Draws a page of members.
   *
   * @param {Object} data the server's reply
   */
  function drawList(data) {
    var first = (data.page - 1) * data.pageSize + 1;
    var filtered = state.role !== 'all' || state.search !== '';

    body.textContent = '';
    data.users.forEach(function (member) {
      body.appendChild(createRow(member, data.classes));
    });

    table.classList.toggle('d-none', data.users.length === 0);

    count.textContent = data.total === 0
      ? 'No members match. Try a different filter or search.'
      : 'Showing ' + first + ' to ' + (first + data.users.length - 1) + ' of ' + data.total
        + (data.total === 1 ? ' member' : ' members') + (filtered ? ' matching.' : '.')
        + ' ' + data.counts.customer + ' customers, ' + data.counts.adventurer + ' adventurers, '
        + data.counts.admin + (data.counts.admin === 1 ? ' administrator.' : ' administrators.');

    state.page = data.page;

    window.guildGuild.drawPager(pager, data.page, data.totalPages, function (target) {
      state.page = target;
      load();
    });
  }

  /**
   * Asks the server for the current page and draws it.
   */
  function load() {
    var request = ++latest;
    var query = new URLSearchParams({ role: state.role, page: String(state.page) });

    if (state.search !== '') {
      query.set('search', state.search);
    }

    fetch('/api/admin/users?' + query.toString(), { headers: { Accept: 'application/json' } }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, data: data };
      });
    }).then(function (result) {
      if (request !== latest) {
        return;
      }

      if (!result.ok) {
        throw new Error('The server refused the request');
      }

      drawList(result.data);
    }).catch(function () {
      if (request === latest) {
        count.textContent = 'The members could not be loaded. Change the filter or reload the page to try again.';
        table.classList.add('d-none');
      }
    });
  }


  /* ==========================================================
     THE FILTERS
     ========================================================== */

  roleFilter.addEventListener('change', function () {
    state.role = roleFilter.value;
    state.page = 1;
    load();
  });

  searchBox.addEventListener('input', function () {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(function () {
      state.search = searchBox.value.trim();
      state.page = 1;
      load();
    }, 300);
  });

  document.getElementById('roles-filters').addEventListener('submit', function (event) {
    event.preventDefault();
    window.clearTimeout(searchTimer);
    state.search = searchBox.value.trim();
    state.page = 1;
    load();
  });

  load();

}());
