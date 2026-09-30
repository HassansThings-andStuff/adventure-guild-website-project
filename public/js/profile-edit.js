/* ============================================================
   Oceania Adventure Guild - Edit profile
   SIT774 Website Project, Housekeeping 2 (Task 10.3HD)

   Loaded on both My Account pages, before the page's own script.
   The form itself is written into each page, because an adventurer
   has a specialty to edit as well. This file looks after whichever
   fields the page has. An adventurer's availability is not here: it
   has its own panel beside Auto-Party (account-adventurer.js).

   Used by a page script as:
     var editor = window.guildProfileEditor({ onSaved: draw });
     editor.fill(profile);   // each time the account is drawn

   Edit profile opens the form in place, filled with the current
   values. Every field is checked here first, with the message
   written beside the field, and then sent to PATCH /api/my/profile,
   where the server checks everything again. The server's answer is
   the whole account, which is handed to onSaved to draw.
   ============================================================ */

(function () {
  'use strict';

  // The same limits as the server (routes/account.js).
  var MAX_NAME_LENGTH = 80;
  var PHONE_PATTERN = /^[0-9]{8,15}$/;
  var MAX_BIO_LENGTH = 600;
  var MAX_SPECIALTY_LENGTH = 60;

  /**
   * Sets up the Edit profile form on the page.
   *
   * @param {Object} options
   * @param {function(Object)} options.onSaved given the account the server returns
   * @returns {{fill: function(Object)}} fill puts a profile's values in the form
   */
  window.guildProfileEditor = function (options) {
    var form = document.getElementById('profile-form');
    var openButton = document.getElementById('profile-edit-open');
    var cancelButton = document.getElementById('profile-edit-cancel');
    var saved = document.getElementById('profile-saved');
    var failure = document.getElementById('profile-failure');

    var fields = {
      name: document.getElementById('profile-name'),
      phone: document.getElementById('profile-phone'),
      bio: document.getElementById('profile-bio'),
      // Adventurers only. On the customer page this is null.
      specialty: document.getElementById('profile-specialty')
    };

    var current = null;

    if (!form || !openButton) {
      return { fill: function () {} };
    }

    /* ----------------------------------------------------------
       Field messages
       ---------------------------------------------------------- */

    function errorFor(name) {
      return document.getElementById('profile-' + name + '-error');
    }

    function showError(name, message) {
      var field = fields[name];
      var error = errorFor(name);

      if (error) {
        error.textContent = message;
      }

      if (field) {
        field.classList.add('is-invalid');
        field.setAttribute('aria-invalid', 'true');
      }
    }

    function clearErrors() {
      Object.keys(fields).forEach(function (name) {
        var field = fields[name];
        var error = errorFor(name);

        if (error) {
          error.textContent = '';
        }

        if (field) {
          field.classList.remove('is-invalid');
          field.removeAttribute('aria-invalid');
        }
      });

      failure.classList.add('d-none');
    }

    /* ----------------------------------------------------------
       Opening, filling and closing
       ---------------------------------------------------------- */

    function fill(profile) {
      current = profile;

      if (form.classList.contains('d-none')) {
        putValues();
      }
    }

    function putValues() {
      if (!current) {
        return;
      }

      fields.name.value = current.name || '';
      fields.phone.value = current.phone || '';
      fields.bio.value = current.bio || '';

      if (fields.specialty) {
        fields.specialty.value = current.specialty || '';
      }
    }

    function open() {
      clearErrors();
      putValues();
      saved.classList.add('d-none');
      form.classList.remove('d-none');
      openButton.setAttribute('aria-expanded', 'true');
      fields.name.focus();
    }

    function close() {
      form.classList.add('d-none');
      openButton.setAttribute('aria-expanded', 'false');
      openButton.focus();
    }

    /* ----------------------------------------------------------
       Checking and sending
       ---------------------------------------------------------- */

    function readValues() {
      var values = {
        name: fields.name.value.trim(),
        phone: fields.phone.value.replace(/\s/g, ''),
        bio: fields.bio.value.trim()
      };

      if (fields.specialty) {
        values.specialty = fields.specialty.value.trim();
      }

      return values;
    }

    function check(values) {
      var problems = {};

      if (values.name === '') {
        problems.name = 'Enter your name.';
      } else if (values.name.length > MAX_NAME_LENGTH) {
        problems.name = 'Keep your name to ' + MAX_NAME_LENGTH + ' characters or fewer.';
      }

      if (!PHONE_PATTERN.test(values.phone)) {
        problems.phone = 'Enter between 8 and 15 digits.';
      }

      if (values.bio.length > MAX_BIO_LENGTH) {
        problems.bio = 'Keep your biography to ' + MAX_BIO_LENGTH + ' characters or fewer.';
      }

      if (values.specialty !== undefined && values.specialty.length > MAX_SPECIALTY_LENGTH) {
        problems.specialty = 'Keep your specialty to ' + MAX_SPECIALTY_LENGTH + ' characters or fewer.';
      }

      return problems;
    }

    function showProblems(problems) {
      var first = null;

      Object.keys(problems).forEach(function (name) {
        showError(name, problems[name]);
        first = first || fields[name];
      });

      if (first) {
        first.focus();
      }
    }

    function send(values) {
      var submit = form.querySelector('button[type="submit"]');

      submit.disabled = true;

      fetch('/api/my/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(values)
      }).then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (data) {
          return { ok: response.ok, data: data };
        });
      }).then(function (result) {
        submit.disabled = false;

        if (!result.ok) {
          if (result.data.fields) {
            showProblems(result.data.fields);
          }

          failure.textContent = result.data.error || 'Your profile could not be saved. Please try again.';
          failure.classList.remove('d-none');
          return;
        }

        close();
        saved.classList.remove('d-none');

        // The header names the member too, so it changes with the profile.
        var headerName = document.getElementById('header-member-name');

        if (headerName && result.data.profile) {
          headerName.textContent = result.data.profile.name;
        }

        options.onSaved(result.data);
      }).catch(function () {
        submit.disabled = false;
        failure.textContent = 'The guild could not be reached. Please try again.';
        failure.classList.remove('d-none');
      });
    }

    /* ----------------------------------------------------------
       Wiring
       ---------------------------------------------------------- */

    openButton.addEventListener('click', function () {
      if (form.classList.contains('d-none')) {
        open();
      } else {
        close();
      }
    });

    cancelButton.addEventListener('click', close);

    // A field's message goes as soon as it is being corrected.
    Object.keys(fields).forEach(function (name) {
      var field = fields[name];

      if (field) {
        field.addEventListener('input', function () {
          var error = errorFor(name);

          if (error) {
            error.textContent = '';
          }

          field.classList.remove('is-invalid');
          field.removeAttribute('aria-invalid');
        });
      }
    });

    form.addEventListener('submit', function (event) {
      var values = readValues();
      var problems;

      event.preventDefault();
      clearErrors();
      problems = check(values);

      if (Object.keys(problems).length > 0) {
        showProblems(problems);
        return;
      }

      send(values);
    });

    return { fill: fill };
  };

}());
