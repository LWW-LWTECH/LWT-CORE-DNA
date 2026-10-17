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
    { fill: '#93c5fd', stroke: '#3b82f6' },
    { fill: '#f9a8d4', stroke: '#ec4899' },
    { fill: '#86efac', stroke: '#22c55e' },
    { fill: '#fcd34d', stroke: '#f59e0b' },
    { fill: '#c4b5fd', stroke: '#8b5cf6' },
    { fill: '#67e8f9', stroke: '#06b6d4' },
    { fill: '#fda4af', stroke: '#f43f5e' },
    { fill: '#fdba74', stroke: '#f97316' }
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
