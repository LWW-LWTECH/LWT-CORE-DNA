/*!
 * LWT Dashboard Elements
 * Developer: Lee W Winter
 * Last Generated: 2026-10-22T11:22:01.918Z
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
 * Custom palette: `palette` attribute (comma-separated CSS colors), the
 * `.palette` property (array of colors or { stroke, fill }), the inherited
 * --lwt-chart-palette CSS variable, or page-wide LWT.chart.palette. A plain
 * color is the strong color; the light fill is mixed from it. Per-dataset
 * colors in the data still win. See LWT.chart in lwt-core.js.
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

  function rectSvg(x, y, w, h, fill, stroke, attrs) {
    w = Math.max(0, w);
    h = Math.max(0, h);
    return '<rect x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + w.toFixed(2) + '" height="' + h.toFixed(2) +
      '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5" rx="2"' + (attrs || '') + '></rect>';
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
      return ['title', 'orientation', 'stacked', 'legend-position', 'grid', 'x-label', 'y-label', 'palette'];
    }

    static get observedProps() {
      return ['data', 'palette'];
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
      this._renderShadow('<div class="chart-wrap" part="wrap">' + this._buildSvg() + table + '</div>' + window.LWT.chart.TIP_HTML, CSS + a11y.SR_ONLY_CSS + window.LWT.chart.TOOLTIP_CSS);
      window.LWT.chart.enableTooltips(this);
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

      var pal = window.LWT.chart.resolve(this, PALETTE);
      var colors = datasets.map(function (ds, i) {
        var p = pal[i % pal.length];
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
      function tipFor(li, di, v) { return window.LWT.chart.tipAttr(labels[li], (numDs > 1 ? (datasets[di].label || ('Series ' + (di + 1))) + ': ' : '') + v, null); }
      for (var li = 0; li < n; li++) {
        if (!horizontal) {
          if (stacked) {
            var xPos = plotLeft + bandLen * li + bandPad;
            var cum = 0;
            for (var di = 0; di < numDs; di++) {
              var v = Number(datasets[di].data && datasets[di].data[li]) || 0;
              var segH = valueToPx(v);
              var y = plotBottom - valueToPx(cum) - segH;
              barsSvg += rectSvg(xPos, y, innerBand, segH, colors[di].fill, colors[di].stroke, tipFor(li, di, v));
              cum += v;
            }
          } else {
            var subW = numDs > 0 ? innerBand / numDs : innerBand;
            for (var di2 = 0; di2 < numDs; di2++) {
              var v2 = Number(datasets[di2].data && datasets[di2].data[li]) || 0;
              var h2 = valueToPx(v2);
              var x2 = plotLeft + bandLen * li + bandPad + subW * di2;
              barsSvg += rectSvg(x2, plotBottom - h2, subW, h2, colors[di2].fill, colors[di2].stroke, tipFor(li, di2, v2));
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
              barsSvg += rectSvg(x3, yPos, segW, innerBand, colors[di3].fill, colors[di3].stroke, tipFor(li, di3, v3));
              cumH += v3;
            }
          } else {
            var subH = numDs > 0 ? innerBand / numDs : innerBand;
            for (var di4 = 0; di4 < numDs; di4++) {
              var v4 = Number(datasets[di4].data && datasets[di4].data[li]) || 0;
              var w4 = valueToPx(v4);
              var y4 = plotTop + bandLen * li + bandPad + subH * di4;
              barsSvg += rectSvg(plotLeft, y4, w4, subH, colors[di4].fill, colors[di4].stroke, tipFor(li, di4, v4));
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

  window.LWT.chart.withPalette(LWTBarChart);
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
 * Custom palette: `palette` attribute (comma-separated CSS colors), the
 * `.palette` property (array of colors or { stroke, fill }), the inherited
 * --lwt-chart-palette CSS variable, or page-wide LWT.chart.palette. A plain
 * color is the strong color; the light fill is mixed from it. Per-dataset
 * colors in the data still win. See LWT.chart in lwt-core.js.
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
      return ['title', 'bubble-scale', 'legend-position', 'grid', 'x-label', 'y-label', 'palette'];
    }

    static get observedProps() {
      return ['data', 'palette'];
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
      this._renderShadow('<div class="chart-wrap" part="wrap">' + this._buildSvg() + table + '</div>' + window.LWT.chart.TIP_HTML, CSS + a11y.SR_ONLY_CSS + window.LWT.chart.TOOLTIP_CSS);
      window.LWT.chart.enableTooltips(this);
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

      var pal = window.LWT.chart.resolve(this, PALETTE);
      var series = datasets.map(function (ds, i) {
        var p = pal[i % pal.length];
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
            '" fill="' + c.fill + '" stroke="' + c.stroke + '"' + window.LWT.chart.tipAttr(s.label, '(' + x + ', ' + y + ')', (Number(p.r) ? 'size ' + Number(p.r) : null)) + '></circle>';
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

  window.LWT.chart.withPalette(LWTBubbleChart);
  window.LWT.define('lwtd-bubble-chart', LWTBubbleChart);
})();

/* ---- lwt-dsh-bullet.js ---- */
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
 * Custom palette: `palette` attribute (comma-separated CSS colors), the
 * `.palette` property (array of colors or { stroke, fill }), the inherited
 * --lwt-chart-palette CSS variable, or page-wide LWT.chart.palette. A plain
 * color is the strong color; the light fill is mixed from it. backgroundColor / borderColor
 * colors in the data still win. See LWT.chart in lwt-core.js.
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

  function sliceColor(dataset, index, pal) {
    pal = pal || PALETTE;
    var p = pal[index % pal.length];
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
      return ['title', 'legend-position', 'inner-radius', 'palette'];
    }

    static get observedProps() {
      return ['data', 'palette'];
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
      this._renderShadow('<div class="chart-wrap" part="wrap">' + this._buildSvg() + table + '</div>' + window.LWT.chart.TIP_HTML, CSS + a11y.SR_ONLY_CSS + window.LWT.chart.TOOLTIP_CSS);
      window.LWT.chart.enableTooltips(this);
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

      var pal = window.LWT.chart.resolve(this, PALETTE);
      var colors = labels.map(function (_, i) { return sliceColor(dataset, i, pal); });

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
          slicesSvg += '<path class="slice" d="' + path + '" fill="' + colors[i].fill + '" stroke="' + colors[i].stroke + '"' + window.LWT.chart.tipAttr(l, v, (total > 0 ? Math.round(v / total * 100) + '%' : null)) + '></path>';
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

  window.LWT.chart.withPalette(LWTDoughnutChart);
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
 * Custom palette (`palette` attribute, `.palette` property,
 * --lwt-chart-palette or LWT.chart.palette): zones without a `color` take
 * the palette colors in order; with no zones the arc uses the first one.
 * An explicit `color` attribute still wins.
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
      return ['title', 'value', 'min', 'max', 'label', 'unit', 'color', 'thickness', 'sweep', 'palette'];
    }

    static get observedProps() {
      return ['data', 'palette'];
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
      this._renderShadow('<div class="chart-wrap" part="wrap">' + this._buildSvg() + '</div>' + window.LWT.chart.TIP_HTML, CSS + window.LWT.chart.TOOLTIP_CSS);
      window.LWT.chart.enableTooltips(this);
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
      // Custom palette: zones without their own color take palette colors in
      // order; with no zones, the arc uses the first palette color.
      var pal = window.LWT.chart.resolve(this, null);
      if (pal.custom) {
        zones = zones.map(function (z, i) { return z.color ? z : Object.assign({}, z, { color: pal[i % pal.length].stroke }); });
        if (!explicitColor && !zones.length) explicitColor = pal[0].stroke;
      }

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

      var hitSvg = '<path d="' + describeArc(cx, cy, ringR, startAngle, endAngle) + '" fill="none" stroke="transparent" stroke-width="' + (thickness + 18) + '"' + window.LWT.chart.tipAttr(title || label || '', displayValue + unit, null) + '></path>';

      var titleSvg = title ? '<text class="title-text" x="' + (VBW / 2) + '" y="' + (PAD + 16) + '" text-anchor="middle">' + escapeXml(title) + '</text>' : '';

      return '<svg viewBox="0 0 ' + VBW + ' ' + VBH + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + escapeXml(this._a11yName([title, label], 'Gauge', 'Add a title or label attribute') +
        ': ' + displayValue + unit + ' (range ' + min + ' to ' + max + ')') + '">' +
        titleSvg + trackSvg + progressSvg + indicatorSvg + tickSvg + centerSvg + hitSvg +
        '</svg>';
    }
  }

  window.LWT.chart.withPalette(LWTGauge);
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
 * Custom palette: `palette` attribute (comma-separated CSS colors), the
 * `.palette` property (array of colors or { stroke, fill }), the inherited
 * --lwt-chart-palette CSS variable, or page-wide LWT.chart.palette. A plain
 * color is the strong color; the light fill is mixed from it. Per-dataset
 * colors in the data still win. See LWT.chart in lwt-core.js.
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
      return ['title', 'stacked', 'fill', 'line-width', 'point-radius', 'legend-position', 'grid', 'x-label', 'y-label', 'palette'];
    }

    static get observedProps() {
      return ['data', 'palette'];
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
      this._renderShadow('<div class="chart-wrap" part="wrap">' + this._buildSvg() + table + '</div>' + window.LWT.chart.TIP_HTML, CSS + a11y.SR_ONLY_CSS + window.LWT.chart.TOOLTIP_CSS);
      window.LWT.chart.enableTooltips(this);
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

      var pal = window.LWT.chart.resolve(this, PALETTE);
      var series = datasets.map(function (ds, i) {
        var p = pal[i % pal.length];
        var fillOn = typeof ds.fill === 'boolean' ? ds.fill : defaultFill;
        return {
          label: ds.label || ('Series ' + (i + 1)),
          data: ds.data || [],
          line: ds.borderColor || p.stroke,
          area: ds.backgroundColor || (/^#/.test(p.fill) ? hexToRgba(p.fill, 0.5) : p.fill),
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
      var hitData = [];
      var seriesPoints = series.map(function (s) {
        var topPts = [], basePts = [];
        labels.forEach(function (l, li) {
          var v = Number(s.data[li]) || 0;
          var baseCum = stacked ? runningCum[li] : 0;
          var topCum = baseCum + v;
          var x = xPos(li);
          topPts.push({ x: x, y: plotBottom - valueToPx(topCum) });
          basePts.push({ x: x, y: plotBottom - valueToPx(baseCum) });
          hitData.push({ x: x, y: plotBottom - valueToPx(topCum), label: l, series: s.label, value: v });
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

      var hitsSvg = '';
      var multi = series.length > 1;
      hitData.forEach(function (h) {
        hitsSvg += '<circle cx="' + h.x.toFixed(2) + '" cy="' + h.y.toFixed(2) + '" r="11" fill="transparent"' + window.LWT.chart.tipAttr(h.label, (multi ? h.series + ': ' : '') + h.value, null) + '></circle>';
      });
      return '<svg viewBox="0 0 ' + VBW + ' ' + VBH + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + escapeXml((this._chartName || title || 'Line chart') + (this._hasTable ? ', data table follows' : ', no data')) + '">' +
        titleSvg + legendSvg + gridSvg + borderSvg + fillsSvg + linesSvg + tickSvg + xLabelSvg + yLabelSvg + hitsSvg +
        '</svg>';
    }
  }

  window.LWT.chart.withPalette(LWTLineChart);
  window.LWT.define('lwtd-line-chart', LWTLineChart);
})();

/* ---- lwt-dsh-mermaid.js ---- */
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
 * Custom palette: `palette` attribute (comma-separated CSS colors), the
 * `.palette` property (array of colors or { stroke, fill }), the inherited
 * --lwt-chart-palette CSS variable, or page-wide LWT.chart.palette. A plain
 * color is the strong color; the light fill is mixed from it. backgroundColor / borderColor
 * colors in the data still win. See LWT.chart in lwt-core.js.
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

  function sliceColor(dataset, index, pal) {
    pal = pal || PALETTE;
    var p = pal[index % pal.length];
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
      return ['title', 'legend-position', 'palette'];
    }

    static get observedProps() {
      return ['data', 'palette'];
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
      this._renderShadow('<div class="chart-wrap" part="wrap">' + this._buildSvg() + table + '</div>' + window.LWT.chart.TIP_HTML, CSS + a11y.SR_ONLY_CSS + window.LWT.chart.TOOLTIP_CSS);
      window.LWT.chart.enableTooltips(this);
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

      var pal = window.LWT.chart.resolve(this, PALETTE);
      var colors = labels.map(function (_, i) { return sliceColor(dataset, i, pal); });

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
          slicesSvg += '<path class="slice" d="' + path + '" fill="' + colors[i].fill + '" stroke="' + colors[i].stroke + '"' + window.LWT.chart.tipAttr(l, v, (total > 0 ? Math.round(v / total * 100) + '%' : null)) + '></path>';
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

  window.LWT.chart.withPalette(LWTPieChart);
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
 * Custom palette: `palette` attribute (comma-separated CSS colors), the
 * `.palette` property (array of colors or { stroke, fill }), the inherited
 * --lwt-chart-palette CSS variable, or page-wide LWT.chart.palette. A plain
 * color is the strong color; the light fill is mixed from it. Per-dataset
 * colors in the data still win. See LWT.chart in lwt-core.js.
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
      return ['title', 'legend-position', 'grid', 'line-width', 'point-radius', 'fill-opacity', 'palette'];
    }

    static get observedProps() {
      return ['data', 'palette'];
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
      this._renderShadow('<div class="chart-wrap" part="wrap">' + this._buildSvg() + table + '</div>' + window.LWT.chart.TIP_HTML, CSS + a11y.SR_ONLY_CSS + window.LWT.chart.TOOLTIP_CSS);
      window.LWT.chart.enableTooltips(this);
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

      var pal = window.LWT.chart.resolve(this, PALETTE);
      var series = datasets.map(function (ds, i) {
        var p = pal[i % pal.length];
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
      var radarHits = [];
      var radarMulti = series.length > 1;
      series.forEach(function (s) {
        var pts = [];
        for (var i = 0; i < n; i++) {
          var v = Number(s.data[i]) || 0;
          var rp = polarToCartesian(cx, cy, valueToRadius(v), angle(i));
          pts.push(rp);
          radarHits.push({ x: rp.x, y: rp.y, axis: labels[i], series: s.label, value: v });
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

      var hitsSvg = '';
      radarHits.forEach(function (h) {
        hitsSvg += '<circle cx="' + h.x.toFixed(2) + '" cy="' + h.y.toFixed(2) + '" r="11" fill="transparent"' + window.LWT.chart.tipAttr(h.axis, (radarMulti ? h.series + ': ' : '') + h.value, null) + '></circle>';
      });
      return '<svg viewBox="0 0 ' + VBW + ' ' + VBH + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + escapeXml((this._chartName || title || 'Radar chart') + (this._hasTable ? ', data table follows' : ', no data')) + '">' +
        titleSvg + legendSvg + gridSvg + shapesSvg + tickSvg + labelSvg + hitsSvg +
        '</svg>';
    }
  }

  window.LWT.chart.withPalette(LWTRadarChart);
  window.LWT.define('lwtd-radar-chart', LWTRadarChart);
})();

/* ---- lwt-dsh-scatter.js ---- */
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
 * Custom palette (`palette` attribute, `.palette` property,
 * --lwt-chart-palette or LWT.chart.palette): the first color is the line;
 * with `trend` the first three are up, down, flat. `color` still wins.
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
      return ['data', 'color', 'trend', 'no-fill', 'line-width', 'label', 'palette'];
    }

    render() {
      this._renderShadow(this._buildSvg() + window.LWT.chart.TIP_HTML, CSS + window.LWT.chart.TOOLTIP_CSS);
      window.LWT.chart.enableTooltips(this);
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
      var pal = window.LWT.chart.resolve(this, null);
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
        if (pal.custom) {
          var pc = pal[varName === '--lwt-sparkline-up-color' ? 0 : varName === '--lwt-sparkline-down-color' ? 1 : 2];
          if (pc) { strokeStyle = 'stroke: ' + pc.stroke + ';'; stopColor = pc.stroke; }
        }
      } else if (pal.custom) {
        strokeStyle = 'stroke: ' + pal[0].stroke + ';';
        stopColor = pal[0].stroke;
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
      var hitSvg = '';
      var bandW = n > 1 ? VBW / (n - 1) : VBW;
      points.forEach(function (p, i) {
        hitSvg += '<rect x="' + (p.x - bandW / 2).toFixed(2) + '" y="0" width="' + bandW.toFixed(2) + '" height="' + VBH + '" fill="transparent"' + window.LWT.chart.tipAttr(label, values[i], null) + '></rect>';
      });

      return '<svg viewBox="0 0 ' + VBW + ' ' + VBH + '" preserveAspectRatio="none" role="img" aria-label="' + escapeXml(this._spokenName(values)) + '">' +
        defsSvg + fillSvg + lineSvg + hitSvg +
        '</svg>';
    }
  }

  window.LWT.chart.withPalette(LWTSparkline);
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
 * Custom palette (`palette` attribute, `.palette` property,
 * --lwt-chart-palette or LWT.chart.palette): delta colors, in order up,
 * down, neutral. A chart in the `chart` slot picks up an inherited
 * --lwt-chart-palette too.
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
      return ['label', 'value', 'delta', 'trend', 'palette'];
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
      // Custom palette: [up, down, neutral] delta colors.
      var pal = window.LWT.chart.resolve(this, null);
      var pc = pal.custom ? pal[trend === 'up' ? 0 : trend === 'down' ? 1 : 2] : null;
      deltaEl.style.color = pc ? pc.stroke : '';
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

  window.LWT.chart.withPalette(LWTStatCard);
  window.LWT.define('lwtd-stat-card', LWTStatCard);
})();

/* ---- lwt-dsh-treemap.js ---- */
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

/* ---- lwt-dsh-waterfall.js ---- */
/*!
 * <lwtd-waterfall>
 * A waterfall chart: a starting value, the increases and decreases that
 * change it, and the running total they add up to -- e.g. revenue bridge,
 * budget vs. actual, headcount change. Rendered as inline SVG, redrawn on
 * every data / attribute change (same approach as <lwtd-bar-chart>).
 *
 *   var chart = document.querySelector('lwtd-waterfall');
 *   chart.data = {
 *     items: [
 *       { label: 'Q1 revenue',    value: 1200, type: 'total' },  // absolute bar from 0
 *       { label: 'New customers', value: 300 },                  // +300
 *       { label: 'Upsells',       value: 120 },
 *       { label: 'Churn',         value: -180 },                 // -180
 *       { label: 'Q2 revenue',    type: 'total' }                // running total (1440)
 *     ]
 *   };
 *
 * Items:
 *   { label, value }                 — a change, added to the running total
 *   { label, value, type: 'total' }  — sets the running total to `value` and
 *                                      draws it from zero (a start / reset)
 *   { label, type: 'total' }         — draws the current running total from
 *                                      zero (a subtotal or end bar)
 *   Optional per item: color (overrides that bar's color).
 *
 * Chart.js-style data also works: { labels: [...], datasets: [{ data: [...] }],
 * totals: [0, 4] } -- indexes in `totals` are total bars (a null/undefined
 * value there means "show the running total").
 *
 * Style attributes (all re-render on change):
 *   title             — chart title text
 *   legend-position   — "top" (default) | "bottom" | "none"
 *   grid              — "horizontal" (default) | "none"
 *   x-label, y-label  — axis titles
 *   hide-values       — boolean; no value labels on the bars (shown by default)
 *   no-connectors     — boolean; no dashed lines joining the bars
 *   value-prefix      — text before numbers, e.g. "$"
 *   value-suffix      — text after numbers, e.g. "k" or " pts"
 *   increase-label, decrease-label, total-label — legend text
 *                       (default "Increase", "Decrease", "Total")
 *
 * Hovering a bar shows its change and the running total. Screen readers
 * get a data table with the same numbers (step, change, running total).
 *
 * Custom palette (`palette` attribute, `.palette` property,
 * --lwt-chart-palette or LWT.chart.palette): three colors, in order
 * increase, decrease, total -- e.g. palette="#0d9488, #e11d48, #4f46e5".
 *
 * Theming: --lwt-waterfall-increase-color (default --lwt-success),
 * --lwt-waterfall-decrease-color (default --lwt-danger),
 * --lwt-waterfall-total-color (default --lwt-primary), plus the shared
 * --lwt-chart-* variables (bg, grid, border, tick-color, label-color,
 * title-color, legend-color, aspect-ratio).
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-dsh-waterfall.js requires lwt-core.js to be loaded first.');
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

  // Nice ticks covering [min, max], always including 0.
  function computeScale(min, max, tickTarget) {
    min = Math.min(0, min);
    max = Math.max(0, max);
    if (max === min) max = min + 1;
    var step = niceNumber(niceNumber(max - min, false) / (tickTarget - 1), true);
    var niceMin = Math.floor(min / step) * step;
    var niceMax = Math.ceil(max / step) * step;
    var ticks = [];
    for (var v = niceMin; v <= niceMax + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
    return { min: niceMin, max: niceMax, ticks: ticks };
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

  var CSS = `
    :host {
      display: block;
      position: relative;
      width: 100%;
      aspect-ratio: var(--lwt-chart-aspect-ratio, 8 / 5);
      font-family: inherit;
      background: var(--lwt-chart-bg, transparent);
      --wf-up: var(--lwt-waterfall-increase-color, var(--lwt-success, #10b981));
      --wf-down: var(--lwt-waterfall-decrease-color, var(--lwt-danger, #ef4444));
      --wf-total: var(--lwt-waterfall-total-color, var(--lwt-primary, #3b82f6));
      --wf-surface: var(--lwt-chart-bg, var(--lwt-color-surface, #fff));
    }
    .chart-wrap, svg { display: block; width: 100%; height: 100%; }
    .grid-line { stroke: var(--lwt-chart-grid, var(--lwt-border-color, #e5e7eb)); stroke-width: 1; }
    .zero-line { stroke: var(--lwt-chart-border, var(--lwt-color-text-muted, #9ca3af)); stroke-width: 1; }
    .plot-border { stroke: var(--lwt-chart-border, var(--lwt-border-color, #e5e7eb)); stroke-width: 1; fill: none; }
    .axis-text { fill: var(--lwt-chart-tick-color, var(--lwt-color-text-muted, #6b7280)); font-size: 11px; }
    .axis-title { fill: var(--lwt-chart-label-color, var(--lwt-color-text, #374151)); font-size: 12px; font-weight: 600; }
    .chart-title { fill: var(--lwt-chart-title-color, var(--lwt-color-text-strong, #1f2937)); font-size: 15px; font-weight: 700; }
    .legend-text { fill: var(--lwt-chart-legend-color, var(--lwt-color-text, #374151)); font-size: 11px; }
    .value-text { fill: var(--lwt-chart-label-color, var(--lwt-color-text, #374151)); font-size: 11px; font-weight: 600; }
    .connector { stroke: var(--lwt-chart-tick-color, var(--lwt-color-text-muted, #9ca3af)); stroke-width: 1; stroke-dasharray: 3 3; }
    .bar { stroke-width: 1.5; transition: opacity 120ms ease; }
    .bar.up    { fill: color-mix(in srgb, var(--wf-up) 35%, var(--wf-surface));    stroke: var(--wf-up); }
    .bar.down  { fill: color-mix(in srgb, var(--wf-down) 35%, var(--wf-surface));  stroke: var(--wf-down); }
    .bar.total { fill: color-mix(in srgb, var(--wf-total) 35%, var(--wf-surface)); stroke: var(--wf-total); }
    svg.hovering .bar:not(.hover) { opacity: 0.45; }
    .hit { fill: transparent; cursor: default; }
    .tip {
      position: absolute;
      z-index: 2;
      pointer-events: none;
      padding: 0.4rem 0.55rem;
      border-radius: var(--lwt-border-radius, 6px);
      background: var(--lwt-color-text-strong, #111827);
      color: var(--lwt-color-surface, #fff);
      font-size: 12px;
      line-height: 1.4;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.18);
      transform: translate(-50%, calc(-100% - 8px));
    }
    .tip[hidden] { display: none; }
    .tip strong { display: block; }
    @media (prefers-reduced-motion: reduce) { .bar { transition: none; } }
  `;

  class LWTWaterfall extends window.LWT.Element {
    static get observedAttributes() {
      return ['title', 'legend-position', 'grid', 'x-label', 'y-label', 'hide-values', 'no-connectors',
              'value-prefix', 'value-suffix', 'increase-label', 'decrease-label', 'total-label', 'palette'];
    }

    static get observedProps() { return ['data', 'palette']; }

    constructor() {
      super();
      this._data = null;
      var self = this;
      // One set of listeners on the shadow root survives every re-render.
      this._root.addEventListener('pointermove', function (e) { self._onHover(e); });
      this.addEventListener('pointerleave', function () { self._hideTip(); });
    }

    get data() { return this._data; }
    set data(value) {
      this._data = value;
      if (this._root) this.render();
    }

    // Normalise either data shape into [{ label, kind, start, end, change, total, color }].
    _steps() {
      var d = this._data || {};
      var items;
      if (Array.isArray(d.items)) {
        items = d.items;
      } else if (Array.isArray(d.labels)) {
        var values = (d.datasets && d.datasets[0] && d.datasets[0].data) || [];
        var totals = Array.isArray(d.totals) ? d.totals : [];
        items = d.labels.map(function (label, i) {
          var it = { label: label, value: values[i] };
          if (totals.indexOf(i) !== -1) it.type = 'total';
          return it;
        });
      } else {
        items = [];
      }
      var running = 0;
      return items.map(function (it) {
        var isTotal = it.type === 'total' || it.type === 'subtotal';
        var hasValue = it.value !== undefined && it.value !== null && it.value !== '' && !isNaN(Number(it.value));
        var v = hasValue ? Number(it.value) : 0;
        if (isTotal) {
          if (hasValue) running = v;
          return { label: it.label == null ? '' : String(it.label), kind: 'total', start: 0, end: running, change: null, total: running, color: it.color };
        }
        var start = running;
        running += v;
        return { label: it.label == null ? '' : String(it.label), kind: v >= 0 ? 'up' : 'down', start: start, end: running, change: v, total: running, color: it.color };
      });
    }

    _fmt(n, signed) {
      var pre = this._strAttr('value-prefix', ''), suf = this._strAttr('value-suffix', '');
      var sign = signed ? (n > 0 ? '+' : n < 0 ? MINUS : '') : (n < 0 ? MINUS : '');
      return sign + pre + fmtNumber(Math.abs(n)) + suf;
    }

    render() {
      var a11y = window.LWT.a11y;
      this._chartName = this._a11yName([this._strAttr('title', '')], 'Waterfall chart', 'Add a title attribute');
      this._stepsCache = this._steps();
      var self = this;
      var rows = this._stepsCache.map(function (s) {
        return [s.label || '', s.kind === 'total' ? self._labelFor('total') : self._fmt(s.change, true), self._fmt(s.total, false)];
      });
      var table = rows.length ? a11y.dataTableHtml(this._chartName, ['Step', 'Change', 'Running total'], rows) : '';
      this._hasTable = !!table;
      // Custom palette: [increase, decrease, total].
      var pal = window.LWT.chart.resolve(this, null), palCss = '';
      if (pal.custom) {
        ['--wf-up', '--wf-down', '--wf-total'].forEach(function (v, i) { if (pal[i]) palCss += v + ':' + pal[i].stroke + ';'; });
        palCss = '<style>:host{' + palCss + '}</style>';
      }
      this._renderShadow(palCss + '<div class="chart-wrap" part="wrap">' + this._buildSvg() + table + '</div>' +
        '<div class="tip" part="tooltip" hidden></div>', CSS + a11y.SR_ONLY_CSS);
      this._svg = this._root.querySelector('svg');
      this._tip = this._root.querySelector('.tip');
    }

    _labelFor(kind) {
      if (kind === 'up') return this._strAttr('increase-label', 'Increase');
      if (kind === 'down') return this._strAttr('decrease-label', 'Decrease');
      return this._strAttr('total-label', 'Total');
    }

    _measureText(text, fontSize) {
      if (!LWTWaterfall._ctx) LWTWaterfall._ctx = document.createElement('canvas').getContext('2d');
      LWTWaterfall._ctx.font = fontSize + 'px sans-serif';
      return LWTWaterfall._ctx.measureText(String(text)).width;
    }

    // Up to two lines that fit `maxW`; the rest is ellipsised.
    _wrap(text, maxW) {
      var self = this;
      if (this._measureText(text, 11) <= maxW) return [text];
      var words = text.split(/\s+/), lines = [''];
      words.forEach(function (w) {
        var cur = lines[lines.length - 1];
        var next = cur ? cur + ' ' + w : w;
        if (self._measureText(next, 11) <= maxW || !cur) lines[lines.length - 1] = next;
        else lines.push(w);
      });
      if (lines.length > 2) lines = [lines[0], lines.slice(1).join(' ')];
      return lines.map(function (l) {
        if (self._measureText(l, 11) <= maxW) return l;
        while (l.length > 1 && self._measureText(l + '…', 11) > maxW) l = l.slice(0, -1);
        return l + '…';
      });
    }

    _buildSvg() {
      var self = this;
      var steps = this._stepsCache;
      var title = this._strAttr('title', '');
      var legendPos = this._strAttr('legend-position', 'top');
      var grid = this._strAttr('grid', 'horizontal');
      var xLabel = this._strAttr('x-label', ''), yLabel = this._strAttr('y-label', '');
      var showValues = !this._boolAttr('hide-values');
      var connectors = !this._boolAttr('no-connectors');

      var lo = 0, hi = 0;
      steps.forEach(function (s) { lo = Math.min(lo, s.start, s.end); hi = Math.max(hi, s.start, s.end); });
      var scale = computeScale(lo, hi, 7);

      var VBW = 640, VBH = 400, PAD = 14;
      var titleH = title ? 30 : 0;
      var legendH = legendPos === 'top' || legendPos === 'bottom' ? 22 : 0;
      var maxTickW = 0;
      scale.ticks.forEach(function (t) { maxTickW = Math.max(maxTickW, self._measureText(self._fmt(t, false), 11)); });

      var n = steps.length;
      var left = PAD + (yLabel ? 16 : 0) + maxTickW + 10;
      var right = PAD;
      var top = PAD + titleH + (legendPos === 'top' ? legendH : 0) + (showValues ? 14 : 4);
      // Category labels may wrap onto 2 lines.
      var band0 = n ? (VBW - left - right) / n : 0;
      var wrapped = steps.map(function (s) { return self._wrap(s.label, Math.max(24, band0 - 6)); });
      var labelLines = wrapped.reduce(function (m, l) { return Math.max(m, l.length); }, 1);
      var bottom = PAD + 6 + labelLines * 13 + (xLabel ? 18 : 0) + (legendPos === 'bottom' ? legendH : 0);

      var plotLeft = left, plotTop = top, plotRight = VBW - right, plotBottom = VBH - bottom;
      var plotW = Math.max(10, plotRight - plotLeft), plotH = Math.max(10, plotBottom - plotTop);
      var band = n ? plotW / n : 0;
      var barW = band * 0.62, barPad = (band - barW) / 2;
      var y = function (v) { return plotBottom - (v - scale.min) / (scale.max - scale.min) * plotH; };

      // grid + ticks
      var gridSvg = '', tickSvg = '';
      scale.ticks.forEach(function (t) {
        var ty = y(t);
        if (grid !== 'none') gridSvg += '<line class="' + (t === 0 ? 'zero-line' : 'grid-line') + '" x1="' + plotLeft + '" y1="' + ty.toFixed(2) + '" x2="' + plotRight + '" y2="' + ty.toFixed(2) + '"></line>';
        tickSvg += '<text class="axis-text" x="' + (plotLeft - 8) + '" y="' + (ty + 4).toFixed(2) + '" text-anchor="end">' + escapeXml(self._fmt(t, false)) + '</text>';
      });
      if (grid === 'none' && scale.min < 0) {
        gridSvg += '<line class="zero-line" x1="' + plotLeft + '" y1="' + y(0).toFixed(2) + '" x2="' + plotRight + '" y2="' + y(0).toFixed(2) + '"></line>';
      }
      wrapped.forEach(function (lines, i) {
        var cx = plotLeft + band * (i + 0.5);
        lines.forEach(function (l, li) {
          tickSvg += '<text class="axis-text" x="' + cx.toFixed(2) + '" y="' + (plotBottom + 16 + li * 13) + '" text-anchor="middle">' + escapeXml(l) + '</text>';
        });
      });

      // bars, connectors, values, hit areas
      var barsSvg = '', connSvg = '', valSvg = '', hitSvg = '';
      steps.forEach(function (s, i) {
        var x = plotLeft + band * i + barPad;
        var y1 = y(Math.max(s.start, s.end)), y2 = y(Math.min(s.start, s.end));
        var h = Math.max(1, y2 - y1); // a zero change still shows a hairline
        var style = s.color ? ' style="stroke:' + escapeXml(s.color) + ';fill:color-mix(in srgb, ' + escapeXml(s.color) + ' 35%, var(--wf-surface))"' : '';
        barsSvg += '<rect class="bar ' + s.kind + '" data-i="' + i + '" x="' + x.toFixed(2) + '" y="' + y1.toFixed(2) + '" width="' + barW.toFixed(2) +
          '" height="' + h.toFixed(2) + '" rx="2"' + style + '></rect>';
        hitSvg += '<rect class="hit" data-i="' + i + '" x="' + (plotLeft + band * i).toFixed(2) + '" y="' + plotTop + '" width="' + band.toFixed(2) + '" height="' + plotH.toFixed(2) + '"></rect>';
        if (connectors && i < n - 1) {
          var cy = y(s.end);
          connSvg += '<line class="connector" x1="' + (x + barW).toFixed(2) + '" y1="' + cy.toFixed(2) + '" x2="' + (x + band).toFixed(2) + '" y2="' + cy.toFixed(2) + '"></line>';
        }
        if (showValues) {
          var text = s.kind === 'total' ? self._fmt(s.total, false) : self._fmt(s.change, true);
          // Above the bar, or below it when the bar hangs below zero.
          var below = (s.kind === 'down' && s.end < 0) || (s.kind === 'total' && s.total < 0);
          var ty = below ? y2 + 13 : y1 - 5;
          valSvg += '<text class="value-text" x="' + (x + barW / 2).toFixed(2) + '" y="' + ty.toFixed(2) + '" text-anchor="middle">' + escapeXml(text) + '</text>';
        }
      });

      var borderSvg = '<rect class="plot-border" x="' + plotLeft + '" y="' + plotTop + '" width="' + plotW.toFixed(2) + '" height="' + plotH.toFixed(2) + '"></rect>';

      // legend: only the kinds actually present
      var legendSvg = '';
      if (legendH && n) {
        var kinds = ['up', 'down', 'total'].filter(function (k) { return steps.some(function (s) { return s.kind === k; }); });
        var widths = kinds.map(function (k) { return 18 + self._measureText(self._labelFor(k), 11) + 18; });
        var lx = (VBW - widths.reduce(function (a, b) { return a + b; }, 0)) / 2;
        var ly = legendPos === 'top' ? PAD + titleH + 14 : VBH - PAD - 4;
        kinds.forEach(function (k, i) {
          legendSvg += '<rect class="bar ' + k + '" x="' + lx.toFixed(2) + '" y="' + (ly - 10) + '" width="12" height="12" rx="2"></rect>';
          legendSvg += '<text class="legend-text" x="' + (lx + 18).toFixed(2) + '" y="' + ly + '">' + escapeXml(self._labelFor(k)) + '</text>';
          lx += widths[i];
        });
      }

      var titleSvg = title ? '<text class="chart-title" x="' + (VBW / 2) + '" y="' + (PAD + 20) + '" text-anchor="middle">' + escapeXml(title) + '</text>' : '';
      var xLabelSvg = xLabel ? '<text class="axis-title" x="' + ((plotLeft + plotRight) / 2) + '" y="' + (VBH - PAD - (legendPos === 'bottom' ? legendH : 0)) + '" text-anchor="middle">' + escapeXml(xLabel) + '</text>' : '';
      var yLabelSvg = yLabel ? '<text class="axis-title" x="0" y="0" text-anchor="middle" transform="translate(' + (PAD + 10) + ',' + ((plotTop + plotBottom) / 2) + ') rotate(-90)">' + escapeXml(yLabel) + '</text>' : '';

      return '<svg viewBox="0 0 ' + VBW + ' ' + VBH + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' +
        escapeXml((this._chartName || 'Waterfall chart') + (this._hasTable ? ', data table follows' : ', no data')) + '">' +
        titleSvg + legendSvg + gridSvg + borderSvg + connSvg + barsSvg + valSvg + tickSvg + xLabelSvg + yLabelSvg + hitSvg +
        '</svg>';
    }

    // ---- hover tooltip ----
    _onHover(e) {
      var hit = e.target && e.target.closest ? e.target.closest('.hit') : null;
      if (!hit || !this._svg) { this._hideTip(); return; }
      var i = +hit.getAttribute('data-i');
      var s = this._stepsCache[i];
      if (!s) return;
      var bar = this._svg.querySelector('.bar[data-i="' + i + '"]');
      this._svg.classList.add('hovering');
      Array.prototype.forEach.call(this._svg.querySelectorAll('.bar.hover'), function (b) { b.classList.remove('hover'); });
      if (bar) bar.classList.add('hover');
      var esc = window.LWT.a11y.escape;
      this._tip.innerHTML = '<strong>' + esc(s.label) + '</strong>' +
        (s.kind === 'total'
          ? esc(this._labelFor('total')) + ': ' + esc(this._fmt(s.total, false))
          : esc(this._labelFor(s.kind)) + ': ' + esc(this._fmt(s.change, true)) + '<br>Running total: ' + esc(this._fmt(s.total, false)));
      this._tip.hidden = false;
      var host = this.getBoundingClientRect();
      var r = (bar || hit).getBoundingClientRect();
      var x = r.left + r.width / 2 - host.left;
      var half = this._tip.offsetWidth / 2;
      x = Math.max(half + 4, Math.min(host.width - half - 4, x)); // keep it inside the chart
      this._tip.style.left = x + 'px';
      this._tip.style.top = Math.max(this._tip.offsetHeight + 12, r.top - host.top) + 'px';
    }

    _hideTip() {
      if (this._tip) this._tip.hidden = true;
      if (this._svg) {
        this._svg.classList.remove('hovering');
        Array.prototype.forEach.call(this._svg.querySelectorAll('.bar.hover'), function (b) { b.classList.remove('hover'); });
      }
    }
  }

  window.LWT.chart.withPalette(LWTWaterfall);
  window.LWT.define('lwtd-waterfall', LWTWaterfall);
})();

