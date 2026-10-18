/*!
 * LWT Element Library — core
 * Base class + registration helper for all lwt-* custom elements.
 *
 * No build step, no Node dependency. Works identically as:
 *   <script src="lwt-core.js"></script>
 *   <script type="module" src="lwt-core.js"></script>
 * because it contains no import/export statements — it just attaches
 * itself to a global `LWT` namespace on `window`.
 */
(function () {
  'use strict';

  var namespace = (window.LWT = window.LWT || {});

  // See the comment on emit() below: these event names also get fired
  // unprefixed (plain "change" alongside "lwt-change") so every element
  // is addEventListener-compatible with regular native form controls.
  var MIRRORED_NATIVE_EVENTS = { input: 1, change: 1, focus: 1, blur: 1 };

  // ---------------------------------------------------------------------
  // Accessibility helpers (WCAG 2.2 AA)
  //
  // Every element uses these so that, when a developer leaves out a label
  // or name, the library fills in something sensible AND tells them about
  // it (once per element). Turn the console messages off globally with:
  //
  //   LWT.a11y.warn = false;
  //
  // (set it before or after the scripts load -- it's read at warn time).
  // ---------------------------------------------------------------------
  var a11y = namespace.a11y = namespace.a11y || {};
  if (typeof a11y.warn !== 'boolean') a11y.warn = true;

  var warned = typeof WeakMap === 'function' ? new WeakMap() : null;

  // Logs one console.warn per (element, key). `el` is included so the
  // developer can click straight through to the element in DevTools.
  a11y.report = function (el, key, message) {
    if (!a11y.warn || typeof console === 'undefined') return;
    if (warned) {
      var seen = warned.get(el);
      if (!seen) { seen = {}; warned.set(el, seen); }
      if (seen[key]) return;
      seen[key] = true;
    }
    console.warn('[LWT a11y] <' + (el && el.localName) + '> ' + message, el);
  };

  var uidCounter = 0;
  // Page-unique id, for wiring aria-controls / aria-labelledby pairs.
  a11y.uid = function (prefix) {
    uidCounter++;
    return (prefix || 'lwt') + '-' + uidCounter.toString(36);
  };

  // "user_password" / "billingAddress" -> "User password" / "Billing address"
  a11y.humanize = function (str) {
    str = String(str || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_\-.]+/g, ' ').trim().toLowerCase();
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  };

  a11y.escape = function (str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // Visually hidden but still read by screen readers. Elements include this
  // in their shadow CSS when they render screen-reader-only content.
  a11y.SR_ONLY_CSS =
    '.lwt-sr-only { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px;' +
    ' overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; border: 0; }';

  a11y.reducedMotion = function () {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  // Shared, page-level live regions for status messages (WCAG 4.1.3).
  // Created lazily, once, and reused by every element.
  var liveRegions = null;
  function ensureLiveRegions() {
    if (liveRegions || !document.body) return liveRegions;
    var style = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;';
    liveRegions = {};
    ['polite', 'assertive'].forEach(function (politeness) {
      var region = document.createElement('div');
      region.setAttribute('aria-live', politeness);
      region.setAttribute('aria-atomic', 'true');
      region.setAttribute('data-lwt-live-region', politeness);
      region.setAttribute('style', style);
      document.body.appendChild(region);
      liveRegions[politeness] = region;
    });
    return liveRegions;
  }

  // Announces `message` to screen readers without moving focus.
  a11y.announce = function (message, opts) {
    opts = opts || {};
    var regions = ensureLiveRegions();
    if (!regions || !message) return;
    var region = regions[opts.assertive ? 'assertive' : 'polite'];
    // Clear first so repeating the same message is announced again.
    region.textContent = '';
    setTimeout(function () { region.textContent = String(message); }, 30);
  };

  // Builds a screen-reader-only <table> (a text alternative for charts and
  // other visual-only data, WCAG 1.1.1 / 1.3.1). headers: [string];
  // rows: [[cell, ...]]; the first cell of each row becomes a row header.
  a11y.dataTableHtml = function (caption, headers, rows) {
    var esc = a11y.escape;
    var html = '<table class="lwt-sr-only" part="data-table">';
    if (caption) html += '<caption>' + esc(caption) + '</caption>';
    if (headers && headers.length) {
      html += '<thead><tr>' + headers.map(function (h) { return '<th scope="col">' + esc(h) + '</th>'; }).join('') + '</tr></thead>';
    }
    html += '<tbody>' + (rows || []).map(function (row) {
      return '<tr>' + row.map(function (cell, i) {
        return i === 0 ? '<th scope="row">' + esc(cell) + '</th>' : '<td>' + esc(cell) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table>';
    return html;
  };

  // Screen-reader data table for a Chart.js-shaped `data` object
  // ({ labels, datasets: [{ label, data }] }). Point datasets
  // ({ x, y, r } objects, e.g. bubble charts) get one row per point.
  a11y.chartTableHtml = function (caption, data) {
    data = data || {};
    var datasets = Array.isArray(data.datasets) ? data.datasets : [];
    var labels = Array.isArray(data.labels) ? data.labels : [];
    if (!datasets.length) return '';
    var first = datasets[0] && Array.isArray(datasets[0].data) ? datasets[0].data[0] : null;
    var fmt = function (v) { return v == null || v === '' ? '' : String(v); };

    if (first && typeof first === 'object') {
      var pointRows = [];
      datasets.forEach(function (ds, i) {
        (ds.data || []).forEach(function (p) {
          p = p || {};
          pointRows.push([ds.label || ('Series ' + (i + 1)), fmt(p.x), fmt(p.y), fmt(p.r)]);
        });
      });
      return a11y.dataTableHtml(caption, ['Series', 'X', 'Y', 'Size'], pointRows);
    }

    var count = labels.length;
    datasets.forEach(function (ds) { count = Math.max(count, (ds.data || []).length); });
    var rows = [];
    for (var i = 0; i < count; i++) {
      rows.push([labels[i] != null ? labels[i] : String(i + 1)].concat(datasets.map(function (ds) {
        return fmt(ds.data && ds.data[i]);
      })));
    }
    var headers = ['Category'].concat(datasets.map(function (ds, i) { return ds.label || (datasets.length === 1 ? 'Value' : 'Series ' + (i + 1)); }));
    return a11y.dataTableHtml(caption, headers, rows);
  };

  // ---------------------------------------------------------------------
  // Chart color palettes (shared by the lwtd- dashboard elements)
  //
  // Every chart accepts a custom palette. First one found wins:
  //   1. JS property:  chart.palette = ['#2563eb', '#dc2626', { stroke: '#16a34a', fill: '#dcfce7' }]
  //   2. Attribute:    <lwtd-bar-chart palette="#2563eb, #dc2626, #16a34a">
  //   3. CSS (inherits, so it can theme a whole page or section):
  //                    .reports { --lwt-chart-palette: #2563eb, #dc2626, #16a34a; }
  //   4. Page-wide JS: LWT.chart.palette = ['#2563eb', '#dc2626', '#16a34a'];
  //   5. The chart's built-in palette.
  // A plain color is the strong (line / border / dot) color, and the light
  // fill is mixed from it automatically (LWT.chart.fillMix of the color over
  // white, default 0.35). Use { stroke, fill } to set both yourself. Any CSS
  // color works, including var(--brand-blue). Per-dataset backgroundColor /
  // borderColor in the data still win over the palette.
  // ---------------------------------------------------------------------
  var chart = namespace.chart = namespace.chart || {};
  if (typeof chart.fillMix !== 'number') chart.fillMix = 0.35;

  // Splits "a, rgb(1, 2, 3), b" on top-level commas only.
  function splitColorList(str) {
    var out = [], depth = 0, cur = '';
    String(str).split('').forEach(function (ch) {
      if (ch === '(') depth++;
      if (ch === ')') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
    });
    out.push(cur);
    return out.map(function (s) { return s.trim(); }).filter(Boolean);
  }
  chart.splitColorList = splitColorList;

  var colorCtx = null;
  // Any CSS color (named, hex, rgb, hsl, var(--x, fallback)) -> { r, g, b, a } or null.
  function toRgb(color, el, depth) {
    color = String(color || '').trim();
    var m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/.exec(color);
    if (m) {
      if ((depth || 0) > 5) return null;
      var v = el ? getComputedStyle(el).getPropertyValue(m[1]).trim() : '';
      return toRgb(v || m[2] || '', el, (depth || 0) + 1);
    }
    if (!color) return null;
    if (!colorCtx) colorCtx = document.createElement('canvas').getContext('2d');
    // Two different sentinels: an invalid color leaves either one in place.
    colorCtx.fillStyle = '#010203'; colorCtx.fillStyle = color; var a1 = colorCtx.fillStyle;
    colorCtx.fillStyle = '#030201'; colorCtx.fillStyle = color; var a2 = colorCtx.fillStyle;
    if (a1 !== a2) return null;
    if (a1.charAt(0) === '#') {
      return { r: parseInt(a1.slice(1, 3), 16), g: parseInt(a1.slice(3, 5), 16), b: parseInt(a1.slice(5, 7), 16), a: 1 };
    }
    var n = a1.match(/[\d.]+/g);
    return n ? { r: +n[0], g: +n[1], b: +n[2], a: n[3] != null ? +n[3] : 1 } : null;
  }
  chart.toRgb = toRgb;

  function rgbToCss(c) {
    if (c.a < 1) return 'rgba(' + c.r + ', ' + c.g + ', ' + c.b + ', ' + c.a + ')';
    return '#' + [c.r, c.g, c.b].map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join('');
  }

  // A light fill mixed from `color` over white (amount: share of the color).
  chart.tint = function (color, el, amount) {
    var c = typeof color === 'object' ? color : toRgb(color, el);
    if (!c) return color;
    var t = typeof amount === 'number' ? amount : chart.fillMix;
    return rgbToCss({ r: c.r * t + 255 * (1 - t), g: c.g * t + 255 * (1 - t), b: c.b * t + 255 * (1 - t), a: 1 });
  };

  // One palette entry (string or object) -> { stroke, fill } as hex/rgba.
  chart.normalize = function (entry, el) {
    if (!entry) return null;
    if (typeof entry === 'string') {
      var c = toRgb(entry, el);
      if (!c) return null;
      return { stroke: rgbToCss(c), fill: chart.tint(c) };
    }
    var strokeSrc = entry.stroke || entry.color || entry.borderColor || entry.fill || entry.backgroundColor;
    var sc = strokeSrc ? toRgb(strokeSrc, el) : null;
    if (!sc) return null;
    var fillSrc = entry.fill || entry.backgroundColor;
    var fc = fillSrc && fillSrc !== strokeSrc ? toRgb(fillSrc, el) : null;
    return { stroke: rgbToCss(sc), fill: fc ? rgbToCss(fc) : chart.tint(sc) };
  };

  // Raw palette value (array, comma list string, or null) -> array of entries.
  function paletteList(value) {
    if (!value) return null;
    if (typeof value === 'string') value = splitColorList(value);
    return Array.isArray(value) && value.length ? value : null;
  }

  // The palette an element should use: [{ stroke, fill }, ...], or
  // `defaults` when nothing custom is set. The result has `.custom = true`
  // when it came from the element, the CSS variable or LWT.chart.palette.
  chart.resolve = function (el, defaults) {
    var sources = [
      el && el._palette,
      el && el.getAttribute && el.getAttribute('palette'),
      el && el.isConnected ? getComputedStyle(el).getPropertyValue('--lwt-chart-palette').trim() : '',
      chart.palette
    ];
    for (var i = 0; i < sources.length; i++) {
      var list = paletteList(sources[i]);
      if (!list) continue;
      var out = list.map(function (e) { return chart.normalize(e, el); }).filter(Boolean);
      if (out.length) { out.custom = true; return out; }
    }
    var d = (defaults || []).slice();
    d.custom = false;
    return d;
  };

  // Adds a `palette` property (get/set, re-renders) to a chart class.
  // Add 'palette' to the class's observedAttributes and observedProps too.
  chart.withPalette = function (ElementClass) {
    Object.defineProperty(ElementClass.prototype, 'palette', {
      configurable: true,
      get: function () { return this._palette || null; },
      set: function (value) {
        this._palette = value || null;
        if (this._root && this.isConnected) this.render();
      }
    });
    return ElementClass;
  };

  class LWTElement extends HTMLElement {
    constructor() {
      super();
      // Subclasses can set `static get shadowOptions()` (e.g. delegatesFocus).
      this._root = this.attachShadow(Object.assign({ mode: 'open' }, this.constructor.shadowOptions || {}));
      this._autoAttrs = {};
    }

    // ---- accessibility helpers (instance) ----

    // Sets an attribute the library chose (not the developer), and
    // remembers it so _devAttr() can tell the two apart later.
    _setAutoAttr(name, value) {
      this._autoAttrs[name] = String(value);
      this.setAttribute(name, value);
    }

    // Removes an attribute only if the library set it.
    _removeAutoAttr(name) {
      if (this._autoAttrs[name] !== undefined && this.getAttribute(name) === this._autoAttrs[name]) {
        this.removeAttribute(name);
      }
      delete this._autoAttrs[name];
    }

    // The attribute's value only if the developer set it (null if absent or
    // if it's a value the library filled in itself).
    _devAttr(name) {
      if (!this.hasAttribute(name)) return null;
      var v = this.getAttribute(name);
      if (this._autoAttrs[name] !== undefined && v === this._autoAttrs[name]) return null;
      return v;
    }

    // Sets an attribute on the host unless the developer already provided
    // one. Keeps library-chosen values updatable.
    _ensureAttr(name, value) {
      if (this._devAttr(name) !== null) return;
      if (value === null || value === undefined || value === '') this._removeAutoAttr(name);
      else this._setAutoAttr(name, value);
    }

    // A label the developer put on the host itself: aria-label, or the text
    // of the elements named by aria-labelledby (resolved to text because
    // light-DOM ids can't be referenced from inside a shadow root).
    _hostLabel() {
      var label = this._devAttr('aria-label');
      if (label && label.trim()) return label.trim();
      var ids = this._devAttr('aria-labelledby');
      if (ids) {
        var text = ids.split(/\s+/).map(function (id) {
          var el = document.getElementById(id);
          return el ? el.textContent.trim() : '';
        }).filter(Boolean).join(' ');
        if (text) return text;
      }
      return '';
    }

    // Picks an accessible name: the host's own aria-label/labelledby, then
    // each candidate in order; if all are empty, uses `fallback` and warns
    // the developer which attribute to set.
    _a11yName(candidates, fallback, hint) {
      var host = this._hostLabel();
      if (host) return host;
      for (var i = 0; i < (candidates || []).length; i++) {
        var c = candidates[i];
        if (c != null && String(c).trim()) return String(c).trim();
      }
      a11y.report(this, 'name', 'has no accessible name, so "' + fallback + '" is being used. ' +
        (hint || 'Add a label or aria-label attribute') + ' to describe it properly.');
      return fallback;
    }

    _a11yWarn(key, message) {
      a11y.report(this, key, message);
    }

    // Runs fn once this element's light-DOM children are in place: after
    // the document finishes parsing if it's still loading (scripts in
    // <head> upgrade elements before their children exist), otherwise on
    // the next microtask. Use it for anything that inspects child content,
    // so name checks don't warn about children that just haven't arrived.
    _whenParsed(fn) {
      var self = this;
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { fn.call(self); }, { once: true });
      } else {
        Promise.resolve().then(function () { fn.call(self); });
      }
    }

    connectedCallback() {
      this._upgradeProperties();
      this.render();
      if (typeof this.onConnect === 'function') this.onConnect();
    }

    disconnectedCallback() {
      if (typeof this.onDisconnect === 'function') this.onDisconnect();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      this.render();
      if (typeof this.onAttributeChange === 'function') {
        this.onAttributeChange(name, oldValue, newValue);
      }
    }

    // If a property was set before the element was upgraded
    // (e.g. `el.disabled = true` before customElements.define ran),
    // re-apply it through the accessor so it isn't shadowed.
    _upgradeProperties() {
      var props = this.constructor.observedProps || [];
      var self = this;
      props.forEach(function (prop) {
        if (Object.prototype.hasOwnProperty.call(self, prop)) {
          var value = self[prop];
          delete self[prop];
          self[prop] = value;
        }
      });
    }

    // Renders `html` (+ optional `css`) into the shadow root, caching a
    // <template> per class+content so repeated renders just clone.
    _renderShadow(html, css) {
      var ctor = this.constructor;
      if (!ctor._template || ctor._templateHTML !== html || ctor._templateCSS !== css) {
        var template = this._genhtml({
          type: 'template',
        });
        ctor._template = template;
        ctor._templateHTML = html;
        ctor._templateCSS = css;
        template.innerHTML = css ? '<style>' + css + '</style>' + html : html;
      }
      this._root.innerHTML = '';
      this._root.appendChild(ctor._template.content.cloneNode(true));
    }

    // Presence-based boolean attribute (e.g. `disabled`, `open`).
    _boolAttr(name) {
      return this.hasAttribute(name);
    }

    // String attribute with fallback.
    _strAttr(name, fallback) {
      return this.hasAttribute(name) ? this.getAttribute(name) : fallback;
    }

    // Generate html dom elements
    _genhtml(set){
      let ele = document.createElement(set.type);
      ele.lwt = {};
      if(set.attr){
        for(let key in set.attr){
          ele.setAttribute(key, set.attr[key]);
        }
      }
      if(set.data){
        for(let key in set.data){
          ele.dataset[key] = set.data[key];
        }
      }
      if(set.odata){
        for(let key in set.odata){
          ele.lwt[key] = set.odata[key];
        }
      }
      set.text ? ele.textContent = set.text : false;
      if(set.html){
        if(typeof set.html=='string'){
          ele.innerHTML = set.html;
        }else if(typeof set.html=='object'){
          ele.appendChild(set.html);
        }
      }
      if(set.children){
        for(let i=0; i<set.children.length;i++){
          let child = this._genhtml(set.children[i]);
          ele.appendChild(child);
          set.children[i].key ? ele[set.children[i].key] = child : false;
        }
      }
      // EVENTS
      if(set.events){
        for(let key in set.events){
          ele.addEventListener(key, (e)=>{set.events[key](e)});
        }
      }
      return ele;
    }

    // Dispatches a namespaced, bubbling, composed CustomEvent: `lwt-<name>`.
    //
    // For the standard form-control event names (input/change/focus/blur)
    // this ALSO dispatches a second, plain-named event (e.g. "change"
    // alongside "lwt-change") so every element behaves like a regular
    // native <input> from the outside: `el.addEventListener('change', fn)`
    // just works, no "lwt-" prefix required. This exists because native
    // input/change/focus/blur events fired on an element *inside* a shadow
    // root don't bubble/compose back out to the host (that's exactly the
    // shadow-DOM limitation the "lwt-" events were invented to work
    // around) — so without this, `el.addEventListener('change', fn)` on
    // an <lwt-*> element would silently never fire. Both events carry the
    // same `detail`, and since every element with a `.value` getter
    // exposes it on the host itself, `e.target.value` works in the plain
    // listener too, same as a native input.
    emit(name, detail, options) {
      var opts = Object.assign({ bubbles: true, composed: true, detail: detail }, options);
      var event = new CustomEvent('lwt-' + name, opts);
      this.dispatchEvent(event);

      if (MIRRORED_NATIVE_EVENTS[name]) {
        this.dispatchEvent(new CustomEvent(name, opts));
      }
      return event;
    }

    render() {
      // Subclasses implement this.
    }
  }

  namespace.Element = LWTElement;

  // Registration helper — safe to call more than once (e.g. if a page
  // loads the same script twice).
  namespace.define = function define(tag, ElementClass) {
    if (!customElements.get(tag)) {
      customElements.define(tag, ElementClass);
    }
  };


  // Each entry: WAAPI keyframe array + a sensible default duration (ms).
  // "-in"/"-out" entries use fill:'forwards' so the end state persists;
  // the plain attention-seekers omit it so they cleanly return to
  // exactly how the element looked before playing.
  var ANIMATIONS = {
    'fade-in': { duration: 500, fill: 'forwards', frames: [{ opacity: 0 }, { opacity: 1 }] },
    'fade-out': { duration: 500, fill: 'forwards', frames: [{ opacity: 1 }, { opacity: 0 }] },
    'flash': { duration: 1000, frames: [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }, { opacity: 0 }, { opacity: 1 }] },
    'bounce': {
      duration: 1000,
      frames: [
        { transform: 'translateY(0)', offset: 0 },
        { transform: 'translateY(0)', offset: 0.2 },
        { transform: 'translateY(-30%)', offset: 0.4 },
        { transform: 'translateY(0)', offset: 0.53 },
        { transform: 'translateY(-15%)', offset: 0.7 },
        { transform: 'translateY(0)', offset: 0.8 },
        { transform: 'translateY(-4%)', offset: 0.9 },
        { transform: 'translateY(0)', offset: 1 }
      ]
    },
    'bounce-in': {
      duration: 600, fill: 'forwards',
      frames: [
        { opacity: 0, transform: 'scale(0.3)', offset: 0 },
        { opacity: 1, transform: 'scale(1.05)', offset: 0.5 },
        { opacity: 1, transform: 'scale(0.9)', offset: 0.7 },
        { opacity: 1, transform: 'scale(1)', offset: 1 }
      ]
    },
    'bounce-out': {
      duration: 600, fill: 'forwards',
      frames: [
        { opacity: 1, transform: 'scale(1)', offset: 0 },
        { opacity: 1, transform: 'scale(1.05)', offset: 0.3 },
        { opacity: 0, transform: 'scale(0.3)', offset: 1 }
      ]
    },
    'flip': {
      duration: 800,
      frames: [
        { transform: 'perspective(400px) rotateY(0)', offset: 0 },
        { transform: 'perspective(400px) rotateY(180deg)', offset: 0.5 },
        { transform: 'perspective(400px) rotateY(360deg)', offset: 1 }
      ]
    },
    'flip-in': {
      duration: 600, fill: 'forwards',
      frames: [
        { opacity: 0, transform: 'perspective(400px) rotateX(90deg)' },
        { opacity: 1, transform: 'perspective(400px) rotateX(0deg)' }
      ]
    },
    'flip-out': {
      duration: 600, fill: 'forwards',
      frames: [
        { opacity: 1, transform: 'perspective(400px) rotateX(0deg)' },
        { opacity: 0, transform: 'perspective(400px) rotateX(90deg)' }
      ]
    },
    'rotate': { duration: 800, frames: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }] },
    'rotate-in': {
      duration: 600, fill: 'forwards',
      frames: [
        { opacity: 0, transform: 'rotate(-200deg) scale(0.5)' },
        { opacity: 1, transform: 'rotate(0deg) scale(1)' }
      ]
    },
    'rotate-out': {
      duration: 600, fill: 'forwards',
      frames: [
        { opacity: 1, transform: 'rotate(0deg) scale(1)' },
        { opacity: 0, transform: 'rotate(200deg) scale(0.5)' }
      ]
    },
    'zoom-in': { duration: 500, fill: 'forwards', frames: [{ opacity: 0, transform: 'scale(0.3)' }, { opacity: 1, transform: 'scale(1)' }] },
    'zoom-out': { duration: 500, fill: 'forwards', frames: [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.3)' }] }
  };

  function prefersReducedMotion() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Reads an element's data-lwt-* attributes into a plain options object.
  // Returns null if data-lwt-animate is missing or names an unknown type.
  function readOptions(el) {
    var type = el.dataset ? el.dataset.lwtAnimate : null;
    var config = type && ANIMATIONS[type];
    if (!config) return null;

    var rate = parseFloat(el.dataset.lwtRate);
    if (!(rate > 0)) rate = 1;
    var duration = parseFloat(el.dataset.lwtDuration);
    if (!(duration >= 0)) duration = config.duration;
    var delay = parseFloat(el.dataset.lwtDelay);
    if (!(delay >= 0)) delay = 0;

    return {
      type: type,
      config: config,
      trigger: el.dataset.lwtTrigger || 'load',
      easing: el.dataset.lwtEasing || 'ease',
      rate: rate,
      duration: duration,
      delay: delay,
      once: el.hasAttribute('data-lwt-once'),
      repeat: el.hasAttribute('data-lwt-repeat')
    };
  }

  // Plays one animation on `el` given a resolved options object (either
  // from readOptions() or built directly by the LWT.animate() JS API).
  function play(el, opts) {
    var reduced = prefersReducedMotion();
    var animation = el.animate(opts.config.frames, {
      duration: reduced ? 0 : opts.duration,
      easing: opts.easing,
      delay: reduced ? 0 : opts.delay,
      fill: opts.config.fill || 'none'
    });
    animation.playbackRate = opts.rate;

    el.dispatchEvent(new CustomEvent('lwt-animate-start', {
      bubbles: true, composed: true, detail: { type: opts.type, trigger: opts.trigger }
    }));
    animation.finished.then(function () {
      el.dispatchEvent(new CustomEvent('lwt-animate-end', {
        bubbles: true, composed: true, detail: { type: opts.type, trigger: opts.trigger }
      }));
    }, function () {
      // Swallow the AbortError WAAPI throws when an animation is
      // canceled/replaced mid-flight (e.g. rapid repeat triggers) --
      // that's expected, not a real error.
    });

    return animation;
  }

  // ---- trigger wiring ----

  var wired = typeof WeakSet === 'function' ? new WeakSet() : { has: function () { return false; }, add: function () {} };
  var sharedObserver = null;

  function ensureObserver() {
    if (sharedObserver !== null || typeof IntersectionObserver !== 'function') return sharedObserver;
    sharedObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var opts = readOptions(el);
        if (!opts) return;
        play(el, opts);
        if (!opts.repeat) sharedObserver.unobserve(el);
      });
    }, { threshold: 0.1 });
    return sharedObserver;
  }

  function wire(el) {
    if (!el || wired.has(el)) return;
    var opts = readOptions(el);
    if (!opts) return;
    wired.add(el);

    switch (opts.trigger) {
      case 'click':
        el.addEventListener('click', function () {
          var fresh = readOptions(el);
          if (fresh) play(el, fresh);
        }, opts.once ? { once: true } : false);
        break;

      case 'hover':
        el.addEventListener('mouseenter', function () {
          var fresh = readOptions(el);
          if (fresh) play(el, fresh);
        }, opts.once ? { once: true } : false);
        break;

      case 'lazy':
        var observer = ensureObserver();
        if (observer) observer.observe(el);
        else play(el, opts); // no IntersectionObserver support -> just play immediately
        break;

      case 'load':
      default:
        play(el, opts);
        break;
    }
  }

  function scan(root) {
    if (root.hasAttribute && root.hasAttribute('data-lwt-animate')) wire(root);
    if (root.querySelectorAll) {
      var nodes = root.querySelectorAll('[data-lwt-animate]');
      for (var i = 0; i < nodes.length; i++) wire(nodes[i]);
    }
  }

  function init() {
    scan(document);
    if (typeof MutationObserver === 'function' && document.body) {
      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType !== 1) return; // element nodes only
            scan(node);
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ---- public JS API ----

  namespace.animate = function (el, options) {
    options = options || {};
    var config = ANIMATIONS[options.type];
    if (!config) {
      throw new Error('LWT.animate: unknown animation type "' + options.type + '". See LWT.animate.types for valid names.');
    }
    return play(el, {
      type: options.type,
      config: config,
      trigger: 'manual',
      easing: options.easing || 'ease',
      rate: options.rate > 0 ? options.rate : 1,
      duration: options.duration >= 0 ? options.duration : config.duration,
      delay: options.delay >= 0 ? options.delay : 0
    });
  };

  namespace.animate.wire = wire;
  namespace.animate.refresh = function () { scan(document); };
  namespace.animate.types = Object.keys(ANIMATIONS);


})();
