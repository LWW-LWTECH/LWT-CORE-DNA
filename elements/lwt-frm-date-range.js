/*!
 * <lwtf-date-range>
 * A booking-site-style date range picker: a compact trigger field that
 * opens a popup with a preset sidebar (Today / Yesterday / Last 7 days /
 * Last 15 days / Last Month / Custom), N side-by-side month calendars
 * with a shared prev/next pager, and an optional time-of-day range
 * slider for each end of the range. Apply commits the pick; clicking
 * outside or Escape discards it.
 *
 *   <!-- basic -->
 *   <lwtf-date-range label="Stay dates"></lwtf-date-range>
 *
 *   <!-- with an initial value, custom month count, bounds -->
 *   <lwtf-date-range label="Stay dates" months="2"
 *     value="2017-05-06,2017-05-22" min="2017-01-01" max="2017-12-31">
 *   </lwtf-date-range>
 *
 *   <!-- with the 00:00–23:59 time-of-day range slider -->
 *   <lwtf-date-range label="Booking window" time></lwtf-date-range>
 *
 *   <script>
 *     var el = document.querySelector('lwtf-date-range');
 *     el.value;                 // -> ["2017-05-06", "2017-05-22"] (or [] if unset)
 *     el.value = ['2017-05-06', '2017-05-22'];
 *     el.addEventListener('lwt-change', function (e) { console.log(e.detail.value); });
 *   </script>
 *
 * ---------------------------------------------------------------------
 * Attributes
 * ---------------------------------------------------------------------
 *   label, helper, error, placeholder — display / form basics
 *   value           — initial "start,end" pair (ISO dates, or ISO
 *                     datetimes like "2017-05-06T00:00" when `time` is
 *                     set); read once at connect (use .value after)
 *   name            — form field name
 *   months          — how many side-by-side calendars to show (default 2)
 *   time            — boolean; adds a 00:00–23:59 time-of-day range
 *                     slider per end, and .value entries become
 *                     "YYYY-MM-DDTHH:MM" instead of plain dates
 *   min, max        — ISO date bounds; days (and month navigation)
 *                     outside this range are disabled
 *   presets         — comma list overriding which preset shortcuts show
 *                     and in what order, from: today, yesterday, last7,
 *                     last15, lastmonth, custom. Default: all of them.
 *   no-presets      — boolean; hides the preset sidebar entirely
 *   required, disabled, readonly — standard form states
 *
 * ---------------------------------------------------------------------
 * Properties / methods
 * ---------------------------------------------------------------------
 *   .value                — get/set array [start, end] (empty array if
 *                            unset). Setting does not open the popup.
 *   .valueAsDates          — read-only [Date, Date] or [null, null]
 *   .setRange(start, end)  — programmatic set; start/end are Date
 *                            objects or ISO strings. {silent:true} to
 *                            skip events.
 *   .clear()               — empty the range
 *   .open() / .close() / .toggle() — popup control
 *   .checkValidity() / .reportValidity()
 *   .focus() / .blur()     — proxied to the trigger field
 *
 * ---------------------------------------------------------------------
 * Events
 * ---------------------------------------------------------------------
 *   lwtf-input   — every draft change while the popup is open (picking
 *                 a day, dragging a time handle); detail: { value }
 *                 (value reflects the in-progress draft, not yet applied)
 *   lwt-change  — Apply pressed (or .value/.setRange() called); detail: { value }
 *   lwt-preset  — a preset shortcut was picked; detail: { preset, value }
 *   lwt-open / lwt-close — popup opened/closed
 *
 * ---------------------------------------------------------------------
 * Form participation
 * ---------------------------------------------------------------------
 * Uses ElementInternals (formAssociated + setFormValue + setValidity) —
 * submits two form entries under `name` (start and end) via FormData,
 * same pattern as <lwtf-transfer-list>/<lwtf-choices multiple>. `required`
 * is satisfied only once both ends of the range are set.
 *
 * Timing note: none needed here — unlike <lwtf-transfer-list>/<lwtf-select>
 * this element has no light-DOM children to parse at connect, so there's
 * nothing for the parser-timing bug (see those files' headers) to bite.
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-frm-date-range.js requires lwt-core.js to be loaded first.');
  }

  var uid = 0;
  var supportsInternals = typeof HTMLElement !== 'undefined' && !!HTMLElement.prototype.attachInternals;

  var DAY_MS = 24 * 60 * 60 * 1000;
  var WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  var MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // Local-midnight Date for (y, m, d) — avoids UTC/local off-by-one drift.
  function makeDate(y, m, d) { return new Date(y, m, d, 0, 0, 0, 0); }

  function stripTime(date) { return makeDate(date.getFullYear(), date.getMonth(), date.getDate()); }

  function sameDay(a, b) {
    return !!a && !!b && a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function isBefore(a, b) { return stripTime(a).getTime() < stripTime(b).getTime(); }
  function isAfter(a, b) { return stripTime(a).getTime() > stripTime(b).getTime(); }
  function clampDate(date, min, max) {
    if (min && isBefore(date, min)) return min;
    if (max && isAfter(date, max)) return max;
    return date;
  }
  function inRange(d, lo, hi) {
    var t = stripTime(d).getTime();
    return t >= stripTime(lo).getTime() && t <= stripTime(hi).getTime();
  }

  // Calendar-day arithmetic (not n * 24h) so daylight-saving changes
  // can't shift the result onto the wrong date.
  function addDays(date, n) { return makeDate(date.getFullYear(), date.getMonth(), date.getDate() + n); }
  function addMonths(y, m, n) {
    var d = new Date(y, m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  }

  function isoDate(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  // Parses "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" -> { date: Date, time: 'HH:MM'|null }
  function parseISO(str) {
    if (!str) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(str).trim());
    if (!m) return null;
    var date = makeDate(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    var time = m[4] ? (pad2(parseInt(m[4], 10)) + ':' + pad2(parseInt(m[5], 10))) : null;
    return { date: date, time: time };
  }

  function formatDisplay(date) {
    return date.getDate() + ' ' + MONTH_LABELS[date.getMonth()].slice(0, 3) + ' ' + date.getFullYear();
  }

  function minutesToLabel(min) { return pad2(Math.floor(min / 60)) + ':' + pad2(min % 60); }
  function labelToMinutes(label) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(label || '').trim());
    if (!m) return 0;
    return Math.min(1439, Math.max(0, parseInt(m[1], 10) * 60 + parseInt(m[2], 10)));
  }

  var ALL_PRESETS = [
    { key: 'today', label: 'Today', range: function (today) { return [today, today]; } },
    { key: 'yesterday', label: 'Yesterday', range: function (today) { var y = addDays(today, -1); return [y, y]; } },
    { key: 'last7', label: 'Last 7 days', range: function (today) { return [addDays(today, -6), today]; } },
    { key: 'last15', label: 'Last 15 days', range: function (today) { return [addDays(today, -14), today]; } },
    { key: 'lastmonth', label: 'Last Month', range: function (today) {
      var prev = addMonths(today.getFullYear(), today.getMonth(), -1);
      var first = makeDate(prev.y, prev.m, 1);
      var last = makeDate(prev.y, prev.m + 1, 0);
      return [first, last];
    } },
    { key: 'custom', label: 'Custom', range: null }
  ];
  var PRESET_BY_KEY = {};
  ALL_PRESETS.forEach(function (p) { PRESET_BY_KEY[p.key] = p; });

  var TEMPLATE =
    '<div class="field-label" part="label">' +
    '  <span class="label-text" part="label-text"></span>' +
    '  <span class="required-mark" part="required">*</span>' +
    '</div>' +
    '<div class="trigger-box" part="trigger" tabindex="0" role="button" aria-haspopup="dialog" aria-expanded="false">' +
    '  <svg class="cal-icon" part="icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
    '    <path fill="currentColor" d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1zM4 9v11h16V9H4z"/>' +
    '  </svg>' +
    '  <span class="trigger-text" part="trigger-text"></span>' +
    '</div>' +
    '<div class="popup" part="popup" role="dialog">' +
    '  <div class="popup-inner">' +
    '    <div class="presets" part="presets"></div>' +
    '    <div class="calendars-pane" part="calendars-pane">' +
    '      <div class="range-heading" part="heading" aria-live="polite"></div>' +
    '      <div class="cal-nav" part="cal-nav">' +
    '        <button type="button" class="nav prev" part="nav-prev" aria-label="Previous month">&#8249;</button>' +
    '        <button type="button" class="nav next" part="nav-next" aria-label="Next month">&#8250;</button>' +
    '      </div>' +
    '      <div class="calendars-row" part="calendars-row"></div>' +
    '      <div class="time-row" part="time-row"></div>' +
    '      <div class="apply-row apply-row-inline" part="apply-row-inline"><button type="button" class="apply-btn" part="apply">Apply</button></div>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="below" part="below">' +
    '  <span class="helper" part="helper"></span>' +
    '</div>';

  var CSS = `
    :host {
      display: inline-block;
      color: inherit;
      font-family: inherit;
      position: relative;
      box-sizing: border-box;
    }
    :host([hidden]) { display: none; }
    * { box-sizing: border-box; }
    .field-label {
      display: flex;
      gap: 0.2rem;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 0.3rem;
      color: var(--lwt-daterange-label-color, var(--lwt-color-text, #111827));
    }
    .field-label:empty, .label-text:empty { display: none; }
    .required-mark { color: var(--lwt-color-danger, #ef4444); display: none; }
    :host([required]) .required-mark { display: inline; }
    :host([required]) .field-label:has(.label-text:empty) .required-mark { display: none; }
    .trigger-box {
      display: inline-flex;
      align-items: center;
      gap: var(--lwt-daterange-gap, var(--lwt-gap, 0.5rem));
      min-width: 220px;
      padding: var(--lwt-daterange-padding, var(--lwt-padding, 0.5rem 0.7rem));
      border-radius: var(--lwt-daterange-radius, var(--lwt-border-radius, 6px));
      cursor: pointer;
      font-size: 0.95rem;
      background: var(--lwt-daterange-bg, var(--lwt-color-surface, #fff));
      border: var(--lwt-daterange-border, var(--lwt-border, 1px solid #d1d5db));
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .trigger-box:focus-visible, .trigger-box.open {
      border-color: var(--lwt-daterange-focus-color, var(--lwt-focus-color, #2563eb));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--lwt-daterange-focus-color, var(--lwt-focus-color, #2563eb)) 22%, transparent);
      outline: none;
    }
    :host([disabled]) .trigger-box {
      opacity: 0.6;
      cursor: not-allowed;
      background: var(--lwt-color-surface-muted, #f3f4f6);
    }
    :host([readonly]) .trigger-box { cursor: default; }
    :host([data-invalid]) .trigger-box {
      border-color: var(--lwt-daterange-error-color, var(--lwt-color-danger, #ef4444));
    }
    .cal-icon { flex-shrink: 0; color: var(--lwt-color-text-muted, #6b7280); }
    .trigger-text {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .trigger-text.placeholder { color: var(--lwt-color-text-muted, #6b7280); }
    .popup {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      z-index: 20;
      display: none;
      background: var(--lwt-daterange-bg, var(--lwt-color-surface, #fff));
      border: 1px solid var(--lwt-color-border-strong, #d1d5db);
      border-radius: var(--lwt-daterange-popup-radius, var(--lwt-border-radius, 8px));
      box-shadow: 0 12px 28px var(--lwt-color-shadow, rgba(0,0,0,0.18));
    }
    .popup.open { display: block; }
    .popup-inner { display: flex; align-items: stretch; }
    .presets {
      display: flex;
      flex-direction: column;
      width: 150px;
      border-right: 1px solid var(--lwt-border-color, #e5e7eb);
      padding: 0.5rem 0;
    }
    :host([no-presets]) .presets { display: none; }
    .preset-btn {
      all: unset;
      box-sizing: border-box;
      padding: 0.6rem 1rem;
      font-size: 0.88rem;
      cursor: pointer;
      color: var(--lwt-color-text, #111827);
    }
    .preset-btn:hover { background: var(--lwt-color-surface-muted, #f3f4f6); }
    .preset-btn.active {
      color: var(--lwt-daterange-accent, var(--lwt-color-primary, #2563eb));
      font-weight: 600;
      background: var(--lwt-daterange-accent-soft, var(--lwt-color-primary-soft, #eff6ff));
    }
    .presets .apply-row { padding: 0.6rem 1rem 0.2rem; }
    .apply-btn {
      all: unset;
      box-sizing: border-box;
      display: block;
      width: 100%;
      text-align: center;
      padding: 0.55rem 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      background: var(--lwt-daterange-accent, var(--lwt-color-primary, #2563eb));
      color: #fff;
    }
    .apply-btn:hover { filter: brightness(1.08); }
    .apply-row-inline { display: none; padding: 0.5rem 1rem 0.75rem; }
    :host([no-presets]) .apply-row-inline { display: block; }
    .calendars-pane { position: relative; padding: 0.85rem 1rem 0.75rem; min-width: 300px; }
    .range-heading {
      text-align: center;
      font-weight: 700;
      font-size: 1rem;
      margin-bottom: 0.6rem;
    }
    .cal-nav {
      position: absolute;
      top: 0.85rem;
      right: 1rem;
      display: flex;
      gap: 0.3rem;
    }
    .nav {
      all: unset;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.6rem;
      height: 1.6rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      background: var(--lwt-daterange-accent, var(--lwt-color-primary, #2563eb));
      color: #fff;
    }
    .nav:hover { filter: brightness(1.08); }
    .nav:disabled { opacity: 0.4; cursor: not-allowed; }
    .calendars-row { display: flex; gap: 1.5rem; }
    .calendar { width: 210px; }
    .cal-title {
      display: block;
      text-align: left;
      font-weight: 700;
      font-size: 0.85rem;
      margin-bottom: 0.4rem;
    }
    .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .cal-weekday {
      text-align: center;
      font-size: 0.72rem;
      color: var(--lwt-color-text-muted, #6b7280);
      padding: 0.2rem 0;
    }
    .day {
      all: unset;
      box-sizing: border-box;
      text-align: center;
      font-size: 0.82rem;
      padding: 0.35rem 0;
      border-radius: 999px;
      cursor: pointer;
      color: var(--lwt-color-text, #111827);
    }
    .day:hover:not(:disabled) { background: var(--lwt-color-surface-muted, #f3f4f6); }
    .day.outside { color: var(--lwt-color-text-muted, #d1d5db); }
    .day:disabled { color: var(--lwt-color-text-muted, #e5e7eb); cursor: not-allowed; }
    .day.in-range {
      border-radius: 0;
      background: var(--lwt-daterange-range-bg, var(--lwt-color-primary-soft, #dbeafe));
    }
    .day.range-start {
      border-radius: 999px 0 0 999px;
      background: var(--lwt-daterange-range-bg, var(--lwt-color-primary-soft, #dbeafe));
    }
    .day.range-end {
      border-radius: 0 999px 999px 0;
      background: var(--lwt-daterange-range-bg, var(--lwt-color-primary-soft, #dbeafe));
    }
    .day.range-start.range-end { border-radius: 999px; }
    .day.range-start .day-num, .day.range-end .day-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.8em;
      height: 1.8em;
      border-radius: 999px;
      background: var(--lwt-daterange-accent, var(--lwt-color-primary, #2563eb));
      color: #fff;
    }
    .time-row {
      display: none;
      margin-top: 0.9rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--lwt-border-color, #e5e7eb);
    }
    :host([time]) .time-row { display: block; }
    .time-track { position: relative; height: 2.2rem; }
    .time-line {
      position: absolute;
      left: 0.7rem;
      right: 0.7rem;
      top: 50%;
      height: 2px;
      transform: translateY(-50%);
      background: var(--lwt-color-border-strong, #d1d5db);
      border-radius: 2px;
    }
    .time-fill {
      position: absolute;
      top: 50%;
      height: 2px;
      transform: translateY(-50%);
      background: var(--lwt-daterange-accent, var(--lwt-color-primary, #2563eb));
      border-radius: 2px;
    }
    .time-range {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      -webkit-appearance: none;
      appearance: none;
      background: transparent;
      pointer-events: none;
    }
    .time-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      pointer-events: auto;
      width: 1.6rem;
      height: 1.6rem;
      border-radius: 999px;
      background: var(--lwt-daterange-accent, var(--lwt-color-primary, #2563eb));
      cursor: pointer;
      margin-top: 0;
    }
    .time-range::-moz-range-thumb {
      pointer-events: auto;
      width: 1.6rem;
      height: 1.6rem;
      border: none;
      border-radius: 999px;
      background: var(--lwt-daterange-accent, var(--lwt-color-primary, #2563eb));
      cursor: pointer;
    }
    .time-range::-webkit-slider-runnable-track { background: transparent; }
    .time-label {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      font-size: 0.68rem;
      font-weight: 700;
      color: #fff;
    }
    .below {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin-top: 0.3rem;
      font-size: 0.78rem;
      min-height: 1rem;
    }
    .helper { flex: 1; color: var(--lwt-daterange-helper-color, var(--lwt-color-text-muted, #6b7280)); }
    .helper.error { color: var(--lwt-daterange-error-color, var(--lwt-color-danger, #ef4444)); }
    .helper:empty { display: none; }
  `;

  class LWTDateRange extends window.LWT.Element {
    static get observedAttributes() {
      return ['label', 'helper', 'error', 'placeholder', 'name', 'months', 'time',
              'min', 'max', 'presets', 'no-presets', 'required', 'disabled', 'readonly', 'aria-label', 'aria-labelledby'];
    }

    constructor() {
      super();

      if (supportsInternals) {
        try { this._internals = this.attachInternals(); }
        catch (e) { this._internals = null; }
      }

      this._initialized = false;
      this._isOpen = false;

      // Committed (applied) value.
      this._start = null;
      this._end = null;
      this._startTime = '00:00';
      this._endTime = '23:59';

      // Draft (in-progress, inside the open popup) value.
      this._draftStart = null;
      this._draftEnd = null;
      this._draftStartTime = '00:00';
      this._draftEndTime = '23:59';
      this._pickingEnd = false;
      this._hoverDate = null;
      this._activePreset = null;

      var today = stripTime(new Date());
      this._viewYear = today.getFullYear();
      this._viewMonth = today.getMonth();

      this._onTriggerClick = this._onTriggerClick.bind(this);
      this._onTriggerKeydown = this._onTriggerKeydown.bind(this);
      this._onDocClick = this._onDocClick.bind(this);
      this._onDocKeydown = this._onDocKeydown.bind(this);
      this._onPrev = this._onPrev.bind(this);
      this._onNext = this._onNext.bind(this);
      this._onApply = this._onApply.bind(this);
      this._onTimeStartInput = this._onTimeStartInput.bind(this);
      this._onTimeEndInput = this._onTimeEndInput.bind(this);
    }

    connectedCallback() {
      super.connectedCallback();
      // Read-only classification attribute — see lwt-frm-choices.js for
      // the convention every lwtf- element follows.
      this.setAttribute('control-type', 'daterange');

      if (!this._initialized) {
        this._initialized = true;
        var parsed = this._parseValueAttr(this._strAttr('value', ''));
        if (parsed) {
          this._start = parsed.start; this._end = parsed.end;
          this._startTime = parsed.startTime; this._endTime = parsed.endTime;
          this._viewYear = this._start.getFullYear();
          this._viewMonth = this._start.getMonth();
        }
        this._syncTrigger();
        this._reportValue();
        this._reportValidity();
      }

      document.addEventListener('mousedown', this._onDocClick);
      document.addEventListener('keydown', this._onDocKeydown);
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      document.removeEventListener('mousedown', this._onDocClick);
      document.removeEventListener('keydown', this._onDocKeydown);
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (!this._trigger) return; // not rendered yet
      if (name === 'months' || name === 'presets' || name === 'no-presets') {
        this._buildPresets();
        if (this._isOpen) this._renderCalendars();
      } else if (name === 'min' || name === 'max') {
        if (this._isOpen) this._renderCalendars();
      } else {
        this._syncAttrs();
      }
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      var root = this._root;
      this._labelEl = root.querySelector('.field-label');
      this._labelText = root.querySelector('.label-text');
      this._trigger = root.querySelector('.trigger-box');
      this._triggerText = root.querySelector('.trigger-text');
      this._popup = root.querySelector('.popup');
      this._presetsEl = root.querySelector('.presets');
      this._headingEl = root.querySelector('.range-heading');
      this._calRow = root.querySelector('.calendars-row');
      this._timeRow = root.querySelector('.time-row');
      this._prevBtn = root.querySelector('.nav.prev');
      this._nextBtn = root.querySelector('.nav.next');
      this._helperEl = root.querySelector('.helper');
      this._inlineApplyBtn = root.querySelector('.apply-row-inline .apply-btn');

      this._id = 'lwt-daterange-' + (++uid);
      this._popup.id = this._id + '-popup';
      this._helperEl.id = this._id + '-helper';
      this._trigger.setAttribute('aria-controls', this._popup.id);
      this._calRow.addEventListener('keydown', this._onCalendarKeydown.bind(this));

      this._trigger.addEventListener('click', this._onTriggerClick);
      this._trigger.addEventListener('keydown', this._onTriggerKeydown);
      this._prevBtn.addEventListener('click', this._onPrev);
      this._nextBtn.addEventListener('click', this._onNext);
      this._inlineApplyBtn.addEventListener('click', this._onApply);
      this._popup.addEventListener('mousedown', function (e) { e.stopPropagation(); });
      this._calRow.addEventListener('mouseleave', (function () {
        if (!this._hoverDate) return;
        this._hoverDate = null;
        this._refreshDayClasses();
      }).bind(this));

      this._buildPresets();
      this._buildTimeRow();
      this._syncAttrs();
    }

    // ---- attribute -> DOM sync ----
    _syncAttrs() {
      var label = this._strAttr('label', '');
      var helper = this._strAttr('helper', '');
      var error = this._strAttr('error', '');
      var required = this._boolAttr('required');
      var disabled = this._boolAttr('disabled');
      var readonly = this._boolAttr('readonly');

      this._labelText.textContent = label;
      this.toggleAttribute('required', required);

      var errorMsg = error || (this._internals && this._internals.validationMessage) || '';
      this._helperEl.textContent = error || helper;
      this._helperEl.classList.toggle('error', !!error);
      this.toggleAttribute('data-invalid', !!error);

      this._trigger.tabIndex = disabled ? -1 : 0;
      this._trigger.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      if (required) this._trigger.setAttribute('aria-required', 'true'); else this._trigger.removeAttribute('aria-required');
      if (error) this._trigger.setAttribute('aria-invalid', 'true'); else this._trigger.removeAttribute('aria-invalid');
      if (error || helper) this._trigger.setAttribute('aria-describedby', this._helperEl.id);
      else this._trigger.removeAttribute('aria-describedby');
      this._popup.setAttribute('aria-label', 'Choose ' + this._a11yName([label], 'Date range', 'Add a label attribute').toLowerCase());
      if (disabled || readonly) this._close();

      this._syncTrigger();
      this._reportValidity();
    }

    _syncTrigger() {
      if (!this._triggerText) return;
      this._syncTriggerName();
      if (this._start && this._end) {
        var text = formatDisplay(this._start) + ' - ' + formatDisplay(this._end);
        if (this._boolAttr('time')) {
          text = formatDisplay(this._start) + ' ' + this._startTime + ' - ' + formatDisplay(this._end) + ' ' + this._endTime;
        }
        this._triggerText.textContent = text;
        this._triggerText.classList.remove('placeholder');
      } else {
        this._triggerText.textContent = this._strAttr('placeholder', 'Select date range');
        this._triggerText.classList.add('placeholder');
      }
      this._syncTriggerName();
    }

    // The trigger is announced as "<label>, <current range>" (or
    // "<label>, no dates selected") -- WCAG 4.1.2 name + value.
    _syncTriggerName() {
      var name = this._a11yName([this._strAttr('label', '')], 'Date range', 'Add a label attribute');
      var value = this._start && this._end ? this._triggerText.textContent : 'no dates selected';
      this._trigger.setAttribute('aria-label', name + ', ' + value);
    }

    // Spoken form of a date, e.g. "Friday, November 6, 2026".
    _spokenDate(date) {
      var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return DAYS[date.getDay()] + ', ' + MONTH_LABELS[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
    }

    // ---- calendar keyboard navigation (roving tabindex) ----
    // One day button is in the Tab order; arrows move by day/week,
    // Home/End to week start/end, PageUp/PageDown by month.
    _focusableDayFor(target) {
      var cells = (this._dayCells || []).filter(function (c) { return !c.outside && !c.el.disabled; });
      if (!cells.length) return null;
      var exact = cells.filter(function (c) { return target && sameDay(c.date, target); })[0];
      return exact || null;
    }

    _syncDayTabStops(preferred) {
      if (!this._dayCells) return null;
      var cells = this._dayCells.filter(function (c) { return !c.outside && !c.el.disabled; });
      var today = stripTime(new Date());
      var pick = (preferred && this._focusableDayFor(preferred)) ||
        this._focusableDayFor(this._draftStart) || this._focusableDayFor(today) || cells[0] || null;
      this._dayCells.forEach(function (c) { c.el.tabIndex = -1; });
      if (pick) pick.el.tabIndex = 0;
      return pick;
    }

    _onCalendarKeydown(e) {
      var cell = (this._dayCells || []).filter(function (c) { return c.el === e.target; })[0];
      if (!cell) return;
      var date = cell.date, next = null;
      switch (e.key) {
        case 'ArrowLeft': next = addDays(date, -1); break;
        case 'ArrowRight': next = addDays(date, 1); break;
        case 'ArrowUp': next = addDays(date, -7); break;
        case 'ArrowDown': next = addDays(date, 7); break;
        case 'Home': next = addDays(date, -date.getDay()); break;
        case 'End': next = addDays(date, 6 - date.getDay()); break;
        case 'PageUp': next = makeDate(date.getFullYear(), date.getMonth() - 1, Math.min(date.getDate(), 28)); break;
        case 'PageDown': next = makeDate(date.getFullYear(), date.getMonth() + 1, Math.min(date.getDate(), 28)); break;
        default: return;
      }
      e.preventDefault();
      var bounds = this._bounds();
      next = clampDate(next, bounds.min, bounds.max);
      if (!this._focusableDayFor(next)) {
        // Off the visible months: page the view so `next` is shown.
        this._viewYear = next.getFullYear();
        this._viewMonth = next.getMonth();
        if (isBefore(next, date)) {
          var back = addMonths(this._viewYear, this._viewMonth, -(this._monthsCount() - 1));
          this._viewYear = back.y; this._viewMonth = back.m;
        }
        this._clampView();
        this._renderCalendars();
      }
      var target = this._syncDayTabStops(next);
      if (target) target.el.focus();
    }

    // ---- presets ----
    _buildPresets() {
      if (this._boolAttr('no-presets')) { this._presetsEl.innerHTML = ''; return; }
      var keys = this._strAttr('presets', '');
      var list = keys
        ? keys.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(function (k) { return PRESET_BY_KEY[k]; })
        : ALL_PRESETS.map(function (p) { return p.key; });

      var self = this;
      this._presetsEl.innerHTML = '';
      list.forEach(function (key) {
        var preset = PRESET_BY_KEY[key];
        var btn = self._genhtml({
          type: 'button',
          attr: { type: 'button', class: 'preset-btn', part: 'preset', 'data-key': key, 'aria-pressed': 'false' },
          text: preset.label,
          events: { click: function () { self._onPresetClick(key); } }
        });
        self._presetsEl.appendChild(btn);
      });
      var applyRow = this._genhtml({ type: 'div', attr: { class: 'apply-row', part: 'apply-row' } });
      var applyBtn = this._genhtml({
        type: 'button',
        attr: { type: 'button', class: 'apply-btn', part: 'apply' },
        text: 'Apply',
        events: { click: this._onApply }
      });
      applyRow.appendChild(applyBtn);
      this._presetsEl.appendChild(applyRow);
    }

    _onPresetClick(key) {
      this._activePreset = key;
      this._highlightPreset();
      var preset = PRESET_BY_KEY[key];
      if (preset.range) {
        var bounds = this._bounds();
        var today = stripTime(new Date());
        var range = preset.range(today);
        // Clamp into min/max: a preset like "Today" can fall outside a
        // narrower bound (e.g. min/max fixed to a past booking window),
        // and without clamping the view would jump to a month that's
        // entirely disabled — including after switching back to Custom,
        // since nothing would ever move the view back into range.
        this._draftStart = clampDate(range[0], bounds.min, bounds.max);
        this._draftEnd = clampDate(range[1], bounds.min, bounds.max);
        this._pickingEnd = false;
        this._viewYear = this._draftStart.getFullYear();
        this._viewMonth = this._draftStart.getMonth();
        this._renderCalendars();
        this._emitDraftInput();
      } else {
        // "custom" — leave any existing draft pick alone, just make sure
        // the visible view is actually inside min/max (a prior preset,
        // or the very first open with no draft yet, could have left it
        // outside), so the calendar isn't all-disabled with no way back.
        this._clampView();
        this._renderCalendars();
      }
      this.emit('preset', { preset: key, value: this._draftValueArray() });
    }

    // Keeps the visible (leftmost) calendar month inside [min, max].
    _clampView() {
      var bounds = this._bounds();
      if (!bounds.min && !bounds.max) return;
      var anchor = makeDate(this._viewYear, this._viewMonth, 1);
      var clamped = clampDate(anchor, bounds.min ? makeDate(bounds.min.getFullYear(), bounds.min.getMonth(), 1) : null,
                                        bounds.max ? makeDate(bounds.max.getFullYear(), bounds.max.getMonth(), 1) : null);
      this._viewYear = clamped.getFullYear();
      this._viewMonth = clamped.getMonth();
    }

    _highlightPreset() {
      var self = this;
      this._presetsEl.querySelectorAll('.preset-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.key === self._activePreset);
        btn.setAttribute('aria-pressed', btn.dataset.key === self._activePreset ? 'true' : 'false');
      });
    }

    // ---- calendars ----
    _monthsCount() {
      var n = parseInt(this._strAttr('months', '2'), 10);
      return (isNaN(n) || n < 1) ? 2 : n;
    }

    _bounds() {
      var min = parseISO(this._strAttr('min', ''));
      var max = parseISO(this._strAttr('max', ''));
      return { min: min ? min.date : null, max: max ? max.date : null };
    }

    _renderCalendars() {
      var self = this;
      var n = this._monthsCount();
      var bounds = this._bounds();
      this._calRow.innerHTML = '';
      // Rebuilt fresh on every real render (open/nav/pick), but NOT on
      // hover — see _onDayHover for why.
      this._dayCells = [];

      for (var i = 0; i < n; i++) {
        var anchor = addMonths(this._viewYear, this._viewMonth, i);
        this._calRow.appendChild(this._buildCalendar(anchor.y, anchor.m, bounds));
      }

      var firstAnchor = addMonths(this._viewYear, this._viewMonth, 0);
      var lastAnchor = addMonths(this._viewYear, this._viewMonth, n - 1);
      // Disable prev once the first calendar is already showing (or is
      // before) the min-bound month; disable next once the last calendar
      // is already showing (or is past) the max-bound month.
      this._prevBtn.disabled = !!(bounds.min &&
        (firstAnchor.y < bounds.min.getFullYear() ||
          (firstAnchor.y === bounds.min.getFullYear() && firstAnchor.m <= bounds.min.getMonth())));
      this._nextBtn.disabled = !!(bounds.max &&
        (lastAnchor.y > bounds.max.getFullYear() ||
          (lastAnchor.y === bounds.max.getFullYear() && lastAnchor.m >= bounds.max.getMonth())));

      var heading = (this._draftStart ? formatDisplay(this._draftStart) : '—') + ' - ' +
        (this._draftEnd ? formatDisplay(this._draftEnd) : '—');
      this._headingEl.textContent = heading;
      this._syncDayTabStops(this._lastFocusedDate);
    }

    _buildCalendar(y, m, bounds) {
      var self = this;
      var cal = this._genhtml({ type: 'div', attr: { class: 'calendar', part: 'calendar', role: 'group', 'aria-label': MONTH_LABELS[m] + ' ' + y } });
      var title = this._genhtml({
        type: 'span',
        attr: { class: 'cal-title', part: 'cal-title', 'aria-hidden': 'true' },
        text: MONTH_LABELS[m].slice(0, 3) + ' \'' + String(y).slice(2)
      });
      cal.appendChild(title);

      var grid = this._genhtml({ type: 'div', attr: { class: 'cal-grid', part: 'cal-grid' } });
      WEEKDAY_LABELS.forEach(function (wd, idx) {
        grid.appendChild(self._genhtml({ type: 'span', attr: { class: 'cal-weekday', part: 'weekday', 'aria-hidden': 'true' }, text: wd, data: { idx: idx } }));
      });

      var firstOfMonth = makeDate(y, m, 1);
      var startWeekday = firstOfMonth.getDay();
      var gridStart = addDays(firstOfMonth, -startWeekday);

      for (var i = 0; i < 42; i++) {
        var date = addDays(gridStart, i);
        grid.appendChild(this._buildDayCell(date, m, bounds));
      }

      cal.appendChild(grid);
      return cal;
    }

    // Computes the day-cell CSS classes for `date` given the current
    // draft/hover state. Shared by the initial build and the hover-only
    // refresh below, so both stay in sync from one place.
    _dayClasses(date, outside) {
      var draftStart = this._draftStart, draftEnd = this._draftEnd;
      var previewEnd = draftEnd || this._hoverDate;
      var isStart = draftStart && sameDay(date, draftStart);
      var isEnd = draftEnd && sameDay(date, draftEnd);
      var isInRange = draftStart && previewEnd && !outside &&
        inRange(date, isBefore(draftStart, previewEnd) ? draftStart : previewEnd,
                      isBefore(draftStart, previewEnd) ? previewEnd : draftStart) &&
        !sameDay(date, draftStart) && !(draftEnd && sameDay(date, draftEnd));

      var classes = ['day'];
      if (outside) classes.push('outside');
      if (isStart) classes.push('range-start');
      if (isEnd) classes.push('range-end');
      if (isInRange) classes.push('in-range');
      return classes;
    }

    _buildDayCell(date, currentMonth, bounds) {
      var self = this;
      var outside = date.getMonth() !== currentMonth;
      var disabled = (bounds.min && isBefore(date, bounds.min)) || (bounds.max && isAfter(date, bounds.max));

      var cell = this._genhtml({
        type: 'button',
        attr: {
          type: 'button',
          class: this._dayClasses(date, outside).join(' '),
          part: 'day',
          'data-date': isoDate(date)
        },
        html: '<span class="day-num">' + date.getDate() + '</span>',
        events: {
          click: function () { self._onDayClick(date); },
          mouseover: function () { self._onDayHover(date); }
        }
      });
      if (disabled) cell.disabled = true;
      // Days from neighbouring months are visual filler: skip them for AT.
      if (outside) { cell.setAttribute('aria-hidden', 'true'); cell.tabIndex = -1; }
      this._labelDayCell(cell, date);
      cell.addEventListener('focus', function () { self._lastFocusedDate = date; });
      this._dayCells.push({ el: cell, date: date, outside: outside });
      return cell;
    }

    _labelDayCell(cell, date) {
      var parts = [this._spokenDate(date)];
      var isStart = this._draftStart && sameDay(date, this._draftStart);
      var isEnd = this._draftEnd && sameDay(date, this._draftEnd);
      if (isStart && isEnd) parts.push('range start and end');
      else if (isStart) parts.push('range start');
      else if (isEnd) parts.push('range end');
      else if (this._draftStart && this._draftEnd && inRange(date, this._draftStart, this._draftEnd)) parts.push('in selected range');
      cell.setAttribute('aria-label', parts.join(', '));
      cell.setAttribute('aria-pressed', (isStart || isEnd) ? 'true' : 'false');
    }

    _onDayClick(date) {
      // Picking re-renders the grid; keep keyboard focus on the picked day.
      var active = this._root.activeElement;
      var hadFocus = !!(active && this._calRow.contains(active));
      if (!this._draftStart || (this._draftStart && this._draftEnd)) {
        this._draftStart = date;
        this._draftEnd = null;
        this._pickingEnd = true;
      } else if (isBefore(date, this._draftStart)) {
        this._draftEnd = this._draftStart;
        this._draftStart = date;
        this._pickingEnd = false;
      } else {
        this._draftEnd = date;
        this._pickingEnd = false;
      }
      this._activePreset = 'custom';
      this._highlightPreset();
      this._lastFocusedDate = date;
      this._renderCalendars();
      if (hadFocus) {
        var cell = this._syncDayTabStops(date);
        if (cell) cell.el.focus();
      }
      this._emitDraftInput();
    }

    // Hover only updates classNames on the *existing* cell buttons — it
    // must never tear down and rebuild the grid (that used to call
    // _renderCalendars() here). Replacing the DOM node under the cursor
    // mid-gesture made the browser drop the click that was about to
    // land on it, so picking a second date silently did nothing.
    _onDayHover(date) {
      if (!this._pickingEnd || sameDay(date, this._hoverDate)) return;
      this._hoverDate = date;
      this._refreshDayClasses();
    }

    _refreshDayClasses() {
      if (!this._dayCells) return;
      for (var i = 0; i < this._dayCells.length; i++) {
        var entry = this._dayCells[i];
        entry.el.className = this._dayClasses(entry.date, entry.outside).join(' ');
      }
    }

    _emitDraftInput() {
      this.emit('input', { value: this._draftValueArray() });
    }

    _draftValueArray() {
      if (!this._draftStart || !this._draftEnd) return [];
      if (this._boolAttr('time')) {
        return [isoDate(this._draftStart) + 'T' + this._draftStartTime, isoDate(this._draftEnd) + 'T' + this._draftEndTime];
      }
      return [isoDate(this._draftStart), isoDate(this._draftEnd)];
    }

    _onPrev() {
      var a = addMonths(this._viewYear, this._viewMonth, -1);
      this._viewYear = a.y; this._viewMonth = a.m;
      this._renderCalendars();
    }
    _onNext() {
      var a = addMonths(this._viewYear, this._viewMonth, 1);
      this._viewYear = a.y; this._viewMonth = a.m;
      this._renderCalendars();
    }

    // ---- time-of-day range slider ----
    _buildTimeRow() {
      var self = this;
      this._timeRow.innerHTML = '';
      var track = this._genhtml({ type: 'div', attr: { class: 'time-track', part: 'time-track' } });
      var line = this._genhtml({ type: 'div', attr: { class: 'time-line' } });
      var fill = this._genhtml({ type: 'div', attr: { class: 'time-fill' } });
      var startInput = this._genhtml({ type: 'input', attr: { type: 'range', class: 'time-range time-start', min: '0', max: '1439', step: '5', 'aria-label': 'Start time' } });
      var endInput = this._genhtml({ type: 'input', attr: { type: 'range', class: 'time-range time-end', min: '0', max: '1439', step: '5', 'aria-label': 'End time' } });
      var startLabel = this._genhtml({ type: 'span', attr: { class: 'time-label' } });
      var endLabel = this._genhtml({ type: 'span', attr: { class: 'time-label' } });

      track.appendChild(line);
      track.appendChild(fill);
      track.appendChild(startInput);
      track.appendChild(endInput);
      track.appendChild(startLabel);
      track.appendChild(endLabel);
      this._timeRow.appendChild(track);

      this._timeStartInput = startInput;
      this._timeEndInput = endInput;
      this._timeStartLabel = startLabel;
      this._timeEndLabel = endLabel;
      this._timeFill = fill;

      startInput.addEventListener('input', this._onTimeStartInput);
      endInput.addEventListener('input', this._onTimeEndInput);
      this._syncTimeRow();
    }

    _onTimeStartInput() {
      var v = parseInt(this._timeStartInput.value, 10);
      var endV = parseInt(this._timeEndInput.value, 10);
      if (v > endV) { v = endV; this._timeStartInput.value = String(v); }
      this._draftStartTime = minutesToLabel(v);
      this._timeStartInput.setAttribute('aria-valuetext', this._draftStartTime);
      this._syncTimeRow();
      this._emitDraftInput();
    }
    _onTimeEndInput() {
      var v = parseInt(this._timeEndInput.value, 10);
      var startV = parseInt(this._timeStartInput.value, 10);
      if (v < startV) { v = startV; this._timeEndInput.value = String(v); }
      this._draftEndTime = minutesToLabel(v);
      this._timeEndInput.setAttribute('aria-valuetext', this._draftEndTime);
      this._syncTimeRow();
      this._emitDraftInput();
    }

    _syncTimeRow() {
      if (!this._timeStartInput) return;
      var startMin = labelToMinutes(this._draftStartTime);
      var endMin = labelToMinutes(this._draftEndTime);
      this._timeStartInput.value = String(startMin);
      this._timeEndInput.value = String(endMin);
      var startPct = (startMin / 1439) * 100;
      var endPct = (endMin / 1439) * 100;
      this._timeFill.style.left = startPct + '%';
      this._timeFill.style.right = (100 - endPct) + '%';
      this._timeStartLabel.style.left = startPct + '%';
      this._timeEndLabel.style.left = endPct + '%';
      this._timeStartLabel.textContent = this._draftStartTime;
      this._timeEndLabel.textContent = this._draftEndTime;
      this._timeStartInput.setAttribute('aria-valuetext', this._draftStartTime);
      this._timeEndInput.setAttribute('aria-valuetext', this._draftEndTime);
      this._timeStartLabel.setAttribute('aria-hidden', 'true');
      this._timeEndLabel.setAttribute('aria-hidden', 'true');
    }

    // ---- popup open/close ----
    _onTriggerClick() { this.toggle(); }
    _onTriggerKeydown(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(); }
      else if (e.key === 'Escape' && this._isOpen) { this._close(); }
    }
    _onDocClick(e) {
      if (!this._isOpen) return;
      if (this.contains ? this.contains(e.target) : false) return;
      var path = e.composedPath ? e.composedPath() : [];
      if (path.indexOf(this) !== -1) return;
      this._close();
    }
    _onDocKeydown(e) {
      if (this._isOpen && e.key === 'Escape') this._close();
    }

    open() {
      if (this._boolAttr('disabled') || this._boolAttr('readonly') || this._isOpen) return;
      this._isOpen = true;
      this._draftStart = this._start; this._draftEnd = this._end;
      this._draftStartTime = this._startTime; this._draftEndTime = this._endTime;
      this._pickingEnd = false;
      this._hoverDate = null;
      this._activePreset = this._start ? null : null;
      if (this._draftStart) { this._viewYear = this._draftStart.getFullYear(); this._viewMonth = this._draftStart.getMonth(); }
      this._clampView();
      this._popup.classList.add('open');
      this._trigger.classList.add('open');
      this._trigger.setAttribute('aria-expanded', 'true');
      this._highlightPreset();
      this._renderCalendars();
      this._syncTimeRow();
      this.emit('open', {});
      // Move focus into the dialog: the selected start day, else today,
      // else the first available day.
      var first = this._syncDayTabStops(this._draftStart);
      if (first) first.el.focus();
    }
    close() { this._close(); }
    _close() {
      if (!this._isOpen) return;
      this._isOpen = false;
      this._popup.classList.remove('open');
      this._trigger.classList.remove('open');
      this._trigger.setAttribute('aria-expanded', 'false');
      // If focus was inside the popup, return it to the trigger.
      var active = this._root.activeElement;
      if (active && active !== this._trigger && this._popup.contains(active)) this._trigger.focus();
      this.emit('close', {});
    }
    toggle() { if (this._isOpen) this._close(); else this.open(); }

    _onApply() {
      this._start = this._draftStart;
      this._end = this._draftEnd;
      this._startTime = this._draftStartTime;
      this._endTime = this._draftEndTime;
      this._syncTrigger();
      this._reportValue();
      this._reportValidity();
      this._close();
      this.emit('change', { value: this.value });
    }

    // ---- value ----
    _parseValueAttr(str) {
      if (!str) return null;
      var parts = String(str).split(',');
      if (parts.length < 2) return null;
      var s = parseISO(parts[0]), e = parseISO(parts[1]);
      if (!s || !e) return null;
      return { start: s.date, end: e.date, startTime: s.time || '00:00', endTime: e.time || '23:59' };
    }

    get value() {
      if (!this._start || !this._end) return [];
      if (this._boolAttr('time')) {
        return [isoDate(this._start) + 'T' + this._startTime, isoDate(this._end) + 'T' + this._endTime];
      }
      return [isoDate(this._start), isoDate(this._end)];
    }
    set value(arr) {
      if (!arr || !arr[0] || !arr[1]) { this.clear(); return; }
      var s = parseISO(arr[0]), e = parseISO(arr[1]);
      if (!s || !e) return;
      this._start = s.date; this._end = e.date;
      this._startTime = s.time || '00:00'; this._endTime = e.time || '23:59';
      this._syncTrigger();
      this._reportValue();
      this._reportValidity();
    }

    get valueAsDates() {
      return [this._start ? new Date(this._start.getTime()) : null, this._end ? new Date(this._end.getTime()) : null];
    }

    setRange(start, end, opts) {
      opts = opts || {};
      var s = start instanceof Date ? stripTime(start) : (parseISO(start) || {}).date;
      var e = end instanceof Date ? stripTime(end) : (parseISO(end) || {}).date;
      if (!s || !e) return;
      this._start = s; this._end = e;
      this._syncTrigger();
      this._reportValue();
      this._reportValidity();
      if (!opts.silent) this.emit('change', { value: this.value });
    }

    clear() {
      this._start = null; this._end = null;
      this._startTime = '00:00'; this._endTime = '23:59';
      this._syncTrigger();
      this._reportValue();
      this._reportValidity();
    }

    focus() { if (this._trigger) this._trigger.focus(); }
    blur() { if (this._trigger) this._trigger.blur(); }

    checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
    reportValidity() { return this._internals ? this._internals.reportValidity() : true; }

    _reportValue() {
      if (!this._internals) return;
      var name = this._strAttr('name', '');
      if (!name || !this._start || !this._end) { this._internals.setFormValue(null); return; }
      if (typeof FormData !== 'undefined') {
        var fd = new FormData();
        var v = this.value;
        fd.append(name, v[0]);
        fd.append(name, v[1]);
        this._internals.setFormValue(fd);
      } else {
        this._internals.setFormValue(this.value.join(','));
      }
    }

    _reportValidity() {
      if (!this._internals) return;
      var required = this._boolAttr('required');
      if (required && (!this._start || !this._end)) {
        this._internals.setValidity({ valueMissing: true }, 'Please select a date range.', this._trigger);
      } else {
        this._internals.setValidity({});
      }
    }
  }

  LWTDateRange.formAssociated = true;
  window.LWT.define('lwtf-date-range', LWTDateRange);
})();
