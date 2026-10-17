/*!
 * <lwtd-radar-chart>
 * Same conventions as the other lwt-*-chart elements (data from JS,
 * inline SVG, full rebuild on every change). Labels become the axes
 * (spokes) arranged evenly around a circle; each dataset is one value
 * per axis, drawn as a closed, filled polygon.
 *
 *   var chart = document.querySelector('lwtd-radar-chart');
 *   chart.data = {
 *     labels: ['Communication', 'Technical', 'Leadership', 'Creativity', 'Teamwork', 'Problem Solving'],
 *     datasets: [
 *       { label: 'Alice', data: [85, 82, 70, 90, 88, 65] },
 *       { label: 'Bob',   data: [78, 65, 80, 60, 72, 85] }
 *     ]
 *   };
 *
 * The radial scale auto-ranges to a "nice" min/max around the actual
 * data (like lwtd-bubble-chart's axes) rather than always starting at 0
 * like lwtd-bar-chart/lwtd-line-chart's value axis. For clustered rating
 * data (e.g. everything between 60-100) that's what makes the shape
 * legible instead of a tiny sliver near the outer edge — there's no
 * begin-at-zero option in this version.
 *
 * Colors: `borderColor` (line + point color) and `backgroundColor` (fill)
 * per dataset, same Chart.js field names used elsewhere in this library.
 * `backgroundColor` as a hex color gets the fill opacity applied to it
 * automatically; pass an rgba()/hsla() string instead if you want to set
 * the transparency yourself, in which case fillOpacity is ignored for
 * that dataset. Omit both and colors cycle from the built-in palette.
 *
 * Sizing, per dataset or chart-wide default:
 *   `pointRadius` / `point-radius` — dot size (default 3)
 *   `borderWidth` / `line-width`   — line thickness (default 2)
 *   `fillOpacity` / `fill-opacity` — fill transparency, 0-1 (default 0.25)
 *
 * Attributes:
 *   title            — chart title text
 *   legend-position  — "top" (default) | "bottom" | "left" | "right" | "none"
 *   grid             — "both" (default) | "none" — radar grid rings are
 *                       polygons matching the axis count, not axis-aligned
 *                       lines, so there's no horizontal/vertical split
 *                       the way lwtd-bar-chart has
 *   line-width       — default stroke width in px
 *   point-radius     — default dot radius in px, 0 hides dots
 *   fill-opacity     — default fill alpha, 0-1
 *
 * Known scope limits: no hover/tooltip, no begin-at-zero option, value
 * tick labels are only drawn along the first axis (standard radar chart
 * convention — showing them on every spoke gets cluttered fast), legend
 * text isn't wrapped, needs at least 3 labels to look like a proper
 * polygon (works with fewer, just looks like a line/point).
 *
 * Theming: --lwt-chart-bg (default transparent), --lwt-chart-grid,
 * --lwt-chart-tick-color, --lwt-chart-label-color, --lwt-chart-title-color,
 * --lwt-chart-legend-color, --lwt-chart-aspect-ratio (default 8/5).
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-dsh-radar-chart.js requires lwt-core.js to be loaded first.');
  }

  var PALETTE = [
    { fill: '#93c5fd', stroke: '#3b82f6' },
    { fill: '#f9a8d4', stroke: '#ec4899' },
    { fill: '#86efac', stroke: '#22c55e' },
    { fill: '#fcd34d', stroke: '#f59e0b' },
    { fill: '#c4b5fd', stroke: '#8b5cf6' },
    { fill: '#67e8f9', stroke: '#06b6d4' },
    { fill: '#fda4af', stroke: '#f43f5e' },
    { fill: '#fdba74', stroke: '#f97316' }
  ];

  function niceNumber(range, round) {
    if (range <= 0) return 1;
    var exponent = Math.floor(Math.log(range) / Math.LN10);
    var fraction = range / Math.pow(10, exponent);
    var niceFraction;
    if (round) {
      if (fraction < 1.5) niceFraction = 1;
      else if (fraction < 3) niceFraction = 2;
      else if (fraction < 7) niceFraction = 5;
      else niceFraction = 10;
    } else {
      if (fraction <= 1) niceFraction = 1;
      else if (fraction <= 2) niceFraction = 2;
      else if (fraction <= 5) niceFraction = 5;
      else niceFraction = 10;
    }
    return niceFraction * Math.pow(10, exponent);
  }

  function computeRange(dataMin, dataMax, tickTarget) {
    if (dataMin === dataMax) { dataMin -= 1; dataMax += 1; }
    var padding = (dataMax - dataMin) * 0.1;
    var paddedMin = dataMin - padding;
    var paddedMax = dataMax + padding;
    var range = niceNumber(paddedMax - paddedMin, false);
    var step = niceNumber(range / (tickTarget - 1), true);
    var niceMin = Math.floor(paddedMin / step) * step;
    var niceMax = Math.ceil(paddedMax / step) * step;
    var ticks = [];
    for (var v = niceMin; v <= niceMax + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
    return { min: niceMin, max: niceMax, step: step, ticks: ticks };
  }

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function hexToRgba(hex, alpha) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function polarToCartesian(cx, cy, r, angle) {
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  var CSS = `
    :host {
      display: block;
      width: 100%;
      aspect-ratio: var(--lwt-chart-aspect-ratio, 8 / 5);
      font-family: inherit;
      background: var(--lwt-chart-bg, transparent);
    }
    .chart-wrap, svg { display: block; width: 100%; height: 100%; }
    .grid-line { stroke: var(--lwt-chart-grid, var(--lwt-border-color, #e5e7eb)); stroke-width: 1; fill: none; }
    .axis-text { fill: var(--lwt-chart-tick-color, var(--lwt-color-text-muted, #6b7280)); font-size: 11px; }
    .axis-label { fill: var(--lwt-chart-label-color, var(--lwt-color-text, #374151)); font-size: 11px; }
    .chart-title {
      fill: var(--lwt-chart-title-color, var(--lwt-color-text-strong, #1f2937));
      font-size: 15px;
      font-weight: 700;
    }
    .legend-text { fill: var(--lwt-chart-legend-color, var(--lwt-color-text, #374151)); font-size: 11px; }
    .radar-shape { stroke-linejoin: round; }
  `;

  class LWTRadarChart extends window.LWT.Element {
    static get observedAttributes() {
      return ['title', 'legend-position', 'grid', 'line-width', 'point-radius', 'fill-opacity'];
    }

    static get observedProps() {
      return ['data'];
    }

    constructor() {
      super();
      this._data = null;
    }

    get data() { return this._data; }
    set data(value) {
      this._data = value;
      if (this._root) this.render();
    }

    render() {
      // Charts are images: name the SVG, and add a screen-reader-only
      // data table with the same numbers (WCAG 1.1.1 / 1.3.1).
      var a11y = window.LWT.a11y;
      this._chartName = this._a11yName([this._strAttr('title', '')], 'Radar chart', 'Add a title attribute');
      var table = a11y.chartTableHtml(this._chartName, this._data);
      this._hasTable = !!table;
      this._renderShadow('<div class="chart-wrap" part="wrap">' + this._buildSvg() + table + '</div>', CSS + a11y.SR_ONLY_CSS);
    }

    _measureText(text, fontSize) {
      if (!LWTRadarChart._ctx) {
        LWTRadarChart._ctx = this._genhtml({type: 'canvas'}).getContext('2d');
      }
      LWTRadarChart._ctx.font = fontSize + 'px sans-serif';
      return LWTRadarChart._ctx.measureText(String(text)).width;
    }

    _buildSvg() {
      var self = this;
      var data = this._data || {};
      var labels = data.labels || [];
      var datasets = data.datasets || [];

      var title = this._strAttr('title', '');
      var legendPos = this._strAttr('legend-position', 'top');
      var grid = this._strAttr('grid', 'both');
      var defaultLineWidth = parseFloat(this._strAttr('line-width', '2'));
      if (isNaN(defaultLineWidth)) defaultLineWidth = 2;
      var defaultPointRadius = parseFloat(this._strAttr('point-radius', '3'));
      if (isNaN(defaultPointRadius)) defaultPointRadius = 3;
      var defaultFillOpacity = parseFloat(this._strAttr('fill-opacity', '0.25'));
      if (isNaN(defaultFillOpacity)) defaultFillOpacity = 0.25;

      var series = datasets.map(function (ds, i) {
        var p = PALETTE[i % PALETTE.length];
        var fillOpacity = typeof ds.fillOpacity === 'number' ? ds.fillOpacity : defaultFillOpacity;
        var fillBase = ds.backgroundColor || p.fill;
        var fill = /^#/.test(fillBase) ? hexToRgba(fillBase, fillOpacity) : fillBase;
        return {
          label: ds.label || ('Series ' + (i + 1)),
          data: ds.data || [],
          line: ds.borderColor || p.stroke,
          fill: fill,
          lineWidth: typeof ds.borderWidth === 'number' ? ds.borderWidth : defaultLineWidth,
          pointRadius: typeof ds.pointRadius === 'number' ? ds.pointRadius : defaultPointRadius
        };
      });

      var n = labels.length;

      var allValues = [];
      series.forEach(function (s) { s.data.forEach(function (v) { allValues.push(Number(v) || 0); }); });
      var dataMin = allValues.length ? Math.min.apply(null, allValues) : 0;
      var dataMax = allValues.length ? Math.max.apply(null, allValues) : 10;
      var range = computeRange(dataMin, dataMax, 6);

      var maxLabelW = 0;
      labels.forEach(function (l) { maxLabelW = Math.max(maxLabelW, self._measureText(l, 11)); });

      var legendItemWidths = series.map(function (s) { return 14 + 4 + self._measureText(s.label, 11) + 16; });
      var legendRowH = 22;
      var legendColW = (legendPos === 'left' || legendPos === 'right')
        ? Math.max.apply(null, legendItemWidths.concat([0])) + 10
        : 0;

      var VBW = 640, VBH = 400, PAD = 14;
      var titleH = title ? 30 : 0;

      var left = PAD + (legendPos === 'left' ? legendColW : 0);
      var right = PAD + (legendPos === 'right' ? legendColW : 0);
      var top = PAD + titleH + (legendPos === 'top' ? legendRowH : 0);
      var bottom = PAD + (legendPos === 'bottom' ? legendRowH : 0);

      var plotLeft = left, plotTop = top;
      var plotRight = VBW - right, plotBottom = VBH - bottom;
      var plotW = Math.max(10, plotRight - plotLeft);
      var plotH = Math.max(10, plotBottom - plotTop);

      var cx = plotLeft + plotW / 2;
      var cy = plotTop + plotH / 2;
      var outerR = Math.max(20, Math.min(plotW, plotH) / 2 - maxLabelW / 2 - 14);

      function angle(i) { return -Math.PI / 2 + i * (Math.PI * 2 / n); }
      function valueToRadius(v) {
        var t = (v - range.min) / (range.max - range.min);
        t = Math.max(0, Math.min(1, t));
        return t * outerR;
      }

      // ---- grid rings + spokes ----
      var gridSvg = '';
      if (grid !== 'none' && n >= 3) {
        range.ticks.forEach(function (t) {
          var r = valueToRadius(t);
          if (r <= 0) return;
          var pts = [];
          for (var i = 0; i < n; i++) pts.push(polarToCartesian(cx, cy, r, angle(i)));
          var d = 'M ' + pts.map(function (p) { return p.x.toFixed(2) + ' ' + p.y.toFixed(2); }).join(' L ') + ' Z';
          gridSvg += '<path class="grid-line" d="' + d + '"></path>';
        });
        for (var si = 0; si < n; si++) {
          var end = polarToCartesian(cx, cy, outerR, angle(si));
          gridSvg += '<line class="grid-line" x1="' + cx.toFixed(2) + '" y1="' + cy.toFixed(2) + '" x2="' + end.x.toFixed(2) + '" y2="' + end.y.toFixed(2) + '"></line>';
        }
      }

      // ---- value tick labels along the first axis only ----
      var tickSvg = '';
      if (n > 0) {
        range.ticks.forEach(function (t) {
          var r = valueToRadius(t);
          if (r <= 0) return;
          var p = polarToCartesian(cx, cy, r, angle(0));
          tickSvg += '<text class="axis-text" x="' + (p.x + 4).toFixed(2) + '" y="' + (p.y - 2).toFixed(2) + '" text-anchor="start">' + escapeXml(t) + '</text>';
        });
      }

      // ---- axis (category) labels ----
      var labelSvg = '';
      labels.forEach(function (l, i) {
        var a = angle(i);
        var p = polarToCartesian(cx, cy, outerR + 14, a);
        var cos = Math.cos(a);
        var anchor = cos > 0.3 ? 'start' : (cos < -0.3 ? 'end' : 'middle');
        labelSvg += '<text class="axis-label" x="' + p.x.toFixed(2) + '" y="' + (p.y + 4).toFixed(2) + '" text-anchor="' + anchor + '">' + escapeXml(l) + '</text>';
      });

      // ---- data polygons ----
      var shapesSvg = '';
      series.forEach(function (s) {
        var pts = [];
        for (var i = 0; i < n; i++) {
          var v = Number(s.data[i]) || 0;
          pts.push(polarToCartesian(cx, cy, valueToRadius(v), angle(i)));
        }
        if (!pts.length) return;
        var d = 'M ' + pts.map(function (p) { return p.x.toFixed(2) + ' ' + p.y.toFixed(2); }).join(' L ') + ' Z';
        shapesSvg += '<path class="radar-shape" d="' + d + '" fill="' + s.fill + '" stroke="' + s.line + '" stroke-width="' + s.lineWidth + '"></path>';
        if (s.pointRadius > 0) {
          pts.forEach(function (p) {
            shapesSvg += '<circle cx="' + p.x.toFixed(2) + '" cy="' + p.y.toFixed(2) + '" r="' + s.pointRadius + '" fill="' + s.line + '"></circle>';
          });
        }
      });

      // ---- legend (per dataset) ----
      var legendSvg = '';
      if (legendPos !== 'none' && series.length) {
        if (legendPos === 'top' || legendPos === 'bottom') {
          var legendY = legendPos === 'top' ? (PAD + titleH + 14) : (VBH - PAD - 8);
          var totalW = legendItemWidths.reduce(function (a, b) { return a + b; }, 0);
          var lx = (VBW - totalW) / 2;
          series.forEach(function (s, i) {
            legendSvg += '<circle cx="' + (lx + 6).toFixed(2) + '" cy="' + (legendY - 4).toFixed(2) + '" r="6" fill="' + s.line + '"></circle>';
            legendSvg += '<text class="legend-text" x="' + (lx + 18).toFixed(2) + '" y="' + legendY.toFixed(2) + '">' + escapeXml(s.label) + '</text>';
            lx += legendItemWidths[i];
          });
        } else {
          var colX = legendPos === 'left' ? PAD : (VBW - PAD - legendColW + 10);
          var startY = plotTop + 10;
          series.forEach(function (s, i) {
            var iy = startY + i * legendRowH;
            legendSvg += '<circle cx="' + (colX + 6).toFixed(2) + '" cy="' + (iy - 4).toFixed(2) + '" r="6" fill="' + s.line + '"></circle>';
            legendSvg += '<text class="legend-text" x="' + (colX + 18).toFixed(2) + '" y="' + iy.toFixed(2) + '">' + escapeXml(s.label) + '</text>';
          });
        }
      }

      var titleSvg = title ? '<text class="chart-title" x="' + (VBW / 2) + '" y="' + (PAD + 20) + '" text-anchor="middle">' + escapeXml(title) + '</text>' : '';

      return '<svg viewBox="0 0 ' + VBW + ' ' + VBH + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + escapeXml((this._chartName || title || 'Radar chart') + (this._hasTable ? ', data table follows' : ', no data')) + '">' +
        titleSvg + legendSvg + gridSvg + shapesSvg + tickSvg + labelSvg +
        '</svg>';
    }
  }

  window.LWT.define('lwtd-radar-chart', LWTRadarChart);
})();
