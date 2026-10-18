/*!
 * LWT Dashboard Elements
 * Developer: Lee W Winter
 * Last Generated: 2026-10-18T17:11:34.803Z
 * Requires lwt-core.js to be loaded first.
 */

/* ---- lwt-dsh-bar-chart.js ---- */
/*!
 * <lwtd-bar-chart>
 * A bar chart rendered as inline SVG, redrawn from scratch whenever data
 * or a style attribute changes (cheap enough — this isn't a per-frame
 * drag interaction like lwtf-color-picker, so a full rebuild each time is
 * the simplest correct approach).
 *
 * Data comes from JavaScript, not attributes — mirroring the shape of a
 * Chart.js config's `data` object:
 *
 *   var chart = document.querySelector('lwtd-bar-chart');
 *   chart.data = {
 *     labels: ['Q1', 'Q2', 'Q3', 'Q4'],
 *     datasets: [
 *       { label: 'Online',   data: [42, 58, 63, 71] },
 *       { label: 'In-Store', data: [65, 53, 48, 52], backgroundColor: '#f9a8d4', borderColor: '#ec4899' },
 *       { label: 'Wholesale', data: [28, 32, 35, 40] }
 *     ]
 *   };
 *
 * Colors: any dataset can set `backgroundColor`/`borderColor` (same field
 * names Chart.js uses) to override; everything else cycles through a
 * built-in pastel palette automatically.
 *
 * Target line(s): a dashed reference line with a label, e.g. a goal or
 * threshold. Set on `data`, not as an attribute (it's tied to the value
 * scale, same reasoning as datasets):
 *
 *   chart.data = {
 *     labels: [...], datasets: [...],
 *     targetLine: { label: 'Target', value: 65 }
 *   };
 *
 * For more than one, use `targetLines: [{ label, value, color }, ...]`
 * instead (or alongside `targetLine` — both are merged). `color` is
 * optional per line; omit it and it falls back to
 * --lwt-chart-target-color. The value axis auto-extends to fit the
 * highest target line even if it's above the tallest bar.
 *
 * Style attributes (all re-render on change):
 *   title            — chart title text
 *   orientation      — "vertical" (default) | "horizontal"
 *   stacked          — boolean; stacks datasets instead of grouping them
 *   legend-position  — "top" (default) | "bottom" | "left" | "right" | "none"
 *   grid             — "both" (default) | "horizontal" | "vertical" | "none"
 *   x-label          — category axis title
 *   y-label          — value axis title
 *
 * Known scope limits: no tooltips/hover interactivity, no value labels
 * drawn on bars, no negative values, legend text isn't wrapped (assumes
 * it fits on one row for top/bottom), long category labels aren't
 * rotated. All fixable later, just not included in this first version.
 *
 * Theming: --lwt-chart-bg (default transparent — inherits its container
 * like the rest of the library), --lwt-chart-grid, --lwt-chart-border,
 * --lwt-chart-tick-color, --lwt-chart-label-color, --lwt-chart-title-color,
 * --lwt-chart-legend-color, --lwt-chart-target-color (default #ef4444),
 * --lwt-chart-aspect-ratio (default 8/5).
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-dsh-bar-chart.js requires lwt-core.js to be loaded first.');
  }

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


  // Classic "nice numbers for graph labels" algorithm (Heckbert).
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
    for (var v = 0; v <= niceMax + step / 2; v += step) {
      ticks.push(Math.round(v * 1000) / 1000);
    }
    return { max: niceMax, step: step, ticks: ticks };
  }

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function rectSvg(x, y, w, h, fill, stroke) {
    w = Math.max(0, w);
    h = Math.max(0, h);
    return '<rect x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + w.toFixed(2) + '" height="' + h.toFixed(2) +
      '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5" rx="2"></rect>';
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
    .target-line { stroke-width: 2; stroke-dasharray: 6 4; }
    .target-text { font-size: 11px; font-weight: 600; }
  `;

  class LWTBarChart extends window.LWT.Element {
    static get observedAttributes() {
      return ['title', 'orientation', 'stacked', 'legend-position', 'grid', 'x-label', 'y-label'];
    }

    static get observedProps() {
      return ['data'];
    }

    constructor() {
      super();
      this._data = null;
    }

    get data() {
      return this._data;
    }

    set data(value) {
      this._data = value;
      if (this._root) this.render();
    }

    render() {
      // Charts are images: name the SVG, and add a screen-reader-only
      // data table with the same numbers (WCAG 1.1.1 / 1.3.1).
      var a11y = window.LWT.a11y;
      this._chartName = this._a11yName([this._strAttr('title', '')], 'Bar chart', 'Add a title attribute');
      var table = a11y.chartTableHtml(this._chartName, this._data);
      this._hasTable = !!table;
      this._renderShadow('<div class="chart-wrap" part="wrap">' + this._buildSvg() + table + '</div>', CSS + a11y.SR_ONLY_CSS);
    }

    _measureText(text, fontSize) {
      if (!LWTBarChart._ctx) {
        LWTBarChart._ctx = this._genhtml({ type: 'canvas' }).getContext('2d');
      }
      LWTBarChart._ctx.font = fontSize + 'px sans-serif';
      return LWTBarChart._ctx.measureText(String(text)).width;
    }

    _buildSvg() {
      var self = this;
      var data = this._data || {};
      var labels = data.labels || [];
      var datasets = data.datasets || [];

      var title = this._strAttr('title', '');
      var horizontal = this._strAttr('orientation', 'vertical') === 'horizontal';
      var stacked = this._boolAttr('stacked');
      var legendPos = this._strAttr('legend-position', 'top');
      var grid = this._strAttr('grid', 'both');
      var xLabel = this._strAttr('x-label', '');
      var yLabel = this._strAttr('y-label', '');

      var colors = datasets.map(function (ds, i) {
        var p = PALETTE[i % PALETTE.length];
        return { fill: ds.backgroundColor || p.fill, stroke: ds.borderColor || p.stroke };
      });

      var targetLines = [];
      if (data.targetLine) targetLines.push(data.targetLine);
      if (Array.isArray(data.targetLines)) targetLines = targetLines.concat(data.targetLines);

      var maxVal = 0;
      if (stacked) {
        labels.forEach(function (_, li) {
          var sum = 0;
          datasets.forEach(function (ds) { sum += Number(ds.data && ds.data[li]) || 0; });
          if (sum > maxVal) maxVal = sum;
        });
      } else {
        datasets.forEach(function (ds) {
          (ds.data || []).forEach(function (v) {
            v = Number(v) || 0;
            if (v > maxVal) maxVal = v;
          });
        });
      }
      targetLines.forEach(function (t) {
        var v = Number(t.value) || 0;
        if (v > maxVal) maxVal = v;
      });
      var scale = computeScale(maxVal, 8);

      var maxTickW = 0;
      scale.ticks.forEach(function (t) { maxTickW = Math.max(maxTickW, self._measureText(t, 11)); });
      var maxCategoryLabelW = 0;
      labels.forEach(function (l) { maxCategoryLabelW = Math.max(maxCategoryLabelW, self._measureText(l, 11)); });

      var legendItemWidths = datasets.map(function (ds, i) {
        return 14 + 4 + self._measureText(ds.label || ('Series ' + (i + 1)), 11) + 16;
      });
      var legendRowH = 22;
      var legendColW = (legendPos === 'left' || legendPos === 'right')
        ? Math.max.apply(null, legendItemWidths.concat([0])) + 10
        : 0;

      var VBW = 640, VBH = 400, PAD = 14;
      var titleH = title ? 30 : 0;

      var left = PAD + (yLabel ? 16 : 0) + (horizontal ? maxCategoryLabelW : maxTickW) + 10 + (legendPos === 'left' ? legendColW : 0);
      var right = PAD + (legendPos === 'right' ? legendColW : 0);
      var top = PAD + titleH + (legendPos === 'top' ? legendRowH : 0);
      var bottom = PAD + 18 + (xLabel ? 18 : 0) + (legendPos === 'bottom' ? legendRowH : 0);

      var plotLeft = left, plotTop = top;
      var plotRight = VBW - right, plotBottom = VBH - bottom;
      var plotW = Math.max(10, plotRight - plotLeft);
      var plotH = Math.max(10, plotBottom - plotTop);

      var n = labels.length;
      var bandLen = n > 0 ? (horizontal ? plotH : plotW) / n : 0;
      var innerBand = bandLen * 0.8;
      var bandPad = bandLen * 0.1;

      function valueToPx(v) {
        return scale.max > 0 ? (v / scale.max) * (horizontal ? plotW : plotH) : 0;
      }

      // ---- bars ----
      var barsSvg = '';
      var numDs = datasets.length;
      for (var li = 0; li < n; li++) {
        if (!horizontal) {
          if (stacked) {
            var xPos = plotLeft + bandLen * li + bandPad;
            var cum = 0;
            for (var di = 0; di < numDs; di++) {
              var v = Number(datasets[di].data && datasets[di].data[li]) || 0;
              var segH = valueToPx(v);
              var y = plotBottom - valueToPx(cum) - segH;
              barsSvg += rectSvg(xPos, y, innerBand, segH, colors[di].fill, colors[di].stroke);
              cum += v;
            }
          } else {
            var subW = numDs > 0 ? innerBand / numDs : innerBand;
            for (var di2 = 0; di2 < numDs; di2++) {
              var v2 = Number(datasets[di2].data && datasets[di2].data[li]) || 0;
              var h2 = valueToPx(v2);
              var x2 = plotLeft + bandLen * li + bandPad + subW * di2;
              barsSvg += rectSvg(x2, plotBottom - h2, subW, h2, colors[di2].fill, colors[di2].stroke);
            }
          }
        } else {
          if (stacked) {
            var yPos = plotTop + bandLen * li + bandPad;
            var cumH = 0;
            for (var di3 = 0; di3 < numDs; di3++) {
              var v3 = Number(datasets[di3].data && datasets[di3].data[li]) || 0;
              var segW = valueToPx(v3);
              var x3 = plotLeft + valueToPx(cumH);
              barsSvg += rectSvg(x3, yPos, segW, innerBand, colors[di3].fill, colors[di3].stroke);
              cumH += v3;
            }
          } else {
            var subH = numDs > 0 ? innerBand / numDs : innerBand;
            for (var di4 = 0; di4 < numDs; di4++) {
              var v4 = Number(datasets[di4].data && datasets[di4].data[li]) || 0;
              var w4 = valueToPx(v4);
              var y4 = plotTop + bandLen * li + bandPad + subH * di4;
              barsSvg += rectSvg(plotLeft, y4, w4, subH, colors[di4].fill, colors[di4].stroke);
            }
          }
        }
      }

      // ---- gridlines + ticks ----
      var gridSvg = '', tickSvg = '';
      if (!horizontal) {
        scale.ticks.forEach(function (t) {
          var y = plotBottom - valueToPx(t);
          if (grid === 'both' || grid === 'horizontal') {
            gridSvg += '<line class="grid-line" x1="' + plotLeft + '" y1="' + y.toFixed(2) + '" x2="' + plotRight + '" y2="' + y.toFixed(2) + '"></line>';
          }
          tickSvg += '<text class="axis-text" x="' + (plotLeft - 8) + '" y="' + (y + 4).toFixed(2) + '" text-anchor="end">' + escapeXml(t) + '</text>';
        });
        labels.forEach(function (l, i) {
          var x = plotLeft + bandLen * (i + 0.5);
          tickSvg += '<text class="axis-text" x="' + x.toFixed(2) + '" y="' + (plotBottom + 18) + '" text-anchor="middle">' + escapeXml(l) + '</text>';
        });
        if (grid === 'both' || grid === 'vertical') {
          for (var bi = 1; bi < n; bi++) {
            var xb = plotLeft + bandLen * bi;
            gridSvg += '<line class="grid-line" x1="' + xb.toFixed(2) + '" y1="' + plotTop + '" x2="' + xb.toFixed(2) + '" y2="' + plotBottom + '"></line>';
          }
        }
      } else {
        scale.ticks.forEach(function (t) {
          var x = plotLeft + valueToPx(t);
          if (grid === 'both' || grid === 'vertical') {
            gridSvg += '<line class="grid-line" x1="' + x.toFixed(2) + '" y1="' + plotTop + '" x2="' + x.toFixed(2) + '" y2="' + plotBottom + '"></line>';
          }
          tickSvg += '<text class="axis-text" x="' + x.toFixed(2) + '" y="' + (plotBottom + 18) + '" text-anchor="middle">' + escapeXml(t) + '</text>';
        });
        labels.forEach(function (l, i) {
          var y = plotTop + bandLen * (i + 0.5);
          tickSvg += '<text class="axis-text" x="' + (plotLeft - 8) + '" y="' + (y + 4).toFixed(2) + '" text-anchor="end">' + escapeXml(l) + '</text>';
        });
        if (grid === 'both' || grid === 'horizontal') {
          for (var bi2 = 1; bi2 < n; bi2++) {
            var yb = plotTop + bandLen * bi2;
            gridSvg += '<line class="grid-line" x1="' + plotLeft + '" y1="' + yb.toFixed(2) + '" x2="' + plotRight + '" y2="' + yb.toFixed(2) + '"></line>';
          }
        }
      }

      var borderSvg = '<rect class="plot-border" x="' + plotLeft + '" y="' + plotTop + '" width="' + plotW.toFixed(2) + '" height="' + plotH.toFixed(2) + '" fill="none"></rect>';

      // ---- target line(s) ----
      var targetSvg = '';
      targetLines.forEach(function (t) {
        var val = Number(t.value) || 0;
        var label = t.label || '';
        var colorStyle = 'stroke: ' + (t.color || 'var(--lwt-chart-target-color, var(--lwt-color-danger, #ef4444))') + ';';
        if (!horizontal) {
          var y = plotBottom - valueToPx(val);
          targetSvg += '<line class="target-line" x1="' + plotLeft + '" y1="' + y.toFixed(2) + '" x2="' + plotRight + '" y2="' + y.toFixed(2) + '" style="' + colorStyle + '"></line>';
          if (label) {
            targetSvg += '<text class="target-text" x="' + (plotRight - 4) + '" y="' + (y - 4).toFixed(2) + '" text-anchor="end" style="fill: ' + (t.color || 'var(--lwt-chart-target-color, var(--lwt-color-danger, #ef4444))') + ';">' + escapeXml(label) + '</text>';
          }
        } else {
          var x = plotLeft + valueToPx(val);
          targetSvg += '<line class="target-line" x1="' + x.toFixed(2) + '" y1="' + plotTop + '" x2="' + x.toFixed(2) + '" y2="' + plotBottom + '" style="' + colorStyle + '"></line>';
          if (label) {
            targetSvg += '<text class="target-text" x="' + (x + 4).toFixed(2) + '" y="' + (plotTop + 12) + '" text-anchor="start" style="fill: ' + (t.color || 'var(--lwt-chart-target-color, var(--lwt-color-danger, #ef4444))') + ';">' + escapeXml(label) + '</text>';
          }
        }
      });

      // ---- legend ----
      var legendSvg = '';
      if (legendPos !== 'none' && datasets.length) {
        if (legendPos === 'top' || legendPos === 'bottom') {
          var legendY = legendPos === 'top' ? (PAD + titleH + 14) : (VBH - PAD - 8);
          var totalW = legendItemWidths.reduce(function (a, b) { return a + b; }, 0);
          var lx = (VBW - totalW) / 2;
          datasets.forEach(function (ds, i) {
            legendSvg += rectSvg(lx, legendY - 10, 12, 12, colors[i].fill, colors[i].stroke);
            legendSvg += '<text class="legend-text" x="' + (lx + 18).toFixed(2) + '" y="' + legendY.toFixed(2) + '">' + escapeXml(ds.label || ('Series ' + (i + 1))) + '</text>';
            lx += legendItemWidths[i];
          });
        } else {
          var colX = legendPos === 'left' ? PAD : (VBW - PAD - legendColW + 10);
          var startY = plotTop + 10;
          datasets.forEach(function (ds, i) {
            var iy = startY + i * legendRowH;
            legendSvg += rectSvg(colX, iy - 10, 12, 12, colors[i].fill, colors[i].stroke);
            legendSvg += '<text class="legend-text" x="' + (colX + 18).toFixed(2) + '" y="' + iy.toFixed(2) + '">' + escapeXml(ds.label || ('Series ' + (i + 1))) + '</text>';
          });
        }
      }

      var titleSvg = title ? '<text class="chart-title" x="' + (VBW / 2) + '" y="' + (PAD + 20) + '" text-anchor="middle">' + escapeXml(title) + '</text>' : '';
      var xLabelSvg = xLabel ? '<text class="axis-title" x="' + ((plotLeft + plotRight) / 2) + '" y="' + (VBH - PAD) + '" text-anchor="middle">' + escapeXml(xLabel) + '</text>' : '';
      var yLabelSvg = yLabel
        ? '<text class="axis-title" x="0" y="0" text-anchor="middle" transform="translate(' + (PAD + 10) + ',' + ((plotTop + plotBottom) / 2) + ') rotate(-90)">' + escapeXml(yLabel) + '</text>'
        : '';

      return '<svg viewBox="0 0 ' + VBW + ' ' + VBH + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + escapeXml((this._chartName || title || 'Bar chart') + (this._hasTable ? ', data table follows' : ', no data')) + '">' +
        titleSvg + legendSvg + gridSvg + borderSvg + barsSvg + targetSvg + tickSvg + xLabelSvg + yLabelSvg +
        '</svg>';
    }
  }

  window.LWT.define('lwtd-bar-chart', LWTBarChart);
})();

/* ---- lwt-dsh-bubble-chart.js ---- */
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
    { fill: '#b8f3e0', stroke: '#2ec4b6' }, // mint aqua
    { fill: '#ffd6e8', stroke: '#ff5c8a' }, // candy rose
    { fill: '#fef7c3', stroke: '#f2c94c' }, // soft gold
    { fill: '#e3d7ff', stroke: '#9b5de5' }, // lavender purple
    { fill: '#d9f2ff', stroke: '#4ea8de' }, // ice blue
    { fill: '#ffe8cc', stroke: '#ff7f11' }, // warm apricot
    { fill: '#c9f7d4', stroke: '#34c759' }, // fresh green
    { fill: '#ffe4f2', stroke: '#ff2e63' }  // neon pink
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
    .bubble { stroke-width: 1.5; }
  `;

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

/* ---- lwt-dsh-doughnut-chart.js ---- */
/*!
 * <lwtd-doughnut-chart>
 * Same as lwtd-pie-chart (data shape, colors, legend) with one addition:
 * an `inner-radius` attribute cutting a hole out of the middle.
 *
 *   chart.data = {
 *     labels: ['Online', 'In-Store', 'Wholesale'],
 *     datasets: [{ data: [163, 218, 135] }]
 *   };
 *
 * This file is deliberately self-contained rather than extending
 * lwt-dsh-pie-chart.js — every other element in this library only depends on
 * lwt-core.js, load order between element files doesn't matter otherwise,
 * and the dynamic-bundle build (`cat lwt-core.js lwt-*.js`) relies on
 * that. Making this extend the pie chart class would mean lwt-dsh-pie-chart.js
 * has to load first, which silently breaks that assumption (and even
 * breaks alphabetically — "doughnut" sorts before "pie"). Small amount of
 * duplicated slice/legend math instead.
 *
 * Attributes:
 *   title            — chart title text
 *   legend-position  — "right" (default) | "top" | "bottom" | "left" | "none"
 *   inner-radius     — 0-100, percentage of the outer radius the hole
 *                      occupies (default 60). 0 behaves like a pie chart;
 *                      higher values make a thinner ring.
 *
 * Known scope limits: no slice value/percentage labels, no hover/click
 * interactivity, no exploded slices, legend text isn't wrapped, no text
 * rendered in the center hole.
 *
 * Theming: --lwt-chart-bg (default transparent), --lwt-chart-border,
 * --lwt-chart-title-color, --lwt-chart-legend-color, --lwt-chart-empty,
 * --lwt-chart-aspect-ratio (default 8/5).
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-dsh-doughnut-chart.js requires lwt-core.js to be loaded first.');
  }

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

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function polarToCartesian(cx, cy, r, angle) {
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  function slicePath(cx, cy, outerR, innerR, startAngle, endAngle) {
    var full = Math.PI * 2;
    if (endAngle - startAngle >= full - 0.0001) endAngle = startAngle + full - 0.0001;
    var outerStart = polarToCartesian(cx, cy, outerR, startAngle);
    var outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
    var largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;

    if (innerR <= 0) {
      return 'M ' + cx.toFixed(2) + ' ' + cy.toFixed(2) +
        ' L ' + outerStart.x.toFixed(2) + ' ' + outerStart.y.toFixed(2) +
        ' A ' + outerR.toFixed(2) + ' ' + outerR.toFixed(2) + ' 0 ' + largeArc + ' 1 ' + outerEnd.x.toFixed(2) + ' ' + outerEnd.y.toFixed(2) +
        ' Z';
    }
    var innerStart = polarToCartesian(cx, cy, innerR, startAngle);
    var innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
    return 'M ' + outerStart.x.toFixed(2) + ' ' + outerStart.y.toFixed(2) +
      ' A ' + outerR.toFixed(2) + ' ' + outerR.toFixed(2) + ' 0 ' + largeArc + ' 1 ' + outerEnd.x.toFixed(2) + ' ' + outerEnd.y.toFixed(2) +
      ' L ' + innerEnd.x.toFixed(2) + ' ' + innerEnd.y.toFixed(2) +
      ' A ' + innerR.toFixed(2) + ' ' + innerR.toFixed(2) + ' 0 ' + largeArc + ' 0 ' + innerStart.x.toFixed(2) + ' ' + innerStart.y.toFixed(2) +
      ' Z';
  }

  function sliceColor(dataset, index) {
    var p = PALETTE[index % PALETTE.length];
    var fill = p.fill, stroke = p.stroke;
    if (dataset) {
      if (Array.isArray(dataset.backgroundColor)) { if (dataset.backgroundColor[index]) fill = dataset.backgroundColor[index]; }
      else if (dataset.backgroundColor) fill = dataset.backgroundColor;
      if (Array.isArray(dataset.borderColor)) { if (dataset.borderColor[index]) stroke = dataset.borderColor[index]; }
      else if (dataset.borderColor) stroke = dataset.borderColor;
    }
    return { fill: fill, stroke: stroke };
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
    .slice { stroke-width: 1.5; }
    .chart-title {
      fill: var(--lwt-chart-title-color, var(--lwt-color-text-strong, #1f2937));
      font-size: 15px;
      font-weight: 700;
    }
    .legend-text { fill: var(--lwt-chart-legend-color, var(--lwt-color-text, #374151)); font-size: 11px; }
  `;

  class LWTDoughnutChart extends window.LWT.Element {
    static get observedAttributes() {
      return ['title', 'legend-position', 'inner-radius'];
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
      this._chartName = this._a11yName([this._strAttr('title', '')], 'Doughnut chart', 'Add a title attribute');
      var table = a11y.chartTableHtml(this._chartName, this._data);
      this._hasTable = !!table;
      this._renderShadow('<div class="chart-wrap" part="wrap">' + this._buildSvg() + table + '</div>', CSS + a11y.SR_ONLY_CSS);
    }

    _measureText(text, fontSize) {
      if (!LWTDoughnutChart._ctx) {
        LWTDoughnutChart._ctx = this._genhtml({type: 'canvas'}).getContext('2d');
      }
      LWTDoughnutChart._ctx.font = fontSize + 'px sans-serif';
      return LWTDoughnutChart._ctx.measureText(String(text)).width;
    }

    _buildSvg() {
      var self = this;
      var data = this._data || {};
      var labels = data.labels || [];
      var dataset = (data.datasets && data.datasets[0]) || null;
      var values = (dataset && dataset.data) || [];

      var title = this._strAttr('title', '');
      var legendPos = this._strAttr('legend-position', 'right');
      var innerRadiusPct = clamp(parseFloat(this._strAttr('inner-radius', '60')) || 0, 0, 95);

      var colors = labels.map(function (_, i) { return sliceColor(dataset, i); });

      var total = 0;
      values.forEach(function (v) { total += Number(v) || 0; });

      var legendItemWidths = labels.map(function (l) {
        return 14 + 4 + self._measureText(l, 11) + 16;
      });
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
      var outerR = Math.min(plotW, plotH) / 2 * 0.85;
      var innerR = outerR * (innerRadiusPct / 100);

      var slicesSvg = '';
      if (total > 0) {
        var angle = -Math.PI / 2;
        labels.forEach(function (l, i) {
          var v = Number(values[i]) || 0;
          if (v <= 0) return;
          var sweep = (v / total) * Math.PI * 2;
          var path = slicePath(cx, cy, outerR, innerR, angle, angle + sweep);
          slicesSvg += '<path class="slice" d="' + path + '" fill="' + colors[i].fill + '" stroke="' + colors[i].stroke + '"></path>';
          angle += sweep;
        });
      } else {
        slicesSvg = '<circle cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="' + outerR.toFixed(2) +
          '" fill="var(--lwt-chart-empty, var(--lwt-color-surface-muted, #f3f4f6))" stroke="var(--lwt-chart-border, var(--lwt-border-color, #e5e7eb))"></circle>';
        if (innerR > 0) {
          slicesSvg += '<circle cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="' + innerR.toFixed(2) +
            '" fill="var(--lwt-chart-bg, var(--lwt-color-surface, #fff))"></circle>';
        }
      }

      var legendSvg = '';
      if (legendPos !== 'none' && labels.length) {
        if (legendPos === 'top' || legendPos === 'bottom') {
          var legendY = legendPos === 'top' ? (PAD + titleH + 14) : (VBH - PAD - 8);
          var totalW = legendItemWidths.reduce(function (a, b) { return a + b; }, 0);
          var lx = (VBW - totalW) / 2;
          labels.forEach(function (l, i) {
            legendSvg += '<rect x="' + lx.toFixed(2) + '" y="' + (legendY - 10).toFixed(2) + '" width="12" height="12" rx="2" fill="' + colors[i].fill + '" stroke="' + colors[i].stroke + '"></rect>';
            legendSvg += '<text class="legend-text" x="' + (lx + 18).toFixed(2) + '" y="' + legendY.toFixed(2) + '">' + escapeXml(l) + '</text>';
            lx += legendItemWidths[i];
          });
        } else {
          var colX = legendPos === 'left' ? PAD : (VBW - PAD - legendColW + 10);
          var startY = plotTop + plotH / 2 - (labels.length - 1) * legendRowH / 2;
          labels.forEach(function (l, i) {
            var iy = startY + i * legendRowH;
            legendSvg += '<rect x="' + colX.toFixed(2) + '" y="' + (iy - 10).toFixed(2) + '" width="12" height="12" rx="2" fill="' + colors[i].fill + '" stroke="' + colors[i].stroke + '"></rect>';
            legendSvg += '<text class="legend-text" x="' + (colX + 18).toFixed(2) + '" y="' + iy.toFixed(2) + '">' + escapeXml(l) + '</text>';
          });
        }
      }

      var titleSvg = title ? '<text class="chart-title" x="' + (VBW / 2) + '" y="' + (PAD + 20) + '" text-anchor="middle">' + escapeXml(title) + '</text>' : '';

      return '<svg viewBox="0 0 ' + VBW + ' ' + VBH + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + escapeXml((this._chartName || title || 'Doughnut chart') + (this._hasTable ? ', data table follows' : ', no data')) + '">' +
        titleSvg + slicesSvg + legendSvg +
        '</svg>';
    }
  }

  window.LWT.define('lwtd-doughnut-chart', LWTDoughnutChart);
})();

