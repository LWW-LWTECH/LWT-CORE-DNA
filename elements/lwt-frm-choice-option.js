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

  var CSS =
    ':host { display: flex; align-items: center; gap: 0.6rem; cursor: pointer; font: inherit; font-size: 0.95rem; min-height: 24px;' +
    '  color: var(--lwt-choices-color, var(--lwt-color-text, #1f2937)); user-select: none; outline: none; }' +
    ':host([hidden]) { display: none; }' +
    ':host([disabled]) { cursor: not-allowed; opacity: 0.55; }' +

    '.box { flex-shrink: 0; width: 1.35rem; height: 1.35rem; box-sizing: border-box; border-radius: 4px;' +
    '  border: 2px solid var(--lwt-choices-border, var(--lwt-color-border-strong, #d1d5db));' +
    '  background: var(--lwt-choices-bg, var(--lwt-color-surface, #fff));' +
    '  display: flex; align-items: center; justify-content: center;' +
    '  transition: background 120ms ease, border-color 120ms ease; }' +
    ':host([role="radio"]) .box { border-radius: 50%; }' +

    '.check { width: 1rem; height: 1rem; color: var(--lwt-choices-check-color, #fff); opacity: 0; transform: scale(0.5);' +
    '  transition: opacity 120ms ease, transform 120ms ease; }' +

    ':host([checked]) .box { background: var(--lwt-choices-checked-bg, var(--lwt-color-success, #15803d));' +
    '  border-color: var(--lwt-choices-checked-border, var(--lwt-color-success, #15803d)); }' +
    ':host([checked]) .check { opacity: 1; transform: scale(1); }' +

    ':host([disabled]) .box { background: var(--lwt-color-surface-muted, #f3f4f6); border-color: var(--lwt-color-border, #e5e7eb); }' +
    ':host([disabled][checked]) .box { background: var(--lwt-choices-disabled-checked-bg, #d1d5db);' +
    '  border-color: var(--lwt-choices-disabled-checked-bg, #d1d5db); }' +

    ':host(:focus-visible) .box { outline: 2px solid var(--lwt-choices-focus-color, var(--lwt-focus-ring, #2563eb)); outline-offset: 2px; }' +

    '.label { min-width: 0; }' +

    // ---- tile mode (image set) ----
    // A distinct enough layout that it's easiest to override every
    // shared part rather than fight the row-mode flex/box rules above.
    // Each selector here is two attribute-matches deep ([image] plus
    // whatever else), which makes it more specific than the row-mode
    // rules regardless of declaration order.
    '.tile-media { display: none; }' +
    ':host([image]) { display: inline-flex; flex-direction: column; align-items: center; justify-content: flex-start;' +
    '  gap: 0.6rem; width: var(--lwt-choices-tile-size, 140px); box-sizing: border-box; padding: 1.1rem 0.75rem;' +
    '  position: relative; overflow: hidden; border-radius: 10px;' +
    '  background: var(--lwt-choices-tile-bg, var(--lwt-color-surface, #fff));' +
    '  border: 3px solid var(--lwt-choices-tile-border, var(--lwt-color-border-strong, #d1d5db));' +
    '  transition: border-color 120ms ease; }' +
    ':host([image]) .tile-media { display: flex; align-items: center; justify-content: center; width: 100%; flex: 1; min-height: 2.5rem; }' +
    ':host([image]) .tile-img { max-width: 100%; max-height: 3.25rem; object-fit: contain; display: block; }' +
    ':host([image]) .label { text-align: center; font-size: 0.9rem; }' +
    ':host([image]) .box { position: absolute; top: 0; left: 0; width: 2.2rem; height: 2.2rem; border: none; border-radius: 0;' +
    '  background: transparent; clip-path: polygon(0 0, 100% 0, 0 100%);' +
    '  display: flex; align-items: flex-start; justify-content: flex-start; padding: 0.25rem 0 0 0.2rem;' +
    '  opacity: 0; transition: opacity 120ms ease; }' +
    ':host([image]) .check { width: 0.85rem; height: 0.85rem; }' +
    ':host([image][checked]) .box { opacity: 1; background: var(--lwt-choices-tile-accent, var(--lwt-color-primary, #2563eb)); }' +
    ':host([image][checked]) { border-color: var(--lwt-choices-tile-accent, var(--lwt-color-primary, #2563eb)); }' +
    ':host([image][disabled]) { background: var(--lwt-color-surface-muted, #f3f4f6); border-color: var(--lwt-color-border, #e5e7eb); }' +
    ':host([image]:focus-visible) { outline: 2px solid var(--lwt-choices-focus-color, var(--lwt-focus-ring, #2563eb)); outline-offset: 2px; }';

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
