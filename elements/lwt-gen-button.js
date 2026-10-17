(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-button.js requires lwt-core.js to be loaded first.');
  }

  var CSS = `
    :host {
      display: inline-block;
      font-family: inherit;
    }
    :host([hidden]) { display: none; }
    button {
      font: inherit;
      cursor: pointer;
      border: var(--lwt-button-border, var(--lwt-border, 1px solid transparent));
      border-radius: var(--lwt-button-border-radius, var(--lwt-border-radius, 6px));
      padding: var(--lwt-button-padding, var(--lwt-padding, 0.5em));
      font-size: 0.95em;
      line-height: 1.2;
      transition: background-color 120ms ease, border-color 120ms ease, opacity 120ms ease;
    }

    button:disabled { cursor: not-allowed; opacity: 0.55; }
    button:not(:disabled):hover { 
      filter: brightness(0.8);
      backdrop-filter: brightness(0.9);
    }

    button:focus-visible {
      outline: var(--lwt-button-focus-ring, var(--lwt-focus-ring, 2px solid #2563eb));
      outline-offset: 2px;
    }
    :where(:host([size="sm"]) button) { padding: var(--lwt-button-padding, var(--lwt-padding, 0.3em 0.75em)); font-size: 0.82em; }
    :where(:host([size="lg"]) button) { padding: var(--lwt-button-padding, var(--lwt-padding, 0.7em 1.4em)); font-size: 1.1em; }
    
    button.primary {
      background:   var(--lwt-primary, var(--lwt-color-primary, #2563eb));
      border-color: var(--lwt-primary, var(--lwt-color-primary, #2563eb));
      color: #fff;
    }
    button.primary:not(:disabled):hover {}

    button.secondary {
      background: transparent;
      border-color: var(--lwt-button-secondary, var(--lwt-secondary, #6b7280));
      color: var(--lwt-button-color-secondary, var(--lwt-color-secondary, #6b7280));
    }
    button.secondary:not(:disabled):hover {}

    button.danger {
      background:   var(--lwt-button-danger, var(--lwt-danger, #dc2626));
      border-color: var(--lwt-button-danger, var(--lwt-danger, #dc2626));
      color: #fff;
    }
    button.danger:not(:disabled):hover {}
    `;
  // background: var(--lwt-secondary-hover, var(--lwt-color-secondary-hover, rgba(107,114,128,0.08))); 

  class LWTButton extends window.LWT.Element {
    static get observedAttributes() {
      return ['variant', 'disabled', 'label', 'aria-label', 'aria-labelledby', 'aria-pressed', 'aria-expanded', 'aria-haspopup', 'aria-current'];
    }

    // Clicking/focusing the host lands focus on the real <button> inside.
    static get shadowOptions() {
      return { delegatesFocus: true };
    }

    static get observedProps() {
      return ['variant', 'disabled', 'label'];
    }

    constructor() {
      super();
      this._handleClick = this._handleClick.bind(this);
    }

    connectedCallback() {
      super.connectedCallback();
      // Listen on the host: clicks on the inner <button> bubble up to it,
      // so we only ever need one listener regardless of how many times
      // render() replaces the shadow contents.
      this.addEventListener('click', this._handleClick);
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.removeEventListener('click', this._handleClick);
    }

    _handleClick(event) {
      this.emit('click', { originalEvent: event });
    }

    get variant() { return this._strAttr('variant', 'primary'); }
    set variant(value) { this.setAttribute('variant', value); }

    get disabled() { return this._boolAttr('disabled'); }
    set disabled(value) {
      if (value) this.setAttribute('disabled', '');
      else this.removeAttribute('disabled');
    }

    get label() { return this._strAttr('label', ''); }
    set label(value) { this.setAttribute('label', value); }

    render() {
      var variant = this.variant;
      var disabled = this.disabled;
      var label = this.label;

      var esc = window.LWT.a11y.escape;
      this._renderShadow(
        '<button type="button" class="' + esc(variant) + '"' + (disabled ? ' disabled' : '') + ' part="button">' +
        '<slot>' + esc(label) + '</slot>' +
        '</button>',
        CSS
      );

      this._button = this._root.querySelector('button');
      // State attributes set on the host are what developers naturally
      // reach for; mirror them onto the real button so they're announced.
      var self = this;
      ['aria-pressed', 'aria-expanded', 'aria-haspopup', 'aria-current'].forEach(function (name) {
        if (self.hasAttribute(name)) self._button.setAttribute(name, self.getAttribute(name));
      });

      var slot = this._root.querySelector('slot');
      var syncName = function () {
        // A later render() replaces the shadow contents; a check queued by an
        // earlier render must not run against its now-detached slot.
        if (!self._button || !slot.isConnected) return;
        var text = slot.assignedNodes({ flatten: true }).map(function (n) { return n.textContent; }).join('').trim();
        var host = self._hostLabel();
        if (host) self._button.setAttribute('aria-label', host);
        else if (text || label) self._button.removeAttribute('aria-label');
        else self._button.setAttribute('aria-label', self._a11yName([], 'Button', 'Add text content or a label attribute'));
      };
      slot.addEventListener('slotchange', syncName);
      this._whenParsed(syncName);
    }
  }

  window.LWT.define('lwtg-button', LWTButton);
})();