/* ---- lwt-dsh-gauge.js ---- */
/*!
 * <lwtd-gauge>
 * A circular gauge/meter: one value against a min-max range, drawn as a
 * partial-circle progress arc (270° sweep by default, gap at the bottom —
 * the classic speedometer silhouette) rather than a needle-and-dial. That
 * reads as "gauge" in most modern dashboards without the complexity of
 * needle-rotation rendering; see the scope note below if you need a
 * literal needle.
 *
 *   <lwtd-gauge title="CPU Load" value="72" min="0" max="100" unit="%" label="current"></lwtd-gauge>
 *
 * Simple values (value/min/max/label/unit/color/thickness/sweep/title)
 * are attributes, same reasoning as lwtd-stat-card. Threshold zones — the
 * colored red/yellow/green bands on a real speedometer — are structured
 * data, so they go through the `.data` property like the other charts:
 *
 *   gauge.data = {
 *     zones: [
 *       { from: 0, to: 50, color: '#22c55e' },
 *       { from: 50, to: 80, color: '#f59e0b' },
 *       { from: 80, to: 100, color: '#ef4444' }
 *     ]
 *   };
 *
 * Without zones, the track is a plain grey ring and the progress arc (0
 * to the current value) is drawn in `color`, or the built-in blue if
 * `color` isn't set. With zones, the ring shows the colored bands instead
 * of a plain progress arc, and a small circular indicator marks exactly
 * where the current value sits — this avoids painting a same-colored
 * progress arc directly on top of already-colored zones, which would
 * just look like a thicker zone rather than a distinct reading.
 *
 * `value` is displayed verbatim as typed (with `unit` appended) — same
 * "you control the exact text" approach as lwtd-stat-card, no built-in
 * number formatting or decimal rounding.
 *
 * Attributes:
 *   title      — small title above the gauge
 *   value      — current value (also the displayed number)
 *   min        — range minimum (default 0)
 *   max        — range maximum (default 100)
 *   label      — small caption under the value, inside the ring
 *   unit       — suffix appended to the displayed value, e.g. "%"
 *   color      — explicit arc color, overrides zone matching entirely
 *   thickness  — ring stroke width in px (default 24)
 *   sweep      — degrees of arc the gauge spans, gap centered at the
 *                bottom (default 270 — three-quarter circle; 180 gives
 *                the half-donut style)
 *
 * Known scope limits: no needle/pointer rendering, no animated
 * transitions between values, value isn't clamped to min/max for display
 * (only for the arc's position — an out-of-range value still shows its
 * literal text but the arc caps visually at 0% or 100%).
 *
 * Theming: --lwt-gauge-bg (default transparent), --lwt-gauge-track-color,
 * --lwt-gauge-color (default blue, used when no zones/no explicit color),
 * --lwt-gauge-value-color, --lwt-gauge-label-color, --lwt-gauge-tick-color,
 * --lwt-gauge-title-color, --lwt-gauge-aspect-ratio (default 1/1).
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-dsh-gauge.js requires lwt-core.js to be loaded first.');
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function polarToCartesian(cx, cy, r, angleDeg) {
    var rad = angleDeg * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  // Angles: 0deg = right, 90deg = down, 180deg = left, 270deg = up
  // (standard SVG y-down convention). Arcs always sweep clockwise from
  // startDeg to endDeg, endDeg > startDeg.
  function describeArc(cx, cy, r, startDeg, endDeg) {
    var start = polarToCartesian(cx, cy, r, startDeg);
    var end = polarToCartesian(cx, cy, r, endDeg);
    var largeArc = (endDeg - startDeg) <= 180 ? 0 : 1;
    return 'M ' + start.x.toFixed(2) + ' ' + start.y.toFixed(2) +
      ' A ' + r.toFixed(2) + ' ' + r.toFixed(2) + ' 0 ' + largeArc + ' 1 ' + end.x.toFixed(2) + ' ' + end.y.toFixed(2);
  }

  var CSS = `
    :host {
      display: block;
      width: 100%;
      aspect-ratio: var(--lwt-gauge-aspect-ratio, 1 / 1);
      font-family: inherit;
      background: var(--lwt-gauge-bg, transparent);
    }
    .chart-wrap, svg { display: block; width: 100%; height: 100%; }
    .track { fill: none; stroke: var(--lwt-gauge-track-color, var(--lwt-border-color, #e5e7eb)); }
    .tick-text { fill: var(--lwt-gauge-tick-color, var(--lwt-color-text-muted, #6b7280)); font-size: 12px; }
    .value-text {
      fill: var(--lwt-gauge-value-color, var(--lwt-color-text-strong, #111827));
      font-size: 34px;
      font-weight: 700;
    }
    .label-text { fill: var(--lwt-gauge-label-color, var(--lwt-color-text-muted, #6b7280)); font-size: 13px; }
    .title-text {
      fill: var(--lwt-gauge-title-color, var(--lwt-color-text-strong, #1f2937));
      font-size: 15px;
      font-weight: 700;
    }
  `;

  class LWTGauge extends window.LWT.Element {
    static get observedAttributes() {
      return ['title', 'value', 'min', 'max', 'label', 'unit', 'color', 'thickness', 'sweep'];
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
      this._renderShadow('<div class="chart-wrap" part="wrap">' + this._buildSvg() + '</div>', CSS);
    }

    _buildSvg() {
      var title = this._strAttr('title', '');
      var displayValue = this._strAttr('value', '0');
      var numericValue = parseFloat(displayValue) || 0;
      var min = parseFloat(this._strAttr('min', '0')) || 0;
      var max = parseFloat(this._strAttr('max', '100'));
      if (isNaN(max) || max <= min) max = min + 100;
      var label = this._strAttr('label', '');
      var unit = this._strAttr('unit', '');
      var explicitColor = this._strAttr('color', '');
      var thickness = parseFloat(this._strAttr('thickness', '24'));
      if (isNaN(thickness) || thickness <= 0) thickness = 24;
      var sweep = parseFloat(this._strAttr('sweep', '270'));
      if (isNaN(sweep) || sweep <= 0) sweep = 270;
      sweep = Math.min(sweep, 359.99);

      var zones = (this._data && Array.isArray(this._data.zones)) ? this._data.zones : [];

      var VBW = 300, VBH = 300, PAD = 20;
      var titleH = title ? 26 : 0;
      var top = PAD + titleH;
      var side = Math.max(40, Math.min(VBW - 2 * PAD, VBH - top - PAD));
      var cx = VBW / 2;
      var cy = top + side / 2;
      var outerR = Math.max(20, side / 2 - 30);
      var ringR = outerR - thickness / 2;

      var gapHalf = (360 - sweep) / 2;
      var startAngle = 90 + gapHalf;
      var endAngle = startAngle + sweep;

      var fraction = clamp((numericValue - min) / (max - min), 0, 1);
      var valueAngle = startAngle + sweep * fraction;

      // ---- resolve progress/indicator color ----
      var resolvedColor = explicitColor || null;
      if (!resolvedColor && zones.length) {
        for (var i = 0; i < zones.length; i++) {
          var z = zones[i];
          if (numericValue >= z.from && numericValue <= z.to) { resolvedColor = z.color; break; }
        }
      }
      var colorStyle = resolvedColor ? resolvedColor : 'var(--lwt-gauge-color, var(--lwt-color-primary, #3b82f6))';

      // ---- track (plain, or colored zone segments) ----
      var trackSvg = '';
      if (zones.length) {
        zones.forEach(function (z) {
          var zFrom = clamp((z.from - min) / (max - min), 0, 1);
          var zTo = clamp((z.to - min) / (max - min), 0, 1);
          if (zTo <= zFrom) return;
          var a1 = startAngle + sweep * zFrom;
          var a2 = startAngle + sweep * zTo;
          trackSvg += '<path d="' + describeArc(cx, cy, ringR, a1, a2) + '" fill="none" style="stroke: ' + z.color + ';" stroke-width="' + thickness + '"></path>';
        });
      } else {
        trackSvg = '<path class="track" d="' + describeArc(cx, cy, ringR, startAngle, endAngle) + '" stroke-width="' + thickness + '"></path>';
      }

      // ---- progress arc (only in the no-zones case — see file header note) ----
      var progressSvg = '';
      if (!zones.length && fraction > 0) {
        progressSvg = '<path d="' + describeArc(cx, cy, ringR, startAngle, valueAngle) + '" fill="none" style="stroke: ' + colorStyle + ';" stroke-width="' + thickness + '" stroke-linecap="round"></path>';
      }

      // ---- indicator dot at the current value ----
      var p = polarToCartesian(cx, cy, ringR, valueAngle);
      var indicatorSvg =
        '<circle cx="' + p.x.toFixed(2) + '" cy="' + p.y.toFixed(2) + '" r="' + (thickness / 2 + 5) + '" fill="var(--lwt-gauge-bg, var(--lwt-color-surface, #fff))" style="stroke: ' + colorStyle + ';" stroke-width="2"></circle>' +
        '<circle cx="' + p.x.toFixed(2) + '" cy="' + p.y.toFixed(2) + '" r="' + (thickness / 2 - 2) + '" style="fill: ' + colorStyle + ';"></circle>';

      // ---- min/max tick labels at the arc ends ----
      var startPt = polarToCartesian(cx, cy, outerR + 16, startAngle);
      var endPt = polarToCartesian(cx, cy, outerR + 16, endAngle);
      function anchorFor(angleDeg) {
        var cos = Math.cos(angleDeg * Math.PI / 180);
        return cos > 0.3 ? 'start' : (cos < -0.3 ? 'end' : 'middle');
      }
      var tickSvg =
        '<text class="tick-text" x="' + startPt.x.toFixed(2) + '" y="' + (startPt.y + 4).toFixed(2) + '" text-anchor="' + anchorFor(startAngle) + '">' + escapeXml(min) + '</text>' +
        '<text class="tick-text" x="' + endPt.x.toFixed(2) + '" y="' + (endPt.y + 4).toFixed(2) + '" text-anchor="' + anchorFor(endAngle) + '">' + escapeXml(max) + '</text>';

      // ---- center value + label ----
      var valueY = label ? cy - 4 : cy + 8;
      var centerSvg = '<text class="value-text" x="' + cx + '" y="' + valueY.toFixed(2) + '" text-anchor="middle">' + escapeXml(displayValue + unit) + '</text>';
      if (label) {
        centerSvg += '<text class="label-text" x="' + cx + '" y="' + (valueY + 22).toFixed(2) + '" text-anchor="middle">' + escapeXml(label) + '</text>';
      }

      var titleSvg = title ? '<text class="title-text" x="' + (VBW / 2) + '" y="' + (PAD + 16) + '" text-anchor="middle">' + escapeXml(title) + '</text>' : '';

      return '<svg viewBox="0 0 ' + VBW + ' ' + VBH + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + escapeXml(this._a11yName([title, label], 'Gauge', 'Add a title or label attribute') +
        ': ' + displayValue + unit + ' (range ' + min + ' to ' + max + ')') + '">' +
        titleSvg + trackSvg + progressSvg + indicatorSvg + tickSvg + centerSvg +
        '</svg>';
    }
  }

  window.LWT.define('lwtd-gauge', LWTGauge);
})();

/* ---- lwt-dsh-line-chart.js ---- */
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
    { fill: '#b8f3e0', stroke: '#2ec4b6' }, // mint aqua
    { fill: '#ffd6e8', stroke: '#ff5c8a' }, // candy rose
    { fill: '#fef7c3', stroke: '#f2c94c' }, // soft gold
    { fill: '#e3d7ff', stroke: '#9b5de5' }, // lavender purple
    { fill: '#d9f2ff', stroke: '#4ea8de' }, // ice blue
    { fill: '#ffe8cc', stroke: '#ff7f11' }, // warm apricot
    { fill: '#c9f7d4', stroke: '#34c759' }, // fresh green
    { fill: '#ffe4f2', stroke: '#ff2e63' }  // neon pink
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

