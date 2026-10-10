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

  var CSS =
    ':host { display: block; font-family: inherit; color: var(--lwt-input-color, var(--lwt-color-text, #1f2937)); }' +
    ':host([hidden]) { display: none; }' +

    '.field-label { display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.35rem;' +
    '  color: var(--lwt-input-label-color, var(--lwt-color-text, #374151)); }' +
    '.required-mark { color: var(--lwt-input-required-color, var(--lwt-color-danger, #ef4444)); margin-left: 0.15rem; }' +

    '.wrap { position: relative; }' +
    '.field-box { position: relative; display: flex; align-items: center; box-sizing: border-box; width: 100%;' +
    '  min-height: 2.4rem; padding: 0 0.6rem; gap: 0.4rem; border-radius: 6px;' +
    '  background: var(--lwt-input-bg, var(--lwt-color-surface, #fff));' +
    '  border: 1px solid var(--lwt-input-border, var(--lwt-color-border-strong, #d1d5db));' +
    '  transition: border-color 120ms ease, box-shadow 120ms ease; }' +
    '.field-box:focus-within { border-color: var(--lwt-input-focus-color, var(--lwt-focus-ring, #2563eb));' +
    '  box-shadow: 0 0 0 3px color-mix(in srgb, var(--lwt-input-focus-color, var(--lwt-focus-ring, #2563eb)) 22%, transparent); }' +
    ':host([disabled]) .field-box { opacity: 0.6; cursor: not-allowed; background: var(--lwt-color-surface-muted, #f3f4f6); }' +
    ':host([data-invalid]) .field-box { border-color: var(--lwt-input-error-color, var(--lwt-color-danger, #ef4444)); }' +
    ':host([data-invalid]) .field-box:focus-within { box-shadow: 0 0 0 3px color-mix(in srgb, var(--lwt-input-error-color, var(--lwt-color-danger, #ef4444)) 22%, transparent); }' +

    '.field { flex: 1; min-width: 0; border: none; outline: none; background: transparent; padding: 0.5rem 0;' +
    '  font: inherit; font-size: 0.95rem; color: inherit; }' +
    '.field::placeholder { color: var(--lwt-color-text-subtle, #6b7280); }' +
    '.field:disabled { cursor: not-allowed; }' +

    '.icon-slot { flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: var(--lwt-color-text-muted, #6b7280); }' +
    '.icon-slot.hidden { display: none; }' +
    '.icon-slot ::slotted(*) { width: 1.05rem; height: 1.05rem; display: block; }' +
    '.built-in-btn { flex-shrink: 0; display: none; align-items: center; justify-content: center; width: 1.6rem; height: 1.6rem;' +
    '  border: none; background: none; padding: 0; margin: 0; border-radius: 4px; cursor: pointer; color: var(--lwt-color-text-muted, #6b7280); }' +
    '.built-in-btn:hover { color: var(--lwt-color-text, #374151); background: var(--lwt-color-surface-alt, #f3f4f6); }' +
    '.built-in-btn:focus-visible { outline: 2px solid var(--lwt-focus-ring, #2563eb); outline-offset: 1px; }' +
    '.built-in-btn.visible { display: inline-flex; }' +
    '.built-in-btn svg { width: 1rem; height: 1rem; }' +

    '.below { display: flex; align-items: flex-start; gap: 0.75rem; margin-top: 0.3rem; font-size: 0.78rem; min-height: 1rem; }' +
    '.helper { flex: 1; color: var(--lwt-input-helper-color, var(--lwt-color-text-muted, #6b7280)); }' +
    '.helper.error { color: var(--lwt-input-error-color, var(--lwt-color-danger, #ef4444)); }' +
    '.counter { flex-shrink: 0; color: var(--lwt-color-text-muted, #6b7280); font-variant-numeric: tabular-nums; }' +
    '.counter.over { color: var(--lwt-input-error-color, var(--lwt-color-danger, #ef4444)); }' +

    '.listbox { position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 10; overflow: auto;' +
    '  background: var(--lwt-input-bg, var(--lwt-color-surface, #fff));' +
    '  border: 1px solid var(--lwt-color-border-strong, #d1d5db); border-radius: 6px;' +
    '  box-shadow: 0 8px 20px var(--lwt-color-shadow, rgba(0,0,0,0.15));' +
    '  padding: 0.25rem 0; margin: 0; list-style: none;' +
    '  display: none; }' +
    '.listbox.open { display: block; }' +
    '.option { display: flex; align-items: center; padding: 0.45rem 0.75rem; cursor: pointer; font-size: 0.9rem; }' +
    '.option[aria-selected="true"] { background: var(--lwt-color-primary-soft, #eff6ff); color: var(--lwt-color-primary, #2563eb); }' +
    '.option[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; }' +
    '.option .match { font-weight: 700; color: var(--lwt-color-primary, #2563eb); }' +
    '.option[aria-selected="true"] .match { color: inherit; }' +
    '.empty { padding: 0.75rem; color: var(--lwt-color-text-muted, #6b7280); font-size: 0.85rem; text-align: center; font-style: italic; }' +

    '.tooltip { position: absolute; z-index: 11; max-width: 260px;' +
    '  background: var(--lwt-color-surface, #fff); color: var(--lwt-color-text, #1f2937);' +
    '  border: 1px solid var(--lwt-color-border, #e5e7eb); border-radius: 8px;' +
    '  box-shadow: 0 8px 20px var(--lwt-color-shadow, rgba(0,0,0,0.15));' +
    '  padding: 0.6rem 0.7rem; font-size: 0.85rem; line-height: 1.4;' +
    '  display: none; pointer-events: none; }' +
    '.tooltip.open { display: block; }' +
    '.tooltip img { max-width: 100%; height: auto; display: block; }' +
    '.tooltip *:first-child { margin-top: 0; }' +
    '.tooltip *:last-child { margin-bottom: 0; }';

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
