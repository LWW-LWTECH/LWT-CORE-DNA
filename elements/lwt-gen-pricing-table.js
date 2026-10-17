
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-pricing-table.js requires lwt-core.js to be loaded first.');
  }

  var CSS = `
    :host {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(var(--lwt-pricing-col-min, 240px), 1fr));
      align-items: stretch;
      gap: var(--lwt-pricing-gap, var(--lwt-gap, 1rem));
    }
  `;

  class LWTPricingTable extends window.LWT.Element {
    render() {
      this._renderShadow('<slot></slot>', CSS);
    }
  }

  window.LWT.define('lwtg-pricing-table', LWTPricingTable);
})();