/* ---- lwt-dsh-pie-chart.js ---- */
/*!
 * <lwtd-pie-chart>
 * A pie chart rendered as inline SVG, same conventions as lwtd-bar-chart:
 * data comes from JS, redraws fully on every data/attribute change.
 *
 *   var chart = document.querySelector('lwtd-pie-chart');
 *   chart.data = {
 *     labels: ['Online', 'In-Store', 'Wholesale'],
 *     datasets: [
 *       { data: [163, 218, 135], backgroundColor: ['#93c5fd', '#f9a8d4', '#86efac'] }
 *     ]
 *   };
 *
 * Only the first dataset is used — pie/doughnut charts show one series
 * sliced by label, not several grouped/stacked series like a bar chart.
 * `backgroundColor`/`borderColor` on that dataset may be an array (one
 * color per slice, Chart.js-style) or a single string (applied to every
 * slice); omit either and colors cycle through the built-in palette
 * automatically, same as lwtd-bar-chart.
 *
 * Attributes:
 *   title            — chart title text
 *   legend-position  — "right" (default) | "top" | "bottom" | "left" | "none"
 *
 * Known scope limits: no slice value/percentage labels, no hover/click
 * interactivity, no exploded slices, legend text isn't wrapped.
 *
 * Theming: --lwt-chart-bg (default transparent), --lwt-chart-border,
 * --lwt-chart-title-color, --lwt-chart-legend-color, --lwt-chart-empty,
 * --lwt-chart-aspect-ratio (default 8/5).
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-dsh-pie-chart.js requires lwt-core.js to be loaded first.');
  }

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

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function polarToCartesian(cx, cy, r, angle) {
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  // Shared by lwtd-pie-chart and lwtd-doughnut-chart: pass innerR=0 for a
  // solid pie wedge, or >0 for an annulus (doughnut) segment.
  function slicePath(cx, cy, outerR, innerR, startAngle, endAngle) {
    var full = Math.PI * 2;
    if (endAngle - startAngle >= full - 0.0001) endAngle = startAngle + full - 0.0001;
    var outerStart = polarToCartesian(cx, cy, outerR, startAngle);
    var outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
    var largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;

    if (innerR <= 0) {
      return 'M ' + cx.toFixed(2) + ' ' + cy.toFixed(2) +
        ' L ' + outerStart.x.toFixed(2) + ' ' + outerStart.y.toFixed(2) +
        ' A ' + outerR.toFixed(2) + ' ' + outerR.toFixed(2) + ' 0 ' + largeArc + ' 1 ' + outerEnd.x.toFixed(2) + ' ' + outerEnd.y.toFixed(2) +
        ' Z';
    }
    var innerStart = polarToCartesian(cx, cy, innerR, startAngle);
    var innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
    return 'M ' + outerStart.x.toFixed(2) + ' ' + outerStart.y.toFixed(2) +
      ' A ' + outerR.toFixed(2) + ' ' + outerR.toFixed(2) + ' 0 ' + largeArc + ' 1 ' + outerEnd.x.toFixed(2) + ' ' + outerEnd.y.toFixed(2) +
      ' L ' + innerEnd.x.toFixed(2) + ' ' + innerEnd.y.toFixed(2) +
      ' A ' + innerR.toFixed(2) + ' ' + innerR.toFixed(2) + ' 0 ' + largeArc + ' 0 ' + innerStart.x.toFixed(2) + ' ' + innerStart.y.toFixed(2) +
      ' Z';
  }

  function sliceColor(dataset, index) {
    var p = PALETTE[index % PALETTE.length];
    var fill = p.fill, stroke = p.stroke;
    if (dataset) {
      if (Array.isArray(dataset.backgroundColor)) { if (dataset.backgroundColor[index]) fill = dataset.backgroundColor[index]; }
      else if (dataset.backgroundColor) fill = dataset.backgroundColor;
      if (Array.isArray(dataset.borderColor)) { if (dataset.borderColor[index]) stroke = dataset.borderColor[index]; }
      else if (dataset.borderColor) stroke = dataset.borderColor;
    }
    return { fill: fill, stroke: stroke };
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
    .slice { stroke-width: 1.5; }
    .chart-title {
      fill: var(--lwt-chart-title-color, var(--lwt-color-text-strong, #1f2937));
      font-size: 15px;
      font-weight: 700;
    }
    .legend-text { fill: var(--lwt-chart-legend-color, var(--lwt-color-text, #374151)); font-size: 11px; }
  `;

  class LWTPieChart extends window.LWT.Element {
    static get observedAttributes() {
      return ['title', 'legend-position'];
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
      this._chartName = this._a11yName([this._strAttr('title', '')], 'Pie chart', 'Add a title attribute');
      var table = a11y.chartTableHtml(this._chartName, this._data);
      this._hasTable = !!table;
      this._renderShadow('<div class="chart-wrap" part="wrap">' + this._buildSvg() + table + '</div>', CSS + a11y.SR_ONLY_CSS);
    }

    _measureText(text, fontSize) {
      if (!this.constructor._ctx) {
        this.constructor._ctx = this._genhtml({type: 'canvas'}).getContext('2d');
      }
      this.constructor._ctx.font = fontSize + 'px sans-serif';
      return this.constructor._ctx.measureText(String(text)).width;
    }

    // Always a solid wedge for the plain pie chart. lwt-dsh-doughnut-chart.js
    // is a separate, self-contained file with its own version of this
    // that returns a radius > 0 — see the note there on why it's not
    // implemented as a subclass of this file.
    _innerRadius(outerR) {
      return 0;
    }

    _buildSvg() {
      var self = this;
      var data = this._data || {};
      var labels = data.labels || [];
      var dataset = (data.datasets && data.datasets[0]) || null;
      var values = (dataset && dataset.data) || [];

      var title = this._strAttr('title', '');
      var legendPos = this._strAttr('legend-position', 'right');

      var colors = labels.map(function (_, i) { return sliceColor(dataset, i); });

      var total = 0;
      values.forEach(function (v) { total += Number(v) || 0; });

      var legendItemWidths = labels.map(function (l) {
        return 14 + 4 + self._measureText(l, 11) + 16;
      });
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
      var outerR = Math.min(plotW, plotH) / 2 * 0.85;
      var innerR = this._innerRadius(outerR);

      var slicesSvg = '';
      if (total > 0) {
        var angle = -Math.PI / 2;
        labels.forEach(function (l, i) {
          var v = Number(values[i]) || 0;
          if (v <= 0) return;
          var sweep = (v / total) * Math.PI * 2;
          var path = slicePath(cx, cy, outerR, innerR, angle, angle + sweep);
          slicesSvg += '<path class="slice" d="' + path + '" fill="' + colors[i].fill + '" stroke="' + colors[i].stroke + '"></path>';
          angle += sweep;
        });
      } else {
        slicesSvg = '<circle cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="' + outerR.toFixed(2) +
          '" fill="var(--lwt-chart-empty, var(--lwt-color-surface-muted, #f3f4f6))" stroke="var(--lwt-chart-border, var(--lwt-border-color, #e5e7eb))"></circle>';
        if (innerR > 0) {
          slicesSvg += '<circle cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="' + innerR.toFixed(2) +
            '" fill="var(--lwt-chart-bg, var(--lwt-color-surface, #fff))"></circle>';
        }
      }

      var legendSvg = '';
      if (legendPos !== 'none' && labels.length) {
        if (legendPos === 'top' || legendPos === 'bottom') {
          var legendY = legendPos === 'top' ? (PAD + titleH + 14) : (VBH - PAD - 8);
          var totalW = legendItemWidths.reduce(function (a, b) { return a + b; }, 0);
          var lx = (VBW - totalW) / 2;
          labels.forEach(function (l, i) {
            legendSvg += '<rect x="' + lx.toFixed(2) + '" y="' + (legendY - 10).toFixed(2) + '" width="12" height="12" rx="2" fill="' + colors[i].fill + '" stroke="' + colors[i].stroke + '"></rect>';
            legendSvg += '<text class="legend-text" x="' + (lx + 18).toFixed(2) + '" y="' + legendY.toFixed(2) + '">' + escapeXml(l) + '</text>';
            lx += legendItemWidths[i];
          });
        } else {
          var colX = legendPos === 'left' ? PAD : (VBW - PAD - legendColW + 10);
          var startY = plotTop + plotH / 2 - (labels.length - 1) * legendRowH / 2;
          labels.forEach(function (l, i) {
            var iy = startY + i * legendRowH;
            legendSvg += '<rect x="' + colX.toFixed(2) + '" y="' + (iy - 10).toFixed(2) + '" width="12" height="12" rx="2" fill="' + colors[i].fill + '" stroke="' + colors[i].stroke + '"></rect>';
            legendSvg += '<text class="legend-text" x="' + (colX + 18).toFixed(2) + '" y="' + iy.toFixed(2) + '">' + escapeXml(l) + '</text>';
          });
        }
      }

      var titleSvg = title ? '<text class="chart-title" x="' + (VBW / 2) + '" y="' + (PAD + 20) + '" text-anchor="middle">' + escapeXml(title) + '</text>' : '';

      return '<svg viewBox="0 0 ' + VBW + ' ' + VBH + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + escapeXml((this._chartName || title || 'Pie chart') + (this._hasTable ? ', data table follows' : ', no data')) + '">' +
        titleSvg + slicesSvg + legendSvg +
        '</svg>';
    }
  }

  window.LWT.define('lwtd-pie-chart', LWTPieChart);
})();

/* ---- lwt-dsh-radar-chart.js ---- */
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
    { fill: '#b8f3e0', stroke: '#2ec4b6' }, // mint aqua
    { fill: '#ffd6e8', stroke: '#ff5c8a' }, // candy rose
    { fill: '#fef7c3', stroke: '#f2c94c' }, // soft gold
    { fill: '#e3d7ff', stroke: '#9b5de5' }, // lavender purple
    { fill: '#d9f2ff', stroke: '#4ea8de' }, // ice blue
    { fill: '#ffe8cc', stroke: '#ff7f11' }, // warm apricot
    { fill: '#c9f7d4', stroke: '#34c759' }, // fresh green
    { fill: '#ffe4f2', stroke: '#ff2e63' }  // neon pink
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

