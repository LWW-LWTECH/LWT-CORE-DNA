/*!
 * <lwtd-treemap>
 * A treemap: each item is a rectangle sized by its value, so the biggest
 * parts of a whole stand out at a glance (budget by department, disk use,
 * sales by region and product). Items can be grouped: a group is drawn as
 * a labelled box holding its children, and every group gets its own color.
 * Inline SVG, redrawn on every data / attribute change, like the other
 * lwtd- charts. Uses the "squarified" layout, so tiles stay close to square.
 *
 *   var tm = document.querySelector('lwtd-treemap');
 *   tm.data = {
 *     items: [
 *       { label: 'Engineering', children: [
 *           { label: 'Salaries', value: 820 },
 *           { label: 'Cloud', value: 240 },
 *           { label: 'Tools', value: 60 } ] },
 *       { label: 'Sales', children: [
 *           { label: 'Salaries', value: 410 },
 *           { label: 'Travel', value: 95 } ] },
 *       { label: 'Office', value: 150 }          // a plain item works too
 *     ]
 *   };
 *
 * Items: { label, value } or { label, children: [...] } (a group's value is
 * the sum of its children; groups can nest). Optional `color` on any item
 * overrides the palette for it (and its children). Items with a value of 0
 * or less are left out. Chart.js-style flat data also works:
 * { labels: [...], datasets: [{ data: [...] }] }.
 *
 * Attributes (all re-render on change):
 *   title            — chart title text
 *   legend-position  — "top" | "bottom" | "none". Default: "top" when there
 *                      are groups, "none" for a flat list (tiles are labelled)
 *   color-by         — "group" (default with groups: each top-level group a
 *                      color), "item" (each top-level tile its own color,
 *                      default for flat data), "value" (one color, darker =
 *                      bigger)
 *   hide-values      — boolean; no values on the tiles
 *   value-prefix, value-suffix — text around numbers, e.g. "$" and "k"
 *   palette          — custom colors (see below)
 *
 * Tiles show their label and value when they fit (small tiles stay blank
 * -- hover them). Hovering a tile shows its path (Group > Item), value,
 * share of the total and share of its group.
 *
 * Custom palette: `palette` attribute (comma-separated CSS colors), the
 * `.palette` property (array of colors or { stroke, fill }), the inherited
 * --lwt-chart-palette CSS variable, or page-wide LWT.chart.palette.
 *
 * Screen readers get a data table (group, item, value, share).
 *
 * Theming: --lwt-treemap-gap (px between tiles, default 2),
 * --lwt-treemap-text-color, --lwt-treemap-group-bg, plus --lwt-chart-bg,
 * --lwt-chart-title-color, --lwt-chart-legend-color,
 * --lwt-chart-aspect-ratio (default 8/5). Parts: wrap, tooltip.
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element || !window.LWT.chart) {
    throw new Error('lwt-dsh-treemap.js requires lwt-core.js to be loaded first.');
  }

  // Same built-in palette as the other lwtd- charts.
  var PALETTE = [
    { fill: '#b8f3e0', stroke: '#2ec4b6' }, // mint aqua
    { fill: '#ffd6e8', stroke: '#ff5c8a' }, // candy rose
    { fill: '#fef7c3', stroke: '#f2c94c' }, // soft gold
    { fill: '#e3d7ff', stroke: '#9b5de5' }, // lavender purple
    { fill: '#d9f2ff', stroke: '#4ea8de' }, // ice blue
    { fill: '#ffe8cc', stroke: '#ff7f11' }, // warm apricot
    { fill: '#c9f7d4', stroke: '#34c759' }, // fresh green
    { fill: '#ffe4f2', stroke: '#ff2e63' }  // neon pink
  ];

  var HEADER_H = 18;   // group label band
  var GROUP_PAD = 3;   // inside a group box

  function escapeXml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var nf = null;
  function fmtNumber(n) {
    if (!nf) {
      try { nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }); }
      catch (e) { nf = { format: function (x) { return String(Math.round(x * 100) / 100); } }; }
    }
    return nf.format(n);
  }

  function pct(part, whole) {
    if (!whole) return '0%';
    var p = part / whole * 100;
    return (p >= 10 || p === 0 ? Math.round(p) : Math.round(p * 10) / 10) + '%';
  }

  // ---- squarified layout (Bruls, Huizing, van Wijk) ----
  // nodes: [{ value }], sorted descending. Sets x, y, w, h on each.
  function squarify(nodes, x, y, w, h) {
    var total = nodes.reduce(function (a, n) { return a + n.value; }, 0);
    if (!total || w <= 0 || h <= 0) {
      nodes.forEach(function (n) { n.x = x; n.y = y; n.w = 0; n.h = 0; });
      return;
    }
    var scale = (w * h) / total;
    var items = nodes.map(function (n) { return { node: n, area: n.value * scale }; });
    var row = [];
    var rect = { x: x, y: y, w: w, h: h };

    function worst(r, side) {
      if (!r.length) return Infinity;
      var s = 0, mx = 0, mn = Infinity;
      r.forEach(function (it) { s += it.area; mx = Math.max(mx, it.area); mn = Math.min(mn, it.area); });
      var s2 = s * s, side2 = side * side;
      return Math.max(side2 * mx / s2, s2 / (side2 * mn));
    }

    function layoutRow(r) {
      var s = r.reduce(function (a, it) { return a + it.area; }, 0);
      if (rect.w >= rect.h) {
        // a column on the left
        var cw = rect.h ? s / rect.h : 0, cy = rect.y;
        r.forEach(function (it) {
          var ih = cw ? it.area / cw : 0;
          it.node.x = rect.x; it.node.y = cy; it.node.w = cw; it.node.h = ih;
          cy += ih;
        });
        rect.x += cw; rect.w -= cw;
      } else {
        // a row along the top
        var rh = rect.w ? s / rect.w : 0, cx = rect.x;
        r.forEach(function (it) {
          var iw = rh ? it.area / rh : 0;
          it.node.x = cx; it.node.y = rect.y; it.node.w = iw; it.node.h = rh;
          cx += iw;
        });
        rect.y += rh; rect.h -= rh;
      }
    }

    var i = 0;
    while (i < items.length) {
      var side = Math.min(rect.w, rect.h);
      var it = items[i];
      if (!row.length || worst(row.concat([it]), side) <= worst(row, side)) {
        row.push(it);
        i++;
      } else {
        layoutRow(row);
        row = [];
      }
    }
    if (row.length) layoutRow(row);
  }

  var CSS = `
    :host {
      display: block;
      position: relative;
      width: 100%;
      aspect-ratio: var(--lwt-chart-aspect-ratio, 8 / 5);
      font-family: inherit;
      background: var(--lwt-chart-bg, transparent);
      --tm-surface: var(--lwt-chart-bg, var(--lwt-color-surface, #fff));
      --tm-text: var(--lwt-treemap-text-color, var(--lwt-color-text-strong, #1f2937));
    }
    .chart-wrap, svg { display: block; width: 100%; height: 100%; }
    .chart-title { fill: var(--lwt-chart-title-color, var(--lwt-color-text-strong, #1f2937)); font-size: 15px; font-weight: 700; }
    .legend-text { fill: var(--lwt-chart-legend-color, var(--lwt-color-text, #374151)); font-size: 11px; }
    .group-box { fill: var(--lwt-treemap-group-bg, var(--tm-surface)); stroke-width: 1.5; }
    .group-label { fill: var(--tm-text); font-size: 11.5px; font-weight: 700; }
    .group-value { fill: var(--tm-text); font-size: 11px; opacity: 0.75; }
    .tile { stroke-width: 1; transition: opacity 120ms ease; }
    .tile-label { fill: var(--tm-text); font-size: 12px; font-weight: 600; pointer-events: none; }
    .tile-value { fill: var(--tm-text); font-size: 11px; opacity: 0.8; pointer-events: none; }
    svg.hovering .tile:not(.hover) { opacity: 0.55; }
    .tile.hover { stroke: var(--lwt-color-text-strong, #111827) !important; stroke-width: 2; }
    .empty { fill: var(--lwt-color-text-muted, #6b7280); font-size: 13px; }
    .tip {
      position: absolute;
      z-index: 2;
      pointer-events: none;
      padding: 0.4rem 0.55rem;
      border-radius: var(--lwt-border-radius, 6px);
      background: var(--lwt-color-text-strong, #111827);
      color: var(--lwt-color-surface, #fff);
      font-size: 12px;
      line-height: 1.45;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.18);
      transform: translate(-50%, calc(-100% - 8px));
    }
    .tip[hidden] { display: none; }
    .tip strong { display: block; }
    .tip .muted { opacity: 0.8; }
    @media (prefers-reduced-motion: reduce) { .tile { transition: none; } }
  `;

  class LWTTreemap extends window.LWT.Element {
    static get observedAttributes() {
      return ['title', 'legend-position', 'color-by', 'hide-values', 'value-prefix', 'value-suffix', 'palette'];
    }

    static get observedProps() { return ['data', 'palette']; }

    constructor() {
      super();
      this._data = null;
      this._leaves = [];
      var self = this;
      this._root.addEventListener('pointermove', function (e) { self._onHover(e); });
      this._root.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') self._onHover(e); });
      this.addEventListener('pointerleave', function () { self._hideTip(); });
    }

    get data() { return this._data; }
    set data(value) {
      this._data = value;
      if (this._root) this.render();
    }

    _fmt(n) {
      return (n < 0 ? '−' : '') + this._strAttr('value-prefix', '') + fmtNumber(Math.abs(n)) + this._strAttr('value-suffix', '');
    }

    // Data -> tree of { label, value, color, children, parent, depth }.
    _tree() {
      var d = this._data || {};
      var items;
      if (Array.isArray(d.items)) items = d.items;
      else if (Array.isArray(d.labels)) {
        var vals = (d.datasets && d.datasets[0] && d.datasets[0].data) || [];
        items = d.labels.map(function (l, i) { return { label: l, value: vals[i] }; });
      } else items = [];

      function build(list, parent, depth) {
        var out = [];
        (list || []).forEach(function (it) {
          if (!it) return;
          var node = { label: it.label == null ? '' : String(it.label), color: it.color || null, parent: parent, depth: depth };
          if (Array.isArray(it.children) && it.children.length) {
            node.children = build(it.children, node, depth + 1);
            node.value = node.children.reduce(function (a, c) { return a + c.value; }, 0);
          } else {
            var v = Number(it.value);
            node.value = isFinite(v) ? v : 0;
          }
          if (node.value > 0) out.push(node);
        });
        out.sort(function (a, b) { return b.value - a.value; });
        return out;
      }
      return build(items, null, 0);
    }

    render() {
      var a11y = window.LWT.a11y;
      var self = this;
      this._nodes = this._tree();
      this._total = this._nodes.reduce(function (a, n) { return a + n.value; }, 0);
      this._grouped = this._nodes.some(function (n) { return n.children; });
      this._chartName = this._a11yName([this._strAttr('title', '')], 'Treemap', 'Add a title attribute');

      var rows = [];
      (function walk(list) {
        list.forEach(function (n) {
          if (n.children) { walk(n.children); return; }
          rows.push([self._path(n.parent) || n.label, n.parent ? n.label : '', self._fmt(n.value), pct(n.value, self._total)]);
        });
      })(this._nodes);
      var table = rows.length ? a11y.dataTableHtml(this._chartName, ['Group', 'Item', 'Value', 'Share of total'], rows) : '';
      this._hasTable = !!table;

      this._renderShadow('<div class="chart-wrap" part="wrap">' + this._buildSvg() + table + '</div>' +
        '<div class="tip" part="tooltip" hidden></div>', CSS + a11y.SR_ONLY_CSS);
      this._svg = this._root.querySelector('svg');
      this._tip = this._root.querySelector('.tip');
    }

    _path(node) {
      var parts = [];
      for (var n = node; n; n = n.parent) parts.unshift(n.label);
      return parts.join(' › ');
    }

    _measureText(text, fontSize, weight) {
      if (!LWTTreemap._ctx) LWTTreemap._ctx = document.createElement('canvas').getContext('2d');
      LWTTreemap._ctx.font = (weight || 400) + ' ' + fontSize + 'px sans-serif';
      return LWTTreemap._ctx.measureText(String(text)).width;
    }

    // Text that fits maxW (ellipsised), or '' if not even 3 chars fit.
    _fit(text, maxW, size, weight) {
      if (this._measureText(text, size, weight) <= maxW) return text;
      var t = text;
      while (t.length > 1 && this._measureText(t + '…', size, weight) > maxW) t = t.slice(0, -1);
      return t.length >= 3 ? t + '…' : '';
    }

    _buildSvg() {
      var self = this;
      var nodes = this._nodes;
      var title = this._strAttr('title', '');
      var colorBy = this._strAttr('color-by', this._grouped ? 'group' : 'item');
      // One color by value has nothing to key, so no legend then.
      var legendPos = colorBy === 'value' ? 'none' : this._strAttr('legend-position', this._grouped ? 'top' : 'none');
      var showValues = !this._boolAttr('hide-values');
      var pal = window.LWT.chart.resolve(this, PALETTE);
      var gap = parseFloat(getComputedStyle(this).getPropertyValue('--lwt-treemap-gap'));
      if (!(gap >= 0)) gap = 2;

      var VBW = 640, VBH = 400, PAD = 4;
      var titleH = title ? 32 : 0;
      var showLegend = (legendPos === 'top' || legendPos === 'bottom') && nodes.length > 0;
      var legendH = showLegend ? 22 : 0;
      var plot = {
        x: PAD,
        y: PAD + titleH + (legendPos === 'top' ? legendH : 0),
        w: VBW - PAD * 2,
        h: VBH - PAD * 2 - titleH - legendH
      };

      // colors: top-level index -> palette entry (or a custom color)
      var maxLeaf = 0;
      (function walk(list) { list.forEach(function (n) { if (n.children) walk(n.children); else maxLeaf = Math.max(maxLeaf, n.value); }); })(nodes);
      var tint = window.LWT.chart.tint;
      function topOf(n) { while (n.parent) n = n.parent; return n; }
      function colorFor(n) {
        for (var p = n; p; p = p.parent) {
          if (p.color) { var c = window.LWT.chart.normalize(p.color, self); if (c) return c; }
        }
        if (colorBy === 'value') {
          var base = pal[0];
          var t = 0.15 + 0.55 * (maxLeaf ? n.value / maxLeaf : 0); // keep dark text readable
          return { stroke: base.stroke, fill: tint(base.stroke, self, t) };
        }
        var top = topOf(n);
        return pal[nodes.indexOf(top) % pal.length];
      }

      var groupSvg = '', tileSvg = '', textSvg = '';
      this._leaves = [];

      function place(list, r) {
        squarify(list, r.x, r.y, r.w, r.h);
        list.forEach(function (n) {
          var x = n.x + gap / 2, y = n.y + gap / 2, w = Math.max(0, n.w - gap), h = Math.max(0, n.h - gap);
          if (n.children) {
            var c = colorFor(n);
            groupSvg += '<rect class="group-box" x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + w.toFixed(2) + '" height="' + h.toFixed(2) +
              '" rx="3" style="stroke:' + escapeXml(c.stroke) + '"></rect>';
            var hasHeader = h > HEADER_H + 14 && w > 30;
            if (hasHeader) {
              var lbl = self._fit(n.label, w - 10, 11.5, 700);
              if (lbl) {
                textSvg += '<text class="group-label" x="' + (x + 6).toFixed(2) + '" y="' + (y + 13).toFixed(2) + '">' + escapeXml(lbl) + '</text>';
                var vText = showValues ? self._fmt(n.value) : '';
                var used = self._measureText(lbl, 11.5, 700) + 6;
                if (vText && used + self._measureText(vText, 11) + 18 < w) {
                  textSvg += '<text class="group-value" x="' + (x + w - 6).toFixed(2) + '" y="' + (y + 13).toFixed(2) + '" text-anchor="end">' + escapeXml(vText) + '</text>';
                }
              }
            }
            var top = hasHeader ? HEADER_H : GROUP_PAD;
            place(n.children, { x: x + GROUP_PAD, y: y + top, w: w - GROUP_PAD * 2, h: h - top - GROUP_PAD });
            return;
          }
          if (w < 0.5 || h < 0.5) return;
          var col = colorFor(n);
          var idx = self._leaves.length;
          self._leaves.push(n);
          tileSvg += '<rect class="tile" data-i="' + idx + '" x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + w.toFixed(2) + '" height="' + h.toFixed(2) +
            '" rx="2" style="fill:' + escapeXml(col.fill) + ';stroke:' + escapeXml(col.stroke) + '"></rect>';
          // label + value when they fit
          if (w >= 34 && h >= 20) {
            var name = self._fit(n.label, w - 10, 12, 600);
            if (name) {
              var twoLines = showValues && h >= 36;
              var ty = twoLines ? y + 17 : y + Math.min(17, h / 2 + 4);
              textSvg += '<text class="tile-label" x="' + (x + 6).toFixed(2) + '" y="' + ty.toFixed(2) + '">' + escapeXml(name) + '</text>';
              if (twoLines) {
                var val = self._fit(self._fmt(n.value), w - 10, 11);
                if (val) textSvg += '<text class="tile-value" x="' + (x + 6).toFixed(2) + '" y="' + (ty + 15).toFixed(2) + '">' + escapeXml(val) + '</text>';
              }
            }
          }
        });
      }
      if (nodes.length) place(nodes, plot);

      // legend: top-level items (only meaningful when colored per group / item)
      var legendSvg = '';
      if (showLegend) {
        var entries = nodes.map(function (n) { return { label: n.label, c: colorFor(n) }; });
        var widths = entries.map(function (e) { return 18 + self._measureText(e.label, 11) + 16; });
        var totalW = widths.reduce(function (a, b) { return a + b; }, 0);
        var lx = Math.max(PAD, (VBW - totalW) / 2);
        var ly = legendPos === 'top' ? PAD + titleH + 14 : VBH - PAD - 6;
        entries.forEach(function (e, i) {
          if (lx + widths[i] > VBW) return; // no room: drop the rest (tiles are labelled)
          legendSvg += '<rect x="' + lx.toFixed(2) + '" y="' + (ly - 10) + '" width="12" height="12" rx="2" style="fill:' + escapeXml(e.c.fill) + ';stroke:' + escapeXml(e.c.stroke) + '"></rect>';
          legendSvg += '<text class="legend-text" x="' + (lx + 17).toFixed(2) + '" y="' + ly + '">' + escapeXml(e.label) + '</text>';
          lx += widths[i];
        });
      }

      var titleSvg = title ? '<text class="chart-title" x="' + (VBW / 2) + '" y="' + (PAD + 21) + '" text-anchor="middle">' + escapeXml(title) + '</text>' : '';
      var emptySvg = nodes.length ? '' : '<text class="empty" x="' + (VBW / 2) + '" y="' + (VBH / 2) + '" text-anchor="middle">No data</text>';

      return '<svg viewBox="0 0 ' + VBW + ' ' + VBH + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' +
        escapeXml(this._chartName + (this._hasTable ? ', data table follows' : ', no data')) + '">' +
        titleSvg + legendSvg + groupSvg + tileSvg + textSvg + emptySvg + '</svg>';
    }

    // ---- hover ----
    _onHover(e) {
      var t = e.target && e.target.closest ? e.target.closest('.tile') : null;
      if (!t || !this._svg) { this._hideTip(); return; }
      var i = +t.getAttribute('data-i');
      if (this._hoverI === i && !this._tip.hidden) return;
      this._hoverI = i;
      var n = this._leaves[i];
      if (!n) return;
      var esc = window.LWT.a11y.escape;
      this._svg.classList.add('hovering');
      Array.prototype.forEach.call(this._svg.querySelectorAll('.tile.hover'), function (el) { el.classList.remove('hover'); });
      t.classList.add('hover');
      var html = '<strong>' + esc(this._path(n)) + '</strong>' + esc(this._fmt(n.value)) +
        ' <span class="muted">(' + pct(n.value, this._total) + ' of total)</span>';
      if (n.parent) html += '<br><span class="muted">' + pct(n.value, n.parent.value) + ' of ' + esc(n.parent.label) + '</span>';
      this._tip.innerHTML = html;
      this._tip.hidden = false;

      var host = this.getBoundingClientRect();
      var r = t.getBoundingClientRect();
      var x = r.left + r.width / 2 - host.left;
      var half = this._tip.offsetWidth / 2;
      x = Math.max(half + 4, Math.min(host.width - half - 4, x));
      var top = r.top - host.top;
      if (top - this._tip.offsetHeight - 10 < 0) {
        // no room above the tile: show it inside the tile's top edge instead
        this._tip.style.transform = 'translate(-50%, 6px)';
      } else {
        this._tip.style.transform = '';
      }
      this._tip.style.left = x + 'px';
      this._tip.style.top = top + 'px';
    }

    _hideTip() {
      this._hoverI = null;
      if (this._tip) this._tip.hidden = true;
      if (this._svg) {
        this._svg.classList.remove('hovering');
        Array.prototype.forEach.call(this._svg.querySelectorAll('.tile.hover'), function (el) { el.classList.remove('hover'); });
      }
    }
  }

  window.LWT.chart.withPalette(LWTTreemap);
  window.LWT.define('lwtd-treemap', LWTTreemap);
})();
