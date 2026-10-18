/*!
 * <lwtd-bullet>
 * A bullet chart: for each metric, a bar for the actual value, a short line
 * for the target, and shaded bands behind them for the qualitative ranges
 * (e.g. poor / fair / good). A compact replacement for gauges when you want
 * several metrics side by side. Inline SVG, redrawn on every data /
 * attribute change, like the other lwtd- charts.
 *
 *   var chart = document.querySelector('lwtd-bullet');
 *   chart.data = {
 *     ranges: [40, 68, 100],                // shared bands (upper bounds)
 *     bandLabels: ['Poor', 'Fair', 'Good'], // optional: legend + tooltip
 *     items: [
 *       { label: 'Metric A', value: 65, target: 70 },
 *       { label: 'Metric B', value: 15, target: 25, ranges: [10, 23, 100] },  // own bands
 *       { label: 'Metric C', value: 32, target: 51, ranges: [30, 50, 100] }
 *     ]
 *   };
 *
 * Items: { label, value, target, ranges, color }. `ranges` are the upper
 * bounds of each band, lowest first (any number of bands); an item without
 * its own uses the shared `data.ranges`. `target` is optional. `color`
 * overrides that item's value bar. Chart.js-style data also works:
 * { labels, datasets: [{ data: values }], targets: [...], ranges: [...] }.
 *
 * Attributes (all re-render on change):
 *   title            — chart title text
 *   orientation      — "vertical" (default: one column per metric) |
 *                      "horizontal" (one row per metric, label on the left;
 *                      the chart grows in height with the number of rows)
 *   band-style       — "grey" (default: shades of grey, darkest = lowest)
 *                      | "color" (red / amber / green from the --lwt-danger,
 *                      --lwt-warning, --lwt-success colors)
 *   min, max         — scale (default 0 and the largest range / value / target)
 *   scale            — "shared" (default: one scale for every metric) |
 *                      "each" (horizontal only: every row gets its own scale
 *                      and tick labels, for metrics in different units)
 *   value-prefix, value-suffix — text around numbers, e.g. value-suffix="%"
 *   show-values      — boolean; print each value at the end of its bar
 *   grid             — "none" (default) | "lines" (light lines at each tick)
 *   legend-position  — "top" | "bottom" | "none". Default "top" when
 *                      bandLabels are given, otherwise "none"
 *   palette          — custom band colors, lowest band first (see below)
 *
 * Hovering a metric shows its value, target (and the difference) and which
 * band the value is in. Screen readers get a data table with the same.
 *
 * Custom palette: `palette` attribute (comma-separated CSS colors), the
 * `.palette` property, the inherited --lwt-chart-palette CSS variable, or
 * page-wide LWT.chart.palette -- the band colors, lowest band first
 * (e.g. palette="#fecaca, #fde68a, #bbf7d0"). Used as given (solid).
 *
 * Theming: --lwt-bullet-bar-color, --lwt-bullet-target-color (default
 * --lwt-primary), --lwt-bullet-band-dark / --lwt-bullet-band-light (grey
 * style end shades), plus --lwt-chart-bg, --lwt-chart-grid,
 * --lwt-chart-tick-color, --lwt-chart-label-color, --lwt-chart-title-color,
 * --lwt-chart-legend-color, --lwt-chart-aspect-ratio. Parts: wrap, tooltip.
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element || !window.LWT.chart) {
    throw new Error('lwt-dsh-bullet.js requires lwt-core.js to be loaded first.');
  }

  var MINUS = '−';

  function niceNumber(range, round) {
    if (range <= 0) return 1;
    var exponent = Math.floor(Math.log(range) / Math.LN10);
    var fraction = range / Math.pow(10, exponent);
    var nice;
    if (round) nice = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
    else nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    return nice * Math.pow(10, exponent);
  }

  // Ticks from min to max. An end given by the developer is kept exactly.
  function computeScale(min, max, tickTarget, fixedMin, fixedMax) {
    if (fixedMin != null) min = fixedMin;
    if (fixedMax != null) max = fixedMax;
    if (max <= min) max = min + 1;
    var step = niceNumber(niceNumber(max - min, false) / (tickTarget - 1), true);
    var lo = fixedMin != null ? fixedMin : Math.floor(min / step) * step;
    var hi = fixedMax != null ? fixedMax : Math.ceil(max / step) * step;
    var ticks = [];
    for (var v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step / 1000; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return { min: lo, max: hi, ticks: ticks };
  }

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

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function numAttr(el, name) {
    if (!el.hasAttribute(name)) return null;
    return num(el.getAttribute(name));
  }

  var CSS = `
    :host {
      display: block;
      position: relative;
      width: 100%;
      aspect-ratio: var(--lwt-chart-aspect-ratio, 8 / 5);
      font-family: inherit;
      background: var(--lwt-chart-bg, transparent);
      --bl-surface: var(--lwt-chart-bg, var(--lwt-color-surface, #fff));
      --bl-dark: var(--lwt-bullet-band-dark, #a6a6a6);
      --bl-light: var(--lwt-bullet-band-light, #e5e5e5);
    }
    :host([orientation="horizontal"]) { aspect-ratio: auto; }
    .chart-wrap, svg { display: block; width: 100%; height: 100%; }
    :host([orientation="horizontal"]) svg { height: auto; }
    .grid-line { stroke: var(--lwt-chart-grid, var(--lwt-border-color, #e5e7eb)); stroke-width: 1; }
    .axis-line { stroke: var(--lwt-chart-border, var(--lwt-border-color, #d1d5db)); stroke-width: 1; }
    .axis-text { fill: var(--lwt-chart-tick-color, var(--lwt-color-text-muted, #6b7280)); font-size: 11px; }
    .cat-text { fill: var(--lwt-chart-label-color, var(--lwt-color-text, #374151)); font-size: 12px; font-weight: 600; }
    .chart-title { fill: var(--lwt-chart-title-color, var(--lwt-color-text-strong, #1f2937)); font-size: 15px; font-weight: 700; }
    .legend-text { fill: var(--lwt-chart-legend-color, var(--lwt-color-text, #374151)); font-size: 11px; }
    .value-text { fill: var(--lwt-chart-label-color, var(--lwt-color-text-strong, #1f2937)); font-size: 11px; font-weight: 600; }
    .bar { fill: var(--lwt-bullet-bar-color, var(--lwt-color-text-strong, #1f2937)); }
    .style-color .bar { fill: var(--lwt-bullet-bar-color, #4b5563); stroke: var(--bl-surface); stroke-width: 1.5; }
    .target { stroke: var(--lwt-bullet-target-color, var(--lwt-primary, #2563eb)); stroke-width: 3.5; stroke-linecap: butt; }
    .band.b-poor { fill: var(--lwt-danger, #ef4444); }
    .band.b-fair { fill: var(--lwt-warning, #f59e0b); }
    .band.b-good { fill: var(--lwt-success, #22c55e); }
    .metric { transition: opacity 120ms ease; }
    svg.hovering .metric:not(.hover) { opacity: 0.5; }
    .hit { fill: transparent; }
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
    @media (prefers-reduced-motion: reduce) { .metric { transition: none; } }
  `;

  class LWTBullet extends window.LWT.Element {
    static get observedAttributes() {
      return ['title', 'orientation', 'band-style', 'min', 'max', 'value-prefix', 'value-suffix',
              'show-values', 'grid', 'legend-position', 'scale', 'palette'];
    }

    static get observedProps() { return ['data', 'palette']; }

    constructor() {
      super();
      this._data = null;
      this._items = [];
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

    _fmt(n, signed) {
      var sign = n < 0 ? MINUS : (signed && n > 0 ? '+' : '');
      return sign + this._strAttr('value-prefix', '') + fmtNumber(Math.abs(n)) + this._strAttr('value-suffix', '');
    }

    _parse() {
      var d = this._data || {};
      var shared = Array.isArray(d.ranges) ? d.ranges : [];
      var raw;
      if (Array.isArray(d.items)) raw = d.items;
      else if (Array.isArray(d.labels)) {
        var vals = (d.datasets && d.datasets[0] && d.datasets[0].data) || [];
        var tg = Array.isArray(d.targets) ? d.targets : [];
        raw = d.labels.map(function (l, i) { return { label: l, value: vals[i], target: tg[i] }; });
      } else raw = [];
      this._bandLabels = Array.isArray(d.bandLabels) ? d.bandLabels.map(String) : [];
      return raw.filter(Boolean).map(function (it) {
        var ranges = (Array.isArray(it.ranges) ? it.ranges : shared).map(num).filter(function (v) { return v !== null; });
        ranges.sort(function (a, b) { return a - b; });
        return {
          label: it.label == null ? '' : String(it.label),
          value: num(it.value),
          target: num(it.target),
          ranges: ranges,
          color: it.color || null
        };
      });
    }

    // Index of the band a value falls in (or -1).
    _bandOf(item, v) {
      if (v === null) return -1;
      for (var i = 0; i < item.ranges.length; i++) if (v <= item.ranges[i]) return i;
      return -1;
    }

    _bandName(i, count) {
      if (i < 0) return '';
      if (this._bandLabels[i]) return this._bandLabels[i];
      return 'Band ' + (i + 1) + ' of ' + count;
    }

    render() {
      var a11y = window.LWT.a11y;
      var self = this;
      this._items = this._parse();
      this._chartName = this._a11yName([this._strAttr('title', '')], 'Bullet chart', 'Add a title attribute');
      var rows = this._items.map(function (it) {
        var b = self._bandOf(it, it.value);
        return [
          it.label,
          it.value === null ? '' : self._fmt(it.value),
          it.target === null ? '' : self._fmt(it.target),
          it.value !== null && it.target !== null ? self._fmt(it.value - it.target, true) : '',
          self._bandName(b, it.ranges.length),
          it.ranges.map(function (r) { return self._fmt(r); }).join(' / ')
        ];
      });
      var table = rows.length ? a11y.dataTableHtml(this._chartName, ['Metric', 'Value', 'Target', 'Versus target', 'Band', 'Band limits'], rows) : '';
      this._hasTable = !!table;
      this._renderShadow('<div class="chart-wrap" part="wrap">' + this._buildSvg() + table + '</div>' +
        '<div class="tip" part="tooltip" hidden></div>', CSS + a11y.SR_ONLY_CSS);
      this._svg = this._root.querySelector('svg');
      this._tip = this._root.querySelector('.tip');
    }

    _measureText(text, fontSize, weight) {
      if (!LWTBullet._ctx) LWTBullet._ctx = document.createElement('canvas').getContext('2d');
      LWTBullet._ctx.font = (weight || 400) + ' ' + fontSize + 'px sans-serif';
      return LWTBullet._ctx.measureText(String(text)).width;
    }

    // Band fill for band i of n: palette > color style > grey ramp.
    _bandFill(i, n, pal, colorStyle) {
      if (pal.custom) return 'style="fill:' + escapeXml(pal[i % pal.length].stroke) + '"';
      if (colorStyle) {
        if (n <= 3) {
          var names = n === 1 ? ['good'] : n === 2 ? ['poor', 'good'] : ['poor', 'fair', 'good'];
          return 'class="band b-' + names[i] + '"';
        }
        var k = i === 0 ? 'poor' : i === n - 1 ? 'good' : 'fair';
        return 'class="band b-' + k + '"';
      }
      // grey ramp: lowest band darkest
      var t = n > 1 ? Math.round(i / (n - 1) * 100) : 100;
      return 'style="fill:color-mix(in srgb, var(--bl-light) ' + t + '%, var(--bl-dark))"';
    }

    _buildSvg() {
      var self = this;
      var items = this._items;
      var horizontal = this._strAttr('orientation', 'vertical') === 'horizontal';
      var colorStyle = this._strAttr('band-style', 'grey') === 'color';
      var title = this._strAttr('title', '');
      var showValues = this._boolAttr('show-values');
      var grid = this._strAttr('grid', 'none');
      var maxBands = items.reduce(function (m, it) { return Math.max(m, it.ranges.length); }, 0);
      var legendPos = this._strAttr('legend-position', this._bandLabels.length ? 'top' : 'none');
      var pal = window.LWT.chart.resolve(this, null);

      var lo = 0, hi = 0;
      items.forEach(function (it) {
        [it.value, it.target].concat(it.ranges).forEach(function (v) { if (v !== null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
      });
      var fMin = numAttr(this, 'min'), fMax = numAttr(this, 'max');
      var scale = computeScale(lo, hi, 6, fMin, fMax);
      var each = horizontal && this._strAttr('scale', 'shared') === 'each';
      if (each) {
        items.forEach(function (it) {
          var a = 0, b = 0;
          [it.value, it.target].concat(it.ranges).forEach(function (v) { if (v !== null) { a = Math.min(a, v); b = Math.max(b, v); } });
          it.scale = computeScale(a, b, 5, fMin, null);
        });
      }

      var VBW = 640, PAD = 14;
      var n = items.length;
      var titleH = title ? 30 : 0;
      var showLegend = (legendPos === 'top' || legendPos === 'bottom') && n > 0;
      var legendH = showLegend ? 22 : 0;
      var maxTickW = 0;
      scale.ticks.forEach(function (t) { maxTickW = Math.max(maxTickW, self._measureText(self._fmt(t), 11)); });

      var VBH, plot;
      if (horizontal) {
        var labelW = items.reduce(function (m, it) { return Math.max(m, self._measureText(it.label, 12, 600)); }, 0);
        labelW = Math.min(labelW, 200);
        var rowH = each ? 56 : 40;
        var top = PAD + titleH + (legendPos === 'top' ? legendH : 0) + 4;
        VBH = top + Math.max(1, n) * rowH + (each ? 4 : 24) + (legendPos === 'bottom' ? legendH : 0) + PAD;
        if (each) items.forEach(function (it) { it.scale.ticks.forEach(function (t) { maxTickW = Math.max(maxTickW, self._measureText(self._fmt(t), 10)); }); });
        plot = { left: PAD + labelW + 12, right: VBW - PAD - Math.max(8, maxTickW / 2), top: top, bottom: top + Math.max(1, n) * rowH, rowH: rowH };
      } else {
        VBH = 400;
        var topV = PAD + titleH + (legendPos === 'top' ? legendH : 0) + (showValues ? 14 : 6);
        plot = { left: PAD + maxTickW + 10, right: VBW - PAD, top: topV, bottom: VBH - PAD - 22 - (legendPos === 'bottom' ? legendH : 0) };
      }
      var span = scale.max - scale.min;

      var svg = '';
      // ticks / grid
      if (!each) scale.ticks.forEach(function (t) {
        if (horizontal) {
          var x = plot.left + (t - scale.min) / span * (plot.right - plot.left);
          if (grid === 'lines') svg += '<line class="grid-line" x1="' + x.toFixed(2) + '" y1="' + plot.top + '" x2="' + x.toFixed(2) + '" y2="' + plot.bottom + '"></line>';
          svg += '<text class="axis-text" x="' + x.toFixed(2) + '" y="' + (plot.bottom + 16) + '" text-anchor="middle">' + escapeXml(self._fmt(t)) + '</text>';
        } else {
          var y = plot.bottom - (t - scale.min) / span * (plot.bottom - plot.top);
          if (grid === 'lines') svg += '<line class="grid-line" x1="' + plot.left + '" y1="' + y.toFixed(2) + '" x2="' + plot.right + '" y2="' + y.toFixed(2) + '"></line>';
          svg += '<text class="axis-text" x="' + (plot.left - 8) + '" y="' + (y + 4).toFixed(2) + '" text-anchor="end">' + escapeXml(self._fmt(t)) + '</text>';
        }
      });

      var clamp = function (v) { return Math.max(scale.min, Math.min(scale.max, v)); };
      var metricsSvg = '', hitSvg = '';
      items.forEach(function (it, i) {
        var g = '';
        var nb = it.ranges.length;
        if (horizontal) {
          var sc = each ? it.scale : scale;
          var cy = plot.top + plot.rowH * (i + 0.5) - (each ? 8 : 0);
          var bandH = (each ? 40 : plot.rowH) * 0.72, barH = bandH * 0.36, tgH = bandH * 0.8;
          var X = function (v) { v = Math.max(sc.min, Math.min(sc.max, v)); return plot.left + (v - sc.min) / (sc.max - sc.min) * (plot.right - plot.left); };
          if (each) {
            sc.ticks.forEach(function (t) {
              var tx = X(t);
              g += '<line class="axis-line" x1="' + tx.toFixed(2) + '" y1="' + (cy + bandH / 2).toFixed(2) + '" x2="' + tx.toFixed(2) + '" y2="' + (cy + bandH / 2 + 3).toFixed(2) + '"></line>';
              svg += '<text class="axis-text" style="font-size:10px" x="' + tx.toFixed(2) + '" y="' + (cy + bandH / 2 + 14).toFixed(2) + '" text-anchor="middle">' + escapeXml(self._fmt(t)) + '</text>';
            });
          }
          var prev = sc.min;
          it.ranges.forEach(function (r, bi) {
            var x1 = X(prev), x2 = X(r);
            if (x2 > x1) g += '<rect ' + self._bandFill(bi, nb, pal, colorStyle) + ' x="' + x1.toFixed(2) + '" y="' + (cy - bandH / 2).toFixed(2) + '" width="' + (x2 - x1).toFixed(2) + '" height="' + bandH.toFixed(2) + '"></rect>';
            prev = r;
          });
          if (it.value !== null) {
            var x0 = X(Math.max(sc.min, Math.min(0, sc.max))), xv = X(it.value);
            g += '<rect class="bar" x="' + Math.min(x0, xv).toFixed(2) + '" y="' + (cy - barH / 2).toFixed(2) + '" width="' + Math.max(1, Math.abs(xv - x0)).toFixed(2) + '" height="' + barH.toFixed(2) + '"' +
              (it.color ? ' style="fill:' + escapeXml(it.color) + '"' : '') + '></rect>';
            if (showValues) g += '<text class="value-text" x="' + (xv + 6).toFixed(2) + '" y="' + (cy + 4).toFixed(2) + '">' + escapeXml(self._fmt(it.value)) + '</text>';
          }
          if (it.target !== null) {
            var xt = X(it.target);
            g += '<line class="target" x1="' + xt.toFixed(2) + '" y1="' + (cy - tgH / 2).toFixed(2) + '" x2="' + xt.toFixed(2) + '" y2="' + (cy + tgH / 2).toFixed(2) + '"></line>';
          }
          var lbl = it.label;
          var maxW = plot.left - PAD - 12;
          if (self._measureText(lbl, 12, 600) > maxW) {
            while (lbl.length > 1 && self._measureText(lbl + '…', 12, 600) > maxW) lbl = lbl.slice(0, -1);
            lbl += '…';
          }
          svg += '<text class="cat-text" x="' + (plot.left - 12) + '" y="' + (cy + 4).toFixed(2) + '" text-anchor="end">' + escapeXml(lbl) + '</text>';
          hitSvg += '<rect class="hit" data-i="' + i + '" x="' + PAD + '" y="' + (cy - plot.rowH / 2).toFixed(2) + '" width="' + (VBW - PAD * 2) + '" height="' + plot.rowH + '"></rect>';
        } else {
          var colW = (plot.right - plot.left) / Math.max(1, n);
          var cx = plot.left + colW * (i + 0.5);
          var bandW = Math.min(colW * 0.62, 90), barW = bandW * 0.45, tgW = bandW * 0.5;
          var Y = function (v) { return plot.bottom - (clamp(v) - scale.min) / span * (plot.bottom - plot.top); };
          var prevV = scale.min;
          it.ranges.forEach(function (r, bi) {
            var y1 = Y(r), y2 = Y(prevV);
            if (y2 > y1) g += '<rect ' + self._bandFill(bi, nb, pal, colorStyle) + ' x="' + (cx - bandW / 2).toFixed(2) + '" y="' + y1.toFixed(2) + '" width="' + bandW.toFixed(2) + '" height="' + (y2 - y1).toFixed(2) + '"></rect>';
            prevV = r;
          });
          if (it.value !== null) {
            var y0 = Y(Math.max(scale.min, Math.min(0, scale.max))), yv = Y(it.value);
            g += '<rect class="bar" x="' + (cx - barW / 2).toFixed(2) + '" y="' + Math.min(y0, yv).toFixed(2) + '" width="' + barW.toFixed(2) + '" height="' + Math.max(1, Math.abs(y0 - yv)).toFixed(2) + '"' +
              (it.color ? ' style="fill:' + escapeXml(it.color) + '"' : '') + '></rect>';
            if (showValues) g += '<text class="value-text" x="' + cx.toFixed(2) + '" y="' + (yv - 6).toFixed(2) + '" text-anchor="middle">' + escapeXml(self._fmt(it.value)) + '</text>';
          }
          if (it.target !== null) {
            var yt = Y(it.target);
            g += '<line class="target" x1="' + (cx - tgW / 2).toFixed(2) + '" y1="' + yt.toFixed(2) + '" x2="' + (cx + tgW / 2).toFixed(2) + '" y2="' + yt.toFixed(2) + '"></line>';
          }
          var lblV = it.label, maxWV = colW - 6;
          if (self._measureText(lblV, 12, 600) > maxWV) {
            while (lblV.length > 1 && self._measureText(lblV + '…', 12, 600) > maxWV) lblV = lblV.slice(0, -1);
            lblV += '…';
          }
          svg += '<text class="cat-text" x="' + cx.toFixed(2) + '" y="' + (plot.bottom + 17) + '" text-anchor="middle">' + escapeXml(lblV) + '</text>';
          hitSvg += '<rect class="hit" data-i="' + i + '" x="' + (plot.left + colW * i).toFixed(2) + '" y="' + plot.top + '" width="' + colW.toFixed(2) + '" height="' + (plot.bottom - plot.top) + '"></rect>';
        }
        metricsSvg += '<g class="metric" data-i="' + i + '">' + g + '</g>';
      });

      // axis baseline along the category side
      var axisSvg = each ? '' : '<line class="axis-line" x1="' + plot.left + '" y1="' + plot.bottom + '" x2="' + plot.right + '" y2="' + plot.bottom + '"></line>';

      // legend: value, target, then named bands
      var legendSvg = '';
      if (showLegend) {
        var entries = [
          { label: 'Value', svg: function (x, y) { return '<rect class="bar" x="' + x + '" y="' + (y - 9) + '" width="12" height="10"></rect>'; } },
          { label: 'Target', svg: function (x, y) { return '<line class="target" x1="' + (x + 6) + '" y1="' + (y - 11) + '" x2="' + (x + 6) + '" y2="' + (y + 2) + '"></line>'; } }
        ];
        this._bandLabels.slice(0, maxBands).forEach(function (bl, bi) {
          entries.push({ label: bl, svg: function (x, y) { return '<rect ' + self._bandFill(bi, maxBands, pal, colorStyle) + ' x="' + x + '" y="' + (y - 10) + '" width="12" height="12" rx="2"></rect>'; } });
        });
        var widths = entries.map(function (e) { return 18 + self._measureText(e.label, 11) + 16; });
        var lx = (VBW - widths.reduce(function (a, b) { return a + b; }, 0)) / 2;
        var ly = legendPos === 'top' ? PAD + titleH + 14 : VBH - PAD - 2;
        entries.forEach(function (e, ei) {
          legendSvg += e.svg(lx.toFixed(2), ly) + '<text class="legend-text" x="' + (lx + 17).toFixed(2) + '" y="' + ly + '">' + escapeXml(e.label) + '</text>';
          lx += widths[ei];
        });
      }

      var titleSvg = title ? '<text class="chart-title" x="' + (VBW / 2) + '" y="' + (PAD + 20) + '" text-anchor="middle">' + escapeXml(title) + '</text>' : '';
      this._geom = { horizontal: horizontal };
      return '<svg class="' + (colorStyle ? 'style-color' : 'style-grey') + '" viewBox="0 0 ' + VBW + ' ' + VBH + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' +
        escapeXml(this._chartName + (this._hasTable ? ', data table follows' : ', no data')) + '">' +
        titleSvg + legendSvg + metricsSvg + axisSvg + svg + hitSvg + '</svg>';
    }

    // ---- hover ----
    _onHover(e) {
      var hit = e.target && e.target.closest ? e.target.closest('.hit') : null;
      if (!hit || !this._svg) { this._hideTip(); return; }
      var i = +hit.getAttribute('data-i');
      if (this._hoverI === i && !this._tip.hidden) return;
      this._hoverI = i;
      var it = this._items[i];
      if (!it) return;
      var esc = window.LWT.a11y.escape;
      var svg = this._svg;
      svg.classList.add('hovering');
      Array.prototype.forEach.call(svg.querySelectorAll('.metric'), function (m) { m.classList.toggle('hover', +m.getAttribute('data-i') === i); });

      var html = '<strong>' + esc(it.label) + '</strong>';
      if (it.value !== null) html += 'Value: ' + esc(this._fmt(it.value));
      if (it.target !== null) {
        html += '<br>Target: ' + esc(this._fmt(it.target));
        if (it.value !== null) html += ' <span class="muted">(' + esc(this._fmt(it.value - it.target, true)) + ')</span>';
      }
      var b = this._bandOf(it, it.value);
      if (b >= 0) html += '<br><span class="muted">' + esc(this._bandName(b, it.ranges.length)) + '</span>';
      this._tip.innerHTML = html;
      this._tip.hidden = false;

      var host = this.getBoundingClientRect();
      var g = svg.querySelector('.metric[data-i="' + i + '"]');
      var r = (g || hit).getBoundingClientRect();
      var x = r.left + r.width / 2 - host.left;
      var half = this._tip.offsetWidth / 2;
      x = Math.max(half + 4, Math.min(host.width - half - 4, x));
      var top = r.top - host.top;
      if (top - this._tip.offsetHeight - 10 < 0) {
        this._tip.style.transform = 'translate(-50%, 8px)';
        top = this._geom.horizontal ? r.bottom - host.top : top;
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
        Array.prototype.forEach.call(this._svg.querySelectorAll('.metric.hover'), function (m) { m.classList.remove('hover'); });
      }
    }
  }

  window.LWT.chart.withPalette(LWTBullet);
  window.LWT.define('lwtd-bullet', LWTBullet);
})();
