(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-accordion-item.js requires lwt-core.js to be loaded first.');
  }

  var idCounter = 0;

  var CSS =
    ':host { display: block; font-family: inherit; }' +
    '.trigger { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; width: 100%;' +
    '  padding: 0.9rem 0.1rem; background: none; border: none; cursor: pointer; text-align: left; font: inherit; color: inherit; }' +
    '.trigger:disabled { cursor: not-allowed; opacity: 0.5; }' +
    '.trigger:focus-visible { outline: 2px solid var(--lwt-accordion-focus-color, var(--lwt-focus-ring, #2563eb)); outline-offset: 2px; border-radius: 4px; }' +
    '.label { flex: 1; min-width: 0; }' +
    '.chevron { flex-shrink: 0; width: 18px; height: 18px; color: var(--lwt-accordion-chevron-color, var(--lwt-color-text-muted, #6b7280)); transition: transform 200ms ease; }' +
    ':host([open]) .chevron { transform: rotate(180deg); }' +
    '.panel { height: 0; overflow: hidden; transition: height 200ms ease; }' +
    '.panel-inner { padding: 0 0.1rem 1rem; }' +
    '.panel-inner ::slotted(*:first-child) { margin-top: 0; }' +
    '.panel-inner ::slotted(*:last-child) { margin-bottom: 0; }';

  // The trigger sits inside a heading (WAI-ARIA accordion pattern) so
  // screen-reader users can jump between sections by heading. Level comes
  // from the host's heading-level attribute (default 3).
  var TEMPLATE =
    '<div class="heading" role="heading" aria-level="3">' +
    '<button type="button" class="trigger" part="trigger" aria-expanded="false">' +
    '  <span class="label" part="label"><slot name="label"></slot></span>' +
    '  <span class="chevron" part="chevron">' +
    '    <svg viewBox="0 0 20 20"><path d="M5 7l5 5l5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>' +
    '  </span>' +
    '</button>' +
    '</div>' +
    '<div class="panel" part="panel" role="region">' +
    '  <div class="panel-inner"><slot name="body"></slot></div>' +
    '</div>';

  class LWTAccordionItem extends window.LWT.Element {
    constructor() {
      super();
      this._isOpen = false;
      this._initialized = false;
      this._handleTriggerClick = this._handleTriggerClick.bind(this);
      this._handleTransitionEnd = this._handleTransitionEnd.bind(this);
    }

    connectedCallback() {
      super.connectedCallback(); // builds shadow via render(), caches refs, wires listeners

      if (!this._initialized) {
        this._initialized = true;
        var startOpen = this.hasAttribute('open') && !this._boolAttr('disabled');
        this._isOpen = startOpen;
        this._trigger.setAttribute('aria-expanded', startOpen ? 'true' : 'false');
        if (startOpen) {
          this._panel.style.display = 'block';
          this._panel.style.height = 'auto';
        } else {
          this._panel.style.display = 'none';
          this._panel.style.height = '0px';
          this.removeAttribute('open');
        }
      }
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      var root = this._root;
      this._trigger = root.querySelector('.trigger');
      this._panel = root.querySelector('.panel');

      var panelId = 'lwt-accordion-panel-' + (++idCounter);
      var triggerId = 'lwt-accordion-trigger-' + idCounter;
      this._panel.id = panelId;
      this._trigger.id = triggerId;
      this._trigger.setAttribute('aria-controls', panelId);
      this._panel.setAttribute('aria-labelledby', triggerId);
      this._trigger.disabled = this._boolAttr('disabled');

      var level = parseInt(this._strAttr('heading-level', '3'), 10);
      root.querySelector('.heading').setAttribute('aria-level', String(level >= 1 && level <= 6 ? level : 3));

      // Accessible name: the slotted label text; if there isn't any, fall
      // back to a generic name (and tell the developer).
      var labelSlot = root.querySelector('slot[name="label"]');
      var self = this;
      var syncName = function () {
        if (!labelSlot.isConnected) return; // superseded by a newer render
        var text = labelSlot.assignedNodes({ flatten: true }).map(function (n) { return n.textContent; }).join('').trim();
        var host = self._hostLabel();
        if (host || !text) {
          self._trigger.setAttribute('aria-label', self._a11yName([], 'Toggle section', 'Add an element with slot="label"'));
        } else {
          self._trigger.removeAttribute('aria-label');
        }
      };
      labelSlot.addEventListener('slotchange', syncName);
      // Light-DOM children may not be parsed yet; check again after.
      this._whenParsed(syncName);

      this._trigger.addEventListener('click', this._handleTriggerClick);
      this._panel.addEventListener('transitionend', this._handleTransitionEnd);
    }

    get isOpen() {
      return this._isOpen;
    }

    open() {
      if (this._isOpen || this._boolAttr('disabled')) return;
      this._isOpen = true;
      this.setAttribute('open', '');
      this._trigger.setAttribute('aria-expanded', 'true');
      this._animateOpen();
      this.emit('open', {});
    }

    close() {
      if (!this._isOpen) return;
      this._isOpen = false;
      this.removeAttribute('open');
      this._trigger.setAttribute('aria-expanded', 'false');
      this._animateClose();
      this.emit('close', {});
    }

    toggle() {
      if (this._isOpen) this.close();
      else this.open();
    }

    _handleTriggerClick() {
      if (this._boolAttr('disabled')) return;
      this.toggle();
    }

    _animateOpen() {
      var panel = this._panel;
      panel.style.display = 'block';
      var target = panel.scrollHeight;
      panel.style.height = '0px';
      void panel.offsetHeight; // force reflow so the 0px start registers before animating
      panel.style.height = target + 'px';
    }

    _animateClose() {
      var panel = this._panel;
      var current = panel.scrollHeight;
      panel.style.height = current + 'px';
      void panel.offsetHeight; // force reflow so the current-height start registers
      panel.style.height = '0px';
    }

    _handleTransitionEnd(event) {
      if (event.propertyName !== 'height') return;
      if (this._isOpen) {
        this._panel.style.height = 'auto';
      } else {
        this._panel.style.display = 'none';
      }
    }
  }

  window.LWT.define('lwtg-accordion-item', LWTAccordionItem);
})();
