/* ============================================================
   Oceania Adventure Guild - post a quest page behaviour
   SIT774 Website Project, Part 3 (Task 10.2D)

   Loaded on the Post a Quest page only, which only a customer
   account can open.

   The page writes a quest to the database, and the same form edits
   one that is already there, so there is one form to keep in step
   rather than two. It is opened three ways:

     /post-quest            a new quest
     /post-quest?id=7       one of the customer's own quests, filled
                            in from the server, to change or remove
     /post-quest?hire=4     a new quest addressed to one adventurer,
                            which stays off the quest board

   There are two ways to save. Publishing puts the quest in front of
   the whole guild, so every field is required, and the customer is
   asked to confirm. Saving a draft requires only a title, because a
   draft is by definition unfinished, and the customer is told what
   is still outstanding rather than being blocked.

   When validation fails nothing is sent, and the message is written
   into the page beside the field rather than shown in a popup,
   matching the enquiry form.

   None of this is a security control. Client side checks can be
   bypassed by anyone who wishes to, so the server repeats every one
   of them before writing a row, and additionally confirms that the
   request comes from a logged in customer who owns the quest being
   changed. Everything the server sends back is written into the
   page as text, never as markup, because a quest is text the public
   supplies.
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
     THE PAGE'S STATE
     ========================================================== */

  var errorNotice = document.getElementById('quest-error');
  var hireNotice = document.getElementById('quest-hire-notice');
  var removeButton = document.getElementById('quest-remove');
  var autoPartyBox = document.getElementById('questAutoParty');

  /* The names the server uses in its replies, matched to the controls
     they belong to. */
  var SERVER_FIELD_IDS = {
    title: 'questTitle',
    description: 'questDescription',
    objectives: 'questObjectives',
    type: 'questType',
    location: 'questLocation',
    rank: 'questRank',
    duration: 'questDuration',
    reward: 'questReward'
  };

  var UNREACHABLE = 'The guild hall could not be reached. Check your connection and try again.';

  /* The quest being edited, once there is one. A quest that has just
     been written becomes "the quest being edited" at once, so a
     second press of Save changes it rather than writing a duplicate. */
  var currentQuestId = null;

  // The state of the saved quest: null for a new one, otherwise
  // 'draft' or 'open'.
  var loadedStatus = null;

  // Who is being hired, if anyone.
  var hireId = null;
  var hireName = '';

  var busy = false;


  /* ==========================================================
     READING THE ADDRESS
     ========================================================== */

  /**
   * Reads a whole-number parameter from the page address. Ids are
   * database keys, so anything that is not a plain positive integer
   * is treated as absent rather than being passed along.
   *
   * @param {string} name the parameter, such as 'id' or 'hire'
   * @returns {string|null} the number as text, or null
   */
  function numberFromAddress(name) {
    var value = new URLSearchParams(window.location.search).get(name);

    return /^[1-9][0-9]{0,9}$/.test(value || '') ? value : null;
  }


  /* ==========================================================
     WORDING AND STATE
     ========================================================== */

  /**
   * Shows or hides a notice, writing its text first. The element is
   * revealed before its text is written, because a live region that
   * is display:none when it changes is not in the accessibility
   * tree, so the update would never be announced.
   *
   * @param {HTMLElement} notice the notice element
   * @param {string} text what it says
   */
  function showNotice(notice, text) {
    notice.classList.remove('d-none');
    notice.textContent = text;
  }

  /**
   * Switches the wording to match the saved quest's state, so the
   * buttons say what they will do.
   *
   * @param {string|null} status null for a new quest, otherwise the saved status
   */
  function setMode(status) {
    loadedStatus = status;

    if (status === null) {
      return;
    }

    pageHeading.textContent = status === 'draft' ? 'Edit Draft' : 'Edit Quest';
    pageSubtitle.textContent = status === 'draft'
      ? 'Finish the quest, then publish it when you are ready.'
      : 'Change the terms before an adventurer takes it on.';
    document.title = pageHeading.textContent + ' | Oceania Adventure Guild';

    publishButton.textContent = status === 'draft' ? 'Publish quest' : 'Save changes';
    draftButton.textContent = status === 'draft' ? 'Save draft' : 'Return to draft';
    removeButton.textContent = status === 'draft' ? 'Delete draft' : 'Cancel quest';
    removeButton.classList.remove('d-none');
  }

  /**
   * Disables or enables the buttons while a request is out, so an
   * impatient second click cannot send the same thing twice.
   *
   * @param {boolean} state true while a request is out
   */
  function setBusy(state) {
    busy = state;
    publishButton.disabled = state;
    draftButton.disabled = state;
    removeButton.disabled = state;
  }

  /**
   * Switches the whole form off, for a quest that cannot be changed.
   */
  function lockForm() {
    Array.prototype.forEach.call(form.elements, function (element) {
      element.disabled = true;
    });
  }

  /**
   * Hides both result notices, so that a new attempt does not
   * sit underneath the outcome of the last one.
   */
  function clearNotices() {
    successNotice.classList.add('d-none');
    draftNotice.classList.add('d-none');
    errorNotice.classList.add('d-none');
  }


  /* ==========================================================
     TALKING TO THE SERVER
     ========================================================== */

  /**
   * Sends a request and resolves with the status and the parsed
   * reply, whether the server accepted it or refused it. Rejects
   * only when the server cannot be reached at all. A reply that is
   * not JSON resolves with an empty object.
   *
   * @param {string} method GET, POST, PUT or DELETE
   * @param {string} url the address
   * @param {Object} [body] the values to send
   * @returns {Promise<{ok: boolean, status: number, data: Object}>}
   */
  function request(method, url, body) {
    var options = { method: method, headers: { Accept: 'application/json' } };

    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    return fetch(url, options).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (data) {
        return { ok: response.ok, status: response.status, data: data };
      });
    });
  }

  /**
   * Puts the server's refusal on the page. A refusal for a
   * particular field goes beside that field. Anything else goes in
   * the message above the form.
   *
   * @param {Object} data the parsed refusal
   */
  function showServerErrors(data) {
    var first = null;

    Object.keys(data.fields || {}).forEach(function (name) {
      var field = document.getElementById(SERVER_FIELD_IDS[name]);

      if (field) {
        setError(field, data.fields[name]);
        first = first || field;
      } else if (name === 'autoParty' || name === 'hireId') {
        showNotice(errorNotice, data.fields[name]);
      }
    });

    if (first) {
      first.focus();
      return;
    }

    if (errorNotice.classList.contains('d-none')) {
      showNotice(errorNotice, data.error || 'Something went wrong. Please try again.');
    }
  }

  /**
   * Collects the form into the body the server expects.
   *
   * @param {string} intent 'publish' or 'draft'
   * @returns {Object} the values to send
   */
  function buildPayload(intent) {
    var body = { intent: intent };

    Object.keys(SERVER_FIELD_IDS).forEach(function (name) {
      body[name] = document.getElementById(SERVER_FIELD_IDS[name]).value.trim();
    });

    // Who is hired is fixed when the quest is first written.
    if (!currentQuestId && hireId) {
      body.hireId = Number(hireId);
    }

    return body;
  }

  /**
   * Adds a link to the quest's own page after the text of a notice.
   *
   * @param {HTMLElement} notice the notice element
   * @param {number} id the quest's number
   */
  function addViewLink(notice, id) {
    var link = document.createElement('a');

    link.href = 'quest-detail.html?id=' + encodeURIComponent(id);
    link.textContent = 'View the quest';
    notice.appendChild(document.createTextNode(' '));
    notice.appendChild(link);
  }

  /**
   * Tells the customer what just happened, after the server has
   * accepted a save.
   *
   * @param {string} intent 'publish' or 'draft'
   * @param {string|null} before the saved state before this save
   * @param {Object} quest the quest from the server
   */
  function announceSaved(intent, before, quest) {
    var outstanding = [];

    if (intent === 'publish') {
      showNotice(successNotice, before === 'open'
        ? 'Your changes have been saved. The quest board now shows the updated terms.'
        : hireName
          ? 'Quest sent to ' + hireName + '. It stays off the quest board, and the guild brokers the arrangements.'
          : 'Quest published. It is now on the quest board and adventurers can accept it.');
      addViewLink(successNotice, quest.id);
      successNotice.scrollIntoView({ block: 'nearest' });
      return;
    }

    if (before === 'open') {
      showNotice(draftNotice, 'Quest returned to draft. It is no longer on the quest board.');
      draftNotice.scrollIntoView({ block: 'nearest' });
      return;
    }

    fields.forEach(function (field) {
      if (field.value.trim() === '') {
        outstanding.push(FIELD_NAMES[field.id]);
      }
    });

    showNotice(draftNotice, outstanding.length === 0
      ? 'Draft saved. It is complete and ready to publish whenever you are.'
      : 'Draft saved. Still to fill in before it can be published: ' + outstanding.join(', ') + '.');
    draftNotice.scrollIntoView({ block: 'nearest' });
  }

  /**
   * Saves the quest: writes a new one, or changes the one being
   * edited. Once a quest has been written the page carries on as an
   * edit of it, so pressing save again changes that quest instead of
   * writing another.
   *
   * @param {string} intent 'publish' or 'draft'
   */
  function save(intent) {
    var before = loadedStatus;

    clearNotices();
    setBusy(true);

    request(
      currentQuestId ? 'PUT' : 'POST',
      currentQuestId ? '/api/quests/' + currentQuestId : '/api/quests',
      buildPayload(intent)
    ).then(function (result) {
      var quest;

      if (!result.ok) {
        showServerErrors(result.data);
        return;
      }

      quest = result.data.quest;
      currentQuestId = String(quest.id);
      setMode(quest.status);

      // The address now names the quest, so a reload or a bookmark
      // opens it for editing rather than starting a new one.
      window.history.replaceState(null, '', '/post-quest?id=' + encodeURIComponent(quest.id));

      announceSaved(intent, before, quest);
    }).catch(function () {
      showNotice(errorNotice, UNREACHABLE);
    }).then(function () {
      setBusy(false);
    });
  }

  /**
   * Removes the quest being edited: a draft is deleted, and a quest
   * that has been on the board is cancelled. The customer is asked
   * first, because neither can be undone from here.
   */
  function remove() {
    var isDraft = loadedStatus === 'draft';

    if (!window.confirm(isDraft
      ? 'Delete this draft? It cannot be recovered.'
      : 'Cancel this quest? It will leave the quest board, and cannot be reopened.')) {
      return;
    }

    clearNotices();
    setBusy(true);

    request('DELETE', '/api/quests/' + currentQuestId).then(function (result) {
      if (!result.ok) {
        showNotice(errorNotice, result.data.error || 'Something went wrong. Please try again.');
        return;
      }

      // Back to the account page, where the quest is gone or marked cancelled.
      window.location.href = '/my-account';
    }).catch(function () {
      showNotice(errorNotice, UNREACHABLE);
    }).then(function () {
      setBusy(false);
    });
  }


  /* ==========================================================
     FORM LEVEL HANDLING
     ========================================================== */

  /* Publishing puts the quest in front of the whole guild, so every
     field is required and the form is blocked until they are all
     present. Publishing a quest for the first time then asks the
     customer to confirm, since it cannot be quietly taken back. */
  form.addEventListener('submit', function (event) {
    var valid = true;
    var firstInvalid = null;

    // Stop the submission before anything else, so that a failed
    // validation can never reach the server.
    event.preventDefault();

    if (busy) {
      return;
    }

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

    if (loadedStatus !== 'open' && !window.confirm(hireName
      ? 'Send this quest to ' + hireName + '? It will stay off the quest board.'
      : 'Publish this quest? It will appear on the quest board for everyone.')) {
      return;
    }

    save('publish');
  });

  /* A draft stays private to the account, so only a title is
     required. Anything still missing is listed rather than
     treated as an error, because an unfinished draft is the
     normal case rather than a mistake. */
  draftButton.addEventListener('click', function () {
    var titleField = document.getElementById('questTitle');

    if (busy) {
      return;
    }

    clearNotices();

    if (titleField.value.trim() === '') {
      setError(titleField, 'Give the quest a title before saving a draft.');
      titleField.focus();
      return;
    }

    clearError(titleField);

    // A quest that is on the board leaves it when it goes back to draft.
    if (loadedStatus === 'open' && !window.confirm(
      'Return this quest to draft? It will leave the quest board until you publish it again.'
    )) {
      return;
    }

    save('draft');
  });

  removeButton.addEventListener('click', function () {
    if (!busy) {
      remove();
    }
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
     OPENING AN EXISTING QUEST

     The quest is fetched from the server and its fields are filled
     in. The server only sends the editing details to the customer
     who posted the quest, so a quest that is someone else's, or does
     not exist, comes back exactly as "not found" and the form is
     switched off. A quest an adventurer has already accepted, or
     one that is finished, can no longer be changed, and the form is
     switched off for that too.
     ========================================================== */

  /**
   * Fills the form from a quest the server has sent.
   *
   * @param {Object} quest the quest from the server
   */
  function fillForm(quest) {
    document.getElementById('questTitle').value = quest.title;
    document.getElementById('questDescription').value = quest.description;
    document.getElementById('questObjectives').value = quest.objectives.join('\n');
    document.getElementById('questType').value = quest.type || '';
    document.getElementById('questLocation').value = quest.location;
    document.getElementById('questRank').value = quest.rank || '';
    document.getElementById('questDuration').value = quest.duration || '';
    document.getElementById('questReward').value = quest.reward;
    updateCharacterCount();
  }

  /**
   * Opens an existing quest for editing.
   *
   * @param {string} id the quest's number
   */
  function openQuest(id) {
    setBusy(true);

    request('GET', '/api/quests/' + id).then(function (result) {
      var quest = result.ok ? result.data.quest : null;

      if (!quest || !quest.isMine) {
        showNotice(editNotice, 'That quest could not be found among your quests.');
        lockForm();
        return;
      }

      if (quest.status !== 'draft' && quest.status !== 'open') {
        showNotice(editNotice, quest.status === 'matched'
          ? 'An adventurer has accepted this quest, so it can no longer be changed.'
          : 'This quest is finished, so it can no longer be changed.');
        lockForm();
        return;
      }

      currentQuestId = id;
      fillForm(quest);

      if (quest.hiring) {
        hireName = quest.hiring.name;
        showNotice(hireNotice, 'This quest is addressed to ' + hireName
          + ' alone, and stays off the quest board.');
      }

      setMode(quest.status);
      setBusy(false);
    }).catch(function () {
      showNotice(editNotice, UNREACHABLE);
      lockForm();
    });
  }


  /* ==========================================================
     HIRING

     The page is opened from an adventurer's profile as
     post-quest?hire=4. A hired quest is addressed to that one
     adventurer, stays off the quest board, and cannot also be
     offered through Auto-Party, since the ways of finding an
     adventurer are kept separate. The page says so.
     ========================================================== */

  /**
   * Looks the adventurer up and tells the customer who they are hiring.
   *
   * @param {string} id the adventurer's number
   */
  function openHire(id) {
    request('GET', '/api/adventurers/' + id).then(function (result) {
      if (!result.ok) {
        showNotice(hireNotice, 'That adventurer is not on the register, so this will be an '
          + 'ordinary quest for the board.');
        return;
      }

      hireId = id;
      hireName = result.data.adventurer.name;
      showNotice(hireNotice, 'You are hiring ' + hireName + '. This quest will be addressed to '
        + hireName + ' alone and will stay off the quest board. The guild brokers the arrangements.');
    }).catch(function () {
      // Not being able to look the name up is not worth an error. The
      // quest can still be written as an ordinary one.
    });
  }


  /* ==========================================================
     START UP
     ========================================================== */

  /* Auto-Party is the next feature to be built. Until the search that
     runs it exists, the choice is switched off, and the server
     refuses it as well. */
  autoPartyBox.checked = false;
  autoPartyBox.disabled = true;

  if (numberFromAddress('id')) {
    openQuest(numberFromAddress('id'));
  } else if (numberFromAddress('hire')) {
    openHire(numberFromAddress('hire'));
  }

  updateCharacterCount();

}());
