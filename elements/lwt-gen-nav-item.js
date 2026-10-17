(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-nav-item.js requires lwt-core.js to be loaded first.');
  }

  var uid = 0;

  function escapeXml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var CHEVRON_SVG =
    '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7l5 5l5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

  var CSS = `
    :host { display: block; position: relative; font-family: inherit; }
    :host([disabled]) { pointer-events: none; }
    .trigger {
      display: flex;
      align-items: center;
      width: 100%;
      box-sizing: border-box;
      gap: var(--lwt-nav-item-gap, var(--lwt-gap, 0.4rem));
      padding: var(--lwt-nav-item-padding-y, 0.55rem) var(--lwt-nav-item-padding-x, 0.9rem);
      border: none;
      background: none;
      cursor: pointer;
      font: inherit;
      font-size: 0.92rem;
      text-align: left;
      color: var(--lwt-nav-item-color, var(--lwt-color-text, #1f2937));
      text-decoration: none;
      border-radius: var(--lwt-nav-item-radius, var(--lwt-border-radius, 6px));
      white-space: nowrap;
    }
    :where(:host([mobile]) .trigger) {
      white-space: normal;
      padding-left: calc(var(--lwt-nav-menu-indent, 1rem) * var(--lwt-nav-item-depth, 0) + var(--lwt-nav-item-padding-x, 0.9rem));
    }
    .trigger:hover {
      color: var(--lwt-nav-item-hover-color, var(--lwt-color-primary, #2563eb));
      background: var(--lwt-nav-item-hover-bg, var(--lwt-color-surface-alt, rgba(0,0,0,0.05)));
    }
    .trigger:focus-visible {
      outline: 2px solid var(--lwt-nav-focus-color, var(--lwt-focus-color, #2563eb));
      outline-offset: -2px;
    }
    :host([disabled]) .trigger { opacity: 0.5; cursor: not-allowed; }
    :host([active]) .trigger {
      color: var(--lwt-nav-item-active-color, var(--lwt-color-primary, #2563eb));
      font-weight: 600;
      background: var(--lwt-nav-item-active-bg, transparent);
    }
    .content {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      overflow: hidden;
    }
    .content ::slotted(img), .content ::slotted(svg) {
      width: 1.05em;
      height: 1.05em;
      flex-shrink: 0;
      vertical-align: middle;
    }
    .chevron {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      margin-left: 0.15rem;
    }
    .chevron svg { width: 11px; height: 11px; transition: transform 150ms ease; }
    :host([data-top-level]:not([orientation="vertical"]):not([mobile])) .chevron svg { transform: rotate(0deg); }
    :host([data-top-level]:not([orientation="vertical"]):not([mobile])[data-open]) .chevron svg {
      transform: rotate(180deg);
    }
    :host([data-top-level][orientation="vertical"]:not([mobile])) .chevron svg,
    :host(:not([data-top-level]):not([mobile])) .chevron svg {
      transform: rotate(-90deg);
    }
    :host([data-top-level][orientation="vertical"]:not([mobile])[data-open]) .chevron svg,
    :host(:not([data-top-level]):not([mobile])[data-open]) .chevron svg {
      transform: rotate(0deg);
    }
    :host([mobile]) .chevron svg { transform: rotate(0deg); }
    :host([mobile][data-open]) .chevron svg { transform: rotate(180deg); }
    .submenu {
      list-style: none;
      margin: 0;
      padding: var(--lwt-nav-dropdown-padding, var(--lwt-padding, 0.35rem));
      min-width: var(--lwt-nav-dropdown-min-width, 180px);
      background: var(--lwt-nav-dropdown-bg, var(--lwt-color-surface, #fff));
      border: var(--lwt-nav-dropdown-border, var(--lwt-border, 1px solid #e5e7eb));
      border-radius: var(--lwt-nav-dropdown-radius, var(--lwt-border-radius, 8px));
      box-shadow: 0 10px 25px var(--lwt-nav-dropdown-shadow, var(--lwt-color-shadow, rgba(0,0,0,0.15)));
    }
    :host([data-top-level]:not([orientation="vertical"]):not([mobile])) .submenu {
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 0.3rem;
      z-index: var(--lwt-nav-menu-z, 100);
    }
    :host([data-top-level][orientation="vertical"]:not([mobile])) .submenu,
    :host(:not([data-top-level]):not([mobile])) .submenu {
      position: absolute;
      top: 0;
      left: 100%;
      margin-left: 0.3rem;
      z-index: var(--lwt-nav-menu-z, 100);
    }
    :host([mobile]) .submenu {
      position: static;
      margin: 0.15rem 0;
      padding: 0;
      background: none;
      border: none;
      box-shadow: none;
    }
  `;

  class LWTNavItem extends window.LWT.Element {
    static get observedAttributes() {
      return ['href', 'target', 'label', 'disabled', 'active', 'mobile', 'orientation'];
    }

    constructor() {
      super();
      this._id = 'lwt-nav-item-' + (++uid);
      this._isOpen = false;
      this._hasChildrenNow = false;
      this._initialized = false;
      this._topLevel = false;
      this._closeTimer = null;

      this._onMouseEnter = this._onMouseEnter.bind(this);
      this._onMouseLeave = this._onMouseLeave.bind(this);
      this._handleTriggerClick = this._handleTriggerClick.bind(this);
      this._handleTriggerKeydown = this._handleTriggerKeydown.bind(this);
      this._handleChildOpen = this._handleChildOpen.bind(this);
      this._syncName = this._syncName.bind(this);
    }

    connectedCallback() {
      super.connectedCallback(); // builds shadow via render()

      if (!this._initialized) {
        this._initialized = true;
        this._topLevel = !!(this.parentElement && this.parentElement.tagName === 'LWTG-NAV-MENU');
        if (this._topLevel) this.setAttribute('data-top-level', '');
        this.style.setProperty('--lwt-nav-item-depth', String(this._computeDepth()));

        // The parser fires connectedCallback right after the open tag,
        // before nested <lwtg-nav-item> children have been appended — so
        // the first render() sees an empty child list and picks the
        // leaf template. Re-check on the next microtask (same fix
        // lwt-gen-tree.js and lwt-gen-carousel.js use) and re-render if
        // children have actually shown up. Also caught by the mutation
        // observer below for later dynamic additions.
        var self = this;
        Promise.resolve().then(function () {
          if (self._hasChildrenNow !== self._computeHasChildren()) self.render();
        });

        if (typeof MutationObserver === 'function') {
          this._childObserver = new MutationObserver(function () {
            if (self._hasChildrenNow !== self._computeHasChildren()) self.render();
          });
          this._childObserver.observe(this, { childList: true });
        }
      }

      this.addEventListener('mouseenter', this._onMouseEnter);
      this.addEventListener('mouseleave', this._onMouseLeave);
      this.addEventListener('lwt-navopen', this._handleChildOpen);

      // Items live inside the menu's (or parent item's) list.
      this._ensureAttr('role', 'listitem');
      this._whenParsed(this._syncName);
    }

    // Name for the trigger: its slotted text, else label, else something
    // derived from the link target, else a generic fallback.
    _syncName() {
      if (!this._triggerEl) return;
      var slot = this._root.querySelector('.content slot');
      var text = slot ? slot.assignedNodes({ flatten: true }).map(function (n) { return n.textContent; }).join('').trim() : '';
      var host = this._hostLabel();
      if (host) { this._triggerEl.setAttribute('aria-label', host); return; }
      if (text || this._strAttr('label', '')) { this._triggerEl.removeAttribute('aria-label'); return; }
      var href = this._strAttr('href', '');
      var fromHref = href ? window.LWT.a11y.humanize(href.split(/[?#]/)[0].split('/').filter(Boolean).pop() || '') : '';
      this._triggerEl.setAttribute('aria-label', this._a11yName([fromHref], 'Menu item', 'Add text content or a label attribute'));
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.removeEventListener('mouseenter', this._onMouseEnter);
      this.removeEventListener('mouseleave', this._onMouseLeave);
      this.removeEventListener('lwt-navopen', this._handleChildOpen);
      clearTimeout(this._closeTimer);
      if (this._childObserver) this._childObserver.disconnect();
    }

    render() {
      this._hasChildrenNow = this._computeHasChildren();
      var href = this._strAttr('href', '');
      var target = this._strAttr('target', '');
      var disabled = this._boolAttr('disabled');
      var fallbackLabel = escapeXml(this._strAttr('label', ''));
      var submenuId = this._id + '-submenu';

      // Leaves use the default (unnamed) slot so text nodes/inline HTML
      // written directly inside the tag ("<lwtg-nav-item>Home</lwtg-nav-item>")
      // are projected — text nodes can't carry a slot="" attribute, so a
      // named-only slot would silently drop them.
      //
      // Parents use the named "label" slot instead, so the default slot is
      // left free for the submenu's own <slot> to receive nested items.
      var labelSlotHtml = this._hasChildrenNow
        ? '<slot name="label">' + fallbackLabel + '</slot>'
        : '<slot>' + fallbackLabel + '</slot>';
      var contentHtml = '<span class="content" part="content">' + labelSlotHtml + '</span>';
      var triggerHtml;
      if (this._hasChildrenNow) {
        triggerHtml =
          '<button type="button" class="trigger" part="trigger" aria-haspopup="true" aria-expanded="false" aria-controls="' + submenuId + '">' +
          contentHtml + '<span class="chevron" part="chevron">' + CHEVRON_SVG + '</span></button>';
      } else if (href) {
        triggerHtml =
          '<a class="trigger" part="trigger" href="' + escapeXml(href) + '"' +
          (target ? ' target="' + escapeXml(target) + '" rel="noopener noreferrer"' : '') + '>' +
          contentHtml + '</a>';
      } else {
        triggerHtml = '<button type="button" class="trigger" part="trigger">' + contentHtml + '</button>';
      }
      var submenuHtml = this._hasChildrenNow
        ? '<ul class="submenu" part="submenu" id="' + submenuId + '" hidden><slot></slot></ul>'
        : '';

      this._renderShadow(triggerHtml + submenuHtml, CSS);

      this._triggerEl = this._root.querySelector('.trigger');
      this._submenuEl = this._hasChildrenNow ? this._root.querySelector('.submenu') : null;

      if (disabled) {
        if (this._triggerEl.tagName === 'BUTTON') this._triggerEl.disabled = true;
        this._triggerEl.tabIndex = -1;
        this._triggerEl.setAttribute('aria-disabled', 'true');
      } else {
        this._triggerEl.removeAttribute('aria-disabled');
      }

      this._triggerEl.addEventListener('click', this._handleTriggerClick);
      this._triggerEl.addEventListener('keydown', this._handleTriggerKeydown);

      // The current page's link is announced as such.
      if (this._boolAttr('active') && this._triggerEl.tagName === 'A') this._triggerEl.setAttribute('aria-current', 'page');
      if (this._submenuEl) this._submenuEl.setAttribute('role', 'list');
      var self = this;
      var labelSlot = this._root.querySelector('.content slot');
      if (labelSlot) labelSlot.addEventListener('slotchange', function () { self._syncName(); });
      // Re-renders can happen mid-parse (the menu pushes mobile/orientation
      // down before an item's text exists); only re-check once parsed.
      if (this._initialized && document.readyState !== 'loading') this._syncName();

      this._applyOpenState();
    }

    // ---- structure helpers ----

    _computeHasChildren() {
      return Array.prototype.some.call(this.children, function (c) {
        return c.tagName === 'LWTG-NAV-ITEM' && c.getAttribute('slot') !== 'label';
      });
    }

    _directChildItems() {
      return Array.prototype.filter.call(this.children, function (c) {
        return c.tagName === 'LWTG-NAV-ITEM' && c.getAttribute('slot') !== 'label';
      });
    }

    _computeDepth() {
      var depth = 0;
      var p = this.parentElement;
      while (p && p.tagName === 'LWTG-NAV-ITEM') {
        depth++;
        p = p.parentElement;
      }
      return depth;
    }

    get labelText() {
      if (this._root) {
        // For leaves the label lives in the default slot; for parents in
        // the named "label" slot. Try either — first one with assigned
        // content wins.
        var slot = this._root.querySelector('slot[name="label"]') ||
                   this._root.querySelector('.content slot:not([name])');
        if (slot) {
          var assigned = slot.assignedNodes({ flatten: true });
          if (assigned.length) {
            return assigned.map(function (n) { return n.textContent; }).join('').trim();
          }
        }
      }
      return this._strAttr('label', '');
    }

    // ---- open/close ----

    get isOpen() { return this._isOpen; }

    open() {
      if (!this._hasChildrenNow || this._isOpen || this._boolAttr('disabled')) return;
      this._isOpen = true;
      this._applyOpenState();
      this._positionSubmenu();
      this.emit('navopen', {});
    }

    close() {
      if (!this._isOpen) return;
      this._isOpen = false;
      // Cascade: collapse any open descendants first, so nothing lingers
      // open the next time this branch is revealed.
      this._directChildItems().forEach(function (c) {
        if (typeof c.close === 'function') c.close();
      });
      this._applyOpenState();
      this._clearSubmenuPosition();
      this.emit('navclose', {});
    }

    toggle() {
      if (this._isOpen) this.close();
      else this.open();
    }

    focusTrigger() {
      if (this._triggerEl) this._triggerEl.focus();
    }

    _applyOpenState() {
      if (!this._hasChildrenNow) {
        this.removeAttribute('data-open');
        return;
      }
      if (this._isOpen) {
        this.setAttribute('data-open', '');
        if (this._submenuEl) this._submenuEl.hidden = false;
        if (this._triggerEl) this._triggerEl.setAttribute('aria-expanded', 'true');
      } else {
        this.removeAttribute('data-open');
        if (this._submenuEl) this._submenuEl.hidden = true;
        if (this._triggerEl) this._triggerEl.setAttribute('aria-expanded', 'false');
      }
    }

    // ---- event handlers ----

    _handleChildOpen(event) {
      // Only react when a DIRECT child opened -- deeper descendants'
      // events also bubble here, but those are that child's own concern.
      if (!event.target || event.target.parentElement !== this) return;
      var opened = event.target;
      this._directChildItems().forEach(function (item) {
        if (item !== opened && typeof item.close === 'function') item.close();
      });
    }

    _handleTriggerClick(event) {
      if (this._boolAttr('disabled')) { event.preventDefault(); return; }
      if (this._hasChildrenNow) {
        event.preventDefault();
        this.toggle();
      } else {
        this.emit('select', { href: this._strAttr('href', ''), label: this.labelText });
      }
    }

    _handleTriggerKeydown(event) {
      if (this._boolAttr('disabled')) return;

      if (event.key === 'ArrowDown' && this._hasChildrenNow) {
        event.preventDefault();
        this.open();
        var first = this._directChildItems()[0];
        if (first && typeof first.focusTrigger === 'function') first.focusTrigger();
      } else if (event.key === 'Escape') {
        var target = (this._hasChildrenNow && this._isOpen) ? this : this._openAncestor();
        if (target) {
          event.preventDefault();
          target.close();
          if (typeof target.focusTrigger === 'function') target.focusTrigger();
        }
      }
    }

    _openAncestor() {
      var p = this.parentElement;
      while (p && p.tagName === 'LWTG-NAV-ITEM') {
        if (p.isOpen) return p;
        p = p.parentElement;
      }
      return null;
    }

    _onMouseEnter() {
      if (this._boolAttr('mobile') || !this._hasChildrenNow || this._boolAttr('disabled')) return;
      clearTimeout(this._closeTimer);
      this.open();
    }

    _onMouseLeave() {
      if (this._boolAttr('mobile') || !this._hasChildrenNow) return;
      var self = this;
      this._closeTimer = setTimeout(function () { self.close(); }, 220);
    }

    // ---- viewport-aware flyout positioning ----

    _positionSubmenu() {
      if (this._boolAttr('mobile') || !this._submenuEl) return;
      var el = this._submenuEl;
      el.style.left = ''; el.style.right = ''; el.style.top = ''; el.style.bottom = '';
      var rect = el.getBoundingClientRect();
      var vpW = window.innerWidth, vpH = window.innerHeight;
      if (rect.right > vpW - 4) { el.style.left = 'auto'; el.style.right = '0'; }
      if (rect.bottom > vpH - 4) { el.style.top = 'auto'; el.style.bottom = '0'; }
    }

    _clearSubmenuPosition() {
      if (!this._submenuEl) return;
      this._submenuEl.style.left = ''; this._submenuEl.style.right = '';
      this._submenuEl.style.top = ''; this._submenuEl.style.bottom = '';
    }
  }

  window.LWT.define('lwtg-nav-item', LWTNavItem);
})();
