/* ICON */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-icon requires lwt-core.js to be loaded first.');
  }

  let CSS = '.lwti{ display: inline-block; font-family: inherit; }';
  let TEMPLATE = '';

  class LWTIcon extends window.LWT.Element {
    static get observedAttributes() {
      return ['icon', 'label', 'aria-label', 'width', 'height'];
    }

    constructor() {
      super();
      this.iconhost = 'https://raw.githubusercontent.com/LWW-LWTECH/LWW-CORE-DNA/refs/heads/main/icons';
    }

    connectedCallback() {
      super.connectedCallback();
    }

    async render() {
      this._renderShadow(TEMPLATE, CSS);

      this.width = this._root.host.getAttribute('width') || '24px';
      this.height = this._root.host.getAttribute('height') || '24px';
      this.style.display = 'inline-block';
      this.style.width = this.width;
      this.style.height = this.height;

      // Accessibility: icons are decorative by default (hidden from screen
      // readers) -- the text next to them carries the meaning. Give one a
      // `label` (or aria-label) when the icon alone has to convey something.
      var label = this._hostLabel() || this._strAttr('label', '');
      if (label) {
        this._ensureAttr('role', 'img');
        this._ensureAttr('aria-label', label);
        this._removeAutoAttr('aria-hidden');
      } else {
        this._removeAutoAttr('role');
        this._removeAutoAttr('aria-label');
        this._ensureAttr('aria-hidden', 'true');
      }

      var name = this._root.host.getAttribute('icon');
      if (!name) {
        this._a11yWarn('icon', 'has no icon attribute, so nothing is drawn.');
        return;
      }
      this.icon = name.split('_');
      this.iconurl = '/' + this.icon.join('/') + '.svg';

      var token = (this._renderToken = (this._renderToken || 0) + 1);
      var svg = await this.getIconSVG();
      if (token !== this._renderToken) return; // a newer render superseded this one
      this._root.innerHTML = '<style>' + CSS + '</style>' + svg;

      // The inner SVG is never announced or focusable on its own.
      var svgEl = this._root.querySelector('svg');
      if (svgEl) {
        svgEl.setAttribute('aria-hidden', 'true');
        svgEl.setAttribute('focusable', 'false');
      }
    }

    async getIconSVG() {
      if (!this.iconurl) return '';
      var remote = this.iconhost + this.iconurl;
      var local = '/icons' + this.iconurl;
      try {
        var text = await fetchOnce(remote);
        if (text && text.indexOf('<svg') !== -1) return text;
      } catch (e) { /* offline or blocked -- fall back to the local copy */ }
      try {
        var localText = await fetchOnce(local);
        return localText && localText.indexOf('<svg') !== -1 ? localText : '';
      } catch (e) {
        return '';
      }
    }

  }

  // One request per icon URL, shared by every <lwtg-icon> on the page.
  var iconCache = {};
  function fetchOnce(url) {
    if (!iconCache[url]) {
      iconCache[url] = fetch(url).then(function (response) {
        if (!response.ok) return '';
        return response.text();
      });
      iconCache[url].catch(function () { delete iconCache[url]; });
    }
    return iconCache[url];
  }

  window.LWT.define('lwtg-icon', LWTIcon);
})();
