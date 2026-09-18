/* ============================================================
   Oceania Adventure Guild - item detail behaviour
   SIT774 Website Project, Part 2 (Task 7.2D)

   Loaded on item-detail.html only.

   Unlike the shop grid, which adds one item at a time, a detail
   page lets the visitor choose how many to order. The quantity
   control is the shared stepper from main.js, so the cart page
   and this page behave identically.
   ============================================================ */

(function () {
  'use strict';

  var form = document.getElementById('item-order-form');

  // Defensive guard, in case the script is loaded elsewhere.
  if (!form || !window.guildGuild) {
    return;
  }

  var guild = window.guildGuild;
  var button = form.querySelector('.add-to-cart');
  var input = form.querySelector('.qty-input');
  var message = document.getElementById('item-message');
  var messageTimer = null;

  if (!button || !input) {
    return;
  }

  // Wiring the stepper handles the plus and minus controls and
  // keeps typed values within range.
  guild.attachSteppers(form);

  /**
   * Shows a short confirmation after an item is added.
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
    }, 5000);
  }

  form.addEventListener('submit', function (event) {
    var wanted = parseInt(input.value, 10);
    var total;

    /* The form never reaches the server at this stage, and the
       stepper has already kept the field within range. The value is
       parsed again here rather than trusted, because a field can be
       changed by other means between the last stepper event and the
       submission. */
    event.preventDefault();

    if (!Number.isFinite(wanted) || wanted < 1) {
      wanted = 1;
      input.value = '1';
    }

    if (wanted > guild.cart.maxQuantity) {
      wanted = guild.cart.maxQuantity;
      input.value = String(wanted);
    }

    total = guild.cart.add({
      id: button.dataset.itemId,
      name: button.dataset.itemName,
      price: Number(button.dataset.itemPrice),
      listPrice: Number(button.dataset.itemListPrice),
      image: button.dataset.itemImage,
      quantity: wanted
    });

    showMessage(
      wanted + ' \u00d7 ' + button.dataset.itemName
      + ' added to your cart. You now have ' + total
      + ' of these.'
    );
  });

}());
