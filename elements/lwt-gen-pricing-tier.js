(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-pricing-tier.js requires lwt-core.js to be loaded first.');
  }

  var CSS =
    ':host {' +
    '  display: flex;' +
    '  flex-direction: column;' +
    '  box-sizing: border-box;' +
    '  border: 1px solid var(--lwt-pricing-border, var(--lwt-color-border, #e5e7eb));' +
    '  border-radius: 12px;' +
    '  background: var(--lwt-pricing-bg, var(--lwt-color-surface, #fff));' +
    '  overflow: hidden;' +
    '  font-family: inherit;' +
    '}' +
    ':host([featured]) {' +
    '  border-color: var(--lwt-pricing-featured-border, var(--lwt-color-text-strong, #111827));' +
    '  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15);' +
    '}' +
    '.badge {' +
    '  display: none;' +
    '  background: var(--lwt-pricing-featured-bg, var(--lwt-color-text-strong, #111827));' +
    '  color: var(--lwt-pricing-featured-color, var(--lwt-color-bg, #fff));' +
    '  font-size: 0.72rem;' +
    '  font-weight: 700;' +
    '  letter-spacing: 0.06em;' +
    '  text-transform: uppercase;' +
    '  text-align: center;' +
    '  padding: 0.4rem 0;' +
    '}' +
    ':host([featured]) .badge { display: block; }' +
    '.header { padding: 1.5rem; }' +
    '.header ::slotted(h1), .header ::slotted(h2), .header ::slotted(h3) {' +
    '  margin: 0 0 0.4rem;' +
    '  font-size: 1.15rem;' +
    '}' +
    '.header ::slotted(p) {' +
    '  margin: 0 0 1.25rem;' +
    '  font-size: 0.88rem;' +
    '  color: var(--lwt-pricing-muted, var(--lwt-color-text-muted, #6b7280));' +
    '}' +
    '.price {' +
    '  margin: 0 0 1.25rem;' +
    '  font-size: 2rem;' +
    '  font-weight: 700;' +
    '  color: var(--lwt-pricing-price-color, var(--lwt-color-text-strong, #111827));' +
    '}' +
    '.period {' +
    '  display: block;' +
    '  font-size: 0.82rem;' +
    '  font-weight: 400;' +
    '  color: var(--lwt-pricing-muted, var(--lwt-color-text-muted, #6b7280));' +
    '  margin-top: 0.15rem;' +
    '}' +
    '.divider { border-top: 1px solid var(--lwt-pricing-border, var(--lwt-color-border, #e5e7eb)); }' +
    '.features {' +
    '  list-style: none;' +
    '  margin: 0;' +
    '  padding: 1.25rem 1.5rem;' +
    '  flex: 1;' +
    '  display: flex;' +
    '  flex-direction: column;' +
    '  gap: 0.6rem;' +
    '}' +
    '::slotted([slot="features"]) {' +
    '  display: flex;' +
    '  align-items: flex-start;' +
    '  gap: 0.5rem;' +
    '  font-size: 0.92rem;' +
    '  line-height: 1.4;' +
    '}' +
    '::slotted([slot="features"])::before {' +
    '  content: "\\203A";' +
    '  color: var(--lwt-pricing-accent, var(--lwt-color-text-muted, #6b7280));' +
    '  font-weight: 700;' +
    '  flex-shrink: 0;' +
    '}';

  class LWTPricingTier extends window.LWT.Element {
    static get observedAttributes() {
      return ['featured', 'badge'];
    }

    render() {
      this._renderShadow(
        '<div class="badge" part="badge"></div>' +
        '<div class="header" part="header">' +
        '<slot></slot>' +
        '<p class="price" part="price"><slot name="price"></slot><span class="period"><slot name="period"></slot></span></p>' +
        '<slot name="cta"></slot>' +
        '</div>' +
        '<div class="divider" part="divider"></div>' +
        '<ul class="features" part="features"><slot name="features"></slot></ul>',
        CSS
      );
      this._root.querySelector('.badge').textContent = this._strAttr('badge', 'Recommended');

      // Features render inside a <ul>; anything slotted there that isn't an
      // <li> is given role="listitem" so the list is announced correctly.
      var featureSlot = this._root.querySelector('slot[name="features"]');
      var syncItems = function () {
        featureSlot.assignedElements().forEach(function (el) {
          if (el.tagName !== 'LI' && !el.hasAttribute('role')) el.setAttribute('role', 'listitem');
        });
      };
      featureSlot.addEventListener('slotchange', syncItems);
      syncItems();
    }
  }

  window.LWT.define('lwtg-pricing-tier', LWTPricingTier);
})();
