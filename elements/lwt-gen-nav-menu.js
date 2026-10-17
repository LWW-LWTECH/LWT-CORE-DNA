(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-nav-menu.js requires lwt-core.js to be loaded first.');
  }

  var TEMPLATE =
    '<div class="bar" part="bar">' +
    '  <button type="button" class="hamburger" part="hamburger" aria-label="Toggle menu" aria-expanded="false">' +
    '    <span class="hb-line" part="hamburger-line"></span>' +
    '    <span class="hb-line" part="hamburger-line"></span>' +
    '    <span class="hb-line" part="hamburger-line"></span>' +
    '  </button>' +
    '  <div class="panel" part="panel">' +
    '    <ul class="list" part="list"><slot></slot></ul>' +
    '  </div>' +
    '</div>';

  var CSS = `
    :host { display: block; font-family: inherit; }
    :host([hidden]) { display: none; }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: transparent;
      position: relative;
    }
    :where(:host([sticky]) .bar) { position: sticky; top: 0; z-index: var(--lwt-nav-menu-z, 100); }
    .list {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      align-items: center;
      list-style: none;
      margin: 0;
      padding: 0;
      gap: var(--lwt-nav-menu-gap, var(--lwt-gap, 0.15rem));
      background: transparent;
      width: 100%;
    }
    :where(:host([orientation="vertical"]) .list) { flex-direction: column; align-items: stretch; }
    .panel { flex: 1; min-width: 0; overflow: visible; }
    .hamburger {
      display: none;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 5px;
      width: 2.25rem;
      height: 2.25rem;
      flex-shrink: 0;
      border: none;
      background: none;
      cursor: pointer;
      padding: 0;
      border-radius: var(--lwt-nav-item-radius, var(--lwt-border-radius, 6px));
    }
    .hamburger:hover { background: var(--lwt-nav-item-hover-bg, var(--lwt-color-surface-alt, rgba(0,0,0,0.05))); }
    .hamburger:focus-visible {
      outline: 2px solid var(--lwt-nav-focus-color, var(--lwt-focus-color, #2563eb));
      outline-offset: 2px;
    }
    .hb-line {
      display: block;
      width: 20px;
      height: 2px;
      border-radius: 2px;
      background: var(--lwt-nav-hamburger-color, var(--lwt-color-text, currentColor));
      transition: transform 160ms ease, opacity 160ms ease;
    }
    :host([mobile]) .hamburger { display: inline-flex; }
    :host([data-mobile-open]) .hb-line:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    :host([data-mobile-open]) .hb-line:nth-child(2) { opacity: 0; }
    :host([data-mobile-open]) .hb-line:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
    :host([mobile]) .bar { flex-wrap: wrap; }
    :host([mobile]) .panel { flex-basis: 100%; order: 2; }
    :host([mobile]) .list {
      display: none;
      flex-direction: column;
      align-items: stretch;
      background: var(--lwt-nav-dropdown-bg, var(--lwt-color-surface, #fff));
      border: var(--lwt-nav-dropdown-border, var(--lwt-border, 1px solid #e5e7eb));
      border-radius: var(--lwt-nav-dropdown-radius, var(--lwt-border-radius, 8px));
      box-shadow: 0 10px 25px var(--lwt-nav-dropdown-shadow, var(--lwt-color-shadow, rgba(0,0,0,0.15)));
      padding: var(--lwt-nav-dropdown-padding, var(--lwt-padding, 0.5rem));
      margin-top: 0.5rem;
    }
    :host([mobile][data-mobile-open]) .list { display: flex; }
  `;

  class LWTNavMenu extends window.LWT.Element {
    static get observedAttributes() {
      return ['orientation', 'breakpoint', 'label', 'aria-label'];
    }

    constructor() {
      super();
      this._mobile = false;
      this._mobileOpen = false;
      this._initialized = false;
      this._resizeObserver = null;

      this._handleHamburgerClick = this._handleHamburgerClick.bind(this);
      this._handleChildOpen = this._handleChildOpen.bind(this);
      this._handleSelect = this._handleSelect.bind(this);
      this._handleDocMousedown = this._handleDocMousedown.bind(this);
      this._handleKeydown = this._handleKeydown.bind(this);
      this._handleResize = this._handleResize.bind(this);
    }

    connectedCallback() {
      super.connectedCallback(); // builds shadow via render()

      if (!this.hasAttribute('role')) this.setAttribute('role', 'navigation');
      // A page can have several navigation landmarks; each needs a name.
      if (!this._devAttr('aria-label') && !this._devAttr('aria-labelledby')) {
        this._setAutoAttr('aria-label', this._a11yName([this._strAttr('label', '')], 'Main',
          'Add a label attribute (e.g. label="Main" or label="Footer")'));
      }

      this.addEventListener('lwt-navopen', this._handleChildOpen);
      this.addEventListener('lwt-select', this._handleSelect);
      this.addEventListener('keydown', this._handleKeydown);
      document.addEventListener('mousedown', this._handleDocMousedown);

      if (!this._initialized) {
        this._initialized = true;
        // Synchronous initial check so a narrow embed doesn't flash desktop
        // layout before the (async) ResizeObserver callback fires.
        this._applyMobileState(this._measureWidth() < this._breakpointPx());
        // Deferred re-sync: the parser fires our connectedCallback as
        // soon as the <lwtg-nav-menu> open tag is seen, BEFORE any child
        // <lwtg-nav-item>s have been appended. Re-propagate on the next
        // microtask so the initial orientation/mobile state actually
        // reaches every top-level item. Later child additions are picked
        // up by the mutation observer below.
        var self = this;
        Promise.resolve().then(function () {
          self._syncOrientation();
          self._propagateMobile();
        });
        if (typeof MutationObserver === 'function') {
          this._childObserver = new MutationObserver(function () {
            self._syncOrientation();
            self._propagateMobile();
          });
          this._childObserver.observe(this, { childList: true, subtree: true });
        }
      }

      if (typeof ResizeObserver === 'function') {
        this._resizeObserver = new ResizeObserver(this._handleResize);
        this._resizeObserver.observe(this);
      }
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.removeEventListener('lwt-navopen', this._handleChildOpen);
      this.removeEventListener('lwt-select', this._handleSelect);
      this.removeEventListener('keydown', this._handleKeydown);
      document.removeEventListener('mousedown', this._handleDocMousedown);
      if (this._resizeObserver) this._resizeObserver.disconnect();
      if (this._childObserver) this._childObserver.disconnect();
    }

    // 'orientation'/'breakpoint' changes are handled entirely by directly
    // syncing child attributes / re-measuring below -- no shadow rebuild
    // needed (the menu's own layout reacts to the attribute purely via
    // CSS attribute selectors), matching lwt-gen-tabs.js's precedent of
    // overriding this without calling super or this.render().
    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (name === 'orientation') this._syncOrientation();
      else if (name === 'label' && this._autoAttrs && !this._devAttr('aria-label')) {
        this._setAutoAttr('aria-label', this._strAttr('label', '') || 'Main');
      }
      else if (name === 'breakpoint' && this._initialized) {
        this._applyMobileState(this._measureWidth() < this._breakpointPx());
      }
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      this._hamburgerBtn = this._root.querySelector('.hamburger');
      this._panelEl = this._root.querySelector('.panel');
      this._listEl = this._root.querySelector('.list');
      this._hamburgerBtn.addEventListener('click', this._handleHamburgerClick);
      var panelId = window.LWT.a11y.uid('lwt-nav-panel');
      this._panelEl.id = panelId;
      this._hamburgerBtn.setAttribute('aria-controls', panelId);
      // The <ul> holds slotted <lwtg-nav-item>s, which take role="listitem".
      this._listEl.setAttribute('role', 'list');
      this._applyMobileOpenState();
    }

    closeAll() {
      this._directItemChildren().forEach(function (item) {
        if (typeof item.close === 'function') item.close();
      });
    }

    // ---- structure helpers ----

    _directItemChildren() {
      return Array.prototype.filter.call(this.children, function (c) {
        return c.tagName === 'LWTG-NAV-ITEM';
      });
    }

    _syncOrientation() {
      var orientation = this._strAttr('orientation', 'horizontal');
      this._directItemChildren().forEach(function (item) {
        item.setAttribute('orientation', orientation);
      });
    }

    // ---- responsive breakpoint ----

    _measureWidth() {
      var rect = this.getBoundingClientRect();
      return rect.width || this.offsetWidth || 0;
    }

    _breakpointPx() {
      var v = parseFloat(this._strAttr('breakpoint', '880'));
      return isNaN(v) ? 880 : v;
    }

    _handleResize(entries) {
      var width = (entries && entries[0]) ? entries[0].contentRect.width : this._measureWidth();
      this._applyMobileState(width < this._breakpointPx());
    }

    _applyMobileState(isMobile) {
      if (this._mobile === isMobile) return;
      this._mobile = isMobile;
      this.toggleAttribute('mobile', isMobile);
      if (!isMobile) {
        // Leaving mobile: collapse the off-canvas panel and any open
        // dropdowns so re-entering mobile later starts from a clean state.
        this._mobileOpen = false;
        this._applyMobileOpenState();
        this.closeAll();
      }
      this._propagateMobile();
    }

    _propagateMobile() {
      var mobile = this._mobile;
      this.querySelectorAll('lwtg-nav-item').forEach(function (item) {
        item.toggleAttribute('mobile', mobile);
      });
    }

    // ---- mobile hamburger panel ----

    _handleHamburgerClick() {
      this._mobileOpen = !this._mobileOpen;
      this._applyMobileOpenState();
      if (!this._mobileOpen) this.closeAll();
    }

    _applyMobileOpenState() {
      if (!this._hamburgerBtn) return;
      this.toggleAttribute('data-mobile-open', this._mobileOpen);
      this._hamburgerBtn.setAttribute('aria-expanded', this._mobileOpen ? 'true' : 'false');
    }

    // ---- coordination ----

    _handleChildOpen(event) {
      if (!event.target || event.target.parentElement !== this) return;
      var opened = event.target;
      this._directItemChildren().forEach(function (item) {
        if (item !== opened && typeof item.close === 'function') item.close();
      });
    }

    _handleSelect(event) {
      // lwt-select is also emitted by form controls (lwtf-select, lwtf-input
      // comboboxes) and tabs that may live inside a menu -- ignore those.
      if (!event || !event.target || event.target.tagName !== 'LWTG-NAV-ITEM') return;
      // A leaf item was picked -- if we're showing the mobile off-canvas
      // panel, collapse it (common expectation: picking a link closes
      // the mobile nav rather than leaving it open behind the new page).
      if (this._mobile && this._mobileOpen) {
        this._mobileOpen = false;
        this._applyMobileOpenState();
        this.closeAll();
      }
    }

    _handleDocMousedown(event) {
      var path = event.composedPath ? event.composedPath() : [];
      if (path.indexOf(this) !== -1) return; // click was inside the menu
      this.closeAll();
      if (this._mobile && this._mobileOpen) {
        this._mobileOpen = false;
        this._applyMobileOpenState();
      }
    }

    _handleKeydown(event) {
      if (event.key !== 'Escape') return;
      this.closeAll();
      if (this._mobile && this._mobileOpen) {
        this._mobileOpen = false;
        this._applyMobileOpenState();
        if (this._hamburgerBtn) this._hamburgerBtn.focus();
      }
    }
  }

  window.LWT.define('lwtg-nav-menu', LWTNavMenu);
})();
