(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-accordion.js requires lwt-core.js to be loaded first.');
  }

  var CSS = `
    :host { display: block; font-family: inherit; }
    .accordion { 
      border: var(--lwt-accordion-border, var(--lwt-border, 1px solid #e5e7eb)); 
      border-radius: var(--lwt-accordion-border-radius, var(--lwt-border-radius, 8px)); 
      overflow: hidden; 
      background: var(--lwt-accordion-bg, transparent); 
    }
    .accordion { padding: var(--lwt-accordion-padding, var(--lwt-padding, 0.75rem)); }
    ::slotted(lwtg-accordion-item + lwtg-accordion-item) { display: block; border-top: var(--lwt-accordion-border, var(--lwt-border, 1px solid #e5e7eb)); }
  `;

  class LWTAccordion extends window.LWT.Element {
    constructor() {
      super();
      this._handleItemOpen = this._handleItemOpen.bind(this);
    }

    connectedCallback() {
      super.connectedCallback();
      this.addEventListener('lwt-open', this._handleItemOpen);
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.removeEventListener('lwt-open', this._handleItemOpen);
    }

    render() {
      this._renderShadow('<div class="accordion" part="accordion"><slot></slot></div>', CSS);
    }

    _handleItemOpen(event) {
      if (this._boolAttr('multiple')) return;
      var opened = event.target;
      var items = this.querySelectorAll('lwtg-accordion-item');
      items.forEach(function (item) {
        if (item !== opened && typeof item.close === 'function' && item.isOpen) {
          item.close();
        }
      });
    }
  }

  window.LWT.define('lwtg-accordion', LWTAccordion);
})();