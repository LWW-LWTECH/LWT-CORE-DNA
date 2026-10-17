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
