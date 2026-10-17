/*!
 * <lwtd-line-chart>
 * Same conventions as lwtd-bar-chart (data from JS, inline SVG, full
 * rebuild on every change) with line/area-specific extras: per-dataset
 * fill, and chart-wide or per-dataset line width and point size.
 *
 *   var chart = document.querySelector('lwtd-line-chart');
 *   chart.data = {
 *     labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
 *     datasets: [
 *       { label: 'Visitors', data: [4200, 4800, 5100, 4900, 5500, 6200, 5800] }
 *     ]
 *   };
 *
 *   // multi-series filled/overlapping area chart:
 *   chart2.data = {
 *     labels: ['Jan','Feb','Mar','Apr','May','Jun'],
 *     datasets: [
 *       { label: 'Organic', data: [2200,2800,3100,2900,3500,4200] },
 *       { label: 'Paid',    data: [4000,4900,5000,5300,5700,6800] },
 *       { label: 'Social',  data: [4900,5800,6100,6600,6900,8400] }
 *     ]
 *   };
 *   chart2.setAttribute('fill', '');
 *
 * Points are plotted edge-to-edge (first label at the plot's left edge,
 * last at its right edge) rather than centered in bands the way
 * lwtd-bar-chart's categories are — the standard line-chart convention.
 *
 * Colors, again Chart.js-compatible field names: `borderColor` (the line)
 * and `backgroundColor` (the fill) can be set per dataset; otherwise both
 * cycle from the built-in palette, with the fill automatically given
 * transparency so overlapping series blend the way the reference image
 * does. `fill` (boolean) turns the area fill on per dataset; the `fill`
 * attribute sets the chart-wide default for datasets that don't specify
 * their own. `borderWidth` (line stroke width) and `pointRadius` (dot
 * size, 0 to hide dots) are also per-dataset, falling back to the
 * chart-wide `line-width`/`point-radius` attributes.
 *
 * Attributes:
 *   title            — chart title text
 *   stacked          — boolean; stacks areas instead of overlapping them
 *   fill              — boolean; default fill mode for datasets that don't set their own
 *   line-width        — default stroke width in px (default 2)
 *   point-radius      — default dot radius in px, 0 hides dots (default 3)
 *   legend-position   — "top" (default) | "bottom" | "left" | "right" | "none"
 *   grid              — "horizontal" (default) | "vertical" | "both" | "none"
 *   x-label / y-label — axis titles
 *
 * Known scope limits: no hover/tooltip, no smoothing/curved lines
 * (straight segments only), no negative values, legend text isn't wrapped.
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
    throw new Error('lwt-dsh-line-chart.js requires lwt-core.js to be loaded first.');
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

  function computeScale(maxValue, tickTarget) {
    if (!maxValue || maxValue <= 0) maxValue = 1;
    var range = niceNumber(maxValue, false);
    var step = niceNumber(range / (tickTarget - 1), true);
    var niceMax = Math.ceil(maxValue / step) * step;
    var ticks = [];
    for (var v = 0; v <= niceMax + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
    return { max: niceMax, step: step, ticks: ticks };
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

  function linePathD(points) {
    return points.map(function (p, i) { return (i === 0 ? 'M ' : 'L ') + p.x.toFixed(2) + ' ' + p.y.toFixed(2); }).join(' ');
  }

  function areaPathD(topPts, basePts) {
    var d = linePathD(topPts);
    var rev = basePts.slice().reverse();
    d += ' ' + rev.map(function (p) { return 'L ' + p.x.toFixed(2) + ' ' + p.y.toFixed(2); }).join(' ');
    return d + ' Z';
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
    .grid-line { stroke: var(--lwt-chart-grid, var(--lwt-border-color, #e5e7eb)); stroke-width: 1; }
    .plot-border { stroke: var(--lwt-chart-border, var(--lwt-border-color, #e5e7eb)); stroke-width: 1; }
    .axis-text { fill: var(--lwt-chart-tick-color, var(--lwt-color-text-muted, #6b7280)); font-size: 11px; }
    .axis-title {
      fill: var(--lwt-chart-label-color, var(--lwt-color-text, #374151));
      font-size: 12px;
      font-weight: 600;
    }
    .chart-title {
      fill: var(--lwt-chart-title-color, var(--lwt-color-text-strong, #1f2937));
      font-size: 15px;
      font-weight: 700;
    }
    .legend-text { fill: var(--lwt-chart-legend-color, var(--lwt-color-text, #374151)); font-size: 11px; }
    .line { fill: none; stroke-linejoin: round; stroke-linecap: round; }
  `;

  class LWTLineChart extends window.LWT.Element {
    static get observedAttributes() {
      return ['title', 'stacked', 'fill', 'line-width', 'point-radius', 'legend-position', 'grid', 'x-label', 'y-label'];
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
      this._chartName = this._a11yName([this._strAttr('title', '')], 'Line chart', 'Add a title attribute');
      var table = a11y.chartTableHtml(this._chartName, this._data);
      this._hasTable = !!table;
      this._renderShadow('<div class="chart-wrap" part="wrap">' + this._buildSvg() + table + '</div>', CSS + a11y.SR_ONLY_CSS);
    }

    _measureText(text, fontSize) {
      if (!LWTLineChart._ctx) {
        LWTLineChart._ctx = this._genhtml({type: 'canvas'}).getContext('2d');
      }
      LWTLineChart._ctx.font = fontSize + 'px sans-serif';
      return LWTLineChart._ctx.measureText(String(text)).width;
    }

    _buildSvg() {
      var self = this;
      var data = this._data || {};
      var labels = data.labels || [];
      var datasets = data.datasets || [];

      var title = this._strAttr('title', '');
      var stacked = this._boolAttr('stacked');
      var defaultFill = this._boolAttr('fill');
      var defaultLineWidth = parseFloat(this._strAttr('line-width', '2'));
      if (isNaN(defaultLineWidth)) defaultLineWidth = 2;
      var defaultPointRadius = parseFloat(this._strAttr('point-radius', '3'));
      if (isNaN(defaultPointRadius)) defaultPointRadius = 3;
      var legendPos = this._strAttr('legend-position', 'top');
      var grid = this._strAttr('grid', 'horizontal');
      var xLabel = this._strAttr('x-label', '');
      var yLabel = this._strAttr('y-label', '');

      var series = datasets.map(function (ds, i) {
        var p = PALETTE[i % PALETTE.length];
        var fillOn = typeof ds.fill === 'boolean' ? ds.fill : defaultFill;
        return {
          label: ds.label || ('Series ' + (i + 1)),
          data: ds.data || [],
          line: ds.borderColor || p.stroke,
          area: ds.backgroundColor || hexToRgba(p.fill, 0.5),
          fillOn: fillOn,
          lineWidth: typeof ds.borderWidth === 'number' ? ds.borderWidth : defaultLineWidth,
          pointRadius: typeof ds.pointRadius === 'number' ? ds.pointRadius : defaultPointRadius
        };
      });

      var maxVal = 0;
      if (stacked) {
        labels.forEach(function (_, li) {
          var sum = 0;
          series.forEach(function (s) { sum += Number(s.data[li]) || 0; });
          if (sum > maxVal) maxVal = sum;
        });
      } else {
        series.forEach(function (s) {
          s.data.forEach(function (v) { v = Number(v) || 0; if (v > maxVal) maxVal = v; });
        });
      }
      var scale = computeScale(maxVal, 8);

      var maxTickW = 0;
      scale.ticks.forEach(function (t) { maxTickW = Math.max(maxTickW, self._measureText(t, 11)); });

      var legendItemWidths = series.map(function (s) { return 14 + 4 + self._measureText(s.label, 11) + 16; });
      var legendRowH = 22;
      var legendColW = (legendPos === 'left' || legendPos === 'right')
        ? Math.max.apply(null, legendItemWidths.concat([0])) + 10
        : 0;

      var VBW = 640, VBH = 400, PAD = 14;
      var titleH = title ? 30 : 0;

      var left = PAD + (yLabel ? 16 : 0) + maxTickW + 10 + (legendPos === 'left' ? legendColW : 0);
      var right = PAD + (legendPos === 'right' ? legendColW : 0);
      var top = PAD + titleH + (legendPos === 'top' ? legendRowH : 0);
      var bottom = PAD + 18 + (xLabel ? 18 : 0) + (legendPos === 'bottom' ? legendRowH : 0);

      var plotLeft = left, plotTop = top;
      var plotRight = VBW - right, plotBottom = VBH - bottom;
      var plotW = Math.max(10, plotRight - plotLeft);
      var plotH = Math.max(10, plotBottom - plotTop);

      var n = labels.length;
      function xPos(i) { return n > 1 ? plotLeft + (i / (n - 1)) * plotW : plotLeft + plotW / 2; }
      function valueToPx(v) { return scale.max > 0 ? (v / scale.max) * plotH : 0; }

      // ---- gridlines + ticks (value ticks horizontal, category ticks vertical) ----
      var gridSvg = '', tickSvg = '';
      scale.ticks.forEach(function (t) {
        var y = plotBottom - valueToPx(t);
        if (grid === 'both' || grid === 'horizontal') {
          gridSvg += '<line class="grid-line" x1="' + plotLeft + '" y1="' + y.toFixed(2) + '" x2="' + plotRight + '" y2="' + y.toFixed(2) + '"></line>';
        }
        tickSvg += '<text class="axis-text" x="' + (plotLeft - 8) + '" y="' + (y + 4).toFixed(2) + '" text-anchor="end">' + escapeXml(t) + '</text>';
      });
      labels.forEach(function (l, i) {
        var x = xPos(i);
        if (grid === 'both' || grid === 'vertical') {
          gridSvg += '<line class="grid-line" x1="' + x.toFixed(2) + '" y1="' + plotTop + '" x2="' + x.toFixed(2) + '" y2="' + plotBottom + '"></line>';
        }
        tickSvg += '<text class="axis-text" x="' + x.toFixed(2) + '" y="' + (plotBottom + 18) + '" text-anchor="middle">' + escapeXml(l) + '</text>';
      });

      var borderSvg = '<rect class="plot-border" x="' + plotLeft + '" y="' + plotTop + '" width="' + plotW.toFixed(2) + '" height="' + plotH.toFixed(2) + '" fill="none"></rect>';

      // ---- lines, fills, points ----
      var runningCum = labels.map(function () { return 0; });
      var seriesPoints = series.map(function (s) {
        var topPts = [], basePts = [];
        labels.forEach(function (l, li) {
          var v = Number(s.data[li]) || 0;
          var baseCum = stacked ? runningCum[li] : 0;
          var topCum = baseCum + v;
          var x = xPos(li);
          topPts.push({ x: x, y: plotBottom - valueToPx(topCum) });
          basePts.push({ x: x, y: plotBottom - valueToPx(baseCum) });
        });
        if (stacked) labels.forEach(function (l, li) { runningCum[li] += Number(s.data[li]) || 0; });
        return { top: topPts, base: basePts };
      });

      var fillsSvg = '';
      series.forEach(function (s, i) {
        if (!s.fillOn || n === 0) return;
        var d = areaPathD(seriesPoints[i].top, seriesPoints[i].base);
        fillsSvg += '<path d="' + d + '" fill="' + s.area + '" stroke="none"></path>';
      });

      var linesSvg = '';
      series.forEach(function (s, i) {
        if (n === 0) return;
        var pts = seriesPoints[i].top;
        linesSvg += '<path class="line" d="' + linePathD(pts) + '" stroke="' + s.line + '" stroke-width="' + s.lineWidth + '"></path>';
        if (s.pointRadius > 0) {
          pts.forEach(function (p) {
            linesSvg += '<circle cx="' + p.x.toFixed(2) + '" cy="' + p.y.toFixed(2) + '" r="' + s.pointRadius + '" fill="' + s.line + '"></circle>';
          });
        }
      });

      // ---- legend (per dataset, like lwtd-bar-chart) ----
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
      var xLabelSvg = xLabel ? '<text class="axis-title" x="' + ((plotLeft + plotRight) / 2) + '" y="' + (VBH - PAD) + '" text-anchor="middle">' + escapeXml(xLabel) + '</text>' : '';
      var yLabelSvg = yLabel
        ? '<text class="axis-title" x="0" y="0" text-anchor="middle" transform="translate(' + (PAD + 10) + ',' + ((plotTop + plotBottom) / 2) + ') rotate(-90)">' + escapeXml(yLabel) + '</text>'
        : '';

      return '<svg viewBox="0 0 ' + VBW + ' ' + VBH + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + escapeXml((this._chartName || title || 'Line chart') + (this._hasTable ? ', data table follows' : ', no data')) + '">' +
        titleSvg + legendSvg + gridSvg + borderSvg + fillsSvg + linesSvg + tickSvg + xLabelSvg + yLabelSvg +
        '</svg>';
    }
  }

  window.LWT.define('lwtd-line-chart', LWTLineChart);
})();
