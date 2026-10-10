/*!
 * <lwtd-bubble-chart>
 * Same conventions as the other lwt-*-chart elements (data from JS,
 * inline SVG, full rebuild on every change) — but the data shape is
 * different by necessity: a bubble chart has two numeric axes (not one
 * category axis + one value axis), so there's no top-level `labels`
 * array. Each data point carries its own {x, y, r}, matching Chart.js's
 * bubble chart format:
 *
 *   var chart = document.querySelector('lwtd-bubble-chart');
 *   chart.data = {
 *     datasets: [
 *       {
 *         label: 'North America',
 *         data: [{ x: 65, y: 7.8, r: 20 }, { x: 55, y: 7.5, r: 14 }, { x: 50, y: 7.0, r: 12 }]
 *       },
 *       {
 *         label: 'Europe',
 *         data: [{ x: 40, y: 8.2, r: 18 }, { x: 45, y: 8.0, r: 14 }, { x: 30, y: 7.6, r: 10 }]
 *       }
 *     ]
 *   };
 *
 * `r` is a literal pixel radius (same convention Chart.js uses — it's
 * not auto-scaled against the data), so tune it directly in the data, or
 * apply a chart-wide multiplier with the `bubble-scale` attribute.
 *
 * Colors: `backgroundColor`/`borderColor` on a dataset can be a single
 * string (applied to every bubble in that series — the common case,
 * matching the reference image) or an array (one color per point);
 * otherwise both cycle from the built-in palette per dataset.
 *
 * Both axes auto-scale to "nice" numbers around the actual data range
 * (not forced to start at 0 — a bubble chart's axes are just numeric
 * scales, unlike a bar/line chart's zero-based value axis).
 *
 * Attributes:
 *   title            — chart title text
 *   bubble-scale     — multiplier applied to every point's r (default 1)
 *   legend-position  — "top" (default) | "bottom" | "left" | "right" | "none"
 *   grid             — "both" (default) | "horizontal" | "vertical" | "none"
 *   x-label / y-label — axis titles
 *
 * Known scope limits: no hover/tooltip, no click interactivity, bubbles
 * aren't clamped away from the plot edges (a large bubble near an axis
 * extreme can visually extend past the border, same as Chart.js's
 * default), legend text isn't wrapped.
 *
 * Theming: --lwt-chart-bg (default transparent), --lwt-chart-grid,
 * --lwt-chart-border, --lwt-chart-tick-color, --lwt-chart-label-color,
 * --lwt-chart-title-color, --lwt-chart-legend-color,
 * --lwt-chart-aspect-ratio (default 8/5).
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-dsh-bubble-chart.js requires lwt-core.js to be loaded first.');
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

  // Unlike lwtd-bar-chart/lwtd-line-chart's zero-based computeScale, this
  // finds a "nice" MIN and MAX around the actual data range.
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

  var CSS =
    ':host { display: block; width: 100%; aspect-ratio: var(--lwt-chart-aspect-ratio, 8 / 5); font-family: inherit; background: var(--lwt-chart-bg, transparent); }' +
    '.chart-wrap, svg { display: block; width: 100%; height: 100%; }' +
    '.grid-line { stroke: var(--lwt-chart-grid, var(--lwt-color-border, #e5e7eb)); stroke-width: 1; }' +
    '.plot-border { stroke: var(--lwt-chart-border, var(--lwt-color-border, #e5e7eb)); stroke-width: 1; }' +
    '.axis-text { fill: var(--lwt-chart-tick-color, var(--lwt-color-text-muted, #6b7280)); font-size: 11px; }' +
    '.axis-title { fill: var(--lwt-chart-label-color, var(--lwt-color-text, #374151)); font-size: 12px; font-weight: 600; }' +
    '.chart-title { fill: var(--lwt-chart-title-color, var(--lwt-color-text-strong, #1f2937)); font-size: 15px; font-weight: 700; }' +
    '.legend-text { fill: var(--lwt-chart-legend-color, var(--lwt-color-text, #374151)); font-size: 11px; }' +
    '.bubble { stroke-width: 1.5; }';

  class LWTBubbleChart extends window.LWT.Element {
    static get observedAttributes() {
      return ['title', 'bubble-scale', 'legend-position', 'grid', 'x-label', 'y-label'];
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
      this._chartName = this._a11yName([this._strAttr('title', '')], 'Bubble chart', 'Add a title attribute');
      var table = a11y.chartTableHtml(this._chartName, this._data);
      this._hasTable = !!table;
      this._renderShadow('<div class="chart-wrap" part="wrap">' + this._buildSvg() + table + '</div>', CSS + a11y.SR_ONLY_CSS);
    }

    _measureText(text, fontSize) {
      if (!LWTBubbleChart._ctx) {
        LWTBubbleChart._ctx = this._genhtml({ type: 'canvas' }).getContext('2d');
      }
      LWTBubbleChart._ctx.font = fontSize + 'px sans-serif';
      return LWTBubbleChart._ctx.measureText(String(text)).width;
    }

    _buildSvg() {
      var self = this;
      var data = this._data || {};
      var datasets = data.datasets || [];

      var title = this._strAttr('title', '');
      var bubbleScale = parseFloat(this._strAttr('bubble-scale', '1'));
      if (isNaN(bubbleScale) || bubbleScale <= 0) bubbleScale = 1;
      var legendPos = this._strAttr('legend-position', 'top');
      var grid = this._strAttr('grid', 'both');
      var xLabel = this._strAttr('x-label', '');
      var yLabel = this._strAttr('y-label', '');

      var series = datasets.map(function (ds, i) {
        var p = PALETTE[i % PALETTE.length];
        return {
          label: ds.label || ('Series ' + (i + 1)),
          points: ds.data || [],
          bg: ds.backgroundColor,
          border: ds.borderColor,
          fallback: p
        };
      });

      function pointColor(s, i) {
        var fill = Array.isArray(s.bg) ? s.bg[i] : s.bg;
        var stroke = Array.isArray(s.border) ? s.border[i] : s.border;
        return { fill: fill || s.fallback.fill, stroke: stroke || s.fallback.stroke };
      }

      // ---- data extents ----
      var xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
      series.forEach(function (s) {
        s.points.forEach(function (p) {
          var x = Number(p.x) || 0, y = Number(p.y) || 0;
          if (x < xMin) xMin = x;
          if (x > xMax) xMax = x;
          if (y < yMin) yMin = y;
          if (y > yMax) yMax = y;
        });
      });
      var hasData = isFinite(xMin) && isFinite(xMax) && isFinite(yMin) && isFinite(yMax);
      if (!hasData) { xMin = 0; xMax = 10; yMin = 0; yMax = 10; }

      var xRange = computeRange(xMin, xMax, 8);
      var yRange = computeRange(yMin, yMax, 8);

      var maxYTickW = 0;
      yRange.ticks.forEach(function (t) { maxYTickW = Math.max(maxYTickW, self._measureText(t, 11)); });

      var legendItemWidths = series.map(function (s) { return 14 + 4 + self._measureText(s.label, 11) + 16; });
      var legendRowH = 22;
      var legendColW = (legendPos === 'left' || legendPos === 'right')
        ? Math.max.apply(null, legendItemWidths.concat([0])) + 10
        : 0;

      var VBW = 640, VBH = 400, PAD = 14;
      var titleH = title ? 30 : 0;

      var left = PAD + (yLabel ? 16 : 0) + maxYTickW + 10 + (legendPos === 'left' ? legendColW : 0);
      var right = PAD + (legendPos === 'right' ? legendColW : 0);
      var top = PAD + titleH + (legendPos === 'top' ? legendRowH : 0);
      var bottom = PAD + 18 + (xLabel ? 18 : 0) + (legendPos === 'bottom' ? legendRowH : 0);

      var plotLeft = left, plotTop = top;
      var plotRight = VBW - right, plotBottom = VBH - bottom;
      var plotW = Math.max(10, plotRight - plotLeft);
      var plotH = Math.max(10, plotBottom - plotTop);

      function xPos(v) { return plotLeft + ((v - xRange.min) / (xRange.max - xRange.min)) * plotW; }
      function yPos(v) { return plotBottom - ((v - yRange.min) / (yRange.max - yRange.min)) * plotH; }

      // ---- gridlines + ticks (both axes numeric) ----
      var gridSvg = '', tickSvg = '';
      yRange.ticks.forEach(function (t) {
        var y = yPos(t);
        if (grid === 'both' || grid === 'horizontal') {
          gridSvg += '<line class="grid-line" x1="' + plotLeft + '" y1="' + y.toFixed(2) + '" x2="' + plotRight + '" y2="' + y.toFixed(2) + '"></line>';
        }
        tickSvg += '<text class="axis-text" x="' + (plotLeft - 8) + '" y="' + (y + 4).toFixed(2) + '" text-anchor="end">' + escapeXml(t) + '</text>';
      });
      xRange.ticks.forEach(function (t) {
        var x = xPos(t);
        if (grid === 'both' || grid === 'vertical') {
          gridSvg += '<line class="grid-line" x1="' + x.toFixed(2) + '" y1="' + plotTop + '" x2="' + x.toFixed(2) + '" y2="' + plotBottom + '"></line>';
        }
        tickSvg += '<text class="axis-text" x="' + x.toFixed(2) + '" y="' + (plotBottom + 18) + '" text-anchor="middle">' + escapeXml(t) + '</text>';
      });

      var borderSvg = '<rect class="plot-border" x="' + plotLeft + '" y="' + plotTop + '" width="' + plotW.toFixed(2) + '" height="' + plotH.toFixed(2) + '" fill="none"></rect>';

      // ---- bubbles ----
      var bubblesSvg = '';
      series.forEach(function (s) {
        s.points.forEach(function (p, i) {
          var x = Number(p.x) || 0, y = Number(p.y) || 0;
          var r = Math.max(1, (Number(p.r) || 5) * bubbleScale);
          var c = pointColor(s, i);
          bubblesSvg += '<circle class="bubble" cx="' + xPos(x).toFixed(2) + '" cy="' + yPos(y).toFixed(2) + '" r="' + r.toFixed(2) +
            '" fill="' + c.fill + '" stroke="' + c.stroke + '"></circle>';
        });
      });

      // ---- legend (per dataset) ----
      var legendSvg = '';
      if (legendPos !== 'none' && series.length) {
        if (legendPos === 'top' || legendPos === 'bottom') {
          var legendY = legendPos === 'top' ? (PAD + titleH + 14) : (VBH - PAD - 8);
          var totalW = legendItemWidths.reduce(function (a, b) { return a + b; }, 0);
          var lx = (VBW - totalW) / 2;
          series.forEach(function (s, i) {
            var c = pointColor(s, 0);
            legendSvg += '<circle cx="' + (lx + 7).toFixed(2) + '" cy="' + (legendY - 4).toFixed(2) + '" r="7" fill="' + c.fill + '" stroke="' + c.stroke + '"></circle>';
            legendSvg += '<text class="legend-text" x="' + (lx + 20).toFixed(2) + '" y="' + legendY.toFixed(2) + '">' + escapeXml(s.label) + '</text>';
            lx += legendItemWidths[i];
          });
        } else {
          var colX = legendPos === 'left' ? PAD : (VBW - PAD - legendColW + 10);
          var startY = plotTop + 10;
          series.forEach(function (s, i) {
            var iy = startY + i * legendRowH;
            var c2 = pointColor(s, 0);
            legendSvg += '<circle cx="' + (colX + 7).toFixed(2) + '" cy="' + (iy - 4).toFixed(2) + '" r="7" fill="' + c2.fill + '" stroke="' + c2.stroke + '"></circle>';
            legendSvg += '<text class="legend-text" x="' + (colX + 20).toFixed(2) + '" y="' + iy.toFixed(2) + '">' + escapeXml(s.label) + '</text>';
          });
        }
      }

      var titleSvg = title ? '<text class="chart-title" x="' + (VBW / 2) + '" y="' + (PAD + 20) + '" text-anchor="middle">' + escapeXml(title) + '</text>' : '';
      var xLabelSvg = xLabel ? '<text class="axis-title" x="' + ((plotLeft + plotRight) / 2) + '" y="' + (VBH - PAD) + '" text-anchor="middle">' + escapeXml(xLabel) + '</text>' : '';
      var yLabelSvg = yLabel
        ? '<text class="axis-title" x="0" y="0" text-anchor="middle" transform="translate(' + (PAD + 10) + ',' + ((plotTop + plotBottom) / 2) + ') rotate(-90)">' + escapeXml(yLabel) + '</text>'
        : '';

      return '<svg viewBox="0 0 ' + VBW + ' ' + VBH + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + escapeXml((this._chartName || title || 'Bubble chart') + (this._hasTable ? ', data table follows' : ', no data')) + '">' +
        titleSvg + legendSvg + gridSvg + borderSvg + bubblesSvg + tickSvg + xLabelSvg + yLabelSvg +
        '</svg>';
    }
  }

  window.LWT.define('lwtd-bubble-chart', LWTBubbleChart);
})();
