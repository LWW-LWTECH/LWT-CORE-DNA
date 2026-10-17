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

  var TEMPLATE =
    '<label class="field-label" part="label"><span class="label-text"></span><span class="required-mark" hidden>*</span></label>' +
    '<div class="wrap" part="wrap">' +
    '  <div class="field-box" part="field-box">' +
    '    <div class="tags" part="tags"></div>' +
    '    <input class="field" part="input" autocomplete="off">' +
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
        if (e.target === this._input) return; // let the input's own focus handler fire
        e.preventDefault();
        // If the input is already focused (e.g. dropdown was closed after
        // the first pick but focus never left the field), .focus() below
        // is a no-op and fires no 'focus' event — so open explicitly too.
        if (document.activeElement === this._input) this._openDropdown();
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
