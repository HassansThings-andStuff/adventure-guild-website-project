/* ============================================================
   Oceania Adventure Guild - enquiry inbox behaviour
   SIT774 Website Project, Part 3 (Task 10.2D)

   Loaded on the administration page only, which only an
   administrator account can open.

   Draws the enquiries sent through the contact form, with a status
   filter, a search, an order and paging, all done by the server as a
   query. Opening an enquiry shows the whole message and lets the
   guild set its status and keep notes. Saving sends the enquiry's
   last seen update time with the change, and the server refuses the
   change if someone else has changed the enquiry since, instead of
   letting one save quietly overwrite the other.

   Every value from the server is written into the page as text,
   never as markup, because an enquiry is text a stranger typed.
   ============================================================ */

(function () {
  'use strict';

  var body = document.getElementById('enquiry-body');

  // Defensive guard, in case the script is loaded elsewhere.
  if (!body) {
    return;
  }

  var statusFilter = document.getElementById('enquiry-status');
  var searchBox = document.getElementById('enquiry-search');
  var sortBox = document.getElementById('enquiry-sort');
  var count = document.getElementById('enquiry-count');
  var table = document.getElementById('enquiry-table');
  var pager = document.getElementById('enquiry-pager');
  var navBadge = document.getElementById('nav-enquiries-count');

  var detail = document.getElementById('enquiry-detail');
  var detailForm = document.getElementById('detail-form');
  var detailStatus = document.getElementById('detail-status');
  var detailNotes = document.getElementById('detail-notes');
  var detailCount = document.getElementById('detail-notes-count');
  var detailResult = document.getElementById('detail-result');
  var detailSave = document.getElementById('detail-save');

  var TYPE_LABELS = {
    general: 'General enquiry',
    posting: 'Posting a quest',
    hiring: 'Hiring an adventurer',
    shop: 'Shop order',
    membership: 'Membership'
  };

  var STATUS_LABELS = {
    new: 'New',
    in_progress: 'In progress',
    closed: 'Closed'
  };

  var STATUS_BADGES = {
    new: 'text-bg-primary',
    in_progress: 'text-bg-warning',
    closed: 'text-bg-secondary'
  };

  // What the list is showing, and the enquiry open below it.
  var state = { status: 'all', search: '', sort: 'newest', page: 1 };
  var selected = null;

  // Each request is numbered. A slow reply to an old search must not
  // overwrite the reply to a newer one.
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
   * Turns the database's date and time into a date for people.
   *
   * @param {string} stamp for example "2026-09-20 14:05:33"
   * @returns {string} for example "20 September 2026"
   */
  function dateOf(stamp) {
    return window.guildGuild.formatDate(String(stamp).slice(0, 10));
  }

  /**
   * Shows the result of saving, and marks it as a live region so that
   * a screen reader announces it. The element is revealed before its
   * text is written.
   *
   * @param {string} kind 'success' or 'danger'
   * @param {string} text what it says
   */
  function showResult(kind, text) {
    detailResult.className = 'alert alert-' + kind + ' mt-3 mb-0';
    detailResult.setAttribute('role', kind === 'success' ? 'status' : 'alert');
    detailResult.textContent = text;
  }


  /* ==========================================================
     THE LIST
     ========================================================== */

  /**
   * Builds the row for one enquiry.
   *
   * @param {Object} enquiry one entry from the server's list
   * @returns {HTMLElement} the table row
   */
  function createRow(enquiry) {
    var row = document.createElement('tr');
    var fromCell = document.createElement('td');
    var statusCell = document.createElement('td');
    var openCell = document.createElement('td');
    var open = make('button', 'btn btn-sm btn-outline-secondary', 'Open');

    fromCell.appendChild(make('div', '', enquiry.name));

    if (enquiry.member) {
      fromCell.appendChild(make('div', 'small text-body-secondary', 'Member: ' + enquiry.member));
    }

    statusCell.appendChild(make('span', 'badge ' + STATUS_BADGES[enquiry.status],
      STATUS_LABELS[enquiry.status]));

    open.type = 'button';
    open.setAttribute('aria-label', 'Open the enquiry from ' + enquiry.name);
    open.addEventListener('click', function () {
      openEnquiry(enquiry);
    });
    openCell.appendChild(open);

    row.appendChild(make('td', '', dateOf(enquiry.receivedAt)));
    row.appendChild(fromCell);
    row.appendChild(make('td', '', TYPE_LABELS[enquiry.type] || enquiry.type || 'Not stated'));
    row.appendChild(statusCell);
    row.appendChild(openCell);

    return row;
  }

  /**
   * Puts the counts in the filter's options and the badge on the tool
   * link, so the guild can see at a glance how much is waiting.
   *
   * @param {Object} counts enquiries by status, and all of them
   */
  function drawCounts(counts) {
    Array.prototype.forEach.call(statusFilter.options, function (option) {
      var label = option.value === 'all' ? 'All enquiries' : STATUS_LABELS[option.value];

      option.textContent = label + ' (' + counts[option.value] + ')';
    });

    navBadge.textContent = counts.new + ' new';
    navBadge.classList.toggle('d-none', counts.new === 0);
  }

  /**
   * Draws a page of enquiries.
   *
   * @param {Object} data the server's reply
   */
  function drawList(data) {
    var first = (data.page - 1) * data.pageSize + 1;
    var filtered = state.status !== 'all' || state.search !== '';

    body.textContent = '';
    data.enquiries.forEach(function (enquiry) {
      body.appendChild(createRow(enquiry));
    });

    table.classList.toggle('d-none', data.enquiries.length === 0);

    if (data.total === 0) {
      count.textContent = filtered
        ? 'No enquiries match. Try a different filter or search.'
        : 'No enquiries have been sent yet.';
    } else {
      count.textContent = 'Showing ' + first + ' to ' + (first + data.enquiries.length - 1)
        + ' of ' + data.total + (data.total === 1 ? ' enquiry' : ' enquiries')
        + (filtered ? ' matching.' : '.');
    }

    state.page = data.page;
    drawCounts(data.counts);

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
    var query = new URLSearchParams({
      status: state.status,
      sort: state.sort,
      page: String(state.page)
    });

    if (state.search !== '') {
      query.set('search', state.search);
    }

    fetch('/api/admin/enquiries?' + query.toString(), {
      headers: { Accept: 'application/json' }
    }).then(function (response) {
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
        count.textContent = 'The enquiries could not be loaded. Change the filter or reload the page to try again.';
        table.classList.add('d-none');
      }
    });
  }


  /* ==========================================================
     THE ENQUIRY BEING READ
     ========================================================== */

  /**
   * Fills the panel from an enquiry and shows it.
   *
   * @param {Object} enquiry the enquiry, as the server has it
   */
  function fillDetail(enquiry) {
    var email = document.getElementById('detail-email');

    selected = enquiry;

    document.getElementById('detail-heading').textContent = 'Enquiry from ' + enquiry.name;
    document.getElementById('detail-name').textContent = enquiry.member
      ? enquiry.name + ' (member account: ' + enquiry.member + ')'
      : enquiry.name;
    email.textContent = enquiry.email;
    email.href = 'mailto:' + enquiry.email;
    document.getElementById('detail-phone').textContent = enquiry.phone || 'Not given';
    document.getElementById('detail-type').textContent = TYPE_LABELS[enquiry.type] || 'Not stated';
    document.getElementById('detail-received').textContent = dateOf(enquiry.receivedAt);
    document.getElementById('detail-message').textContent = enquiry.message;

    detailStatus.value = enquiry.status;
    detailNotes.value = enquiry.adminNotes;
    detailCount.textContent = String(detailNotes.value.length);
  }

  /**
   * Opens an enquiry from the list, moves focus to it, and clears
   * whatever the last one said.
   *
   * @param {Object} enquiry the enquiry to open
   */
  function openEnquiry(enquiry) {
    fillDetail(enquiry);
    detailResult.className = 'alert d-none mt-3 mb-0';
    detailResult.textContent = '';
    detail.classList.remove('d-none');
    detail.focus();
    detail.scrollIntoView({ block: 'nearest' });
  }

  detailNotes.addEventListener('input', function () {
    detailCount.textContent = String(detailNotes.value.length);
  });

  document.getElementById('detail-close').addEventListener('click', function () {
    detail.classList.add('d-none');
    selected = null;
  });

  detailForm.addEventListener('submit', function (event) {
    var sent = selected;

    event.preventDefault();

    if (!sent || detailSave.disabled) {
      return;
    }

    detailSave.disabled = true;

    fetch('/api/admin/enquiries/' + encodeURIComponent(sent.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        status: detailStatus.value,
        adminNotes: detailNotes.value,
        updatedAt: sent.updatedAt
      })
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (data) {
        return { ok: response.ok, status: response.status, data: data };
      });
    }).then(function (result) {
      if (result.ok) {
        fillDetail(result.data.enquiry);
        showResult('success', 'Saved. The enquiry is now ' + STATUS_LABELS[result.data.enquiry.status].toLowerCase() + '.');
        load();
        return;
      }

      // Someone else got there first. Show the enquiry as it now is.
      if (result.status === 409 && result.data.enquiry) {
        fillDetail(result.data.enquiry);
        load();
      }

      showResult('danger', (result.data.fields && (result.data.fields.adminNotes || result.data.fields.status))
        || result.data.error || 'Something went wrong. Please try again.');
    }).catch(function () {
      showResult('danger', 'The guild hall could not be reached. Check your connection and try again.');
    }).then(function () {
      detailSave.disabled = false;
    });
  });


  /* ==========================================================
     THE FILTERS
     ========================================================== */

  statusFilter.addEventListener('change', function () {
    state.status = statusFilter.value;
    state.page = 1;
    load();
  });

  sortBox.addEventListener('change', function () {
    state.sort = sortBox.value;
    state.page = 1;
    load();
  });

  // The search runs as the guild types, but only once they pause, so a
  // request is not made for every letter.
  searchBox.addEventListener('input', function () {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(function () {
      state.search = searchBox.value.trim();
      state.page = 1;
      load();
    }, 300);
  });

  document.getElementById('enquiry-filters').addEventListener('submit', function (event) {
    event.preventDefault();
    window.clearTimeout(searchTimer);
    state.search = searchBox.value.trim();
    state.page = 1;
    load();
  });

  load();

}());
