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

   Once a form passes, it is sent to the server as JSON:
   /api/login or /api/register. The server repeats every check,
   because these ones can be bypassed by anyone who does not use
   the form, and its answer is what the page then shows.
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
     TALKING TO THE SERVER
     ========================================================== */

  var SERVER_UNREACHABLE = 'The guild hall could not be reached. '
    + 'Check your connection and try again.';
  var GENERIC_FAILURE = 'Something went wrong. Please try again.';

  /**
   * Sends a JSON body to the server and resolves with the status
   * and the parsed reply, whether the request succeeded or was
   * refused. The promise rejects only when the server cannot be
   * reached at all. A reply that is not JSON, such as an error
   * page, resolves with an empty object rather than throwing.
   *
   * @param {string} url the route to post to
   * @param {Object} body the values to send
   * @returns {Promise<{ok: boolean, status: number, data: Object}>}
   */
  function postJson(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (data) {
        return { ok: response.ok, status: response.status, data: data };
      });
    });
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
  var loginButton = loginForm.querySelector('button[type="submit"]');

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

    /* The button is disabled while the request is out, so an
       impatient second click cannot send the login twice. The
       password is sent exactly as typed, since trimming it would
       change what the visitor chose. */
    loginButton.disabled = true;

    postJson('/api/login', {
      email: loginEmail.value.trim(),
      password: loginPassword.value
    }).then(function (result) {
      if (result.ok) {
        // One address for every role. The server decides which
        // account page that person is sent.
        window.location.href = '/my-account';
        return;
      }

      // The server's wording is used as it comes, because it is
      // deliberately the same for every kind of failure.
      loginError.textContent = result.data.error || GENERIC_FAILURE;
    }).catch(function () {
      loginError.textContent = SERVER_UNREACHABLE;
    }).then(function () {
      loginButton.disabled = false;
    });
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
  var registerClass = document.getElementById('registerClass');
  var classGroup = document.getElementById('adventurerClassGroup');
  var registerFailure = document.getElementById('register-failure');
  var registerButton = registerForm.querySelector('button[type="submit"]');

  var registerFields = [
    registerClass, registerName, registerEmail, registerPassword,
    registerConfirm, registerPhone, registerCharter
  ];

  /* The field names the server uses in its error replies, matched
     to the controls they belong to. The role has no entry,
     because it is a pair of radio buttons that cannot be left
     invalid from the page. */
  var SERVER_FIELD_TO_INPUT = {
    name: registerName,
    email: registerEmail,
    password: registerPassword,
    phone: registerPhone,
    charter: registerCharter,
    adventurerClass: registerClass
  };

  /**
   * Shows the class list to adventurers only. A customer has no
   * class, so anything chosen before switching back is dropped.
   */
  function updateClassVisibility() {
    var adventurer = document.getElementById('roleAdventurer').checked;

    classGroup.classList.toggle('d-none', !adventurer);

    if (!adventurer) {
      registerClass.value = '';
      clearError(registerClass);
    }
  }

  Array.prototype.forEach.call(
    registerForm.querySelectorAll('input[name="role"]'),
    function (radio) {
      radio.addEventListener('change', updateClassVisibility);
    }
  );

  /**
   * Puts the server's refusal on the page. Messages for
   * particular fields go beside those fields, and anything else
   * goes in the general region above the form.
   *
   * @param {Object} data the parsed reply from /api/register
   */
  function showRegisterErrors(data) {
    var fields = data.fields || {};
    var shown = false;

    Object.keys(fields).forEach(function (key) {
      if (SERVER_FIELD_TO_INPUT[key]) {
        setError(SERVER_FIELD_TO_INPUT[key], fields[key]);
        shown = true;
      }
    });

    if (shown) {
      focusFirstInvalid(registerFields);
      return;
    }

    showRegisterFailure(data.error || GENERIC_FAILURE);
  }

  /**
   * Shows a failure that belongs to no single field.
   *
   * @param {string} message what to tell the visitor
   */
  function showRegisterFailure(message) {
    registerFailure.textContent = message;
    registerFailure.classList.remove('d-none');
  }

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
    var email;

    event.preventDefault();
    registerSuccess.classList.add('d-none');
    registerFailure.classList.add('d-none');

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

    role = document.querySelector('input[name="role"]:checked').value;

    // The class is asked of adventurers only.
    if (role === 'adventurer' && registerClass.value === '') {
      setError(registerClass, 'Choose a class.');
      valid = false;
    } else {
      clearError(registerClass);
    }

    if (!valid) {
      focusFirstInvalid(registerFields);
      return;
    }

    email = registerEmail.value.trim();

    /* The confirmation box is left out on purpose. It is a check
       against a typing slip, and means nothing to the server.
       The class is undefined for a customer, and JSON leaves out
       any value that is undefined. */
    registerButton.disabled = true;

    postJson('/api/register', {
      role: role,
      name: registerName.value.trim(),
      email: email,
      password: registerPassword.value,
      phone: registerPhone.value.trim(),
      charter: registerCharter.checked,
      adventurerClass: (role === 'adventurer') ? registerClass.value : undefined
    }).then(function (result) {
      if (!result.ok) {
        showRegisterErrors(result.data);
        return;
      }

      /* Registering does not log anyone in. The new member is
         told to log in, which proves the credentials they just
         chose work. */
      registerSuccess.classList.remove('d-none');
      registerSuccess.textContent = 'Thank you. Your ' + role
        + ' account has been created. You can now log in with '
        + email + '.';

      clearingAfterSuccess = true;
      registerForm.reset();
      registerFields.forEach(clearError);
    }).catch(function () {
      showRegisterFailure(SERVER_UNREACHABLE);
    }).then(function () {
      registerButton.disabled = false;
    });
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
      updateClassVisibility();

      // A reset that follows a successful registration keeps the
      // confirmation on screen; one the visitor asked for clears it.
      if (!clearingAfterSuccess) {
        registerSuccess.classList.add('d-none');
      }

      clearingAfterSuccess = false;
    }, 0);
  });

}());
