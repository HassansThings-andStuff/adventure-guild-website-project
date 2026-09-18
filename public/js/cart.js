/* ============================================================
   Oceania Adventure Guild - cart behaviour
   SIT774 Website Project, Part 2 (Task 7.2D)

   Loaded on cart.html only.

   The cart itself lives in main.js, because the header badge on
   every page reads from it. This file is only concerned with
   drawing the cart on screen and keeping it in step as the
   visitor changes quantities or removes lines.

   A note on prices. They are read from the stored cart, which
   lives in the visitor's own browser and can be edited there.
   They are trusted here only to render the page. In Part 3 the
   cart moves server side and every price is looked up again
   before an order is accepted, so a tampered cart cannot change
   what anything costs.
   ============================================================ */

(function () {
  'use strict';

  var linesBody = document.getElementById('cart-lines');

  // Defensive guard, in case the script is loaded elsewhere.
  if (!linesBody || !window.guildGuild) {
    return;
  }

  var guild = window.guildGuild;

  var emptyPanel = document.getElementById('cart-empty');
  var filledPanel = document.getElementById('cart-filled');
  var message = document.getElementById('cart-message');
  var confirmClear = document.getElementById('confirm-clear-cart');

  var summary = {
    count: document.getElementById('summary-count'),
    subtotal: document.getElementById('summary-subtotal'),
    saved: document.getElementById('summary-saved'),
    savedRow: document.getElementById('summary-saved-row'),
    total: document.getElementById('summary-total')
  };

  var messageTimer = null;


  /* ==========================================================
     BUILDING A ROW

     Rows are assembled from created elements rather than from an
     HTML string, so that a stored item name is never interpreted
     as markup.

     Every cell carries a data-label. On wide screens it is unused;
     below the medium breakpoint the stylesheet turns each row into
     a stacked block and shows the label as that cell's heading, so
     the table needs no horizontal scrollbar on a phone.
     ========================================================== */

  /**
   * Creates a table cell.
   *
   * @param {string} label the heading shown in the stacked layout
   * @param {string} [extraClass] optional classes for the cell
   * @returns {HTMLTableCellElement}
   */
  function cell(label, extraClass) {
    var td = document.createElement('td');
    td.dataset.label = label;
    if (extraClass) {
      td.className = extraClass;
    }
    return td;
  }

  /**
   * Builds the quantity stepper for one line.
   *
   * @param {Object} line the cart line
   * @returns {HTMLElement} the stepper wrapper
   */
  function buildStepper(line) {
    var wrapper = document.createElement('div');
    var down = document.createElement('button');
    var label = document.createElement('label');
    var input = document.createElement('input');
    var up = document.createElement('button');
    var inputId = 'qty-' + line.id;

    wrapper.className = 'qty-stepper input-group input-group-sm';
    wrapper.dataset.itemId = line.id;

    down.type = 'button';
    down.className = 'btn btn-outline-secondary qty-down';
    down.textContent = '\u2212';
    down.setAttribute('aria-label', 'Decrease quantity of ' + line.name);

    // The number input needs its own label, or a screen reader
    // announces a spin button with no indication of which item it
    // belongs to.
    label.className = 'visually-hidden';
    label.htmlFor = inputId;
    label.textContent = 'Quantity of ' + line.name;

    input.type = 'number';
    input.className = 'form-control text-center qty-input';
    input.id = inputId;
    input.name = 'quantity-' + line.id;
    input.value = String(line.quantity);
    input.min = '1';
    input.max = String(guild.cart.maxQuantity);
    input.step = '1';
    input.inputMode = 'numeric';

    up.type = 'button';
    up.className = 'btn btn-outline-secondary qty-up';
    up.textContent = '+';
    up.setAttribute('aria-label', 'Increase quantity of ' + line.name);

    wrapper.appendChild(down);
    wrapper.appendChild(label);
    wrapper.appendChild(input);
    wrapper.appendChild(up);

    return wrapper;
  }

  /**
   * Builds one table row for a cart line.
   *
   * @param {Object} line the cart line
   * @returns {HTMLTableRowElement}
   */
  function buildRow(line) {
    var row = document.createElement('tr');
    var itemCell = cell('Item', 'cart-item-cell');
    var priceCell = cell('Unit price');
    var qtyCell = cell('Quantity');
    var totalCell = cell('Line total');
    var removeCell = cell('', 'cart-remove-cell');

    var media = document.createElement('div');
    var name = document.createElement('span');
    var remove = document.createElement('button');
    var thumb;

    row.dataset.itemId = line.id;

    // Item: thumbnail and name
    media.className = 'd-flex align-items-center gap-2';

    if (line.image) {
      thumb = document.createElement('img');
      thumb.src = line.image;
      thumb.alt = line.name;
      thumb.className = 'cart-thumb rounded';
      media.appendChild(thumb);
    }

    name.textContent = line.name;
    media.appendChild(name);
    itemCell.appendChild(media);

    // Unit price, showing the saving where there is one
    if (line.listPrice > line.price) {
      var was = document.createElement('s');
      was.textContent = guild.formatGold(line.listPrice);
      priceCell.appendChild(was);
      priceCell.appendChild(document.createTextNode(' '));
    }
    priceCell.appendChild(document.createTextNode(guild.formatGold(line.price)));

    qtyCell.appendChild(buildStepper(line));

    totalCell.textContent = guild.formatGold(line.price * line.quantity);

    // Removing a single line is easily undone by adding the item
    // again, so it asks for no confirmation.
    remove.type = 'button';
    remove.className = 'btn btn-outline-secondary btn-sm cart-remove';
    remove.dataset.itemId = line.id;
    remove.dataset.itemName = line.name;
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', 'Remove ' + line.name + ' from your cart');
    removeCell.appendChild(remove);

    row.appendChild(itemCell);
    row.appendChild(priceCell);
    row.appendChild(qtyCell);
    row.appendChild(totalCell);
    row.appendChild(removeCell);

    return row;
  }


  /* ==========================================================
     RENDERING
     ========================================================== */

  /**
   * Updates the summary panel from the stored cart.
   */
  function renderSummary() {
    var totals = guild.cart.totals();

    summary.count.textContent = String(totals.items);
    summary.subtotal.textContent = guild.formatGold(totals.subtotal);
    summary.total.textContent = guild.formatGold(totals.total);
    summary.saved.textContent = guild.formatGold(totals.saved);

    // The savings row only appears when something was actually
    // saved, rather than sitting at zero on a full price cart.
    summary.savedRow.classList.toggle('d-none', totals.saved <= 0);
  }

  /**
   * Updates one line's total in place, without redrawing the whole
   * table. Redrawing would destroy the stepper the visitor is
   * currently using and lose their focus position.
   *
   * @param {string} itemId the item's identifier
   */
  function renderLineTotal(itemId) {
    var row = linesBody.querySelector('tr[data-item-id="' + itemId + '"]');
    var line = null;

    guild.cart.read().forEach(function (candidate) {
      if (candidate.id === itemId) {
        line = candidate;
      }
    });

    if (row && line) {
      row.children[3].textContent = guild.formatGold(line.price * line.quantity);
    }
  }

  /**
   * Draws the whole cart, and swaps between the empty state and the
   * filled state.
   */
  function renderCart() {
    var cart = guild.cart.read();
    var fragment = document.createDocumentFragment();

    while (linesBody.firstChild) {
      linesBody.removeChild(linesBody.firstChild);
    }

    cart.forEach(function (line) {
      fragment.appendChild(buildRow(line));
    });

    linesBody.appendChild(fragment);

    emptyPanel.classList.toggle('d-none', cart.length > 0);
    filledPanel.classList.toggle('d-none', cart.length === 0);

    renderSummary();

    // The steppers are new elements each time the cart is redrawn,
    // so they are wired up again here.
    guild.attachSteppers(linesBody, function (itemId, quantity) {
      guild.cart.setQuantity(itemId, quantity);
      renderLineTotal(itemId);
      renderSummary();
    });
  }

  /**
   * Shows a short confirmation message.
   *
   * @param {string} text the message to show
   */
  function showMessage(text) {
    message.classList.remove('d-none');
    message.textContent = text;

    if (messageTimer !== null) {
      window.clearTimeout(messageTimer);
    }

    messageTimer = window.setTimeout(function () {
      message.classList.add('d-none');
      messageTimer = null;
    }, 4000);
  }


  /* ==========================================================
     WIRING
     ========================================================== */

  linesBody.addEventListener('click', function (event) {
    var button = event.target.closest('.cart-remove');

    if (!button) {
      return;
    }

    guild.cart.remove(button.dataset.itemId);
    renderCart();
    showMessage(button.dataset.itemName + ' removed from your cart.');
  });

  if (confirmClear) {
    confirmClear.addEventListener('click', function () {
      var dialog = window.bootstrap.Modal.getInstance(
        document.getElementById('clearCartModal')
      );

      guild.cart.clear();
      renderCart();

      if (dialog) {
        dialog.hide();
      }
    });
  }

  /* A cart changed in another tab should not leave this one showing
     stale totals, so the page redraws when storage changes
     elsewhere. */
  window.addEventListener('storage', function (event) {
    if (event.key === 'oag-cart') {
      renderCart();
    }
  });

  renderCart();

}());
