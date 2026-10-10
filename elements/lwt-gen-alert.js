(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-alert.js requires lwt-core.js to be loaded first.');
  }

  var ICONS = {
    success: '<svg class="icon" viewBox="0 0 20 20"><circle class="icon-bg" cx="10" cy="10" r="10"></circle><path d="M6 10.5l2.5 2.5L14 7" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
    warning: '<svg class="icon" viewBox="0 0 20 20"><path class="icon-bg" d="M10 1.5 L19.5 18.5 L0.5 18.5 Z"></path><line x1="10" y1="8" x2="10" y2="12.3" stroke="#fff" stroke-width="2" stroke-linecap="round"></line><circle cx="10" cy="15.3" r="1" fill="#fff"></circle></svg>',
    info: '<svg class="icon" viewBox="0 0 20 20"><circle class="icon-bg" cx="10" cy="10" r="10"></circle><circle cx="10" cy="6.5" r="1.2" fill="#fff"></circle><line x1="10" y1="9.5" x2="10" y2="15" stroke="#fff" stroke-width="2" stroke-linecap="round"></line></svg>',
    error: '<svg class="icon" viewBox="0 0 20 20"><circle class="icon-bg" cx="10" cy="10" r="10"></circle><line x1="7" y1="7" x2="13" y2="13" stroke="#fff" stroke-width="2" stroke-linecap="round"></line><line x1="13" y1="7" x2="7" y2="13" stroke="#fff" stroke-width="2" stroke-linecap="round"></line></svg>'
  };

  var CSS =
    ':host { display: block; font-family: inherit; }' +
    ':host([variant="success"]) { color: var(--lwt-alert-success-color, var(--lwt-color-success, #22c55e)); }' +
    ':host([variant="warning"]) { color: var(--lwt-alert-warning-color, var(--lwt-color-warning, #f59e0b)); }' +
    ':host([variant="info"]), :host(:not([variant])) { color: var(--lwt-alert-info-color, var(--lwt-color-info, #3b82f6)); }' +
    ':host([variant="error"]) { color: var(--lwt-alert-error-color, var(--lwt-color-danger, #ef4444)); }' +
    '.alert { display: flex; align-items: flex-start; gap: 0.65rem; padding: 0.85rem 1rem; border-radius: 10px;' +
    '  border: 1px solid currentColor; background: var(--lwt-alert-bg, color-mix(in srgb, currentColor 8%, var(--lwt-color-surface, white))); }' +
    '.icon { flex-shrink: 0; width: 20px; height: 20px; margin-top: 0.1rem; }' +
    '.icon-bg { fill: currentColor; }' +
    '.content { flex: 1; min-width: 0; }' +
    '.title { font-weight: 700; font-size: 0.92rem; color: var(--lwt-alert-title-color, var(--lwt-color-text-strong, #111827)); margin-bottom: 0.15rem; }' +
    '.message { font-size: 0.88rem; color: var(--lwt-alert-text-color, var(--lwt-color-text, #374151)); }' +
    '::slotted(*:first-child) { margin-top: 0; }' +
    '::slotted(*:last-child) { margin-bottom: 0; }' +
    '.close { flex-shrink: 0; border: none; background: none; cursor: pointer; font-size: 1.2rem; line-height: 1; color: inherit; opacity: 0.6; padding: 0;' +
    '  min-width: 24px; min-height: 24px; margin: -0.2rem -0.3rem -0.2rem 0; border-radius: 4px; }' +
    '.close:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; opacity: 1; }' +
    '.close:hover { opacity: 1; }';

  var TEMPLATE =
    '<div class="alert" part="alert">' +
    '  <div class="icon-wrap" part="icon" aria-hidden="true"></div>' +
    '  <div class="content">' +
    '    <div class="title" part="title"></div>' +
    '    <div class="message" part="message"><slot></slot></div>' +
    '  </div>' +
    '  <button type="button" class="close" part="close" aria-label="Dismiss" hidden>&times;</button>' +
    '</div>';

  class LWTAlert extends window.LWT.Element {
    static get observedAttributes() {
      return ['variant', 'title', 'dismissible'];
    }

    constructor() {
      super();
      this._handleClose = this._handleClose.bind(this);
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      var root = this._root;

      var variant = this._strAttr('variant', 'info');
      root.querySelector('.icon-wrap').innerHTML = ICONS[variant] || ICONS.info;

      var titleEl = root.querySelector('.title');
      var title = this._strAttr('title', '');
      titleEl.textContent = title;
      titleEl.style.display = title ? '' : 'none';

      var closeBtn = root.querySelector('.close');
      var dismissible = this._boolAttr('dismissible');
      closeBtn.hidden = !dismissible;

      // Errors and warnings interrupt (role="alert"); info and success are
      // polite status messages (role="status") -- WCAG 4.1.3. A role the
      // developer set themselves is left alone.
      var urgent = variant === 'error' || variant === 'warning';
      this._ensureAttr('role', urgent ? 'alert' : 'status');
      closeBtn.setAttribute('aria-label', 'Dismiss ' + (title ? title : (ICONS[variant] ? variant : 'info') + ' message'));
      if (dismissible) closeBtn.addEventListener('click', this._handleClose);
    }

    _handleClose() {
      this.close();
    }

    close() {
      this.emit('close', { variant: this._strAttr('variant', 'info') });
      this.remove();
    }
  }

  window.LWT.define('lwtg-alert', LWTAlert);
})();
