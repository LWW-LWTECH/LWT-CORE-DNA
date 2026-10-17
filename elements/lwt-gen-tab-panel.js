/*!
 * <lwtg-tab-panel>
 * The content body for one tab, meant to live inside <lwtg-tabs> with
 * `slot="panel"` and a `name` attribute matching an <lwtg-tab>'s `panel`.
 *
 *   <lwtg-tab-panel slot="panel" name="overview">
 *     <p>Any HTML goes here.</p>
 *   </lwtg-tab-panel>
 *
 * <lwtg-tabs> toggles the native `hidden` attribute on whichever panels
 * aren't currently selected — that's the entire visibility mechanism,
 * deliberately as simple as possible. Content is the default slot, so
 * it accepts arbitrary HTML, not just text.
 *
 * Attribute: name — required; matched against the active <lwtg-tab>'s
 * `panel` value by the container.
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-tab-panel.js requires lwt-core.js to be loaded first.');
  }

  var CSS = `
    :host { display: block; font-family: inherit; }
    :host([hidden]) { display: none; }
  `;

  class LWTTabPanel extends window.LWT.Element {
    render() {
      this._renderShadow('<slot></slot>', CSS);

      // id / aria-labelledby are wired by <lwtg-tabs> to the matching tab.
      this.setAttribute('role', 'tabpanel');
      if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    }
  }

  window.LWT.define('lwtg-tab-panel', LWTTabPanel);
})();