/* ---- lwt-dsh-sparkline.js ---- */
/*!
 * <lwtd-sparkline>
 * A minimal inline trend line — no axes, grid, legend, or title, meant to
 * sit inline in text or inside a small dashboard card.
 *
 *   <lwtd-sparkline
 *     label="Weekly sales performance showing growth"
 *     data="10 25 15 40 30 45 35"
 *     style="height: 2rem;">
 *   </lwtd-sparkline>
 *
 * This is deliberately different from every other lwt-*-chart element:
 * data comes through the `data` attribute (space- or comma-separated
 * numbers), not a JS `.data` property. A sparkline is almost always used
 * exactly like the markup above — a small, static, declarative number —
 * so an attribute is the natural fit, and unlike lwtf-color-picker or
 * lwtg-modal there's no expensive/stateful redraw to protect against:
 * `data` is a normal observed attribute, so `el.setAttribute('data', '1 2 3')`
 * live-updates it through the base class's default re-render behavior.
 *
 * Sizing: no fixed aspect ratio (unlike the bigger charts) — it fills
 * whatever box you give it. Defaults to 120x32px via CSS custom
 * properties; override with plain `style="width:...; height:..."` (as in
 * the example above) or the --lwt-sparkline-width/-height variables.
 *
 * Color: blue by default. Set `color` (any CSS color) to override
 * directly, or add the `trend` boolean attribute to auto-color based on
 * the change from the first value to the last: green if it rose more
 * than 5%, red if it fell more than 5%, grey if it's within that 5% band
 * (essentially unchanged). An explicit `color` always wins over `trend`.
 *
 * Attributes:
 *   data        — space/comma separated numbers (required to draw anything)
 *   label       — accessible label (aria-label on the SVG; not rendered as visible text)
 *   color       — CSS color, overrides everything including trend
 *   trend       — boolean; auto-color green/red/grey by first-to-last change
 *   no-fill     — boolean; disables the area fill under the line (on by default)
 *   line-width  — stroke width in viewBox units (default 2)
 *
 * Known scope limits: no point/dot markers, no hover/tooltip, no
 * multi-series support (one line per element), single data point renders
 * as an empty line (nothing to draw a trend between).
 *
 * Theming: --lwt-sparkline-width (120px), --lwt-sparkline-height (32px),
 * --lwt-sparkline-color (default blue, #3b82f6), --lwt-sparkline-up-color
 * (#22c55e), --lwt-sparkline-down-color (#ef4444), --lwt-sparkline-flat-color
 * (#9ca3af) — the last three only apply when `trend` picks that color and
 * no explicit `color` attribute is set.
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-dsh-sparkline.js requires lwt-core.js to be loaded first.');
  }

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var CSS = `
    :host {
      display: inline-block;
      width: var(--lwt-sparkline-width, 120px);
      height: var(--lwt-sparkline-height, 32px);
    }
    svg { display: block; width: 100%; height: 100%; }
    .spark-line { fill: none; stroke-linejoin: round; stroke-linecap: round; }
  `;

  class LWTSparkline extends window.LWT.Element {
    static get observedAttributes() {
      return ['data', 'color', 'trend', 'no-fill', 'line-width', 'label'];
    }

    render() {
      this._renderShadow(this._buildSvg(), CSS);
    }

    _parseData() {
      var raw = this._strAttr('data', '');
      return raw
        .split(/[\s,]+/)
        .map(function (s) { return parseFloat(s); })
        .filter(function (n) { return !isNaN(n); });
    }

    // Name: the label attribute, plus a spoken summary of the trend so a
    // screen reader gets what the line shows ("rising from 10 to 45 over
    // 7 points"). Without a label, the summary alone is used (and warned).
    _spokenName(values) {
      var summary = '';
      if (values.length) {
        var first = values[0], last = values[values.length - 1];
        var dir = last > first ? 'rising' : (last < first ? 'falling' : 'flat');
        summary = 'Trend ' + dir + ' from ' + first + ' to ' + last + ' over ' + values.length + ' points' +
          ', low ' + Math.min.apply(null, values) + ', high ' + Math.max.apply(null, values);
      } else {
        summary = 'No data';
      }
      var label = this._hostLabel() || this._strAttr('label', '');
      if (!label) {
        this._a11yWarn('name', 'has no label, so it is announced as "' + summary + '". Add a label attribute to say what it measures.');
        return summary;
      }
      return label + ': ' + summary;
    }

    _buildSvg() {
      var label = this._strAttr('label', '');
      var VBW = 200, VBH = 50, PAD = 4;
      var values = this._parseData();
      var n = values.length;

      if (n === 0) {
        return '<svg viewBox="0 0 ' + VBW + ' ' + VBH + '" preserveAspectRatio="none" role="img" aria-label="' + escapeXml(this._spokenName(values)) + '"></svg>';
      }

      var explicitColor = this._strAttr('color', '');
      var trendEnabled = this._boolAttr('trend');
      var noFill = this._boolAttr('no-fill');
      var lineWidth = parseFloat(this._strAttr('line-width', '2'));
      if (isNaN(lineWidth) || lineWidth <= 0) lineWidth = 2;

      var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
      if (min === max) { min -= 1; max += 1; }

      function x(i) { return n > 1 ? (i / (n - 1)) * VBW : VBW / 2; }
      function y(v) { return VBH - PAD - ((v - min) / (max - min)) * (VBH - PAD * 2); }
      var points = values.map(function (v, i) { return { x: x(i), y: y(v) }; });

      // Resolve color: explicit attribute > trend-derived > default blue.
      // Trend/default colors go through inline `style` referencing a CSS
      // custom property (with a hardcoded fallback) so they stay theme-
      // overridable; an explicit `color` is used as-is since it's already
      // a specific, final value.
      var strokeStyle, stopColor;
      if (explicitColor) {
        strokeStyle = 'stroke: ' + explicitColor + ';';
        stopColor = explicitColor;
      } else if (trendEnabled && n >= 2) {
        var first = values[0], last = values[n - 1];
        var pctChange = first !== 0
          ? (last - first) / Math.abs(first)
          : (last === first ? 0 : (last > first ? 1 : -1));
        var varName, fallback;
        if (Math.abs(pctChange) < 0.05) { varName = '--lwt-sparkline-flat-color'; fallback = 'var(--lwt-color-text-muted, #6b7280)'; }
        else if (pctChange > 0) { varName = '--lwt-sparkline-up-color'; fallback = 'var(--lwt-color-success, #22c55e)'; }
        else { varName = '--lwt-sparkline-down-color'; fallback = 'var(--lwt-color-danger, #ef4444)'; }
        strokeStyle = 'stroke: var(' + varName + ', ' + fallback + ');';
        stopColor = 'var(' + varName + ', ' + fallback + ')';
      } else {
        strokeStyle = 'stroke: var(--lwt-sparkline-color, var(--lwt-color-primary, #3b82f6));';
        stopColor = 'var(--lwt-sparkline-color, var(--lwt-color-primary, #3b82f6))';
      }

      var linePath = points.map(function (p, i) {
        return (i === 0 ? 'M ' : 'L ') + p.x.toFixed(2) + ' ' + p.y.toFixed(2);
      }).join(' ');

      var defsSvg = '', fillSvg = '';
      if (!noFill) {
        defsSvg = '<defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" style="stop-color: ' + stopColor + '; stop-opacity: 0.35;"></stop>' +
          '<stop offset="100%" style="stop-color: ' + stopColor + '; stop-opacity: 0;"></stop>' +
          '</linearGradient></defs>';
        var areaPath = linePath +
          ' L ' + points[n - 1].x.toFixed(2) + ' ' + VBH.toFixed(2) +
          ' L ' + points[0].x.toFixed(2) + ' ' + VBH.toFixed(2) + ' Z';
        fillSvg = '<path d="' + areaPath + '" fill="url(#grad)" stroke="none"></path>';
      }

      var lineSvg = '<path class="spark-line" d="' + linePath + '" style="' + strokeStyle + '" stroke-width="' + lineWidth + '"></path>';

      return '<svg viewBox="0 0 ' + VBW + ' ' + VBH + '" preserveAspectRatio="none" role="img" aria-label="' + escapeXml(this._spokenName(values)) + '">' +
        defsSvg + fillSvg + lineSvg +
        '</svg>';
    }
  }

  window.LWT.define('lwtd-sparkline', LWTSparkline);
})();

/* ---- lwt-dsh-stat-card.js ---- */
/*!
 * <lwtd-stat-card>
 * A KPI/stat card: label, big value, an optional colored delta, an
 * optional icon, and an optional trailing chart — meant to pair
 * naturally with <lwtd-sparkline> for the classic "number + trend line"
 * dashboard tile.
 *
 *   <lwtd-stat-card label="Revenue" value="$48,200" delta="+12.4%">
 *     <span slot="icon">💰</span>
 *     <lwtd-sparkline slot="chart" trend data="30 34 31 40 38 45 48"
 *       style="width: 100%; height: 28px;"></lwtd-sparkline>
 *   </lwtd-stat-card>
 *
 * `label`, `value`, and `delta` are plain display strings — this doesn't
 * do currency/number formatting, so write "$48,200" or "1,204 users"
 * exactly as you want it shown.
 *
 * Delta color: pass `trend="up"|"down"|"neutral"` explicitly, or omit it
 * and it's inferred from delta's leading character (a leading "+" is up,
 * "-" is down, anything else is neutral). An explicit `trend` always
 * wins over that inference. The color variables are intentionally the
 * same ones lwtd-sparkline uses (--lwt-sparkline-up-color etc.) — theme
 * one and both components pick it up, since these are commonly paired.
 *
 * Icon and chart are named slots, not attributes — `slot="icon"` accepts
 * anything (an emoji in a <span>, an inline <svg>, an <img>), same for
 * `slot="chart"` (typically an <lwtd-sparkline>). Either row disappears
 * automatically when nothing is slotted into it.
 *
 * Note on sizing a slotted <lwtd-sparkline>: this card doesn't reliably
 * force it to fill the width via CSS (shadow-DOM specificity between two
 * different components' stylesheets targeting the same element is
 * unreliable) — size it directly on the sparkline itself, as in the
 * example above (`style="width: 100%; height: 28px;"`), same as you'd do
 * anywhere else you use lwtd-sparkline.
 *
 * Attributes:
 *   label  — small caption above the value
 *   value  — the big stat text
 *   delta  — change text, e.g. "+12.4%" (omit to hide the delta row)
 *   trend  — "up" | "down" | "neutral", overrides sign-based inference
 *
 * Known scope limits: no built-in number formatting/animation/counting-up
 * effect, no click interactivity.
 *
 * Theming: --lwt-stat-bg, --lwt-stat-border, --lwt-stat-label-color,
 * --lwt-stat-value-color, --lwt-stat-icon-bg, --lwt-sparkline-up-color,
 * --lwt-sparkline-down-color, --lwt-sparkline-flat-color (shared with
 * lwtd-sparkline).
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-dsh-stat-card.js requires lwt-core.js to be loaded first.');
  }

  var TEMPLATE =
    '<div class="card" part="card">' +
    '  <div class="header">' +
    '    <div class="label" part="label"></div>' +
    '    <div class="icon-slot" part="icon"><slot name="icon"></slot></div>' +
    '  </div>' +
    '  <div class="value-row">' +
    '    <div class="value" part="value"></div>' +
    '    <div class="delta" part="delta"></div>' +
    '  </div>' +
    '  <div class="chart-slot" part="chart"><slot name="chart"></slot></div>' +
    '</div>';

  var CSS = `
    :host { display: block; font-family: inherit; }
    .card {
      display: flex;
      flex-direction: column;
      gap: var(--lwt-stat-gap, var(--lwt-gap, 0.5rem));
      padding: var(--lwt-stat-padding, var(--lwt-padding, 1.25rem));
      border-radius: var(--lwt-stat-radius, var(--lwt-border-radius, 12px));
      box-sizing: border-box;
      border: var(--lwt-stat-border, var(--lwt-border, 1px solid #e5e7eb));
      background: var(--lwt-stat-bg, var(--lwt-color-surface, #fff));
    }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .label {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--lwt-stat-label-color, var(--lwt-color-text-muted, #6b7280));
    }
    .icon-slot {
      flex-shrink: 0;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: var(--lwt-stat-icon-radius, var(--lwt-border-radius, 8px));
      background: var(--lwt-stat-icon-bg, var(--lwt-color-surface-muted, #f3f4f6));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      line-height: 1;
    }
    .value-row {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .value {
      font-size: 1.75rem;
      font-weight: 700;
      line-height: 1.1;
      color: var(--lwt-stat-value-color, var(--lwt-color-text-strong, #111827));
    }
    .delta { font-size: 0.85rem; font-weight: 600; }
    /* Text colors that pass 4.5:1 on white (the line colors are often
       lighter, which is fine for a graphic but not for small text). */
    .delta-up { color: var(--lwt-stat-delta-up-color, #15803d); }
    .delta-down { color: var(--lwt-stat-delta-down-color, #b91c1c); }
    .delta-neutral { color: var(--lwt-sparkline-flat-color, var(--lwt-color-text-muted, #6b7280)); }
    .chart-slot { margin-top: 0.25rem; }
    ::slotted([slot="chart"]) { display: block; width: 100%; }
  `;

  class LWTStatCard extends window.LWT.Element {
    static get observedAttributes() {
      return ['label', 'value', 'delta', 'trend'];
    }

    render() {
      this._renderShadow(TEMPLATE, CSS + window.LWT.a11y.SR_ONLY_CSS);
      var root = this._root;
      // Read the card as one named group ("Revenue, $48,200, up 12.4%").
      this._ensureAttr('role', 'group');
      this._ensureAttr('aria-label', this._a11yName([this._strAttr('label', '')], 'Statistic', 'Add a label attribute'));
      var iconWrapEl = root.querySelector('.icon-slot');
      if (iconWrapEl) iconWrapEl.setAttribute('aria-hidden', 'true');

      root.querySelector('.label').textContent = this._strAttr('label', '');
      root.querySelector('.value').textContent = this._strAttr('value', '');

      var delta = this._strAttr('delta', '');
      var trend = this._strAttr('trend', '');
      if (!trend) {
        if (/^\+/.test(delta)) trend = 'up';
        else if (/^-/.test(delta)) trend = 'down';
        else trend = 'neutral';
      }
      var arrow = trend === 'up' ? '▲ ' : trend === 'down' ? '▼ ' : '';
      var deltaEl = root.querySelector('.delta');
      // The arrow is decorative; say the direction in words instead.
      var spoken = trend === 'up' ? 'Up ' : trend === 'down' ? 'Down ' : '';
      deltaEl.innerHTML = delta
        ? '<span aria-hidden="true">' + arrow + '</span><span class="lwt-sr-only">' + spoken + '</span>' + window.LWT.a11y.escape(delta)
        : '';
      deltaEl.className = 'delta delta-' + trend;
      deltaEl.style.display = delta ? '' : 'none';

      var iconSlot = root.querySelector('slot[name="icon"]');
      var iconWrap = root.querySelector('.icon-slot');
      var syncIconVisibility = function () {
        iconWrap.style.display = iconSlot.assignedNodes().length ? '' : 'none';
      };
      syncIconVisibility();
      iconSlot.addEventListener('slotchange', syncIconVisibility);

      var chartSlot = root.querySelector('slot[name="chart"]');
      var chartWrap = root.querySelector('.chart-slot');
      var syncChartVisibility = function () {
        chartWrap.style.display = chartSlot.assignedNodes().length ? '' : 'none';
      };
      syncChartVisibility();
      chartSlot.addEventListener('slotchange', syncChartVisibility);
    }
  }

  window.LWT.define('lwtd-stat-card', LWTStatCard);
})();

