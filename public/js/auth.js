/* ============================================================
   Oceania Adventure Guild - login and registration behaviour
   SIT774 Website Project, Part 2 (Task 7.2D)

   Loaded on login-register.html only.

   Validates both forms in the browser before anything is sent to
   the server. As on the enquiry form, a failed check stops the
   submission, raises the error in JavaScript, and writes the
   message into the page beside the field rather than showing a
   popup.

   The two forms share their field level helpers, because the
   rules for an email address or a phone number do not change
   between them.
   ============================================================ */

(function () {
  'use strict';

  var loginForm = document.getElementById('login-form');
  var registerForm = document.getElementById('register-form');

  // Defensive guard, in case the script is loaded elsewhere.
  if (!loginForm || !registerForm) {
    return;
  }

  var registerSuccess = document.getElementById('register-success');
  var loginError = document.getElementById('loginError');

  /* Set while the submit handler clears a form it has just
     accepted. The reset event cannot otherwise tell that case
     apart from the visitor pressing Clear, and would hide the
     confirmation it had only just shown. */
  var clearingAfterSuccess = false;

  var MIN_PASSWORD_LENGTH = 10;
  var MIN_PHONE_DIGITS = 8;
  var MAX_PHONE_DIGITS = 15;

  /* Accepts ordinary addresses and rejects the common mistakes:
     no at sign, nothing before or after it, no dot in the domain,
     or whitespace anywhere. Deliberately not an attempt at full
     RFC 5322 compliance, which no useful pattern achieves. */
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  var DIGITS_ONLY = /^[0-9]+$/;


  /* ==========================================================
     SHARED FIELD HELPERS
     ========================================================== */

  /**
   * Writes an error message beside a field and marks the field as
   * invalid. The message region is linked to the field by
   * aria-describedby, so assistive technology announces it.
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
   * Checks that a field is not blank.
   *
   * @param {HTMLElement} field the form control
   * @param {string} message the message shown when it is blank
   * @returns {boolean} true if the field has content
   */
  function requireValue(field, message) {
    if (field.value.trim() === '') {
      setError(field, message);
      return false;
    }
    return true;
  }

  /**
   * Checks that a field holds an email address.
   *
   * @param {HTMLElement} field the form control
   * @returns {boolean} true if the address is well formed
   */
  function requireEmail(field) {
    if (!requireValue(field, 'Enter your email address.')) {
      return false;
    }

    if (!EMAIL_PATTERN.test(field.value.trim())) {
      setError(field, 'Enter an email address in the form name@example.com.');
      return false;
    }

    clearError(field);
    return true;
  }

  /**
   * Checks that a field holds a phone number of digits only,
   * within the accepted length. Spaces are a normal way to write
   * a number, so they are removed before the digits are checked.
   *
   * @param {HTMLElement} field the form control
   * @returns {boolean} true if the number is acceptable
   */
  function requirePhone(field) {
    var digits;

    if (!requireValue(field, 'Enter your phone number.')) {
      return false;
    }

    digits = field.value.trim().replace(/\s/g, '');

    if (!DIGITS_ONLY.test(digits)) {
      setError(field, 'Enter digits only, with no letters or punctuation.');
      return false;
    }

    if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
      setError(field, 'Enter between ' + MIN_PHONE_DIGITS + ' and '
        + MAX_PHONE_DIGITS + ' digits.');
      return false;
    }

    clearError(field);
    return true;
  }

  /**
   * Moves focus to the first field that failed, so the visitor
   * does not have to hunt for the problem.
   *
   * @param {Array<HTMLElement>} fields the fields that were checked
   */
  function focusFirstInvalid(fields) {
    var index;

    for (index = 0; index < fields.length; index += 1) {
      if (fields[index].classList.contains('is-invalid')) {
        fields[index].focus();
        return;
      }
    }
  }


  /* ==========================================================
     LOGIN FORM

     A single combined message is used when credentials are
     rejected, rather than saying which of the two was wrong,
     because separate messages would reveal which accounts exist.
     ========================================================== */

  var loginEmail = document.getElementById('loginEmail');
  var loginPassword = document.getElementById('loginPassword');
  var loginFields = [loginEmail, loginPassword];

  loginForm.addEventListener('submit', function (event) {
    var valid = true;

    event.preventDefault();
    loginError.textContent = '';

    if (!requireEmail(loginEmail)) {
      valid = false;
    }

    if (!requireValue(loginPassword, 'Enter your password.')) {
      valid = false;
    } else {
      clearError(loginPassword);
    }

    if (!valid) {
      focusFirstInvalid(loginFields);
      return;
    }

    /* Authentication arrives in Part 3. Until then a valid form
       opens the account page, which is what the draft page note
       beneath the form describes. */
    window.location.href = 'my-account.html';
  });


  /* ==========================================================
     REGISTRATION FORM
     ========================================================== */

  var registerName = document.getElementById('registerName');
  var registerEmail = document.getElementById('registerEmail');
  var registerPassword = document.getElementById('registerPassword');
  var registerConfirm = document.getElementById('registerConfirm');
  var registerPhone = document.getElementById('registerPhone');
  var registerCharter = document.getElementById('registerCharter');

  var registerFields = [
    registerName, registerEmail, registerPassword,
    registerConfirm, registerPhone, registerCharter
  ];

  /**
   * Validates the password against the published minimum length.
   *
   * @returns {boolean} true if the password is long enough
   */
  function validatePassword() {
    if (!requireValue(registerPassword, 'Choose a password.')) {
      return false;
    }

    if (registerPassword.value.length < MIN_PASSWORD_LENGTH) {
      setError(registerPassword, 'Use at least '
        + MIN_PASSWORD_LENGTH + ' characters.');
      return false;
    }

    clearError(registerPassword);
    return true;
  }

  /**
   * Checks that the two password fields agree.
   *
   * @returns {boolean} true if they match
   */
  function validateConfirm() {
    if (!requireValue(registerConfirm, 'Enter your password again.')) {
      return false;
    }

    if (registerConfirm.value !== registerPassword.value) {
      setError(registerConfirm, 'The two passwords do not match.');
      return false;
    }

    clearError(registerConfirm);
    return true;
  }

  /**
   * Checks that the charter has been acknowledged.
   *
   * @returns {boolean} true if the box is ticked
   */
  function validateCharter() {
    if (!registerCharter.checked) {
      setError(registerCharter, 'Please read and acknowledge the guild charter.');
      return false;
    }

    clearError(registerCharter);
    return true;
  }

  registerForm.addEventListener('submit', function (event) {
    var valid = true;
    var role;

    event.preventDefault();
    registerSuccess.classList.add('d-none');

    // Every field is checked rather than stopping at the first
    // failure, so the visitor sees all the problems at once.
    if (!requireValue(registerName, 'Enter your name.')) {
      valid = false;
    } else {
      clearError(registerName);
    }

    if (!requireEmail(registerEmail)) {
      valid = false;
    }

    if (!validatePassword()) {
      valid = false;
    }

    if (!validateConfirm()) {
      valid = false;
    }

    if (!requirePhone(registerPhone)) {
      valid = false;
    }

    if (!validateCharter()) {
      valid = false;
    }

    if (!valid) {
      focusFirstInvalid(registerFields);
      return;
    }

    role = document.querySelector('input[name="role"]:checked').value;

    registerSuccess.classList.remove('d-none');
    registerSuccess.textContent = 'Thank you. Your ' + role
      + ' account has been registered, and a confirmation has been sent to '
      + registerEmail.value.trim()
      + '. Accounts become active in Part 3 of this project.';

    clearingAfterSuccess = true;
    registerForm.reset();
    registerFields.forEach(clearError);
  });


  /* ==========================================================
     LIVE CORRECTION

     Re-validating as the visitor corrects a field clears the
     message as soon as the problem is fixed, rather than making
     them submit again to find out.
     ========================================================== */

  loginFields.concat(registerFields).forEach(function (field) {
    var eventName = (field.type === 'checkbox') ? 'change' : 'input';

    field.addEventListener(eventName, function () {
      if (!field.classList.contains('is-invalid')) {
        return;
      }

      if (field === registerPassword) {
        validatePassword();
        // Correcting the password can also fix or break the
        // confirmation, so it is rechecked here.
        if (registerConfirm.value !== '') {
          validateConfirm();
        }
      } else if (field === registerConfirm) {
        validateConfirm();
      } else if (field === registerCharter) {
        validateCharter();
      } else if (field === registerEmail || field === loginEmail) {
        requireEmail(field);
      } else if (field === registerPhone) {
        requirePhone(field);
      } else if (field.value.trim() !== '') {
        clearError(field);
      }
    });
  });

  registerForm.addEventListener('reset', function () {
    window.setTimeout(function () {
      registerFields.forEach(clearError);

      // A reset that follows a successful registration keeps the
      // confirmation on screen; one the visitor asked for clears it.
      if (!clearingAfterSuccess) {
        registerSuccess.classList.add('d-none');
      }

      clearingAfterSuccess = false;
    }, 0);
  });

}());
