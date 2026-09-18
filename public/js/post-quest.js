/* ============================================================
   Oceania Adventure Guild - post a quest page behaviour
   SIT774 Website Project, Part 3 (Task 10.2D)

   Loaded on post-quest.html only.

   Provides validation for the quest form, the two save paths
   (publish and draft), and the switch into edit mode when the
   page is opened against an existing quest.

   Validation rules, applied when publishing:
     - title, description, objectives, type, location, rank,
       duration and reward must all be filled
     - the description must be long enough to be a real brief
     - at least one objective line must be present

   Saving a draft requires only a title, because a draft is by
   definition unfinished. The visitor is told what is still
   outstanding rather than being blocked.

   When validation fails the form is not submitted, and the
   message is written into the page beside the field rather than
   shown in a popup, matching the enquiry form.

   None of this is a security control. Client side checks can be
   bypassed by anyone who wishes to, so the server repeats every
   one of them before writing a row, and additionally confirms
   that the request comes from a logged in customer who owns the
   quest being edited. Values reach the database through
   prepared statements, and are escaped again when rendered back
   out onto the quest board, because a quest title is text the
   public supplies.
   ============================================================ */

(function () {
  'use strict';

  var form = document.getElementById('quest-form');

  // Defensive guard, in case the script is loaded elsewhere.
  if (!form) {
    return;
  }

  var successNotice = document.getElementById('quest-success');
  var draftNotice = document.getElementById('quest-draft-notice');
  var editNotice = document.getElementById('quest-edit-notice');
  var publishButton = document.getElementById('quest-publish');
  var draftButton = document.getElementById('quest-save-draft');
  var descriptionField = document.getElementById('questDescription');
  var descriptionCount = document.getElementById('questDescriptionCount');
  var pageHeading = document.getElementById('page-heading');
  var pageSubtitle = document.getElementById('page-subtitle');

  var MIN_DESCRIPTION_LENGTH = 30;

  /* The fields checked before a quest may be published, in the
     order they appear on the page, so that focus moves to the
     first problem a visitor would read rather than the first one
     the script happens to test. */
  var fields = [
    document.getElementById('questTitle'),
    document.getElementById('questDescription'),
    document.getElementById('questObjectives'),
    document.getElementById('questType'),
    document.getElementById('questLocation'),
    document.getElementById('questRank'),
    document.getElementById('questDuration'),
    document.getElementById('questReward')
  ];

  /* Readable names for the outstanding list shown when an
     incomplete quest is saved as a draft. */
  var FIELD_NAMES = {
    questTitle: 'title',
    questDescription: 'description',
    questObjectives: 'objectives',
    questType: 'quest type',
    questLocation: 'location',
    questRank: 'recommended rank',
    questDuration: 'expected duration',
    questReward: 'reward'
  };


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
   * Counts the objective lines in the objectives box, ignoring
   * blank lines so that stray newlines do not count as
   * objectives.
   *
   * @param {string} value the raw contents of the box
   * @returns {number} the number of real lines
   */
  function countObjectives(value) {
    return value.split('\n').filter(function (line) {
      return line.trim() !== '';
    }).length;
  }

  /**
   * Validates a single field against the rules for publishing.
   *
   * @param {HTMLElement} field the form control
   * @returns {boolean} true if the field is valid
   */
  function validateField(field) {
    var value = field.value.trim();

    switch (field.id) {

      case 'questTitle':
        if (value === '') {
          setError(field, 'Give the quest a title.');
          return false;
        }
        break;

      case 'questDescription':
        if (value === '') {
          setError(field, 'Describe the quest.');
          return false;
        }
        if (value.length < MIN_DESCRIPTION_LENGTH) {
          setError(field, 'Tell adventurers a little more, at least '
            + MIN_DESCRIPTION_LENGTH + ' characters.');
          return false;
        }
        break;

      case 'questObjectives':
        if (value === '') {
          setError(field, 'List at least one objective.');
          return false;
        }
        if (countObjectives(value) < 1) {
          setError(field, 'List at least one objective, one per line.');
          return false;
        }
        break;

      case 'questType':
        if (value === '') {
          setError(field, 'Choose a quest type.');
          return false;
        }
        break;

      case 'questLocation':
        if (value === '') {
          setError(field, 'Say where the quest takes place.');
          return false;
        }
        break;

      case 'questRank':
        if (value === '') {
          setError(field, 'Choose a recommended rank.');
          return false;
        }
        break;

      case 'questDuration':
        if (value === '') {
          setError(field, 'Choose an expected duration.');
          return false;
        }
        break;

      case 'questReward':
        if (value === '') {
          setError(field, 'State what you are offering.');
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
     EDIT MODE

     An existing quest is edited through this same page, opened
     with its id in the address. Only the wording and the button
     labels change; the form itself is identical, because a
     second near-duplicate form would be two things to keep in
     step rather than one.

     In Part 3 the id is used to fetch the quest and fill the
     fields, and the server refuses the update unless the quest
     belongs to the account making it and is still at draft or
     open status.
     ========================================================== */

  /**
   * Reads the quest id from the page address, if there is one.
   *
   * @returns {string|null} the id, or null when posting anew
   */
  function editingQuestId() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');

    // Ids are database keys, so anything that is not a plain
    // positive integer is treated as no id at all rather than
    // being passed along.
    return /^[1-9][0-9]*$/.test(id || '') ? id : null;
  }

  /**
   * Switches the page wording into edit mode.
   *
   * @param {string} id the quest being edited
   */
  function applyEditMode(id) {
    pageHeading.textContent = 'Edit Quest';
    pageSubtitle.textContent = 'Change the terms before an adventurer takes it on.';
    document.title = 'Edit Quest | Oceania Adventure Guild';

    publishButton.textContent = 'Save changes';
    draftButton.textContent = 'Return to draft';

    editNotice.textContent = 'You are editing quest ' + id
      + '. A quest can be changed while it is a draft or open on the board, '
      + 'but not once an adventurer has accepted it.';
    editNotice.classList.remove('d-none');

    // In Part 3: fetch the quest from the server and fill the
    // fields from the returned row before the visitor sees them.
  }


  /* ==========================================================
     FORM LEVEL HANDLING
     ========================================================== */

  /**
   * Hides both result notices, so that a new attempt does not
   * sit underneath the outcome of the last one.
   */
  function clearNotices() {
    successNotice.classList.add('d-none');
    draftNotice.classList.add('d-none');
  }

  /* Publishing puts the quest in front of the whole guild, so
     every field is required and the form is blocked until they
     are all present. */
  form.addEventListener('submit', function (event) {
    var valid = true;
    var firstInvalid = null;
    var editing = editingQuestId();

    // Stop the submission before anything else, so that a failed
    // validation can never reach the server.
    event.preventDefault();

    clearNotices();

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

    /* The element is revealed before its text is written. A live
       region that is display:none when it changes is not in the
       accessibility tree, so the update would never be announced;
       revealing it afterwards does not announce it retroactively. */
    successNotice.classList.remove('d-none');

    if (editing) {
      successNotice.textContent = 'Your changes have been saved. '
        + 'The quest board now shows the updated terms.';
    } else if (document.getElementById('questAutoParty').checked) {
      successNotice.textContent = 'Quest published. Auto-Party is searching for '
        + 'a suitable adventurer, and you will be notified when one accepts.';
    } else {
      successNotice.textContent = 'Quest published. It is now on the quest board '
        + 'and adventurers can accept it.';
    }

    successNotice.scrollIntoView({ block: 'nearest' });

    // In Part 3 the quest is posted to the server and written to
    // the quests table with status 'open' at this point.
  });

  /* A draft stays private to the account, so only a title is
     required. Anything still missing is listed rather than
     treated as an error, because an unfinished draft is the
     normal case rather than a mistake. */
  draftButton.addEventListener('click', function () {
    var titleField = document.getElementById('questTitle');
    var outstanding = [];

    clearNotices();

    if (titleField.value.trim() === '') {
      setError(titleField, 'Give the quest a title before saving a draft.');
      titleField.focus();
      return;
    }

    clearError(titleField);

    // Anything blank is noted, but nothing is marked invalid,
    // since a draft is allowed to be incomplete.
    fields.forEach(function (field) {
      if (field.value.trim() === '') {
        outstanding.push(FIELD_NAMES[field.id]);
      }
    });

    draftNotice.classList.remove('d-none');

    if (outstanding.length === 0) {
      draftNotice.textContent = 'Draft saved. It is complete and ready to publish '
        + 'whenever you are.';
    } else {
      draftNotice.textContent = 'Draft saved. Still to fill in before it can be '
        + 'published: ' + outstanding.join(', ') + '.';
    }

    draftNotice.scrollIntoView({ block: 'nearest' });

    // In Part 3 the quest is written to the quests table with
    // status 'draft'. A draft never triggers Auto-Party, because
    // it is not yet on the board.
  });

  // Re-validating as the visitor corrects a field clears the
  // message as soon as the problem is fixed, rather than making
  // them submit again to find out.
  fields.forEach(function (field) {
    var eventName = field.tagName === 'SELECT' ? 'change' : 'input';

    field.addEventListener(eventName, function () {
      if (field.classList.contains('is-invalid')) {
        validateField(field);
      }
    });

    field.addEventListener('blur', function () {
      if (field.value.trim() !== '') {
        validateField(field);
      }
    });
  });


  /* ==========================================================
     CHARACTER COUNT
     ========================================================== */

  /**
   * Keeps the character count under the description box in step
   * with its contents.
   */
  function updateCharacterCount() {
    descriptionCount.textContent = String(descriptionField.value.length);
  }

  descriptionField.addEventListener('input', updateCharacterCount);


  /* ==========================================================
     START UP
     ========================================================== */

  var questId = editingQuestId();

  if (questId) {
    applyEditMode(questId);
  }

  updateCharacterCount();

}());
