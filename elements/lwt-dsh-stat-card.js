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
