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
