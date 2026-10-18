/*!
 * <lwtd-scatter>
 * A scatter plot: one dot per data point on two numeric axes, grouped into
 * series. Same conventions as the other lwtd- charts (data from JS, inline
 * SVG, full redraw on every change). Data follows Chart.js's scatter shape;
 * a point can also carry its own `label` (shown in the hover tooltip):
 *
 *   var chart = document.querySelector('lwtd-scatter');
 *   chart.data = {
 *     datasets: [
 *       { label: 'Team A', data: [{ x: 3, y: 62, label: 'Alice' }, { x: 5, y: 71 }, { x: 8, y: 80 }] },
 *       { label: 'Team B', data: [{ x: 2, y: 55 }, { x: 6, y: 68 }] }
 *     ]
 *   };
 *
 * Median lines (attribute `median`):
 *   median            — (no value) or "y": a horizontal line at the median y
 *   median="x"        — a vertical line at the median x
 *   median="both"     — both lines (splits the plot into quadrants)
 *   median-scope      — "all" (default: one median over every point) |
 *                       "series" (one dashed line per series, in its color)
 *
 * Trend line (attribute `trend`) — a least-squares straight line of best fit:
 *   trend             — draws the trend line, labelled with its R² (how
 *                       closely the dots follow it, 0–1)
 *   trend-scope       — "all" (default: one line through every point) |
 *                       "series" (one line per series, in its color)
 *   The fitted numbers are available from JS: chart.trendStats ->
 *   [{ series, slope, intercept, r2, n }] (series is null for "all").
 *
 * Hovering (or touching) near a dot shows a tooltip with the point's label
 * and series, plus the x and y values under their axis titles
 * (x-label / y-label, or "X" / "Y" when not set).
 *
 * Attributes (all re-render on change):
 *   title             — chart title text
 *   legend-position   — "top" (default) | "bottom" | "left" | "right" | "none"
 *   grid              — "both" (default) | "horizontal" | "vertical" | "none"
 *   x-label, y-label  — axis titles (also used in the tooltip)
 *   x-prefix, x-suffix, y-prefix, y-suffix — text around the numbers,
 *                       e.g. y-prefix="$" or x-suffix=" yrs"
 *   x-min, x-max, y-min, y-max — fix an axis end (otherwise it auto-fits
 *                       "nice" numbers around the data, not forced to 0)
 *   point-size        — dot radius in px (default 5)
 *   shapes            — boolean; each series gets its own marker shape
 *                       (circle, square, triangle, diamond…) as well as
 *                       its color, so series stay distinct without color
 *
 * Colors: `palette` attribute (comma-separated CSS colors), the `.palette`
 * property, the inherited --lwt-chart-palette CSS variable, or page-wide
 * LWT.chart.palette; one color per series, in order. Per dataset,
 * backgroundColor / borderColor (one color for the series) still win.
 *
 * Screen readers get a data table (series, point, x, y) and the median
 * values in the chart's name.
 *
 * Theming: --lwt-scatter-median-color (default --lwt-color-text-strong),
 * --lwt-scatter-trend-color (default --lwt-primary),
 * plus the shared --lwt-chart-bg, --lwt-chart-grid, --lwt-chart-border,
 * --lwt-chart-tick-color, --lwt-chart-label-color, --lwt-chart-title-color,
 * --lwt-chart-legend-color, --lwt-chart-aspect-ratio (default 8/5).
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-dsh-scatter.js requires lwt-core.js to be loaded first.');
  }

  // Same palette as the other lwtd- charts.
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
  var SHAPES = ['circle', 'square', 'triangle', 'diamond', 'triangle-down', 'cross', 'circle', 'square'];
  var MINUS = '−';
  var HIT_RADIUS = 18; // viewBox units around a dot that count as "on" it

  function niceNumber(range, round) {
    if (range <= 0) return 1;
    var exponent = Math.floor(Math.log(range) / Math.LN10);
    var fraction = range / Math.pow(10, exponent);
    var nice;
    if (round) nice = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
    else nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    return nice * Math.pow(10, exponent);
  }

  // "Nice" min/max around the data (not zero-based). fixedMin/fixedMax win.
  function computeRange(dataMin, dataMax, tickTarget, fixedMin, fixedMax) {
    if (fixedMin != null) dataMin = fixedMin;
    if (fixedMax != null) dataMax = fixedMax;
    if (dataMin === dataMax) { dataMin -= 1; dataMax += 1; }
    var pad = (dataMax - dataMin) * 0.08;
    var lo = fixedMin != null ? fixedMin : dataMin - pad;
    var hi = fixedMax != null ? fixedMax : dataMax + pad;
    var step = niceNumber(niceNumber(hi - lo, false) / (tickTarget - 1), true);
    var min = fixedMin != null ? fixedMin : Math.floor(lo / step) * step;
    var max = fixedMax != null ? fixedMax : Math.ceil(hi / step) * step;
    var ticks = [];
    var first = Math.ceil(min / step - 1e-9) * step;
    for (var v = first; v <= max + step / 1000; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return { min: min, max: max, ticks: ticks };
  }

  function median(values) {
    if (!values.length) return null;
    var s = values.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // Least-squares fit y = slope * x + intercept. Needs 2+ distinct x values.
  function linearFit(points) {
    var n = points.length;
    if (n < 2) return null;
    var sx = 0, sy = 0;
    points.forEach(function (p) { sx += p.x; sy += p.y; });
    var mx = sx / n, my = sy / n, sxx = 0, sxy = 0, syy = 0;
    points.forEach(function (p) {
      var dx = p.x - mx, dy = p.y - my;
      sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
    });
    if (sxx === 0) return null;
    var slope = sxy / sxx;
    var xs = points.map(function (p) { return p.x; });
    return {
      slope: slope,
      intercept: my - slope * mx,
      r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy),
      n: n,
      xMin: Math.min.apply(null, xs),
      xMax: Math.max.apply(null, xs)
    };
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

  function numAttr(el, name) {
    if (!el.hasAttribute(name)) return null;
    var v = parseFloat(el.getAttribute(name));
    return isNaN(v) ? null : v;
  }

  // SVG for one marker, centred on (x, y) with radius r.
  function markerSvg(shape, x, y, r, attrs) {
    var f = function (n) { return n.toFixed(2); };
    switch (shape) {
      case 'square':
        var s = r * 0.9;
        return '<rect x="' + f(x - s) + '" y="' + f(y - s) + '" width="' + f(s * 2) + '" height="' + f(s * 2) + '" rx="1"' + attrs + '></rect>';
      case 'triangle':
      case 'triangle-down':
        var t = r * 1.2, d = shape === 'triangle' ? 1 : -1;
        return '<polygon points="' + f(x) + ',' + f(y - t * d) + ' ' + f(x + t) + ',' + f(y + t * 0.8 * d) + ' ' + f(x - t) + ',' + f(y + t * 0.8 * d) + '"' + attrs + '></polygon>';
      case 'diamond':
        var q = r * 1.25;
        return '<polygon points="' + f(x) + ',' + f(y - q) + ' ' + f(x + q) + ',' + f(y) + ' ' + f(x) + ',' + f(y + q) + ' ' + f(x - q) + ',' + f(y) + '"' + attrs + '></polygon>';
      case 'cross':
        var c = r * 1.1, w = r * 0.45;
        return '<path d="M' + f(x - w) + ' ' + f(y - c) + 'H' + f(x + w) + 'V' + f(y - w) + 'H' + f(x + c) + 'V' + f(y + w) + 'H' + f(x + w) + 'V' + f(y + c) +
          'H' + f(x - w) + 'V' + f(y + w) + 'H' + f(x - c) + 'V' + f(y - w) + 'H' + f(x - w) + 'Z"' + attrs + '></path>';
      default:
        return '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r) + '"' + attrs + '></circle>';
    }
  }

  var CSS = `
    :host {
      display: block;
      position: relative;
      width: 100%;
      aspect-ratio: var(--lwt-chart-aspect-ratio, 8 / 5);
      font-family: inherit;
      background: var(--lwt-chart-bg, transparent);
      --sc-surface: var(--lwt-chart-bg, var(--lwt-color-surface, #fff));
    }
    .chart-wrap, svg { display: block; width: 100%; height: 100%; }
    svg { touch-action: pan-y; }
    .grid-line { stroke: var(--lwt-chart-grid, var(--lwt-border-color, #e5e7eb)); stroke-width: 1; }
    .plot-border { stroke: var(--lwt-chart-border, var(--lwt-border-color, #e5e7eb)); stroke-width: 1; fill: none; }
    .axis-text { fill: var(--lwt-chart-tick-color, var(--lwt-color-text-muted, #6b7280)); font-size: 11px; }
    .axis-title { fill: var(--lwt-chart-label-color, var(--lwt-color-text, #374151)); font-size: 12px; font-weight: 600; }
    .chart-title { fill: var(--lwt-chart-title-color, var(--lwt-color-text-strong, #1f2937)); font-size: 15px; font-weight: 700; }
    .legend-text { fill: var(--lwt-chart-legend-color, var(--lwt-color-text, #374151)); font-size: 11px; }
    .dot { stroke: var(--sc-surface); stroke-width: 1.5; transition: opacity 120ms ease; }
    .median { stroke: var(--lwt-scatter-median-color, var(--lwt-color-text-strong, #1f2937)); stroke-width: 1.5; stroke-dasharray: 6 4; }
    .median.series { stroke-width: 1.5; }
    .median-text {
      fill: var(--lwt-scatter-median-color, var(--lwt-color-text-strong, #1f2937));
      font-size: 10.5px;
      font-weight: 600;
      paint-order: stroke;
      stroke: var(--sc-surface);
      stroke-width: 3px;
      stroke-linejoin: round;
    }
    .trend { stroke: var(--lwt-scatter-trend-color, var(--lwt-primary, #3b82f6)); stroke-width: 2; stroke-linecap: round; fill: none; }
    .trend-text {
      fill: var(--lwt-scatter-trend-color, var(--lwt-primary, #3b82f6));
      font-size: 10.5px;
      font-weight: 600;
      paint-order: stroke;
      stroke: var(--sc-surface);
      stroke-width: 3px;
      stroke-linejoin: round;
    }
    .trend-text.series { fill: var(--lwt-chart-label-color, var(--lwt-color-text, #374151)); }
    svg.hovering .dot:not(.hover):not(.legend-dot) { opacity: 0.35; }
    .dot.hover { stroke: var(--lwt-color-text-strong, #111827); stroke-width: 2; }
    .guide { stroke: var(--lwt-chart-tick-color, var(--lwt-color-text-muted, #9ca3af)); stroke-width: 1; stroke-dasharray: 2 3; pointer-events: none; }
    .guide[hidden] { display: none; }
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
      transform: translate(-50%, calc(-100% - 10px));
    }
    .tip[hidden] { display: none; }
    .tip strong { display: block; }
    .tip .series { display: flex; align-items: center; gap: 0.35rem; opacity: 0.85; }
    .tip .swatch { width: 8px; height: 8px; border-radius: 50%; flex: none; }
    @media (prefers-reduced-motion: reduce) { .dot { transition: none; } }
  `;

  class LWTScatter extends window.LWT.Element {
    static get observedAttributes() {
      return ['title', 'legend-position', 'grid', 'x-label', 'y-label', 'x-prefix', 'x-suffix', 'y-prefix', 'y-suffix',
              'x-min', 'x-max', 'y-min', 'y-max', 'point-size', 'shapes', 'median', 'median-scope',
              'trend', 'trend-scope', 'palette'];
    }

    static get observedProps() { return ['data', 'palette']; }

    constructor() {
      super();
      this._data = null;
      this._pts = [];
      var self = this;
      // Listeners on the shadow root / host survive every re-render.
      this._root.addEventListener('pointermove', function (e) { self._onHover(e); });
      this._root.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') self._onHover(e); });
      this.addEventListener('pointerleave', function () { self._hideTip(); });
    }

    // Fitted trend line(s): [{ series, slope, intercept, r2, n }] (series is
    // the series label, or null for the all-points line). Empty when off.
    get trendStats() {
      var self = this;
      return (this._trends || []).map(function (t) {
        return { series: t.series === null ? null : self._seriesCache[t.series].label,
          slope: t.fit.slope, intercept: t.fit.intercept, r2: t.fit.r2, n: t.fit.n };
      });
    }

    get data() { return this._data; }
    set data(value) {
      this._data = value;
      if (this._root) this.render();
    }

    _fmt(axis, n) {
      return (n < 0 ? MINUS : '') + this._strAttr(axis + '-prefix', '') + fmtNumber(Math.abs(n)) + this._strAttr(axis + '-suffix', '');
    }

    _series() {
      var datasets = (this._data && Array.isArray(this._data.datasets)) ? this._data.datasets : [];
      var pal = window.LWT.chart.resolve(this, PALETTE);
      return datasets.map(function (ds, i) {
        var p = pal[i % pal.length];
        var color = (typeof ds.borderColor === 'string' && ds.borderColor) || (typeof ds.backgroundColor === 'string' && ds.backgroundColor) || p.stroke;
        var points = (ds.data || []).filter(function (pt) {
          return pt && pt.x !== null && pt.y !== null && pt.x !== '' && pt.y !== '' && isFinite(Number(pt.x)) && isFinite(Number(pt.y));
        }).map(function (pt) { return { x: Number(pt.x), y: Number(pt.y), label: pt.label == null ? '' : String(pt.label) }; });
        return { label: ds.label || ('Series ' + (i + 1)), color: color, shape: SHAPES[i % SHAPES.length], points: points };
      });
    }

    // Which median lines to draw: { x: bool, y: bool }.
    _medianAxes() {
      if (!this.hasAttribute('median')) return { x: false, y: false };
      var v = (this.getAttribute('median') || 'y').toLowerCase();
      if (v === 'false' || v === 'none') return { x: false, y: false };
      return { x: v === 'x' || v === 'both', y: v !== 'x' };
    }

    render() {
      var a11y = window.LWT.a11y;
      var self = this;
      this._seriesCache = this._series();
      var all = [];
      this._seriesCache.forEach(function (s) { all = all.concat(s.points); });
      var med = this._medianAxes();
      var scope = this._strAttr('median-scope', 'all') === 'series' ? 'series' : 'all';
      this._medians = { x: med.x, y: med.y, scope: scope, all: { x: median(all.map(function (p) { return p.x; })), y: median(all.map(function (p) { return p.y; })) } };
      this._seriesCache.forEach(function (s) {
        s.median = { x: median(s.points.map(function (p) { return p.x; })), y: median(s.points.map(function (p) { return p.y; })) };
      });

      // trend lines
      var trendOn = this.hasAttribute('trend') && !/^(false|none)$/i.test(this.getAttribute('trend') || '');
      var trendScope = this._strAttr('trend-scope', 'all') === 'series' ? 'series' : 'all';
      this._trends = [];
      if (trendOn) {
        if (trendScope === 'all') {
          var fit = linearFit(all);
          if (fit) this._trends.push({ series: null, fit: fit });
        } else {
          this._seriesCache.forEach(function (s, i) {
            var f = linearFit(s.points);
            if (f) self._trends.push({ series: i, fit: f });
          });
        }
      }

      var name = this._a11yName([this._strAttr('title', '')], 'Scatter plot', 'Add a title attribute');
      var medText = '';
      if (all.length && (med.x || med.y)) {
        var parts = [];
        if (scope === 'all') {
          if (med.x) parts.push('median ' + this._axisName('x') + ' ' + this._fmt('x', this._medians.all.x));
          if (med.y) parts.push('median ' + this._axisName('y') + ' ' + this._fmt('y', this._medians.all.y));
        } else {
          this._seriesCache.forEach(function (s) {
            if (!s.points.length) return;
            if (med.x) parts.push(s.label + ' median ' + self._axisName('x') + ' ' + self._fmt('x', s.median.x));
            if (med.y) parts.push(s.label + ' median ' + self._axisName('y') + ' ' + self._fmt('y', s.median.y));
          });
        }
        medText = ', ' + parts.join(', ');
      }
      this._trends.forEach(function (t) {
        var f = t.fit;
        medText += ', ' + (t.series === null ? '' : self._seriesCache[t.series].label + ' ') + 'trend: ' + self._axisName('y') +
          (f.slope >= 0 ? ' rises ' : ' falls ') + fmtNumber(Math.abs(f.slope)) + ' per 1 ' + self._axisName('x') +
          ' (R squared ' + f.r2.toFixed(2) + ')';
      });
      this._chartName = name;
      var rows = [];
      this._seriesCache.forEach(function (s) {
        s.points.forEach(function (p) { rows.push([s.label, p.label, self._fmt('x', p.x), self._fmt('y', p.y)]); });
      });
      var table = rows.length ? a11y.dataTableHtml(name + medText, ['Series', 'Point', this._axisName('x'), this._axisName('y')], rows) : '';
      this._hasTable = !!table;
      this._ariaExtra = medText;
      this._renderShadow('<div class="chart-wrap" part="wrap">' + this._buildSvg() + table + '</div>' +
        '<div class="tip" part="tooltip" hidden></div>', CSS + a11y.SR_ONLY_CSS);
      this._svg = this._root.querySelector('svg');
      this._tip = this._root.querySelector('.tip');
    }

    _axisName(axis) { return this._strAttr(axis + '-label', '') || axis.toUpperCase(); }

    _measureText(text, fontSize) {
      if (!LWTScatter._ctx) LWTScatter._ctx = document.createElement('canvas').getContext('2d');
      LWTScatter._ctx.font = fontSize + 'px sans-serif';
      return LWTScatter._ctx.measureText(String(text)).width;
    }

    _buildSvg() {
      var self = this;
      var series = this._seriesCache;
      var title = this._strAttr('title', '');
      var legendPos = this._strAttr('legend-position', 'top');
      var grid = this._strAttr('grid', 'both');
      var xLabel = this._strAttr('x-label', ''), yLabel = this._strAttr('y-label', '');
      var size = parseFloat(this._strAttr('point-size', '5'));
      if (!(size > 0)) size = 5;
      var useShapes = this._boolAttr('shapes');
      var med = this._medians;

      var xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
      series.forEach(function (s) {
        s.points.forEach(function (p) {
          xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x);
          yMin = Math.min(yMin, p.y); yMax = Math.max(yMax, p.y);
        });
      });
      if (!isFinite(xMin)) { xMin = 0; xMax = 10; yMin = 0; yMax = 10; }
      var xr = computeRange(xMin, xMax, 8, numAttr(this, 'x-min'), numAttr(this, 'x-max'));
      var yr = computeRange(yMin, yMax, 7, numAttr(this, 'y-min'), numAttr(this, 'y-max'));

      var VBW = 640, VBH = 400, PAD = 14;
      var titleH = title ? 30 : 0;
      var maxYTickW = 0;
      yr.ticks.forEach(function (t) { maxYTickW = Math.max(maxYTickW, self._measureText(self._fmt('y', t), 11)); });
      var legendItemW = series.map(function (s) { return 18 + self._measureText(s.label, 11) + 16; });
      var legendRowH = 22;
      var side = legendPos === 'left' || legendPos === 'right';
      var legendColW = side && series.length ? Math.max.apply(null, legendItemW) + 10 : 0;

      var left = PAD + (yLabel ? 16 : 0) + maxYTickW + 10 + (legendPos === 'left' ? legendColW : 0);
      var right = PAD + 6 + (legendPos === 'right' ? legendColW : 0);
      var top = PAD + titleH + (legendPos === 'top' && series.length ? legendRowH : 0) + 4;
      var bottom = PAD + 18 + (xLabel ? 18 : 0) + (legendPos === 'bottom' && series.length ? legendRowH : 0);

      var plotLeft = left, plotTop = top, plotRight = VBW - right, plotBottom = VBH - bottom;
      var plotW = Math.max(10, plotRight - plotLeft), plotH = Math.max(10, plotBottom - plotTop);
      var X = function (v) { return plotLeft + (v - xr.min) / (xr.max - xr.min) * plotW; };
      var Y = function (v) { return plotBottom - (v - yr.min) / (yr.max - yr.min) * plotH; };
      this._geom = { plotLeft: plotLeft, plotTop: plotTop, plotRight: plotRight, plotBottom: plotBottom };

      var gridSvg = '', tickSvg = '';
      yr.ticks.forEach(function (t) {
        var y = Y(t);
        if (grid === 'both' || grid === 'horizontal') gridSvg += '<line class="grid-line" x1="' + plotLeft + '" y1="' + y.toFixed(2) + '" x2="' + plotRight + '" y2="' + y.toFixed(2) + '"></line>';
        tickSvg += '<text class="axis-text" x="' + (plotLeft - 8) + '" y="' + (y + 4).toFixed(2) + '" text-anchor="end">' + escapeXml(self._fmt('y', t)) + '</text>';
      });
      xr.ticks.forEach(function (t) {
        var x = X(t);
        if (grid === 'both' || grid === 'vertical') gridSvg += '<line class="grid-line" x1="' + x.toFixed(2) + '" y1="' + plotTop + '" x2="' + x.toFixed(2) + '" y2="' + plotBottom + '"></line>';
        tickSvg += '<text class="axis-text" x="' + x.toFixed(2) + '" y="' + (plotBottom + 18) + '" text-anchor="middle">' + escapeXml(self._fmt('x', t)) + '</text>';
      });
      var borderSvg = '<rect class="plot-border" x="' + plotLeft + '" y="' + plotTop + '" width="' + plotW.toFixed(2) + '" height="' + plotH.toFixed(2) + '"></rect>';

      // dots — remember screen positions for nearest-point hover
      var dotsSvg = '';
      this._pts = [];
      series.forEach(function (s, si) {
        s.points.forEach(function (p, pi) {
          var cx = X(p.x), cy = Y(p.y);
          var idx = self._pts.length;
          self._pts.push({ cx: cx, cy: cy, s: si, p: pi });
          dotsSvg += markerSvg(useShapes ? s.shape : 'circle', cx, cy, size,
            ' class="dot" data-i="' + idx + '" style="fill:' + escapeXml(s.color) + '"');
        });
      });

      // median lines (drawn over the grid, under the dots' hover state)
      var medSvg = '';
      var clampX = function (v) { return Math.max(plotLeft, Math.min(plotRight, v)); };
      var clampY = function (v) { return Math.max(plotTop, Math.min(plotBottom, v)); };
      function hLine(v, cls, style, text) {
        var y = clampY(Y(v));
        medSvg += '<line class="median ' + cls + '" x1="' + plotLeft + '" y1="' + y.toFixed(2) + '" x2="' + plotRight + '" y2="' + y.toFixed(2) + '"' + style + '></line>';
        medSvg += '<text class="median-text" x="' + (plotRight - 4) + '" y="' + (y - 5).toFixed(2) + '" text-anchor="end">' + escapeXml(text) + '</text>';
      }
      function vLine(v, cls, style, text) {
        var x = clampX(X(v));
        medSvg += '<line class="median ' + cls + '" x1="' + x.toFixed(2) + '" y1="' + plotTop + '" x2="' + x.toFixed(2) + '" y2="' + plotBottom + '"' + style + '></line>';
        medSvg += '<text class="median-text" x="' + (x + 5).toFixed(2) + '" y="' + (plotTop + 12) + '">' + escapeXml(text) + '</text>';
      }
      if (med.x || med.y) {
        if (med.scope === 'all' && med.all.x != null) {
          if (med.y) hLine(med.all.y, '', '', 'Median ' + this._fmt('y', med.all.y));
          if (med.x) vLine(med.all.x, '', '', 'Median ' + this._fmt('x', med.all.x));
        } else if (med.scope === 'series') {
          series.forEach(function (s) {
            if (!s.points.length) return;
            var st = ' style="stroke:' + escapeXml(s.color) + '"';
            if (med.y) hLine(s.median.y, 'series', st, s.label + ' ' + self._fmt('y', s.median.y));
            if (med.x) vLine(s.median.x, 'series', st, s.label + ' ' + self._fmt('x', s.median.x));
          });
        }
      }

      // trend lines: across the fitted points' x range, clipped to the plot
      var trendSvg = '';
      this._trends.forEach(function (t) {
        var f = t.fit, s = t.series === null ? null : series[t.series];
        var x1 = X(f.xMin), y1 = Y(f.slope * f.xMin + f.intercept);
        var x2 = X(f.xMax), y2 = Y(f.slope * f.xMax + f.intercept);
        var st = s ? ' style="stroke:' + escapeXml(s.color) + '"' : '';
        trendSvg += '<line class="trend" x1="' + x1.toFixed(2) + '" y1="' + y1.toFixed(2) + '" x2="' + x2.toFixed(2) + '" y2="' + y2.toFixed(2) + '"' + st + '></line>';
        // label just past/above the right end, kept inside the plot
        var lx = Math.min(x2, plotRight - 4), ly = Math.max(plotTop + 12, Math.min(plotBottom - 4, y2 + (f.slope >= 0 ? -8 : 14)));
        var txt = (s ? s.label + ' trend' : 'Trend') + ' (R\u00b2 ' + f.r2.toFixed(2) + ')';
        trendSvg += '<text class="trend-text' + (s ? ' series' : '') + '" x="' + lx.toFixed(2) + '" y="' + ly.toFixed(2) + '" text-anchor="end">' + escapeXml(txt) + '</text>';
      });
      var clip = '<clipPath id="plot-clip"><rect x="' + plotLeft + '" y="' + plotTop + '" width="' + plotW.toFixed(2) + '" height="' + plotH.toFixed(2) + '"></rect></clipPath>';
      trendSvg = trendSvg ? '<g clip-path="url(#plot-clip)">' + trendSvg + '</g>' : '';

      // legend
      var legendSvg = '';
      if (legendPos !== 'none' && series.length) {
        var legendMarker = function (s, x, y) {
          return markerSvg(useShapes ? s.shape : 'circle', x, y, 5, ' class="dot legend-dot" style="fill:' + escapeXml(s.color) + '"');
        };
        if (!side) {
          var ly = legendPos === 'top' ? PAD + titleH + 14 : VBH - PAD - 4;
          var lx = (VBW - legendItemW.reduce(function (a, b) { return a + b; }, 0)) / 2;
          series.forEach(function (s, i) {
            legendSvg += legendMarker(s, lx + 6, ly - 4);
            legendSvg += '<text class="legend-text" x="' + (lx + 16).toFixed(2) + '" y="' + ly + '">' + escapeXml(s.label) + '</text>';
            lx += legendItemW[i];
          });
        } else {
          var colX = legendPos === 'left' ? PAD : VBW - PAD - legendColW + 10;
          series.forEach(function (s, i) {
            var iy = plotTop + 10 + i * legendRowH;
            legendSvg += legendMarker(s, colX + 6, iy - 4);
            legendSvg += '<text class="legend-text" x="' + (colX + 16).toFixed(2) + '" y="' + iy + '">' + escapeXml(s.label) + '</text>';
          });
        }
      }

      var titleSvg = title ? '<text class="chart-title" x="' + (VBW / 2) + '" y="' + (PAD + 20) + '" text-anchor="middle">' + escapeXml(title) + '</text>' : '';
      var xLabelSvg = xLabel ? '<text class="axis-title" x="' + ((plotLeft + plotRight) / 2) + '" y="' + (VBH - PAD - (legendPos === 'bottom' && series.length ? legendRowH : 0)) + '" text-anchor="middle">' + escapeXml(xLabel) + '</text>' : '';
      var yLabelSvg = yLabel ? '<text class="axis-title" x="0" y="0" text-anchor="middle" transform="translate(' + (PAD + 10) + ',' + ((plotTop + plotBottom) / 2) + ') rotate(-90)">' + escapeXml(yLabel) + '</text>' : '';
      var guides = '<line class="guide gx" hidden></line><line class="guide gy" hidden></line>';

      return '<svg viewBox="0 0 ' + VBW + ' ' + VBH + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' +
        escapeXml(this._chartName + (this._ariaExtra || '') + (this._hasTable ? ', data table follows' : ', no data')) + '">' +
        '<defs>' + clip + '</defs>' + titleSvg + legendSvg + gridSvg + borderSvg + guides + medSvg + trendSvg + dotsSvg + tickSvg + xLabelSvg + yLabelSvg +
        '</svg>';
    }

    // ---- hover: nearest dot within HIT_RADIUS ----
    _onHover(e) {
      if (!this._svg || !this._pts.length) return;
      var ctm = this._svg.getScreenCTM();
      if (!ctm) return;
      var pt = this._svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      var v = pt.matrixTransform(ctm.inverse());
      var best = null, bestD = HIT_RADIUS * HIT_RADIUS;
      this._pts.forEach(function (p, i) {
        var dx = p.cx - v.x, dy = p.cy - v.y, d = dx * dx + dy * dy;
        if (d <= bestD) { bestD = d; best = i; }
      });
      if (best === null) { this._hideTip(); return; }
      this._showTip(best);
    }

    _showTip(i) {
      if (this._hoverI === i && !this._tip.hidden) return;
      this._hoverI = i;
      var rec = this._pts[i];
      var s = this._seriesCache[rec.s], p = s.points[rec.p];
      var esc = window.LWT.a11y.escape;
      var svg = this._svg;
      svg.classList.add('hovering');
      Array.prototype.forEach.call(svg.querySelectorAll('.dot.hover'), function (d) { d.classList.remove('hover'); });
      var dot = svg.querySelector('.dot[data-i="' + i + '"]');
      if (dot) { dot.classList.add('hover'); dot.parentNode.appendChild(dot); } // bring to front
      // dotted guides from the dot to each axis
      var g = this._geom;
      var gx = svg.querySelector('.gx'), gy = svg.querySelector('.gy');
      gx.setAttribute('x1', rec.cx); gx.setAttribute('x2', rec.cx); gx.setAttribute('y1', rec.cy); gx.setAttribute('y2', g.plotBottom); gx.removeAttribute('hidden');
      gy.setAttribute('x1', g.plotLeft); gy.setAttribute('x2', rec.cx); gy.setAttribute('y1', rec.cy); gy.setAttribute('y2', rec.cy); gy.removeAttribute('hidden');

      var multi = this._seriesCache.length > 1;
      var head = p.label ? '<strong>' + esc(p.label) + '</strong>' : '';
      var seriesLine = (multi || !p.label) ? '<span class="series"><span class="swatch" style="background:' + esc(s.color) + '"></span>' + esc(s.label) + '</span>' : '';
      this._tip.innerHTML = head + seriesLine +
        esc(this._axisName('x')) + ': ' + esc(this._fmt('x', p.x)) + '<br>' +
        esc(this._axisName('y')) + ': ' + esc(this._fmt('y', p.y));
      this._tip.hidden = false;

      var host = this.getBoundingClientRect();
      var r = (dot || svg).getBoundingClientRect();
      var x = r.left + r.width / 2 - host.left;
      var half = this._tip.offsetWidth / 2;
      x = Math.max(half + 4, Math.min(host.width - half - 4, x));
      var top = r.top - host.top;
      // Not enough room above: flip below the dot.
      if (top - this._tip.offsetHeight - 12 < 0) {
        this._tip.style.transform = 'translate(-50%, 10px)';
        top = r.bottom - host.top;
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
        Array.prototype.forEach.call(this._svg.querySelectorAll('.dot.hover'), function (d) { d.classList.remove('hover'); });
        Array.prototype.forEach.call(this._svg.querySelectorAll('.guide'), function (g) { g.setAttribute('hidden', ''); });
      }
    }
  }

  window.LWT.chart.withPalette(LWTScatter);
  window.LWT.define('lwtd-scatter', LWTScatter);
})();
