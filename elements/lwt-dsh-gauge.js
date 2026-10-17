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
