(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-dsh-skill-bar.js requires lwt-core.js to be loaded first.');
  }

  function escapeXml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var CSS = `
    :host { display: block; font-family: inherit; }
    .row {
      display: grid;
      grid-template-columns: var(--lwt-skill-bar-label-width, 220px) var(--lwt-skill-bar-value-width, 44px) 1fr;
      align-items: center;
      column-gap: var(--lwt-skill-bar-gap, var(--lwt-gap, 0.9rem));
      padding: var(--lwt-skill-bar-padding, 0.55rem 0);
    }
    .row.hide-value { grid-template-columns: var(--lwt-skill-bar-label-width, 220px) 1fr; }
    .label {
      font-size: 0.92rem;
      color: var(--lwt-skill-bar-label-color, var(--lwt-color-text, #2f4a6b));
      overflow-wrap: anywhere;
    }
    .value { font-size: 0.85rem; color: var(--lwt-skill-bar-value-color, var(--lwt-color-text, #374151)); }
    .track {
      height: var(--lwt-skill-bar-height, 10px);
      border-radius: var(--lwt-skill-bar-radius, 999px);
      background: var(--lwt-skill-bar-track-color, var(--lwt-border-color, #e5e7eb));
      overflow: hidden;
    }
    .fill {
      height: 100%;
      border-radius: var(--lwt-skill-bar-radius, 999px);
      background: var(--lwt-skill-bar-fill-color, var(--lwt-color-success, #8bc34a));
      width: 0%;
      transition: width 900ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    @media (prefers-reduced-motion: reduce) { .fill { transition: none; } }
  `;

  class LWTSkillBar extends window.LWT.Element {
    static get observedAttributes() {
      return ['label', 'value', 'max', 'color', 'hide-value'];
    }

    constructor() {
      super();
      this._initialized = false;
      this._revealed = false;
      this._targetPercent = 0;
      this._observer = null;
    }

    connectedCallback() {
      super.connectedCallback(); // triggers the first render(), which starts the fill at 0%

      if (!this._initialized) {
        this._initialized = true;
        var reduceMotion = typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (this._boolAttr('no-animate') || reduceMotion || typeof IntersectionObserver !== 'function') {
          this._reveal();
        } else {
          this._setupObserver();
        }
      }
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._observer) this._observer.disconnect();
    }

    render() {
      var fallbackLabel = escapeXml(this._strAttr('label', ''));
      var value = parseFloat(this._strAttr('value', '0')) || 0;
      var max = parseFloat(this._strAttr('max', '100')) || 100;
      var rawPercent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
      var percent = Math.round(rawPercent * 100) / 100; // avoid float artifacts like 55.00000000000001
      var valueText = max === 100 ? (Math.round(value) + '%') : (value + ' / ' + max);
      var color = this._strAttr('color', '');
      var hideValue = this._boolAttr('hide-value');

      var html =
        '<div class="row' + (hideValue ? ' hide-value' : '') + '" part="row">' +
        '<div class="label" part="label"><slot name="label">' + fallbackLabel + '</slot></div>' +
        (hideValue ? '' : '<div class="value" part="value">' + escapeXml(valueText) + '</div>') +
        '<div class="track" part="track">' +
        '<div class="fill" part="fill"' + (color ? ' style="background:' + escapeXml(color) + '"' : '') + '></div>' +
        '</div>' +
        '</div>';

      this._renderShadow(html, CSS);

      this._fillEl = this._root.querySelector('.fill');
      this._targetPercent = percent;
      this._fillEl.style.width = (this._revealed ? percent : 0) + '%';

      this.setAttribute('role', 'progressbar');
      this.setAttribute('aria-valuenow', String(value));
      this.setAttribute('aria-valuemin', '0');
      this.setAttribute('aria-valuemax', String(max));
      this.setAttribute('aria-valuetext', valueText);
      // Name the progressbar from the label attribute (raw text, not the
      // HTML-escaped copy used in the template), or the slotted label.
      var rawLabel = this._strAttr('label', '');
      var labelSlot = this._root.querySelector('slot[name="label"]');
      var self = this;
      var syncName = function () {
        if (!labelSlot.isConnected) return; // superseded by a newer render
        var slotted = labelSlot.assignedNodes({ flatten: true }).map(function (n) { return n.textContent; }).join('').trim();
        self._ensureAttr('aria-label', self._a11yName([slotted, rawLabel], 'Skill level', 'Add a label attribute'));
      };
      labelSlot.addEventListener('slotchange', syncName);
      if (rawLabel || this._hostLabel()) syncName(); else this._whenParsed(syncName);
    }

    get value() {
      return parseFloat(this._strAttr('value', '0')) || 0;
    }
    set value(v) {
      this.setAttribute('value', String(v));
    }

    _reveal() {
      if (this._revealed) return;
      this._revealed = true;
      if (this._fillEl) this._fillEl.style.width = this._targetPercent + '%';
    }

    _setupObserver() {
      var self = this;
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            self._reveal();
            observer.disconnect();
          }
        });
      }, { threshold: 0.3 });
      observer.observe(this);
      this._observer = observer;
    }
  }

  window.LWT.define('lwtg-skill-bar', LWTSkillBar);
})();
