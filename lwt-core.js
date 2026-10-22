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

  // ---- shared hover tooltip (opt-in per chart) --------------------------
  // A chart turns this on by: appending chart.TOOLTIP_CSS to its stylesheet
  // and chart.TIP_HTML to its shadow, tagging each hoverable shape with the
  // attributes from chart.tipAttr(label, value, extra), and calling
  // chart.enableTooltips(this) after _renderShadow. Hovering a shape shows a
  // tooltip and dims the others; works with mouse and touch.
  chart.TIP_HTML = '<div class="lwt-tip" part="tooltip" hidden></div>';
  chart.TOOLTIP_CSS =
    ':host { position: relative; }' +
    '.lwt-tip { position: absolute; z-index: 3; pointer-events: none; padding: 0.4rem 0.55rem;' +
    ' border-radius: var(--lwt-border-radius, 6px); background: var(--lwt-color-text-strong, #111827);' +
    ' color: var(--lwt-color-surface, #fff); font-size: 12px; line-height: 1.45; white-space: nowrap;' +
    ' box-shadow: 0 4px 12px rgba(0,0,0,0.18); transform: translate(-50%, calc(-100% - 8px)); }' +
    '.lwt-tip[hidden] { display: none; } .lwt-tip strong { display: block; } .lwt-tip .muted { opacity: 0.85; }' +
    ' [data-tv] { transition: opacity 120ms ease; }' +
    ' svg.lwt-hov [data-tv]:not(.lwt-hover) { opacity: 0.4; }';

  // Builds the data-* attributes for one hoverable shape. `value` is the main
  // line, `label` the bold heading (optional), `extra` a muted line (optional).
  chart.tipAttr = function (label, value, extra) {
    var esc = a11y.escape;
    var s = ' data-tv="' + esc(value == null ? '' : value) + '"';
    if (label != null && String(label) !== '') s = ' data-tl="' + esc(label) + '"' + s;
    if (extra != null && String(extra) !== '') s += ' data-te="' + esc(extra) + '"';
    return s;
  };

  chart.enableTooltips = function (host) {
    if (host._lwtTipWired) return;   // listeners live on the shadow root, which survives re-renders
    host._lwtTipWired = true;
    var root = host._root, esc = a11y.escape;
    function hide() {
      var svg = root.querySelector('svg'), tip = root.querySelector('.lwt-tip');
      if (tip) tip.hidden = true;
      if (svg) {
        svg.classList.remove('lwt-hov');
        Array.prototype.forEach.call(svg.querySelectorAll('.lwt-hover'), function (el) { el.classList.remove('lwt-hover'); });
      }
    }
    function show(e) {
      var svg = root.querySelector('svg'), tip = root.querySelector('.lwt-tip');
      if (!svg || !tip) return;
      var t = e.target && e.target.closest ? e.target.closest('[data-tv]') : null;
      if (!t) { hide(); return; }
      svg.classList.add('lwt-hov');
      Array.prototype.forEach.call(svg.querySelectorAll('.lwt-hover'), function (el) { if (el !== t) el.classList.remove('lwt-hover'); });
      t.classList.add('lwt-hover');
      var label = t.getAttribute('data-tl') || '', value = t.getAttribute('data-tv') || '', extra = t.getAttribute('data-te') || '';
      tip.innerHTML = (label ? '<strong>' + esc(label) + '</strong>' : '') + esc(value) + (extra ? '<br><span class="muted">' + esc(extra) + '</span>' : '');
      tip.hidden = false;
      var hb = host.getBoundingClientRect(), r = t.getBoundingClientRect();
      var x = r.left + r.width / 2 - hb.left, half = tip.offsetWidth / 2;
      x = Math.max(half + 4, Math.min(hb.width - half - 4, x));
      var top = r.top - hb.top;
      if (top - tip.offsetHeight - 10 < 0) { tip.style.transform = 'translate(-50%, 8px)'; top = r.bottom - hb.top; }
      else { tip.style.transform = ''; }
      tip.style.left = x + 'px';
      tip.style.top = top + 'px';
    }
    root.addEventListener('pointermove', show);
    root.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') show(e); });
    host.addEventListener('pointerleave', hide);
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

  // ---------------------------------------------------------------------
  // Drag and drop: LWT.drag / LWT.drop / LWT.sortable
  //
  // Works on any element, not just lwt-* components. Built on pointer
  // events, so mouse, touch and pen behave the same, plus keyboard
  // support (Space/Enter to pick up, arrows to move, Space/Enter to drop,
  // Escape to cancel) with screen-reader announcements.
  //
  // DECLARATIVE (wired automatically, including elements added later):
  //
  //   <div data-lwt-drag>Drag me anywhere</div>
  //   <div data-lwt-drag="clone" data-lwt-drag-group="cards">Copy me</div>
  //   <div data-lwt-drop data-lwt-drop-accept="cards">Drop cards here</div>
  //   <ul data-lwt-sortable data-lwt-sortable-group="tasks">
  //     <li data-value="a">A</li><li data-value="b">B</li>
  //   </ul>
  //
  // JAVASCRIPT (same options, camelCase, plus callbacks):
  //
  //   LWT.drag(el, { axis: 'x', bounds: 'parent', onDrop: fn });
  //   LWT.drop(zone, { accept: function (el, data) { ... }, onDrop: fn });
  //   LWT.sortable(list, { group: 'tasks', onSort: fn });
  //
  // DRAG options  (attribute: data-lwt-drag-<name>)
  //   mode       "move" (default): the element itself moves.
  //              "clone": a copy follows the pointer; the original stays.
  //              (attribute: the value of data-lwt-drag)
  //   handle     selector; only these parts start a drag.
  //   axis       "x" | "y" to lock movement.
  //   bounds     "parent" | "window" | a selector to keep it inside.
  //   grid       "20" or "20,10": snap to steps of this many px.
  //   threshold  px the pointer must move before a drag starts. Default 3.
  //   delay      ms to press before a touch drag starts, so a quick swipe
  //              still scrolls the page. Default 0.
  //   revert     boolean; slide back when not dropped on an accepting zone.
  //   group      space-separated names that drop zones can accept.
  //   data       payload passed to drop handlers (JSON is parsed).
  //   disabled   boolean.
  //   step       keyboard move size in px. Default the grid size or 10.
  //
  // DROP options  (attribute: data-lwt-drop-<name>)
  //   accept     group names (space-separated), or in JS a function
  //              (element, data) => boolean. Empty accepts everything.
  //   action     "append" (default): the element (or a copy, in clone
  //              mode) is moved into the zone. "none": events only.
  //   disabled   boolean.
  //
  // SORTABLE options  (attribute: data-lwt-sortable-<name>)
  //   items      selector for sortable children. Default: all children.
  //   handle     selector; only these parts start a drag.
  //   group      lists sharing a group name can swap items.
  //   axis       "auto" (default) | "x" | "y".
  //   animation  ms for siblings to slide aside. Default 150.
  //   threshold, delay, disabled — as for drag.
  //
  // EVENTS (bubbling; "cancelable" ones can be stopped with preventDefault)
  //   on the dragged element:
  //     lwt-drag-start (cancelable), lwt-drag-move, lwt-drag-cancel,
  //     lwt-drag-end { dropped, zone, cancelled, position }
  //   on drop zones:
  //     lwt-drop-enter, lwt-drop-over, lwt-drop-leave,
  //     lwt-drop (cancelable: preventDefault rejects the drop)
  //   on sortable lists:
  //     lwt-sort-start (cancelable), lwt-sort-change (while dragging),
  //     lwt-sort (cancelable: preventDefault puts the item back),
  //     lwt-sort-cancel, lwt-sort-end
  //   JS callbacks with the same moments: onStart, onMove, onEnter,
  //   onOver, onLeave, onDrop, onChange, onSort, onCancel, onEnd.
  //   Returning false from onStart, onDrop or onSort cancels, like
  //   preventDefault.
  //
  // CLASSES for styling every state (defaults are injected once, first in
  // <head>, so your own CSS wins):
  //   .lwt-dragging          the element being dragged
  //   .lwt-drag-ghost        the copy that follows the pointer
  //   .lwt-sort-placeholder  a sortable item's empty slot while dragged
  //   .lwt-drag-lifted       picked up with the keyboard
  //   .lwt-drop-active       zones that accept the current drag
  //   .lwt-drop-over         the zone under the pointer
  //   html.lwt-drag-active   while any drag is in progress
  // ---------------------------------------------------------------------
  (function dragAndDrop() {
    var STYLE_ID = 'lwt-dnd-style';
    var CSS =
      '[data-lwt-drag]{cursor:grab;touch-action:none;}' +
      '[data-lwt-drag][data-lwt-drag-handle]{cursor:auto;touch-action:auto;}' +
      '[data-lwt-sortable]:not([data-lwt-sortable-handle]):not([data-lwt-sortable-delay])>*{touch-action:none;}' +
      '.lwt-dragging{cursor:grabbing;}' +
      '.lwt-drag-ghost{position:fixed!important;margin:0!important;pointer-events:none!important;z-index:2147483000!important;' +
        'box-sizing:border-box;opacity:.95;box-shadow:0 14px 34px rgba(15,23,42,.24);transition:none!important;}' +
      '.lwt-sort-placeholder{opacity:.35;}' +
      '.lwt-drag-lifted{outline:2px solid var(--lwt-focus-color,#3b82f6);outline-offset:2px;}' +
      '.lwt-drop-active{outline:2px dashed var(--lwt-drop-color,var(--lwt-primary,#3b82f6));outline-offset:2px;}' +
      '.lwt-drop-over{outline-style:solid;background-color:color-mix(in srgb,var(--lwt-drop-color,var(--lwt-primary,#3b82f6)) 9%,transparent);}' +
      'html.lwt-drag-active,html.lwt-drag-active *{cursor:grabbing!important;-webkit-user-select:none!important;user-select:none!important;}';

    var IGNORE = 'input,textarea,select,option,button,a[href],label,[contenteditable=""],[contenteditable="true"]';

    var zones = new Set();
    var session = null;   // the drag in progress
    var pending = null;   // pointer pressed, threshold/delay not met yet

    function injectCSS() {
      if (document.getElementById(STYLE_ID)) return;
      var style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      var head = document.head || document.documentElement;
      head.insertBefore(style, head.firstChild);
    }

    // ---- small helpers ----

    function num(v, fallback) { var n = parseFloat(v); return isNaN(n) ? fallback : n; }
    function flag(el, name) { return el.hasAttribute(name) && el.getAttribute(name) !== 'false'; }
    function attr(el, name) { var v = el.getAttribute(name); return v === null || v === '' ? null : v; }
    function groupsOf(v) { return String(v || '').split(/\s+/).filter(Boolean); }
    function parseData(v) {
      if (v === null || v === undefined) return null;
      if (typeof v !== 'string') return v;
      try { return JSON.parse(v); } catch (e) { return v; }
    }
    function parseGrid(v) {
      if (v === null || v === undefined || v === '') return null;
      if (typeof v === 'number') return [v, v];
      if (Array.isArray(v)) return [num(v[0], 0), num(v[1], num(v[0], 0))];
      var p = String(v).split(/[ ,]+/);
      var gx = num(p[0], 0);
      return gx > 0 ? [gx, num(p[1], gx)] : null;
    }
    function fire(target, name, detail, cancelable) {
      var ev = new CustomEvent(name, { bubbles: true, composed: true, cancelable: !!cancelable, detail: detail });
      target.dispatchEvent(ev);
      return !ev.defaultPrevented;
    }
    function call(fn, detail) { return typeof fn === 'function' ? fn(detail) : undefined; }
    function reduced() { return namespace.a11y.reducedMotion(); }
    function announce(msg) { namespace.a11y.announce(msg); }
    function labelOf(el) {
      var l = el.getAttribute('aria-label') || el.textContent || '';
      l = l.replace(/\s+/g, ' ').trim();
      return l.length > 40 ? l.slice(0, 40) + '…' : (l || 'item');
    }
    function focusable(el) {
      if (el.hasAttribute('tabindex')) return;
      if (/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
      el.setAttribute('tabindex', '0');
      el.setAttribute('data-lwt-auto-tabindex', '');
    }
    function stripWiring(root) {
      var all = [root].concat(Array.prototype.slice.call(root.querySelectorAll('*')));
      all.forEach(function (n) {
        n.removeAttribute('id');
        if (n.hasAttribute('data-lwt-auto-tabindex')) n.removeAttribute('tabindex');
        Array.prototype.slice.call(n.attributes).forEach(function (a) {
          if (/^data-lwt-(drag|drop|sortable|animate|auto-tabindex)/.test(a.name)) n.removeAttribute(a.name);
        });
      });
      return root;
    }
    // position:fixed is relative to the viewport unless an ancestor has a
    // transform/filter/etc., so put the ghost somewhere that's safe.
    function ghostParentFor(el) {
      for (var a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        var cs = getComputedStyle(a);
        if (cs.transform !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none' ||
            (cs.contain && cs.contain !== 'none') || (cs.backdropFilter && cs.backdropFilter !== 'none') ||
            cs.willChange.indexOf('transform') >= 0) {
          return document.body;
        }
      }
      return el.parentNode || document.body;
    }
    function makeGhost(el, rect) {
      var g = stripWiring(el.cloneNode(true));
      g.classList.remove('lwt-dragging', 'lwt-sort-placeholder', 'lwt-drag-lifted');
      g.classList.add('lwt-drag-ghost');
      g.setAttribute('aria-hidden', 'true');
      g.removeAttribute('tabindex');
      g.style.left = rect.left + 'px';
      g.style.top = rect.top + 'px';
      g.style.width = rect.width + 'px';
      g.style.height = rect.height + 'px';
      g.style.translate = 'none';
      ghostParentFor(el).appendChild(g);
      return g;
    }

    // ---- option readers (attributes are re-read at every drag) ----

    function dragOptions(el) {
      var c = el._lwtDrag;
      var o = Object.assign({}, c.options);
      if (c.declarative) {
        var mode = el.getAttribute('data-lwt-drag');
        o.mode = mode === 'clone' ? 'clone' : 'move';
        o.handle = attr(el, 'data-lwt-drag-handle');
        o.axis = attr(el, 'data-lwt-drag-axis');
        o.bounds = attr(el, 'data-lwt-drag-bounds');
        o.grid = attr(el, 'data-lwt-drag-grid');
        o.threshold = attr(el, 'data-lwt-drag-threshold');
        o.delay = attr(el, 'data-lwt-drag-delay');
        o.revert = flag(el, 'data-lwt-drag-revert');
        o.group = attr(el, 'data-lwt-drag-group');
        o.data = attr(el, 'data-lwt-drag-data');
        o.step = attr(el, 'data-lwt-drag-step');
        o.disabled = flag(el, 'data-lwt-drag-disabled');
      }
      o.mode = o.mode === 'clone' ? 'clone' : 'move';
      o.grid = parseGrid(o.grid);
      o.threshold = num(o.threshold, 3);
      o.delay = num(o.delay, 0);
      o.step = num(o.step, o.grid ? o.grid[0] : 10);
      o.data = parseData(o.data);
      return o;
    }

    function dropOptions(el) {
      var c = el._lwtDrop;
      var o = Object.assign({}, c.options);
      if (c.declarative) {
        o.accept = attr(el, 'data-lwt-drop-accept');
        o.action = attr(el, 'data-lwt-drop-action');
        o.disabled = flag(el, 'data-lwt-drop-disabled');
      }
      o.action = o.action === 'none' ? 'none' : 'append';
      return o;
    }

    function sortOptions(el) {
      var c = el._lwtSortable;
      var o = Object.assign({}, c.options);
      if (c.declarative) {
        o.items = attr(el, 'data-lwt-sortable-items');
        o.handle = attr(el, 'data-lwt-sortable-handle');
        o.group = attr(el, 'data-lwt-sortable-group');
        o.axis = attr(el, 'data-lwt-sortable-axis');
        o.animation = attr(el, 'data-lwt-sortable-animation');
        o.threshold = attr(el, 'data-lwt-sortable-threshold');
        o.delay = attr(el, 'data-lwt-sortable-delay');
        o.disabled = flag(el, 'data-lwt-sortable-disabled');
      }
      o.axis = o.axis === 'x' || o.axis === 'y' ? o.axis : 'auto';
      o.animation = num(o.animation, 150);
      o.threshold = num(o.threshold, 3);
      o.delay = num(o.delay, 0);
      return o;
    }

    // ---- sortable helpers ----

    function itemsOf(list, o) {
      o = o || sortOptions(list);
      return Array.prototype.filter.call(list.children, function (c) {
        return !c.classList.contains('lwt-drag-ghost') && (!o.items || c.matches(o.items));
      });
    }
    function itemFrom(node, list, o) {
      while (node && node !== list) {
        if (node.parentElement === list) {
          return !node.classList.contains('lwt-drag-ghost') && (!o.items || node.matches(o.items)) ? node : null;
        }
        node = node.parentElement;
      }
      return null;
    }
    function orderOf(list) {
      return itemsOf(list).map(function (i) {
        return i.getAttribute('data-value') || i.id || labelOf(i);
      });
    }
    function axisOf(list, o) {
      if (o.axis !== 'auto') return o.axis;
      var items = itemsOf(list, o);
      if (items.length < 2) {
        var cs = getComputedStyle(list);
        return cs.display.indexOf('flex') >= 0 && cs.flexDirection.indexOf('row') === 0 ? 'x' : 'y';
      }
      var a = items[0].getBoundingClientRect(), b = items[1].getBoundingClientRect();
      return Math.abs(a.top - b.top) < Math.min(a.height, b.height) / 2 ? 'x' : 'y';
    }
    function canJoin(list, s) {
      if (!list._lwtSortable || !list.isConnected) return false;
      var o = sortOptions(list);
      if (o.disabled) return false;
      if (list === s.originList) return true;
      var a = groupsOf(s.originOptions.group), b = groupsOf(o.group);
      return a.some(function (g) { return b.indexOf(g) >= 0; });
    }
    function listFrom(node, s) {
      for (var n = node; n; n = n.parentElement) {
        if (n._lwtSortable && n !== s.source && canJoin(n, s)) return n;
      }
      return null;
    }
    // Moves `item` before `ref` in `list`, sliding the siblings that shift.
    function flipMove(item, list, ref, duration) {
      var lists = [list];
      if (item.parentElement && item.parentElement !== list) lists.push(item.parentElement);
      var els = [];
      lists.forEach(function (l) { els = els.concat(itemsOf(l)); });
      var first = els.map(function (e) { return e.getBoundingClientRect(); });
      list.insertBefore(item, ref);
      if (!duration || reduced()) return;
      els.forEach(function (e, i) {
        var last = e.getBoundingClientRect();
        var dx = first[i].left - last.left, dy = first[i].top - last.top;
        if (!dx && !dy) return;
        e._lwtFlip = true;
        var anim = e.animate([{ translate: dx + 'px ' + dy + 'px' }, { translate: '0px 0px' }],
          { duration: duration, easing: 'cubic-bezier(.2,.8,.2,1)' });
        anim.finished.then(function () { e._lwtFlip = false; }, function () { e._lwtFlip = false; });
      });
    }

    // ---- zones ----

    function accepts(zone, s) {
      var o = dropOptions(zone);
      if (o.disabled) return false;
      if (typeof o.accept === 'function') return !!o.accept(s.source, s.options.data);
      var want = groupsOf(o.accept);
      if (!want.length) return true;
      var have = groupsOf(s.options.group);
      return want.some(function (g) { return have.indexOf(g) >= 0; });
    }
    function zoneFrom(node, s) {
      for (var n = node; n; n = n.parentElement) {
        if (n._lwtDrop && n.isConnected && n !== s.source && !s.source.contains(n) && s.zonesActive.indexOf(n) >= 0) return n;
      }
      return null;
    }

    // ---- pointer flow ----

    function onPointerDown(e, ctx) {
      if (session || pending) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var target = e.target;
      var o, item, list = null, source;

      if (ctx.kind === 'sort') {
        list = ctx.el;
        o = sortOptions(list);
        if (o.disabled) return;
        item = itemFrom(target, list, o);
        if (!item) return;
        if (o.handle && !(target.closest(o.handle) && item.contains(target.closest(o.handle)))) return;
        source = item;
      } else {
        source = ctx.el;
        o = dragOptions(source);
        if (o.disabled) return;
        if (o.handle && !(target.closest(o.handle) && source.contains(target.closest(o.handle)))) return;
      }
      var inHandle = o.handle && target.closest(o.handle);
      if (!inHandle && target !== source && target.closest(IGNORE) && source.contains(target.closest(IGNORE))) return;

      pending = {
        kind: ctx.kind, source: source, list: list, options: o,
        pointerId: e.pointerId, pointerType: e.pointerType,
        x: e.clientX, y: e.clientY, timer: 0, ready: !(o.delay > 0 && e.pointerType === 'touch')
      };
      if (!pending.ready) {
        pending.timer = setTimeout(function () {
          if (pending) { pending.ready = true; begin(pending.x, pending.y); }
        }, o.delay);
      }
      window.addEventListener('pointermove', onPointerMove, true);
      window.addEventListener('pointerup', onPointerUp, true);
      window.addEventListener('pointercancel', onPointerCancel, true);
    }

    function onPointerMove(e) {
      if (pending && e.pointerId === pending.pointerId) {
        var moved = Math.hypot(e.clientX - pending.x, e.clientY - pending.y);
        if (!pending.ready) {
          // Moved before the press delay: it's a scroll, not a drag.
          if (moved > 8) abortPending();
          return;
        }
        if (moved >= pending.options.threshold) {
          var px = pending.x, py = pending.y;
          begin(px, py);
          if (session) move(e.clientX, e.clientY);
        }
        return;
      }
      if (session && !session.keyboard && e.pointerId === session.pointerId) {
        move(e.clientX, e.clientY);
      }
    }

    function onPointerUp(e) {
      if (pending && e.pointerId === pending.pointerId) { abortPending(); return; }
      if (session && !session.keyboard && e.pointerId === session.pointerId) finish(false);
    }

    function onPointerCancel(e) {
      if (pending && e.pointerId === pending.pointerId) { abortPending(); return; }
      if (session && !session.keyboard && e.pointerId === session.pointerId) finish(true);
    }

    function abortPending() {
      if (pending) clearTimeout(pending.timer);
      pending = null;
      if (!session) unlistenPointer();
    }

    function unlistenPointer() {
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerCancel, true);
    }

    // Stops the page scrolling under a touch drag (and under a pressed,
    // no-delay draggable before the threshold is met).
    document.addEventListener('touchmove', function (e) {
      if (session || (pending && pending.ready)) { if (e.cancelable) e.preventDefault(); }
    }, { passive: false });

    // ---- the drag itself ----

    function begin(x, y, keyboard) {
      var p = pending;
      pending = null;
      if (p) clearTimeout(p.timer);
      if (!p) return;
      start(p, x, y, !!keyboard);
      if (!session) unlistenPointer();
    }

    function start(p, x, y, keyboard) {
      var source = p.source, o = p.options;
      var rect = source.getBoundingClientRect();
      var s = {
        kind: p.kind, source: source, options: o, keyboard: keyboard,
        pointerId: p.pointerId, startX: x, startY: y, x: x, y: y,
        sx0: window.scrollX, sy0: window.scrollY,
        rect: rect, dx: 0, dy: 0, moved: false, zone: null, zonesActive: []
      };

      if (p.kind === 'sort') {
        s.originList = s.list = p.list;
        s.originOptions = o;
        s.originIndex = itemsOf(p.list, o).indexOf(source);
        var detail = { item: source, list: p.list, index: s.originIndex };
        if (!fire(p.list, 'lwt-sort-start', detail, true) || call(o.onStart, detail) === false) return;
      } else {
        s.base = source._lwtPos || { x: 0, y: 0 };
        var d = { element: source, data: o.data, mode: o.mode, x: x, y: y };
        if (!fire(source, 'lwt-drag-start', d, true) || call(o.onStart, d) === false) return;
      }

      session = s;
      injectCSS();
      if (window.getSelection) { try { window.getSelection().removeAllRanges(); } catch (err) {} }
      document.documentElement.classList.add('lwt-drag-active');

      if (s.kind === 'sort') {
        // With the keyboard the item itself moves through the list.
        if (!keyboard) {
          s.ghost = makeGhost(source, rect);
          source.classList.add('lwt-sort-placeholder');
        }
      } else if (o.mode === 'clone') {
        s.ghost = makeGhost(source, rect);
        source.classList.add('lwt-dragging');
      } else {
        source.classList.add('lwt-dragging');
        s.restore = { pe: source.style.pointerEvents, z: source.style.zIndex, pos: source.style.position };
        source.style.pointerEvents = 'none';
        source.style.zIndex = '2147482999';
        if (getComputedStyle(source).position === 'static') source.style.position = 'relative';
      }
      if (keyboard) source.classList.add('lwt-drag-lifted');

      if (s.kind === 'drag') {
        zones.forEach(function (z) {
          if (z.isConnected && z !== source && !source.contains(z) && accepts(z, s)) {
            s.zonesActive.push(z);
            z.classList.add('lwt-drop-active');
          }
        });
        s.boundsEl = o.bounds === 'parent' ? source.parentElement
          : (o.bounds && o.bounds !== 'window' ? document.querySelector(o.bounds) : null);
        s.boundsRect = s.boundsEl ? s.boundsEl.getBoundingClientRect() : null;
      }

      if (!keyboard) {
        window.addEventListener('keydown', onEscape, true);
        autoScroll();
      }
    }

    function onEscape(e) {
      if (e.key === 'Escape' && session && !session.keyboard) {
        e.preventDefault();
        finish(true);
      }
    }

    function constrain(s, dx, dy) {
      var o = s.options;
      if (o.axis === 'x') dy = 0;
      if (o.axis === 'y') dx = 0;
      if (o.grid) {
        dx = Math.round(dx / o.grid[0]) * o.grid[0];
        dy = Math.round(dy / o.grid[1]) * o.grid[1];
      }
      if (s.kind === 'drag' && o.bounds) {
        var sx = window.scrollX - s.sx0, sy = window.scrollY - s.sy0;
        var b = s.boundsRect
          ? { left: s.boundsRect.left, top: s.boundsRect.top, right: s.boundsRect.right, bottom: s.boundsRect.bottom }
          : { left: sx, top: sy, right: window.innerWidth + sx, bottom: window.innerHeight + sy };
        var r = s.rect;
        dx = Math.min(Math.max(dx, b.left - r.left), Math.max(b.left - r.left, b.right - r.right));
        dy = Math.min(Math.max(dy, b.top - r.top), Math.max(b.top - r.top, b.bottom - r.bottom));
      }
      return [dx, dy];
    }

    function move(x, y) {
      var s = session;
      if (!s) return;
      s.x = x; s.y = y;
      var scrollDx = window.scrollX - s.sx0, scrollDy = window.scrollY - s.sy0;
      var c = constrain(s, x - s.startX + scrollDx, y - s.startY + scrollDy);
      s.dx = c[0]; s.dy = c[1];
      s.moved = s.moved || s.dx !== 0 || s.dy !== 0;

      if (s.ghost) {
        s.ghost.style.left = (s.rect.left + s.dx - scrollDx) + 'px';
        s.ghost.style.top = (s.rect.top + s.dy - scrollDy) + 'px';
      } else {
        s.source.style.translate = (s.base.x + s.dx) + 'px ' + (s.base.y + s.dy) + 'px';
      }

      // What's under the pointer (or, with the keyboard, under the
      // element's centre)? The ghost/dragged element ignore the pointer.
      var hx = x, hy = y;
      if (s.keyboard) {
        var r = (s.ghost || s.source).getBoundingClientRect();
        hx = r.left + r.width / 2; hy = r.top + r.height / 2;
      }
      var under = document.elementFromPoint(hx, hy);

      if (s.kind === 'sort') { sortMove(s, hx, hy, under); return; }

      var zone = zoneFrom(under, s);
      var o = s.options;
      if (zone !== s.zone) {
        if (s.zone) {
          s.zone.classList.remove('lwt-drop-over');
          var ld = { element: s.source, data: o.data, zone: s.zone };
          fire(s.zone, 'lwt-drop-leave', ld);
          call(dropOptions(s.zone).onLeave, ld);
          call(o.onLeave, ld);
        }
        s.zone = zone;
        if (zone) {
          zone.classList.add('lwt-drop-over');
          var ed = { element: s.source, data: o.data, zone: zone };
          fire(zone, 'lwt-drop-enter', ed);
          call(dropOptions(zone).onEnter, ed);
          call(o.onEnter, ed);
        }
      }
      var md = { element: s.source, data: o.data, x: x, y: y, dx: s.dx, dy: s.dy, zone: zone,
                 position: { x: s.base.x + s.dx, y: s.base.y + s.dy } };
      if (zone) {
        fire(zone, 'lwt-drop-over', md);
        call(dropOptions(zone).onOver, md);
      }
      fire(s.source, 'lwt-drag-move', md);
      call(o.onMove, md);
    }

    function sortMove(s, x, y, under) {
      var list = listFrom(under, s);
      if (!list) return;
      var o = sortOptions(list);
      var axis = axisOf(list, o);
      var item = itemFrom(under, list, o);
      var ref;

      if (item && item !== s.source) {
        if (item._lwtFlip) return; // still sliding; wait so it doesn't flicker
        var r = item.getBoundingClientRect();
        var after = axis === 'x' ? x > r.left + r.width / 2 : y > r.top + r.height / 2;
        ref = after ? item.nextElementSibling : item;
      } else if (!item) {
        var items = itemsOf(list, o).filter(function (i) { return i !== s.source; });
        if (items.length) {
          var last = items[items.length - 1].getBoundingClientRect();
          var past = axis === 'x' ? (x > last.right || y > last.bottom) : y > last.bottom;
          if (!past) return;
          ref = items[items.length - 1].nextElementSibling;
        } else {
          ref = null;
        }
      } else {
        return; // over its own slot
      }
      while (ref && ref.classList.contains('lwt-drag-ghost')) ref = ref.nextElementSibling;
      if (ref === s.source) return;
      if (s.source.parentElement === list && s.source.nextElementSibling === ref) return;

      flipMove(s.source, list, ref, o.animation);
      s.list = list;
      var index = itemsOf(list, o).indexOf(s.source);
      var cd = { item: s.source, from: s.originList, to: list, index: index };
      fire(list, 'lwt-sort-change', cd);
      call(s.originOptions.onChange, cd);
      if (list !== s.originList) call(o.onChange, cd);
      if (s.keyboard) announce('Position ' + (index + 1) + ' of ' + itemsOf(list, o).length + '.');
    }

    // Ends the drag: dropped (or sorted), or cancelled and put back.
    function finish(cancelled) {
      var s = session;
      if (!s) return;
      session = null;
      stopAutoScroll();
      unlistenPointer();
      window.removeEventListener('keydown', onEscape, true);
      document.documentElement.classList.remove('lwt-drag-active');
      s.source.classList.remove('lwt-drag-lifted');
      if (s.moved && !s.keyboard) suppressClick();

      if (s.kind === 'sort') finishSort(s, cancelled);
      else finishDrag(s, cancelled);
    }

    function finishDrag(s, cancelled) {
      var o = s.options, source = s.source, zone = cancelled ? null : s.zone;
      var dropped = false, copy = null;
      s.zonesActive.forEach(function (z) { z.classList.remove('lwt-drop-active', 'lwt-drop-over'); });

      if (zone) {
        var zo = dropOptions(zone);
        var dd = { element: source, data: o.data, zone: zone, x: s.x, y: s.y, mode: o.mode };
        var ok = fire(zone, 'lwt-drop', dd, true) && call(zo.onDrop, dd) !== false && call(o.onDrop, dd) !== false;
        if (ok) {
          dropped = true;
          if (zo.action === 'append') {
            if (o.mode === 'clone') {
              copy = stripWiring(source.cloneNode(true));
              copy.classList.remove('lwt-dragging');
              zone.appendChild(copy);
            } else {
              source._lwtPos = { x: 0, y: 0 };
              source.style.translate = '';
              zone.appendChild(source);
            }
          }
        } else {
          announce('Drop not allowed here.');
        }
      }

      var goBack = cancelled || (zone && !dropped) || (!dropped && o.revert);
      var cleanup = function () {
        source.classList.remove('lwt-dragging');
        if (s.restore) {
          source.style.pointerEvents = s.restore.pe;
          source.style.zIndex = s.restore.z;
          source.style.position = s.restore.pos;
        }
      };

      if (s.ghost) {
        landGhost(s.ghost, goBack ? source.getBoundingClientRect() : null, cleanup);
      } else if (dropped && zone && dropOptions(zone).action === 'append') {
        cleanup();
      } else if (goBack) {
        slide(source, s.base.x + s.dx, s.base.y + s.dy, s.base.x, s.base.y, function () {
          source.style.translate = s.base.x || s.base.y ? s.base.x + 'px ' + s.base.y + 'px' : '';
          cleanup();
        });
      } else {
        source._lwtPos = { x: s.base.x + s.dx, y: s.base.y + s.dy };
        cleanup();
      }

      if (cancelled) {
        var cd = { element: source, data: o.data };
        fire(source, 'lwt-drag-cancel', cd);
        call(o.onCancel, cd);
      }
      var ed = { element: source, data: o.data, dropped: dropped, cancelled: !!cancelled, zone: dropped ? zone : null,
                 copy: copy, position: source._lwtPos || { x: 0, y: 0 } };
      fire(source, 'lwt-drag-end', ed);
      call(o.onEnd, ed);
      if (s.keyboard) announce(dropped ? 'Dropped.' : (cancelled ? 'Move cancelled.' : 'Moved.'));
    }

    function putBack(s) {
      var items = itemsOf(s.originList).filter(function (i) { return i !== s.source; });
      var ref = items[s.originIndex] || (items.length ? items[items.length - 1].nextElementSibling : null);
      flipMove(s.source, s.originList, ref, sortOptions(s.originList).animation);
      s.list = s.originList;
    }

    function finishSort(s, cancelled) {
      var source = s.source, oo = s.originOptions;
      if (cancelled) putBack(s);

      var to = s.list, newIndex = itemsOf(to).indexOf(source);
      var changed = !cancelled && (to !== s.originList || newIndex !== s.originIndex);
      if (changed) {
        var d = { item: source, from: s.originList, to: to, oldIndex: s.originIndex, newIndex: newIndex,
                  order: orderOf(to), fromOrder: to !== s.originList ? orderOf(s.originList) : null };
        var ok = fire(to, 'lwt-sort', d, true) && call(oo.onSort, d) !== false &&
                 (to === s.originList || call(sortOptions(to).onSort, d) !== false);
        if (ok && to !== s.originList) fire(s.originList, 'lwt-sort', d);
        if (!ok) { putBack(s); changed = false; }
      }
      if (cancelled) {
        var cd = { item: source, list: s.originList };
        fire(s.originList, 'lwt-sort-cancel', cd);
        call(oo.onCancel, cd);
      }

      var done = function () { source.classList.remove('lwt-sort-placeholder'); };
      if (s.ghost) landGhost(s.ghost, source.getBoundingClientRect(), done);
      else done();

      var ed = { item: source, from: s.originList, to: s.list, changed: changed, cancelled: !!cancelled,
                 index: itemsOf(s.list).indexOf(source) };
      fire(s.list, 'lwt-sort-end', ed);
      call(oo.onEnd, ed);
      if (s.keyboard) {
        announce(cancelled ? 'Move cancelled. Back at position ' + (s.originIndex + 1) + '.'
          : 'Dropped at position ' + (ed.index + 1) + ' of ' + itemsOf(s.list).length + '.');
        source.focus({ preventScroll: true });
      }
    }

    // Glides the ghost onto `rect` (or fades it out) and then removes it.
    function landGhost(g, rect, done) {
      var finish = function () { if (g.parentNode) g.parentNode.removeChild(g); if (done) done(); };
      if (reduced()) { finish(); return; }
      var frames = rect
        ? [{ left: g.style.left, top: g.style.top }, { left: rect.left + 'px', top: rect.top + 'px' }]
        : [{ opacity: getComputedStyle(g).opacity }, { opacity: 0 }];
      g.animate(frames, { duration: 160, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' })
        .finished.then(finish, finish);
    }

    function slide(el, x1, y1, x2, y2, done) {
      if (reduced() || (x1 === x2 && y1 === y2)) { done(); return; }
      el.animate([{ translate: x1 + 'px ' + y1 + 'px' }, { translate: x2 + 'px ' + y2 + 'px' }],
        { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished.then(done, done);
      el.style.translate = x2 + 'px ' + y2 + 'px';
    }

    // The click that follows a pointer drag shouldn't trigger links/buttons.
    function suppressClick() {
      var stop = function (e) { e.stopPropagation(); e.preventDefault(); };
      window.addEventListener('click', stop, true);
      setTimeout(function () { window.removeEventListener('click', stop, true); }, 0);
    }

    // ---- auto-scroll near the edges of the window or a scroll box ----

    var scrollRaf = 0;
    function scrollParentOf(node) {
      for (var n = node; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
        var cs = getComputedStyle(n);
        if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX) &&
            (n.scrollHeight > n.clientHeight || n.scrollWidth > n.clientWidth)) return n;
      }
      return null;
    }
    function edgeSpeed(pos, min, max) {
      var edge = 40;
      if (pos < min + edge) return -Math.ceil((min + edge - pos) / 3);
      if (pos > max - edge) return Math.ceil((pos - (max - edge)) / 3);
      return 0;
    }
    function autoScroll() {
      scrollRaf = requestAnimationFrame(function step() {
        var s = session;
        if (!s || s.keyboard) return;
        var box = scrollParentOf(s.kind === 'sort' ? s.list : s.source.parentElement);
        var scrolled = false;
        if (box) {
          var r = box.getBoundingClientRect();
          var bx = edgeSpeed(s.x, r.left, r.right), by = edgeSpeed(s.y, r.top, r.bottom);
          if (bx || by) {
            var bl = box.scrollLeft, bt = box.scrollTop;
            box.scrollLeft += bx; box.scrollTop += by;
            scrolled = box.scrollLeft !== bl || box.scrollTop !== bt;
          }
        }
        var wx = edgeSpeed(s.x, 0, window.innerWidth), wy = edgeSpeed(s.y, 0, window.innerHeight);
        if (wx || wy) {
          var ox = window.scrollX, oy = window.scrollY;
          window.scrollBy(wx, wy);
          scrolled = scrolled || window.scrollX !== ox || window.scrollY !== oy;
        }
        if (scrolled) move(s.x, s.y);
        scrollRaf = requestAnimationFrame(step);
      });
    }
    function stopAutoScroll() { cancelAnimationFrame(scrollRaf); scrollRaf = 0; }

    // ---- keyboard ----

    function onKeyDown(e, ctx) {
      var key = e.key;
      var s = session;

      if (s && s.keyboard) {
        var mine = ctx.kind === 'sort' ? ctx.el === s.originList || ctx.el === s.list : ctx.el === s.source;
        if (!mine) return;
        if (key === 'Escape') { e.preventDefault(); finish(true); return; }
        if (key === ' ' || key === 'Enter') { e.preventDefault(); finish(false); return; }
        if (key === 'Tab') { finish(false); return; }
        var arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (!arrows[key]) return;
        e.preventDefault();
        if (s.kind === 'sort') keyboardSort(s, arrows[key]);
        else {
          var step = s.options.step * (e.shiftKey ? 5 : 1);
          s.kx += arrows[key][0] * step; s.ky += arrows[key][1] * step;
          move(s.startX + s.kx, s.startY + s.ky);
        }
        return;
      }

      if (s || (key !== ' ' && key !== 'Enter')) return;
      var source, list = null, o;
      if (ctx.kind === 'sort') {
        list = ctx.el; o = sortOptions(list);
        if (o.disabled) return;
        source = itemFrom(e.target, list, o);
        if (!source) return;
        var h = o.handle && e.target.closest(o.handle);
        if (e.target !== source && !(h && source.contains(h))) return;
      } else {
        source = ctx.el; o = dragOptions(source);
        if (o.disabled) return;
        var hd = o.handle && e.target.closest(o.handle);
        if (e.target !== source && !(hd && source.contains(hd))) return;
      }
      e.preventDefault();
      var r = source.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      pending = { kind: ctx.kind, source: source, list: list, options: o, pointerId: null, x: cx, y: cy, ready: true };
      begin(cx, cy, true);
      if (!session) return;
      session.kx = 0; session.ky = 0;
      if (ctx.kind === 'sort') {
        var n = itemsOf(list, o).length;
        announce('Picked up ' + labelOf(source) + '. Position ' + (session.originIndex + 1) + ' of ' + n +
          '. Use the arrow keys to move, Space to drop, Escape to cancel.');
      } else {
        announce('Picked up ' + labelOf(source) + '. Use the arrow keys to move, Shift for bigger steps, ' +
          'Space to drop, Escape to cancel.');
      }
    }

    function keyboardSort(s, dir) {
      var list = s.list, o = sortOptions(list);
      var items = itemsOf(list, o), i = items.indexOf(s.source);
      var fwd = dir[0] + dir[1] > 0;
      var ref;
      if (fwd) {
        if (i >= items.length - 1) return;
        ref = items[i + 1].nextElementSibling;
      } else {
        if (i <= 0) return;
        ref = items[i - 1];
      }
      flipMove(s.source, list, ref, o.animation);
      s.source.focus({ preventScroll: true });
      s.source.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      var index = itemsOf(list, o).indexOf(s.source);
      var cd = { item: s.source, from: s.originList, to: list, index: index };
      fire(list, 'lwt-sort-change', cd);
      call(s.originOptions.onChange, cd);
      announce('Position ' + (index + 1) + ' of ' + items.length + '.');
    }

    // ---- wiring ----

    function wireCommon(el, ctx) {
      var down = function (e) { onPointerDown(e, ctx); };
      var key = function (e) { onKeyDown(e, ctx); };
      var native = function (e) { e.preventDefault(); }; // no browser image/link drag
      el.addEventListener('pointerdown', down);
      el.addEventListener('keydown', key);
      el.addEventListener('dragstart', native);
      return function () {
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('keydown', key);
        el.removeEventListener('dragstart', native);
      };
    }

    function makeDrag(el, options, declarative) {
      if (el._lwtDrag) { if (!declarative) el._lwtDrag.options = Object.assign({}, options); return el._lwtDrag.api; }
      injectCSS();
      var c = { options: Object.assign({}, options), declarative: !!declarative };
      el._lwtDrag = c;
      if (!declarative) {
        if (!(options && options.handle) && !(options && options.delay > 0)) el.style.touchAction = 'none';
        el.style.cursor = el.style.cursor || (options && options.handle ? '' : 'grab');
      }
      focusable(el);
      var off = wireCommon(el, { kind: 'drag', el: el });
      c.api = {
        element: el,
        enable: function () { c.options.disabled = false; el.removeAttribute('data-lwt-drag-disabled'); },
        disable: function () { c.options.disabled = true; },
        reset: function () { el._lwtPos = { x: 0, y: 0 }; el.style.translate = ''; },
        get position() { return Object.assign({ x: 0, y: 0 }, el._lwtPos); },
        destroy: function () { off(); delete el._lwtDrag; }
      };
      return c.api;
    }

    function makeDrop(el, options, declarative) {
      if (el._lwtDrop) { if (!declarative) el._lwtDrop.options = Object.assign({}, options); return el._lwtDrop.api; }
      injectCSS();
      var c = { options: Object.assign({}, options), declarative: !!declarative };
      el._lwtDrop = c;
      zones.add(el);
      c.api = {
        element: el,
        enable: function () { c.options.disabled = false; },
        disable: function () { c.options.disabled = true; },
        destroy: function () { zones.delete(el); delete el._lwtDrop; }
      };
      return c.api;
    }

    function makeSortable(el, options, declarative) {
      if (el._lwtSortable) { if (!declarative) el._lwtSortable.options = Object.assign({}, options); return el._lwtSortable.api; }
      injectCSS();
      var c = { options: Object.assign({}, options), declarative: !!declarative };
      el._lwtSortable = c;
      var prep = function () {
        var o = sortOptions(el);
        itemsOf(el, o).forEach(function (i) {
          focusable(i);
          if (!declarative && !o.handle && !(o.delay > 0)) i.style.touchAction = 'none';
        });
      };
      prep();
      var mo = typeof MutationObserver === 'function' ? new MutationObserver(prep) : null;
      if (mo) mo.observe(el, { childList: true });
      var off = wireCommon(el, { kind: 'sort', el: el });
      c.api = {
        element: el,
        order: function () { return orderOf(el); },
        items: function () { return itemsOf(el); },
        enable: function () { c.options.disabled = false; el.removeAttribute('data-lwt-sortable-disabled'); },
        disable: function () { c.options.disabled = true; },
        destroy: function () { off(); if (mo) mo.disconnect(); delete el._lwtSortable; }
      };
      return c.api;
    }

    function scanDnD(root) {
      if (!root || !root.querySelectorAll) return;
      var check = function (n) {
        if (n.hasAttribute('data-lwt-drag')) makeDrag(n, {}, true);
        if (n.hasAttribute('data-lwt-drop')) makeDrop(n, {}, true);
        if (n.hasAttribute('data-lwt-sortable')) makeSortable(n, {}, true);
      };
      if (root.hasAttribute) check(root);
      Array.prototype.forEach.call(root.querySelectorAll('[data-lwt-drag],[data-lwt-drop],[data-lwt-sortable]'), check);
    }

    function initDnD() {
      scanDnD(document);
      if (typeof MutationObserver === 'function' && document.body) {
        new MutationObserver(function (mutations) {
          mutations.forEach(function (m) {
            m.addedNodes.forEach(function (n) { if (n.nodeType === 1 && !n.classList.contains('lwt-drag-ghost')) scanDnD(n); });
          });
        }).observe(document.body, { childList: true, subtree: true });
      }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDnD);
    else initDnD();

    // ---- public JS API ----

    namespace.drag = function (el, options) { return makeDrag(el, options || {}, false); };
    namespace.drop = function (el, options) { return makeDrop(el, options || {}, false); };
    namespace.sortable = function (el, options) { return makeSortable(el, options || {}, false); };
    namespace.dnd = {
      refresh: function () { scanDnD(document); },
      cancel: function () { finish(true); },
      get active() { return !!session; },
      get current() { return session ? { element: session.source, kind: session.kind, zone: session.zone || null, list: session.list || null } : null; }
    };
  })();

})();
