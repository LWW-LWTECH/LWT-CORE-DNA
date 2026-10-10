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
 * Events: lwtf-input (fires continuously while dragging/typing), lwt-change
 * (fires once when a drag ends or a field is committed). Both carry
 * detail: { value, hex, rgba, hsla, cmyk }.
 *
 * This component deliberately does not declare `static observedAttributes`
 * — all of its state lives in JS instance fields and is driven by user
 * interaction, not by re-reading attributes, so attributeChangedCallback
 * never needs to fire (and never should: a square/slider/wheel being
 * dragged can't afford a full shadow-DOM rebuild on every pixel of
 * movement). Mode switching therefore works by toggling a `mode`
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

  var CSS =
    ':host { display: block; color: inherit; font-family: inherit; width: fit-content; box-sizing: border-box;' +
    '  padding: 1em; border-radius: 4px;' +
    '  background-color: var(--lwt-picker-bg, var(--lwt-color-surface, white));' +
    '  border: 1px solid var(--lwt-picker-field-border, var(--lwt-color-border-strong, #d1d5db)); }' +
    '.picker { display: grid; grid-template-columns: auto 200px; grid-template-rows: auto auto; gap: 0.75rem; width: fit-content; min-width: 300px; }' +

    '.top-row { grid-column: span 2; display: flex; align-items: center; gap: 0.6rem; }' +
    '.mode-select { flex: 1; font: inherit; font-size: 0.8rem; padding: 0.32rem 0.4rem; border-radius: 4px;' +
    '  border: 1px solid var(--lwt-picker-field-border, var(--lwt-color-border-strong, #d1d5db));' +
    '  background: var(--lwt-picker-field-bg, var(--lwt-color-surface, #fff)); color: var(--lwt-picker-field-color, inherit); }' +
    '.swatch-row { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }' +
    '.swatch-checkerboard { position: relative; width: 2.4rem; height: 2.4rem; border-radius: 6px; overflow: hidden;' +
    '  border: 1px solid var(--lwt-picker-track-border, var(--lwt-color-border, rgba(0,0,0,0.15))); ' + CHECKERBOARD + ' background-size: 8px 8px; background-position: 0 0, 0 4px, 4px -4px, -4px 0px; }' +
    '.swatch { position: absolute; inset: 0; }' +
    '.eyedropper { flex-shrink: 0; width: 2.4rem; height: 2.4rem; border-radius: 6px; border: 1px solid var(--lwt-picker-field-border, var(--lwt-color-border-strong, #d1d5db));' +
    '  background: var(--lwt-picker-field-bg, var(--lwt-color-surface, #fff)); color: var(--lwt-picker-field-color, inherit); cursor: pointer; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; }' +
    '.eyedropper[hidden] { display: none; }' +

    '.mode-panel { display: none; }' +
    ':host(:not([mode])) .mode-panel[data-mode="hsl"],' +
    ':host([mode="hsl-wheel"]) .mode-panel[data-mode="hsl-wheel"],' +
    ':host([mode="rgb"]) .mode-panel[data-mode="rgb"],' +
    ':host([mode="hsl"]) .mode-panel[data-mode="hsl"],' +
    ':host([mode="cmyk"]) .mode-panel[data-mode="cmyk"] { display: block; }' +

    '.wheel-wrap { position: relative; width: 210px; height: 210px; margin: 0 auto; }' +
    '.wheel { position: absolute; inset: 0; border-radius: 50%; cursor: pointer; touch-action: none;' +
    '  background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);' +
    '  -webkit-mask-image: radial-gradient(circle, transparent 60%, black 61%);' +
    '  mask-image: radial-gradient(circle, transparent 60%, black 61%); }' +
    '.wheel-handle { position: absolute; top: 50%; left: 50%; width: 14px; height: 14px; margin: -7px; border-radius: 50%;' +
    '  box-shadow: 0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,0.35); pointer-events: none; }' +
    '.square-slot--wheel { position: absolute; top: 50%; left: 50%; width: 56%; height: 56%; transform: translate(-50%, -50%); }' +
    '.square-slot--wheel .square { width: 100%; height: 100%; }' +

    '.square { position: relative; width: 100%; aspect-ratio: 1 / 1; border-radius: 8px; overflow: hidden;' +
    '  border: 1px solid var(--lwt-picker-track-border, var(--lwt-color-border, rgba(0,0,0,0.15))); cursor: crosshair; touch-action: none; }' +
    '.square canvas { display: block; width: 100%; height: 100%; }' +
    '.square-handle { position: absolute; top: 0; left: 0; width: 14px; height: 14px; margin: -7px; border-radius: 50%;' +
    '  box-shadow: 0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,0.35); pointer-events: none; }' +

    '.slider-row { display: grid; grid-template-columns: 1rem 1fr 3.4rem; align-items: center; gap: 0.5rem; margin-bottom: 0.55rem; }' +
    '.slider-row label { font-size: 0.72rem; opacity: 0.65; }' +
    '.slider { position: relative; height: 12px; border-radius: 999px; border: 1px solid var(--lwt-picker-track-border, var(--lwt-color-border, rgba(0,0,0,0.15)));' +
    '  touch-action: none; cursor: pointer; overflow: hidden; }' +
    // Hue track: full-saturation rainbow, evenly spaced so position x maps
    // to hue x*360 -- the same stops as the hue wheel's conic-gradient.
    '.slider[data-channel="h"] { background: var(--lwt-picker-hue-gradient, linear-gradient(to right,' +
    '  hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))); }' +
    '.alpha-checkerboard { position: absolute; inset: 0; ' + CHECKERBOARD + ' background-size: 8px 8px; background-position: 0 0, 0 4px, 4px -4px, -4px 0px; }' +
    '.alpha-gradient { position: absolute; inset: 0; }' +
    '.slider-handle { position: absolute; top: 50%; left: 0; width: 14px; height: 14px; margin-left: -7px; margin-top: -7px; border-radius: 50%;' +
    '  box-shadow: 0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,0.35); background: #fff; pointer-events: none; }' +

    '.field { width: 100%; box-sizing: border-box; font: inherit; font-size: 0.78rem; padding: 0.28rem 0.35rem; border-radius: 4px;' +
    '  border: 1px solid var(--lwt-picker-field-border, var(--lwt-color-border-strong, #d1d5db));' +
    '  background: var(--lwt-picker-field-bg, var(--lwt-color-surface, #fff)); color: var(--lwt-picker-field-color, inherit); }' +

    '.output-panel { display: flex; flex-direction: column-reverse; gap: 0.5rem; }' +
    '.output-row { display: flex; flex-direction: column; gap: 0.5rem; }' +
    '.output-group { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem; }' +
    '.output-group.cmyk-group { grid-template-columns: repeat(4, 1fr); }' +
    '.output-group.hex-group { grid-template-columns: 1fr; }' +
    '.output-group label { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.68rem; opacity: 0.65; }' +
    '[data-channel="hex"] { text-transform: uppercase; }';

  class LWTColorPicker extends window.LWT.Element {
    constructor() {
      super();
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
        if (initial) {
          var parsed = Color.parse(initial);
          if (parsed) { this._h = parsed.h; this._s = parsed.s; this._l = parsed.l; this._a = parsed.a; }
        }

        var initialMode = this.getAttribute('mode');
        var validModes = { 'hsl-wheel': 1, rgb: 1, hsl: 1, cmyk: 1 };
        this._setMode(validModes[initialMode] ? initialMode : 'hsl', { silent: true });
      }

      if (window.EyeDropper) this._eyedropperBtn.hidden = false;
      this._syncUI();
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      var root = this._root;

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
