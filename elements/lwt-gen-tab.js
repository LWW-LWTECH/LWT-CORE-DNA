(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-tab.js requires lwt-core.js to be loaded first.');
  }

  var CSS = `
    :host {
      display: flex;
      align-items: center;
      gap: var(--lwt-tabs-tab-gap, 0.4rem);
      padding: var(--lwt-tabs-tab-padding, var(--lwt-padding, 0.6rem 1rem));
      cursor: pointer;
      font: inherit;
      font-size: 0.9rem;
      color: var(--lwt-tabs-tab-color, var(--lwt-color-text-muted, #6b7280));
      white-space: nowrap;
      flex-shrink: 0;
      user-select: none;
      box-sizing: border-box;
    }
    /* Position-driven border/margin wrapped in :where() so external
       styling on the host (e.g. a responsive vertical→horizontal flip)
       wins without !important. */
    :where(:host([position="top"]), :host(:not([position]))) {
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
    }
    :where(:host([position="bottom"])) { border-top: 2px solid transparent; margin-top: -1px; }
    :where(:host([position="left"])) { border-right: 2px solid transparent; margin-right: -1px; }
    :where(:host([position="right"])) { border-left: 2px solid transparent; margin-left: -1px; }
    :host([active]) { color: var(--lwt-tabs-active-color, var(--lwt-color-primary, #2563eb)); font-weight: 600; }
    :host([active][position="top"]), :host([active]:not([position])) {
      border-bottom-color: var(--lwt-tabs-active-color, var(--lwt-color-primary, #2563eb));
    }
    :host([active][position="bottom"]) {
      border-top-color: var(--lwt-tabs-active-color, var(--lwt-color-primary, #2563eb));
    }
    :host([active][position="left"]) {
      border-right-color: var(--lwt-tabs-active-color, var(--lwt-color-primary, #2563eb));
    }
    :host([active][position="right"]) {
      border-left-color: var(--lwt-tabs-active-color, var(--lwt-color-primary, #2563eb));
    }
    :host([disabled]) { opacity: 0.45; cursor: not-allowed; pointer-events: none; }
    :host(:focus-visible) {
      outline: 2px solid var(--lwt-tabs-focus-color, var(--lwt-focus-color, #2563eb));
      outline-offset: -2px;
      border-radius: 2px;
    }
  `;

  class LWTTab extends window.LWT.Element {
    static get observedAttributes() {
      return ['active', 'disabled', 'position', 'panel'];
    }

    constructor() {
      super();
      this._handleClick = this._handleClick.bind(this);
      this._handleKeydown = this._handleKeydown.bind(this);
    }

    connectedCallback() {
      super.connectedCallback();
      this.addEventListener('click', this._handleClick);
      this.addEventListener('keydown', this._handleKeydown);
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.removeEventListener('click', this._handleClick);
      this.removeEventListener('keydown', this._handleKeydown);
    }

    render() {
      this._renderShadow('<slot></slot>', CSS);

      var panelName = this._strAttr('panel', '');
      var disabled = this._boolAttr('disabled');

      // id / aria-controls / roving tabindex are wired by <lwtg-tabs>
      // (it knows the matching panel and gives both page-unique ids).
      this.setAttribute('role', 'tab');
      this.setAttribute('aria-selected', this._boolAttr('active') ? 'true' : 'false');
      this.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      if (disabled) this.tabIndex = -1;
      else if (!this.hasAttribute('data-lwt-roving')) this.tabIndex = 0;
      else this.tabIndex = this._boolAttr('active') ? 0 : -1;
      this._whenParsed(function () {
        if (this.textContent.trim() || this._hostLabel()) { this._removeAutoAttr('aria-label'); return; }
        this._ensureAttr('aria-label', this._a11yName([window.LWT.a11y.humanize(panelName)], 'Tab', 'Add text content to the tab'));
      });
    }

    get active() { return this._boolAttr('active'); }
    set active(value) {
      if (value) this.setAttribute('active', '');
      else this.removeAttribute('active');
    }

    _handleClick() {
      if (this._boolAttr('disabled')) return;
      this.emit('select', { panel: this._strAttr('panel', '') });
    }

    _handleKeydown(event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this._handleClick();
        return;
      }
      var horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
      var vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
      var edge = event.key === 'Home' || event.key === 'End';
      if (!horizontal && !vertical && !edge) return;
      if (!this.parentElement) return;

      var tabs = Array.prototype.filter.call(
        this.parentElement.querySelectorAll(':scope > lwtg-tab'),
        function (t) { return !t.hasAttribute('disabled'); }
      );
      var idx = tabs.indexOf(this);
      if (idx === -1) return;
      event.preventDefault();
      var next;
      if (event.key === 'Home') next = tabs[0];
      else if (event.key === 'End') next = tabs[tabs.length - 1];
      else {
        var dir = (event.key === 'ArrowRight' || event.key === 'ArrowDown') ? 1 : -1;
        next = tabs[(idx + dir + tabs.length) % tabs.length];
      }
      if (next) {
        next.focus();
        next.click();
      }
    }
  }

  window.LWT.define('lwtg-tab', LWTTab);
})();
