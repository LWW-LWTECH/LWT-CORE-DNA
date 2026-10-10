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
 *   label-format    — "" (default: plain number, optionally suffixed by
 *                      `unit`) | "time" (treats the value as
 *                      minutes-since-midnight and formats "9 AM" style)
 *   unit            — string appended to plain-number labels (e.g. "%")
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

  var CSS =
    ':host { display: block; color: inherit; font-family: inherit; box-sizing: border-box; }' +
    ':host([hidden]) { display: none; }' +
    '* { box-sizing: border-box; }' +
    '.field-label { display: flex; gap: 0.2rem; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.6rem;' +
    '  color: var(--lwt-slider-label-color, var(--lwt-color-text, #111827)); }' +
    '.field-label:empty, .label-text:empty { display: none; }' +
    '.required-mark { color: var(--lwt-color-danger, #ef4444); display: none; }' +
    ':host([required]) .required-mark { display: inline; }' +

    '.slider-wrap { position: relative; height: 1.6rem; margin: 0 0.7rem; touch-action: none; }' +
    '.track { position: absolute; top: 50%; left: -0.7rem; right: -0.7rem; height: 4px; border-radius: 2px;' +
    '  transform: translateY(-50%); background: var(--lwt-slider-track, var(--lwt-color-border-strong, #d1d5db)); }' +
    '.segments { position: absolute; top: 50%; left: -0.7rem; right: -0.7rem; height: 4px; transform: translateY(-50%); }' +
    '.segment { position: absolute; top: 0; height: 100%; background: var(--lwt-slider-segment-color, var(--lwt-color-primary, #2563eb)); }' +
    '.handles { position: absolute; inset: 0; }' +
    '.handle { position: absolute; top: 50%; width: 1.5rem; height: 1.5rem; border-radius: 999px;' +
    '  transform: translate(-50%, -50%); cursor: grab; touch-action: none;' +
    '  background: var(--lwt-slider-handle-bg, #fff);' +
    '  border: 2px solid var(--lwt-slider-handle-border, var(--lwt-color-primary, #2563eb));' +
    '  box-shadow: 0 1px 3px var(--lwt-color-shadow, rgba(0,0,0,0.25)); }' +
    '.handle:active { cursor: grabbing; }' +
    '.handle:focus-visible { outline: none; box-shadow: 0 0 0 4px color-mix(in srgb, var(--lwt-slider-handle-border, var(--lwt-color-primary, #2563eb)) 25%, transparent); }' +
    ':host([disabled]) .handle { cursor: not-allowed; opacity: 0.6; }' +
    ':host([readonly]) .handle { cursor: default; }' +
    ':host([data-invalid]) .handle { border-color: var(--lwt-slider-error-color, var(--lwt-color-danger, #ef4444)); }' +

    '.tooltip { position: absolute; bottom: calc(100% + 0.5rem); left: 50%; transform: translateX(-50%);' +
    '  background: var(--lwt-slider-tooltip-bg, var(--lwt-color-text, #111827)); color: var(--lwt-slider-tooltip-color, #fff);' +
    '  font-size: 0.75rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 999px; white-space: nowrap;' +
    '  pointer-events: none; opacity: 0; transition: opacity 120ms ease; }' +
    '.handle.tt-show .tooltip { opacity: 1; }' +
    ':host([tooltip="always"]) .tooltip { opacity: 1; }' +

    '.ticks { position: relative; height: 1.1rem; margin: 0.5rem 0.7rem 0; display: none; }' +
    ':host([ticks]) .ticks { display: block; }' +
    '.tick { position: absolute; top: 0; transform: translateX(-50%); font-size: 0.68rem;' +
    '  color: var(--lwt-color-text-muted, #6b7280); white-space: nowrap; }' +

    '.below { display: flex; align-items: flex-start; gap: 0.75rem; margin-top: 0.4rem; font-size: 0.78rem; min-height: 1rem; }' +
    '.helper { flex: 1; color: var(--lwt-slider-helper-color, var(--lwt-color-text-muted, #6b7280)); }' +
    '.helper.error { color: var(--lwt-slider-error-color, var(--lwt-color-danger, #ef4444)); }' +
    '.helper:empty { display: none; }';

  class LWTSlider extends window.LWT.Element {
    static get observedAttributes() {
      return ['label', 'helper', 'error', 'min', 'max', 'step', 'name', 'required',
              'disabled', 'readonly', 'ticks', 'tick-step', 'label-format', 'unit', 'tooltip',
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
      if (['min', 'max', 'step', 'ticks', 'tick-step', 'label-format', 'unit'].indexOf(name) !== -1) {
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
      var unit = this._strAttr('unit', '');
      return (Math.round(v * 1000) / 1000) + unit;
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
