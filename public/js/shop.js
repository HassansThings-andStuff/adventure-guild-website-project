/* ============================================================
   Oceania Adventure Guild - guild shop behaviour
   SIT774 Website Project, Part 2 (Task 7.2D)

   Loaded on guild-shop.html only.

   Provides the search, filter and sort function required by the
   project specification, plus the add to cart control. Filtering
   runs against the items already present in the page, so no
   round trip to the server is needed. In Part 3 the same
   controls query the database instead.
   ============================================================ */

(function () {
  'use strict';

  var form = document.getElementById('shop-filter-form');
  var results = document.getElementById('shop-results');

  // Defensive guard. If the script is ever loaded on a page
  // without the shop markup, it does nothing rather than
  // throwing on a null reference.
  if (!form || !results) {
    return;
  }

  var items = Array.prototype.slice.call(results.querySelectorAll('.shop-item'));
  var countLabel = document.getElementById('shop-result-count');
  var emptyNotice = document.getElementById('shop-empty');
  var cartMessage = document.getElementById('cart-message');
  var subcategoryWrapper = document.getElementById('shopSubcategories');
  var subcategoryButtons = Array.prototype.slice.call(
    document.querySelectorAll('.subcategory-btn')
  );

  var searchField = document.getElementById('shopSearch');
  var categoryField = document.getElementById('shopCategory');
  var priceField = document.getElementById('shopPrice');
  var sortField = document.getElementById('shopSort');
  var materialField = document.getElementById('shopMaterial');
  var leadField = document.getElementById('shopLead');

  // Only Weapons has subcategories in the current catalogue.
  var CATEGORIES_WITH_SUBCATEGORIES = ['Weapons'];

  var activeSubcategory = '';
  var messageTimer = null;


  /* ==========================================================
     FILTERING
     ========================================================== */

  /**
   * Tests one item against the current filter values.
   *
   * @param {HTMLElement} item the item's wrapper element
   * @param {Object} filters the current filter values
   * @returns {boolean} true if the item should be shown
   */
  function matches(item, filters) {
    var name = (item.dataset.name || '').toLowerCase();
    var category = item.dataset.category || '';
    var subcategory = item.dataset.subcategory || '';
    var material = item.dataset.material || '';
    var lead = item.dataset.lead || '';
    var price = Number(item.dataset.price);

    if (filters.search && name.indexOf(filters.search) === -1) {
      return false;
    }

    if (filters.category && category !== filters.category) {
      return false;
    }

    if (filters.subcategory && subcategory !== filters.subcategory) {
      return false;
    }

    if (filters.material && material !== filters.material) {
      return false;
    }

    // An item made within a week is also available within a month,
    // so the shorter lead time is the stricter filter.
    if (filters.lead === 'week' && lead !== 'week') {
      return false;
    }

    if (filters.minPrice !== null && price < filters.minPrice) {
      return false;
    }

    if (filters.maxPrice !== null && price > filters.maxPrice) {
      return false;
    }

    return true;
  }

  /**
   * Reads the current filter values from the form.
   *
   * @returns {Object} the filter values, normalised
   */
  function readFilters() {
    var range = priceField.value.split('-');
    var minPrice = null;
    var maxPrice = null;

    if (range.length === 2) {
      minPrice = Number(range[0]);
      maxPrice = Number(range[1]);
    }

    return {
      search: searchField.value.trim().toLowerCase(),
      category: categoryField.value,
      subcategory: activeSubcategory,
      material: materialField.value,
      lead: leadField.value,
      minPrice: minPrice,
      maxPrice: maxPrice
    };
  }

  /**
   * Reorders the items in the page according to the sort field.
   * Sorting the existing elements rather than rebuilding them
   * keeps every event listener and image intact.
   */
  function sortItems() {
    var mode = sortField.value;
    var ordered = items.slice();

    ordered.sort(function (a, b) {
      if (mode === 'name') {
        return (a.dataset.name || '').localeCompare(b.dataset.name || '');
      }
      return Number(a.dataset.price) - Number(b.dataset.price);
    });

    ordered.forEach(function (item) {
      results.appendChild(item);
    });
  }

  /**
   * Reports whether any filter is currently narrowing the results,
   * so that the count can say "all 9 items" rather than counting
   * matches when nothing is being filtered.
   *
   * @param {Object} filters the current filter values
   * @returns {boolean} true if at least one filter is set
   */
  function isFiltered(filters) {
    return Boolean(
      filters.search || filters.category || filters.subcategory
      || filters.material || filters.lead
      || filters.minPrice !== null || filters.maxPrice !== null
    );
  }

  /**
   * Applies the current filters and sort, then updates the
   * result count and the empty notice.
   */
  function applyFilters() {
    var filters = readFilters();
    var shown = 0;

    sortItems();

    items.forEach(function (item) {
      if (matches(item, filters)) {
        item.classList.remove('d-none');
        shown += 1;
      } else {
        item.classList.add('d-none');
      }
    });

    countLabel.textContent = window.guildGuild.describeResults(
      shown, items.length, 'items', isFiltered(filters)
    );
    emptyNotice.classList.toggle('d-none', shown > 0);
  }


  /* ==========================================================
     SUBCATEGORIES

     The subcategory row is only meaningful once a category that
     has subcategories has been chosen, so it stays hidden until
     then. Choosing a different category clears any subcategory
     that is no longer relevant.
     ========================================================== */

  /**
   * Clears the pressed state from every subcategory button.
   */
  function clearSubcategoryButtons() {
    subcategoryButtons.forEach(function (button) {
      button.classList.remove('btn-secondary', 'active');
      button.classList.add('btn-outline-secondary');
      button.setAttribute('aria-pressed', 'false');
    });
  }

  /**
   * Shows or hides the subcategory row to suit the chosen
   * category.
   */
  function updateSubcategoryVisibility() {
    var relevant = CATEGORIES_WITH_SUBCATEGORIES.indexOf(categoryField.value) !== -1;

    subcategoryWrapper.classList.toggle('d-none', !relevant);

    if (!relevant) {
      activeSubcategory = '';
      clearSubcategoryButtons();
    }
  }

  subcategoryButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var value = button.dataset.subcategory;
      var alreadyActive = (activeSubcategory === value);

      clearSubcategoryButtons();

      // Clicking the active button clears the filter, which
      // gives the group a way back to showing everything.
      if (alreadyActive) {
        activeSubcategory = '';
      } else {
        activeSubcategory = value;
        button.classList.remove('btn-outline-secondary');
        button.classList.add('btn-secondary', 'active');
        button.setAttribute('aria-pressed', 'true');
      }

      applyFilters();
    });
  });


  /* ==========================================================
     ADD TO CART
     ========================================================== */

  /**
   * Shows a short confirmation after an item is added.
   *
   * @param {string} text the message to show
   */
  function showCartMessage(text) {
    cartMessage.classList.remove('d-none');
    cartMessage.textContent = text;

    // Replace any pending hide, so rapid additions do not leave
    // the message disappearing part way through.
    if (messageTimer !== null) {
      window.clearTimeout(messageTimer);
    }

    messageTimer = window.setTimeout(function () {
      cartMessage.classList.add('d-none');
      messageTimer = null;
    }, 4000);
  }

  results.addEventListener('click', function (event) {
    var button = event.target.closest('.add-to-cart');
    var quantity;

    if (!button) {
      return;
    }

    quantity = window.guildGuild.cart.add({
      id: button.dataset.itemId,
      name: button.dataset.itemName,
      price: Number(button.dataset.itemPrice),
      listPrice: Number(button.dataset.itemListPrice),
      image: button.dataset.itemImage
    });

    if (quantity === 1) {
      showCartMessage(button.dataset.itemName + ' added to your cart.');
    } else {
      showCartMessage(
        button.dataset.itemName + ' added to your cart. You now have '
        + quantity + ' of these.'
      );
    }
  });


  /* ==========================================================
     WIRING
     ========================================================== */

  // Submitting the form filters in place rather than reloading.
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    applyFilters();
  });

  // Filtering as the visitor types makes the search feel
  // immediate, and the Search button remains for anyone who
  // expects to press it.
  searchField.addEventListener('input', applyFilters);

  categoryField.addEventListener('change', function () {
    updateSubcategoryVisibility();
    applyFilters();
  });

  priceField.addEventListener('change', applyFilters);
  sortField.addEventListener('change', applyFilters);
  materialField.addEventListener('change', applyFilters);
  leadField.addEventListener('change', applyFilters);

  // The reset button clears the fields after this event fires,
  // so the filters are reapplied on the next tick.
  form.addEventListener('reset', function () {
    window.setTimeout(function () {
      activeSubcategory = '';
      clearSubcategoryButtons();
      updateSubcategoryVisibility();
      applyFilters();
    }, 0);
  });

  updateSubcategoryVisibility();
  applyFilters();

}());
