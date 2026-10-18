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
