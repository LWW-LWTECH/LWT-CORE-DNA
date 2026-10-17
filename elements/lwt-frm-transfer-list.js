/*!
 * <lwtf-transfer-list>
 * A two-column "available / selected" picker — highlight items on the
 * left, click Add to move them right (or double-click one item), click
 * Remove to send them back. Optionally reorder the right column with
 * Move Up / Move Down. This is the classic dual-listbox pattern used for
 * things like report column pickers or sort-order builders.
 *
 *   <!-- declared in markup -->
 *   <lwtf-transfer-list label="Fields" name="fields" sortable
 *     available-label="Available fields:" selected-label="Sort order:">
 *     <lwtf-transfer-option value="cars">Cars</lwtf-transfer-option>
 *     <lwtf-transfer-option value="children">Children</lwtf-transfer-option>
 *     <lwtf-transfer-option value="bikeBuyer" selected>BikeBuyer</lwtf-transfer-option>
 *   </lwtf-transfer-list>
 *
 *   <!-- or built entirely from JS -->
 *   <lwtf-transfer-list id="fields" label="Fields" sortable></lwtf-transfer-list>
 *   <script>
 *     var el = document.getElementById('fields');
 *     el.options = [
 *       { value: 'cars', label: 'Cars' },
 *       { value: 'children', label: 'Children' },
 *       { value: 'bikeBuyer', label: 'BikeBuyer', selected: true }
 *     ];
 *     el.value;                       // -> ['bikeBuyer']
 *     el.value = ['children', 'cars']; // selected column becomes exactly these, in this order
 *   </script>
 *
 * <lwtf-transfer-option> children (or the `selected` field in .options)
 * are read ONCE, at connect, to build the initial value/label universe —
 * they're a convenient authoring format, not a live-synced light DOM
 * (unlike <lwtf-choices>). After connect, use the JS API below to change
 * anything; a plain <option value="…">Label</option> works too, since
 * only `value`/`selected` attributes and text content are read.
 *
 * ---------------------------------------------------------------------
 * Attributes
 * ---------------------------------------------------------------------
 *   label, helper, error, name  — display / form basics
 *   available-label             — left column heading (default "Available")
 *   selected-label               — right column heading (default "Selected")
 *   sortable                    — boolean; shows Move Up / Move Down
 *                                 buttons for reordering the right column
 *
 *   The -All / +All split button under Add / Remove moves every item
 *   back to the available column / across to the selected column. Each
 *   half disables itself when there is nothing for it to move.
 *   size                        — visible row count of each listbox
 *                                 (native <select size>, default 8)
 *   required                    — boolean; at least one item must end up
 *                                 in the selected column
 *   disabled                    — boolean; disables the whole control
 *
 * ---------------------------------------------------------------------
 * Properties / methods
 * ---------------------------------------------------------------------
 *   .value                  — get/set accessor: array of selected values,
 *                            in right-column order. Setting decides which
 *                            values are selected and in what order
 *                            (anything not included moves back to the
 *                            available column) and emits lwt-change.
 *   .setValue(newValues, opts) — same as `.value = newValues`, but takes
 *                            a second argument — the one thing a plain
 *                            property setter can't do — so you can pass
 *                            {silent: true} to skip the lwt-change emit
 *                            when syncing state programmatically.
 *   .options                — get/set the full item list. The getter
 *                            returns [{value, label, selected}]. The
 *                            setter REPLACES the entire universe of
 *                            items (including anything pre-rendered in
 *                            markup).
 *   .addOption(opt)         — adds one item from {value, label, selected?}.
 *   .updateOption(value, patch) — applies { label?, value?, selected? }
 *                            to the matching item. Returns true if found.
 *   .removeOption(value)   — removes an item entirely (from both
 *                            columns). Returns true if found.
 *   .clear()                — moves everything back to the available column.
 *   .checkValidity() / .reportValidity() — matches native form control
 *                            validity (required = at least one selected).
 *
 * ---------------------------------------------------------------------
 * Events
 * ---------------------------------------------------------------------
 *   lwt-change — fires whenever the selected column changes (Add,
 *                Remove, Move Up/Down, double-click, or a non-silent
 *                .value assignment/.setValue()/.addOption()/.updateOption()/
 *                .removeOption()/.clear() call); detail: { value: [...] }
 *
 * ---------------------------------------------------------------------
 * Form participation
 * ---------------------------------------------------------------------
 * Uses the ElementInternals API (formAssociated + setFormValue +
 * setValidity), so <lwtf-transfer-list name="…"> inside a <form> submits
 * one entry per selected value under that name, in right-column order.
 * When ElementInternals isn't available the element still works, it just
 * doesn't participate in <form> submission.
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-frm-transfer-list.js requires lwt-core.js to be loaded first.');
  }

  var CSS = `
    :host { display: block; font-family: inherit; color: var(--lwt-transfer-color, var(--lwt-color-text, #1f2937)); }
    :host([hidden]) { display: none; }
    .group-label {
      display: block;
      font-size: 0.82rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--lwt-transfer-label-color, var(--lwt-color-text, #374151));
    }
    .required-mark {
      color: var(--lwt-transfer-required-color, var(--lwt-color-danger, #ef4444));
      margin-left: 0.15rem;
    }
    .wrap { display: flex; align-items: stretch; gap: var(--lwt-transfer-gap, var(--lwt-gap, 0.75rem)); }
    :host([disabled]) .wrap { opacity: 0.6; }
    .col {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .col-label {
      font-size: 0.78rem;
      font-weight: 600;
      margin-bottom: 0.35rem;
      color: var(--lwt-transfer-col-label-color, var(--lwt-color-text-muted, #6b7280));
    }
    select {
      flex: 1;
      min-height: 0;
      width: 100%;
      box-sizing: border-box;
      font: inherit;
      font-size: 0.88rem;
      border-radius: var(--lwt-transfer-radius, var(--lwt-border-radius, 6px));
      padding: var(--lwt-transfer-padding, var(--lwt-padding, 0.3rem));
      background: var(--lwt-transfer-bg, var(--lwt-color-surface, #fff));
      border: var(--lwt-transfer-border, var(--lwt-border, 1px solid #d1d5db));
      color: inherit;
    }
    select:focus-visible {
      outline: 2px solid var(--lwt-transfer-focus-color, var(--lwt-focus-color, #2563eb));
      outline-offset: 1px;
    }
    select:disabled { cursor: not-allowed; background: var(--lwt-color-surface-muted, #f3f4f6); }
    select option { padding: 0.2rem 0.35rem; }
    .btn-col {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.4rem;
      padding: 0 0.1rem;
    }
    .btn-col button {
      font: inherit;
      font-size: 0.82rem;
      padding: 0.4rem 0.6rem;
      border-radius: var(--lwt-transfer-radius, var(--lwt-border-radius, 6px));
      cursor: pointer;
      white-space: nowrap;
      background: var(--lwt-transfer-btn-bg, var(--lwt-color-surface, #fff));
      border: var(--lwt-transfer-border, var(--lwt-border, 1px solid #d1d5db));
      color: inherit;
    }
    .btn-col button:hover:not(:disabled) { background: var(--lwt-color-surface-alt, #f3f4f6); }
    .btn-col button:focus-visible {
      outline: 2px solid var(--lwt-transfer-focus-color, var(--lwt-focus-color, #2563eb));
      outline-offset: 1px;
    }
    .btn-col button:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-col .all-group { display: flex; gap: var(--lwt-transfer-split-gap, 0.2rem); }
    .btn-col .all-group button { flex: 1 1 0; min-width: 0; }
    .btn-col .remove-all-btn {
      border-radius: var(--lwt-transfer-radius, var(--lwt-border-radius, 6px)) 0 0 var(--lwt-transfer-radius, var(--lwt-border-radius, 6px));
    }
    .btn-col .add-all-btn {
      border-radius: 0 var(--lwt-transfer-radius, var(--lwt-border-radius, 6px)) var(--lwt-transfer-radius, var(--lwt-border-radius, 6px)) 0;
    }
    .btn-col .sort-btn { display: none; }
    :host([sortable]) .btn-col .sort-btn { display: inline-block; }
    .below { margin-top: 0.45rem; font-size: 0.78rem; min-height: 1rem; }
    .helper { color: var(--lwt-transfer-helper-color, var(--lwt-color-text-muted, #6b7280)); }
    .helper.error { color: var(--lwt-transfer-error-color, var(--lwt-color-danger, #ef4444)); }
  `;

  var TEMPLATE =
    '<div class="group-label" part="label"><span class="label-text"></span><span class="required-mark" hidden aria-hidden="true">*</span></div>' +
    '<div class="wrap" part="wrap">' +
    '  <div class="col" part="available-col">' +
    '    <span class="col-label" part="available-label"></span>' +
    '    <select class="avail-select" part="available-select" multiple></select>' +
    '  </div>' +
    '  <div class="btn-col" part="button-col">' +
    '    <button type="button" class="add-btn" part="add-btn">Add &gt;&gt;</button>' +
    '    <button type="button" class="remove-btn" part="remove-btn">&lt;&lt; Remove</button>' +
    '    <div class="all-group" part="all-group" role="group">' +
    '      <button type="button" class="remove-all-btn" part="remove-all-btn">-All</button>' +
    '      <button type="button" class="add-all-btn" part="add-all-btn">+All</button>' +
    '    </div>' +
    '    <button type="button" class="up-btn sort-btn" part="up-btn">Move Up</button>' +
    '    <button type="button" class="down-btn sort-btn" part="down-btn">Move Down</button>' +
    '  </div>' +
    '  <div class="col" part="selected-col">' +
    '    <span class="col-label" part="selected-label"></span>' +
    '    <select class="sel-select" part="selected-select" multiple></select>' +
    '  </div>' +
    '</div>' +
    '<div class="below" part="below"><div class="helper" part="helper"></div></div>';

  var supportsInternals = typeof HTMLElement.prototype.attachInternals === 'function';

  function selectedValues(select) {
    return Array.prototype.map.call(select.selectedOptions || [], function (o) { return o.value; });
  }

  class LWTTransferList extends window.LWT.Element {
    static get formAssociated() { return true; }

    static get observedAttributes() {
      return ['label', 'helper', 'error', 'available-label', 'selected-label',
              'sortable', 'size', 'name', 'required', 'disabled', 'aria-label', 'aria-labelledby'];
    }

    constructor() {
      super();

      if (supportsInternals) {
        try { this._internals = this.attachInternals(); }
        catch (e) { this._internals = null; }
      }

      this._items = [];   // [{ value, label }] — full universe, declaration order
      this._order = [];   // [value, ...] — selected column, in display order
      this._initialized = false;
      this._lightDomSynced = false;
      this._mo = null;

      this._onAddClick = this._onAddClick.bind(this);
      this._onRemoveClick = this._onRemoveClick.bind(this);
      this._onUpClick = this._onUpClick.bind(this);
      this._onDownClick = this._onDownClick.bind(this);
      this._onAvailDblClick = this._onAvailDblClick.bind(this);
      this._onSelDblClick = this._onSelDblClick.bind(this);
      this._onSelectChange = this._onSelectChange.bind(this);
      this._onLightDomMutated = this._onLightDomMutated.bind(this);
      this._onDocumentParsed = this._onDocumentParsed.bind(this);
      this._waitingForParse = false;
      this._jsDriven = false;
    }

    connectedCallback() {
      super.connectedCallback();
      // Read-only classification attribute — see lwt-frm-choices.js for
      // the convention every lwtf- element follows. "select-multiple"
      // since that's the closest native analog (an ordered set of
      // selected values under one name).
      this.setAttribute('control-type', 'select-multiple');

      if (!this._initialized) {
        this._initialized = true;
        this._trySyncFromLightDom();

        // The parser can hand us our option children in several batches
        // (it pauses mid-page on large or streamed documents), so while the
        // document is still loading keep re-reading on every batch and only
        // stop once parsing is done. Outside of page load, wait for the
        // first children to show up and read once.
        this._waitingForParse = document.readyState === 'loading';
        if ((this._waitingForParse || !this._lightDomSynced) && typeof MutationObserver === 'function') {
          this._mo = new MutationObserver(this._onLightDomMutated);
          this._mo.observe(this, { childList: true, subtree: true });
        }
        if (this._waitingForParse) {
          document.addEventListener('DOMContentLoaded', this._onDocumentParsed, { once: true });
        }
      }
    }

    _onLightDomMutated() {
      if (this._jsDriven) return;
      this._trySyncFromLightDom();
      if (!this._waitingForParse && this._lightDomSynced && this._mo) {
        this._mo.disconnect();
        this._mo = null;
      }
    }

    _onDocumentParsed() {
      this._waitingForParse = false;
      if (!this._jsDriven) this._trySyncFromLightDom();
      if (this._lightDomSynced && this._mo) {
        this._mo.disconnect();
        this._mo = null;
      }
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._mo) { this._mo.disconnect(); this._mo = null; }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (this._labelText) this._syncAttrs();
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      var root = this._root;
      this._labelEl = root.querySelector('.group-label');
      this._labelText = root.querySelector('.label-text');
      this._requiredMark = root.querySelector('.required-mark');
      this._helperEl = root.querySelector('.helper');
      this._availLabelEl = root.querySelector('[part="available-label"]');
      this._selLabelEl = root.querySelector('[part="selected-label"]');
      this._availSelect = root.querySelector('.avail-select');
      this._selSelect = root.querySelector('.sel-select');
      this._addBtn = root.querySelector('.add-btn');
      this._removeBtn = root.querySelector('.remove-btn');
      this._addAllBtn = root.querySelector('.add-all-btn');
      this._removeAllBtn = root.querySelector('.remove-all-btn');
      this._allGroup = root.querySelector('.all-group');
      this._upBtn = root.querySelector('.up-btn');
      this._downBtn = root.querySelector('.down-btn');

      // ids so the selects can be labelled by "<label> <column>" and
      // described by the helper text (all inside this shadow root).
      var a11y = window.LWT.a11y;
      this._labelText.id = a11y.uid('lwt-transfer-label');
      this._availLabelEl.id = a11y.uid('lwt-transfer-avail');
      this._selLabelEl.id = a11y.uid('lwt-transfer-sel');
      this._helperEl.id = a11y.uid('lwt-transfer-helper');

      this._addBtn.addEventListener('click', this._onAddClick);
      this._removeBtn.addEventListener('click', this._onRemoveClick);
      this._addAllBtn.addEventListener('click', this._onAddAllClick.bind(this));
      this._removeAllBtn.addEventListener('click', this._onRemoveAllClick.bind(this));
      this._upBtn.addEventListener('click', this._onUpClick);
      this._downBtn.addEventListener('click', this._onDownClick);
      this._availSelect.addEventListener('dblclick', this._onAvailDblClick);
      this._selSelect.addEventListener('dblclick', this._onSelDblClick);
      this._availSelect.addEventListener('change', this._onSelectChange);
      this._selSelect.addEventListener('change', this._onSelectChange);

      this._syncAttrs();
    }

    _syncAttrs() {
      var label = this._strAttr('label', '');
      var helper = this._strAttr('helper', '');
      var error = this._strAttr('error', '');
      var required = this._boolAttr('required');
      var disabled = this._boolAttr('disabled');
      var size = parseInt(this._strAttr('size', '8'), 10);
      if (isNaN(size) || size <= 0) size = 8;

      this._labelText.textContent = label;
      this._labelEl.style.display = label ? '' : 'none';
      this._requiredMark.hidden = !required;

      var availName = this._strAttr('available-label', 'Available');
      var selName = this._strAttr('selected-label', 'Selected');
      this._availLabelEl.textContent = availName;
      this._selLabelEl.textContent = selName;

      // Group name for the whole control, then name each list as
      // "<group> <column>" and say what each button does.
      var groupName = this._a11yName([label, window.LWT.a11y.humanize(this._strAttr('name', ''))],
        'Transfer list', 'Add a label attribute');
      this._ensureAttr('role', 'group');
      this._ensureAttr('aria-label', groupName);
      this._availSelect.setAttribute('aria-label', groupName + ': ' + availName);
      this._selSelect.setAttribute('aria-label', groupName + ': ' + selName);
      this._addBtn.setAttribute('aria-label', 'Add chosen items to ' + selName);
      this._removeBtn.setAttribute('aria-label', 'Remove chosen items from ' + selName);
      this._allGroup.setAttribute('aria-label', 'Move all items');
      this._addAllBtn.setAttribute('aria-label', 'Add all items to ' + selName);
      this._removeAllBtn.setAttribute('aria-label', 'Remove all items from ' + selName);
      this._upBtn.setAttribute('aria-label', 'Move chosen items up');
      this._downBtn.setAttribute('aria-label', 'Move chosen items down');
      if (helper || error) {
        this._availSelect.setAttribute('aria-describedby', this._helperEl.id);
        this._selSelect.setAttribute('aria-describedby', this._helperEl.id);
      } else {
        this._availSelect.removeAttribute('aria-describedby');
        this._selSelect.removeAttribute('aria-describedby');
      }
      if (error) this._selSelect.setAttribute('aria-invalid', 'true'); else this._selSelect.removeAttribute('aria-invalid');

      this._availSelect.size = size;
      this._selSelect.size = size;
      this._availSelect.disabled = disabled;
      this._selSelect.disabled = disabled;
      this._addBtn.disabled = disabled;
      this._removeBtn.disabled = disabled;
      this._upBtn.disabled = disabled;
      this._downBtn.disabled = disabled;
      this._syncAllButtons();

      var errorMsg = error;
      if (errorMsg) {
        this._helperEl.classList.add('error');
        this._helperEl.textContent = errorMsg;
      } else {
        this._helperEl.classList.remove('error');
        this._helperEl.textContent = helper;
      }
      this.toggleAttribute('data-invalid', !!errorMsg);

      this._reportValidity();
    }

    // ---- initial data (light DOM, read once) ----

    // Safe to call more than once (the MutationObserver may report the
    // parser's children arriving in more than one batch) -- rebuilds
    // _items/_order from scratch each time rather than appending, so
    // nothing gets duplicated. Once it finds at least one child it marks
    // itself synced and the caller stops watching for more.
    _trySyncFromLightDom() {
      var children = this.querySelectorAll(':scope > lwtf-transfer-option, :scope > option');
      if (!children.length) return;

      var items = [];
      var order = [];
      children.forEach(function (child) {
        var value = child.getAttribute('value');
        if (value == null) value = child.textContent.trim();
        items.push({ value: String(value), label: child.textContent.trim() });
        if (child.hasAttribute('selected')) order.push(String(value));
      });

      this._items = items;
      this._order = order;
      this._lightDomSynced = true;
      this._renderLists();
      this._reportValue();
      this._reportValidity();
    }

    // ---- rendering ----

    _renderLists() {
      var self = this;
      var availItems = this._items.filter(function (i) { return self._order.indexOf(i.value) === -1; });
      var selItems = this._order
        .map(function (v) { return self._items.filter(function (i) { return i.value === v; })[0]; })
        .filter(Boolean);

      this._availSelect.innerHTML = '';
      availItems.forEach(function (item) {
        self._availSelect.appendChild(self._genhtml({ type: 'option', attr: { value: item.value }, text: item.label }));
      });

      this._selSelect.innerHTML = '';
      selItems.forEach(function (item) {
        self._selSelect.appendChild(self._genhtml({ type: 'option', attr: { value: item.value }, text: item.label }));
      });

      this._syncAllButtons();
    }

    // -All is only useful while something is selected, +All while
    // something is still available.
    _syncAllButtons() {
      if (!this._addAllBtn) return;
      var disabled = this._boolAttr('disabled');
      var self = this;
      var availCount = this._items.filter(function (i) { return self._order.indexOf(i.value) === -1; }).length;
      this._addAllBtn.disabled = disabled || availCount === 0;
      this._removeAllBtn.disabled = disabled || this._order.length === 0;
    }

    // ---- button handlers ----

    _onAddClick() {
      if (this._boolAttr('disabled')) return;
      var vals = selectedValues(this._availSelect);
      if (!vals.length) return;
      this._moveToSelected(vals);
    }

    _onRemoveClick() {
      if (this._boolAttr('disabled')) return;
      var vals = selectedValues(this._selSelect);
      if (!vals.length) return;
      this._order = this._order.filter(function (v) { return vals.indexOf(v) === -1; });
      this._renderLists();
      this._reportValue();
      this._reportValidity();
      this._announceMove(vals.length, false);
      this.emit('change', { value: this._order.slice() });
    }

    _onAddAllClick() {
      if (this._boolAttr('disabled')) return;
      this._moveToSelected(this._items.map(function (i) { return i.value; }));
    }

    _onRemoveAllClick() {
      if (this._boolAttr('disabled') || !this._order.length) return;
      var count = this._order.length;
      this._order = [];
      this._renderLists();
      this._reportValue();
      this._reportValidity();
      this._announceMove(count, false);
      this.emit('change', { value: [] });
    }

    _announceMove(count, added) {
      var col = this._strAttr('selected-label', 'Selected');
      window.LWT.a11y.announce(count + (count === 1 ? ' item ' : ' items ') + (added ? 'added to ' : 'removed from ') + col +
        '. ' + this._order.length + ' in ' + col + '.');
    }

    _onUpClick() {
      if (this._boolAttr('disabled') || !this._boolAttr('sortable')) return;
      this._shiftSelected(-1);
    }

    _onDownClick() {
      if (this._boolAttr('disabled') || !this._boolAttr('sortable')) return;
      this._shiftSelected(1);
    }

    _onAvailDblClick(e) {
      if (this._boolAttr('disabled')) return;
      var opt = e.target && e.target.closest ? e.target.closest('option') : null;
      if (!opt) return;
      this._moveToSelected([opt.value]);
    }

    _onSelDblClick(e) {
      if (this._boolAttr('disabled')) return;
      var opt = e.target && e.target.closest ? e.target.closest('option') : null;
      if (!opt) return;
      this._order = this._order.filter(function (v) { return v !== opt.value; });
      this._renderLists();
      this._reportValue();
      this._reportValidity();
      this._announceMove(1, false);
      this.emit('change', { value: this._order.slice() });
    }

    // Native <select> fires 'change' on every click even without moving
    // focus off the element; used only to keep the "opposite" select's
    // selection cleared so Add/Remove always act on the list you just
    // clicked in, not a stale highlight left over in the other one.
    _onSelectChange(e) {
      var other = e.target === this._availSelect ? this._selSelect : this._availSelect;
      Array.prototype.forEach.call(other.options, function (o) { o.selected = false; });
    }

    _moveToSelected(vals) {
      var self = this;
      // Preserve the available-column's top-to-bottom order for anything
      // newly added, appended after whatever's already selected.
      var toAdd = this._items
        .map(function (i) { return i.value; })
        .filter(function (v) { return vals.indexOf(v) !== -1 && self._order.indexOf(v) === -1; });
      this._order = this._order.concat(toAdd);
      this._renderLists();
      this._reportValue();
      this._reportValidity();
      this._announceMove(toAdd.length, true);
      this.emit('change', { value: this._order.slice() });
    }

    _shiftSelected(dir) {
      var vals = selectedValues(this._selSelect);
      if (!vals.length) return;

      var order = this._order.slice();
      var indices = vals.map(function (v) { return order.indexOf(v); }).filter(function (i) { return i !== -1; }).sort(function (a, b) { return a - b; });

      if (dir < 0) {
        for (var i = 0; i < indices.length; i++) {
          var idx = indices[i];
          if (idx === 0) continue;
          if (indices.indexOf(idx - 1) !== -1) continue; // contiguous block already at top
          var tmp = order[idx - 1]; order[idx - 1] = order[idx]; order[idx] = tmp;
        }
      } else {
        for (var j = indices.length - 1; j >= 0; j--) {
          var idx2 = indices[j];
          if (idx2 === order.length - 1) continue;
          if (indices.indexOf(idx2 + 1) !== -1) continue; // contiguous block already at bottom
          var tmp2 = order[idx2 + 1]; order[idx2 + 1] = order[idx2]; order[idx2] = tmp2;
        }
      }

      this._order = order;
      this._renderLists();

      // Re-apply selection so the moved item(s) stay highlighted.
      var self = this;
      Array.prototype.forEach.call(this._selSelect.options, function (o) {
        o.selected = vals.indexOf(o.value) !== -1;
      });

      this._reportValue();
      this._reportValidity();
      this.emit('change', { value: this._order.slice() });
    }

    // ---- public API ----

    // Get/set accessor — the selected values, in order. Setting replaces
    // the whole selected column (unmatched values are dropped).
    get value() { return this._order.slice(); }
    set value(newValues) { this.setValue(newValues); }

    // Same as `.value = newValues`, but takes a second options argument
    // — a plain setter can't do that — so {silent: true} skips the
    // lwt-change emit when syncing state programmatically.
    setValue(newValues, opts) {
      opts = opts || {};
      var known = this._items.map(function (i) { return i.value; });
      var arr = (Array.isArray(newValues) ? newValues : (newValues == null ? [] : [newValues])).map(String);
      this._order = arr.filter(function (v) { return known.indexOf(v) !== -1; });

      this._renderLists();
      this._reportValue();
      this._reportValidity();
      if (!opts.silent) this.emit('change', { value: this._order.slice() });
      return this;
    }

    get options() {
      var self = this;
      return this._items.map(function (i) {
        return { value: i.value, label: i.label, selected: self._order.indexOf(i.value) !== -1 };
      });
    }

    set options(arr) {
      // JS is now driving state -- stop waiting on light-DOM children
      // that may still be about to arrive from a still-in-progress parse.
      this._lightDomSynced = true;
      this._jsDriven = true; // JS owns the options now -- ignore late light-DOM batches
      this._waitingForParse = false;
      if (this._mo) { this._mo.disconnect(); this._mo = null; }

      this._items = [];
      this._order = [];
      var self = this;
      (Array.isArray(arr) ? arr : []).forEach(function (opt) {
        opt = opt || {};
        var value = opt.value != null ? String(opt.value) : '';
        self._items.push({ value: value, label: opt.label !== undefined ? String(opt.label) : value });
        if (opt.selected) self._order.push(value);
      });
      this._renderLists();
      this._reportValue();
      this._reportValidity();
    }

    addOption(opt) {
      opt = opt || {};
      var value = opt.value != null ? String(opt.value) : '';
      var existing = this._items.filter(function (i) { return i.value === value; })[0];
      if (existing) existing.label = opt.label !== undefined ? String(opt.label) : existing.label;
      else this._items.push({ value: value, label: opt.label !== undefined ? String(opt.label) : value });

      if (opt.selected && this._order.indexOf(value) === -1) this._order.push(value);

      this._renderLists();
      this._reportValue();
      this._reportValidity();
      return true;
    }

    updateOption(value, patch) {
      patch = patch || {};
      value = String(value);
      var item = this._items.filter(function (i) { return i.value === value; })[0];
      if (!item) return false;

      if (patch.value !== undefined) {
        var newValue = String(patch.value);
        item.value = newValue;
        var idx = this._order.indexOf(value);
        if (idx !== -1) this._order[idx] = newValue;
        value = newValue;
      }
      if (patch.label !== undefined) item.label = String(patch.label);

      if (patch.selected !== undefined) {
        var pos = this._order.indexOf(value);
        if (patch.selected && pos === -1) this._order.push(value);
        else if (!patch.selected && pos !== -1) this._order.splice(pos, 1);
      }

      this._renderLists();
      this._reportValue();
      this._reportValidity();
      return true;
    }

    removeOption(value) {
      value = String(value);
      var idx = this._items.findIndex ? this._items.findIndex(function (i) { return i.value === value; })
        : (function (items) { for (var k = 0; k < items.length; k++) if (items[k].value === value) return k; return -1; })(this._items);
      if (idx === -1) return false;

      this._items.splice(idx, 1);
      this._order = this._order.filter(function (v) { return v !== value; });
      this._renderLists();
      this._reportValue();
      this._reportValidity();
      return true;
    }

    clear() {
      this._order = [];
      this._renderLists();
      this._reportValue();
      this._reportValidity();
      this.emit('change', { value: [] });
    }

    checkValidity() {
      return this._internals ? this._internals.checkValidity() : true;
    }
    reportValidity() {
      return this._internals ? this._internals.reportValidity() : true;
    }

    // ---- form-association + validity ----

    _reportValue() {
      if (!this._internals) return;
      var name = this._strAttr('name', '') || 'value';
      if (!this._order.length) {
        this._internals.setFormValue(null);
      } else {
        var fd = new FormData();
        this._order.forEach(function (v) { fd.append(name, v); });
        this._internals.setFormValue(fd);
      }
    }

    _reportValidity() {
      if (!this._internals) return;
      var required = this._boolAttr('required');
      if (required && this._order.length === 0) {
        this._internals.setValidity({ valueMissing: true }, 'Select at least one item.', this._availSelect || this);
      } else {
        this._internals.setValidity({});
      }
    }
  }

  window.LWT.define('lwtf-transfer-list', LWTTransferList);
})();
