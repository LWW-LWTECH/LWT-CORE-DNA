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

  var CSS =
    ':host { display: block; font-family: inherit; color: var(--lwt-choices-color, var(--lwt-color-text, #1f2937)); }' +
    ':host([hidden]) { display: none; }' +

    '.group-label { display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.5rem;' +
    '  color: var(--lwt-choices-label-color, var(--lwt-color-text, #374151)); }' +
    '.required-mark { color: var(--lwt-choices-required-color, var(--lwt-color-danger, #ef4444)); margin-left: 0.15rem; }' +

    '.wrap { display: flex; flex-direction: column; gap: 0.65rem; }' +
    ':host([direction="horizontal"]) .wrap { flex-direction: row; flex-wrap: wrap; gap: 0.5rem 1.5rem; }' +
    ':host([layout="grid"]) .wrap { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--lwt-choices-tile-size, 140px), 1fr)); gap: 1rem; }' +
    ':host([disabled]) .wrap { opacity: 0.6; }' +

    '.below { margin-top: 0.45rem; font-size: 0.78rem; min-height: 1rem; }' +
    '.helper { color: var(--lwt-choices-helper-color, var(--lwt-color-text-muted, #6b7280)); }' +
    '.helper.error { color: var(--lwt-choices-error-color, var(--lwt-color-danger, #ef4444)); }';

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
