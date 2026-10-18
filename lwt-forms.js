/*!
 * LWT Form Elements
 * Developer: Lee W Winter
 * Last Generated: 2026-10-17T19:01:44.825Z
 * Requires lwt-core.js to be loaded first.
 */

/* ---- lwt-frm-choice-option.js ---- */
/*!
 * <lwtf-choice-option>
 * A single selectable row — checked/unchecked, custom-drawn (no native
 * <input type="radio"/checkbox"> underneath), meant to live inside
 * <lwtf-choices>. See lwt-frm-choices.js for the container that owns all
 * the selection logic (single vs. multiple, form value, validity).
 *
 *   <lwtf-choice-option value="red">Red</lwtf-choice-option>
 *
 * Content is the default slot — any HTML, not just text.
 *
 * Like <lwtg-tab>, the HOST element itself is the focusable, clickable
 * control (role="radio"/"checkbox", aria-checked, tabindex) rather than
 * wrapping a shadow-DOM <input>+<label> pair — that's the whole point:
 * nobody using this element has to think about label-for/id wiring.
 *
 * Attributes:
 *   value     — required; the value reported when this option is checked
 *   checked   — reflects selection state; set by the parent <lwtf-choices>
 *               in response to clicks/keyboard, or directly in markup to
 *               pre-select an option. Toggling it here does NOT by
 *               itself notify the parent — click/Space/Enter do, via the
 *               lwt-toggle event below. Setting the attribute by hand
 *               (or the .checked property) just changes this option's
 *               own visual state; call the parent's .value()/.addOption()/
 *               .updateOption() to keep everything else in sync.
 *   disabled  — boolean; blocks interaction. The parent also force-sets
 *               this on every option while the group itself is disabled.
 *   role      — "radio" | "checkbox"; set automatically by the parent to
 *               match its `type` attribute. Not meant to be set by hand.
 *   image     — optional; a URL. When present, this option renders as a
 *               square image tile instead of a checkbox-row — the image
 *               centered, the label below it, and a colored corner
 *               ribbon + checkmark that appears when checked, with the
 *               whole tile getting a thick colored border. See
 *               lwt-frm-choices.js's `layout="grid"` for arranging a set
 *               of these in a grid instead of a plain list.
 *   accent    — optional; any CSS color, applied only when `image` is
 *               set. Overrides the ribbon/border color for THIS tile —
 *               e.g. give each social network its own brand color. Falls
 *               back to --lwt-choices-tile-accent (settable on this
 *               element, on <lwtf-choices>, or anywhere further up the
 *               tree — it's a normal inherited custom property) and then
 *               to the theme's primary color.
 *
 * Event: lwt-toggle (bubbles, composed; detail: { value }) — fired on
 * click or Space/Enter when not disabled. <lwtf-choices> listens for this
 * and decides what actually happens (exclusive select vs. independent
 * toggle); this element never changes its own `checked` state on its own.
 *
 * Keyboard: Space/Enter fires lwt-toggle. Arrow Left/Right/Up/Down move
 * focus to the next/previous non-disabled sibling option; in a
 * single-select group (parent type != "multiple") that also fires
 * lwt-toggle on the newly-focused option, matching native radio-group
 * behavior. In a multiple-select group arrow keys only move focus —
 * Space still does the toggling.
 *
 * Theming: --lwt-choices-border, --lwt-choices-bg, --lwt-choices-checked-bg,
 * --lwt-choices-checked-border, --lwt-choices-check-color,
 * --lwt-choices-focus-color. Tile mode (`image` set) additionally uses
 * --lwt-choices-tile-size (default 140px), --lwt-choices-tile-bg,
 * --lwt-choices-tile-border, --lwt-choices-tile-accent (see `accent`
 * above). See lwt-frm-choices.js for the group-level (label/helper/error)
 * tokens.
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-frm-choice-option.js requires lwt-core.js to be loaded first.');
  }

  var CHECK_SVG =
    '<svg class="check" part="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="4 12 9 18 20 6"/></svg>';

  var CSS = `
    :host {
      display: flex;
      align-items: center;
      gap: var(--lwt-choices-option-gap, var(--lwt-gap, 0.6rem));
      cursor: pointer;
      font: inherit;
      font-size: 0.95rem;
      min-height: 24px;
      color: var(--lwt-choices-color, var(--lwt-color-text, #1f2937));
      user-select: none;
      outline: none;
    }
    :host([hidden]) { display: none; }
    :host([disabled]) { cursor: not-allowed; opacity: 0.55; }
    .box {
      flex-shrink: 0;
      width: 1.35rem;
      height: 1.35rem;
      box-sizing: border-box;
      border-radius: var(--lwt-choices-box-radius, 4px);
      border: 2px solid var(--lwt-choices-border, var(--lwt-color-border-strong, #d1d5db));
      background: var(--lwt-choices-bg, var(--lwt-color-surface, #fff));
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 120ms ease, border-color 120ms ease;
    }
    :host([role="radio"]) .box { border-radius: 50%; }
    .check {
      width: 1rem;
      height: 1rem;
      color: var(--lwt-choices-check-color, #fff);
      opacity: 0;
      transform: scale(0.5);
      transition: opacity 120ms ease, transform 120ms ease;
    }
    :host([checked]) .box {
      background: var(--lwt-choices-checked-bg, var(--lwt-color-success, #15803d));
      border-color: var(--lwt-choices-checked-border, var(--lwt-color-success, #15803d));
    }
    :host([checked]) .check { opacity: 1; transform: scale(1); }
    :host([disabled]) .box {
      background: var(--lwt-color-surface-muted, #f3f4f6);
      border-color: var(--lwt-border-color, #e5e7eb);
    }
    :host([disabled][checked]) .box {
      background: var(--lwt-choices-disabled-checked-bg, #d1d5db);
      border-color: var(--lwt-choices-disabled-checked-bg, #d1d5db);
    }
    :host(:focus-visible) .box {
      outline: 2px solid var(--lwt-choices-focus-color, var(--lwt-focus-color, #2563eb));
      outline-offset: 2px;
    }
    .label { min-width: 0; }
    /* ---- tile mode (image set) ----
       A distinct enough layout that it's easiest to override every
       shared part rather than fight the row-mode flex/box rules above.
       Each selector here is two attribute-matches deep ([image] plus
       whatever else), which makes it more specific than the row-mode
       rules regardless of declaration order. */
    .tile-media { display: none; }
    :host([image]) {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: var(--lwt-choices-tile-gap, var(--lwt-gap, 0.6rem));
      width: var(--lwt-choices-tile-size, 140px);
      box-sizing: border-box;
      padding: var(--lwt-choices-tile-padding, var(--lwt-padding, 1.1rem 0.75rem));
      position: relative;
      overflow: hidden;
      border-radius: var(--lwt-choices-tile-radius, var(--lwt-border-radius, 10px));
      background: var(--lwt-choices-tile-bg, var(--lwt-color-surface, #fff));
      border: 3px solid var(--lwt-choices-tile-border, var(--lwt-color-border-strong, #d1d5db));
      transition: border-color 120ms ease;
    }
    :host([image]) .tile-media {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      flex: 1;
      min-height: 2.5rem;
    }
    :host([image]) .tile-img {
      max-width: 100%;
      max-height: 3.25rem;
      object-fit: contain;
      display: block;
    }
    :host([image]) .label { text-align: center; font-size: 0.9rem; }
    :host([image]) .box {
      position: absolute;
      top: 0;
      left: 0;
      width: 2.2rem;
      height: 2.2rem;
      border: none;
      border-radius: 0;
      background: transparent;
      clip-path: polygon(0 0, 100% 0, 0 100%);
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      padding: 0.25rem 0 0 0.2rem;
      opacity: 0;
      transition: opacity 120ms ease;
    }
    :host([image]) .check { width: 0.85rem; height: 0.85rem; }
    :host([image][checked]) .box {
      opacity: 1;
      background: var(--lwt-choices-tile-accent, var(--lwt-color-primary, #2563eb));
    }
    :host([image][checked]) { border-color: var(--lwt-choices-tile-accent, var(--lwt-color-primary, #2563eb)); }
    :host([image][disabled]) {
      background: var(--lwt-color-surface-muted, #f3f4f6);
      border-color: var(--lwt-border-color, #e5e7eb);
    }
    :host([image]:focus-visible) {
      outline: 2px solid var(--lwt-choices-focus-color, var(--lwt-focus-color, #2563eb));
      outline-offset: 2px;
    }
  `;

  var TEMPLATE =
    '<span class="tile-media" part="tile-media"><img class="tile-img" part="tile-image" alt=""></span>' +
    '<span class="box" part="box">' + CHECK_SVG + '</span>' +
    '<span class="label" part="label"><slot></slot></span>';

  class LWTChoiceOption extends window.LWT.Element {
    static get observedAttributes() {
      return ['value', 'checked', 'disabled', 'role', 'image', 'accent'];
    }

    constructor() {
      super();
      this._handleClick = this._handleClick.bind(this);
      this._handleKeydown = this._handleKeydown.bind(this);
    }

    connectedCallback() {
      super.connectedCallback();
      // Read-only classification attribute — see lwt-frm-choices.js for
      // the convention every lwtf- element follows. This one's a group
      // member, not a standalone control, hence "option" rather than a
      // native input type.
      this.setAttribute('control-type', 'option');
      this.addEventListener('click', this._handleClick);
      this.addEventListener('keydown', this._handleKeydown);
      this._whenParsed(this._syncName);
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.removeEventListener('click', this._handleClick);
      this.removeEventListener('keydown', this._handleKeydown);
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      // _root (the shadow root) exists from the constructor onward, but
      // may still be empty if an attribute is set before first render();
      // _syncAria()/_syncMedia() only touch host attributes and the
      // (already-created) shadow children, so both are always safe.
      this._syncAria();
      this._syncMedia();
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      this._img = this._root.querySelector('.tile-img');
      this._syncAria();
      this._syncMedia();
    }

    _syncAria() {
      var disabled = this._boolAttr('disabled');
      var checked = this._boolAttr('checked');
      var role = this._strAttr('role', 'radio');

      this.setAttribute('aria-checked', checked ? 'true' : 'false');
      this.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      // In a radio group <lwtf-choices> runs a roving tabindex (only the
      // checked radio is a Tab stop); otherwise every option is.
      if (disabled) this.tabIndex = -1;
      else if (!this.hasAttribute('data-lwt-roving')) this.tabIndex = 0;
      if (!this.hasAttribute('role')) this.setAttribute('role', role);
    }

    // Image tiles with no text still need a name: use the value (e.g.
    // "facebook" -> "Facebook") and warn.
    _syncName() {
      if (this.textContent.trim() || this._hostLabel()) { this._removeAutoAttr('aria-label'); return; }
      this._ensureAttr('aria-label', this._a11yName([window.LWT.a11y.humanize(this.value)], 'Option',
        'Add text content to the option'));
    }

    _syncMedia() {
      if (!this._img) return;

      var image = this._strAttr('image', '');
      if (image) {
        this._img.src = image;
        // Decorative: the option's own name (its text) already says it.
        this._img.alt = '';
      } else {
        this._img.removeAttribute('src');
        this._img.alt = '';
      }

      var accent = this._strAttr('accent', '');
      if (accent) this.style.setProperty('--lwt-choices-tile-accent', accent);
      else this.style.removeProperty('--lwt-choices-tile-accent');
    }

    get value() { return this._strAttr('value', ''); }
    set value(v) { this.setAttribute('value', v == null ? '' : String(v)); }

    get checked() { return this._boolAttr('checked'); }
    set checked(v) { this.toggleAttribute('checked', !!v); }

    get disabled() { return this._boolAttr('disabled'); }
    set disabled(v) { this.toggleAttribute('disabled', !!v); }

    get image() { return this._strAttr('image', ''); }
    set image(v) { if (v) this.setAttribute('image', v); else this.removeAttribute('image'); }

    get accent() { return this._strAttr('accent', ''); }
    set accent(v) { if (v) this.setAttribute('accent', v); else this.removeAttribute('accent'); }

    _handleClick() {
      if (this._boolAttr('disabled')) return;
      this.emit('toggle', { value: this.value });
    }

    _handleKeydown(e) {
      if (this._boolAttr('disabled')) return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this._handleClick();
        return;
      }

      var horizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      var vertical = e.key === 'ArrowUp' || e.key === 'ArrowDown';
      if (!horizontal && !vertical) return;
      if (!this.parentElement) return;

      var siblings = Array.prototype.filter.call(
        this.parentElement.querySelectorAll(':scope > lwtf-choice-option'),
        function (o) { return !o.hasAttribute('disabled'); }
      );
      var idx = siblings.indexOf(this);
      if (idx === -1) return;

      e.preventDefault();
      var dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
      var next = siblings[(idx + dir + siblings.length) % siblings.length];
      if (!next) return;

      next.focus();
      // In a single-select group, moving focus with arrow keys also
      // selects — matching native <input type="radio"> group behavior.
      // In a multiple-select group, arrow keys only move focus.
      if (this.getAttribute('role') !== 'checkbox') {
        next.emit('toggle', { value: next.value });
      }
    }
  }

  window.LWT.define('lwtf-choice-option', LWTChoiceOption);
})();

/* ---- lwt-frm-choices.js ---- */
/*!
 * <lwtf-choices>
 * A group of custom-drawn radio buttons or checkboxes — no native
 * <input type="radio"/"checkbox"> and no manual label/for/id wiring.
 * Defaults to single-select (radio) behavior; set type="multiple" to get
 * independent checkboxes instead. Options are <lwtf-choice-option>
 * children (pre-rendered in markup, or built for you via JS).
 *
 *   <!-- radio group (default) -->
 *   <lwtf-choices label="Shipping speed" name="speed" required>
 *     <lwtf-choice-option value="standard" checked>Standard (5-7 days)</lwtf-choice-option>
 *     <lwtf-choice-option value="express">Express (2 days)</lwtf-choice-option>
 *     <lwtf-choice-option value="overnight" disabled>Overnight (unavailable)</lwtf-choice-option>
 *   </lwtf-choices>
 *
 *   <!-- checkbox group -->
 *   <lwtf-choices type="multiple" label="Toppings" name="toppings">
 *     <lwtf-choice-option value="cheese" checked>Cheese</lwtf-choice-option>
 *     <lwtf-choice-option value="pepperoni">Pepperoni</lwtf-choice-option>
 *   </lwtf-choices>
 *
 *   <!-- built entirely from JS -->
 *   <lwtf-choices id="colors" label="Favorite color"></lwtf-choices>
 *   <script>
 *     var el = document.getElementById('colors');
 *     el.options = [
 *       { value: 'red', label: 'Red' },
 *       { value: 'blue', label: 'Blue', checked: true },
 *       { value: 'green', label: 'Green', disabled: true }
 *     ];
 *     el.value;                 // -> ['blue']
 *     el.value = ['red'];       // select red instead
 *     el.addOption({ value: 'purple', label: 'Purple' });
 *     el.updateOption('red', { label: 'Bright Red' });
 *     el.removeOption('green');
 *   </script>
 *
 * ---------------------------------------------------------------------
 * Attributes
 * ---------------------------------------------------------------------
 *   label, helper, error, name  — display / form basics
 *   type       — "single" (default, radio behavior) | "multiple"
 *                (checkbox behavior)
 *   direction  — "vertical" (default) | "horizontal" — arrangement for
 *                plain (non-image) options
 *   layout     — "list" (default) | "grid" — "grid" arranges options in
 *                a responsive CSS grid of --lwt-choices-tile-size cells;
 *                use it for image-tile options (see lwt-frm-choice-option.js)
 *   required   — boolean; at least one option must be checked
 *   disabled   — boolean; disables the whole group (individual options
 *                can still carry their own `disabled`, which is
 *                remembered and restored if the group is re-enabled)
 *
 * ---------------------------------------------------------------------
 * Properties / methods
 * ---------------------------------------------------------------------
 *   .value                  — get/set accessor: array of currently-checked
 *                            values (0 or 1 entries for type="single",
 *                            0..n for type="multiple"). Setting accepts
 *                            an array or a single value (non-array-shaped
 *                            wraps automatically) and emits lwt-change.
 *   .setValue(newValues, opts) — same as `.value = newValues`, but takes
 *                            a second argument — the one thing a plain
 *                            property setter can't do — so you can pass
 *                            {silent: true} to skip the lwt-change emit
 *                            when syncing state programmatically.
 *   .options               — get/set the full option list. The getter
 *                            returns [{value, label, disabled, checked}].
 *                            The setter REPLACES every current
 *                            <lwtf-choice-option> (including anything
 *                            pre-rendered in markup) with new ones built
 *                            from the array.
 *   .addOption(opt)         — appends one <lwtf-choice-option> built from
 *                            {value, label, disabled?, checked?, image?,
 *                            accent?} (label accepts a string or a Node;
 *                            image/accent — see lwt-frm-choice-option.js
 *                            for what these do). Returns the new element.
 *   .updateOption(value, patch) — finds the option with that value and
 *                            applies { label?, value?, disabled?, checked?,
 *                            image?, accent? }. Returns true if found.
 *   .removeOption(value)   — removes the matching option. Returns true
 *                            if found.
 *   .clear()                — unchecks every option.
 *   .checkValidity() / .reportValidity() — matches native form control
 *                            validity (required = at least one checked).
 *
 * ---------------------------------------------------------------------
 * Events
 * ---------------------------------------------------------------------
 *   lwt-change — fires whenever the checked set changes (click, keyboard,
 *                or a non-silent .value assignment/.setValue()/.addOption()/
 *                .updateOption()/.removeOption()/.clear() call);
 *                detail: { value: [...] }
 *
 * ---------------------------------------------------------------------
 * Form participation
 * ---------------------------------------------------------------------
 * Uses the ElementInternals API (formAssociated + setFormValue +
 * setValidity), so <lwtf-choices name="…"> inside a <form> submits like a
 * native radio/checkbox group — one value for type="single", multiple
 * entries under the same name for type="multiple". When
 * ElementInternals isn't available the element still works, it just
 * doesn't participate in <form> submission.
 *
 * Requires lwt-core.js to be loaded first. Needs lwt-frm-choice-option.js
 * to be useful, but doesn't hard-depend on it to define its own element.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-frm-choices.js requires lwt-core.js to be loaded first.');
  }

  var CSS = `
    :host { display: block; font-family: inherit; color: var(--lwt-choices-color, var(--lwt-color-text, #1f2937)); }
    :host([hidden]) { display: none; }
    .group-label {
      display: block;
      font-size: 0.82rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--lwt-choices-label-color, var(--lwt-color-text, #374151));
    }
    .required-mark { color: var(--lwt-choices-required-color, var(--lwt-color-danger, #ef4444)); margin-left: 0.15rem; }
    .wrap { display: flex; flex-direction: column; gap: var(--lwt-choices-gap, var(--lwt-gap, 0.65rem)); }
    :host([direction="horizontal"]) .wrap {
      flex-direction: row;
      flex-wrap: wrap;
      gap: var(--lwt-choices-gap, 0.5rem 1.5rem);
    }
    :host([layout="grid"]) .wrap {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(var(--lwt-choices-tile-size, 140px), 1fr));
      gap: var(--lwt-choices-grid-gap, var(--lwt-gap, 1rem));
    }
    :host([disabled]) .wrap { opacity: 0.6; }
    .below { margin-top: 0.45rem; font-size: 0.78rem; min-height: 1rem; }
    .helper { color: var(--lwt-choices-helper-color, var(--lwt-color-text-muted, #6b7280)); }
    .helper.error { color: var(--lwt-choices-error-color, var(--lwt-color-danger, #ef4444)); }
  `;

  var TEMPLATE =
    '<label class="group-label" part="label"><span class="label-text"></span><span class="required-mark" hidden>*</span></label>' +
    '<div class="wrap" part="wrap"><slot></slot></div>' +
    '<div class="below" part="below"><div class="helper" part="helper"></div></div>';

  var supportsInternals = typeof HTMLElement.prototype.attachInternals === 'function';

  class LWTChoices extends window.LWT.Element {
    static get formAssociated() { return true; }

    static get observedAttributes() {
      return ['label', 'helper', 'error', 'type', 'direction', 'layout', 'name', 'required', 'disabled'];
    }

    constructor() {
      super();

      if (supportsInternals) {
        try { this._internals = this.attachInternals(); }
        catch (e) { this._internals = null; }
      }

      this._initialized = false;
      this._mo = null;
      this._onToggle = this._onToggle.bind(this);
      this._onChildrenChanged = this._onChildrenChanged.bind(this);
    }

    connectedCallback() {
      super.connectedCallback();
      this.addEventListener('lwt-toggle', this._onToggle);

      if (!this._initialized) {
        this._initialized = true;
        this._syncChildRoles();
        this._enforceSingleSelect();
        this._reportValue();
        this._reportValidity();
      }

      if (typeof MutationObserver === 'function' && !this._mo) {
        this._mo = new MutationObserver(this._onChildrenChanged);
        this._mo.observe(this, { childList: true });
      }
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.removeEventListener('lwt-toggle', this._onToggle);
      if (this._mo) { this._mo.disconnect(); this._mo = null; }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (this._labelText) this._syncAttrs();
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      this._labelEl = this._root.querySelector('.group-label');
      this._labelText = this._root.querySelector('.label-text');
      this._requiredMark = this._root.querySelector('.required-mark');
      this._helperEl = this._root.querySelector('.helper');
      this._syncAttrs();
    }

    _syncAttrs() {
      var label = this._strAttr('label', '');
      var helper = this._strAttr('helper', '');
      var error = this._strAttr('error', '');
      var required = this._boolAttr('required');
      var multiple = this._strAttr('type', 'single') === 'multiple';
      // Read-only classification attribute, distinct from `type` above
      // (which already carries this element's own single/multiple
      // configuration) — every lwtf- element sets this the same way so
      // it's queryable ([control-type="..."]) without needing to know
      // each element's own, differently-named config attribute.
      this.setAttribute('control-type', multiple ? 'lwt-checkbox' : 'lwt-radio');

      this._labelText.textContent = label;
      this._labelEl.style.display = label ? '' : 'none';
      this._requiredMark.hidden = !required;

      this.setAttribute('role', multiple ? 'group' : 'radiogroup');
      // Group name: label, else derived from name="", else generic.
      if (!this._devAttr('aria-label') && !this._devAttr('aria-labelledby')) {
        this._setAutoAttr('aria-label', this._a11yName([label, window.LWT.a11y.humanize(this._strAttr('name', ''))],
          'Options', 'Add a label attribute'));
      }
      this.setAttribute('aria-required', required ? 'true' : 'false');
      // Helper/error text lives in the shadow root, which aria-describedby
      // can't reach from the host -- aria-description carries it instead.
      var description = error || helper;
      if (description) this._setAutoAttr('aria-description', description); else this._removeAutoAttr('aria-description');
      if (error) this.setAttribute('aria-invalid', 'true'); else this.removeAttribute('aria-invalid');

      var errorMsg = error;
      if (errorMsg) {
        this._helperEl.classList.add('error');
        this._helperEl.textContent = errorMsg;
      } else {
        this._helperEl.classList.remove('error');
        this._helperEl.textContent = helper;
      }
      this.toggleAttribute('data-invalid', !!errorMsg);

      this._syncChildRoles();
      this._enforceSingleSelect();
      this._syncRoving();
      this._reportValidity();
    }

    // ---- light-DOM option management ----

    _eachOption(fn) {
      this.querySelectorAll(':scope > lwtf-choice-option').forEach(fn);
    }

    _findOption(value) {
      value = String(value);
      var found = null;
      this._eachOption(function (o) { if (!found && o.getAttribute('value') === value) found = o; });
      return found;
    }

    _syncChildRoles() {
      var multiple = this._strAttr('type', 'single') === 'multiple';
      var role = multiple ? 'checkbox' : 'radio';
      var groupDisabled = this._boolAttr('disabled');

      this._eachOption(function (o) {
        o.setAttribute('role', role);

        if (groupDisabled) {
          if (!o.hasAttribute('disabled')) o.setAttribute('data-lwt-group-disabled', '');
          o.setAttribute('disabled', '');
        } else if (o.hasAttribute('data-lwt-group-disabled')) {
          o.removeAttribute('data-lwt-group-disabled');
          o.removeAttribute('disabled');
        }
      });
    }

    _enforceSingleSelect() {
      if (this._strAttr('type', 'single') === 'multiple') return;
      var seen = false;
      this._eachOption(function (o) {
        if (o.hasAttribute('checked')) {
          if (seen) o.removeAttribute('checked'); else seen = true;
        }
      });
    }

    _onChildrenChanged() {
      this._syncChildRoles();
      this._enforceSingleSelect();
      this._reportValue();
      this._reportValidity();
    }

    // ---- selection handling ----

    _onToggle(e) {
      var option = e.target;
      if (this._boolAttr('disabled') || option.hasAttribute('disabled')) return;

      var multiple = this._strAttr('type', 'single') === 'multiple';
      if (multiple) {
        option.toggleAttribute('checked', !option.hasAttribute('checked'));
      } else {
        if (option.hasAttribute('checked')) return; // clicking the already-checked radio is a no-op
        this._eachOption(function (o) { o.removeAttribute('checked'); });
        option.setAttribute('checked', '');
      }

      this._reportValue();
      this._reportValidity();
      this.emit('change', { value: this._collectValues() });
    }

    _collectValues() {
      var arr = [];
      this._eachOption(function (o) { if (o.hasAttribute('checked')) arr.push(o.getAttribute('value') || ''); });
      return arr;
    }

    // ---- public API ----

    // Get/set accessor — array of currently-checked values. Setting
    // replaces the checked set (same rules as before: single-select
    // keeps only the first match, multi-select checks every match).
    get value() { return this._collectValues(); }
    set value(newValues) { this.setValue(newValues); }

    // Same as `.value = newValues`, but takes a second options argument
    // — a plain setter can't accept one, and {silent:true} is the one
    // case a property accessor alone can't cover (skipping the
    // lwt-change emit when you're syncing state programmatically rather
    // than responding to a user pick).
    setValue(newValues, opts) {
      opts = opts || {};
      var multiple = this._strAttr('type', 'single') === 'multiple';
      var arr = Array.isArray(newValues) ? newValues.map(String) : (newValues == null ? [] : [String(newValues)]);
      var applied = false;

      this._eachOption(function (o) {
        var v = o.getAttribute('value') || '';
        var shouldCheck = arr.indexOf(v) !== -1 && (multiple || !applied);
        if (shouldCheck && !multiple) applied = true;
        o.toggleAttribute('checked', shouldCheck);
      });

      this._reportValue();
      this._reportValidity();
      if (!opts.silent) this.emit('change', { value: this._collectValues() });
      return this;
    }

    get options() {
      var arr = [];
      this._eachOption(function (o) {
        arr.push({
          value: o.getAttribute('value') || '',
          label: o.textContent,
          disabled: o.hasAttribute('disabled'),
          checked: o.hasAttribute('checked'),
          image: o.getAttribute('image') || '',
          accent: o.getAttribute('accent') || ''
        });
      });
      return arr;
    }

    set options(arr) {
      this._eachOption(function (o) { o.remove(); });
      var self = this;
      (Array.isArray(arr) ? arr : []).forEach(function (opt) { self.addOption(opt); });
      this._reportValue();
      this._reportValidity();
    }

    addOption(opt) {
      opt = opt || {};
      var attrs = { value: opt.value != null ? String(opt.value) : '' };
      if (opt.disabled) attrs.disabled = '';
      if (opt.image) attrs.image = String(opt.image);
      if (opt.accent) attrs.accent = String(opt.accent);

      var el = this._genhtml({ type: 'lwtf-choice-option', attr: attrs });
      if (opt.label instanceof Node) el.appendChild(opt.label);
      else if (opt.label !== undefined) el.textContent = String(opt.label);

      this.appendChild(el);
      this._syncChildRoles();

      if (opt.checked) {
        if (this._strAttr('type', 'single') !== 'multiple') {
          this._eachOption(function (o) { if (o !== el) o.removeAttribute('checked'); });
        }
        el.setAttribute('checked', '');
        this._reportValue();
        this._reportValidity();
      }

      return el;
    }

    updateOption(value, patch) {
      patch = patch || {};
      var el = this._findOption(value);
      if (!el) return false;

      if (patch.value !== undefined) el.setAttribute('value', String(patch.value));
      if (patch.label !== undefined) {
        el.textContent = '';
        if (patch.label instanceof Node) el.appendChild(patch.label);
        else el.textContent = String(patch.label);
      }
      if (patch.disabled !== undefined) el.toggleAttribute('disabled', !!patch.disabled);
      if (patch.image !== undefined) { if (patch.image) el.setAttribute('image', String(patch.image)); else el.removeAttribute('image'); }
      if (patch.accent !== undefined) { if (patch.accent) el.setAttribute('accent', String(patch.accent)); else el.removeAttribute('accent'); }

      if (patch.checked !== undefined) {
        if (patch.checked && this._strAttr('type', 'single') !== 'multiple') {
          this._eachOption(function (o) { if (o !== el) o.removeAttribute('checked'); });
        }
        el.toggleAttribute('checked', !!patch.checked);
        this._reportValue();
        this._reportValidity();
      }

      return true;
    }

    removeOption(value) {
      var el = this._findOption(value);
      if (!el) return false;
      var wasChecked = el.hasAttribute('checked');
      el.remove();
      if (wasChecked) {
        this._reportValue();
        this._reportValidity();
      }
      return true;
    }

    clear() {
      this._eachOption(function (o) { o.removeAttribute('checked'); });
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

    // Radio groups: only the checked option (or the first enabled one) is
    // in the Tab order; arrow keys move within the group. Checkbox groups:
    // every option is a Tab stop.
    _syncRoving() {
      var multiple = this._strAttr('type', 'single') === 'multiple';
      var options = Array.prototype.slice.call(this.querySelectorAll(':scope > lwtf-choice-option'));
      if (multiple) {
        options.forEach(function (o) {
          if (o.hasAttribute('data-lwt-roving')) o.removeAttribute('data-lwt-roving');
          o.tabIndex = o.hasAttribute('disabled') ? -1 : 0;
        });
        return;
      }
      var enabled = options.filter(function (o) { return !o.hasAttribute('disabled'); });
      var current = enabled.filter(function (o) { return o.hasAttribute('checked'); })[0] || enabled[0];
      options.forEach(function (o) {
        o.setAttribute('data-lwt-roving', '');
        o.tabIndex = o === current ? 0 : -1;
      });
    }

    _reportValue() {
      this._syncRoving();
      if (!this._internals) return;
      var vals = this._collectValues();
      var multiple = this._strAttr('type', 'single') === 'multiple';
      var name = this._strAttr('name', '') || 'value';

      if (!vals.length) {
        this._internals.setFormValue(null);
      } else if (!multiple) {
        this._internals.setFormValue(vals[0]);
      } else {
        var fd = new FormData();
        vals.forEach(function (v) { fd.append(name, v); });
        this._internals.setFormValue(fd);
      }
    }

    _reportValidity() {
      if (!this._internals) return;
      var required = this._boolAttr('required');
      var vals = this._collectValues();

      if (required && vals.length === 0) {
        this._internals.setValidity({ valueMissing: true }, 'Select at least one option.', this);
      } else {
        this._internals.setValidity({});
      }
    }
  }

  window.LWT.define('lwtf-choices', LWTChoices);
})();

/* ---- lwt-frm-color-picker.js ---- */
/*!
 * <lwtf-color-picker>
 * A color picker whose interactive area is switchable between four
 * modes — HSL Color Wheel (ring + saturation/lightness square), RGB
 * Sliders, HSL Sliders, and CMYK Sliders — via a dropdown, Photoshop-
 * "Color Picker"-style. Below/beside the switchable area, a fixed
 * output panel always shows R/G/B, H/S/L, a combined hex field, and C/M/Y/K,
 * regardless of which mode is active. Everything stays in sync against
 * one internal HSLA model.
 *
 * Accepts and emits hex (#rgb, #rgba, #rrggbb, #rrggbbaa), rgb()/rgba(),
 * and hsl()/hsla() strings.
 *
 *   <lwtf-color-picker value="#3b82f6" format="hex" mode="hsl"></lwtf-color-picker>
 *
 * Attributes:
 *   value  — initial color, read once on connect (see note below)
 *   format — 'hex' | 'rgb' | 'hsl', controls what .value returns (default 'hex')
 *   mode   — initial interactive mode, read once on connect (see note
 *            below); one of 'hsl-wheel' | 'rgb' | 'hsl' (default) | 'cmyk'.
 *            Reflected live afterward for CSS/styling hooks, but drive
 *            it via the dropdown or .mode, not by re-setting this attribute.
 *
 * Properties: .value (get/set string), .hex, .rgba ({r,g,b,a}),
 * .hsla ({h,s,l,a}), .cmyk ({c,m,y,k}), .mode (get/set the active
 * interactive mode string, same values as the `mode` attribute above)
 *
 * Note on `value`/`mode`: like lwtg-modal's `open` attribute, these are
 * read once at connect time for the initial state, not kept in two-way
 * attribute sync afterward. Use .value / .mode (or .hex/.rgba/.hsla/.cmyk)
 * to read/write live state.
 *
 * Forms: form-associated, so it works inside a plain <form> like a native
 * input. Give it a `name` and the color (in the current `format`) is
 * included in submit / new FormData(form). form.reset() restores the
 * original `value` attribute, and a `disabled` attribute or a disabled
 * <fieldset> greys it out and leaves it out of the submitted data.
 *   <form>
 *     <lwtf-color-picker name="brand" value="#3b82f6"></lwtf-color-picker>
 *   </form>
 * Also: .form, .name, .checkValidity(), .reportValidity().
 *
 * Events: lwtf-input (fires continuously while dragging/typing), lwt-change
 * (fires once when a drag ends or a field is committed). Both carry
 * detail: { value, hex, rgba, hsla, cmyk }.
 *
 * The only observed attributes are `name` and `format`, and changing them
 * just updates the submitted form value -- attributeChangedCallback is
 * overridden so it never triggers the base class's shadow-DOM rebuild.
 * All other state lives in JS instance fields and is driven by user
 * interaction (a square/slider/wheel being dragged can't afford a full
 * rebuild on every pixel of movement). Mode switching therefore works by toggling a `mode`
 * attribute on the host and letting CSS attribute selectors show/hide
 * the right panel — no re-render needed for that either. The one shared
 * saturation/lightness square is re-parented (not rebuilt) between
 * panels on a mode switch, so its canvas content and listeners survive.
 *
 * Keyboard support (arrow keys) is basic; there's no full ARIA
 * value-announcement beyond aria-valuemin/max.
 *
 * Theming (all optional, falls back to a light default so it works
 * unstyled): --lwt-picker-bg (host background, default white),
 * --lwt-picker-track-border, --lwt-picker-field-bg,
 * --lwt-picker-field-border, --lwt-picker-field-color. The host itself
 * renders as a bordered, padded card (white by default) rather than a
 * transparent inline block — set --lwt-picker-bg for the fill color, or
 * override the host's own `border`/`padding`/`border-radius` directly
 * (it's a normal element from the outside, so a class or `style` on
 * `<lwtf-color-picker>` itself works) to fit a dark page or a panel that
 * already has its own chrome.
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-frm-color-picker.js requires lwt-core.js to be loaded first.');
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function hex2(n) {
    var h = Math.round(clamp(n, 0, 255)).toString(16);
    return h.length < 2 ? '0' + h : h;
  }

  var Color = {
    hslToRgb: function (h, s, l) {
      s /= 100; l /= 100;
      var c = (1 - Math.abs(2 * l - 1)) * s;
      var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      var m = l - c / 2;
      var r1, g1, b1;
      if (h < 60) { r1 = c; g1 = x; b1 = 0; }
      else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
      else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
      else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
      else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
      else { r1 = c; g1 = 0; b1 = x; }
      return {
        r: Math.round((r1 + m) * 255),
        g: Math.round((g1 + m) * 255),
        b: Math.round((b1 + m) * 255)
      };
    },

    rgbToHsl: function (r, g, b) {
      r /= 255; g /= 255; b /= 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      var l = (max + min) / 2;
      var h = 0, s = 0;
      if (max !== min) {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
      }
      return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
    },

    rgbToCmyk: function (r, g, b) {
      r /= 255; g /= 255; b /= 255;
      var k = 1 - Math.max(r, g, b);
      var c = k < 1 ? (1 - r - k) / (1 - k) : 0;
      var m = k < 1 ? (1 - g - k) / (1 - k) : 0;
      var y = k < 1 ? (1 - b - k) / (1 - k) : 0;
      return { c: Math.round(c * 100), m: Math.round(m * 100), y: Math.round(y * 100), k: Math.round(k * 100) };
    },

    cmykToRgb: function (c, m, y, k) {
      c /= 100; m /= 100; y /= 100; k /= 100;
      return {
        r: Math.round(255 * (1 - c) * (1 - k)),
        g: Math.round(255 * (1 - m) * (1 - k)),
        b: Math.round(255 * (1 - y) * (1 - k))
      };
    },

    toHex: function (r, g, b, a) {
      var out = '#' + hex2(r) + hex2(g) + hex2(b);
      if (typeof a === 'number' && a < 1) out += hex2(clamp(a, 0, 1) * 255);
      return out;
    },

    // Parses hex / rgb() / rgba() / hsl() / hsla() into {h,s,l,a}, or null.
    parse: function (str) {
      str = String(str || '').trim();
      var m;

      if (/^#/.test(str)) {
        var hex = str.slice(1);
        if (hex.length === 3 || hex.length === 4) {
          hex = hex.split('').map(function (c) { return c + c; }).join('');
        }
        if (hex.length === 6 || hex.length === 8) {
          var r = parseInt(hex.slice(0, 2), 16);
          var g = parseInt(hex.slice(2, 4), 16);
          var b = parseInt(hex.slice(4, 6), 16);
          var a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
          if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            var hsl = Color.rgbToHsl(r, g, b);
            return { h: hsl.h, s: hsl.s, l: hsl.l, a: a };
          }
        }
        return null;
      }

      m = str.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+%?)\s*)?\)$/i);
      if (m) {
        var rr = parseFloat(m[1]), gg = parseFloat(m[2]), bb = parseFloat(m[3]);
        var aa = m[4] !== undefined ? (m[4].indexOf('%') > -1 ? parseFloat(m[4]) / 100 : parseFloat(m[4])) : 1;
        var hslFromRgb = Color.rgbToHsl(rr, gg, bb);
        return { h: hslFromRgb.h, s: hslFromRgb.s, l: hslFromRgb.l, a: clamp(aa, 0, 1) };
      }

      m = str.match(/^hsla?\(\s*([\d.]+)(?:deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+%?)\s*)?\)$/i);
      if (m) {
        var h2 = parseFloat(m[1]), s2 = parseFloat(m[2]), l2 = parseFloat(m[3]);
        var a2 = m[4] !== undefined ? (m[4].indexOf('%') > -1 ? parseFloat(m[4]) / 100 : parseFloat(m[4])) : 1;
        return { h: ((h2 % 360) + 360) % 360, s: clamp(s2, 0, 100), l: clamp(l2, 0, 100), a: clamp(a2, 0, 1) };
      }

      return null;
    }
  };

  // ---- channel metadata (drives slider-row markup + keyboard/pointer logic) ----

  var HSL_ROWS = [
    { ch: 'h', label: 'H', max: 360 },
    { ch: 's', label: 'S', max: 100 },
    { ch: 'l', label: 'L', max: 100 },
    { ch: 'a', label: 'A', max: 100 }
  ];
  var RGB_ROWS = [
    { ch: 'r', label: 'R', max: 255 },
    { ch: 'g', label: 'G', max: 255 },
    { ch: 'b', label: 'B', max: 255 }
  ];
  var CMYK_ROWS = [
    { ch: 'c', label: 'C', max: 100 },
    { ch: 'm', label: 'M', max: 100 },
    { ch: 'y', label: 'Y', max: 100 },
    { ch: 'k', label: 'K', max: 100 }
  ];

  // Full spoken names for the one-letter visual labels.
  var CHANNEL_NAMES = { h: 'Hue', s: 'Saturation', l: 'Lightness', a: 'Opacity', r: 'Red', g: 'Green', b: 'Blue',
                        c: 'Cyan', m: 'Magenta', y: 'Yellow', k: 'Black', hex: 'Hex color code' };
  var CHANNEL_UNITS = { h: ' degrees', s: '%', l: '%', a: '%', c: '%', m: '%', y: '%', k: '%' };

  function sliderRowHtml(row) {
    var extra = row.ch === 'a'
      ? '<div class="alpha-checkerboard"></div><div class="alpha-gradient" part="alpha-gradient"></div>'
      : '';
    return (
      '<div class="slider-row">' +
      '  <label aria-hidden="true">' + row.label + '</label>' +
      '  <div class="slider" data-channel="' + row.ch + '" data-max="' + row.max + '" part="' + row.ch + '-slider" tabindex="0" role="slider" aria-label="' + CHANNEL_NAMES[row.ch] + '" aria-valuemin="0" aria-valuemax="' + row.max + '" aria-valuenow="0">' +
      extra +
      '    <div class="slider-handle" part="' + row.ch + '-handle"></div>' +
      '  </div>' +
      '  <input type="number" class="field" data-channel="' + row.ch + '" data-source="slider" min="0" max="' + row.max + '" step="1" aria-label="' + CHANNEL_NAMES[row.ch] + ' value">' +
      '</div>'
    );
  }

  function outputFieldHtml(ch, label, opts) {
    opts = opts || {};
    var attrs = 'type="text" class="field" data-channel="' + ch + '" data-source="panel" aria-label="' + CHANNEL_NAMES[ch] + '"';
    if (opts.maxlength) attrs += ' maxlength="' + opts.maxlength + '"';
    if (opts.numeric) attrs = attrs.replace('type="text"', 'type="number" min="0" max="' + opts.numeric + '"');
    return '<label>' + label + '<input ' + attrs + '></label>';
  }

  var SQUARE_HTML =
    '<div class="square" part="square" tabindex="0" role="slider" aria-label="Saturation and lightness" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
    '  <canvas></canvas>' +
    '  <div class="square-handle" part="square-handle"></div>' +
    '</div>';

  var TEMPLATE =
    '<div class="picker" part="picker">' +
    '  <div class="top-row">' +
    '    <select class="mode-select" part="mode-select" aria-label="Color picker mode">' +
    '      <option value="hsl-wheel">HSL Color Wheel</option>' +
    '      <option value="rgb">RGB Sliders</option>' +
    '      <option value="hsl">HSL Sliders</option>' +
    '      <option value="cmyk">CMYK Sliders</option>' +
    '    </select>' +
    '    <div class="swatch-row">' +
    '      <div class="swatch-checkerboard" part="swatch-wrap" role="img" aria-label="Selected color"><div class="swatch" part="swatch"></div></div>' +
    '      <button type="button" class="eyedropper" part="eyedropper" title="Pick color from screen" aria-label="Pick color from screen" hidden>&#9681;</button>' +
    '    </div>' +
    '  </div>' +

    '  <div class="mode-panel" data-mode="hsl-wheel" part="wheel-panel">' +
    '    <div class="wheel-wrap">' +
    '      <div class="wheel" part="wheel" tabindex="0" role="slider" aria-label="Hue" aria-valuemin="0" aria-valuemax="360" aria-valuenow="0"><div class="wheel-handle" part="wheel-handle"></div></div>' +
    '      <div class="square-slot square-slot--wheel"></div>' +
    '    </div>' +
    '  </div>' +

    '  <div class="mode-panel" data-mode="rgb" part="rgb-panel">' +
    RGB_ROWS.map(sliderRowHtml).join('') +
    '    <div class="square-slot"></div>' +
    '  </div>' +

    '  <div class="mode-panel" data-mode="hsl" part="hsl-panel">' +
    HSL_ROWS.map(sliderRowHtml).join('') +
    '    <div class="square-slot"></div>' +
    '  </div>' +

    '  <div class="mode-panel" data-mode="cmyk" part="cmyk-panel">' +
    CMYK_ROWS.map(sliderRowHtml).join('') +
    '    <div class="square-slot"></div>' +
    '  </div>' +

    '  <div class="output-panel" part="output">' +
    '    <div class="output-row">' +
    '      <div class="output-group" part="rgb-group">' +
    outputFieldHtml('r', 'R:', { numeric: 255 }) + outputFieldHtml('g', 'G:', { numeric: 255 }) + outputFieldHtml('b', 'B:', { numeric: 255 }) +
    '      </div>' +
    '      <div class="output-group" part="hsl-group">' +
    outputFieldHtml('h', 'H:', { numeric: 360 }) + outputFieldHtml('s', 'S:', { numeric: 100 }) + outputFieldHtml('l', 'L:', { numeric: 100 }) +
    '      </div>' +
    '    </div>' +
    '    <div class="output-row">' +
    '      <div class="output-group hex-group" part="hex-group">' +
    outputFieldHtml('hex', '#:', { maxlength: 9 }) +
    '      </div>' +
    '      <div class="output-group cmyk-group" part="cmyk-group">' +
    outputFieldHtml('c', 'C:', { numeric: 100 }) + outputFieldHtml('m', 'M:', { numeric: 100 }) + outputFieldHtml('y', 'Y:', { numeric: 100 }) + outputFieldHtml('k', 'K:', { numeric: 100 }) +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '</div>';

  var CHECKERBOARD =
    'background-image:' +
    '  linear-gradient(45deg, #ccc 25%, transparent 25%),' +
    '  linear-gradient(-45deg, #ccc 25%, transparent 25%),' +
    '  linear-gradient(45deg, transparent 75%, #ccc 75%),' +
    '  linear-gradient(-45deg, transparent 75%, #ccc 75%);';

  var CSS = `
    :host {
      display: block;
      color: inherit;
      font-family: inherit;
      width: fit-content;
      box-sizing: border-box;
      padding: var(--lwt-picker-padding, var(--lwt-padding, 1em));
      border-radius: var(--lwt-picker-radius, var(--lwt-border-radius, 4px));
      background-color: var(--lwt-picker-bg, var(--lwt-color-surface, white));
      border: var(--lwt-picker-border, var(--lwt-border, 1px solid #d1d5db));
    }
    .picker {
      display: grid;
      grid-template-columns: auto 200px;
      grid-template-rows: auto auto;
      gap: var(--lwt-picker-gap, var(--lwt-gap, 0.75rem));
      width: fit-content;
      min-width: 300px;
    }
    .top-row {
      grid-column: span 2;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .mode-select {
      flex: 1;
      font: inherit;
      font-size: 0.8rem;
      padding: 0.32rem 0.4rem;
      border-radius: var(--lwt-picker-field-radius, var(--lwt-border-radius, 4px));
      border: var(--lwt-picker-field-border, var(--lwt-border, 1px solid #d1d5db));
      background: var(--lwt-picker-field-bg, var(--lwt-color-surface, #fff));
      color: var(--lwt-picker-field-color, inherit);
    }
    .swatch-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-shrink: 0;
    }
    .swatch-checkerboard {
      position: relative;
      width: 2.4rem;
      height: 2.4rem;
      border-radius: 6px;
      overflow: hidden;
      border: var(--lwt-picker-track-border, var(--lwt-border, 1px solid rgba(0,0,0,0.15)));
      ${CHECKERBOARD}
      background-size: 8px 8px;
      background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
    }
    .swatch { position: absolute; inset: 0; }
    .picker[inert] { opacity: 0.55; cursor: not-allowed; }
    .eyedropper {
      flex-shrink: 0;
      width: 2.4rem;
      height: 2.4rem;
      border-radius: var(--lwt-picker-field-radius, var(--lwt-border-radius, 6px));
      border: var(--lwt-picker-field-border, var(--lwt-border, 1px solid #d1d5db));
      background: var(--lwt-picker-field-bg, var(--lwt-color-surface, #fff));
      color: var(--lwt-picker-field-color, inherit);
      cursor: pointer;
      font-size: 1.1rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .eyedropper[hidden] { display: none; }
    .mode-panel { display: none; }
    :host(:not([mode])) .mode-panel[data-mode="hsl"],
    :host([mode="hsl-wheel"]) .mode-panel[data-mode="hsl-wheel"],
    :host([mode="rgb"]) .mode-panel[data-mode="rgb"],
    :host([mode="hsl"]) .mode-panel[data-mode="hsl"],
    :host([mode="cmyk"]) .mode-panel[data-mode="cmyk"] {
      display: block;
    }
    .wheel-wrap {
      position: relative;
      width: 210px;
      height: 210px;
      margin: 0 auto;
    }
    .wheel {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      cursor: pointer;
      touch-action: none;
      background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
      -webkit-mask-image: radial-gradient(circle, transparent 60%, black 61%);
      mask-image: radial-gradient(circle, transparent 60%, black 61%);
    }
    .wheel-handle {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 14px;
      height: 14px;
      margin: -7px;
      border-radius: 50%;
      box-shadow: 0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,0.35);
      pointer-events: none;
    }
    .square-slot--wheel {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 56%;
      height: 56%;
      transform: translate(-50%, -50%);
    }
    .square-slot--wheel .square { width: 100%; height: 100%; }
    .square {
      position: relative;
      width: 100%;
      aspect-ratio: 1 / 1;
      border-radius: 8px;
      overflow: hidden;
      border: var(--lwt-picker-track-border, var(--lwt-border, 1px solid rgba(0,0,0,0.15)));
      cursor: crosshair;
      touch-action: none;
    }
    .square canvas { display: block; width: 100%; height: 100%; }
    .square-handle {
      position: absolute;
      top: 0;
      left: 0;
      width: 14px;
      height: 14px;
      margin: -7px;
      border-radius: 50%;
      box-shadow: 0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,0.35);
      pointer-events: none;
    }
    .slider-row {
      display: grid;
      grid-template-columns: 1rem 1fr 3.4rem;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.55rem;
    }
    .slider-row label { font-size: 0.72rem; opacity: 0.65; }
    .slider {
      position: relative;
      height: 12px;
      border-radius: 999px;
      border: var(--lwt-picker-track-border, var(--lwt-border, 1px solid rgba(0,0,0,0.15)));
      touch-action: none;
      cursor: pointer;
      overflow: hidden;
    }
    /* Hue track: full-saturation rainbow, evenly spaced so position x maps
       to hue x*360 -- the same stops as the hue wheel's conic-gradient. */
    .slider[data-channel="h"] {
      background: var(--lwt-picker-hue-gradient, linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%)));
    }
    .alpha-checkerboard {
      position: absolute;
      inset: 0;
      ${CHECKERBOARD}
      background-size: 8px 8px;
      background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
    }
    .alpha-gradient { position: absolute; inset: 0; }
    .slider-handle {
      position: absolute;
      top: 50%;
      left: 0;
      width: 14px;
      height: 14px;
      margin-left: -7px;
      margin-top: -7px;
      border-radius: 50%;
      box-shadow: 0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,0.35);
      background: #fff;
      pointer-events: none;
    }
    .field {
      width: 100%;
      box-sizing: border-box;
      font: inherit;
      font-size: 0.78rem;
      padding: 0.28rem 0.35rem;
      border-radius: var(--lwt-picker-field-radius, var(--lwt-border-radius, 4px));
      border: var(--lwt-picker-field-border, var(--lwt-border, 1px solid #d1d5db));
      background: var(--lwt-picker-field-bg, var(--lwt-color-surface, #fff));
      color: var(--lwt-picker-field-color, inherit);
    }
    .output-panel { display: flex; flex-direction: column-reverse; gap: 0.5rem; }
    .output-row { display: flex; flex-direction: column; gap: 0.5rem; }
    .output-group { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem; }
    .output-group.cmyk-group { grid-template-columns: repeat(4, 1fr); }
    .output-group.hex-group { grid-template-columns: 1fr; }
    .output-group label {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      font-size: 0.68rem;
      opacity: 0.65;
    }
    [data-channel="hex"] { text-transform: uppercase; }
  `;

  var supportsInternals = typeof HTMLElement.prototype.attachInternals === 'function';

  class LWTColorPicker extends window.LWT.Element {
    static get formAssociated() { return true; }

    // Only attributes that affect the submitted form value. See the note
    // in the header: these must not trigger a re-render.
    static get observedAttributes() { return ['name', 'format']; }

    constructor() {
      super();
      this._internals = null;
      if (supportsInternals) {
        try { this._internals = this.attachInternals(); }
        catch (e) { this._internals = null; }
      }
      this._defaultValue = null;
      this._h = 0; this._s = 0; this._l = 100; this._a = 1;
      this._lastDrawnHue = null;
      this._initialized = false;
      this._activeTrack = null;
      this._activeChannel = null;
      this._squareDragging = false;
      this._wheelDragging = false;

      this._onSquarePointerDown = this._onSquarePointerDown.bind(this);
      this._onSquarePointerMove = this._onSquarePointerMove.bind(this);
      this._onSquarePointerUp = this._onSquarePointerUp.bind(this);
      this._onSquareKeyDown = this._onSquareKeyDown.bind(this);
      this._onWheelPointerDown = this._onWheelPointerDown.bind(this);
      this._onWheelPointerMove = this._onWheelPointerMove.bind(this);
      this._onWheelPointerUp = this._onWheelPointerUp.bind(this);
      this._onWheelKeyDown = this._onWheelKeyDown.bind(this);
      this._onSliderPointerDown = this._onSliderPointerDown.bind(this);
      this._onSliderPointerMove = this._onSliderPointerMove.bind(this);
      this._onSliderPointerUp = this._onSliderPointerUp.bind(this);
      this._onSliderKeyDown = this._onSliderKeyDown.bind(this);
      this._onFieldInput = this._onFieldInput.bind(this);
      this._onFieldChange = this._onFieldChange.bind(this);
      this._onEyedropperClick = this._onEyedropperClick.bind(this);
      this._onModeChange = this._onModeChange.bind(this);
    }

    connectedCallback() {
      super.connectedCallback(); // builds shadow DOM via render(), caches refs, wires listeners
      // Read-only classification attribute — see lwt-frm-choices.js for
      // the convention every lwtf- element follows.
      this.setAttribute('control-type', 'color');
      // The whole picker is one named group of controls.
      this._ensureAttr('role', 'group');
      this._ensureAttr('aria-label', this._a11yName([this._strAttr('label', ''), window.LWT.a11y.humanize(this._strAttr('name', ''))],
        'Color picker', 'Add a label attribute'));

      if (!this._initialized) {
        this._initialized = true;
        var initial = this.getAttribute('value');
        this._defaultValue = initial;
        if (initial) {
          var parsed = Color.parse(initial);
          if (parsed) { this._h = parsed.h; this._s = parsed.s; this._l = parsed.l; this._a = parsed.a; }
        }

        var initialMode = this.getAttribute('mode');
        var validModes = { 'hsl-wheel': 1, rgb: 1, hsl: 1, cmyk: 1 };
        this._setMode(validModes[initialMode] ? initialMode : 'hsl', { silent: true });
      }

      if (window.EyeDropper) this._eyedropperBtn.hidden = false;
      // render() rebuilt the shadow DOM, so re-apply a disabled state.
      this.formDisabledCallback(this.matches(':disabled'));
      this._syncUI();
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      var root = this._root;

      this._picker = root.querySelector('.picker');
      this._modeSelect = root.querySelector('.mode-select');
      this._squareWrap = this._genhtml({ type: 'div' }); // built once, re-parented on mode switch (see _placeSquare)
      this._squareWrap.className = 'square';
      this._squareWrap.setAttribute('part', 'square');
      this._squareWrap.tabIndex = 0;
      this._squareWrap.setAttribute('role', 'slider');
      this._squareWrap.setAttribute('aria-label', 'Saturation and lightness');
      this._canvas = document.createElement('canvas');
      this._canvas.width = 220;
      this._canvas.height = 220;
      this._squareHandle = document.createElement('div');
      this._squareHandle.className = 'square-handle';
      this._squareHandle.setAttribute('part', 'square-handle');
      this._squareWrap.appendChild(this._canvas);
      this._squareWrap.appendChild(this._squareHandle);

      this._wheel = root.querySelector('.wheel');
      this._wheelHandle = root.querySelector('.wheel-handle');
      this._swatch = root.querySelector('.swatch');
      this._eyedropperBtn = root.querySelector('.eyedropper');

      this._modeSelect.addEventListener('change', this._onModeChange);

      this._squareWrap.addEventListener('pointerdown', this._onSquarePointerDown);
      this._squareWrap.addEventListener('pointermove', this._onSquarePointerMove);
      this._squareWrap.addEventListener('pointerup', this._onSquarePointerUp);
      this._squareWrap.addEventListener('pointercancel', this._onSquarePointerUp);
      this._squareWrap.addEventListener('keydown', this._onSquareKeyDown);

      this._wheel.addEventListener('pointerdown', this._onWheelPointerDown);
      this._wheel.addEventListener('pointermove', this._onWheelPointerMove);
      this._wheel.addEventListener('pointerup', this._onWheelPointerUp);
      this._wheel.addEventListener('pointercancel', this._onWheelPointerUp);
      this._wheel.addEventListener('keydown', this._onWheelKeyDown);

      root.querySelectorAll('.slider').forEach((function (track) {
        track.addEventListener('pointerdown', this._onSliderPointerDown);
        track.addEventListener('pointermove', this._onSliderPointerMove);
        track.addEventListener('pointerup', this._onSliderPointerUp);
        track.addEventListener('pointercancel', this._onSliderPointerUp);
        track.addEventListener('keydown', this._onSliderKeyDown);
      }).bind(this));

      this._eyedropperBtn.addEventListener('click', this._onEyedropperClick);
      root.addEventListener('input', this._onFieldInput);
      root.addEventListener('change', this._onFieldChange);

      this._placeSquare(this._strAttr ? this._strAttr('mode', 'hsl') : 'hsl');
    }

    // Public API ------------------------------------------------------

    get rgba() {
      var rgb = Color.hslToRgb(this._h, this._s, this._l);
      return { r: rgb.r, g: rgb.g, b: rgb.b, a: this._a };
    }

    get hsla() {
      return { h: Math.round(this._h), s: Math.round(this._s), l: Math.round(this._l), a: this._a };
    }

    get cmyk() {
      var rgb = Color.hslToRgb(this._h, this._s, this._l);
      return Color.rgbToCmyk(rgb.r, rgb.g, rgb.b);
    }

    get hex() {
      var rgb = Color.hslToRgb(this._h, this._s, this._l);
      return Color.toHex(rgb.r, rgb.g, rgb.b, this._a).toUpperCase();
    }

    get value() {
      var format = this._strAttr('format', 'hex');
      var rgb = Color.hslToRgb(this._h, this._s, this._l);
      if (format === 'rgb') return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + round2(this._a) + ')';
      if (format === 'hsl') return 'hsla(' + Math.round(this._h) + ', ' + Math.round(this._s) + '%, ' + Math.round(this._l) + '%, ' + round2(this._a) + ')';
      return this.hex;
    }

    set value(str) { this.setValue(str); }

    // Same as `.value = str`, but takes a second options argument — a
    // plain setter can't accept one, and {silent:true} is the one case
    // a property accessor alone can't cover (skipping the lwt-change
    // emit when you're syncing state programmatically rather than
    // responding to a user pick).
    setValue(str, opts) {
      opts = opts || {};
      var parsed = Color.parse(str);
      if (!parsed) return this;
      this._applyHSL(parsed.h, parsed.s, parsed.l, parsed.a);
      if (!opts.silent) this.emit('change', this._detail());
      return this;
    }

    get mode() { return this._modeSelect ? this._modeSelect.value : this._strAttr('mode', 'hsl'); }
    set mode(m) { this._setMode(m); }

    // Internals ---------------------------------------------------------

    _detail() {
      return { value: this.value, hex: this.hex, rgba: this.rgba, hsla: this.hsla, cmyk: this.cmyk };
    }

    _setMode(mode, opts) {
      opts = opts || {};
      var valid = { 'hsl-wheel': 1, rgb: 1, hsl: 1, cmyk: 1 };
      if (!valid[mode]) return;
      if (this._modeSelect) this._modeSelect.value = mode;
      this.setAttribute('mode', mode); // pure-CSS panel show/hide, see :host([mode="…"]) rules
      this._placeSquare(mode);
      if (!opts.silent) this.emit('change', this._detail());
    }

    // The one shared saturation/lightness square is re-parented (not
    // rebuilt) into whichever panel is now active, so its canvas pixels
    // and event listeners survive a mode switch untouched.
    _placeSquare(mode) {
      if (!this._root) return;
      var slot = mode === 'hsl-wheel'
        ? this._root.querySelector('.square-slot--wheel')
        : this._root.querySelector('.mode-panel[data-mode="' + mode + '"] .square-slot');
      if (slot && this._squareWrap.parentElement !== slot) slot.appendChild(this._squareWrap);
    }

    _applyHSL(h, s, l, a) {
      this._h = ((h % 360) + 360) % 360;
      this._s = clamp(s, 0, 100);
      this._l = clamp(l, 0, 100);
      this._a = clamp(a, 0, 1);
      this._syncUI();
      this.emit('input', this._detail());
    }

    // Generic channel-fraction dispatcher used by every slider row +
    // the hue wheel; converts through to the canonical HSL model.
    _applyChannelFraction(channel, frac) {
      frac = clamp(frac, 0, 1);
      var rgb, hsl, cmyk;

      switch (channel) {
        case 'h': this._applyHSL(frac * 360, this._s, this._l, this._a); break;
        case 's': this._applyHSL(this._h, frac * 100, this._l, this._a); break;
        case 'l': this._applyHSL(this._h, this._s, frac * 100, this._a); break;
        case 'a': this._applyHSL(this._h, this._s, this._l, frac); break;
        case 'r': case 'g': case 'b':
          rgb = Color.hslToRgb(this._h, this._s, this._l);
          rgb[channel] = Math.round(frac * 255);
          hsl = Color.rgbToHsl(rgb.r, rgb.g, rgb.b);
          this._applyHSL(hsl.h, hsl.s, hsl.l, this._a);
          break;
        case 'c': case 'm': case 'y': case 'k':
          rgb = Color.hslToRgb(this._h, this._s, this._l);
          cmyk = Color.rgbToCmyk(rgb.r, rgb.g, rgb.b);
          cmyk[channel] = Math.round(frac * 100);
          rgb = Color.cmykToRgb(cmyk.c, cmyk.m, cmyk.y, cmyk.k);
          hsl = Color.rgbToHsl(rgb.r, rgb.g, rgb.b);
          this._applyHSL(hsl.h, hsl.s, hsl.l, this._a);
          break;
      }
    }

    _drawSquare() {
      var ctx = this._canvas.getContext('2d');
      var w = this._canvas.width, h = this._canvas.height;
      var imageData = ctx.createImageData(w, h);
      var data = imageData.data;
      for (var y = 0; y < h; y++) {
        var l = 100 - (y / (h - 1)) * 100;
        for (var x = 0; x < w; x++) {
          var s = (x / (w - 1)) * 100;
          var rgb = Color.hslToRgb(this._h, s, l);
          var idx = (y * w + x) * 4;
          data[idx] = rgb.r;
          data[idx + 1] = rgb.g;
          data[idx + 2] = rgb.b;
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }

    _setFieldValue(channel, value) {
      var fields = this._root.querySelectorAll('[data-channel="' + channel + '"]');
      fields.forEach(function (field) {
        if (document.activeElement === field) return; // don't fight active typing
        field.value = value;
      });
    }

    _syncUI() {
      this._reportValue();
      var rgb = Color.hslToRgb(this._h, this._s, this._l);
      var cmyk = Color.rgbToCmyk(rgb.r, rgb.g, rgb.b);

      if (this._lastDrawnHue !== this._h) {
        this._drawSquare();
        this._lastDrawnHue = this._h;
      }
      this._squareHandle.style.left = this._s + '%';
      this._squareHandle.style.top = (100 - this._l) + '%';

      // Hue wheel handle (polar position around the ring's midline).
      var angleRad = (this._h - 90) * Math.PI / 180; // 0deg (red) at the top, matching the conic-gradient start
      var radiusPct = 40; // ring midline as a % of the wrap's half-width
      this._wheelHandle.style.left = (50 + radiusPct * Math.cos(angleRad)) + '%';
      this._wheelHandle.style.top = (50 + radiusPct * Math.sin(angleRad)) + '%';

      this._syncSlider('h', this._h / 360);
      this._syncSlider('s', this._s / 100);
      this._syncSlider('l', this._l / 100);
      this._syncSlider('a', this._a);
      this._syncSlider('r', rgb.r / 255);
      this._syncSlider('g', rgb.g / 255);
      this._syncSlider('b', rgb.b / 255);
      this._syncSlider('c', cmyk.c / 100);
      this._syncSlider('m', cmyk.m / 100);
      this._syncSlider('y', cmyk.y / 100);
      this._syncSlider('k', cmyk.k / 100);

      this._setSliderGradient('s', 'linear-gradient(to right, hsl(' + this._h + ',0%,' + this._l + '%), hsl(' + this._h + ',100%,' + this._l + '%))');
      this._setSliderGradient('l', 'linear-gradient(to right, #000, hsl(' + this._h + ',' + this._s + '%,50%), #fff)');
      var alphaGrad = this._root.querySelector('.alpha-gradient');
      if (alphaGrad) alphaGrad.style.background = 'linear-gradient(to right, rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0), rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + '))';

      this._setSliderGradient('r', 'linear-gradient(to right, rgb(0,' + rgb.g + ',' + rgb.b + '), rgb(255,' + rgb.g + ',' + rgb.b + '))');
      this._setSliderGradient('g', 'linear-gradient(to right, rgb(' + rgb.r + ',0,' + rgb.b + '), rgb(' + rgb.r + ',255,' + rgb.b + '))');
      this._setSliderGradient('b', 'linear-gradient(to right, rgb(' + rgb.r + ',' + rgb.g + ',0), rgb(' + rgb.r + ',' + rgb.g + ',255))');

      var self = this;
      ['c', 'm', 'y', 'k'].forEach(function (ch) {
        var lowCmyk = Object.assign({}, cmyk); lowCmyk[ch] = 0;
        var highCmyk = Object.assign({}, cmyk); highCmyk[ch] = 100;
        var lowRgb = Color.cmykToRgb(lowCmyk.c, lowCmyk.m, lowCmyk.y, lowCmyk.k);
        var highRgb = Color.cmykToRgb(highCmyk.c, highCmyk.m, highCmyk.y, highCmyk.k);
        self._setSliderGradient(ch, 'linear-gradient(to right, rgb(' + lowRgb.r + ',' + lowRgb.g + ',' + lowRgb.b + '), rgb(' + highRgb.r + ',' + highRgb.g + ',' + highRgb.b + '))');
      });

      this._swatch.style.background = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + this._a + ')';

      this._setFieldValue('h', Math.round(this._h));
      this._setFieldValue('s', Math.round(this._s));
      this._setFieldValue('l', Math.round(this._l));
      this._setFieldValue('a', Math.round(this._a * 100));
      this._setFieldValue('r', rgb.r);
      this._setFieldValue('g', rgb.g);
      this._setFieldValue('b', rgb.b);
      this._setFieldValue('c', cmyk.c);
      this._setFieldValue('m', cmyk.m);
      this._setFieldValue('y', cmyk.y);
      this._setFieldValue('k', cmyk.k);
      this._setFieldValue('hex', Color.toHex(rgb.r, rgb.g, rgb.b, this._a).toUpperCase());
      this._syncA11y(Color.toHex(rgb.r, rgb.g, rgb.b, this._a).toUpperCase());
    }

    _syncSlider(channel, frac) {
      var track = this._root.querySelector('.slider[data-channel="' + channel + '"]');
      if (!track) return;
      var handle = track.querySelector('.slider-handle');
      if (handle) handle.style.left = (clamp(frac, 0, 1) * 100) + '%';
      // Current value for assistive tech (role="slider" requires it).
      var max = parseFloat(track.dataset.max) || 100;
      var now = Math.round(clamp(frac, 0, 1) * max);
      track.setAttribute('aria-valuenow', String(now));
      track.setAttribute('aria-valuetext', now + (CHANNEL_UNITS[channel] || ''));
    }

    // Name/value for the parts that aren't plain channel sliders.
    _syncA11y(hex) {
      var s = Math.round(this._s), l = Math.round(this._l), h = Math.round(this._h);
      this._squareWrap.setAttribute('aria-valuenow', String(s));
      this._squareWrap.setAttribute('aria-valuetext', 'Saturation ' + s + '%, lightness ' + l + '%');
      if (this._wheel) {
        this._wheel.setAttribute('aria-valuenow', String(h));
        this._wheel.setAttribute('aria-valuetext', h + ' degrees');
      }
      var swatchWrap = this._root.querySelector('.swatch-checkerboard');
      if (swatchWrap) swatchWrap.setAttribute('aria-label', 'Selected color ' + hex);
    }

    _setSliderGradient(channel, gradient) {
      var track = this._root.querySelector('.slider[data-channel="' + channel + '"]');
      if (track) track.style.background = gradient;
    }

    // Square (2D: saturation x, lightness y) -----------------------------

    _updateFromSquareEvent(event) {
      var rect = this._squareWrap.getBoundingClientRect();
      var x = clamp(event.clientX - rect.left, 0, rect.width);
      var y = clamp(event.clientY - rect.top, 0, rect.height);
      var s = rect.width ? (x / rect.width) * 100 : 0;
      var l = rect.height ? 100 - (y / rect.height) * 100 : 0;
      this._applyHSL(this._h, s, l, this._a);
    }

    _onSquarePointerDown(event) {
      this._squareDragging = true;
      this._squareWrap.setPointerCapture(event.pointerId);
      this._updateFromSquareEvent(event);
    }

    _onSquarePointerMove(event) {
      if (!this._squareDragging) return;
      this._updateFromSquareEvent(event);
    }

    _onSquarePointerUp() {
      if (!this._squareDragging) return;
      this._squareDragging = false;
      this.emit('change', this._detail());
    }

    _onSquareKeyDown(event) {
      var step = event.shiftKey ? 10 : 1;
      var s = this._s, l = this._l;
      if (event.key === 'ArrowRight') s = clamp(s + step, 0, 100);
      else if (event.key === 'ArrowLeft') s = clamp(s - step, 0, 100);
      else if (event.key === 'ArrowUp') l = clamp(l + step, 0, 100);
      else if (event.key === 'ArrowDown') l = clamp(l - step, 0, 100);
      else return;
      event.preventDefault();
      this._applyHSL(this._h, s, l, this._a);
      this.emit('change', this._detail());
    }

    // Hue wheel ------------------------------------------------------------

    _updateFromWheelEvent(event) {
      var rect = this._wheel.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var angle = Math.atan2(event.clientY - cy, event.clientX - cx) * 180 / Math.PI;
      var hue = ((angle + 90) % 360 + 360) % 360;
      this._applyHSL(hue, this._s, this._l, this._a);
    }

    _onWheelPointerDown(event) {
      this._wheelDragging = true;
      this._wheel.setPointerCapture(event.pointerId);
      this._updateFromWheelEvent(event);
    }

    _onWheelPointerMove(event) {
      if (!this._wheelDragging) return;
      this._updateFromWheelEvent(event);
    }

    _onWheelPointerUp() {
      if (!this._wheelDragging) return;
      this._wheelDragging = false;
      this.emit('change', this._detail());
    }

    _onWheelKeyDown(event) {
      var step = event.shiftKey ? 10 : 1;
      var h = this._h;
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') h += step;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') h -= step;
      else return;
      event.preventDefault();
      this._applyHSL(h, this._s, this._l, this._a);
      this.emit('change', this._detail());
    }

    // Linear sliders (H/S/L/A, R/G/B, C/M/Y/K) -----------------------------

    _updateFromSliderEvent(event) {
      var rect = this._activeTrack.getBoundingClientRect();
      var x = clamp(event.clientX - rect.left, 0, rect.width);
      var frac = rect.width ? x / rect.width : 0;
      this._applyChannelFraction(this._activeChannel, frac);
    }

    _onSliderPointerDown(event) {
      this._activeTrack = event.currentTarget;
      this._activeChannel = this._activeTrack.dataset.channel;
      this._activeTrack.setPointerCapture(event.pointerId);
      this._updateFromSliderEvent(event);
    }

    _onSliderPointerMove(event) {
      if (!this._activeTrack || event.currentTarget !== this._activeTrack) return;
      this._updateFromSliderEvent(event);
    }

    _onSliderPointerUp() {
      if (!this._activeTrack) return;
      this._activeTrack = null;
      this._activeChannel = null;
      this.emit('change', this._detail());
    }

    _onSliderKeyDown(event) {
      var channel = event.currentTarget.dataset.channel;
      var max = parseFloat(event.currentTarget.dataset.max) || 100;
      var step = (event.shiftKey ? 10 : 1) / max;
      var currentFrac;
      if (channel === 'h') currentFrac = this._h / 360;
      else if (channel === 's') currentFrac = this._s / 100;
      else if (channel === 'l') currentFrac = this._l / 100;
      else if (channel === 'a') currentFrac = this._a;
      else if (channel === 'r' || channel === 'g' || channel === 'b') currentFrac = Color.hslToRgb(this._h, this._s, this._l)[channel] / 255;
      else {
        var rgbNow = Color.hslToRgb(this._h, this._s, this._l);
        currentFrac = Color.rgbToCmyk(rgbNow.r, rgbNow.g, rgbNow.b)[channel] / 100;
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') currentFrac = clamp(currentFrac + step, 0, 1);
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') currentFrac = clamp(currentFrac - step, 0, 1);
      else return;
      event.preventDefault();
      this._applyChannelFraction(channel, currentFrac);
      this.emit('change', this._detail());
    }

    // Mode dropdown --------------------------------------------------------

    _onModeChange(event) {
      this._setMode(event.target.value);
    }

    // Numeric / hex fields ------------------------------------------------

    _onFieldInput(event) {
      var channel = event.target && event.target.dataset ? event.target.dataset.channel : null;
      if (!channel) return;

      if (channel === 'hex') {
        var parsed = Color.parse(event.target.value);
        if (parsed) this._applyHSL(parsed.h, parsed.s, parsed.l, parsed.a);
        return;
      }

      var num = parseFloat(event.target.value);
      if (isNaN(num)) return;

      var rgb, hsl, cmyk;
      switch (channel) {
        case 'h': this._applyHSL(num, this._s, this._l, this._a); break;
        case 's': this._applyHSL(this._h, num, this._l, this._a); break;
        case 'l': this._applyHSL(this._h, this._s, num, this._a); break;
        case 'a': this._applyHSL(this._h, this._s, this._l, num / 100); break;
        case 'r': case 'g': case 'b':
          rgb = Color.hslToRgb(this._h, this._s, this._l);
          rgb[channel] = clamp(Math.round(num), 0, 255);
          hsl = Color.rgbToHsl(rgb.r, rgb.g, rgb.b);
          this._applyHSL(hsl.h, hsl.s, hsl.l, this._a);
          break;
        case 'c': case 'm': case 'y': case 'k':
          rgb = Color.hslToRgb(this._h, this._s, this._l);
          cmyk = Color.rgbToCmyk(rgb.r, rgb.g, rgb.b);
          cmyk[channel] = clamp(Math.round(num), 0, 100);
          rgb = Color.cmykToRgb(cmyk.c, cmyk.m, cmyk.y, cmyk.k);
          hsl = Color.rgbToHsl(rgb.r, rgb.g, rgb.b);
          this._applyHSL(hsl.h, hsl.s, hsl.l, this._a);
          break;
      }
    }

    _onFieldChange(event) {
      var channel = event.target && event.target.dataset ? event.target.dataset.channel : null;
      if (!channel) return;
      this.emit('change', this._detail());
    }

    // Form integration -------------------------------------------------

    attributeChangedCallback(name, oldValue, newValue) {
      // Deliberately no super call: the base class re-renders on every
      // attribute change, which this element must avoid.
      if (oldValue === newValue) return;
      this._reportValue();
    }

    get form() { return this._internals ? this._internals.form : null; }
    get name() { return this._strAttr('name', ''); }
    set name(v) { this.setAttribute('name', v); }

    checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
    reportValidity() { return this._internals ? this._internals.reportValidity() : true; }

    // A color is always set, so there is no "missing" state to report;
    // the browser simply leaves the field out when it has no name.
    _reportValue() {
      if (!this._internals || !this._initialized) return;
      this._internals.setFormValue(this.value);
    }

    // form.reset(): back to the value attribute the page started with
    // (white if there was none). Like native inputs, fires no events.
    formResetCallback() {
      var parsed = this._defaultValue ? Color.parse(this._defaultValue) : null;
      if (!parsed) parsed = { h: 0, s: 0, l: 100, a: 1 };
      this._h = parsed.h; this._s = parsed.s; this._l = parsed.l; this._a = parsed.a;
      if (this._picker) this._syncUI();
    }

    // Called for the element's own `disabled` attribute and for a
    // disabled ancestor <fieldset>.
    formDisabledCallback(disabled) {
      if (this._picker) this._picker.inert = disabled;
      if (disabled) this.setAttribute('aria-disabled', 'true');
      else this.removeAttribute('aria-disabled');
    }

    // Back/forward cache and autofill restore.
    formStateRestoreCallback(state) {
      if (typeof state === 'string') this.setValue(state, { silent: true });
    }

    _onEyedropperClick() {
      if (!window.EyeDropper) return;
      var eyeDropper = new window.EyeDropper();
      var self = this;
      eyeDropper.open().then(function (result) {
        var parsed = Color.parse(result.sRGBHex);
        if (parsed) {
          self._applyHSL(parsed.h, parsed.s, parsed.l, self._a);
          self.emit('change', self._detail());
        }
      }).catch(function () { /* user cancelled the eyedropper — ignore */ });
    }
  }

  window.LWT.define('lwtf-color-picker', LWTColorPicker);
})();

/* ---- lwt-frm-date-range.js ---- */
/*!
 * <lwtf-date-range>
 * A booking-site-style date range picker: a compact trigger field that
 * opens a popup with a preset sidebar (Today / Yesterday / Last 7 days /
 * Last 15 days / Last Month / Custom), N side-by-side month calendars
 * with a shared prev/next pager, and an optional time-of-day range
 * slider for each end of the range. Apply commits the pick; clicking
 * outside or Escape discards it.
 *
 *   <!-- basic -->
 *   <lwtf-date-range label="Stay dates"></lwtf-date-range>
 *
 *   <!-- with an initial value, custom month count, bounds -->
 *   <lwtf-date-range label="Stay dates" months="2"
 *     value="2017-05-06,2017-05-22" min="2017-01-01" max="2017-12-31">
 *   </lwtf-date-range>
 *
 *   <!-- with the 00:00–23:59 time-of-day range slider -->
 *   <lwtf-date-range label="Booking window" time></lwtf-date-range>
 *
 *   <script>
 *     var el = document.querySelector('lwtf-date-range');
 *     el.value;                 // -> ["2017-05-06", "2017-05-22"] (or [] if unset)
 *     el.value = ['2017-05-06', '2017-05-22'];
 *     el.addEventListener('lwt-change', function (e) { console.log(e.detail.value); });
 *   </script>
 *
 * ---------------------------------------------------------------------
 * Attributes
 * ---------------------------------------------------------------------
 *   label, helper, error, placeholder — display / form basics
 *   value           — initial "start,end" pair (ISO dates, or ISO
 *                     datetimes like "2017-05-06T00:00" when `time` is
 *                     set); read once at connect (use .value after)
 *   name            — form field name
 *   months          — how many side-by-side calendars to show (default 2)
 *   time            — boolean; adds a 00:00–23:59 time-of-day range
 *                     slider per end, and .value entries become
 *                     "YYYY-MM-DDTHH:MM" instead of plain dates
 *   min, max        — ISO date bounds; days (and month navigation)
 *                     outside this range are disabled
 *   presets         — comma list overriding which preset shortcuts show
 *                     and in what order, from: today, yesterday, last7,
 *                     last15, lastmonth, custom. Default: all of them.
 *   no-presets      — boolean; hides the preset sidebar entirely
 *   required, disabled, readonly — standard form states
 *
 * ---------------------------------------------------------------------
 * Properties / methods
 * ---------------------------------------------------------------------
 *   .value                — get/set array [start, end] (empty array if
 *                            unset). Setting does not open the popup.
 *   .valueAsDates          — read-only [Date, Date] or [null, null]
 *   .setRange(start, end)  — programmatic set; start/end are Date
 *                            objects or ISO strings. {silent:true} to
 *                            skip events.
 *   .clear()               — empty the range
 *   .open() / .close() / .toggle() — popup control
 *   .checkValidity() / .reportValidity()
 *   .focus() / .blur()     — proxied to the trigger field
 *
 * ---------------------------------------------------------------------
 * Events
 * ---------------------------------------------------------------------
 *   lwtf-input   — every draft change while the popup is open (picking
 *                 a day, dragging a time handle); detail: { value }
 *                 (value reflects the in-progress draft, not yet applied)
 *   lwt-change  — Apply pressed (or .value/.setRange() called); detail: { value }
 *   lwt-preset  — a preset shortcut was picked; detail: { preset, value }
 *   lwt-open / lwt-close — popup opened/closed
 *
 * ---------------------------------------------------------------------
 * Form participation
 * ---------------------------------------------------------------------
 * Uses ElementInternals (formAssociated + setFormValue + setValidity) —
 * submits two form entries under `name` (start and end) via FormData,
 * same pattern as <lwtf-transfer-list>/<lwtf-choices multiple>. `required`
 * is satisfied only once both ends of the range are set.
 *
 * Timing note: none needed here — unlike <lwtf-transfer-list>/<lwtf-select>
 * this element has no light-DOM children to parse at connect, so there's
 * nothing for the parser-timing bug (see those files' headers) to bite.
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-frm-date-range.js requires lwt-core.js to be loaded first.');
  }

  var uid = 0;
  var supportsInternals = typeof HTMLElement !== 'undefined' && !!HTMLElement.prototype.attachInternals;

  var DAY_MS = 24 * 60 * 60 * 1000;
  var WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  var MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // Local-midnight Date for (y, m, d) — avoids UTC/local off-by-one drift.
  function makeDate(y, m, d) { return new Date(y, m, d, 0, 0, 0, 0); }

  function stripTime(date) { return makeDate(date.getFullYear(), date.getMonth(), date.getDate()); }

  function sameDay(a, b) {
    return !!a && !!b && a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function isBefore(a, b) { return stripTime(a).getTime() < stripTime(b).getTime(); }
  function isAfter(a, b) { return stripTime(a).getTime() > stripTime(b).getTime(); }
  function clampDate(date, min, max) {
    if (min && isBefore(date, min)) return min;
    if (max && isAfter(date, max)) return max;
    return date;
  }
  function inRange(d, lo, hi) {
    var t = stripTime(d).getTime();
    return t >= stripTime(lo).getTime() && t <= stripTime(hi).getTime();
  }

  // Calendar-day arithmetic (not n * 24h) so daylight-saving changes
  // can't shift the result onto the wrong date.
  function addDays(date, n) { return makeDate(date.getFullYear(), date.getMonth(), date.getDate() + n); }
  function addMonths(y, m, n) {
    var d = new Date(y, m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  }

  function isoDate(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  // Parses "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" -> { date: Date, time: 'HH:MM'|null }
  function parseISO(str) {
    if (!str) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(str).trim());
    if (!m) return null;
    var date = makeDate(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    var time = m[4] ? (pad2(parseInt(m[4], 10)) + ':' + pad2(parseInt(m[5], 10))) : null;
    return { date: date, time: time };
  }

  function formatDisplay(date) {
    return date.getDate() + ' ' + MONTH_LABELS[date.getMonth()].slice(0, 3) + ' ' + date.getFullYear();
  }

  function minutesToLabel(min) { return pad2(Math.floor(min / 60)) + ':' + pad2(min % 60); }
  function labelToMinutes(label) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(label || '').trim());
    if (!m) return 0;
    return Math.min(1439, Math.max(0, parseInt(m[1], 10) * 60 + parseInt(m[2], 10)));
  }

  var ALL_PRESETS = [
    { key: 'today', label: 'Today', range: function (today) { return [today, today]; } },
    { key: 'yesterday', label: 'Yesterday', range: function (today) { var y = addDays(today, -1); return [y, y]; } },
    { key: 'last7', label: 'Last 7 days', range: function (today) { return [addDays(today, -6), today]; } },
    { key: 'last15', label: 'Last 15 days', range: function (today) { return [addDays(today, -14), today]; } },
    { key: 'lastmonth', label: 'Last Month', range: function (today) {
      var prev = addMonths(today.getFullYear(), today.getMonth(), -1);
      var first = makeDate(prev.y, prev.m, 1);
      var last = makeDate(prev.y, prev.m + 1, 0);
      return [first, last];
    } },
    { key: 'custom', label: 'Custom', range: null }
  ];
  var PRESET_BY_KEY = {};
  ALL_PRESETS.forEach(function (p) { PRESET_BY_KEY[p.key] = p; });

  var TEMPLATE =
    '<div class="field-label" part="label">' +
    '  <span class="label-text" part="label-text"></span>' +
    '  <span class="required-mark" part="required">*</span>' +
    '</div>' +
    '<div class="trigger-box" part="trigger" tabindex="0" role="button" aria-haspopup="dialog" aria-expanded="false">' +
    '  <svg class="cal-icon" part="icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
    '    <path fill="currentColor" d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1zM4 9v11h16V9H4z"/>' +
    '  </svg>' +
    '  <span class="trigger-text" part="trigger-text"></span>' +
    '</div>' +
    '<div class="popup" part="popup" role="dialog">' +
    '  <div class="popup-inner">' +
    '    <div class="presets" part="presets"></div>' +
    '    <div class="calendars-pane" part="calendars-pane">' +
    '      <div class="range-heading" part="heading" aria-live="polite"></div>' +
    '      <div class="cal-nav" part="cal-nav">' +
    '        <button type="button" class="nav prev" part="nav-prev" aria-label="Previous month">&#8249;</button>' +
    '        <button type="button" class="nav next" part="nav-next" aria-label="Next month">&#8250;</button>' +
    '      </div>' +
    '      <div class="calendars-row" part="calendars-row"></div>' +
    '      <div class="time-row" part="time-row"></div>' +
    '      <div class="apply-row apply-row-inline" part="apply-row-inline"><button type="button" class="apply-btn" part="apply">Apply</button></div>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="below" part="below">' +
    '  <span class="helper" part="helper"></span>' +
    '</div>';

  var CSS = `
    :host {
      display: inline-block;
      color: inherit;
      font-family: inherit;
      position: relative;
      box-sizing: border-box;
    }
    :host([hidden]) { display: none; }
    * { box-sizing: border-box; }
    .field-label {
      display: flex;
      gap: 0.2rem;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 0.3rem;
      color: var(--lwt-daterange-label-color, var(--lwt-color-text, #111827));
    }
    .field-label:empty, .label-text:empty { display: none; }
    .required-mark { color: var(--lwt-color-danger, #ef4444); display: none; }
    :host([required]) .required-mark { display: inline; }
    :host([required]) .field-label:has(.label-text:empty) .required-mark { display: none; }
    .trigger-box {
      display: inline-flex;
      align-items: center;
      gap: var(--lwt-daterange-gap, var(--lwt-gap, 0.5rem));
      min-width: 220px;
      padding: var(--lwt-daterange-padding, var(--lwt-padding, 0.5rem 0.7rem));
      border-radius: var(--lwt-daterange-radius, var(--lwt-border-radius, 6px));
      cursor: pointer;
      font-size: 0.95rem;
      background: var(--lwt-daterange-bg, var(--lwt-color-surface, #fff));
      border: var(--lwt-daterange-border, var(--lwt-border, 1px solid #d1d5db));
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .trigger-box:focus-visible, .trigger-box.open {
      border-color: var(--lwt-daterange-focus-color, var(--lwt-focus-color, #2563eb));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--lwt-daterange-focus-color, var(--lwt-focus-color, #2563eb)) 22%, transparent);
      outline: none;
    }
    :host([disabled]) .trigger-box {
      opacity: 0.6;
      cursor: not-allowed;
      background: var(--lwt-color-surface-muted, #f3f4f6);
    }
    :host([readonly]) .trigger-box { cursor: default; }
    :host([data-invalid]) .trigger-box {
      border-color: var(--lwt-daterange-error-color, var(--lwt-color-danger, #ef4444));
    }
    .cal-icon { flex-shrink: 0; color: var(--lwt-color-text-muted, #6b7280); }
    .trigger-text {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .trigger-text.placeholder { color: var(--lwt-color-text-muted, #6b7280); }
    .popup {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      z-index: 20;
      display: none;
      background: var(--lwt-daterange-bg, var(--lwt-color-surface, #fff));
      border: 1px solid var(--lwt-color-border-strong, #d1d5db);
      border-radius: var(--lwt-daterange-popup-radius, var(--lwt-border-radius, 8px));
      box-shadow: 0 12px 28px var(--lwt-color-shadow, rgba(0,0,0,0.18));
    }
    .popup.open { display: block; }
    .popup-inner { display: flex; align-items: stretch; }
    .presets {
      display: flex;
      flex-direction: column;
      width: 150px;
      border-right: 1px solid var(--lwt-border-color, #e5e7eb);
      padding: 0.5rem 0;
    }
    :host([no-presets]) .presets { display: none; }
    .preset-btn {
      all: unset;
      box-sizing: border-box;
      padding: 0.6rem 1rem;
      font-size: 0.88rem;
      cursor: pointer;
      color: var(--lwt-color-text, #111827);
    }
    .preset-btn:hover { background: var(--lwt-color-surface-muted, #f3f4f6); }
    .preset-btn.active {
      color: var(--lwt-daterange-accent, var(--lwt-color-primary, #2563eb));
      font-weight: 600;
      background: var(--lwt-daterange-accent-soft, var(--lwt-color-primary-soft, #eff6ff));
    }
    .presets .apply-row { padding: 0.6rem 1rem 0.2rem; }
    .apply-btn {
      all: unset;
      box-sizing: border-box;
      display: block;
      width: 100%;
      text-align: center;
      padding: 0.55rem 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      background: var(--lwt-daterange-accent, var(--lwt-color-primary, #2563eb));
      color: #fff;
    }
    .apply-btn:hover { filter: brightness(1.08); }
    .apply-row-inline { display: none; padding: 0.5rem 1rem 0.75rem; }
    :host([no-presets]) .apply-row-inline { display: block; }
    .calendars-pane { position: relative; padding: 0.85rem 1rem 0.75rem; min-width: 300px; }
    .range-heading {
      text-align: center;
      font-weight: 700;
      font-size: 1rem;
      margin-bottom: 0.6rem;
    }
    .cal-nav {
      position: absolute;
      top: 0.85rem;
      right: 1rem;
      display: flex;
      gap: 0.3rem;
    }
    .nav {
      all: unset;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.6rem;
      height: 1.6rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      background: var(--lwt-daterange-accent, var(--lwt-color-primary, #2563eb));
      color: #fff;
    }
    .nav:hover { filter: brightness(1.08); }
    .nav:disabled { opacity: 0.4; cursor: not-allowed; }
    .calendars-row { display: flex; gap: 1.5rem; }
    .calendar { width: 210px; }
    .cal-title {
      display: block;
      text-align: left;
      font-weight: 700;
      font-size: 0.85rem;
      margin-bottom: 0.4rem;
    }
    .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .cal-weekday {
      text-align: center;
      font-size: 0.72rem;
      color: var(--lwt-color-text-muted, #6b7280);
      padding: 0.2rem 0;
    }
    .day {
      all: unset;
      box-sizing: border-box;
      text-align: center;
      font-size: 0.82rem;
      padding: 0.35rem 0;
      border-radius: 999px;
      cursor: pointer;
      color: var(--lwt-color-text, #111827);
    }
    .day:hover:not(:disabled) { background: var(--lwt-color-surface-muted, #f3f4f6); }
    .day.outside { color: var(--lwt-color-text-muted, #d1d5db); }
    .day:disabled { color: var(--lwt-color-text-muted, #e5e7eb); cursor: not-allowed; }
    .day.in-range {
      border-radius: 0;
      background: var(--lwt-daterange-range-bg, var(--lwt-color-primary-soft, #dbeafe));
    }
    .day.range-start {
      border-radius: 999px 0 0 999px;
      background: var(--lwt-daterange-range-bg, var(--lwt-color-primary-soft, #dbeafe));
    }
    .day.range-end {
      border-radius: 0 999px 999px 0;
      background: var(--lwt-daterange-range-bg, var(--lwt-color-primary-soft, #dbeafe));
    }
    .day.range-start.range-end { border-radius: 999px; }
    .day.range-start .day-num, .day.range-end .day-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.8em;
      height: 1.8em;
      border-radius: 999px;
      background: var(--lwt-daterange-accent, var(--lwt-color-primary, #2563eb));
      color: #fff;
    }
    .time-row {
      display: none;
      margin-top: 0.9rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--lwt-border-color, #e5e7eb);
    }
    :host([time]) .time-row { display: block; }
    .time-track { position: relative; height: 2.2rem; }
    .time-line {
      position: absolute;
      left: 0.7rem;
      right: 0.7rem;
      top: 50%;
      height: 2px;
      transform: translateY(-50%);
      background: var(--lwt-color-border-strong, #d1d5db);
      border-radius: 2px;
    }
    .time-fill {
      position: absolute;
      top: 50%;
      height: 2px;
      transform: translateY(-50%);
      background: var(--lwt-daterange-accent, var(--lwt-color-primary, #2563eb));
      border-radius: 2px;
    }
    .time-range {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      -webkit-appearance: none;
      appearance: none;
      background: transparent;
      pointer-events: none;
    }
    .time-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      pointer-events: auto;
      width: 1.6rem;
      height: 1.6rem;
      border-radius: 999px;
      background: var(--lwt-daterange-accent, var(--lwt-color-primary, #2563eb));
      cursor: pointer;
      margin-top: 0;
    }
    .time-range::-moz-range-thumb {
      pointer-events: auto;
      width: 1.6rem;
      height: 1.6rem;
      border: none;
      border-radius: 999px;
      background: var(--lwt-daterange-accent, var(--lwt-color-primary, #2563eb));
      cursor: pointer;
    }
    .time-range::-webkit-slider-runnable-track { background: transparent; }
    .time-label {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      font-size: 0.68rem;
      font-weight: 700;
      color: #fff;
    }
    .below {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin-top: 0.3rem;
      font-size: 0.78rem;
      min-height: 1rem;
    }
    .helper { flex: 1; color: var(--lwt-daterange-helper-color, var(--lwt-color-text-muted, #6b7280)); }
    .helper.error { color: var(--lwt-daterange-error-color, var(--lwt-color-danger, #ef4444)); }
    .helper:empty { display: none; }
  `;

  class LWTDateRange extends window.LWT.Element {
    static get observedAttributes() {
      return ['label', 'helper', 'error', 'placeholder', 'name', 'months', 'time',
              'min', 'max', 'presets', 'no-presets', 'required', 'disabled', 'readonly', 'aria-label', 'aria-labelledby'];
    }

    constructor() {
      super();

      if (supportsInternals) {
        try { this._internals = this.attachInternals(); }
        catch (e) { this._internals = null; }
      }

      this._initialized = false;
      this._isOpen = false;

      // Committed (applied) value.
      this._start = null;
      this._end = null;
      this._startTime = '00:00';
      this._endTime = '23:59';

      // Draft (in-progress, inside the open popup) value.
      this._draftStart = null;
      this._draftEnd = null;
      this._draftStartTime = '00:00';
      this._draftEndTime = '23:59';
      this._pickingEnd = false;
      this._hoverDate = null;
      this._activePreset = null;

      var today = stripTime(new Date());
      this._viewYear = today.getFullYear();
      this._viewMonth = today.getMonth();

      this._onTriggerClick = this._onTriggerClick.bind(this);
      this._onTriggerKeydown = this._onTriggerKeydown.bind(this);
      this._onDocClick = this._onDocClick.bind(this);
      this._onDocKeydown = this._onDocKeydown.bind(this);
      this._onPrev = this._onPrev.bind(this);
      this._onNext = this._onNext.bind(this);
      this._onApply = this._onApply.bind(this);
      this._onTimeStartInput = this._onTimeStartInput.bind(this);
      this._onTimeEndInput = this._onTimeEndInput.bind(this);
    }

    connectedCallback() {
      super.connectedCallback();
      // Read-only classification attribute — see lwt-frm-choices.js for
      // the convention every lwtf- element follows.
      this.setAttribute('control-type', 'daterange');

      if (!this._initialized) {
        this._initialized = true;
        var parsed = this._parseValueAttr(this._strAttr('value', ''));
        if (parsed) {
          this._start = parsed.start; this._end = parsed.end;
          this._startTime = parsed.startTime; this._endTime = parsed.endTime;
          this._viewYear = this._start.getFullYear();
          this._viewMonth = this._start.getMonth();
        }
        this._syncTrigger();
        this._reportValue();
        this._reportValidity();
      }

      document.addEventListener('mousedown', this._onDocClick);
      document.addEventListener('keydown', this._onDocKeydown);
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      document.removeEventListener('mousedown', this._onDocClick);
      document.removeEventListener('keydown', this._onDocKeydown);
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (!this._trigger) return; // not rendered yet
      if (name === 'months' || name === 'presets' || name === 'no-presets') {
        this._buildPresets();
        if (this._isOpen) this._renderCalendars();
      } else if (name === 'min' || name === 'max') {
        if (this._isOpen) this._renderCalendars();
      } else {
        this._syncAttrs();
      }
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      var root = this._root;
      this._labelEl = root.querySelector('.field-label');
      this._labelText = root.querySelector('.label-text');
      this._trigger = root.querySelector('.trigger-box');
      this._triggerText = root.querySelector('.trigger-text');
      this._popup = root.querySelector('.popup');
      this._presetsEl = root.querySelector('.presets');
      this._headingEl = root.querySelector('.range-heading');
      this._calRow = root.querySelector('.calendars-row');
      this._timeRow = root.querySelector('.time-row');
      this._prevBtn = root.querySelector('.nav.prev');
      this._nextBtn = root.querySelector('.nav.next');
      this._helperEl = root.querySelector('.helper');
      this._inlineApplyBtn = root.querySelector('.apply-row-inline .apply-btn');

      this._id = 'lwt-daterange-' + (++uid);
      this._popup.id = this._id + '-popup';
      this._helperEl.id = this._id + '-helper';
      this._trigger.setAttribute('aria-controls', this._popup.id);
      this._calRow.addEventListener('keydown', this._onCalendarKeydown.bind(this));

      this._trigger.addEventListener('click', this._onTriggerClick);
      this._trigger.addEventListener('keydown', this._onTriggerKeydown);
      this._prevBtn.addEventListener('click', this._onPrev);
      this._nextBtn.addEventListener('click', this._onNext);
      this._inlineApplyBtn.addEventListener('click', this._onApply);
      this._popup.addEventListener('mousedown', function (e) { e.stopPropagation(); });
      this._calRow.addEventListener('mouseleave', (function () {
        if (!this._hoverDate) return;
        this._hoverDate = null;
        this._refreshDayClasses();
      }).bind(this));

      this._buildPresets();
      this._buildTimeRow();
      this._syncAttrs();
    }

    // ---- attribute -> DOM sync ----
    _syncAttrs() {
      var label = this._strAttr('label', '');
      var helper = this._strAttr('helper', '');
      var error = this._strAttr('error', '');
      var required = this._boolAttr('required');
      var disabled = this._boolAttr('disabled');
      var readonly = this._boolAttr('readonly');

      this._labelText.textContent = label;
      this.toggleAttribute('required', required);

      var errorMsg = error || (this._internals && this._internals.validationMessage) || '';
      this._helperEl.textContent = error || helper;
      this._helperEl.classList.toggle('error', !!error);
      this.toggleAttribute('data-invalid', !!error);

      this._trigger.tabIndex = disabled ? -1 : 0;
      this._trigger.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      if (required) this._trigger.setAttribute('aria-required', 'true'); else this._trigger.removeAttribute('aria-required');
      if (error) this._trigger.setAttribute('aria-invalid', 'true'); else this._trigger.removeAttribute('aria-invalid');
      if (error || helper) this._trigger.setAttribute('aria-describedby', this._helperEl.id);
      else this._trigger.removeAttribute('aria-describedby');
      this._popup.setAttribute('aria-label', 'Choose ' + this._a11yName([label], 'Date range', 'Add a label attribute').toLowerCase());
      if (disabled || readonly) this._close();

      this._syncTrigger();
      this._reportValidity();
    }

    _syncTrigger() {
      if (!this._triggerText) return;
      this._syncTriggerName();
      if (this._start && this._end) {
        var text = formatDisplay(this._start) + ' - ' + formatDisplay(this._end);
        if (this._boolAttr('time')) {
          text = formatDisplay(this._start) + ' ' + this._startTime + ' - ' + formatDisplay(this._end) + ' ' + this._endTime;
        }
        this._triggerText.textContent = text;
        this._triggerText.classList.remove('placeholder');
      } else {
        this._triggerText.textContent = this._strAttr('placeholder', 'Select date range');
        this._triggerText.classList.add('placeholder');
      }
      this._syncTriggerName();
    }

    // The trigger is announced as "<label>, <current range>" (or
    // "<label>, no dates selected") -- WCAG 4.1.2 name + value.
    _syncTriggerName() {
      var name = this._a11yName([this._strAttr('label', '')], 'Date range', 'Add a label attribute');
      var value = this._start && this._end ? this._triggerText.textContent : 'no dates selected';
      this._trigger.setAttribute('aria-label', name + ', ' + value);
    }

    // Spoken form of a date, e.g. "Friday, November 6, 2026".
    _spokenDate(date) {
      var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return DAYS[date.getDay()] + ', ' + MONTH_LABELS[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
    }

    // ---- calendar keyboard navigation (roving tabindex) ----
    // One day button is in the Tab order; arrows move by day/week,
    // Home/End to week start/end, PageUp/PageDown by month.
    _focusableDayFor(target) {
      var cells = (this._dayCells || []).filter(function (c) { return !c.outside && !c.el.disabled; });
      if (!cells.length) return null;
      var exact = cells.filter(function (c) { return target && sameDay(c.date, target); })[0];
      return exact || null;
    }

    _syncDayTabStops(preferred) {
      if (!this._dayCells) return null;
      var cells = this._dayCells.filter(function (c) { return !c.outside && !c.el.disabled; });
      var today = stripTime(new Date());
      var pick = (preferred && this._focusableDayFor(preferred)) ||
        this._focusableDayFor(this._draftStart) || this._focusableDayFor(today) || cells[0] || null;
      this._dayCells.forEach(function (c) { c.el.tabIndex = -1; });
      if (pick) pick.el.tabIndex = 0;
      return pick;
    }

    _onCalendarKeydown(e) {
      var cell = (this._dayCells || []).filter(function (c) { return c.el === e.target; })[0];
      if (!cell) return;
      var date = cell.date, next = null;
      switch (e.key) {
        case 'ArrowLeft': next = addDays(date, -1); break;
        case 'ArrowRight': next = addDays(date, 1); break;
        case 'ArrowUp': next = addDays(date, -7); break;
        case 'ArrowDown': next = addDays(date, 7); break;
        case 'Home': next = addDays(date, -date.getDay()); break;
        case 'End': next = addDays(date, 6 - date.getDay()); break;
        case 'PageUp': next = makeDate(date.getFullYear(), date.getMonth() - 1, Math.min(date.getDate(), 28)); break;
        case 'PageDown': next = makeDate(date.getFullYear(), date.getMonth() + 1, Math.min(date.getDate(), 28)); break;
        default: return;
      }
      e.preventDefault();
      var bounds = this._bounds();
      next = clampDate(next, bounds.min, bounds.max);
      if (!this._focusableDayFor(next)) {
        // Off the visible months: page the view so `next` is shown.
        this._viewYear = next.getFullYear();
        this._viewMonth = next.getMonth();
        if (isBefore(next, date)) {
          var back = addMonths(this._viewYear, this._viewMonth, -(this._monthsCount() - 1));
          this._viewYear = back.y; this._viewMonth = back.m;
        }
        this._clampView();
        this._renderCalendars();
      }
      var target = this._syncDayTabStops(next);
      if (target) target.el.focus();
    }

    // ---- presets ----
    _buildPresets() {
      if (this._boolAttr('no-presets')) { this._presetsEl.innerHTML = ''; return; }
      var keys = this._strAttr('presets', '');
      var list = keys
        ? keys.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(function (k) { return PRESET_BY_KEY[k]; })
        : ALL_PRESETS.map(function (p) { return p.key; });

      var self = this;
      this._presetsEl.innerHTML = '';
      list.forEach(function (key) {
        var preset = PRESET_BY_KEY[key];
        var btn = self._genhtml({
          type: 'button',
          attr: { type: 'button', class: 'preset-btn', part: 'preset', 'data-key': key, 'aria-pressed': 'false' },
          text: preset.label,
          events: { click: function () { self._onPresetClick(key); } }
        });
        self._presetsEl.appendChild(btn);
      });
      var applyRow = this._genhtml({ type: 'div', attr: { class: 'apply-row', part: 'apply-row' } });
      var applyBtn = this._genhtml({
        type: 'button',
        attr: { type: 'button', class: 'apply-btn', part: 'apply' },
        text: 'Apply',
        events: { click: this._onApply }
      });
      applyRow.appendChild(applyBtn);
      this._presetsEl.appendChild(applyRow);
    }

    _onPresetClick(key) {
      this._activePreset = key;
      this._highlightPreset();
      var preset = PRESET_BY_KEY[key];
      if (preset.range) {
        var bounds = this._bounds();
        var today = stripTime(new Date());
        var range = preset.range(today);
        // Clamp into min/max: a preset like "Today" can fall outside a
        // narrower bound (e.g. min/max fixed to a past booking window),
        // and without clamping the view would jump to a month that's
        // entirely disabled — including after switching back to Custom,
        // since nothing would ever move the view back into range.
        this._draftStart = clampDate(range[0], bounds.min, bounds.max);
        this._draftEnd = clampDate(range[1], bounds.min, bounds.max);
        this._pickingEnd = false;
        this._viewYear = this._draftStart.getFullYear();
        this._viewMonth = this._draftStart.getMonth();
        this._renderCalendars();
        this._emitDraftInput();
      } else {
        // "custom" — leave any existing draft pick alone, just make sure
        // the visible view is actually inside min/max (a prior preset,
        // or the very first open with no draft yet, could have left it
        // outside), so the calendar isn't all-disabled with no way back.
        this._clampView();
        this._renderCalendars();
      }
      this.emit('preset', { preset: key, value: this._draftValueArray() });
    }

    // Keeps the visible (leftmost) calendar month inside [min, max].
    _clampView() {
      var bounds = this._bounds();
      if (!bounds.min && !bounds.max) return;
      var anchor = makeDate(this._viewYear, this._viewMonth, 1);
      var clamped = clampDate(anchor, bounds.min ? makeDate(bounds.min.getFullYear(), bounds.min.getMonth(), 1) : null,
                                        bounds.max ? makeDate(bounds.max.getFullYear(), bounds.max.getMonth(), 1) : null);
      this._viewYear = clamped.getFullYear();
      this._viewMonth = clamped.getMonth();
    }

    _highlightPreset() {
      var self = this;
      this._presetsEl.querySelectorAll('.preset-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.key === self._activePreset);
        btn.setAttribute('aria-pressed', btn.dataset.key === self._activePreset ? 'true' : 'false');
      });
    }

    // ---- calendars ----
    _monthsCount() {
      var n = parseInt(this._strAttr('months', '2'), 10);
      return (isNaN(n) || n < 1) ? 2 : n;
    }

    _bounds() {
      var min = parseISO(this._strAttr('min', ''));
      var max = parseISO(this._strAttr('max', ''));
      return { min: min ? min.date : null, max: max ? max.date : null };
    }

    _renderCalendars() {
      var self = this;
      var n = this._monthsCount();
      var bounds = this._bounds();
      this._calRow.innerHTML = '';
      // Rebuilt fresh on every real render (open/nav/pick), but NOT on
      // hover — see _onDayHover for why.
      this._dayCells = [];

      for (var i = 0; i < n; i++) {
        var anchor = addMonths(this._viewYear, this._viewMonth, i);
        this._calRow.appendChild(this._buildCalendar(anchor.y, anchor.m, bounds));
      }

      var firstAnchor = addMonths(this._viewYear, this._viewMonth, 0);
      var lastAnchor = addMonths(this._viewYear, this._viewMonth, n - 1);
      // Disable prev once the first calendar is already showing (or is
      // before) the min-bound month; disable next once the last calendar
      // is already showing (or is past) the max-bound month.
      this._prevBtn.disabled = !!(bounds.min &&
        (firstAnchor.y < bounds.min.getFullYear() ||
          (firstAnchor.y === bounds.min.getFullYear() && firstAnchor.m <= bounds.min.getMonth())));
      this._nextBtn.disabled = !!(bounds.max &&
        (lastAnchor.y > bounds.max.getFullYear() ||
          (lastAnchor.y === bounds.max.getFullYear() && lastAnchor.m >= bounds.max.getMonth())));

      var heading = (this._draftStart ? formatDisplay(this._draftStart) : '—') + ' - ' +
        (this._draftEnd ? formatDisplay(this._draftEnd) : '—');
      this._headingEl.textContent = heading;
      this._syncDayTabStops(this._lastFocusedDate);
    }

    _buildCalendar(y, m, bounds) {
      var self = this;
      var cal = this._genhtml({ type: 'div', attr: { class: 'calendar', part: 'calendar', role: 'group', 'aria-label': MONTH_LABELS[m] + ' ' + y } });
      var title = this._genhtml({
        type: 'span',
        attr: { class: 'cal-title', part: 'cal-title', 'aria-hidden': 'true' },
        text: MONTH_LABELS[m].slice(0, 3) + ' \'' + String(y).slice(2)
      });
      cal.appendChild(title);

      var grid = this._genhtml({ type: 'div', attr: { class: 'cal-grid', part: 'cal-grid' } });
      WEEKDAY_LABELS.forEach(function (wd, idx) {
        grid.appendChild(self._genhtml({ type: 'span', attr: { class: 'cal-weekday', part: 'weekday', 'aria-hidden': 'true' }, text: wd, data: { idx: idx } }));
      });

      var firstOfMonth = makeDate(y, m, 1);
      var startWeekday = firstOfMonth.getDay();
      var gridStart = addDays(firstOfMonth, -startWeekday);

      for (var i = 0; i < 42; i++) {
        var date = addDays(gridStart, i);
        grid.appendChild(this._buildDayCell(date, m, bounds));
      }

      cal.appendChild(grid);
      return cal;
    }

    // Computes the day-cell CSS classes for `date` given the current
    // draft/hover state. Shared by the initial build and the hover-only
    // refresh below, so both stay in sync from one place.
    _dayClasses(date, outside) {
      var draftStart = this._draftStart, draftEnd = this._draftEnd;
      var previewEnd = draftEnd || this._hoverDate;
      var isStart = draftStart && sameDay(date, draftStart);
      var isEnd = draftEnd && sameDay(date, draftEnd);
      var isInRange = draftStart && previewEnd && !outside &&
        inRange(date, isBefore(draftStart, previewEnd) ? draftStart : previewEnd,
                      isBefore(draftStart, previewEnd) ? previewEnd : draftStart) &&
        !sameDay(date, draftStart) && !(draftEnd && sameDay(date, draftEnd));

      var classes = ['day'];
      if (outside) classes.push('outside');
      if (isStart) classes.push('range-start');
      if (isEnd) classes.push('range-end');
      if (isInRange) classes.push('in-range');
      return classes;
    }

    _buildDayCell(date, currentMonth, bounds) {
      var self = this;
      var outside = date.getMonth() !== currentMonth;
      var disabled = (bounds.min && isBefore(date, bounds.min)) || (bounds.max && isAfter(date, bounds.max));

      var cell = this._genhtml({
        type: 'button',
        attr: {
          type: 'button',
          class: this._dayClasses(date, outside).join(' '),
          part: 'day',
          'data-date': isoDate(date)
        },
        html: '<span class="day-num">' + date.getDate() + '</span>',
        events: {
          click: function () { self._onDayClick(date); },
          mouseover: function () { self._onDayHover(date); }
        }
      });
      if (disabled) cell.disabled = true;
      // Days from neighbouring months are visual filler: skip them for AT.
      if (outside) { cell.setAttribute('aria-hidden', 'true'); cell.tabIndex = -1; }
      this._labelDayCell(cell, date);
      cell.addEventListener('focus', function () { self._lastFocusedDate = date; });
      this._dayCells.push({ el: cell, date: date, outside: outside });
      return cell;
    }

    _labelDayCell(cell, date) {
      var parts = [this._spokenDate(date)];
      var isStart = this._draftStart && sameDay(date, this._draftStart);
      var isEnd = this._draftEnd && sameDay(date, this._draftEnd);
      if (isStart && isEnd) parts.push('range start and end');
      else if (isStart) parts.push('range start');
      else if (isEnd) parts.push('range end');
      else if (this._draftStart && this._draftEnd && inRange(date, this._draftStart, this._draftEnd)) parts.push('in selected range');
      cell.setAttribute('aria-label', parts.join(', '));
      cell.setAttribute('aria-pressed', (isStart || isEnd) ? 'true' : 'false');
    }

    _onDayClick(date) {
      // Picking re-renders the grid; keep keyboard focus on the picked day.
      var active = this._root.activeElement;
      var hadFocus = !!(active && this._calRow.contains(active));
      if (!this._draftStart || (this._draftStart && this._draftEnd)) {
        this._draftStart = date;
        this._draftEnd = null;
        this._pickingEnd = true;
      } else if (isBefore(date, this._draftStart)) {
        this._draftEnd = this._draftStart;
        this._draftStart = date;
        this._pickingEnd = false;
      } else {
        this._draftEnd = date;
        this._pickingEnd = false;
      }
      this._activePreset = 'custom';
      this._highlightPreset();
      this._lastFocusedDate = date;
      this._renderCalendars();
      if (hadFocus) {
        var cell = this._syncDayTabStops(date);
        if (cell) cell.el.focus();
      }
      this._emitDraftInput();
    }

    // Hover only updates classNames on the *existing* cell buttons — it
    // must never tear down and rebuild the grid (that used to call
    // _renderCalendars() here). Replacing the DOM node under the cursor
    // mid-gesture made the browser drop the click that was about to
    // land on it, so picking a second date silently did nothing.
    _onDayHover(date) {
      if (!this._pickingEnd || sameDay(date, this._hoverDate)) return;
      this._hoverDate = date;
      this._refreshDayClasses();
    }

    _refreshDayClasses() {
      if (!this._dayCells) return;
      for (var i = 0; i < this._dayCells.length; i++) {
        var entry = this._dayCells[i];
        entry.el.className = this._dayClasses(entry.date, entry.outside).join(' ');
      }
    }

    _emitDraftInput() {
      this.emit('input', { value: this._draftValueArray() });
    }

    _draftValueArray() {
      if (!this._draftStart || !this._draftEnd) return [];
      if (this._boolAttr('time')) {
        return [isoDate(this._draftStart) + 'T' + this._draftStartTime, isoDate(this._draftEnd) + 'T' + this._draftEndTime];
      }
      return [isoDate(this._draftStart), isoDate(this._draftEnd)];
    }

    _onPrev() {
      var a = addMonths(this._viewYear, this._viewMonth, -1);
      this._viewYear = a.y; this._viewMonth = a.m;
      this._renderCalendars();
    }
    _onNext() {
      var a = addMonths(this._viewYear, this._viewMonth, 1);
      this._viewYear = a.y; this._viewMonth = a.m;
      this._renderCalendars();
    }

    // ---- time-of-day range slider ----
    _buildTimeRow() {
      var self = this;
      this._timeRow.innerHTML = '';
      var track = this._genhtml({ type: 'div', attr: { class: 'time-track', part: 'time-track' } });
      var line = this._genhtml({ type: 'div', attr: { class: 'time-line' } });
      var fill = this._genhtml({ type: 'div', attr: { class: 'time-fill' } });
      var startInput = this._genhtml({ type: 'input', attr: { type: 'range', class: 'time-range time-start', min: '0', max: '1439', step: '5', 'aria-label': 'Start time' } });
      var endInput = this._genhtml({ type: 'input', attr: { type: 'range', class: 'time-range time-end', min: '0', max: '1439', step: '5', 'aria-label': 'End time' } });
      var startLabel = this._genhtml({ type: 'span', attr: { class: 'time-label' } });
      var endLabel = this._genhtml({ type: 'span', attr: { class: 'time-label' } });

      track.appendChild(line);
      track.appendChild(fill);
      track.appendChild(startInput);
      track.appendChild(endInput);
      track.appendChild(startLabel);
      track.appendChild(endLabel);
      this._timeRow.appendChild(track);

      this._timeStartInput = startInput;
      this._timeEndInput = endInput;
      this._timeStartLabel = startLabel;
      this._timeEndLabel = endLabel;
      this._timeFill = fill;

      startInput.addEventListener('input', this._onTimeStartInput);
      endInput.addEventListener('input', this._onTimeEndInput);
      this._syncTimeRow();
    }

    _onTimeStartInput() {
      var v = parseInt(this._timeStartInput.value, 10);
      var endV = parseInt(this._timeEndInput.value, 10);
      if (v > endV) { v = endV; this._timeStartInput.value = String(v); }
      this._draftStartTime = minutesToLabel(v);
      this._timeStartInput.setAttribute('aria-valuetext', this._draftStartTime);
      this._syncTimeRow();
      this._emitDraftInput();
    }
    _onTimeEndInput() {
      var v = parseInt(this._timeEndInput.value, 10);
      var startV = parseInt(this._timeStartInput.value, 10);
      if (v < startV) { v = startV; this._timeEndInput.value = String(v); }
      this._draftEndTime = minutesToLabel(v);
      this._timeEndInput.setAttribute('aria-valuetext', this._draftEndTime);
      this._syncTimeRow();
      this._emitDraftInput();
    }

    _syncTimeRow() {
      if (!this._timeStartInput) return;
      var startMin = labelToMinutes(this._draftStartTime);
      var endMin = labelToMinutes(this._draftEndTime);
      this._timeStartInput.value = String(startMin);
      this._timeEndInput.value = String(endMin);
      var startPct = (startMin / 1439) * 100;
      var endPct = (endMin / 1439) * 100;
      this._timeFill.style.left = startPct + '%';
      this._timeFill.style.right = (100 - endPct) + '%';
      this._timeStartLabel.style.left = startPct + '%';
      this._timeEndLabel.style.left = endPct + '%';
      this._timeStartLabel.textContent = this._draftStartTime;
      this._timeEndLabel.textContent = this._draftEndTime;
      this._timeStartInput.setAttribute('aria-valuetext', this._draftStartTime);
      this._timeEndInput.setAttribute('aria-valuetext', this._draftEndTime);
      this._timeStartLabel.setAttribute('aria-hidden', 'true');
      this._timeEndLabel.setAttribute('aria-hidden', 'true');
    }

    // ---- popup open/close ----
    _onTriggerClick() { this.toggle(); }
    _onTriggerKeydown(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(); }
      else if (e.key === 'Escape' && this._isOpen) { this._close(); }
    }
    _onDocClick(e) {
      if (!this._isOpen) return;
      if (this.contains ? this.contains(e.target) : false) return;
      var path = e.composedPath ? e.composedPath() : [];
      if (path.indexOf(this) !== -1) return;
      this._close();
    }
    _onDocKeydown(e) {
      if (this._isOpen && e.key === 'Escape') this._close();
    }

    open() {
      if (this._boolAttr('disabled') || this._boolAttr('readonly') || this._isOpen) return;
      this._isOpen = true;
      this._draftStart = this._start; this._draftEnd = this._end;
      this._draftStartTime = this._startTime; this._draftEndTime = this._endTime;
      this._pickingEnd = false;
      this._hoverDate = null;
      this._activePreset = this._start ? null : null;
      if (this._draftStart) { this._viewYear = this._draftStart.getFullYear(); this._viewMonth = this._draftStart.getMonth(); }
      this._clampView();
      this._popup.classList.add('open');
      this._trigger.classList.add('open');
      this._trigger.setAttribute('aria-expanded', 'true');
      this._highlightPreset();
      this._renderCalendars();
      this._syncTimeRow();
      this.emit('open', {});
      // Move focus into the dialog: the selected start day, else today,
      // else the first available day.
      var first = this._syncDayTabStops(this._draftStart);
      if (first) first.el.focus();
    }
    close() { this._close(); }
    _close() {
      if (!this._isOpen) return;
      this._isOpen = false;
      this._popup.classList.remove('open');
      this._trigger.classList.remove('open');
      this._trigger.setAttribute('aria-expanded', 'false');
      // If focus was inside the popup, return it to the trigger.
      var active = this._root.activeElement;
      if (active && active !== this._trigger && this._popup.contains(active)) this._trigger.focus();
      this.emit('close', {});
    }
    toggle() { if (this._isOpen) this._close(); else this.open(); }

    _onApply() {
      this._start = this._draftStart;
      this._end = this._draftEnd;
      this._startTime = this._draftStartTime;
      this._endTime = this._draftEndTime;
      this._syncTrigger();
      this._reportValue();
      this._reportValidity();
      this._close();
      this.emit('change', { value: this.value });
    }

    // ---- value ----
    _parseValueAttr(str) {
      if (!str) return null;
      var parts = String(str).split(',');
      if (parts.length < 2) return null;
      var s = parseISO(parts[0]), e = parseISO(parts[1]);
      if (!s || !e) return null;
      return { start: s.date, end: e.date, startTime: s.time || '00:00', endTime: e.time || '23:59' };
    }

    get value() {
      if (!this._start || !this._end) return [];
      if (this._boolAttr('time')) {
        return [isoDate(this._start) + 'T' + this._startTime, isoDate(this._end) + 'T' + this._endTime];
      }
      return [isoDate(this._start), isoDate(this._end)];
    }
    set value(arr) {
      if (!arr || !arr[0] || !arr[1]) { this.clear(); return; }
      var s = parseISO(arr[0]), e = parseISO(arr[1]);
      if (!s || !e) return;
      this._start = s.date; this._end = e.date;
      this._startTime = s.time || '00:00'; this._endTime = e.time || '23:59';
      this._syncTrigger();
      this._reportValue();
      this._reportValidity();
    }

    get valueAsDates() {
      return [this._start ? new Date(this._start.getTime()) : null, this._end ? new Date(this._end.getTime()) : null];
    }

    setRange(start, end, opts) {
      opts = opts || {};
      var s = start instanceof Date ? stripTime(start) : (parseISO(start) || {}).date;
      var e = end instanceof Date ? stripTime(end) : (parseISO(end) || {}).date;
      if (!s || !e) return;
      this._start = s; this._end = e;
      this._syncTrigger();
      this._reportValue();
      this._reportValidity();
      if (!opts.silent) this.emit('change', { value: this.value });
    }

    clear() {
      this._start = null; this._end = null;
      this._startTime = '00:00'; this._endTime = '23:59';
      this._syncTrigger();
      this._reportValue();
      this._reportValidity();
    }

    focus() { if (this._trigger) this._trigger.focus(); }
    blur() { if (this._trigger) this._trigger.blur(); }

    checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
    reportValidity() { return this._internals ? this._internals.reportValidity() : true; }

    _reportValue() {
      if (!this._internals) return;
      var name = this._strAttr('name', '');
      if (!name || !this._start || !this._end) { this._internals.setFormValue(null); return; }
      if (typeof FormData !== 'undefined') {
        var fd = new FormData();
        var v = this.value;
        fd.append(name, v[0]);
        fd.append(name, v[1]);
        this._internals.setFormValue(fd);
      } else {
        this._internals.setFormValue(this.value.join(','));
      }
    }

    _reportValidity() {
      if (!this._internals) return;
      var required = this._boolAttr('required');
      if (required && (!this._start || !this._end)) {
        this._internals.setValidity({ valueMissing: true }, 'Please select a date range.', this._trigger);
      } else {
        this._internals.setValidity({});
      }
    }
  }

  LWTDateRange.formAssociated = true;
  window.LWT.define('lwtf-date-range', LWTDateRange);
})();

/* ---- lwt-frm-input.js ---- */
/*!
 * <lwtf-input>
 * A themed text-style input covering every single-line HTML input type
 * except radio, checkbox, file and color (those get their own elements).
 * For the text-like types it can grow into a full lookup / combobox when
 * you hand it an `options` array. Follows the ARIA combobox pattern so
 * screen readers announce the popup correctly, and hover-tooltips on each
 * option can render arbitrary HTML — so a lookup entry can include images,
 * small previews, formatted descriptions, whatever.
 *
 *   <!-- plain text input -->
 *   <lwtf-input label="Full name" placeholder="Jane Doe" required></lwtf-input>
 *
 *   <!-- other native types: date / number / tel / time / month / week -->
 *   <lwtf-input type="date" label="Start date"></lwtf-input>
 *   <lwtf-input type="number" label="Quantity" min="1" max="10" step="1"></lwtf-input>
 *   <lwtf-input type="tel" label="Phone"></lwtf-input>
 *
 *   <!-- combobox: array of strings (text-like types only) -->
 *   <lwtf-input label="Fruit" strict></lwtf-input>
 *   <script>
 *     document.querySelector('lwtf-input').options = ['Apple', 'Banana', 'Cherry'];
 *   </script>
 *
 *   <!-- combobox: array of objects, with per-option HTML tooltip -->
 *   <lwtf-input label="Character"></lwtf-input>
 *   <script>
 *     document.querySelector('lwtf-input').options = [
 *       { value: 'gandalf', label: 'Gandalf',
 *         html: '<img src="gandalf.jpg" style="width:120px"><p>Grey then White</p>' },
 *       { value: 'aragorn', label: 'Aragorn',
 *         html: '<img src="aragorn.jpg" style="width:120px"><p>Heir of Isildur</p>' }
 *     ];
 *   </script>
 *
 * When `options` is set the input's browser autocomplete/history is
 * disabled automatically (autocomplete="off", autocorrect/spellcheck off)
 * so the native suggestions don't fight the popup.
 *
 * ---------------------------------------------------------------------
 * Attributes
 * ---------------------------------------------------------------------
 *   label, helper, error, placeholder, name — display / form basics
 *   value          — initial value; read once at connect (use .value after)
 *   type           — "text" (default), "email", "tel", "url", "search",
 *                    "password", "number", "date", "month", "week", "time".
 *                    Password gets a show/hide toggle. NOT supported here:
 *                    radio, checkbox, file, color — those have their own
 *                    dedicated elements.
 *   required, disabled, readonly — standard form states
 *   pattern, minlength, maxlength — native validation (surfaced through
 *                    ElementInternals for form participation). minlength/
 *                    maxlength/pattern only apply to text-like types.
 *   min, max, step  — native range for number/date/month/week/time
 *   autocomplete    — passes through to the native input when options
 *                    aren't set (forced to "off" when they are)
 *   strict          — boolean; combobox only (text-like types). Value must
 *                    match one of the options — on blur, non-matching text
 *                    reverts to the last valid value.
 *   max-visible     — max option rows visible before the dropdown scrolls
 *                    (default 8)
 *   show-counter    — boolean; force the "N / max" counter to show even
 *                    without maxlength (uses maxlength if present, else
 *                    just shows N). Text-like types only.
 *
 * Combobox (`options`), `strict` and the length counter only apply to the
 * text-like types: text, email, tel, search, url. Setting `options` on any
 * other type is a no-op — the popup never opens and native pickers/steppers
 * (date, number, etc.) are left alone to do their own thing.
 *
 * ---------------------------------------------------------------------
 * Slots
 * ---------------------------------------------------------------------
 *   icon-leading   — anything (inline SVG, emoji, character); shown at
 *                    the field's left edge
 *   icon-trailing  — same, shown at the right, next to any built-in
 *                    controls (clear button / password toggle)
 *
 * ---------------------------------------------------------------------
 * Properties / methods
 * ---------------------------------------------------------------------
 *   .value                     — get/set the current string
 *   .options                   — get/set the lookup array (strings or
 *                                {value,label,html?,disabled?} objects).
 *                                Setting it swaps into combobox mode
 *                                (text-like types only).
 *   .checkValidity()           — matches native form control validity
 *   .reportValidity()          — same, plus surfaces the error
 *   .clear()                   — empty the field (fires lwtf-input/clear)
 *   .focus() / .blur()         — proxied to the internal <input>
 *
 * ---------------------------------------------------------------------
 * Events
 * ---------------------------------------------------------------------
 *   lwtf-input   — every keystroke; detail: { value }
 *   lwt-change  — commit (blur / Enter); detail: { value }
 *   lwtf-select  — option picked from dropdown; detail: { value, option }
 *   lwt-clear   — clear button pressed
 *
 * ---------------------------------------------------------------------
 * Form participation
 * ---------------------------------------------------------------------
 * Uses the ElementInternals API (formAssociated + setFormValue +
 * setValidity), so <lwtf-input name="…"> inside a <form> submits its value
 * like a native <input>. Validity constraints (required, pattern,
 * minlength, maxlength, min, max, step, plus strict-mode "not in list")
 * are surfaced to the form so form.checkValidity() returns the right
 * answer. When ElementInternals isn't available (older browsers) the
 * element still works, it just doesn't participate in <form> submission.
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-frm-input.js requires lwt-core.js to be loaded first.');
  }

  var uid = 0;

  // Types that support the combobox/lookup popup, strict-match and the
  // length counter. Everything else (number/date/month/week/time) relies
  // on its own native picker/stepper and shouldn't fight it with a popup.
  var TEXT_LIKE_TYPES = { text: 1, email: 1, tel: 1, search: 1, url: 1, password: 1 };
  var COMBOBOX_TYPES = { text: 1, email: 1, tel: 1, search: 1, url: 1 };
  var VALID_TYPES = { text: 1, email: 1, tel: 1, url: 1, search: 1, password: 1,
                       number: 1, date: 1, month: 1, week: 1, time: 1 };

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Escapes text for use inside a regex source, then wraps in a case-
  // insensitive match so we can highlight it in an option label.
  function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizeOption(opt) {
    if (opt == null) return null;
    if (typeof opt === 'string' || typeof opt === 'number') {
      var s = String(opt);
      return { value: s, label: s, html: '', disabled: false };
    }
    var label = opt.label != null ? String(opt.label) : (opt.value != null ? String(opt.value) : '');
    return {
      value: opt.value != null ? String(opt.value) : label,
      label: label,
      html: opt.html || '',
      disabled: !!opt.disabled
    };
  }

  var CSS = `
    :host { display: block; font-family: inherit; color: var(--lwt-input-color, var(--lwt-color-text, #1f2937)); }
    :host([hidden]) { display: none; }
    .field-label {
      display: block;
      font-size: 0.82rem;
      font-weight: 600;
      margin-bottom: 0.35rem;
      color: var(--lwt-input-label-color, var(--lwt-color-text, #374151));
    }
    .required-mark { color: var(--lwt-input-required-color, var(--lwt-color-danger, #ef4444)); margin-left: 0.15rem; }
    .wrap { position: relative; }
    .field-box {
      position: relative;
      display: flex;
      align-items: center;
      box-sizing: border-box;
      width: 100%;
      min-height: 2.4rem;
      padding: var(--lwt-input-padding, 0 0.6rem);
      gap: var(--lwt-input-gap, 0.4rem);
      border-radius: var(--lwt-input-radius, var(--lwt-border-radius, 6px));
      background: var(--lwt-input-bg, var(--lwt-color-surface, #fff));
      border: var(--lwt-input-border, var(--lwt-border, 1px solid #d1d5db));
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .field-box:focus-within {
      border-color: var(--lwt-input-focus-color, var(--lwt-focus-color, #2563eb));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--lwt-input-focus-color, var(--lwt-focus-color, #2563eb)) 22%, transparent);
    }
    :host([disabled]) .field-box {
      opacity: 0.6;
      cursor: not-allowed;
      background: var(--lwt-color-surface-muted, #f3f4f6);
    }
    :host([data-invalid]) .field-box { border-color: var(--lwt-input-error-color, var(--lwt-color-danger, #ef4444)); }
    :host([data-invalid]) .field-box:focus-within {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--lwt-input-error-color, var(--lwt-color-danger, #ef4444)) 22%, transparent);
    }
    .field {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      padding: 0.5rem 0;
      font: inherit;
      font-size: 0.95rem;
      color: inherit;
    }
    .field::placeholder { color: var(--lwt-color-text-muted, #6b7280); }
    .field:disabled { cursor: not-allowed; }
    .icon-slot {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--lwt-color-text-muted, #6b7280);
    }
    .icon-slot.hidden { display: none; }
    .icon-slot ::slotted(*) { width: 1.05rem; height: 1.05rem; display: block; }
    .built-in-btn {
      flex-shrink: 0;
      display: none;
      align-items: center;
      justify-content: center;
      width: 1.6rem;
      height: 1.6rem;
      border: none;
      background: none;
      padding: 0;
      margin: 0;
      border-radius: 4px;
      cursor: pointer;
      color: var(--lwt-color-text-muted, #6b7280);
    }
    .built-in-btn:hover { color: var(--lwt-color-text, #374151); background: var(--lwt-color-surface-alt, #f3f4f6); }
    .built-in-btn:focus-visible { outline: 2px solid var(--lwt-focus-color, #2563eb); outline-offset: 1px; }
    .built-in-btn.visible { display: inline-flex; }
    .built-in-btn svg { width: 1rem; height: 1rem; }
    .below {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin-top: 0.3rem;
      font-size: 0.78rem;
      min-height: 1rem;
    }
    .helper { flex: 1; color: var(--lwt-input-helper-color, var(--lwt-color-text-muted, #6b7280)); }
    .helper.error { color: var(--lwt-input-error-color, var(--lwt-color-danger, #ef4444)); }
    .counter { flex-shrink: 0; color: var(--lwt-color-text-muted, #6b7280); font-variant-numeric: tabular-nums; }
    .counter.over { color: var(--lwt-input-error-color, var(--lwt-color-danger, #ef4444)); }
    .listbox {
      position: absolute;
      left: 0;
      right: 0;
      top: calc(100% + 4px);
      z-index: 10;
      overflow: auto;
      background: var(--lwt-input-bg, var(--lwt-color-surface, #fff));
      border: 1px solid var(--lwt-color-border-strong, #d1d5db);
      border-radius: var(--lwt-input-radius, var(--lwt-border-radius, 6px));
      box-shadow: 0 8px 20px var(--lwt-color-shadow, rgba(0,0,0,0.15));
      padding: 0.25rem 0;
      margin: 0;
      list-style: none;
      display: none;
    }
    .listbox.open { display: block; }
    .option {
      display: flex;
      align-items: center;
      padding: 0.45rem 0.75rem;
      cursor: pointer;
      font-size: 0.9rem;
    }
    .option[aria-selected="true"] {
      background: var(--lwt-color-primary-soft, #eff6ff);
      color: var(--lwt-color-primary, #2563eb);
    }
    .option[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; }
    .option .match { font-weight: 700; color: var(--lwt-color-primary, #2563eb); }
    .option[aria-selected="true"] .match { color: inherit; }
    .empty {
      padding: 0.75rem;
      color: var(--lwt-color-text-muted, #6b7280);
      font-size: 0.85rem;
      text-align: center;
      font-style: italic;
    }
    .tooltip {
      position: absolute;
      z-index: 11;
      max-width: 260px;
      background: var(--lwt-color-surface, #fff);
      color: var(--lwt-color-text, #1f2937);
      border: 1px solid var(--lwt-border-color, #e5e7eb);
      border-radius: var(--lwt-input-radius, var(--lwt-border-radius, 8px));
      box-shadow: 0 8px 20px var(--lwt-color-shadow, rgba(0,0,0,0.15));
      padding: 0.6rem 0.7rem;
      font-size: 0.85rem;
      line-height: 1.4;
      display: none;
      pointer-events: none;
    }
    .tooltip.open { display: block; }
    .tooltip img { max-width: 100%; height: auto; display: block; }
    .tooltip *:first-child { margin-top: 0; }
    .tooltip *:last-child { margin-bottom: 0; }
  `;

  var EYE_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a19.66 19.66 0 0 1 4.22-5.06"/>' +
    '<path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a19.66 19.66 0 0 1-3.53 4.53"/>' +
    '<line x1="1" y1="1" x2="23" y2="23"/></svg>';
  var CLEAR_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  var TEMPLATE =
    '<label class="field-label" part="label"><span class="label-text"></span><span class="required-mark" hidden>*</span></label>' +
    '<div class="wrap" part="wrap">' +
    '  <div class="field-box" part="field-box">' +
    '    <span class="icon-slot leading hidden" part="icon-leading"><slot name="icon-leading"></slot></span>' +
    '    <input class="field" part="input" autocomplete="off">' +
    '    <button type="button" class="built-in-btn clear-btn" part="clear-btn" tabindex="-1" aria-label="Clear">' + CLEAR_SVG + '</button>' +
    '    <button type="button" class="built-in-btn pw-btn" part="password-toggle" aria-label="Show password" aria-pressed="false">' + EYE_SVG + '</button>' +
    '    <span class="icon-slot trailing hidden" part="icon-trailing"><slot name="icon-trailing"></slot></span>' +
    '  </div>' +
    '  <ul class="listbox" part="listbox" role="listbox"></ul>' +
    '  <div class="tooltip" part="tooltip"></div>' +
    '</div>' +
    '<div class="below" part="below"><div class="helper" part="helper"></div><div class="counter" part="counter" hidden></div></div>';

  var supportsInternals = typeof HTMLElement.prototype.attachInternals === 'function';

  class LWTInput extends window.LWT.Element {
    static get formAssociated() { return true; }

    static get observedAttributes() {
      return ['label', 'helper', 'error', 'placeholder', 'value', 'type', 'name',
              'required', 'disabled', 'readonly', 'pattern', 'minlength', 'maxlength',
              'min', 'max', 'step', 'autocomplete', 'strict', 'max-visible', 'show-counter',
              'aria-label', 'aria-labelledby'];
    }

    constructor() {
      super();

      if (supportsInternals) {
        try { this._internals = this.attachInternals(); }
        catch (e) { this._internals = null; }
      }

      this._options = [];
      this._filtered = [];
      this._activeIndex = -1;
      this._isOpen = false;
      this._passwordVisible = false;
      this._initialized = false;
      this._value = '';
      this._lastValid = '';    // for strict-mode revert on blur

      this._onInput = this._onInput.bind(this);
      this._onFocus = this._onFocus.bind(this);
      this._onBlur = this._onBlur.bind(this);
      this._onKeydown = this._onKeydown.bind(this);
      this._onClearClick = this._onClearClick.bind(this);
      this._onPwToggle = this._onPwToggle.bind(this);
      this._onListboxMouseover = this._onListboxMouseover.bind(this);
      this._onListboxMouseleave = this._onListboxMouseleave.bind(this);
      this._onListboxClick = this._onListboxClick.bind(this);
      this._onDocClick = this._onDocClick.bind(this);
    }

    connectedCallback() {
      super.connectedCallback();

      if (!this._initialized) {
        this._initialized = true;
        this._value = this._strAttr('value', '');
        this._lastValid = this._value;
        this._input.value = this._value;
        this._reportValue();
      }

      document.addEventListener('mousedown', this._onDocClick);
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      document.removeEventListener('mousedown', this._onDocClick);
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      // Value attribute is one-time (see file header). Other attributes
      // just need the reactive sync in _syncAttrs, no full re-render.
      if (this._input) this._syncAttrs();
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      var root = this._root;
      this._labelEl = root.querySelector('.field-label');
      this._labelText = root.querySelector('.label-text');
      this._requiredMark = root.querySelector('.required-mark');
      this._input = root.querySelector('.field');
      this._helperEl = root.querySelector('.helper');
      this._counterEl = root.querySelector('.counter');
      this._clearBtn = root.querySelector('.clear-btn');
      this._pwBtn = root.querySelector('.pw-btn');
      this._leadingIcon = root.querySelector('.icon-slot.leading');
      this._trailingIcon = root.querySelector('.icon-slot.trailing');
      this._listbox = root.querySelector('.listbox');
      this._tooltip = root.querySelector('.tooltip');

      // stable id so aria-controls/labelledby work
      this._id = 'lwt-input-' + (++uid);
      this._input.id = this._id + '-input';
      this._listbox.id = this._id + '-listbox';
      this._labelEl.setAttribute('for', this._input.id);
      this._helperEl.id = this._id + '-helper';
      this._counterEl.id = this._id + '-counter';

      this._input.addEventListener('input', this._onInput);
      this._input.addEventListener('focus', this._onFocus);
      this._input.addEventListener('blur', this._onBlur);
      this._input.addEventListener('keydown', this._onKeydown);
      this._clearBtn.addEventListener('click', this._onClearClick);
      this._pwBtn.addEventListener('click', this._onPwToggle);
      this._listbox.addEventListener('mouseover', this._onListboxMouseover);
      this._listbox.addEventListener('mouseleave', this._onListboxMouseleave);
      this._listbox.addEventListener('mousedown', function (e) { e.preventDefault(); }); // don't blur field
      this._listbox.addEventListener('click', this._onListboxClick);

      // Watch the two icon slots so we hide the wrapper when nothing is slotted.
      var leadingSlot = this._leadingIcon.querySelector('slot');
      var trailingSlot = this._trailingIcon.querySelector('slot');
      var self = this;
      var syncIcons = function () {
        self._leadingIcon.classList.toggle('hidden', !leadingSlot.assignedNodes().length);
        self._trailingIcon.classList.toggle('hidden', !trailingSlot.assignedNodes().length);
      };
      leadingSlot.addEventListener('slotchange', syncIcons);
      trailingSlot.addEventListener('slotchange', syncIcons);
      syncIcons();

      this._syncAttrs();
    }

    // ---- attribute → DOM sync (called from render + attributeChangedCallback) ----
    _syncAttrs() {
      var input = this._input;
      var label = this._strAttr('label', '');
      var helper = this._strAttr('helper', '');
      var error = this._strAttr('error', '');
      var placeholder = this._strAttr('placeholder', '');
      var type = this._strAttr('type', 'text');
      if (!VALID_TYPES[type]) type = 'text';
      // Read-only classification attribute, distinct from `type` above
      // (which already carries this element's own text/email/date/...
      // configuration) — see lwt-frm-choices.js for the convention every
      // lwtf- element follows, under a name that can't collide with an
      // attribute an element already uses for something else.
      this.setAttribute('control-type', type);
      var name = this._strAttr('name', '');
      var required = this._boolAttr('required');
      var disabled = this._boolAttr('disabled');
      var readonly = this._boolAttr('readonly');
      var isTextLike = !!TEXT_LIKE_TYPES[type];
      var pattern = isTextLike ? this._strAttr('pattern', '') : '';
      var minlength = isTextLike ? this._strAttr('minlength', '') : '';
      var maxlength = isTextLike ? this._strAttr('maxlength', '') : '';
      var min = this._strAttr('min', '');
      var max = this._strAttr('max', '');
      var step = this._strAttr('step', '');
      var autocomplete = this._strAttr('autocomplete', '');

      this._labelText.textContent = label;
      this._labelEl.style.display = label ? '' : 'none';
      this._requiredMark.hidden = !required;

      // Accessible name. A visible label wins; without one, fall back to
      // the host's aria-label, the placeholder, a humanized name="", then
      // the input type -- and tell the developer (WCAG 3.3.2 / 4.1.2).
      var hostLabel = this._hostLabel();
      if (label && !hostLabel) {
        input.removeAttribute('aria-label');
      } else {
        var TYPE_NAMES = { email: 'Email address', tel: 'Phone number', url: 'Web address', search: 'Search',
          password: 'Password', number: 'Number', date: 'Date', month: 'Month', week: 'Week', time: 'Time' };
        input.setAttribute('aria-label', this._a11yName([placeholder, window.LWT.a11y.humanize(name)],
          TYPE_NAMES[type] || 'Text field', 'Add a label attribute'));
      }
      this._listbox.setAttribute('aria-label', (label || input.getAttribute('aria-label') || 'Options') + ' suggestions');

      // type — password toggle only meaningful for type=password.
      // If the user has clicked the eye, actual DOM type is 'text'; the
      // logical type stays 'password' for our own logic (validation, etc.).
      this._logicalType = type;
      var effectiveType = (type === 'password' && this._passwordVisible) ? 'text' : type;
      input.type = effectiveType;
      input.placeholder = placeholder;
      if (name) input.name = name; else input.removeAttribute('name');
      input.required = required;
      input.disabled = disabled;
      input.readOnly = readonly;
      if (pattern) input.setAttribute('pattern', pattern); else input.removeAttribute('pattern');
      if (minlength) input.setAttribute('minlength', minlength); else input.removeAttribute('minlength');
      if (maxlength) input.setAttribute('maxlength', maxlength); else input.removeAttribute('maxlength');
      if (min) input.setAttribute('min', min); else input.removeAttribute('min');
      if (max) input.setAttribute('max', max); else input.removeAttribute('max');
      if (step) input.setAttribute('step', step); else input.removeAttribute('step');

      // Combobox (options/strict/dropdown) only applies to text-like types.
      // Switching to e.g. type="date" while options were set just parks
      // them — they're ignored until the type goes back to a text-like one.
      var comboboxAllowed = !!COMBOBOX_TYPES[type];
      var hasOptions = comboboxAllowed && this._options.length > 0;
      if (!comboboxAllowed && this._isOpen) this._closeDropdown();

      // Force autocomplete off when we own the popup, so the browser's
      // native suggestions don't fight ours.
      input.autocomplete = hasOptions ? 'off' : (autocomplete || 'on');
      if (hasOptions) {
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('autocapitalize', 'off');
        input.setAttribute('spellcheck', 'false');
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-controls', this._listbox.id);
        input.setAttribute('aria-expanded', this._isOpen ? 'true' : 'false');
      } else {
        input.removeAttribute('autocorrect');
        input.removeAttribute('autocapitalize');
        input.removeAttribute('spellcheck');
        input.removeAttribute('role');
        input.removeAttribute('aria-autocomplete');
        input.removeAttribute('aria-controls');
        input.removeAttribute('aria-expanded');
        input.removeAttribute('aria-activedescendant');
      }

      // password toggle visibility
      this._pwBtn.classList.toggle('visible', type === 'password' && !disabled && !readonly);

      // helper / error text
      var errorMsg = error;
      if (errorMsg) {
        this._helperEl.classList.add('error');
        this._helperEl.textContent = errorMsg;
      } else {
        this._helperEl.classList.remove('error');
        this._helperEl.textContent = helper;
      }
      this.toggleAttribute('data-invalid', !!errorMsg);
      if (errorMsg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');

      this._syncClearBtn();
      this._syncCounter();
      this._syncDescribedBy();
      this._reportValidity();
    }

    // Helper/error text and the character counter describe the field.
    _syncDescribedBy() {
      var ids = [];
      if (this._helperEl.textContent) ids.push(this._helperEl.id);
      if (!this._counterEl.hidden) ids.push(this._counterEl.id);
      if (ids.length) this._input.setAttribute('aria-describedby', ids.join(' '));
      else this._input.removeAttribute('aria-describedby');
    }

    _syncClearBtn() {
      var show = !!this._value && !this._boolAttr('disabled') && !this._boolAttr('readonly');
      this._clearBtn.classList.toggle('visible', show);
    }

    _syncCounter() {
      // The counter (character count) only makes sense for text-like types.
      if (!TEXT_LIKE_TYPES[this._logicalType]) {
        this._counterEl.hidden = true;
        return;
      }
      var maxlength = parseInt(this._strAttr('maxlength', ''), 10);
      var showCounter = this._boolAttr('show-counter') || !isNaN(maxlength);
      if (!showCounter) {
        this._counterEl.hidden = true;
        return;
      }
      this._counterEl.hidden = false;
      var current = this._value.length;
      this._counterEl.textContent = isNaN(maxlength) ? String(current) : (current + ' / ' + maxlength);
      this._counterEl.classList.toggle('over', !isNaN(maxlength) && current > maxlength);
    }

    // ---- public API ----

    get value() { return this._value; }
    set value(v) {
      v = v == null ? '' : String(v);
      this._value = v;
      if (this._input) this._input.value = v;
      this._lastValid = this._matchesOption(v) || !this._boolAttr('strict') || this._options.length === 0 ? v : this._lastValid;
      this._syncClearBtn();
      this._syncCounter();
      this._reportValue();
      this._reportValidity();
    }

    get options() { return this._options.slice(); }
    set options(arr) {
      this._options = (Array.isArray(arr) ? arr : []).map(normalizeOption).filter(Boolean);
      this._syncAttrs();  // autocomplete-off / role=combobox depend on this
      if (this._isOpen) this._renderList();
    }

    clear() {
      if (this._boolAttr('disabled') || this._boolAttr('readonly')) return;
      this._value = '';
      this._input.value = '';
      this._syncClearBtn();
      this._syncCounter();
      this._reportValue();
      this._reportValidity();
      this.emit('clear', {});
      this.emit('input', { value: '' });
      this._input.focus();
    }

    focus() { if (this._input) this._input.focus(); }
    blur() { if (this._input) this._input.blur(); }

    checkValidity() {
      return this._internals ? this._internals.checkValidity() : this._input.checkValidity();
    }
    reportValidity() {
      return this._internals ? this._internals.reportValidity() : this._input.reportValidity();
    }

    // ---- internal event handlers ----

    _onInput() {
      this._value = this._input.value;
      this._syncClearBtn();
      this._syncCounter();
      this._reportValue();
      this._reportValidity();
      this.emit('input', { value: this._value });

      if (COMBOBOX_TYPES[this._logicalType] && this._options.length) {
        this._openDropdown();
      }
    }

    _onFocus() {
      if (COMBOBOX_TYPES[this._logicalType] && this._options.length) this._openDropdown();
    }

    _onBlur() {
      // Delay: mousedown on an option fires before blur, and mousedown
      // there calls preventDefault so the field never loses focus in that
      // path. But a real blur (Tab, outside click) should close the popup.
      var self = this;
      setTimeout(function () {
        if (document.activeElement !== self._input && !self._contains(document.activeElement)) {
          self._closeDropdown();

          // Strict-mode enforcement: if value doesn't match any option,
          // revert to the last valid one.
          if (COMBOBOX_TYPES[self._logicalType] && self._boolAttr('strict') && self._options.length && !self._matchesOption(self._value)) {
            self._value = self._lastValid;
            self._input.value = self._lastValid;
            self._syncClearBtn();
            self._syncCounter();
            self._reportValue();
            self._reportValidity();
          }

          self.emit('change', { value: self._value });
        }
      }, 0);
    }

    _onKeydown(e) {
      var hasOptions = COMBOBOX_TYPES[this._logicalType] && this._options.length > 0;

      if (e.key === 'Enter') {
        if (this._isOpen && this._activeIndex >= 0) {
          e.preventDefault();
          this._selectByIndex(this._activeIndex);
        } else {
          this.emit('change', { value: this._value });
        }
        return;
      }

      if (e.key === 'Escape') {
        if (this._isOpen) {
          e.preventDefault();
          this._closeDropdown();
        }
        return;
      }

      if (!hasOptions) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!this._isOpen) { this._openDropdown(); return; }
        this._moveActive(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!this._isOpen) { this._openDropdown(); return; }
        this._moveActive(-1);
      } else if (e.key === 'Home' && this._isOpen) {
        e.preventDefault();
        this._setActiveIndex(0);
      } else if (e.key === 'End' && this._isOpen) {
        e.preventDefault();
        this._setActiveIndex(this._filtered.length - 1);
      } else if (e.key === 'Tab') {
        // Let Tab close the popup and continue naturally.
        this._closeDropdown();
      }
    }

    _onClearClick(e) {
      e.preventDefault();
      this.clear();
    }

    _onPwToggle(e) {
      e.preventDefault();
      this._passwordVisible = !this._passwordVisible;
      this._input.type = this._passwordVisible ? 'text' : 'password';
      this._pwBtn.innerHTML = this._passwordVisible ? EYE_OFF_SVG : EYE_SVG;
      this._pwBtn.setAttribute('aria-label', this._passwordVisible ? 'Hide password' : 'Show password');
      this._pwBtn.setAttribute('aria-pressed', this._passwordVisible ? 'true' : 'false');
      this._input.focus();
    }

    _onListboxMouseover(e) {
      var target = e.target && e.target.closest ? e.target.closest('.option') : null;
      if (!target) return;
      var idx = parseInt(target.getAttribute('data-idx'), 10);
      if (isNaN(idx)) return;
      this._setActiveIndex(idx, true);
    }

    _onListboxMouseleave() {
      this._hideTooltip();
    }

    _onListboxClick(e) {
      var target = e.target && e.target.closest ? e.target.closest('.option') : null;
      if (!target) return;
      var idx = parseInt(target.getAttribute('data-idx'), 10);
      if (isNaN(idx)) return;
      this._selectByIndex(idx);
    }

    _onDocClick(e) {
      // Close when clicking outside the whole element (light DOM path
      // covers the shadow root — composedPath crosses the boundary).
      var path = e.composedPath ? e.composedPath() : [];
      if (path.indexOf(this) === -1) this._closeDropdown();
    }

    _contains(node) {
      if (!node) return false;
      var path = node.getRootNode && node.getRootNode() === this._root;
      return path || this.contains(node);
    }

    // ---- dropdown mechanics ----

    _openDropdown() {
      if (!COMBOBOX_TYPES[this._logicalType] || !this._options.length) return;
      this._isOpen = true;
      this._listbox.classList.add('open');
      this._input.setAttribute('aria-expanded', 'true');
      this._renderList();
    }

    _closeDropdown() {
      if (!this._isOpen) return;
      this._isOpen = false;
      this._listbox.classList.remove('open');
      this._hideTooltip();
      this._activeIndex = -1;
      this._input.setAttribute('aria-expanded', 'false');
      this._input.removeAttribute('aria-activedescendant');
    }

    _renderList() {
      var query = this._value.toLowerCase();
      this._filtered = query
        ? this._options.filter(function (o) { return o.label.toLowerCase().indexOf(query) !== -1; })
        : this._options.slice();

      var maxVisible = parseInt(this._strAttr('max-visible', '8'), 10);
      if (isNaN(maxVisible) || maxVisible <= 0) maxVisible = 8;
      this._listbox.style.maxHeight = (maxVisible * 2.1) + 'rem';

      if (!this._filtered.length) {
        this._listbox.innerHTML = '<li class="empty" part="empty">No matches</li>';
        this._activeIndex = -1;
        return;
      }

      var self = this;
      var matcher = query ? new RegExp('(' + escapeRegex(query) + ')', 'ig') : null;
      var html = this._filtered.map(function (opt, i) {
        var safeLabel = escapeHtml(opt.label);
        var display = matcher
          ? safeLabel.replace(matcher, '<span class="match">$1</span>')
          : safeLabel;
        var attrs = 'class="option" role="option" data-idx="' + i + '" id="' + self._id + '-opt-' + i + '"' +
          (opt.disabled ? ' aria-disabled="true"' : '') +
          ' aria-selected="false"';
        return '<li ' + attrs + '>' + display + '</li>';
      }).join('');
      this._listbox.innerHTML = html;

      // Pre-select the first non-disabled row so keyboard nav has somewhere to start.
      var firstIdx = -1;
      for (var i = 0; i < this._filtered.length; i++) {
        if (!this._filtered[i].disabled) { firstIdx = i; break; }
      }
      this._setActiveIndex(firstIdx, false);
    }

    _setActiveIndex(idx, showTooltip) {
      // Clear previous
      var prev = this._listbox.querySelector('.option[aria-selected="true"]');
      if (prev) prev.setAttribute('aria-selected', 'false');

      if (idx < 0 || idx >= this._filtered.length) {
        this._activeIndex = -1;
        this._input.removeAttribute('aria-activedescendant');
        this._hideTooltip();
        return;
      }
      this._activeIndex = idx;
      var el = this._listbox.querySelector('.option[data-idx="' + idx + '"]');
      if (!el) return;
      el.setAttribute('aria-selected', 'true');
      this._input.setAttribute('aria-activedescendant', el.id);

      // Scroll into view within the listbox (not the whole page).
      var lb = this._listbox;
      var elTop = el.offsetTop, elBottom = elTop + el.offsetHeight;
      if (elTop < lb.scrollTop) lb.scrollTop = elTop;
      else if (elBottom > lb.scrollTop + lb.clientHeight) lb.scrollTop = elBottom - lb.clientHeight;

      var opt = this._filtered[idx];
      if (opt && opt.html) this._showTooltip(el, opt.html);
      else this._hideTooltip();
    }

    _moveActive(delta) {
      if (!this._filtered.length) return;
      var idx = this._activeIndex;
      // Skip disabled entries.
      for (var step = 0; step < this._filtered.length; step++) {
        idx = (idx + delta + this._filtered.length) % this._filtered.length;
        if (!this._filtered[idx].disabled) break;
      }
      this._setActiveIndex(idx, true);
    }

    _selectByIndex(idx) {
      var opt = this._filtered[idx];
      if (!opt || opt.disabled) return;
      this._value = opt.label;
      this._lastValid = opt.label;
      this._input.value = opt.label;
      this._syncClearBtn();
      this._syncCounter();
      this._reportValue();
      this._reportValidity();
      this._closeDropdown();
      this.emit('select', { value: opt.value, option: opt });
      this.emit('input', { value: this._value });
      this.emit('change', { value: this._value });
    }

    _matchesOption(v) {
      var target = String(v).toLowerCase();
      return this._options.some(function (o) { return o.label.toLowerCase() === target; });
    }

    // ---- tooltip ----

    _showTooltip(anchorEl, html) {
      this._tooltip.innerHTML = html;  // intentional: this is the HTML tooltip
      this._tooltip.classList.add('open');

      // Position preference: right of the listbox, aligned to the hovered
      // option's top. If that clips the right edge, flip to the left. If
      // *neither* side fits (very narrow viewport / mobile), fall back to
      // placing it directly below the anchor, then clamp horizontally.
      // Vertical position is always clamped so the tooltip stays fully in
      // view even for tall content.
      var wrap = this._listbox.parentElement;
      var lbRect = this._listbox.getBoundingClientRect();
      var anchorRect = anchorEl.getBoundingClientRect();
      var wrapRect = wrap.getBoundingClientRect();
      var tipRect = this._tooltip.getBoundingClientRect();
      var tipW = tipRect.width;
      var tipH = tipRect.height;

      var GAP = 6;
      var VP_PAD = 8;  // keep at least this many px from viewport edges
      var vpW = window.innerWidth;
      var vpH = window.innerHeight;

      // ---- horizontal: right → left → below ----
      var absLeft;
      var rightSlot = lbRect.right + GAP;
      var leftSlot = lbRect.left - GAP - tipW;
      if (rightSlot + tipW <= vpW - VP_PAD) {
        absLeft = rightSlot;                                       // fits on the right
      } else if (leftSlot >= VP_PAD) {
        absLeft = leftSlot;                                        // fits on the left
      } else {
        // Neither side works. Center under the anchor and clamp.
        absLeft = anchorRect.left + (anchorRect.width - tipW) / 2;
      }
      absLeft = Math.max(VP_PAD, Math.min(vpW - tipW - VP_PAD, absLeft));

      // ---- vertical: aligned to anchor top, clamped in-view ----
      var absTop = anchorRect.top;
      absTop = Math.max(VP_PAD, Math.min(vpH - tipH - VP_PAD, absTop));

      // Convert viewport coords → wrap-relative for the absolutely-positioned tooltip.
      this._tooltip.style.top = (absTop - wrapRect.top) + 'px';
      this._tooltip.style.left = (absLeft - wrapRect.left) + 'px';
    }

    _hideTooltip() {
      this._tooltip.classList.remove('open');
      this._tooltip.innerHTML = '';
    }

    // ---- form-association + validity ----

    _reportValue() {
      if (this._internals) this._internals.setFormValue(this._value);
    }

    _reportValidity() {
      if (!this._internals) return;
      var input = this._input;
      var validity = input.validity;
      var flags = {};
      var msg = '';
      if (validity.valueMissing) { flags.valueMissing = true; msg = 'This field is required.'; }
      else if (validity.typeMismatch) { flags.typeMismatch = true; msg = 'Enter a valid ' + this._logicalType + '.'; }
      else if (validity.patternMismatch) { flags.patternMismatch = true; msg = 'Value does not match the expected format.'; }
      else if (validity.tooShort) { flags.tooShort = true; msg = 'Value is too short.'; }
      else if (validity.tooLong) { flags.tooLong = true; msg = 'Value is too long.'; }
      else if (validity.rangeUnderflow) { flags.rangeUnderflow = true; msg = 'Value is below the minimum.'; }
      else if (validity.rangeOverflow) { flags.rangeOverflow = true; msg = 'Value is above the maximum.'; }
      else if (validity.stepMismatch) { flags.stepMismatch = true; msg = 'Value doesn\'t fit the required step.'; }
      else if (COMBOBOX_TYPES[this._logicalType] && this._boolAttr('strict') && this._options.length && this._value && !this._matchesOption(this._value)) {
        flags.customError = true; msg = 'Value must be one of the options.';
      }

      if (Object.keys(flags).length === 0) {
        this._internals.setValidity({});
      } else {
        this._internals.setValidity(flags, msg, input);
      }
    }
  }

  window.LWT.define('lwtf-input', LWTInput);
})();

/* ---- lwt-frm-otp.js ---- */
/*!
 * <lwtf-otp>
 * A split-box verification code input (one-time-password / 2FA style):
 * one native single-character box per digit, auto-advancing focus as
 * you type, backspace stepping back, arrow-key navigation, and full
 * paste support (paste a whole code into any box and it spreads across
 * the rest). Also wires up a hidden autocomplete="one-time-code" input
 * so mobile browsers/OS-level SMS autofill can fill the whole code at
 * once.
 *
 *   <!-- basic: 6 digit boxes -->
 *   <lwtf-otp label="Verify" helper="Your code was sent to you via email"></lwtf-otp>
 *
 *   <!-- custom length, alphanumeric codes -->
 *   <lwtf-otp length="4" type="alphanumeric"></lwtf-otp>
 *
 *   <script>
 *     var el = document.querySelector('lwtf-otp');
 *     el.value;                 // -> "123566" (partial codes just come back short)
 *     el.value = '123566';
 *     el.addEventListener('lwt-complete', function (e) {
 *       console.log('code ready:', e.detail.value);
 *     });
 *   </script>
 *
 * ---------------------------------------------------------------------
 * Attributes
 * ---------------------------------------------------------------------
 *   label, helper, error — display / form basics
 *   value           — initial code; read once at connect (use .value after)
 *   length          — number of boxes (default 6)
 *   type            — "numeric" (default; numeric keypad, digits only) |
 *                      "alphanumeric" (letters + digits)
 *   name, required, disabled, readonly — standard form states
 *   auto-focus      — boolean; focuses the first empty box as soon as
 *                      the element connects
 *
 * ---------------------------------------------------------------------
 * Properties / methods
 * ---------------------------------------------------------------------
 *   .value            — get/set the code as a plain string (get returns
 *                        whatever's filled in, even if incomplete; set
 *                        distributes characters across the boxes same
 *                        as a paste, ignoring characters past `length`)
 *   .clear()          — empty every box (fires lwtf-input)
 *   .focus()          — focuses the first empty box (or the last box if
 *                        the code is already complete)
 *   .blur()           — blurs whichever box currently has focus
 *   .checkValidity() / .reportValidity()
 *
 * ---------------------------------------------------------------------
 * Events
 * ---------------------------------------------------------------------
 *   lwtf-input     — every box change; detail: { value }
 *   lwt-change    — a box loses focus with the value having changed
 *                    since the field group was last focused; detail: { value }
 *   lwt-complete  — fires once, the instant every box becomes filled;
 *                    detail: { value }. Fires again if the code is
 *                    cleared/edited and refilled to complete a second time.
 *
 * ---------------------------------------------------------------------
 * Form participation
 * ---------------------------------------------------------------------
 * Uses ElementInternals (formAssociated + setFormValue + setValidity), so
 * <lwtf-otp name="…"> inside a <form> submits its value like a native
 * <input>. `required` is satisfied only once every box is filled.
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-frm-otp.js requires lwt-core.js to be loaded first.');
  }

  var uid = 0;
  var supportsInternals = typeof HTMLElement !== 'undefined' && !!HTMLElement.prototype.attachInternals;

  var CHAR_PATTERNS = {
    numeric: /[0-9]/,
    alphanumeric: /[a-zA-Z0-9]/
  };

  var TEMPLATE =
    '<div class="field-label" part="label">' +
    '  <span class="label-text" part="label-text"></span>' +
    '  <span class="required-mark" part="required">*</span>' +
    '</div>' +
    '<div class="boxes" part="boxes" role="group"></div>' +
    // Off-screen helper that lets mobile OSes autofill an SMS code. Hidden
    // from assistive tech AND out of the Tab order (aria-hidden content
    // must never be focusable).
    '<input class="autofill-input" part="autofill-input" type="text" inputmode="numeric" ' +
    '  autocomplete="one-time-code" aria-hidden="true" tabindex="-1">' +
    '<div class="below" part="below">' +
    '  <span class="helper" part="helper"></span>' +
    '</div>';

  var CSS = `
    :host {
      display: inline-block;
      color: inherit;
      font-family: inherit;
      box-sizing: border-box;
    }
    :host([hidden]) { display: none; }
    * { box-sizing: border-box; }
    .field-label {
      display: flex;
      gap: 0.2rem;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 0.4rem;
      color: var(--lwt-otp-label-color, var(--lwt-color-text, #111827));
    }
    .field-label:empty, .label-text:empty { display: none; }
    .required-mark { color: var(--lwt-color-danger, #ef4444); display: none; }
    :host([required]) .required-mark { display: inline; }
    .boxes { display: flex; gap: var(--lwt-otp-gap, var(--lwt-gap, 0.6rem)); }
    .otp-box {
      width: var(--lwt-otp-box-width, 2.6rem);
      height: var(--lwt-otp-box-height, 2.9rem);
      text-align: center;
      font-size: 1.4rem;
      font-weight: 600;
      border-radius: var(--lwt-otp-radius, var(--lwt-border-radius, 8px));
      padding: 0;
      font: inherit;
      color: var(--lwt-otp-color, var(--lwt-color-text, #111827));
      background: var(--lwt-otp-bg, var(--lwt-color-surface, #fff));
      border: var(--lwt-otp-border, var(--lwt-border, 1px solid #d1d5db));
      transition: border-color 120ms ease, box-shadow 120ms ease;
      caret-color: transparent;
    }
    .otp-box:focus {
      outline: none;
      border-color: var(--lwt-otp-focus-color, var(--lwt-focus-color, #2563eb));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--lwt-otp-focus-color, var(--lwt-focus-color, #2563eb)) 22%, transparent);
    }
    .otp-box.filled { border-color: var(--lwt-otp-filled-border, var(--lwt-color-border-strong, #9ca3af)); }
    :host([disabled]) .otp-box {
      opacity: 0.6;
      cursor: not-allowed;
      background: var(--lwt-color-surface-muted, #f3f4f6);
    }
    :host([readonly]) .otp-box { cursor: default; }
    :host([data-invalid]) .otp-box { border-color: var(--lwt-otp-error-color, var(--lwt-color-danger, #ef4444)); }
    .autofill-input {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0,0,0,0);
      white-space: nowrap;
      border: 0;
    }
    .below {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin-top: 0.4rem;
      font-size: 0.78rem;
      min-height: 1rem;
    }
    .helper { flex: 1; color: var(--lwt-otp-helper-color, var(--lwt-color-text-muted, #6b7280)); }
    .helper.error { color: var(--lwt-otp-error-color, var(--lwt-color-danger, #ef4444)); }
    .helper:empty { display: none; }
  `;

  class LWTOtp extends window.LWT.Element {
    static get observedAttributes() {
      return ['label', 'helper', 'error', 'length', 'type', 'name', 'required', 'disabled', 'readonly', 'auto-focus', 'aria-label', 'aria-labelledby'];
    }

    constructor() {
      super();

      if (supportsInternals) {
        try { this._internals = this.attachInternals(); }
        catch (e) { this._internals = null; }
      }

      this._initialized = false;
      this._chars = [];         // one entry per box, '' when empty
      this._lastCommitted = ''; // for lwt-change dedupe on blur
      this._wasComplete = false; // for lwt-complete edge-triggering

      this._onDocClick = this._onDocClick.bind(this);
      this._onAutofillInput = this._onAutofillInput.bind(this);
    }

    connectedCallback() {
      super.connectedCallback();
      // Read-only classification attribute — see lwt-frm-choices.js for
      // the convention every lwtf- element follows.
      this.setAttribute('control-type', 'otp');

      if (!this._initialized) {
        this._initialized = true;
        var initial = this._strAttr('value', '');
        if (initial) this._distribute(initial, 0, { silent: true });
        this._lastCommitted = this.value;
        this._wasComplete = this._isComplete();
        this._reportValue();
        this._reportValidity();
        if (this._boolAttr('auto-focus')) this.focus();
      }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (!this._boxesEl) return; // not rendered yet
      if (name === 'length' || name === 'type') {
        this._rebuildBoxes();
      } else {
        this._syncAttrs();
      }
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      var root = this._root;
      this._labelEl = root.querySelector('.field-label');
      this._labelText = root.querySelector('.label-text');
      this._boxesEl = root.querySelector('.boxes');
      this._helperEl = root.querySelector('.helper');
      this._autofillInput = root.querySelector('.autofill-input');

      this._id = 'lwt-otp-' + (++uid);
      this._labelText.id = this._id + '-label';
      this._helperEl.id = this._id + '-helper';
      this._autofillInput.addEventListener('input', this._onAutofillInput);

      this._rebuildBoxes();
      this._syncAttrs();
    }

    // ---- box construction ----
    _length() {
      var n = parseInt(this._strAttr('length', '6'), 10);
      return (isNaN(n) || n < 1) ? 6 : n;
    }

    _charType() {
      var t = this._strAttr('type', 'numeric');
      return CHAR_PATTERNS[t] ? t : 'numeric';
    }

    _rebuildBoxes() {
      var self = this;
      var n = this._length();
      var existing = this._chars.slice(0, n);
      while (existing.length < n) existing.push('');
      this._chars = existing;

      var numeric = this._charType() === 'numeric';
      this._boxesEl.innerHTML = '';
      this._boxEls = [];

      for (var i = 0; i < n; i++) {
        var box = this._genhtml({
          type: 'input',
          attr: {
            type: 'text',
            inputmode: numeric ? 'numeric' : 'text',
            pattern: numeric ? '[0-9]*' : undefined,
            maxlength: '1',
            autocomplete: 'off',
            autocorrect: 'off',
            autocapitalize: 'off',
            spellcheck: 'false',
            class: 'otp-box',
            part: 'box',
            'data-idx': String(i),
            'aria-label': 'Digit ' + (i + 1) + ' of ' + n
          },
          events: {
            input: function (e) { self._onBoxInput(e); },
            keydown: function (e) { self._onBoxKeydown(e); },
            focus: function (e) { e.target.select(); },
            blur: function (e) { self._onBoxBlur(e); },
            paste: function (e) { self._onBoxPaste(e); }
          }
        });
        // `undefined` attrs (pattern on alphanumeric) slip through
        // _genhtml's setAttribute as the string "undefined" — strip it.
        if (!numeric) box.removeAttribute('pattern');
        box.value = this._chars[i] || '';
        box.id = this._id + '-box-' + i;
        this._boxesEl.appendChild(box);
        this._boxEls.push(box);
      }
      this._syncBoxValues();
    }

    _syncBoxValues() {
      for (var i = 0; i < this._boxEls.length; i++) {
        this._boxEls[i].value = this._chars[i] || '';
        this._boxEls[i].classList.toggle('filled', !!this._chars[i]);
      }
    }

    // ---- attribute -> DOM sync ----
    _syncAttrs() {
      var label = this._strAttr('label', '');
      var helper = this._strAttr('helper', '');
      var error = this._strAttr('error', '');
      var disabled = this._boolAttr('disabled');
      var readonly = this._boolAttr('readonly');

      this._labelText.textContent = label;
      this._helperEl.textContent = error || helper;
      this._helperEl.classList.toggle('error', !!error);
      this.toggleAttribute('data-invalid', !!error);

      // The boxes form one named group ("Verification code" if unlabelled),
      // described by the helper/error text.
      var hostLabel = this._hostLabel();
      if (label && !hostLabel) {
        this._boxesEl.setAttribute('aria-labelledby', this._labelText.id);
        this._boxesEl.removeAttribute('aria-label');
      } else {
        this._boxesEl.removeAttribute('aria-labelledby');
        this._boxesEl.setAttribute('aria-label', this._a11yName([], 'Verification code', 'Add a label attribute'));
      }
      if (error || helper) this._boxesEl.setAttribute('aria-describedby', this._helperEl.id);
      else this._boxesEl.removeAttribute('aria-describedby');

      this._boxEls.forEach(function (box) {
        box.disabled = disabled;
        box.readOnly = readonly;
        box.tabIndex = disabled ? -1 : 0;
        if (error) box.setAttribute('aria-invalid', 'true'); else box.removeAttribute('aria-invalid');
      });
      this._autofillInput.disabled = disabled;
      this._reportValidity();
    }

    // ---- typing ----
    _charPattern() { return CHAR_PATTERNS[this._charType()]; }

    _onBoxInput(e) {
      var box = e.target;
      var idx = parseInt(box.dataset.idx, 10);
      var raw = box.value;

      // A full paste can land here too on some browsers/IMEs instead of
      // firing a 'paste' event (e.g. Android Gboard autofill chips) — if
      // more than one character showed up, treat it like a paste.
      if (raw.length > 1) {
        this._distribute(raw, idx);
        return;
      }

      var pattern = this._charPattern();
      var ch = raw && pattern.test(raw) ? raw : '';
      this._chars[idx] = ch;
      box.value = ch;
      box.classList.toggle('filled', !!ch);

      if (ch && idx < this._boxEls.length - 1) {
        this._boxEls[idx + 1].focus();
      }

      this._emitInput();
      this._checkComplete();
    }

    _onBoxKeydown(e) {
      var box = e.target;
      var idx = parseInt(box.dataset.idx, 10);

      if (e.key === 'Backspace') {
        if (box.value) {
          // Let the native delete happen; 'input' handler clears state.
          return;
        }
        e.preventDefault();
        if (idx > 0) {
          var prev = this._boxEls[idx - 1];
          this._chars[idx - 1] = '';
          prev.value = '';
          prev.classList.remove('filled');
          prev.focus();
          this._emitInput();
          this._checkComplete();
        }
      } else if (e.key === 'ArrowLeft') {
        if (idx > 0) { e.preventDefault(); this._boxEls[idx - 1].focus(); }
      } else if (e.key === 'ArrowRight') {
        if (idx < this._boxEls.length - 1) { e.preventDefault(); this._boxEls[idx + 1].focus(); }
      } else if (e.key === 'Delete') {
        e.preventDefault();
        this._chars[idx] = '';
        box.value = '';
        box.classList.remove('filled');
        this._emitInput();
        this._checkComplete();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !this._charPattern().test(e.key)) {
        // Reject characters that don't match the configured type
        // (e.g. a letter typed into a numeric box) before they land.
        e.preventDefault();
      }
    }

    _onBoxPaste(e) {
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text');
      var idx = parseInt(e.target.dataset.idx, 10);
      this._distribute(text, idx);
    }

    _onAutofillInput() {
      var text = this._autofillInput.value;
      if (!text) return;
      this._distribute(text, 0);
      this._autofillInput.value = '';
    }

    // Spreads `text`'s valid characters across boxes starting at `startIdx`,
    // overwriting whatever was there. Used by paste, the hidden
    // autocomplete="one-time-code" input, multi-char 'input' events, and
    // the .value setter.
    _distribute(text, startIdx, opts) {
      opts = opts || {};
      var pattern = this._charPattern();
      var clean = String(text).split('').filter(function (c) { return pattern.test(c); });
      var i = startIdx;
      var used = 0;
      while (i < this._chars.length && used < clean.length) {
        this._chars[i] = clean[used];
        used++; i++;
      }
      this._syncBoxValues();

      var focusIdx = Math.min(i, this._boxEls.length - 1);
      if (this._boxEls[focusIdx]) this._boxEls[focusIdx].focus();

      if (!opts.silent) {
        this._emitInput();
        this._checkComplete();
      }
    }

    _onBoxBlur() {
      var self = this;
      // Defer so focus has already landed on whatever's next (another
      // box, or outside the element) before deciding whether the whole
      // group lost focus.
      setTimeout(function () {
        var active = self._root.activeElement;
        var stillInside = self._boxEls.indexOf(active) !== -1;
        if (stillInside) return;
        var current = self.value;
        if (current !== self._lastCommitted) {
          self._lastCommitted = current;
          self._reportValue();
          self._reportValidity();
          self.emit('change', { value: current });
        }
      }, 0);
    }

    _onDocClick() { /* reserved */ }

    _emitInput() {
      this._reportValue();
      this.emit('input', { value: this.value });
    }

    _isComplete() {
      return this._chars.length > 0 && this._chars.every(function (c) { return c !== ''; });
    }

    _checkComplete() {
      var complete = this._isComplete();
      if (complete && !this._wasComplete) {
        this.emit('complete', { value: this.value });
      }
      this._wasComplete = complete;
      this._reportValidity();
    }

    // ---- value ----
    get value() { return this._chars.join(''); }
    set value(str) {
      this._chars = this._chars.map(function () { return ''; });
      if (str) this._distribute(str, 0, { silent: true });
      this._syncBoxValues();
      this._lastCommitted = this.value;
      this._wasComplete = this._isComplete();
      this._reportValue();
      this._reportValidity();
    }

    clear() {
      this._chars = this._chars.map(function () { return ''; });
      this._syncBoxValues();
      this._wasComplete = false;
      this._emitInput();
      this._reportValidity();
      if (this._boxEls[0]) this._boxEls[0].focus();
    }

    focus() {
      var firstEmpty = this._chars.indexOf('');
      var idx = firstEmpty === -1 ? this._boxEls.length - 1 : firstEmpty;
      if (this._boxEls[idx]) this._boxEls[idx].focus();
    }
    blur() {
      var active = this._root.activeElement;
      if (active && this._boxEls.indexOf(active) !== -1) active.blur();
    }

    checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
    reportValidity() { return this._internals ? this._internals.reportValidity() : true; }

    _reportValue() {
      if (!this._internals) return;
      var name = this._strAttr('name', '');
      if (!name) { this._internals.setFormValue(null); return; }
      this._internals.setFormValue(this.value);
    }

    _reportValidity() {
      if (!this._internals) return;
      var required = this._boolAttr('required');
      if (required && !this._isComplete()) {
        this._internals.setValidity({ valueMissing: true }, 'Please enter the full code.', this._boxEls[0]);
      } else {
        this._internals.setValidity({});
      }
    }
  }

  LWTOtp.formAssociated = true;
  window.LWT.define('lwtf-otp', LWTOtp);
})();

/* ---- lwt-frm-select.js ---- */
/*!
 * <lwtf-select>
 * A combobox that supports both single- and multi-select, with rich HTML
 * options and rich HTML per-option tooltips (an image, a color swatch,
 * whatever markup you want). Selections always render as removable tag
 * chips inside the field — single-select is just multi-select capped at
 * one tag, which is what makes an option's rich content (an icon, a
 * color square) show up for the *selected* state too, not only in the
 * dropdown: a plain <input> can't hold HTML as its value, so a bare-text
 * "selected" display would have thrown away exactly the richness this
 * element exists for.
 *
 *   <!-- markup: rich label + rich (image) tooltip -->
 *   <lwtf-select label="City" placeholder="Search cities…" multiple>
 *     <lwtf-select-option value="ams">Amsterdam
 *       <template slot="tooltip"><img src="amsterdam.jpg" style="width:160px"></template>
 *     </lwtf-select-option>
 *     <lwtf-select-option value="ber">Berlin</lwtf-select-option>
 *     <lwtf-select-option value="ath" disabled>Athens</lwtf-select-option>
 *   </lwtf-select>
 *
 *   <!-- markup: rich (non-text) label, e.g. a color swatch -->
 *   <lwtf-select label="Color" placeholder="Search colors…">
 *     <lwtf-select-option value="#C0E6FF">
 *       <span class="swatch" style="background:#C0E6FF"></span> Blue 10 (#C0E6FF)
 *     </lwtf-select-option>
 *   </lwtf-select>
 *
 *   <!-- or built entirely from JS -->
 *   <lwtf-select id="city" label="City" multiple></lwtf-select>
 *   <script>
 *     var el = document.getElementById('city');
 *     el.options = [
 *       { value: 'ams', label: 'Amsterdam', html: '<img src="amsterdam.jpg" style="width:160px">' },
 *       { value: 'ber', label: 'Berlin', selected: true },
 *       { value: 'ath', label: 'Athens', disabled: true }
 *     ];
 *     el.value;                 // -> ['ber']
 *     el.value = ['ams', 'ber']; // select both, replacing whatever was selected
 *   </script>
 *
 * A <lwtf-select-option>'s content IS its rich label (any HTML). A
 * <template slot="tooltip"> nested inside it — likewise any HTML — is
 * shown on hover in the dropdown; the same `html` field does the same
 * job in the .options/.addOption() JS API. Both are read once, at
 * connect (or lazily, if the parser hasn't inserted them yet — see the
 * MutationObserver note below); use the JS API afterward.
 *
 * ---------------------------------------------------------------------
 * Attributes
 * ---------------------------------------------------------------------
 *   label, helper, error, placeholder, name  — display / form basics
 *   multiple        — boolean; allow more than one tag. Without it,
 *                      picking a new option replaces the existing tag.
 *   max-selections  — integer; caps how many tags `multiple` allows.
 *                      Ignored without `multiple`.
 *   max-visible     — max dropdown rows visible before it scrolls
 *                      (default 8)
 *   required, disabled, readonly — standard form states
 *
 * ---------------------------------------------------------------------
 * Properties / methods
 * ---------------------------------------------------------------------
 *   .value                  — get/set the array of selected values
 *                              (ALWAYS an array, 0..n entries, even in
 *                              single-select mode). Setting clamps to
 *                              one entry when `multiple` isn't set.
 *   .options                 — get/set the full option list. Getter
 *                              returns [{value, label, disabled, selected,
 *                              html}] (html = tooltip HTML). Setter
 *                              REPLACES every option, including anything
 *                              pre-rendered in markup, and re-derives the
 *                              selection from each entry's `selected`.
 *   .addOption(opt)           — appends one option from {value, label,
 *                              disabled?, selected?, html?}. `label`
 *                              accepts a string (parsed as HTML), an HTML
 *                              string, or a Node. Returns the internal
 *                              option record.
 *   .updateOption(value, patch) — applies { label?, disabled?, selected?,
 *                              html? } to the matching option. Returns
 *                              true if found.
 *   .removeOption(value)     — removes an option (deselecting it first if
 *                              needed). Returns true if found.
 *   .clear()                  — deselects everything.
 *   .checkValidity() / .reportValidity() — matches native form control
 *                              validity (required = at least one selected).
 *
 * ---------------------------------------------------------------------
 * Events
 * ---------------------------------------------------------------------
 *   lwtf-input   — fires on every selection/removal while typing/clicking;
 *                 detail: { value: [...] }
 *   lwt-change  — fires on commit (a tag added/removed, or Escape/blur
 *                 closing the dropdown); detail: { value: [...] }
 *   lwtf-select  — an option was picked from the dropdown; detail:
 *                 { value, option }
 *   lwt-remove  — a tag was removed (× button or Backspace); detail:
 *                 { value, option }
 *
 * ---------------------------------------------------------------------
 * Form participation
 * ---------------------------------------------------------------------
 * Uses the ElementInternals API (formAssociated + setFormValue +
 * setValidity), so <lwtf-select name="…"> inside a <form> submits one
 * entry per selected value under that name. When ElementInternals isn't
 * available the element still works, it just doesn't participate in
 * <form> submission.
 *
 * ---------------------------------------------------------------------
 * Timing note (light-DOM <lwtf-select-option> children)
 * ---------------------------------------------------------------------
 * If the defining scripts are loaded in <head> (rather than at the end
 * of <body>), connectedCallback can fire before the parser has inserted
 * this element's own children — a plain one-time read would then find
 * nothing. This element handles that the same way <lwtf-transfer-list>
 * does: it tries an immediate parse, and if that finds no children,
 * watches with a MutationObserver until the real markup shows up, then
 * parses once and stops watching. Calling .options = [...] cancels any
 * pending watch, since JS is then driving state.
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-frm-select.js requires lwt-core.js to be loaded first.');
  }

  var uid = 0;

  function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Strips tags to get plain text for search matching — options carry
  // rich HTML, but filtering still needs something to match against.
  function htmlToText(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || '').trim();
  }

  function normalizeOption(opt) {
    if (opt == null) return null;
    if (typeof opt === 'string' || typeof opt === 'number') {
      var s = String(opt);
      return { value: s, label: s, text: s, html: '', disabled: false, selected: false };
    }
    var labelHtml;
    if (opt.label instanceof Node) {
      var wrap = document.createElement('div');
      wrap.appendChild(opt.label.cloneNode(true));
      labelHtml = wrap.innerHTML;
    } else {
      labelHtml = opt.label != null ? String(opt.label) : (opt.value != null ? String(opt.value) : '');
    }
    var value = opt.value != null ? String(opt.value) : htmlToText(labelHtml);
    return {
      value: value,
      label: labelHtml,
      text: htmlToText(labelHtml),
      html: opt.html || '',
      disabled: !!opt.disabled,
      selected: !!opt.selected
    };
  }

  var CSS = `
    :host { display: block; font-family: inherit; color: var(--lwt-select-color, var(--lwt-color-text, #1f2937)); }
    :host([hidden]) { display: none; }
    .field-label {
      display: block;
      font-size: 0.82rem;
      font-weight: 600;
      margin-bottom: 0.35rem;
      color: var(--lwt-select-label-color, var(--lwt-color-text, #374151));
    }
    .required-mark { color: var(--lwt-select-required-color, var(--lwt-color-danger, #ef4444)); margin-left: 0.15rem; }
    .wrap { position: relative; }
    .field-box {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      box-sizing: border-box;
      width: 100%;
      min-height: 2.4rem;
      padding: var(--lwt-select-padding, 0.3rem 0.5rem);
      gap: var(--lwt-select-gap, 0.35rem);
      border-radius: var(--lwt-select-radius, var(--lwt-border-radius, 6px));
      background: var(--lwt-select-bg, var(--lwt-color-surface, #fff));
      border: var(--lwt-select-border, var(--lwt-border, 1px solid #d1d5db));
      padding-right: var(--lwt-select-chevron-space, 2rem);
      cursor: pointer;
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .field-box:focus-within {
      border-color: var(--lwt-select-focus-color, var(--lwt-focus-color, #2563eb));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--lwt-select-focus-color, var(--lwt-focus-color, #2563eb)) 22%, transparent);
    }
    :host([disabled]) .field-box {
      opacity: 0.6;
      cursor: not-allowed;
      background: var(--lwt-color-surface-muted, #f3f4f6);
    }
    :host([data-invalid]) .field-box { border-color: var(--lwt-select-error-color, var(--lwt-color-danger, #ef4444)); }
    .tags { display: contents; }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      max-width: 100%;
      padding: 0.2rem 0.3rem 0.2rem 0.5rem;
      border-radius: var(--lwt-select-tag-radius, 4px);
      font-size: 0.85rem;
      line-height: 1.3;
      background: var(--lwt-select-tag-bg, var(--lwt-color-primary-soft, #eff6ff));
      color: var(--lwt-select-tag-color, var(--lwt-color-primary, #2563eb));
    }
    .tag-label { overflow: hidden; text-overflow: ellipsis; }
    .tag-label img { vertical-align: middle; max-height: 1.2em; }
    .tag-remove {
      flex-shrink: 0;
      border: none;
      background: none;
      padding: 0;
      margin: -0.2rem -0.25rem -0.2rem 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      min-height: 24px;
      cursor: pointer;
      color: inherit;
      opacity: 0.75;
      border-radius: 3px;
    }
    .tag-remove:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; opacity: 1; }
    .tag-remove:hover { opacity: 1; }
    .tag-remove svg { width: 0.75rem; height: 0.75rem; }
    :host([disabled]) .tag-remove { pointer-events: none; }
    .field {
      flex: 1;
      min-width: 60px;
      border: none;
      outline: none;
      background: transparent;
      padding: 0.3rem 0;
      font: inherit;
      font-size: 0.95rem;
      color: inherit;
    }
    .field::placeholder { color: var(--lwt-color-text-muted, #6b7280); }
    .chevron {
      position: absolute;
      top: 0;
      bottom: 0;
      right: 0;
      width: var(--lwt-select-chevron-space, 2rem);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--lwt-select-chevron-color, var(--lwt-icon-color, #6b7280));
      cursor: pointer;
    }
    .chevron svg { width: 1rem; height: 1rem; transition: transform 150ms ease; }
    .field-box.open .chevron svg { transform: rotate(180deg); }
    :host([disabled]) .chevron, :host([readonly]) .chevron { cursor: inherit; }
    @media (prefers-reduced-motion: reduce) { .chevron svg { transition: none; } }
    .field:disabled { cursor: not-allowed; }
    .below {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin-top: 0.3rem;
      font-size: 0.78rem;
      min-height: 1rem;
    }
    .helper { flex: 1; color: var(--lwt-select-helper-color, var(--lwt-color-text-muted, #6b7280)); }
    .helper.error { color: var(--lwt-select-error-color, var(--lwt-color-danger, #ef4444)); }
    .listbox {
      position: absolute;
      left: 0;
      right: 0;
      top: calc(100% + 4px);
      z-index: 10;
      overflow: auto;
      background: var(--lwt-select-bg, var(--lwt-color-surface, #fff));
      border: 1px solid var(--lwt-color-border-strong, #d1d5db);
      border-radius: var(--lwt-select-radius, var(--lwt-border-radius, 6px));
      box-shadow: 0 8px 20px var(--lwt-color-shadow, rgba(0,0,0,0.15));
      padding: 0.25rem 0;
      margin: 0;
      list-style: none;
      display: none;
    }
    .listbox.open { display: block; }
    .option {
      display: flex;
      align-items: center;
      padding: 0.45rem 0.75rem;
      cursor: pointer;
      font-size: 0.9rem;
      gap: 0.4rem;
    }
    /* .active = the keyboard/hover position; aria-selected/data-picked =
       actually chosen (kept separate so multi-select announces correctly). */
    .option.active {
      background: var(--lwt-color-primary-soft, #eff6ff);
      color: var(--lwt-color-primary, #2563eb);
      font-weight: 600;
    }
    .option[data-picked="true"] { background: var(--lwt-color-primary, #2563eb); color: #fff; }
    .option[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; }
    .option-label { overflow: hidden; text-overflow: ellipsis; }
    .empty {
      padding: 0.75rem;
      color: var(--lwt-color-text-muted, #6b7280);
      font-size: 0.85rem;
      text-align: center;
      font-style: italic;
    }
    .tooltip {
      position: absolute;
      z-index: 11;
      max-width: 260px;
      background: var(--lwt-color-surface, #fff);
      color: var(--lwt-color-text, #1f2937);
      border: 1px solid var(--lwt-border-color, #e5e7eb);
      border-radius: var(--lwt-select-radius, var(--lwt-border-radius, 8px));
      box-shadow: 0 8px 20px var(--lwt-color-shadow, rgba(0,0,0,0.15));
      padding: 0.6rem 0.7rem;
      font-size: 0.85rem;
      line-height: 1.4;
      display: none;
      pointer-events: none;
    }
    .tooltip.open { display: block; }
    .tooltip img { max-width: 100%; height: auto; display: block; }
    .tooltip *:first-child { margin-top: 0; }
    .tooltip *:last-child { margin-bottom: 0; }
  `;

  var REMOVE_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  var CHEVRON_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="6 9 12 15 18 9"/></svg>';

  var TEMPLATE =
    '<label class="field-label" part="label"><span class="label-text"></span><span class="required-mark" hidden>*</span></label>' +
    '<div class="wrap" part="wrap">' +
    '  <div class="field-box" part="field-box">' +
    '    <div class="tags" part="tags"></div>' +
    '    <input class="field" part="input" autocomplete="off">' +
    '    <span class="chevron" part="chevron" aria-hidden="true">' + CHEVRON_SVG + '</span>' +
    '  </div>' +
    '  <ul class="listbox" part="listbox" role="listbox"></ul>' +
    '  <div class="tooltip" part="tooltip"></div>' +
    '</div>' +
    '<div class="below" part="below"><div class="helper" part="helper"></div></div>';

  var supportsInternals = typeof HTMLElement.prototype.attachInternals === 'function';

  class LWTSelect extends window.LWT.Element {
    static get formAssociated() { return true; }

    static get observedAttributes() {
      return ['label', 'helper', 'error', 'placeholder', 'name', 'multiple',
              'max-selections', 'max-visible', 'required', 'disabled', 'readonly', 'aria-label', 'aria-labelledby'];
    }

    constructor() {
      super();

      if (supportsInternals) {
        try { this._internals = this.attachInternals(); }
        catch (e) { this._internals = null; }
      }

      this._options = [];   // [{ value, label(html), text, html(tooltip), disabled, selected }]
      this._filtered = [];
      this._activeIndex = -1;
      this._isOpen = false;
      this._initialized = false;
      this._lightDomSynced = false;
      this._mo = null;

      this._onInput = this._onInput.bind(this);
      this._onFocus = this._onFocus.bind(this);
      this._onBlur = this._onBlur.bind(this);
      this._onKeydown = this._onKeydown.bind(this);
      this._onListboxMouseover = this._onListboxMouseover.bind(this);
      this._onListboxMouseleave = this._onListboxMouseleave.bind(this);
      this._onListboxClick = this._onListboxClick.bind(this);
      this._onTagsClick = this._onTagsClick.bind(this);
      this._onDocClick = this._onDocClick.bind(this);
      this._onLightDomMutated = this._onLightDomMutated.bind(this);
      this._onDocumentParsed = this._onDocumentParsed.bind(this);
      this._waitingForParse = false;
      this._jsDriven = false;
    }

    connectedCallback() {
      super.connectedCallback();

      if (!this._initialized) {
        this._initialized = true;
        this._trySyncFromLightDom();
        // The parser can hand us our option children in several batches
        // (it pauses mid-page on large or streamed documents), so while the
        // document is still loading keep re-reading on every batch and only
        // stop once parsing is done. Outside of page load, keep the old
        // behaviour: wait for the first children to show up, read once.
        this._waitingForParse = document.readyState === 'loading';
        if ((this._waitingForParse || !this._lightDomSynced) && typeof MutationObserver === 'function') {
          this._mo = new MutationObserver(this._onLightDomMutated);
          this._mo.observe(this, { childList: true, subtree: true });
        }
        if (this._waitingForParse) {
          document.addEventListener('DOMContentLoaded', this._onDocumentParsed, { once: true });
        }
      }

      document.addEventListener('mousedown', this._onDocClick);
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      document.removeEventListener('mousedown', this._onDocClick);
      if (this._mo) { this._mo.disconnect(); this._mo = null; }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (this._input) this._syncAttrs();
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      var root = this._root;
      this._labelEl = root.querySelector('.field-label');
      this._labelText = root.querySelector('.label-text');
      this._requiredMark = root.querySelector('.required-mark');
      this._fieldBox = root.querySelector('.field-box');
      this._tagsEl = root.querySelector('.tags');
      this._input = root.querySelector('.field');
      this._helperEl = root.querySelector('.helper');
      this._listbox = root.querySelector('.listbox');
      this._tooltip = root.querySelector('.tooltip');

      this._id = 'lwt-select-' + (++uid);
      this._input.id = this._id + '-input';
      this._listbox.id = this._id + '-listbox';
      this._labelEl.setAttribute('for', this._input.id);
      this._helperEl.id = this._id + '-helper';
      this._input.setAttribute('role', 'combobox');
      this._input.setAttribute('aria-autocomplete', 'list');
      this._input.setAttribute('aria-controls', this._listbox.id);
      this._input.setAttribute('aria-expanded', 'false');

      this._input.addEventListener('input', this._onInput);
      this._input.addEventListener('focus', this._onFocus);
      this._input.addEventListener('blur', this._onBlur);
      this._input.addEventListener('keydown', this._onKeydown);
      this._tagsEl.addEventListener('click', this._onTagsClick);
      this._listbox.addEventListener('mouseover', this._onListboxMouseover);
      this._listbox.addEventListener('mouseleave', this._onListboxMouseleave);
      this._listbox.addEventListener('mousedown', function (e) { e.preventDefault(); }); // don't blur field
      this._listbox.addEventListener('click', this._onListboxClick);
      this._fieldBox.addEventListener('mousedown', (function (e) {
        // Focus (and thereby open) the dropdown on any click inside the
        // field that isn't a tag's remove button — including a click on
        // the tag itself. This matters most in single-select: with one
        // tag filling the field, the empty background area (the only
        // spot this used to react to) can shrink to nothing, making it
        // impossible to pick a replacement without removing the tag
        // first. Clicking the tag now re-opens the list so a new pick
        // replaces it directly.
        if (e.target.closest && e.target.closest('.tag-remove')) return;
        // document.activeElement is the host when focus is inside our
        // shadow root, so ask the shadow root which element has focus.
        var focused = this._root.activeElement === this._input;
        // The chevron toggles, like a native <select> arrow.
        if (e.target.closest && e.target.closest('.chevron')) {
          e.preventDefault();
          if (this._isOpen) this._closeDropdown();
          else if (focused) this._openDropdown();
          else this._input.focus();               // focus handler opens it
          return;
        }
        // Click on the text input: let the browser place the caret. If the
        // input already has focus no 'focus' event fires, so open here.
        if (e.target === this._input) {
          if (focused) this._openDropdown();
          return;
        }
        e.preventDefault();
        if (focused) this._openDropdown();
        else this._input.focus();
      }).bind(this));

      this._syncAttrs();
      this._renderTags();
    }

    // ---- attribute → DOM sync ----
    _syncAttrs() {
      var label = this._strAttr('label', '');
      var helper = this._strAttr('helper', '');
      var error = this._strAttr('error', '');
      var placeholder = this._strAttr('placeholder', '');
      var required = this._boolAttr('required');
      var disabled = this._boolAttr('disabled');
      var readonly = this._boolAttr('readonly');
      // Read-only classification attribute — see lwt-frm-choices.js for
      // the convention every lwtf- element follows. Named after the two
      // native <select> .type values (select-one / select-multiple)
      // since that's the closest built-in analog.
      this.setAttribute('control-type', this._boolAttr('multiple') ? 'select-multiple' : 'select-one');

      this._labelText.textContent = label;
      this._labelEl.style.display = label ? '' : 'none';
      this._requiredMark.hidden = !required;

      // Accessible name: visible label, else host aria-label, placeholder,
      // humanized name="", else "Select" -- with a developer warning.
      var hostLabel = this._hostLabel();
      var nameText = label;
      if (label && !hostLabel) {
        this._input.removeAttribute('aria-label');
      } else {
        nameText = this._a11yName([placeholder, window.LWT.a11y.humanize(this._strAttr('name', ''))],
          this._boolAttr('multiple') ? 'Select options' : 'Select an option', 'Add a label attribute');
        this._input.setAttribute('aria-label', nameText);
      }
      this._listbox.setAttribute('aria-label', nameText);
      if (this._boolAttr('multiple')) this._listbox.setAttribute('aria-multiselectable', 'true');
      else this._listbox.removeAttribute('aria-multiselectable');

      this._input.placeholder = placeholder;
      this._input.required = required && this._selected().length === 0;
      this._input.disabled = disabled;
      this._input.readOnly = readonly;

      var errorMsg = error;
      if (errorMsg) {
        this._helperEl.classList.add('error');
        this._helperEl.textContent = errorMsg;
      } else {
        this._helperEl.classList.remove('error');
        this._helperEl.textContent = helper;
      }
      this.toggleAttribute('data-invalid', !!errorMsg);
      if (errorMsg) this._input.setAttribute('aria-invalid', 'true'); else this._input.removeAttribute('aria-invalid');
      if (this._helperEl.textContent) this._input.setAttribute('aria-describedby', this._helperEl.id);
      else this._input.removeAttribute('aria-describedby');

      this._reportValidity();
    }

    // ---- initial data (light DOM, read once — see file header) ----

    _trySyncFromLightDom() {
      var children = this.querySelectorAll(':scope > lwtf-select-option');
      if (!children.length) return;

      var options = [];
      children.forEach(function (child) {
        var tooltipTpl = child.querySelector(':scope > template[slot="tooltip"]');
        var tooltipHtml = tooltipTpl ? tooltipTpl.innerHTML : '';

        var clone = child.cloneNode(true);
        var cloneTpl = clone.querySelector(':scope > template[slot="tooltip"]');
        if (cloneTpl) cloneTpl.remove();
        var labelHtml = clone.innerHTML.trim();

        var value = child.getAttribute('value');
        if (value == null) value = htmlToText(labelHtml);

        options.push({
          value: String(value),
          label: labelHtml,
          text: htmlToText(labelHtml),
          html: tooltipHtml,
          disabled: child.hasAttribute('disabled'),
          selected: child.hasAttribute('selected')
        });
      });

      this._options = options;
      this._lightDomSynced = true;
      this._renderTags();
      this._reportValue();
      this._reportValidity();
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

    // ---- selection state ----

    _selected() {
      return this._options.filter(function (o) { return o.selected; });
    }

    _findOption(value) {
      value = String(value);
      for (var i = 0; i < this._options.length; i++) {
        if (this._options[i].value === value) return this._options[i];
      }
      return null;
    }

    // ---- public API ----

    get value() { return this._selected().map(function (o) { return o.value; }); }
    set value(arr) {
      var multiple = this._boolAttr('multiple');
      var wanted = Array.isArray(arr) ? arr.map(String) : (arr == null ? [] : [String(arr)]);
      var applied = false;
      this._options.forEach(function (o) {
        var pick = wanted.indexOf(o.value) !== -1 && (multiple || !applied);
        if (pick && !multiple) applied = true;
        o.selected = pick;
      });
      this._renderTags();
      this._reportValue();
      this._reportValidity();
    }

    get options() {
      return this._options.map(function (o) {
        return { value: o.value, label: o.label, disabled: o.disabled, selected: o.selected, html: o.html };
      });
    }

    set options(arr) {
      this._lightDomSynced = true;
      this._jsDriven = true; // JS owns the options now -- ignore late light-DOM batches
      this._waitingForParse = false;
      if (this._mo) { this._mo.disconnect(); this._mo = null; }

      var multiple = this._boolAttr('multiple');
      var applied = false;
      this._options = (Array.isArray(arr) ? arr : []).map(normalizeOption).filter(Boolean).map(function (o) {
        var pick = o.selected && (multiple || !applied);
        if (pick && !multiple) applied = true;
        o.selected = pick;
        return o;
      });

      this._renderTags();
      if (this._isOpen) this._renderList();
      this._reportValue();
      this._reportValidity();
    }

    addOption(opt) {
      var normalized = normalizeOption(opt);
      if (!normalized) return null;
      if (normalized.selected) this._applySelection(normalized, true, { skipEvents: true });
      this._options.push(normalized);
      if (this._isOpen) this._renderList();
      this._renderTags();
      this._reportValue();
      this._reportValidity();
      return normalized;
    }

    updateOption(value, patch) {
      patch = patch || {};
      var opt = this._findOption(value);
      if (!opt) return false;

      if (patch.value !== undefined) opt.value = String(patch.value);
      if (patch.label !== undefined) {
        var normalized = normalizeOption({ label: patch.label, value: opt.value });
        opt.label = normalized.label;
        opt.text = normalized.text;
      }
      if (patch.html !== undefined) opt.html = patch.html;
      if (patch.disabled !== undefined) opt.disabled = !!patch.disabled;
      if (patch.selected !== undefined) this._applySelection(opt, !!patch.selected, { skipEvents: true });

      if (this._isOpen) this._renderList();
      this._renderTags();
      this._reportValue();
      this._reportValidity();
      return true;
    }

    removeOption(value) {
      var opt = this._findOption(value);
      if (!opt) return false;
      this._options = this._options.filter(function (o) { return o !== opt; });
      if (this._isOpen) this._renderList();
      this._renderTags();
      this._reportValue();
      this._reportValidity();
      return true;
    }

    clear() {
      this._options.forEach(function (o) { o.selected = false; });
      this._renderTags();
      this._reportValue();
      this._reportValidity();
      this.emit('change', { value: [] });
    }

    focus() { if (this._input) this._input.focus(); }
    blur() { if (this._input) this._input.blur(); }

    checkValidity() {
      return this._internals ? this._internals.checkValidity() : true;
    }
    reportValidity() {
      return this._internals ? this._internals.reportValidity() : true;
    }

    // ---- selection mechanics ----

    // Applies/clears `selected` on one option, respecting single-vs-
    // multiple and max-selections. Returns true if it actually changed
    // anything (false if refused — e.g. at the selection cap).
    _applySelection(opt, selected, opts) {
      opts = opts || {};
      var multiple = this._boolAttr('multiple');

      if (selected) {
        if (opt.disabled || opt.selected) return false;
        if (!multiple) {
          this._options.forEach(function (o) { o.selected = false; });
        } else {
          var max = parseInt(this._strAttr('max-selections', ''), 10);
          if (!isNaN(max) && this._selected().length >= max) return false;
        }
        opt.selected = true;
      } else {
        if (!opt.selected) return false;
        opt.selected = false;
      }

      if (!opts.skipEvents) {
        this.emit(selected ? 'select' : 'remove', { value: opt.value, option: this._publicOption(opt) });
        // Tags appear/disappear visually; say so for screen readers too.
        window.LWT.a11y.announce(opt.text + (selected ? ' selected' : ' removed') +
          (multiple ? ', ' + this._selected().length + ' selected' : ''));
      }
      return true;
    }

    _publicOption(opt) {
      return { value: opt.value, label: opt.label, disabled: opt.disabled, selected: opt.selected, html: opt.html };
    }

    _selectByValue(value) {
      var opt = this._findOption(value);
      if (!opt) return;
      var wasSelected = opt.selected;
      var multiple = this._boolAttr('multiple');

      // Clicking an already-selected option toggles it off (handy way to
      // deselect from the dropdown without hunting for the tag's × button).
      var changed = this._applySelection(opt, !wasSelected);
      if (!changed) return;

      this._input.value = '';
      this._renderTags();
      if (this._isOpen) this._renderList();
      this._reportValue();
      this._reportValidity();
      this.emit('input', { value: this.value });

      if (!multiple && !wasSelected) this._closeDropdown();
      else this._input.focus();
    }

    _removeValue(value) {
      var opt = this._findOption(value);
      if (!opt) return;
      var changed = this._applySelection(opt, false);
      if (!changed) return;

      this._renderTags();
      if (this._isOpen) this._renderList();
      this._reportValue();
      this._reportValidity();
      this.emit('input', { value: this.value });
      this.emit('change', { value: this.value });
    }

    // ---- rendering: tags ----

    _renderTags() {
      if (!this._tagsEl) return;
      var self = this;
      this._tagsEl.innerHTML = '';
      this._selected().forEach(function (opt) {
        var tag = self._genhtml({
          type: 'span',
          attr: { class: 'tag', part: 'tag', 'data-value': opt.value },
          html: '<span class="tag-label" part="tag-label">' + opt.label + '</span>'
        });
        var removeBtn = self._genhtml({
          type: 'button',
          attr: { type: 'button', class: 'tag-remove', part: 'tag-remove', 'data-value': opt.value, 'aria-label': 'Remove ' + opt.text },
          html: REMOVE_SVG
        });
        tag.appendChild(removeBtn);
        self._tagsEl.appendChild(tag);
      });
      if (this._input) {
        this._input.required = this._boolAttr('required') && this._selected().length === 0;
      }
    }

    _onTagsClick(e) {
      var btn = e.target && e.target.closest ? e.target.closest('.tag-remove') : null;
      if (!btn) return;
      if (this._boolAttr('disabled') || this._boolAttr('readonly')) return;
      this._removeValue(btn.dataset.value);
      this._input.focus();
    }

    // ---- dropdown ----

    _openDropdown() {
      if (this._boolAttr('disabled') || this._boolAttr('readonly')) return;
      this._isOpen = true;
      this._listbox.classList.add('open');
      this._fieldBox.classList.add('open');
      this._input.setAttribute('aria-expanded', 'true');
      this._renderList();
    }

    _closeDropdown() {
      if (!this._isOpen) return;
      this._isOpen = false;
      this._listbox.classList.remove('open');
      this._fieldBox.classList.remove('open');
      this._hideTooltip();
      this._activeIndex = -1;
      this._input.setAttribute('aria-expanded', 'false');
      this._input.removeAttribute('aria-activedescendant');
    }

    _renderList() {
      var query = this._input.value.trim().toLowerCase();
      this._filtered = query
        ? this._options.filter(function (o) { return o.text.toLowerCase().indexOf(query) !== -1; })
        : this._options.slice();

      var maxVisible = parseInt(this._strAttr('max-visible', '8'), 10);
      if (isNaN(maxVisible) || maxVisible <= 0) maxVisible = 8;
      this._listbox.style.maxHeight = (maxVisible * 2.4) + 'rem';

      if (!this._filtered.length) {
        this._listbox.innerHTML = '<li class="empty" part="empty">No matches</li>';
        this._activeIndex = -1;
        return;
      }

      var self = this;
      var html = this._filtered.map(function (opt, i) {
        var attrs = 'class="option" role="option" data-idx="' + i + '" id="' + self._id + '-opt-' + i + '"' +
          (opt.disabled ? ' aria-disabled="true"' : '') +
          (opt.selected ? ' data-picked="true"' : '') +
          ' aria-selected="' + (opt.selected ? 'true' : 'false') + '"';
        return '<li ' + attrs + '><span class="option-label" part="option-label">' + opt.label + '</span></li>';
      }).join('');
      this._listbox.innerHTML = html;

      var firstIdx = -1;
      for (var i = 0; i < this._filtered.length; i++) {
        if (!this._filtered[i].disabled) { firstIdx = i; break; }
      }
      this._setActiveIndex(firstIdx);
    }

    _setActiveIndex(idx) {
      var prev = this._listbox.querySelector('.option.active');
      if (prev) prev.classList.remove('active');

      if (idx < 0 || idx >= this._filtered.length) {
        this._activeIndex = -1;
        this._input.removeAttribute('aria-activedescendant');
        this._hideTooltip();
        return;
      }
      this._activeIndex = idx;
      var el = this._listbox.querySelector('.option[data-idx="' + idx + '"]');
      if (!el) return;
      el.classList.add('active');
      this._input.setAttribute('aria-activedescendant', el.id);

      var lb = this._listbox;
      var elTop = el.offsetTop, elBottom = elTop + el.offsetHeight;
      if (elTop < lb.scrollTop) lb.scrollTop = elTop;
      else if (elBottom > lb.scrollTop + lb.clientHeight) lb.scrollTop = elBottom - lb.clientHeight;

      var opt = this._filtered[idx];
      if (opt && opt.html) this._showTooltip(el, opt.html);
      else this._hideTooltip();
    }

    _moveActive(delta) {
      if (!this._filtered.length) return;
      var idx = this._activeIndex;
      for (var step = 0; step < this._filtered.length; step++) {
        idx = (idx + delta + this._filtered.length) % this._filtered.length;
        if (!this._filtered[idx].disabled) break;
      }
      this._setActiveIndex(idx);
    }

    // ---- events ----

    _onInput() {
      if (this._options.length) this._openDropdown();
      else this._renderList();
    }

    _onFocus() {
      this._openDropdown();
    }

    _onBlur() {
      var self = this;
      setTimeout(function () {
        if (document.activeElement !== self._input && !self._contains(document.activeElement)) {
          self._closeDropdown();
          self._input.value = '';
          self.emit('change', { value: self.value });
        }
      }, 0);
    }

    _onKeydown(e) {
      if (e.key === 'Enter') {
        if (this._isOpen && this._activeIndex >= 0) {
          e.preventDefault();
          var opt = this._filtered[this._activeIndex];
          if (opt) this._selectByValue(opt.value);
        }
        return;
      }

      if (e.key === 'Escape') {
        if (this._isOpen) {
          e.preventDefault();
          this._closeDropdown();
        }
        return;
      }

      if (e.key === 'Backspace' && !this._input.value) {
        var selected = this._selected();
        if (selected.length) {
          e.preventDefault();
          this._removeValue(selected[selected.length - 1].value);
        }
        return;
      }

      if (!this._isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); this._openDropdown(); }
        return;
      }

      if (e.key === 'ArrowDown') { e.preventDefault(); this._moveActive(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this._moveActive(-1); }
      else if (e.key === 'Home') { e.preventDefault(); this._setActiveIndex(0); }
      else if (e.key === 'End') { e.preventDefault(); this._setActiveIndex(this._filtered.length - 1); }
      else if (e.key === 'Tab') { this._closeDropdown(); }
    }

    _onListboxMouseover(e) {
      var target = e.target && e.target.closest ? e.target.closest('.option') : null;
      if (!target) return;
      var idx = parseInt(target.getAttribute('data-idx'), 10);
      if (isNaN(idx)) return;
      this._setActiveIndex(idx);
    }

    _onListboxMouseleave() {
      this._hideTooltip();
    }

    _onListboxClick(e) {
      var target = e.target && e.target.closest ? e.target.closest('.option') : null;
      if (!target) return;
      var idx = parseInt(target.getAttribute('data-idx'), 10);
      if (isNaN(idx)) return;
      var opt = this._filtered[idx];
      if (opt && !opt.disabled) this._selectByValue(opt.value);
    }

    _onDocClick(e) {
      var path = e.composedPath ? e.composedPath() : [];
      if (path.indexOf(this) === -1) this._closeDropdown();
    }

    _contains(node) {
      if (!node) return false;
      var path = node.getRootNode && node.getRootNode() === this._root;
      return path || this.contains(node);
    }

    // ---- tooltip (identical positioning logic to lwt-frm-input.js) ----

    _showTooltip(anchorEl, html) {
      this._tooltip.innerHTML = html; // intentional: this is the HTML tooltip
      this._tooltip.classList.add('open');

      var wrap = this._listbox.parentElement;
      var lbRect = this._listbox.getBoundingClientRect();
      var anchorRect = anchorEl.getBoundingClientRect();
      var wrapRect = wrap.getBoundingClientRect();
      var tipRect = this._tooltip.getBoundingClientRect();
      var tipW = tipRect.width;
      var tipH = tipRect.height;

      var GAP = 6;
      var VP_PAD = 8;
      var vpW = window.innerWidth;
      var vpH = window.innerHeight;

      var absLeft;
      var rightSlot = lbRect.right + GAP;
      var leftSlot = lbRect.left - GAP - tipW;
      if (rightSlot + tipW <= vpW - VP_PAD) absLeft = rightSlot;
      else if (leftSlot >= VP_PAD) absLeft = leftSlot;
      else absLeft = anchorRect.left + (anchorRect.width - tipW) / 2;
      absLeft = Math.max(VP_PAD, Math.min(vpW - tipW - VP_PAD, absLeft));

      var absTop = anchorRect.top;
      absTop = Math.max(VP_PAD, Math.min(vpH - tipH - VP_PAD, absTop));

      this._tooltip.style.top = (absTop - wrapRect.top) + 'px';
      this._tooltip.style.left = (absLeft - wrapRect.left) + 'px';
    }

    _hideTooltip() {
      this._tooltip.classList.remove('open');
      this._tooltip.innerHTML = '';
    }

    // ---- form-association + validity ----

    _reportValue() {
      if (!this._internals) return;
      var vals = this.value;
      var name = this._strAttr('name', '') || 'value';
      if (!vals.length) {
        this._internals.setFormValue(null);
      } else {
        var fd = new FormData();
        vals.forEach(function (v) { fd.append(name, v); });
        this._internals.setFormValue(fd);
      }
    }

    _reportValidity() {
      if (!this._internals) return;
      var required = this._boolAttr('required');
      if (required && this.value.length === 0) {
        this._internals.setValidity({ valueMissing: true }, 'Select at least one option.', this._input || this);
      } else {
        this._internals.setValidity({});
      }
    }
  }

  window.LWT.define('lwtf-select', LWTSelect);
})();

/* ---- lwt-frm-signature.js ---- */
/*!
 * <lwtf-signature>
 * A digital signature input. Defaults to "type" mode — type your name and
 * pick from a row of script/cursive fonts, with a live large preview on a
 * signing line. An optional "draw" mode (on by default, turn off with
 * `no-draw`) switches to a canvas you sign with mouse/touch/pen.
 *
 *   <!-- typed only -->
 *   <lwtf-signature label="Sign here" no-draw></lwtf-signature>
 *
 *   <!-- typed + draw, custom font list (load these via Google Fonts
 *        yourself — see the note below) -->
 *   <lwtf-signature label="Signature" fonts="Dancing Script;Pacifico;Satisfy;Caveat"></lwtf-signature>
 *
 *   <script>
 *     var el = document.querySelector('lwtf-signature');
 *     el.addEventListener('lwt-change', function (e) { console.log(e.detail.value); });
 *     el.value;             // -> { mode: 'type', text: 'Jane Doe', font: 'Dancing Script' }
 *                            //    or { mode: 'draw', dataUrl: 'data:image/png;base64,...' }
 *     el.toDataURL();        // -> PNG data URL either way (renders the typed
 *                            //    text through its font if in type mode)
 *     el.isEmpty();
 *   </script>
 *
 * Font note: the four default fonts are a system/generic "cursive" stack
 * that needs no external loading, but will look fairly plain. For real
 * script fonts (Dancing Script, Pacifico, etc.) load them yourself —
 * <link> a Google Fonts stylesheet in your page — and pass matching
 * names via the `fonts` attribute; this element only *offers* fonts, it
 * doesn't fetch any.
 *
 * ---------------------------------------------------------------------
 * Attributes
 * ---------------------------------------------------------------------
 *   label, helper, error — display / form basics
 *   name, required, disabled, readonly — standard form states
 *   mode          — "type" (default) | "draw"; which panel is active on connect
 *   no-draw       — boolean; hides the Type/Draw tabs and removes draw mode entirely
 *   fonts         — semicolon-separated list of CSS font-family values
 *                    offered in type mode (default: a 4-entry generic
 *                    cursive stack). Semicolons, not commas, because a
 *                    single entry is itself a CSS font-family fallback
 *                    stack that legitimately contains commas, e.g.
 *                    fonts="Dancing Script, cursive;Pacifico, cursive"
 *   pen-color     — stroke color for draw mode (default: currentColor's
 *                    computed value, falls back to #111827)
 *   value         — initial typed name; read once at connect (use
 *                    .value after). Only applies to type mode.
 *
 * ---------------------------------------------------------------------
 * Properties / methods
 * ---------------------------------------------------------------------
 *   .value       — get/set. Get returns { mode, text, font } in type
 *                   mode or { mode, dataUrl } in draw mode. Set accepts
 *                   a string (sets type mode's text) or either shape above.
 *   .toDataURL() — PNG data URL of the current signature either way
 *   .isEmpty()   — true if nothing's been typed/drawn
 *   .clear()     — empties the current mode (fires lwtf-input)
 *   .mode        — get/set "type" | "draw" (no-op if no-draw is set)
 *   .checkValidity() / .reportValidity()
 *
 * ---------------------------------------------------------------------
 * Events
 * ---------------------------------------------------------------------
 *   lwtf-input    — every keystroke/stroke; detail: { value }
 *   lwt-change   — commit (blur on the name field, or pointerup after a
 *                   stroke); detail: { value }
 *   lwt-mode-change — the Type/Draw tab changed; detail: { mode }
 *
 * ---------------------------------------------------------------------
 * Form participation
 * ---------------------------------------------------------------------
 * Uses ElementInternals (formAssociated + setFormValue + setValidity).
 * The submitted form value is always the rendered PNG (via .toDataURL())
 * — that's the artifact a server actually wants on file — even though
 * the richer { text, font } shape stays available through .value for
 * your own JS. `required` is satisfied once .isEmpty() is false.
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-frm-signature.js requires lwt-core.js to be loaded first.');
  }

  var uid = 0;
  var supportsInternals = typeof HTMLElement !== 'undefined' && !!HTMLElement.prototype.attachInternals;

  // Each default also carries a distinct style/weight, not just a
  // different font-family stack. Reason: the named script fonts here
  // (Brush Script MT, Lucida Handwriting, Apple Chancery...) aren't
  // installed on every OS, and when they're missing every entry quietly
  // collapses to the same generic "cursive" fallback — so without a
  // style/weight difference too, several swatches end up looking
  // identical. The style/weight keeps them visually distinct even in
  // that worst case.
  var DEFAULT_FONTS = [
    { family: '"Segoe Script", "Bradley Hand", "Brush Script MT", cursive', style: 'normal', weight: 'normal' },
    { family: '"Lucida Handwriting", "Apple Chancery", "Segoe Print", cursive', style: 'italic', weight: 'normal' },
    { family: '"Comic Sans MS", "Chalkboard SE", "Marker Felt", cursive', style: 'normal', weight: 'bold' },
    { family: 'cursive', style: 'italic', weight: 'bold' }
  ];

  function normalizeFont(f) {
    return typeof f === 'string' ? { family: f, style: 'normal', weight: 'normal' } : f;
  }
  function sameFont(a, b) {
    return !!a && !!b && a.family === b.family && a.style === b.style && a.weight === b.weight;
  }

  var TEMPLATE =
    '<div class="field-label" part="label">' +
    '  <span class="label-text" part="label-text"></span>' +
    '  <span class="required-mark" part="required">*</span>' +
    '</div>' +
    '<div class="panel-box" part="panel">' +
    '  <div class="tabs" part="tabs" role="group" aria-label="Signature method">' +
    '    <button type="button" class="tab" part="tab-type" data-mode="type" aria-pressed="true">Type</button>' +
    '    <button type="button" class="tab" part="tab-draw" data-mode="draw" aria-pressed="false">Draw</button>' +
    '  </div>' +
    '  <div class="type-panel" part="type-panel">' +
    '    <input type="text" class="name-input" part="name-input" autocomplete="off" spellcheck="false">' +
    '    <div class="font-swatches" part="font-swatches"></div>' +
    '    <div class="preview" part="preview">' +
    '      <span class="preview-text" part="preview-text"></span>' +
    '      <span class="preview-placeholder" part="preview-placeholder" aria-hidden="true">Your signature</span>' +
    '    </div>' +
    '  </div>' +
    '  <div class="draw-panel" part="draw-panel">' +
    // Drawing needs a pointer; keyboard users sign in Type mode instead
    // (WCAG 2.1.1 alternative), which the canvas's name points out.
    '    <canvas class="draw-canvas" part="canvas" role="img" aria-label="Signature drawing area. Draw with a mouse, pen or finger, or switch to Type to type your name."></canvas>' +
    '    <span class="draw-placeholder" part="draw-placeholder" aria-hidden="true">Sign here</span>' +
    '  </div>' +
    '  <div class="actions" part="actions">' +
    '    <button type="button" class="clear-btn" part="clear">Clear</button>' +
    '  </div>' +
    '</div>' +
    '<div class="below" part="below">' +
    '  <span class="helper" part="helper"></span>' +
    '</div>';

  var CSS = `
    :host {
      display: block;
      color: inherit;
      font-family: inherit;
      box-sizing: border-box;
    }
    :host([hidden]) { display: none; }
    * { box-sizing: border-box; }
    .field-label {
      display: flex;
      gap: 0.2rem;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 0.4rem;
      color: var(--lwt-signature-label-color, var(--lwt-color-text, #111827));
    }
    .field-label:empty, .label-text:empty { display: none; }
    .required-mark { color: var(--lwt-color-danger, #ef4444); display: none; }
    :host([required]) .required-mark { display: inline; }
    .panel-box {
      border-radius: var(--lwt-signature-radius, var(--lwt-border-radius, 8px));
      overflow: hidden;
      background: var(--lwt-signature-bg, var(--lwt-color-surface, #fff));
      border: var(--lwt-signature-border, var(--lwt-border, 1px solid #d1d5db));
    }
    :host([disabled]) .panel-box { opacity: 0.6; background: var(--lwt-color-surface-muted, #f3f4f6); }
    :host([data-invalid]) .panel-box {
      border-color: var(--lwt-signature-error-color, var(--lwt-color-danger, #ef4444));
    }
    .tabs { display: none; border-bottom: 1px solid var(--lwt-border-color, #e5e7eb); }
    :host(:not([no-draw])) .tabs { display: flex; }
    .tab {
      all: unset;
      box-sizing: border-box;
      flex: 1;
      text-align: center;
      padding: 0.5rem;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--lwt-color-text-muted, #6b7280);
      border-bottom: 2px solid transparent;
    }
    .tab.active { color: var(--lwt-color-primary, #2563eb); border-bottom-color: var(--lwt-color-primary, #2563eb); }
    :host([disabled]) .tab, :host([readonly]) .tab { cursor: not-allowed; }
    .type-panel, .draw-panel { display: none; padding: var(--lwt-signature-padding, var(--lwt-padding, 0.85rem)); }
    :host([data-mode="type"]) .type-panel { display: block; }
    :host([data-mode="draw"]) .draw-panel { display: block; padding: 0; position: relative; }
    .name-input {
      width: 100%;
      font: inherit;
      font-size: 0.95rem;
      padding: 0.5rem 0.6rem;
      border-radius: 6px;
      border: 1px solid var(--lwt-color-border-strong, #d1d5db);
      background: transparent;
      color: inherit;
    }
    .name-input:focus {
      outline: none;
      border-color: var(--lwt-signature-focus-color, var(--lwt-focus-color, #2563eb));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--lwt-signature-focus-color, var(--lwt-focus-color, #2563eb)) 22%, transparent);
    }
    .font-swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.7rem;
    }
    .font-swatch {
      all: unset;
      box-sizing: border-box;
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1.15rem;
      border: 1px solid var(--lwt-color-border-strong, #d1d5db);
      background: var(--lwt-color-surface, #fff);
    }
    .font-swatch.active {
      border-color: var(--lwt-color-primary, #2563eb);
      background: var(--lwt-color-primary-soft, #eff6ff);
    }
    .preview {
      position: relative;
      margin-top: 0.9rem;
      padding: 1.2rem 0.5rem 0.6rem;
      text-align: center;
      border-bottom: 2px solid var(--lwt-color-border-strong, #9ca3af);
      min-height: 3.4rem;
    }
    .preview-text {
      font-size: 2rem;
      line-height: 1;
      color: var(--lwt-signature-ink-color, var(--lwt-color-text, #111827));
    }
    .preview-text:empty { display: none; }
    .preview-placeholder {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0.7rem;
      text-align: center;
      color: var(--lwt-color-text-muted, #6b7280);
      font-size: 0.85rem;
    }
    .preview-text:not(:empty) ~ .preview-placeholder { display: none; }
    .draw-canvas {
      display: block;
      width: 100%;
      height: var(--lwt-signature-height, 160px);
      touch-action: none;
      cursor: crosshair;
    }
    :host([disabled]) .draw-canvas, :host([readonly]) .draw-canvas { cursor: not-allowed; }
    .draw-placeholder {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 1rem;
      text-align: center;
      pointer-events: none;
      color: var(--lwt-color-text-muted, #6b7280);
      font-size: 0.85rem;
    }
    .draw-placeholder.hidden { display: none; }
    .actions {
      display: flex;
      justify-content: flex-end;
      padding: 0.5rem 0.85rem;
      border-top: 1px solid var(--lwt-border-color, #e5e7eb);
    }
    .clear-btn {
      all: unset;
      box-sizing: border-box;
      padding: 0.35rem 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--lwt-color-text-muted, #6b7280);
      border: 1px solid var(--lwt-color-border-strong, #d1d5db);
    }
    .clear-btn:hover { background: var(--lwt-color-surface-muted, #f3f4f6); }
    :host([disabled]) .clear-btn, :host([readonly]) .clear-btn { pointer-events: none; opacity: 0.6; }
    .below {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin-top: 0.4rem;
      font-size: 0.78rem;
      min-height: 1rem;
    }
    .helper { flex: 1; color: var(--lwt-signature-helper-color, var(--lwt-color-text-muted, #6b7280)); }
    .helper.error { color: var(--lwt-signature-error-color, var(--lwt-color-danger, #ef4444)); }
    .helper:empty { display: none; }
  `;

  class LWTSignature extends window.LWT.Element {
    static get observedAttributes() {
      return ['label', 'helper', 'error', 'name', 'required', 'disabled', 'readonly',
              'mode', 'no-draw', 'fonts', 'pen-color', 'aria-label', 'aria-labelledby'];
    }

    constructor() {
      super();

      if (supportsInternals) {
        try { this._internals = this.attachInternals(); }
        catch (e) { this._internals = null; }
      }

      this._initialized = false;
      this._mode = 'type';
      this._text = '';
      this._font = null;
      this._hasStroke = false;
      this._lastCommitted = null;
      this._drawing = false;
      this._points = [];

      this._onTabClick = this._onTabClick.bind(this);
      this._onNameInput = this._onNameInput.bind(this);
      this._onNameBlur = this._onNameBlur.bind(this);
      this._onClearClick = this._onClearClick.bind(this);
      this._onCanvasPointerDown = this._onCanvasPointerDown.bind(this);
      this._onCanvasPointerMove = this._onCanvasPointerMove.bind(this);
      this._onCanvasPointerUp = this._onCanvasPointerUp.bind(this);
      this._onResize = this._onResize.bind(this);
    }

    connectedCallback() {
      super.connectedCallback();
      // Read-only classification attribute — see lwt-frm-choices.js for
      // the convention every lwtf- element follows.
      this.setAttribute('control-type', 'signature');
      if (!this._initialized) {
        this._initialized = true;
        this._mode = this._boolAttr('no-draw') ? 'type' : (this._strAttr('mode', 'type') === 'draw' ? 'draw' : 'type');
        this._text = this._strAttr('value', '');
        var fonts = this._fontList();
        this._font = fonts[0];
        this.setAttribute('data-mode', this._mode);
        this._syncModeUI();
        this._nameInput.value = this._text;
        this._updatePreview();
        this._lastCommitted = this.value;
        this._reportValue();
        this._reportValidity();
      }
      if (typeof ResizeObserver === 'function' && !this._resizeObserver) {
        this._resizeObserver = new ResizeObserver(this._onResize);
        this._resizeObserver.observe(this._canvas);
      } else {
        this._resizeCanvas();
      }
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (!this._nameInput) return; // not rendered yet
      if (name === 'fonts') {
        this._buildFontSwatches();
      } else if (name === 'no-draw') {
        if (this._boolAttr('no-draw') && this._mode === 'draw') this.mode = 'type';
      }
      this._syncAttrs();
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      var root = this._root;
      this._labelEl = root.querySelector('.field-label');
      this._labelText = root.querySelector('.label-text');
      this._tabsEl = root.querySelector('.tabs');
      this._tabType = root.querySelector('.tab[data-mode="type"]');
      this._tabDraw = root.querySelector('.tab[data-mode="draw"]');
      this._nameInput = root.querySelector('.name-input');
      this._swatchesEl = root.querySelector('.font-swatches');
      this._previewText = root.querySelector('.preview-text');
      this._canvas = root.querySelector('.draw-canvas');
      this._drawPlaceholder = root.querySelector('.draw-placeholder');
      this._clearBtn = root.querySelector('.clear-btn');
      this._helperEl = root.querySelector('.helper');
      this._ctx = this._canvas.getContext('2d');

      this._id = 'lwt-signature-' + (++uid);
      this._nameInput.id = this._id + '-name';
      this._labelText.id = this._id + '-label';
      this._helperEl.id = this._id + '-helper';

      this._tabType.addEventListener('click', this._onTabClick);
      this._tabDraw.addEventListener('click', this._onTabClick);
      this._nameInput.addEventListener('input', this._onNameInput);
      this._nameInput.addEventListener('blur', this._onNameBlur);
      this._clearBtn.addEventListener('click', this._onClearClick);
      this._canvas.addEventListener('pointerdown', this._onCanvasPointerDown);

      this._buildFontSwatches();
      this._syncAttrs();
    }

    // ---- fonts ----
    // Returns an array of { family, style, weight } descriptors — see
    // the note above DEFAULT_FONTS for why style/weight matter here too,
    // not just family. A developer-supplied `fonts` list is presumed to
    // name real, distinct fonts, so it only needs family.
    _fontList() {
      var raw = this._strAttr('fonts', '');
      if (!raw) return DEFAULT_FONTS.slice();
      return raw.split(';').map(function (s) { return s.trim(); }).filter(Boolean).map(normalizeFont);
    }

    _buildFontSwatches() {
      var self = this;
      var fonts = this._fontList();
      if (!fonts.some(function (f) { return sameFont(f, self._font); })) this._font = fonts[0];

      this._swatchesEl.innerHTML = '';
      fonts.forEach(function (font) {
        var swatch = self._genhtml({
          type: 'button',
          attr: {
            type: 'button', class: 'font-swatch', part: 'font-swatch',
            style: 'font-family:' + font.family + '; font-style:' + font.style + '; font-weight:' + font.weight + ';'
          },
          text: 'Signature',
          events: { click: function () { self._selectFont(font); } }
        });
        // Every swatch shows the same word, so name them by font.
        var fontName = String(font.family).split(',')[0].replace(/["']/g, '').trim() || 'Font';
        swatch.setAttribute('aria-label', 'Signature font: ' + fontName);
        self._swatchesEl.appendChild(swatch);
      });
      this._highlightFontSwatch();
    }

    _highlightFontSwatch() {
      var self = this;
      var fonts = this._fontList();
      var idx = fonts.findIndex(function (f) { return sameFont(f, self._font); });
      var swatches = this._swatchesEl.children;
      for (var i = 0; i < swatches.length; i++) {
        swatches[i].classList.toggle('active', i === idx);
        swatches[i].setAttribute('aria-pressed', i === idx ? 'true' : 'false');
      }
    }

    _selectFont(font) {
      this._font = font;
      this._highlightFontSwatch();
      this._updatePreview();
      this._emitInput();
    }

    // ---- type mode ----
    _updatePreview() {
      var font = this._font || { family: '', style: 'normal', weight: 'normal' };
      this._previewText.style.fontFamily = font.family;
      this._previewText.style.fontStyle = font.style;
      this._previewText.style.fontWeight = font.weight;
      this._previewText.textContent = this._text;
    }

    _onNameInput() {
      this._text = this._nameInput.value;
      this._updatePreview();
      this._emitInput();
    }

    _onNameBlur() { this._commit(); }

    // ---- mode switching ----
    _onTabClick(e) {
      var mode = e.currentTarget.dataset.mode;
      this.mode = mode;
    }

    get mode() { return this._mode; }
    set mode(m) {
      if (this._boolAttr('no-draw')) m = 'type';
      if (m !== 'type' && m !== 'draw') return;
      if (m === this._mode) return;
      this._mode = m;
      this.setAttribute('data-mode', m);
      this._syncModeUI();
      if (m === 'draw') this._resizeCanvas();
      this.emit('mode-change', { mode: m });
    }

    _syncModeUI() {
      if (!this._tabType) return;
      this._tabType.classList.toggle('active', this._mode === 'type');
      this._tabDraw.classList.toggle('active', this._mode === 'draw');
      this._tabType.setAttribute('aria-pressed', this._mode === 'type' ? 'true' : 'false');
      this._tabDraw.setAttribute('aria-pressed', this._mode === 'draw' ? 'true' : 'false');
    }

    // ---- draw mode ----
    _onResize() { this._resizeCanvas(); }

    _resizeCanvas() {
      if (!this._canvas || !this._canvas.isConnected) return;
      var rect = this._canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      var dpr = window.devicePixelRatio || 1;
      // Preserve existing strokes across a resize (e.g. container width
      // change) by snapshotting and redrawing scaled — best-effort only,
      // a drastic resize can still crop/distort in-progress ink.
      var snapshot = this._hasStroke ? this._canvas.toDataURL() : null;
      this._canvas.width = rect.width * dpr;
      this._canvas.height = rect.height * dpr;
      this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._ctx.lineCap = 'round';
      this._ctx.lineJoin = 'round';
      this._ctx.lineWidth = 2;
      this._ctx.strokeStyle = this._penColor();
      if (snapshot) {
        var img = new Image();
        var self = this;
        img.onload = function () { self._ctx.drawImage(img, 0, 0, rect.width, rect.height); };
        img.src = snapshot;
      }
    }

    // Canvas 2D's strokeStyle doesn't understand the CSS keyword
    // "currentColor" — it needs an actual resolved color — so fall back
    // to the element's computed text color, then a hard default.
    _penColor() {
      var explicit = this._strAttr('pen-color', '');
      if (explicit) return explicit;
      var computed = window.getComputedStyle(this).color;
      return computed || '#111827';
    }

    _canvasPoint(e) {
      var rect = this._canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    _onCanvasPointerDown(e) {
      if (this._boolAttr('disabled') || this._boolAttr('readonly')) return;
      this._drawing = true;
      this._canvas.setPointerCapture(e.pointerId);
      this._ctx.strokeStyle = this._penColor();
      var p = this._canvasPoint(e);
      this._ctx.beginPath();
      this._ctx.moveTo(p.x, p.y);
      this._canvas.addEventListener('pointermove', this._onCanvasPointerMove);
      this._canvas.addEventListener('pointerup', this._onCanvasPointerUp);
      this._canvas.addEventListener('pointercancel', this._onCanvasPointerUp);
    }

    _onCanvasPointerMove(e) {
      if (!this._drawing) return;
      var p = this._canvasPoint(e);
      this._ctx.lineTo(p.x, p.y);
      this._ctx.stroke();
      if (!this._hasStroke) {
        this._hasStroke = true;
        this._drawPlaceholder.classList.add('hidden');
      }
      this._emitInput();
    }

    _onCanvasPointerUp(e) {
      this._drawing = false;
      this._canvas.removeEventListener('pointermove', this._onCanvasPointerMove);
      this._canvas.removeEventListener('pointerup', this._onCanvasPointerUp);
      this._canvas.removeEventListener('pointercancel', this._onCanvasPointerUp);
      this._commit();
    }

    // ---- attribute -> DOM sync ----
    _syncAttrs() {
      var label = this._strAttr('label', '');
      var helper = this._strAttr('helper', '');
      var error = this._strAttr('error', '');
      var disabled = this._boolAttr('disabled');
      var readonly = this._boolAttr('readonly');

      this._labelText.textContent = label;
      this._helperEl.textContent = error || helper;
      this._helperEl.classList.toggle('error', !!error);
      this.toggleAttribute('data-invalid', !!error);

      // The whole widget is one named group; the name box inside is named
      // by the label (the visible label is a <div>, so `for` can't do it).
      var groupName = this._a11yName([label], 'Signature', 'Add a label attribute');
      this._ensureAttr('role', 'group');
      this._ensureAttr('aria-label', groupName);
      this._nameInput.setAttribute('aria-label', groupName + ': type your full name');
      if (error || helper) this._nameInput.setAttribute('aria-describedby', this._helperEl.id);
      else this._nameInput.removeAttribute('aria-describedby');
      if (error) this._nameInput.setAttribute('aria-invalid', 'true'); else this._nameInput.removeAttribute('aria-invalid');

      this._nameInput.disabled = disabled;
      this._nameInput.readOnly = readonly;
      this._tabType.disabled = disabled || readonly;
      this._tabDraw.disabled = disabled || readonly;
      this._clearBtn.disabled = disabled || readonly;
      this._reportValidity();
    }

    // ---- clear / commit ----
    _onClearClick() { this.clear(); }

    clear() {
      if (this._mode === 'type') {
        this._text = '';
        this._nameInput.value = '';
        this._updatePreview();
      } else {
        if (this._ctx && this._canvas.width) this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        this._hasStroke = false;
        this._drawPlaceholder.classList.remove('hidden');
      }
      this._emitInput();
      this._commit();
    }

    isEmpty() {
      return this._mode === 'type' ? !this._text.trim() : !this._hasStroke;
    }

    _emitInput() {
      this._reportValue();
      this.emit('input', { value: this.value });
    }

    _commit(opts) {
      opts = opts || {};
      var current = this.value;
      var changed = JSON.stringify(current) !== JSON.stringify(this._lastCommitted);
      this._reportValue();
      this._reportValidity();
      if (!changed) return;
      this._lastCommitted = current;
      if (!opts.silent) this.emit('change', { value: current });
    }

    // ---- value ----
    // Public .value.font is the plain family string (matching the
    // documented shape); style/weight are an internal rendering detail
    // used to keep the default swatches visually distinct (see the note
    // above DEFAULT_FONTS) and aren't part of the public contract.
    get value() {
      return this._mode === 'type'
        ? { mode: 'type', text: this._text, font: this._font ? this._font.family : null }
        : { mode: 'draw', dataUrl: this._hasStroke ? this._canvas.toDataURL('image/png') : '' };
    }
    set value(v) { this.setValue(v); }

    // Same as `.value = v`, but takes a second options argument — a
    // plain setter can't accept one, and {silent:true} is the one case
    // a property accessor alone can't cover (skipping the lwt-change
    // emit when you're syncing state programmatically rather than
    // responding to a user typing/drawing). Note the draw-mode branch
    // commits asynchronously once the data URL image finishes loading,
    // so opts is threaded through that callback too.
    setValue(v, opts) {
      opts = opts || {};
      if (typeof v === 'string') {
        this.mode = 'type';
        this._text = v;
        this._nameInput.value = v;
        this._updatePreview();
      } else if (v && v.mode === 'draw' && v.dataUrl) {
        this.mode = 'draw';
        var self = this;
        var img = new Image();
        img.onload = function () {
          self._resizeCanvas();
          self._ctx.drawImage(img, 0, 0, self._canvas.clientWidth, self._canvas.clientHeight);
          self._hasStroke = true;
          self._drawPlaceholder.classList.add('hidden');
          self._commit(opts);
        };
        img.src = v.dataUrl;
        return this;
      } else if (v) {
        this.mode = 'type';
        this._text = v.text || '';
        if (v.font) this._font = this._resolveFont(v.font);
        this._nameInput.value = this._text;
        this._highlightFontSwatch();
        this._updatePreview();
      }
      this._commit(opts);
      return this;
    }

    // Looks up a family string against the current font list (so its
    // style/weight come along); falls back to plain normal/normal for a
    // family that isn't one of the offered swatches.
    _resolveFont(family) {
      var match = this._fontList().find(function (f) { return f.family === family; });
      return match || { family: family, style: 'normal', weight: 'normal' };
    }

    toDataURL() {
      if (this._mode === 'draw') {
        return this._hasStroke ? this._canvas.toDataURL('image/png') : '';
      }
      if (!this._text.trim()) return '';
      var font = this._font || { family: 'cursive', style: 'normal', weight: 'normal' };
      var canvas = document.createElement('canvas');
      var dpr = window.devicePixelRatio || 1;
      var width = 480, height = 140;
      canvas.width = width * dpr; canvas.height = height * dpr;
      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = getComputedStyle(this._previewText).color || '#111827';
      ctx.font = font.style + ' ' + font.weight + ' 48px ' + font.family;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      ctx.fillText(this._text, width / 2, height * 0.62);
      return canvas.toDataURL('image/png');
    }

    focus() { if (this._mode === 'type' && this._nameInput) this._nameInput.focus(); }
    blur() { if (this._nameInput) this._nameInput.blur(); }

    checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
    reportValidity() { return this._internals ? this._internals.reportValidity() : true; }

    _reportValue() {
      if (!this._internals) return;
      var name = this._strAttr('name', '');
      if (!name || this.isEmpty()) { this._internals.setFormValue(null); return; }
      this._internals.setFormValue(this.toDataURL());
    }

    _reportValidity() {
      if (!this._internals) return;
      var required = this._boolAttr('required');
      if (required && this.isEmpty()) {
        this._internals.setValidity({ valueMissing: true }, 'Please provide a signature.', this._mode === 'type' ? this._nameInput : this._canvas);
      } else {
        this._internals.setValidity({});
      }
    }
  }

  LWTSignature.formAssociated = true;
  window.LWT.define('lwtf-signature', LWTSignature);
})();

/* ---- lwt-frm-slider.js ---- */
/*!
 * <lwtf-slider>
 * A range slider that supports any number of handles — one plain slider,
 * a dual-handle range, or N handles carving the track into as many
 * segments as you need (a temperature gradient, an opening-hours picker
 * with morning/afternoon blocks, whatever). Each handle drags via
 * pointer events (mouse + touch + pen in one code path), steps with the
 * keyboard, and can never cross its neighbors.
 *
 *   <!-- single handle -->
 *   <lwtf-slider label="Volume" value="40"></lwtf-slider>
 *
 *   <!-- dual-handle range -->
 *   <lwtf-slider label="Price" min="0" max="500" step="10" value="100,350"></lwtf-slider>
 *
 *   <!-- N handles, ticks, floating tooltips -->
 *   <lwtf-slider value="20,50,80" ticks tooltip="hover"></lwtf-slider>
 *
 *   <!-- time-of-day labels (value is minutes-since-midnight) -->
 *   <lwtf-slider min="480" max="1320" step="60" value="540,720,780,1020"
 *     ticks tick-step="60" label-format="time"></lwtf-slider>
 *
 *   <script>
 *     var el = document.querySelector('lwtf-slider');
 *     el.value;                 // -> [40] or [100, 350] etc — always an array
 *     el.value = [20, 50, 80];  // re-set; handle count follows the array length
 *     el.addEventListener('lwt-change', function (e) { console.log(e.detail.value); });
 *   </script>
 *
 * Segment coloring (the track between/around handles — N+1 segments for
 * N handles: before the first, between each pair, after the last) is
 * entirely CSS-driven — no JS config needed for color:
 *
 *   lwtf-slider::part(segment-0) { background: #3b82f6; }
 *   lwtf-slider::part(segment-1) { background: #10b981; }
 *   lwtf-slider { --lwt-slider-segment-2: #ef4444; }
 *
 * A gap you don't want highlighted (like the space between the morning
 * and afternoon blocks in an opening-hours picker) is just a segment set
 * back to the track color — the slider itself doesn't distinguish
 * "selected" vs "gap" segments, it only draws N+1 of them.
 *
 * ---------------------------------------------------------------------
 * Attributes
 * ---------------------------------------------------------------------
 *   label, helper, error — display / form basics
 *   min, max, step  — numeric range (defaults 0, 100, 1)
 *   value           — initial "v1,v2,..." pair; handle count follows the
 *                      count of values given (default: one handle at min).
 *                      Read once at connect (use .value after).
 *   name, required, disabled, readonly — standard form states
 *   ticks           — boolean; draws tick marks (and labels) along the track
 *   tick-step       — spacing between ticks, in value units (default: a
 *                      step multiple that lands near 10 ticks)
 *   label-format    — "" (default: plain number, wrapped in the unit
 *                      prefix/suffix) | "time" (treats the value as
 *                      minutes-since-midnight and formats "9 AM" style)
 *   unit-prefix     — string placed before plain-number labels (e.g. "$")
 *   unit-suffix     — string placed after plain-number labels (e.g. "%",
 *                      " days" -- include the space if you want one)
 *   unit            — alias for unit-suffix (kept for existing markup)
 *   tooltip         — "none" (default) | "hover" (shown while
 *                      dragging/hovering/focusing a handle) | "always"
 *
 * ---------------------------------------------------------------------
 * Properties / methods
 * ---------------------------------------------------------------------
 *   .value          — get/set array of numbers, one per handle. Setting
 *                      a longer/shorter array changes the handle count.
 *   .formatLabel    — assignable function(value) -> string; overrides
 *                      `label-format` for both ticks and tooltips.
 *   .focus() / .blur() — proxied to the first handle
 *   .checkValidity() / .reportValidity()
 *
 * ---------------------------------------------------------------------
 * Events
 * ---------------------------------------------------------------------
 *   lwtf-input   — every value change while dragging/stepping; detail:
 *                 { value, index } (index of the handle that moved)
 *   lwt-change  — a drag/keyboard interaction ends with a changed value,
 *                 or .value was set; detail: { value }
 *
 * ---------------------------------------------------------------------
 * Form participation
 * ---------------------------------------------------------------------
 * Uses ElementInternals (formAssociated + setFormValue + setValidity) —
 * submits one form entry per handle under `name` via FormData, same
 * pattern as <lwtf-choices multiple>/<lwtf-transfer-list>.
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-frm-slider.js requires lwt-core.js to be loaded first.');
  }

  var uid = 0;
  var supportsInternals = typeof HTMLElement !== 'undefined' && !!HTMLElement.prototype.attachInternals;

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function roundToStep(v, min, step) {
    if (!(step > 0)) return v;
    var n = Math.round((v - min) / step);
    return min + n * step;
  }

  function formatTime(minutes) {
    var m = Math.round(minutes) % 1440;
    if (m < 0) m += 1440;
    var h24 = Math.floor(m / 60);
    var mm = m % 60;
    var period = h24 < 12 ? 'AM' : 'PM';
    var h12 = h24 % 12; if (h12 === 0) h12 = 12;
    return mm === 0 ? (h12 + ' ' + period) : (h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + period);
  }

  var TEMPLATE =
    '<div class="field-label" part="label">' +
    '  <span class="label-text" part="label-text"></span>' +
    '  <span class="required-mark" part="required">*</span>' +
    '</div>' +
    '<div class="slider-wrap" part="wrap">' +
    '  <div class="track" part="track"></div>' +
    '  <div class="segments" part="segments"></div>' +
    '  <div class="handles" part="handles"></div>' +
    '</div>' +
    '<div class="ticks" part="ticks"></div>' +
    '<div class="below" part="below">' +
    '  <span class="helper" part="helper"></span>' +
    '</div>';

  var CSS = `
    :host {
      display: block;
      color: inherit;
      font-family: inherit;
      box-sizing: border-box;
    }
    :host([hidden]) { display: none; }
    * { box-sizing: border-box; }
    .field-label {
      display: flex;
      gap: 0.2rem;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 0.6rem;
      color: var(--lwt-slider-label-color, var(--lwt-color-text, #111827));
    }
    .field-label:empty, .label-text:empty { display: none; }
    .required-mark { color: var(--lwt-color-danger, #ef4444); display: none; }
    :host([required]) .required-mark { display: inline; }
    .slider-wrap {
      position: relative;
      height: 1.6rem;
      margin: 0 0.7rem;
      touch-action: none;
    }
    .track {
      position: absolute;
      top: 50%;
      left: -0.7rem;
      right: -0.7rem;
      height: var(--lwt-slider-track-height, 4px);
      border-radius: 2px;
      transform: translateY(-50%);
      background: var(--lwt-slider-track, var(--lwt-color-border-strong, #d1d5db));
    }
    .segments {
      position: absolute;
      top: 50%;
      left: -0.7rem;
      right: -0.7rem;
      height: var(--lwt-slider-track-height, 4px);
      transform: translateY(-50%);
    }
    .segment {
      position: absolute;
      top: 0;
      height: 100%;
      background: var(--lwt-slider-segment-color, var(--lwt-color-primary, #2563eb));
    }
    .handles { position: absolute; inset: 0; }
    .handle {
      position: absolute;
      top: 50%;
      width: var(--lwt-slider-handle-size, 1.5rem);
      height: var(--lwt-slider-handle-size, 1.5rem);
      border-radius: 999px;
      transform: translate(-50%, -50%);
      cursor: grab;
      touch-action: none;
      background: var(--lwt-slider-handle-bg, #fff);
      border: 2px solid var(--lwt-slider-handle-border, var(--lwt-color-primary, #2563eb));
      box-shadow: 0 1px 3px var(--lwt-color-shadow, rgba(0,0,0,0.25));
    }
    .handle:active { cursor: grabbing; }
    .handle:focus-visible {
      outline: none;
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--lwt-slider-handle-border, var(--lwt-color-primary, #2563eb)) 25%, transparent);
    }
    :host([disabled]) .handle { cursor: not-allowed; opacity: 0.6; }
    :host([readonly]) .handle { cursor: default; }
    :host([data-invalid]) .handle { border-color: var(--lwt-slider-error-color, var(--lwt-color-danger, #ef4444)); }
    .tooltip {
      position: absolute;
      bottom: calc(100% + 0.5rem);
      left: 50%;
      transform: translateX(-50%);
      background: var(--lwt-slider-tooltip-bg, var(--lwt-color-text, #111827));
      color: var(--lwt-slider-tooltip-color, #fff);
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 120ms ease;
    }
    .handle.tt-show .tooltip { opacity: 1; }
    :host([tooltip="always"]) .tooltip { opacity: 1; }
    .ticks {
      position: relative;
      height: 1.1rem;
      margin: 0.5rem 0.7rem 0;
      display: none;
    }
    :host([ticks]) .ticks { display: block; }
    .tick {
      position: absolute;
      top: 0;
      transform: translateX(-50%);
      font-size: 0.68rem;
      color: var(--lwt-color-text-muted, #6b7280);
      white-space: nowrap;
    }
    .below {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin-top: 0.4rem;
      font-size: 0.78rem;
      min-height: 1rem;
    }
    .helper { flex: 1; color: var(--lwt-slider-helper-color, var(--lwt-color-text-muted, #6b7280)); }
    .helper.error { color: var(--lwt-slider-error-color, var(--lwt-color-danger, #ef4444)); }
    .helper:empty { display: none; }
  `;

  class LWTSlider extends window.LWT.Element {
    static get observedAttributes() {
      return ['label', 'helper', 'error', 'min', 'max', 'step', 'name', 'required',
              'disabled', 'readonly', 'ticks', 'tick-step', 'label-format', 'unit', 'unit-prefix', 'unit-suffix', 'tooltip',
              'aria-label', 'aria-labelledby'];
    }

    constructor() {
      super();

      if (supportsInternals) {
        try { this._internals = this.attachInternals(); }
        catch (e) { this._internals = null; }
      }

      this._initialized = false;
      this._values = [0];
      this._lastCommitted = null;
      this._drag = null; // { idx, pointerId }
      this.formatLabel = null; // optional user override, (value) -> string

      this._onTrackPointerDown = this._onTrackPointerDown.bind(this);
      this._onPointerMove = this._onPointerMove.bind(this);
      this._onPointerUp = this._onPointerUp.bind(this);
    }

    connectedCallback() {
      super.connectedCallback();
      // Read-only classification attribute — see lwt-frm-choices.js for
      // the convention every lwtf- element follows.
      this.setAttribute('control-type', 'range');
      if (!this._initialized) {
        this._initialized = true;
        var initial = this._parseValueAttr(this._strAttr('value', ''));
        this._values = initial || [this._min()];
        this._lastCommitted = this._values.slice();
        this._rebuild();
        this._reportValue();
      }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (!this._handlesEl) return; // not rendered yet
      if (['min', 'max', 'step', 'ticks', 'tick-step', 'label-format', 'unit', 'unit-prefix', 'unit-suffix'].indexOf(name) !== -1) {
        this._rebuild();
      }
      this._syncAttrs();
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      var root = this._root;
      this._labelEl = root.querySelector('.field-label');
      this._labelText = root.querySelector('.label-text');
      this._wrap = root.querySelector('.slider-wrap');
      this._track = root.querySelector('.track');
      this._segmentsEl = root.querySelector('.segments');
      this._handlesEl = root.querySelector('.handles');
      this._ticksEl = root.querySelector('.ticks');
      this._helperEl = root.querySelector('.helper');

      this._id = 'lwt-slider-' + (++uid);
      this._helperEl.id = this._id + '-helper';
      this._wrap.addEventListener('pointerdown', this._onTrackPointerDown);

      this._rebuild();
      this._syncAttrs();
    }

    // ---- range helpers ----
    _min() { var v = parseFloat(this._strAttr('min', '0')); return isNaN(v) ? 0 : v; }
    _max() { var v = parseFloat(this._strAttr('max', '100')); var min = this._min(); return isNaN(v) || v <= min ? min + 100 : v; }
    _step() { var v = parseFloat(this._strAttr('step', '1')); return (isNaN(v) || v <= 0) ? 1 : v; }

    _parseValueAttr(str) {
      if (!str) return null;
      var min = this._min(), max = this._max(), step = this._step();
      var parts = String(str).split(',').map(function (s) { return parseFloat(s.trim()); }).filter(function (n) { return !isNaN(n); });
      if (!parts.length) return null;
      return parts.map(function (v) { return clamp(roundToStep(v, min, step), min, max); }).sort(function (a, b) { return a - b; });
    }

    // ---- build ----
    _rebuild() {
      var self = this;
      var min = this._min(), max = this._max();
      // Reclamp existing values into the (possibly new) min/max/step.
      this._values = this._values.map(function (v) { return clamp(roundToStep(v, min, self._step()), min, max); });

      this._handlesEl.innerHTML = '';
      this._handleEls = [];
      this._tooltipEls = [];

      this._values.forEach(function (v, i) {
        var handle = self._genhtml({
          type: 'div',
          attr: {
            class: 'handle', part: 'handle', tabindex: '0', role: 'slider',
            'aria-valuemin': String(min), 'aria-valuemax': String(max),
            'aria-orientation': 'horizontal', 'data-idx': String(i), id: self._id + '-h' + i
          },
          html: '<span class="tooltip" part="tooltip"></span>',
          events: {
            pointerdown: function (e) { self._onHandlePointerDown(e, i); },
            keydown: function (e) { self._onHandleKeydown(e, i); },
            mouseenter: function () { self._setTooltipVisible(i, true); },
            mouseleave: function () { if (!self._drag || self._drag.idx !== i) self._setTooltipVisible(i, false); },
            focus: function () { self._setTooltipVisible(i, true); },
            blur: function () { if (!self._drag || self._drag.idx !== i) self._setTooltipVisible(i, false); }
          }
        });
        self._handlesEl.appendChild(handle);
        self._handleEls.push(handle);
        self._tooltipEls.push(handle.querySelector('.tooltip'));
      });

      this._buildSegments();
      this._buildTicks();
      this._syncPositions();
      if (this._labelText) this._syncAttrs(); // new handles need their names/states again
    }

    _buildSegments() {
      var self = this;
      this._segmentsEl.innerHTML = '';
      var count = this._values.length + 1;
      for (var i = 0; i < count; i++) {
        var seg = this._genhtml({
          type: 'div',
          attr: {
            class: 'segment', part: 'segment-' + i,
            style: '--lwt-slider-segment-color: var(--lwt-slider-segment-' + i + ', var(--lwt-color-primary, #2563eb));'
          }
        });
        this._segmentsEl.appendChild(seg);
      }
    }

    _buildTicks() {
      var self = this;
      this._ticksEl.innerHTML = '';
      if (!this._boolAttr('ticks')) return;
      var min = this._min(), max = this._max();
      var span = max - min;
      if (span <= 0) return;
      var tickStep = parseFloat(this._strAttr('tick-step', ''));
      if (isNaN(tickStep) || tickStep <= 0) {
        var step = this._step();
        var target = span / 10;
        tickStep = Math.max(step, Math.round(target / step) * step);
      }
      for (var v = min; v <= max + 1e-9; v += tickStep) {
        var pct = ((clamp(v, min, max) - min) / span) * 100;
        var tick = this._genhtml({
          type: 'span',
          attr: { class: 'tick', part: 'tick', style: 'left:' + pct + '%;' },
          text: this._formatValue(v)
        });
        this._ticksEl.appendChild(tick);
      }
    }

    // ---- label formatting ----
    _formatValue(v) {
      if (typeof this.formatLabel === 'function') return this.formatLabel(v);
      var format = this._strAttr('label-format', '');
      if (format === 'time') return formatTime(v);
      var prefix = this._strAttr('unit-prefix', '');
      var suffix = this._strAttr('unit-suffix', this._strAttr('unit', ''));
      return prefix + (Math.round(v * 1000) / 1000) + suffix;
    }

    // ---- positions ----
    _pctFor(v) {
      var min = this._min(), max = this._max();
      var span = max - min;
      return span > 0 ? clamp(((v - min) / span) * 100, 0, 100) : 0;
    }

    _syncPositions() {
      var self = this;
      this._values.forEach(function (v, i) {
        var pct = self._pctFor(v);
        var handle = self._handleEls[i];
        if (!handle) return;
        handle.style.left = pct + '%';
        handle.setAttribute('aria-valuenow', String(v));
        handle.setAttribute('aria-valuetext', self._formatValue(v));
        var tt = self._tooltipEls[i];
        if (tt) tt.textContent = self._formatValue(v);
      });

      var min = this._min();
      var boundaries = [0].concat(this._values.map(function (v) { return self._pctFor(v); })).concat([100]);
      var segs = this._segmentsEl.children;
      for (var i = 0; i < segs.length; i++) {
        var left = boundaries[i], right = boundaries[i + 1];
        segs[i].style.left = left + '%';
        segs[i].style.width = Math.max(0, right - left) + '%';
      }
    }

    _setTooltipVisible(idx, visible) {
      var handle = this._handleEls[idx];
      if (!handle) return;
      handle.classList.toggle('tt-show', visible);
    }

    // ---- interaction: click-on-track ----
    _onTrackPointerDown(e) {
      if (this._boolAttr('disabled') || this._boolAttr('readonly')) return;
      if (e.target.closest && e.target.closest('.handle')) return; // handled by the handle itself
      var value = this._valueFromClientX(e.clientX);
      var idx = this._nearestHandleIndex(value);
      if (idx === -1) return;
      this._setHandleValue(idx, value, { emitInput: true });
      this._handleEls[idx].focus();
      // Let the same gesture continue dragging that handle.
      this._beginDrag(idx, e.pointerId);
    }

    _nearestHandleIndex(value) {
      if (!this._values.length) return -1;
      var best = 0, bestDist = Infinity;
      for (var i = 0; i < this._values.length; i++) {
        var d = Math.abs(this._values[i] - value);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      return best;
    }

    _valueFromClientX(clientX) {
      var rect = this._track.getBoundingClientRect();
      var pct = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
      pct = clamp(pct, 0, 1);
      var min = this._min(), max = this._max();
      return roundToStep(min + pct * (max - min), min, this._step());
    }

    // ---- interaction: dragging a handle ----
    _onHandlePointerDown(e, idx) {
      if (this._boolAttr('disabled') || this._boolAttr('readonly')) return;
      e.stopPropagation();
      this._handleEls[idx].focus();
      this._beginDrag(idx, e.pointerId);
    }

    _beginDrag(idx, pointerId) {
      this._drag = { idx: idx };
      this._setTooltipVisible(idx, true);
      document.addEventListener('pointermove', this._onPointerMove);
      document.addEventListener('pointerup', this._onPointerUp);
      document.addEventListener('pointercancel', this._onPointerUp);
    }

    _onPointerMove(e) {
      if (!this._drag) return;
      var value = this._valueFromClientX(e.clientX);
      this._setHandleValue(this._drag.idx, value, { emitInput: true });
    }

    _onPointerUp() {
      if (!this._drag) return;
      var idx = this._drag.idx;
      this._drag = null;
      document.removeEventListener('pointermove', this._onPointerMove);
      document.removeEventListener('pointerup', this._onPointerUp);
      document.removeEventListener('pointercancel', this._onPointerUp);
      if (document.activeElement !== this._handleEls[idx]) this._setTooltipVisible(idx, false);
      this._commitIfChanged();
    }

    // ---- interaction: keyboard ----
    _onHandleKeydown(e, idx) {
      if (this._boolAttr('disabled') || this._boolAttr('readonly')) return;
      var step = this._step();
      var min = this._min(), max = this._max();
      var current = this._values[idx];
      var next = null;

      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = current + step;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = current - step;
      else if (e.key === 'PageUp') next = current + step * 10;
      else if (e.key === 'PageDown') next = current - step * 10;
      else if (e.key === 'Home') next = this._lowerBound(idx, min);
      else if (e.key === 'End') next = this._upperBound(idx, max);
      else return;

      e.preventDefault();
      this._setHandleValue(idx, next, { emitInput: true });
      this._commitIfChanged();
    }

    _lowerBound(idx, min) { return idx > 0 ? this._values[idx - 1] : min; }
    _upperBound(idx, max) { return idx < this._values.length - 1 ? this._values[idx + 1] : max; }

    _setHandleValue(idx, rawValue, opts) {
      opts = opts || {};
      var min = this._min(), max = this._max(), step = this._step();
      var lo = this._lowerBound(idx, min);
      var hi = this._upperBound(idx, max);
      var value = clamp(roundToStep(rawValue, min, step), lo, hi);
      if (value === this._values[idx]) return;
      this._values[idx] = value;
      this._syncPositions();
      if (opts.emitInput) {
        this._reportValue();
        this.emit('input', { value: this.value, index: idx });
      }
    }

    _commitIfChanged() {
      var current = this.value;
      var changed = !this._lastCommitted || current.length !== this._lastCommitted.length ||
        current.some(function (v, i) { return v !== this._lastCommitted[i]; }, this);
      if (!changed) return;
      this._lastCommitted = current;
      this._reportValue();
      this._reportValidity();
      this.emit('change', { value: current });
    }

    // ---- attribute -> DOM sync ----
    _syncAttrs() {
      var label = this._strAttr('label', '');
      var helper = this._strAttr('helper', '');
      var error = this._strAttr('error', '');
      var disabled = this._boolAttr('disabled');
      var readonly = this._boolAttr('readonly');

      this._labelText.textContent = label;
      this._helperEl.textContent = error || helper;
      this._helperEl.classList.toggle('error', !!error);
      this.toggleAttribute('data-invalid', !!error);

      // Each handle needs a name: the label, plus "minimum"/"maximum" for
      // a two-handle range (or "value N of M" for more).
      var base = this._a11yName([label, window.LWT.a11y.humanize(this._strAttr('name', ''))], 'Value', 'Add a label attribute');
      var count = this._handleEls.length;
      var helperId = (error || helper) ? this._helperEl.id : '';
      this._handleEls.forEach(function (h, i) {
        h.tabIndex = disabled ? -1 : 0;
        h.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        if (readonly) h.setAttribute('aria-readonly', 'true'); else h.removeAttribute('aria-readonly');
        var suffix = count === 1 ? '' : (count === 2 ? (i === 0 ? ' minimum' : ' maximum') : ' value ' + (i + 1) + ' of ' + count);
        h.setAttribute('aria-label', base + suffix);
        if (helperId) h.setAttribute('aria-describedby', helperId); else h.removeAttribute('aria-describedby');
        if (error) h.setAttribute('aria-invalid', 'true'); else h.removeAttribute('aria-invalid');
      });
      if (count > 1) { this._ensureAttr('role', 'group'); this._ensureAttr('aria-label', base); }
    }

    // ---- value ----
    get value() { return this._values.slice(); }
    set value(arr) { this.setValue(arr); }

    // Same as `.value = arr`, but takes a second options argument — a
    // plain setter can't accept one, and {silent:true} is the one case
    // a property accessor alone can't cover (skipping the lwt-change
    // emit when you're syncing state programmatically rather than
    // responding to a user drag).
    setValue(arr, opts) {
      opts = opts || {};
      if (!arr || !arr.length) return this;
      var min = this._min(), max = this._max(), step = this._step();
      var vals = arr.map(function (v) { return clamp(roundToStep(parseFloat(v), min, step), min, max); })
        .sort(function (a, b) { return a - b; });
      this._values = vals;
      this._lastCommitted = vals.slice();
      this._rebuild();
      this._reportValue();
      this._reportValidity();
      if (!opts.silent) this.emit('change', { value: this.value });
      return this;
    }

    focus() { if (this._handleEls && this._handleEls[0]) this._handleEls[0].focus(); }
    blur() { if (this._handleEls) this._handleEls.forEach(function (h) { h.blur(); }); }

    checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
    reportValidity() { return this._internals ? this._internals.reportValidity() : true; }

    _reportValue() {
      if (!this._internals) return;
      var name = this._strAttr('name', '');
      if (!name) { this._internals.setFormValue(null); return; }
      if (typeof FormData !== 'undefined') {
        var fd = new FormData();
        this._values.forEach(function (v) { fd.append(name, String(v)); });
        this._internals.setFormValue(fd);
      } else {
        this._internals.setFormValue(this._values.join(','));
      }
    }

    _reportValidity() {
      if (!this._internals) return;
      var required = this._boolAttr('required');
      if (required && !this._values.length) {
        this._internals.setValidity({ valueMissing: true }, 'Please select a value.', this._handleEls[0]);
      } else {
        this._internals.setValidity({});
      }
    }
  }

  LWTSlider.formAssociated = true;
  window.LWT.define('lwtf-slider', LWTSlider);
})();

/* ---- lwt-frm-transfer-list.js ---- */
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

