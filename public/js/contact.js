/* ============================================================
   Oceania Adventure Guild - contact page behaviour
   SIT774 Website Project, Part 2 (Task 7.2D)

   Loaded on contact.html only.

   Provides the enquiry form validation required by the task,
   and the live open or closed status beside the opening hours.

   Validation rules:
     - every required field must be filled
     - the email address must be in email format
     - the phone number must be digits only, 8 to 15 characters
     - the query must be long enough to be a real question

   When validation fails the form is not submitted, an error is
   raised in JavaScript, and the message is written into the page
   beside the field rather than shown in a popup.
   ============================================================ */

(function () {
  'use strict';

  var form = document.getElementById('enquiry-form');

  // Defensive guard, in case the script is loaded elsewhere.
  if (!form) {
    return;
  }

  var successNotice = document.getElementById('enquiry-success');
  var failureNotice = document.getElementById('enquiry-failure');
  var adminNote = document.getElementById('enquiry-admin-note');
  var sendButton = form.querySelector('button[type="submit"]');
  var messageField = document.getElementById('enquiryMessage');
  var messageCount = document.getElementById('enquiryMessageCount');
  var statusElement = document.getElementById('hall-status');

  /* Set while the submit handler clears a form it has just
     accepted. The reset event cannot otherwise tell that case
     apart from the visitor pressing Clear form, and would hide
     the confirmation it had only just shown. */
  var clearingAfterSuccess = false;

  var MIN_QUERY_LENGTH = 10;
  var MIN_PHONE_DIGITS = 8;
  var MAX_PHONE_DIGITS = 15;

  /* The names the server uses in its error replies, matched to the
     controls they belong to. */
  var SERVER_FIELD_IDS = {
    name: 'enquiryName',
    email: 'enquiryEmail',
    phone: 'enquiryPhone',
    enquiryType: 'enquiryType',
    message: 'enquiryMessage'
  };

  /* An email pattern that accepts ordinary addresses and rejects
     the common mistakes: no at sign, nothing before or after it,
     no dot in the domain, or whitespace anywhere. Deliberately
     not an attempt at full RFC 5322 compliance, which no useful
     pattern achieves. */
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* Digits only. Spaces are stripped before testing so that a
     number typed as "03 5550 1234" is accepted. */
  var DIGITS_ONLY = /^[0-9]+$/;


  /* ==========================================================
     FIELD LEVEL HELPERS
     ========================================================== */

  /**
   * Writes an error message beside a field and marks the field
   * as invalid. The message region is already linked to the
   * field by aria-describedby, so assistive technology
   * announces it.
   *
   * @param {HTMLElement} field the form control
   * @param {string} message the message to display
   */
  function setError(field, message) {
    var region = document.getElementById(field.id + 'Error');

    field.classList.add('is-invalid');
    field.setAttribute('aria-invalid', 'true');

    if (region) {
      region.textContent = message;
    }
  }

  /**
   * Clears any error currently shown against a field.
   *
   * @param {HTMLElement} field the form control
   */
  function clearError(field) {
    var region = document.getElementById(field.id + 'Error');

    field.classList.remove('is-invalid');
    field.removeAttribute('aria-invalid');

    if (region) {
      region.textContent = '';
    }
  }

  /**
   * Validates a single field.
   *
   * @param {HTMLElement} field the form control
   * @returns {boolean} true if the field is valid
   */
  function validateField(field) {
    var value = field.value.trim();
    var digits;

    switch (field.id) {

      case 'enquiryName':
        if (value === '') {
          setError(field, 'Enter your name.');
          return false;
        }
        break;

      case 'enquiryEmail':
        if (value === '') {
          setError(field, 'Enter your email address.');
          return false;
        }
        if (!EMAIL_PATTERN.test(value)) {
          setError(field, 'Enter an email address in the form name@example.com.');
          return false;
        }
        break;

      case 'enquiryPhone':
        if (value === '') {
          setError(field, 'Enter your phone number.');
          return false;
        }
        // Spaces are a normal way to write a phone number, so
        // they are removed before the digits are checked.
        digits = value.replace(/\s/g, '');
        if (!DIGITS_ONLY.test(digits)) {
          setError(field, 'Enter digits only, with no letters or punctuation.');
          return false;
        }
        if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
          setError(field, 'Enter between ' + MIN_PHONE_DIGITS + ' and '
            + MAX_PHONE_DIGITS + ' digits.');
          return false;
        }
        break;

      case 'enquiryMessage':
        if (value === '') {
          setError(field, 'Enter your query.');
          return false;
        }
        if (value.length < MIN_QUERY_LENGTH) {
          setError(field, 'Tell us a little more, at least '
            + MIN_QUERY_LENGTH + ' characters.');
          return false;
        }
        break;

      default:
        break;
    }

    clearError(field);
    return true;
  }


  /* ==========================================================
     FORM LEVEL HANDLING
     ========================================================== */

  var fields = [
    document.getElementById('enquiryName'),
    document.getElementById('enquiryEmail'),
    document.getElementById('enquiryPhone'),
    messageField
  ];

  form.addEventListener('submit', function (event) {
    var valid = true;
    var firstInvalid = null;

    // Stop the submission before anything else, so that a failed
    // validation can never reach the server.
    event.preventDefault();

    successNotice.classList.add('d-none');

    // Every field is checked, rather than stopping at the first
    // failure, so the visitor sees all the problems at once.
    fields.forEach(function (field) {
      if (!validateField(field)) {
        valid = false;
        if (!firstInvalid) {
          firstInvalid = field;
        }
      }
    });

    if (!valid) {
      // Moving focus to the first problem saves the visitor
      // hunting for it, and announces the message.
      firstInvalid.focus();
      return;
    }

    /* The button is disabled while the request is out, so an impatient
       second click cannot send the enquiry twice. */
    failureNotice.classList.add('d-none');
    sendButton.disabled = true;

    fetch('/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name: document.getElementById('enquiryName').value.trim(),
        email: document.getElementById('enquiryEmail').value.trim(),
        phone: document.getElementById('enquiryPhone').value.trim(),
        enquiryType: document.getElementById('enquiryType').value,
        message: messageField.value.trim()
      })
    }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, status: response.status, data: data };
      });
    }).then(function (result) {
      var email = document.getElementById('enquiryEmail').value.trim();
      var shown = false;

      if (result.ok) {
        /* The element is revealed before its text is written. A live
           region that is display:none when it changes is not in the
           accessibility tree, so the update would never be announced;
           revealing it afterwards does not announce it retroactively. */
        successNotice.classList.remove('d-none');
        successNotice.textContent = 'Thank you. Your enquiry (reference ' + result.data.enquiry.id
          + ') has been received, and the guild will reply to ' + email
          + ' within two working days.';

        clearingAfterSuccess = true;
        form.reset();
        updateCharacterCount();
        return;
      }

      // Refusals for particular fields go beside those fields.
      Object.keys(result.data.fields || {}).forEach(function (name) {
        var field = document.getElementById(SERVER_FIELD_IDS[name]);

        if (field) {
          setError(field, result.data.fields[name]);
          shown = true;
        }
      });

      if (shown) {
        form.querySelector('.is-invalid').focus();
        return;
      }

      showFailure(result.data.error || 'Something went wrong. Please try again.');
    }).catch(function () {
      showFailure('The guild hall could not be reached. Check your connection and try again.');
    }).then(function () {
      sendButton.disabled = false;
    });
  });


  /* ==========================================================
     CHARACTER COUNT
     ========================================================== */

  /**
   * Shows a failure that belongs to no single field.
   *
   * @param {string} message what to tell the visitor
   */
  function showFailure(message) {
    failureNotice.textContent = message;
    failureNotice.classList.remove('d-none');
  }

  /**
   * Keeps the character count under the query box in step with
   * its contents.
   */
  function updateCharacterCount() {
    messageCount.textContent = String(messageField.value.length);
  }

  messageField.addEventListener('input', updateCharacterCount);


  /* ==========================================================
     GUILD HALL STATUS

     Derived from the same opening hours used for the home page
     greeting, so the two can never disagree.
     ========================================================== */

  /**
   * Writes the current open or closed status above the hours
   * table.
   */
  function updateHallStatus() {
    var status;

    if (!statusElement || !window.guildGuild) {
      return;
    }

    status = window.guildGuild.hallStatus();

    statusElement.textContent = status.message;
    statusElement.className = status.open
      ? 'alert alert-success py-2'
      : 'alert alert-secondary py-2';
  }

  /* Administrators receive enquiries in their inbox rather than send
     them, so an administrator sees a note in place of the form. The
     server refuses the request from an administrator as well, so this
     only saves them typing a message that could never be sent. */
  if (window.guildGuild) {
    window.guildGuild.getUser().then(function (user) {
      if (user && user.role === 'admin') {
        form.classList.add('d-none');
        adminNote.classList.remove('d-none');
      }
    });
  }

  updateCharacterCount();
  updateHallStatus();

  // The status is refreshed every minute, so a page left open
  // across opening or closing time does not go stale.
  window.setInterval(updateHallStatus, 60000);

}());
