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
    { fill: '#93c5fd', stroke: '#3b82f6' }, // blue
    { fill: '#f9a8d4', stroke: '#ec4899' }, // pink
    { fill: '#86efac', stroke: '#22c55e' }, // green
    { fill: '#fcd34d', stroke: '#f59e0b' }, // amber
    { fill: '#c4b5fd', stroke: '#8b5cf6' }, // violet
    { fill: '#67e8f9', stroke: '#06b6d4' }, // cyan
    { fill: '#fda4af', stroke: '#f43f5e' }, // rose
    { fill: '#fdba74', stroke: '#f97316' }  // orange
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
