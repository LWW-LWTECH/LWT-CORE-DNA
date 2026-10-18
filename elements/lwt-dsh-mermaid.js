/*!
 * <lwtd-mermaid>
 * Renders a Mermaid diagram (flowchart, sequence, gantt, pie, class,
 * state, ER, mindmap, ...) from text. Mermaid itself (~3.5 MB) is loaded
 * from jsDelivr only when the first diagram on the page scrolls into view.
 *
 *   <lwtd-mermaid label="AI industry overview" pan-zoom download>
 *     <script type="text/plain">
 *       graph TD
 *         A[AI Industry] --> B[Foundation Model Creators]
 *     </script>
 *   </lwtd-mermaid>
 *
 * Put the diagram text in a <script type="text/plain"> (or <template>)
 * so the browser keeps it exactly as written -- labels like A[R&D] or
 * B[one<br>two] would otherwise be parsed as HTML. Plain text content
 * works too for simple diagrams.
 *
 * Attributes:
 *   label        — accessible name / caption of the diagram
 *   pan-zoom     — boolean; drag to pan, Ctrl/Cmd + wheel or pinch to zoom,
 *                  plus zoom in / out / fit buttons and arrow / + / - / 0 keys
 *   download     — boolean; "SVG" and "PNG" download buttons
 *   fullscreen   — boolean; a full-screen button. Uses the browser's
 *                  full-screen mode (Esc or the button exits); where that
 *                  isn't available the diagram covers the page instead.
 *   filename     — download file name without extension (default: from label)
 *   direction    — which way the arrows flow: TB / TD (top to bottom), BT,
 *                  LR (left to right), RL. Overrides the direction in the
 *                  text. A wide tree drawn TB (root at the top, children
 *                  spread sideways) becomes a tall one with LR (each level
 *                  is a column, siblings stack vertically). Applies to flowcharts and
 *                  state / class diagrams; other types have no direction.
 *   theme        — "lwt" (default: colors from the --lwt-* variables) or a
 *                  Mermaid theme: "default", "neutral", "dark", "forest"
 *   mermaid-src  — URL of mermaid.min.js (default: window.LWT.mermaidSrc,
 *                  else jsDelivr mermaid@11.17.2)
 *
 * Properties: .definition (get/set the diagram text), .svg (rendered
 * <svg> or null), .render() (re-render now), .fit() (pan-zoom: fit view),
 * .toggleFullscreen(force) / .isFullscreen
 * Events: lwt-render { svg }, lwt-error { message }, lwt-fullscreen { active }
 *
 * Custom palette (`palette` attribute, `.palette` property,
 * --lwt-chart-palette or LWT.chart.palette; theme="lwt" only): the first
 * color styles the nodes, and the colors in order are used by pie charts,
 * journeys, timelines, mindmaps and git graphs.
 *
 * Theming: --lwt-mermaid-bg, --lwt-mermaid-node-bg, --lwt-mermaid-node-border,
 * --lwt-mermaid-text, --lwt-mermaid-line, --lwt-mermaid-font-size,
 * --lwt-mermaid-border, --lwt-mermaid-radius, --lwt-mermaid-padding,
 * --lwt-mermaid-height (pan-zoom viewport, default 420px)
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-dsh-mermaid.js requires lwt-core.js to be loaded first.');
  }

  var DEFAULT_SRC = 'https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.min.js';
  var MIN_SCALE = 0.1, MAX_SCALE = 8;
  var loading = null;
  var queue = Promise.resolve(); // mermaid.initialize() is global: render one diagram at a time
  var uid = 0;

  function loadMermaid(src) {
    if (window.mermaid && typeof window.mermaid.render === 'function') return Promise.resolve(window.mermaid);
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () {
        if (window.mermaid && typeof window.mermaid.render === 'function') resolve(window.mermaid);
        else { loading = null; reject(new Error('Mermaid loaded but window.mermaid is missing.')); }
      };
      s.onerror = function () { loading = null; reject(new Error('Could not load Mermaid from ' + src)); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function dedent(text) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    var indent = Infinity;
    lines.forEach(function (l) { if (l.trim()) indent = Math.min(indent, l.match(/^[ \t]*/)[0].length); });
    if (!isFinite(indent)) indent = 0;
    return lines.map(function (l) { return l.slice(indent); }).join('\n');
  }

  function parseRgb(str) {
    var m = String(str).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }
  function hex(rgb) {
    return '#' + rgb.map(function (n) { var h = Math.round(Math.max(0, Math.min(255, n))).toString(16); return h.length < 2 ? '0' + h : h; }).join('');
  }
  function mix(a, b, t) { return [0, 1, 2].map(function (i) { return a[i] * t + b[i] * (1 - t); }); }

  function slug(str) {
    return String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'diagram';
  }

  var ICONS = {
    zoomIn: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
    zoomOut: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
    fit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    enter: '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    exit: '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>'
  };

  var CSS = `
    :host { display: block; font-family: inherit; color: var(--lwt-mermaid-text, var(--lwt-color-text, #374151)); }
    :host([hidden]) { display: none; }
    .frame {
      position: relative;
      background: var(--lwt-mermaid-bg, var(--lwt-color-surface, #fff));
      border: var(--lwt-mermaid-border, var(--lwt-border, 1px solid #e5e7eb));
      border-radius: var(--lwt-mermaid-radius, var(--lwt-border-radius, 8px));
      padding: var(--lwt-mermaid-padding, var(--lwt-padding, 0.75rem));
      overflow: hidden;
    }
    .canvas svg { display: block; max-width: 100%; height: auto; margin: 0 auto; }
    /* pan-zoom: fixed-height viewport, diagram at natural size, transformed */
    :host([pan-zoom]) .viewport {
      position: relative;
      height: var(--lwt-mermaid-height, 420px);
      overflow: hidden;
      cursor: grab;
      touch-action: none;
      outline: none;
      /* Dragging to pan must not select the diagram's text. */
      user-select: none;
      -webkit-user-select: none;
    }
    :host([pan-zoom]) .viewport.dragging { cursor: grabbing; }
    :host([pan-zoom]) .viewport:focus-visible { box-shadow: inset 0 0 0 2px var(--lwt-focus-color, #2563eb); border-radius: 4px; }
    :host([pan-zoom]) .canvas { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
    :host([pan-zoom]) .canvas svg { max-width: none; margin: 0; }
    .toolbar {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      z-index: 2;
      display: flex;
      gap: 0.25rem;
      padding: 0.2rem;
      background: color-mix(in srgb, var(--lwt-mermaid-bg, var(--lwt-color-surface, #fff)) 90%, transparent);
      border: var(--lwt-border, 1px solid #e5e7eb);
      border-radius: var(--lwt-border-radius, 6px);
    }
    .toolbar[hidden], .tb-group[hidden] { display: none; }
    .tb-group { display: flex; gap: 0.25rem; }
    .toolbar button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      min-width: 28px;
      min-height: 28px;
      padding: 0 0.4rem;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 0.78rem;
      cursor: pointer;
    }
    .toolbar button:hover { background: var(--lwt-color-surface-alt, rgba(0,0,0,0.06)); }
    .toolbar button:focus-visible { outline: 2px solid var(--lwt-focus-color, #2563eb); outline-offset: 1px; }
    .toolbar svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    /* Full screen: the frame fills the screen and the diagram fills the frame. */
    :host([data-fullscreen]) { background: var(--lwt-mermaid-bg, var(--lwt-color-surface, #fff)); }
    :host([data-fullscreen-fallback]) {
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      margin: 0;
    }
    :host([data-fullscreen]) .frame {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      height: 100dvh;
      border-radius: 0;
      border: none;
    }
    :host([data-fullscreen]) .viewport { flex: 1; min-height: 0; overflow: auto; }
    :host([data-fullscreen][pan-zoom]) .viewport { height: auto; overflow: hidden; }
    :host([data-fullscreen]:not([pan-zoom])) .canvas svg { max-height: 100%; width: auto; }
    .status { font-size: 0.85rem; color: var(--lwt-color-text-muted, #6b7280); padding: 1rem; text-align: center; }
    .status:empty { display: none; }
    .status.error {
      text-align: left;
      color: var(--lwt-color-danger, #b91c1c);
      white-space: pre-wrap;
      font-family: Consolas, Menlo, monospace;
      font-size: 0.8rem;
    }
    .probe { position: absolute; width: 0; height: 0; overflow: hidden; }
  `;

  var TEMPLATE =
    '<figure class="frame" part="frame" style="margin:0">' +
    '  <div class="toolbar" part="toolbar" role="toolbar" aria-label="Diagram controls" hidden>' +
    '    <span class="tb-group tb-zoom" hidden>' +
    '      <button type="button" data-act="out" aria-label="Zoom out" title="Zoom out">' + ICONS.zoomOut + '</button>' +
    '      <button type="button" data-act="in" aria-label="Zoom in" title="Zoom in">' + ICONS.zoomIn + '</button>' +
    '      <button type="button" data-act="fit" aria-label="Fit diagram" title="Fit diagram">' + ICONS.fit + '</button>' +
    '    </span>' +
    '    <span class="tb-group tb-download" hidden>' +
    '      <button type="button" data-act="svg" aria-label="Download SVG" title="Download SVG">' + ICONS.download + 'SVG</button>' +
    '      <button type="button" data-act="png" aria-label="Download PNG" title="Download PNG">' + ICONS.download + 'PNG</button>' +
    '    </span>' +
    '    <span class="tb-group tb-fullscreen" hidden>' +
    '      <button type="button" data-act="fullscreen" aria-label="Full screen" title="Full screen" aria-pressed="false">' + ICONS.enter + '</button>' +
    '    </span>' +
    '  </div>' +
    '  <div class="viewport" part="viewport"><div class="canvas" part="canvas"></div></div>' +
    '  <div class="status" part="status"></div>' +
    '  <figcaption class="lwt-sr-only outline"></figcaption>' +
    '</figure>' +
    '<span class="probe" aria-hidden="true"></span>';

  class LWTMermaid extends window.LWT.Element {
    static get observedAttributes() {
      return ['label', 'theme', 'pan-zoom', 'download', 'fullscreen', 'mermaid-src', 'filename', 'direction', 'palette'];
    }

    constructor() {
      super();
      this._defOverride = null;
      this._renderToken = 0;
      this._seen = false;        // has been near the viewport (and so measurable)
      this._view = { x: 0, y: 0, s: 1 };
      this._pointers = {};
      this._fallbackFs = false;
      this._onFsChange = this._onFsChange.bind(this);
      this._onFsKey = this._onFsKey.bind(this);
    }

    connectedCallback() {
      super.connectedCallback();
      var self = this;
      // Re-render when the diagram text in the light DOM changes.
      if (!this._mo) {
        this._mo = new MutationObserver(function () { if (self._defOverride === null) self._requestRender(); });
      }
      this._mo.observe(this, { childList: true, characterData: true, subtree: true });
      document.addEventListener('fullscreenchange', this._onFsChange);
      document.addEventListener('webkitfullscreenchange', this._onFsChange);
      // Load / render only once the diagram is (nearly) on screen.
      if (typeof IntersectionObserver === 'function') {
        if (!this._io) {
          this._io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
              if (en.isIntersecting && !self._seen) { self._seen = true; self.render(); }
            });
          }, { rootMargin: '200px' });
        }
        this._io.observe(this);
      } else {
        this._seen = true;
        this.render();
      }
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      if (this.isFullscreen) this.toggleFullscreen(false);
      document.removeEventListener('fullscreenchange', this._onFsChange);
      document.removeEventListener('webkitfullscreenchange', this._onFsChange);
      if (this._mo) this._mo.disconnect();
      if (this._io) this._io.disconnect();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue || !this._canvas) return;
      this._syncChrome();
      if (name === 'theme' || name === 'mermaid-src' || name === 'pan-zoom' || name === 'direction' || name === 'palette') this._requestRender();
    }

    render() {
      if (!this._canvas) {
        this._renderShadow(TEMPLATE, CSS + window.LWT.a11y.SR_ONLY_CSS);
        var root = this._root;
        this._frame = root.querySelector('.frame');
        this._toolbar = root.querySelector('.toolbar');
        this._viewport = root.querySelector('.viewport');
        this._canvas = root.querySelector('.canvas');
        this._status = root.querySelector('.status');
        this._outline = root.querySelector('.outline');
        this._probe = root.querySelector('.probe');
        this._wireToolbar();
        this._wirePanZoom();
        this._syncChrome();
      }
      if (this._seen) this._draw();
    }

    // ---- public API ----
    get definition() {
      if (this._defOverride !== null) return this._defOverride;
      var holder = this.querySelector(':scope > script[type="text/plain"], :scope > script[type="text/mermaid"], :scope > template');
      if (holder) return dedent(holder.localName === 'template' ? holder.innerHTML.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&') : holder.textContent);
      return dedent(this.textContent);
    }
    set definition(text) {
      this._defOverride = text == null ? null : String(text);
      this._requestRender();
    }

    get svg() { return this._canvas ? this._canvas.querySelector('svg') : null; }

    fit() {
      if (!this._boolAttr('pan-zoom')) return;
      var svg = this.svg;
      if (!svg) return;
      var vw = this._viewport.clientWidth, vh = this._viewport.clientHeight;
      var w = this._natural.w, h = this._natural.h;
      if (!vw || !vh || !w || !h) return;
      // Keep the fitted diagram clear of the toolbar in the top-right corner.
      var top = this._toolbar.hidden ? 0 : this._toolbar.offsetHeight + 8;
      var s = Math.min(vw / w, (vh - top) / h, 1);
      this._view = { s: s, x: (vw - w * s) / 2, y: top + (vh - top - h * s) / 2 };
      this._applyView();
    }

    // ---- rendering ----
    _requestRender() {
      if (!this._canvas) return;
      if (this._seen && this.getClientRects().length) this._draw();
      else if (this._seen) this._seen = false; // hidden now: wait to become visible again
    }

    _syncChrome() {
      var label = this._strAttr('label', '');
      var pz = this._boolAttr('pan-zoom'), dl = this._boolAttr('download'), fs = this._boolAttr('fullscreen');
      this._toolbar.hidden = !(pz || dl || fs);
      this._root.querySelector('.tb-zoom').hidden = !pz;
      this._root.querySelector('.tb-download').hidden = !dl;
      this._root.querySelector('.tb-fullscreen').hidden = !fs;
      if (!fs && this.isFullscreen) this.toggleFullscreen(false);
      this._ensureAttr('role', 'group');
      this._ensureAttr('aria-label', this._a11yName([label], 'Diagram', 'Add a label attribute'));
      if (pz) {
        this._viewport.tabIndex = 0;
        this._viewport.setAttribute('aria-label', (label || 'Diagram') + '. Drag or use arrow keys to pan; plus and minus to zoom; 0 to fit.');
        this._viewport.setAttribute('role', 'application');
      } else {
        this._viewport.removeAttribute('tabindex');
        this._viewport.removeAttribute('aria-label');
        this._viewport.removeAttribute('role');
        this._canvas.style.transform = '';
      }
    }

    // Resolve a CSS color expression (with var() fallbacks) to rgb.
    _color(expr, fallback) {
      this._probe.style.color = '';
      this._probe.style.color = expr;
      return parseRgb(getComputedStyle(this._probe).color) || fallback;
    }

    _themeConfig() {
      var theme = this._strAttr('theme', 'lwt');
      var font = getComputedStyle(this).fontFamily || 'sans-serif';
      var size = getComputedStyle(this).getPropertyValue('--lwt-mermaid-font-size').trim() || '14px';
      var base = { startOnLoad: false, securityLevel: 'strict', fontFamily: font,
        htmlLabels: false, flowchart: { htmlLabels: false, useMaxWidth: true } };
      if (theme !== 'lwt') { base.theme = theme; return base; }
      var surface = this._color('var(--lwt-mermaid-bg, var(--lwt-color-surface, #fff))', [255, 255, 255]);
      var primary = this._color('var(--lwt-mermaid-node-border, var(--lwt-primary, #2563eb))', [37, 99, 235]);
      var text = this._color('var(--lwt-mermaid-text, var(--lwt-color-text-strong, #111827))', [17, 24, 39]);
      var line = this._color('var(--lwt-mermaid-line, var(--lwt-color-text-muted, #6b7280))', [107, 114, 128]);
      var nodeBg = this._color('var(--lwt-mermaid-node-bg, transparent)', null);
      if (!nodeBg || getComputedStyle(this._probe).color.indexOf('rgba(0, 0, 0, 0)') === 0) nodeBg = mix(primary, surface, 0.12);
      // Custom palette: the first color styles the nodes; the rest feed the
      // multi-color diagrams (pie, journey, timeline, mindmap, git...).
      var pal = window.LWT.chart.resolve(this, null);
      var self = this;
      var palRgb = pal.custom ? pal.map(function (p) { return self._color(p.stroke, null); }).filter(Boolean) : [];
      if (palRgb.length) { primary = palRgb[0]; nodeBg = mix(primary, surface, 0.12); }
      var border = this._color('var(--lwt-border-color, #e5e7eb)', [229, 231, 235]);
      base.theme = 'base';
      base.themeVariables = {
        fontFamily: font, fontSize: size,
        background: hex(surface), mainBkg: hex(nodeBg), primaryColor: hex(nodeBg),
        primaryBorderColor: hex(primary), nodeBorder: hex(primary),
        primaryTextColor: hex(text), textColor: hex(text), nodeTextColor: hex(text),
        secondaryColor: hex(mix(primary, surface, 0.06)), tertiaryColor: hex(mix(primary, surface, 0.03)),
        lineColor: hex(line), defaultLinkColor: hex(line),
        clusterBkg: hex(mix(primary, surface, 0.05)), clusterBorder: hex(border),
        edgeLabelBackground: hex(surface), titleColor: hex(text)
      };
      var tv = base.themeVariables;
      palRgb.forEach(function (c, i) {
        if (i < 12) {
          tv['pie' + (i + 1)] = hex(c);
          tv['cScale' + i] = hex(mix(c, surface, 0.35));
          tv['cScalePeer' + i] = hex(c);
          tv['cScaleLabel' + i] = hex(text);
        }
        if (i < 8) { tv['git' + i] = hex(c); tv['gitBranchLabel' + i] = hex(surface); }
      });
      return base;
    }

    // Override the layout direction from the `direction` attribute.
    _applyDirection(text) {
      var dir = this._strAttr('direction', '').trim().toUpperCase();
      if (dir === 'TD') dir = 'TB';
      if (['TB', 'BT', 'LR', 'RL'].indexOf(dir) === -1) return text;
      var lines = text.split('\n');
      var i = 0, inFront = false;
      // Skip YAML front matter, %%{init}%% directives and comments.
      for (; i < lines.length; i++) {
        var t = lines[i].trim();
        if (i === 0 && t === '---') { inFront = true; continue; }
        if (inFront) { if (t === '---') inFront = false; continue; }
        if (!t || t.indexOf('%%') === 0) continue;
        break;
      }
      if (i >= lines.length) return text;
      var head = lines[i];
      var m = /^(\s*)(graph|flowchart)\b(\s+(TB|TD|BT|LR|RL)\b)?(.*)$/i.exec(head);
      if (m) {
        lines[i] = m[1] + m[2] + ' ' + dir + m[5];
      } else if (/^\s*(stateDiagram(-v2)?|classDiagram(-v2)?)\b/i.test(head)) {
        // Replace a top-level direction line right after the header, or add one.
        var next = i + 1;
        while (next < lines.length && !lines[next].trim()) next++;
        if (next < lines.length && /^\s*direction\s+\w+\s*$/i.test(lines[next])) lines[next] = '  direction ' + dir;
        else lines.splice(i + 1, 0, '  direction ' + dir);
      }
      return lines.join('\n');
    }

    _draw() {
      var self = this;
      var text = this._applyDirection(this.definition);
      var token = ++this._renderToken;
      if (!text.trim()) { this._canvas.innerHTML = ''; this._setStatus(''); return; }
      if (!this.svg) this._setStatus('Loading diagram…');
      var src = this._strAttr('mermaid-src', '') || (window.LWT && window.LWT.mermaidSrc) || DEFAULT_SRC;

      loadMermaid(src).then(function (mermaid) {
        queue = queue.then(function () {
          if (token !== self._renderToken) return null;
          mermaid.initialize(self._themeConfig());
          var id = 'lwtd-mermaid-' + (++uid);
          return mermaid.render(id, text).then(function (out) {
            if (token !== self._renderToken) return;
            self._show(out.svg);
            return self._buildOutline(mermaid, text);
          }, function (err) {
            // A failed render can leave Mermaid's scratch element behind.
            ['d' + id, id].forEach(function (x) { var el = document.getElementById(x); if (el) el.remove(); });
            if (token === self._renderToken) self._fail(err);
          });
        }).catch(function () { /* keep the queue alive */ });
      }, function (err) {
        if (token === self._renderToken) self._fail(err);
      });
    }

    _show(svgText) {
      this._canvas.innerHTML = svgText;
      this._setStatus('');
      var svg = this.svg;
      if (!svg) return;
      var vb = svg.viewBox && svg.viewBox.baseVal;
      this._natural = { w: vb && vb.width || svg.getBoundingClientRect().width, h: vb && vb.height || svg.getBoundingClientRect().height };
      if (this._boolAttr('pan-zoom')) {
        // Natural size inside the viewport; panning / zooming is a transform.
        svg.removeAttribute('style');
        svg.setAttribute('width', this._natural.w);
        svg.setAttribute('height', this._natural.h);
        this.fit();
      }
      this.emit('render', { svg: svg });
    }

    _fail(err) {
      var msg = (err && (err.message || err.str)) || String(err);
      this._canvas.innerHTML = '';
      this._outline.textContent = '';
      this._setStatus('Diagram error:\n' + msg, true);
      this.emit('error', { message: msg });
    }

    _setStatus(text, isError) {
      this._status.textContent = text;
      this._status.classList.toggle('error', !!isError);
      if (isError) this._status.setAttribute('role', 'alert'); else this._status.removeAttribute('role');
    }

    // Screen-reader outline for flowcharts: the node hierarchy as a nested
    // list. Other diagram types keep Mermaid's own accTitle / accDescr.
    _buildOutline(mermaid, text) {
      var self = this;
      var label = this._strAttr('label', '') || 'Diagram';
      var svg = this.svg;
      if (svg) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); }
      this._outline.textContent = label;
      var api = mermaid.mermaidAPI;
      if (!api || typeof api.getDiagramFromText !== 'function') return null;
      return Promise.resolve(api.getDiagramFromText(text)).then(function (diagram) {
        var db = diagram && diagram.db;
        if (!db || typeof db.getVertices !== 'function' || typeof db.getEdges !== 'function') return;
        var vMap = db.getVertices();
        var vertices = typeof vMap.forEach === 'function' && !Array.isArray(vMap) && typeof vMap.get === 'function'
          ? vMap : { get: function (k) { return vMap[k]; }, forEach: function (fn) { Object.keys(vMap).forEach(function (k) { fn(vMap[k], k); }); } };
        var edges = db.getEdges() || [];
        if (!edges.length) return;
        var nameOf = function (id) { var v = vertices.get(id); return (v && (v.text || v.label)) || id; };
        var children = {}, hasParent = {}, ids = [];
        vertices.forEach(function (v, id) { ids.push(id); });
        edges.forEach(function (e) {
          (children[e.start] = children[e.start] || []).push({ id: e.end, text: e.text });
          hasParent[e.end] = true;
        });
        var roots = ids.filter(function (id) { return !hasParent[id]; });
        if (!roots.length && ids.length) roots = [ids[0]];
        var seen = {};
        var esc = window.LWT.a11y.escape;
        var list = function (id) {
          seen[id] = true;
          var kids = (children[id] || []).filter(function (k) { return !seen[k.id]; });
          var html = '<li>' + esc(String(nameOf(id)).replace(/<br\s*\/?>/gi, ' '));
          if (kids.length) html += '<ul>' + kids.map(function (k) { return list(k.id); }).join('') + '</ul>';
          return html + '</li>';
        };
        self._outline.innerHTML = esc(label) + ' (outline): <ul>' + roots.map(list).join('') + '</ul>';
        if (svg) svg.setAttribute('aria-hidden', 'true'); // the outline carries the content
      }).catch(function () { /* outline is a bonus; ignore parse quirks */ });
    }

    // ---- full screen ----
    get isFullscreen() {
      var fe = document.fullscreenElement || document.webkitFullscreenElement;
      return fe === this || this._fallbackFs;
    }

    toggleFullscreen(force) {
      var want = force === undefined ? !this.isFullscreen : !!force;
      if (want === this.isFullscreen) return;
      var native = this.requestFullscreen || this.webkitRequestFullscreen;
      if (want) {
        if (native) {
          var self = this;
          var p = native.call(this);
          // Refused (e.g. inside an iframe without allowfullscreen): cover the page instead.
          if (p && typeof p.catch === 'function') p.catch(function () { self._setFallback(true); });
        } else {
          this._setFallback(true);
        }
      } else if (this._fallbackFs) {
        this._setFallback(false);
      } else {
        var exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
      }
    }

    _setFallback(on) {
      this._fallbackFs = on;
      this.toggleAttribute('data-fullscreen-fallback', on);
      var html = document.documentElement;
      if (on) {
        // Stop the page behind from scrolling; restore it on exit.
        this._prevOverflow = html.style.overflow;
        html.style.overflow = 'hidden';
        document.addEventListener('keydown', this._onFsKey, true);
      } else {
        html.style.overflow = this._prevOverflow || '';
        document.removeEventListener('keydown', this._onFsKey, true);
      }
      this._onFsChange();
    }

    _onFsKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); this._setFallback(false); }
    }

    _onFsChange() {
      var active = this.isFullscreen;
      if (this.hasAttribute('data-fullscreen') === active) return;
      this.toggleAttribute('data-fullscreen', active);
      var btn = this._root.querySelector('[data-act="fullscreen"]');
      if (btn) {
        btn.innerHTML = active ? ICONS.exit : ICONS.enter;
        btn.setAttribute('aria-pressed', String(active));
        btn.setAttribute('aria-label', active ? 'Exit full screen' : 'Full screen');
        btn.title = active ? 'Exit full screen (Esc)' : 'Full screen';
      }
      var self = this;
      // Re-fit once the new size has been laid out.
      requestAnimationFrame(function () { requestAnimationFrame(function () { self.fit(); }); });
      this.emit('fullscreen', { active: active });
    }

    // ---- toolbar ----
    _wireToolbar() {
      var self = this;
      this._toolbar.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('button');
        if (!btn) return;
        var act = btn.getAttribute('data-act');
        if (act === 'in') self._zoomAt(1.25);
        else if (act === 'out') self._zoomAt(0.8);
        else if (act === 'fit') self.fit();
        else if (act === 'svg') self._downloadSvg();
        else if (act === 'png') self._downloadPng();
        else if (act === 'fullscreen') self.toggleFullscreen();
      });
    }

    _fileName() {
      return this._strAttr('filename', '') || slug(this._strAttr('label', ''));
    }

    // A standalone copy of the diagram at natural size, with a background.
    _exportSvgText() {
      var svg = this.svg;
      if (!svg) return null;
      var clone = svg.cloneNode(true);
      var w = Math.ceil(this._natural.w), h = Math.ceil(this._natural.h);
      clone.removeAttribute('style');
      clone.removeAttribute('aria-hidden');
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', w);
      clone.setAttribute('height', h);
      var bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      var vb = svg.viewBox.baseVal;
      bg.setAttribute('x', vb ? vb.x : 0); bg.setAttribute('y', vb ? vb.y : 0);
      bg.setAttribute('width', vb ? vb.width : w); bg.setAttribute('height', vb ? vb.height : h);
      bg.setAttribute('fill', hex(this._color('var(--lwt-mermaid-bg, var(--lwt-color-surface, #fff))', [255, 255, 255])));
      clone.insertBefore(bg, clone.firstChild);
      return { text: new XMLSerializer().serializeToString(clone), w: w, h: h };
    }

    _save(blob, ext) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = this._fileName() + '.' + ext;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    _downloadSvg() {
      var out = this._exportSvgText();
      if (out) this._save(new Blob([out.text], { type: 'image/svg+xml' }), 'svg');
    }

    _downloadPng() {
      var self = this;
      var out = this._exportSvgText();
      if (!out) return;
      var scale = Math.max(2, window.devicePixelRatio || 1);
      var img = new Image();
      var url = URL.createObjectURL(new Blob([out.text], { type: 'image/svg+xml' }));
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = out.w * scale;
        canvas.height = out.h * scale;
        var ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, out.w, out.h);
        URL.revokeObjectURL(url);
        try {
          canvas.toBlob(function (blob) { if (blob) self._save(blob, 'png'); }, 'image/png');
        } catch (e) {
          // Diagram types that embed HTML can't be drawn to a canvas.
          window.LWT.a11y.announce('PNG export is not available for this diagram; use SVG instead.', { assertive: true });
          self.emit('error', { message: 'PNG export is not available for this diagram type; use SVG.' });
        }
      };
      img.onerror = function () { URL.revokeObjectURL(url); };
      img.src = url;
    }

    // ---- pan / zoom ----
    _applyView() {
      var v = this._view;
      this._canvas.style.transform = 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.s + ')';
    }

    // Zoom by `factor` around a point in the viewport (default: centre).
    _zoomAt(factor, cx, cy) {
      if (!this._boolAttr('pan-zoom') || !this.svg) return;
      var v = this._view;
      if (cx == null) { cx = this._viewport.clientWidth / 2; cy = this._viewport.clientHeight / 2; }
      var s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.s * factor));
      var k = s / v.s;
      this._view = { s: s, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
      this._applyView();
    }

    _wirePanZoom() {
      var self = this;
      var vp = this._viewport;
      var last = null, pinchDist = 0;
      var on = function () { return self._boolAttr('pan-zoom'); };
      var local = function (e) { var r = vp.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

      vp.addEventListener('pointerdown', function (e) {
        if (!on() || e.button > 0) return;
        e.preventDefault(); // no text selection / native drag while panning
        vp.setPointerCapture(e.pointerId);
        self._pointers[e.pointerId] = local(e);
        last = local(e);
        vp.classList.add('dragging');
      });
      vp.addEventListener('pointermove', function (e) {
        if (!on() || !self._pointers[e.pointerId]) return;
        var p = local(e);
        self._pointers[e.pointerId] = p;
        var ids = Object.keys(self._pointers);
        if (ids.length === 2) {
          // Pinch: zoom around the midpoint of the two fingers.
          var a = self._pointers[ids[0]], b = self._pointers[ids[1]];
          var d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinchDist) self._zoomAt(d / pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
          pinchDist = d;
          return;
        }
        if (last) {
          self._view.x += p.x - last.x;
          self._view.y += p.y - last.y;
          self._applyView();
        }
        last = p;
      });
      var end = function (e) {
        delete self._pointers[e.pointerId];
        pinchDist = 0;
        last = null;
        if (!Object.keys(self._pointers).length) vp.classList.remove('dragging');
      };
      vp.addEventListener('pointerup', end);
      vp.addEventListener('pointercancel', end);
      // Ctrl / Cmd + wheel zooms (plain wheel keeps scrolling the page).
      vp.addEventListener('wheel', function (e) {
        if (!on() || !(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        var p = local(e);
        self._zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
      }, { passive: false });
      vp.addEventListener('keydown', function (e) {
        if (!on()) return;
        var step = e.shiftKey ? 120 : 40, handled = true;
        if (e.key === 'ArrowLeft') self._view.x += step;
        else if (e.key === 'ArrowRight') self._view.x -= step;
        else if (e.key === 'ArrowUp') self._view.y += step;
        else if (e.key === 'ArrowDown') self._view.y -= step;
        else if (e.key === '+' || e.key === '=') { self._zoomAt(1.25); return e.preventDefault(); }
        else if (e.key === '-' || e.key === '_') { self._zoomAt(0.8); return e.preventDefault(); }
        else if (e.key === '0') { self.fit(); return e.preventDefault(); }
        else handled = false;
        if (handled) { e.preventDefault(); self._applyView(); }
      });
    }
  }

  Object.defineProperty(LWTMermaid.prototype, 'palette', {
    configurable: true,
    get: function () { return this._palette || null; },
    set: function (value) { this._palette = value || null; if (this._canvas) this._requestRender(); }
  });
  window.LWT.define('lwtd-mermaid', LWTMermaid);
})();
