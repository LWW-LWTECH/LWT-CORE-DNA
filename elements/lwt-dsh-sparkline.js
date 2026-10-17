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
