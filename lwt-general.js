/*!
 * LWT General Elements
 * Developer: Lee W Winter
 * Last Generated: 2026-10-18T21:32:52.402Z
 * Requires lwt-core.js to be loaded first.
 */

/* ---- lwt-gen-accordion.js ---- */
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



(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-accordion-item.js requires lwt-core.js to be loaded first.');
  }

  var idCounter = 0;

  var CSS = `
    :host { display: block; font-family: inherit; }
    .trigger { 
      display: flex; 
      align-items: center; 
      justify-content: space-between; 
      gap: var(--lwt-accordion-gap, var(--lwt-gap, 0.75rem)); 
      width: 100%;
      padding: var(--lwt-accordion-padding, var(--lwt-padding, 0.75rem)); 
      background: none;  border: none;  cursor: pointer;  text-align: left; font: inherit; color: inherit; 
    }
    .trigger:disabled { cursor: not-allowed; opacity: 0.5; }
    .trigger:focus-visible { 
      outline: var(--lwt-accordion-focus-color, var(--lwt-focus-ring, 2px solid #2563eb)); 
      outline-offset: 2px; 
      border-radius: var(--lwt-accordion-border-radius, var(--lwt-border-radius, 4px)); 
    }
    .label { flex: 1; min-width: 0; }
    .chevron { 
      flex-shrink: 0; width: 18px; height: 18px; 
      color: var(--lwt-accordion-icon-color, var(--lwt-icon-color, #6b7280)); 
      transition: transform 200ms ease; 
    }
    :host([open]) .chevron { transform: rotate(180deg); }
    .panel { height: 0; overflow: hidden; transition: height 200ms ease; }
    .panel-inner { padding: var(--lwt-accordion-padding, var(--lwt-padding, 0.75rem)); }
    .panel-inner ::slotted(*:first-child) { margin-top: 0; }
    .panel-inner ::slotted(*:last-child) { margin-bottom: 0; }
  `;

  // The trigger sits inside a heading (WAI-ARIA accordion pattern) so
  // screen-reader users can jump between sections by heading. Level comes
  // from the host's heading-level attribute (default 3).
  var TEMPLATE =
    '<div class="heading" role="heading" aria-level="3">' +
    '<button type="button" class="trigger" part="trigger" aria-expanded="false">' +
    '  <span class="label" part="label"><slot name="label"></slot></span>' +
    '  <span class="chevron" part="chevron">' +
    '    <svg viewBox="0 0 20 20"><path d="M5 7l5 5l5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>' +
    '  </span>' +
    '</button>' +
    '</div>' +
    '<div class="panel" part="panel" role="region">' +
    '  <div class="panel-inner"><slot name="body"></slot></div>' +
    '</div>';

  class LWTAccordionItem extends window.LWT.Element {
    constructor() {
      super();
      this._isOpen = false;
      this._initialized = false;
      this._handleTriggerClick = this._handleTriggerClick.bind(this);
      this._handleTransitionEnd = this._handleTransitionEnd.bind(this);
    }

    connectedCallback() {
      super.connectedCallback(); // builds shadow via render(), caches refs, wires listeners

      if (!this._initialized) {
        this._initialized = true;
        var startOpen = this.hasAttribute('open') && !this._boolAttr('disabled');
        this._isOpen = startOpen;
        this._trigger.setAttribute('aria-expanded', startOpen ? 'true' : 'false');
        if (startOpen) {
          this._panel.style.display = 'block';
          this._panel.style.height = 'auto';
        } else {
          this._panel.style.display = 'none';
          this._panel.style.height = '0px';
          this.removeAttribute('open');
        }
      }
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      var root = this._root;
      this._trigger = root.querySelector('.trigger');
      this._panel = root.querySelector('.panel');

      var panelId = 'lwt-accordion-panel-' + (++idCounter);
      var triggerId = 'lwt-accordion-trigger-' + idCounter;
      this._panel.id = panelId;
      this._trigger.id = triggerId;
      this._trigger.setAttribute('aria-controls', panelId);
      this._panel.setAttribute('aria-labelledby', triggerId);
      this._trigger.disabled = this._boolAttr('disabled');

      var level = parseInt(this._strAttr('heading-level', '3'), 10);
      root.querySelector('.heading').setAttribute('aria-level', String(level >= 1 && level <= 6 ? level : 3));

      // Accessible name: the slotted label text; if there isn't any, fall
      // back to a generic name (and tell the developer).
      var labelSlot = root.querySelector('slot[name="label"]');
      var self = this;
      var syncName = function () {
        if (!labelSlot.isConnected) return; // superseded by a newer render
        var text = labelSlot.assignedNodes({ flatten: true }).map(function (n) { return n.textContent; }).join('').trim();
        var host = self._hostLabel();
        if (host || !text) {
          self._trigger.setAttribute('aria-label', self._a11yName([], 'Toggle section', 'Add an element with slot="label"'));
        } else {
          self._trigger.removeAttribute('aria-label');
        }
      };
      labelSlot.addEventListener('slotchange', syncName);
      // Light-DOM children may not be parsed yet; check again after.
      this._whenParsed(syncName);

      this._trigger.addEventListener('click', this._handleTriggerClick);
      this._panel.addEventListener('transitionend', this._handleTransitionEnd);
    }

    get isOpen() {
      return this._isOpen;
    }

    open() {
      if (this._isOpen || this._boolAttr('disabled')) return;
      this._isOpen = true;
      this.setAttribute('open', '');
      this._trigger.setAttribute('aria-expanded', 'true');
      this._animateOpen();
      this.emit('open', {});
    }

    close() {
      if (!this._isOpen) return;
      this._isOpen = false;
      this.removeAttribute('open');
      this._trigger.setAttribute('aria-expanded', 'false');
      this._animateClose();
      this.emit('close', {});
    }

    toggle() {
      if (this._isOpen) this.close();
      else this.open();
    }

    _handleTriggerClick() {
      if (this._boolAttr('disabled')) return;
      this.toggle();
    }

    _animateOpen() {
      var panel = this._panel;
      panel.style.display = 'block';
      var target = panel.scrollHeight;
      panel.style.height = '0px';
      void panel.offsetHeight; // force reflow so the 0px start registers before animating
      panel.style.height = target + 'px';
    }

    _animateClose() {
      var panel = this._panel;
      var current = panel.scrollHeight;
      panel.style.height = current + 'px';
      void panel.offsetHeight; // force reflow so the current-height start registers
      panel.style.height = '0px';
    }

    _handleTransitionEnd(event) {
      if (event.propertyName !== 'height') return;
      if (this._isOpen) {
        this._panel.style.height = 'auto';
      } else {
        this._panel.style.display = 'none';
      }
    }
  }

  window.LWT.define('lwtg-accordion-item', LWTAccordionItem);
})();

/* ---- lwt-gen-alert.js ---- */
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

  var CSS = `
    :host { display: block; font-family: inherit; }
    :host([variant="success"]) { color: var(--lwt-alert-success-color, var(--lwt-color-success, #22c55e)); }
    :host([variant="warning"]) { color: var(--lwt-alert-warning-color, var(--lwt-color-warning, #f59e0b)); }
    :host([variant="info"]), :host(:not([variant])) { color: var(--lwt-alert-info-color, var(--lwt-color-info, #3b82f6)); }
    :host([variant="error"]) { color: var(--lwt-alert-error-color, var(--lwt-color-danger, #ef4444)); }
    .alert {
      display: flex;
      align-items: flex-start;
      gap: var(--lwt-alert-gap, var(--lwt-gap, 0.65rem));
      padding: var(--lwt-alert-padding, var(--lwt-padding, 0.85rem 1rem));
      border-radius: var(--lwt-alert-radius, var(--lwt-border-radius, 10px));
      border: 1px solid currentColor;
      background: var(--lwt-alert-bg, color-mix(in srgb, currentColor 8%, var(--lwt-color-surface, white)));
    }
    .icon { flex-shrink: 0; width: 20px; height: 20px; margin-top: 0.1rem; }
    .icon-bg { fill: currentColor; }
    .content { flex: 1; min-width: 0; }
    .title {
      font-weight: 700;
      font-size: 0.92rem;
      color: var(--lwt-alert-title-color, var(--lwt-color-text-strong, #111827));
      margin-bottom: 0.15rem;
    }
    .message { font-size: 0.88rem; color: var(--lwt-alert-text-color, var(--lwt-color-text, #374151)); }
    ::slotted(*:first-child) { margin-top: 0; }
    ::slotted(*:last-child) { margin-bottom: 0; }
    .close {
      flex-shrink: 0;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 1.2rem;
      line-height: 1;
      color: inherit;
      opacity: 0.6;
      padding: 0;
      min-width: 24px;
      min-height: 24px;
      margin: -0.2rem -0.3rem -0.2rem 0;
      border-radius: 4px;
    }
    .close:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; opacity: 1; }
    .close:hover { opacity: 1; }
  `;

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

/* ---- lwt-gen-button.js ---- */
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

/* ---- lwt-gen-card.js ---- */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-card.js requires lwt-core.js to be loaded first.');
  }

  function escapeXml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var CSS = `
    :host { display: block; font-family: inherit; height: 100%; }
    .card { 
      display: flex; 
      flex-direction: column; 
      box-sizing: border-box;
      height:        var(--lwt-card-height, 100%); 
      background:    var(--lwt-card-bg, var(--lwt-color-surface, #fff)); 
      border:        var(--lwt-card-border, var(--lwt-border, 1px solid #e5e7eb));
      border-radius: var(--lwt-card-radius, var(--lwt-border-radius, 12px)); 
      box-shadow:    var(--lwt-card-shadow, none); 
      overflow: hidden; 
    }
    .image-wrap { order: 0; flex-shrink: 0; }
    .image { display: block; width: 100%; height: var(--lwt-card-image-height, 180px); object-fit: cover; }
    :where(:host([image-position="bottom"]) .image-wrap) { order: 2; } 
    :where(:host([image-position="bottom"]) .content) { order: 1; }
    .content { 
      order: 1; 
      flex: 1; 
      display: flex; 
      flex-direction: column;
      padding: var(--lwt-card-padding, var(--lwt-padding, 1.25rem)); 
      gap: var(--lwt-card-gap, var(--lwt-gap, 0.5rem)); 
    }
    .label { font-weight: 600; font-size: 1.05rem; color: var(--lwt-card-label-color, var(--lwt-color-text-strong, #111827)); }
    .body { flex: 1; font-size: 0.9rem; line-height: 1.55; color: var(--lwt-card-body-color, var(--lwt-color-text, #4b5563)); }
    .body ::slotted(*:first-child) { margin-top: 0; }
    .body ::slotted(*:last-child) { margin-bottom: 0; }
    .cta { display: flex; }`;

    // image-position wrapped in :where() so a media query can flip
    // image top/bottom responsively without !important.

  class LWTCard extends window.LWT.Element {
    static get observedAttributes() {
      return ['image', 'image-alt', 'label', 'heading-level'];
    }

    render() {
      var hasImage = this.hasAttribute('image');
      var fallbackLabel = escapeXml(this._strAttr('label', ''));

      var html =
        '<div class="card" part="card">' +
        (hasImage
          ? '<div class="image-wrap" part="image-wrap">' +
            '<img class="image" part="image" src="' + escapeXml(this._strAttr('image', '')) + '"' +
            ' alt="' + escapeXml(this._strAttr('image-alt', '')) + '">' +
            '</div>'
          : '') +
        '<div class="content" part="content">' +
        '<div class="label" part="label"><slot name="label">' + fallbackLabel + '</slot></div>' +
        '<div class="body" part="body"><slot></slot></div>' +
        '<div class="cta" part="cta"><slot name="cta"></slot></div>' +
        '</div>' +
        '</div>';

      this._renderShadow(html, CSS);

      // Image without image-alt: the card's own label already describes
      // it, so treat it as decorative (alt="") rather than leave alt off.
      if (hasImage && !this.hasAttribute('image-alt')) {
        this._a11yWarn('image-alt', 'has an image but no image-alt, so it is marked decorative (alt=""). ' +
          'Set image-alt if the image conveys information the label does not.');
      }

      // A label given as an attribute becomes a heading (level from
      // heading-level, default 3) so cards show up in the page outline.
      // Slotted label content is left alone -- use your own <h2>/<h3> there.
      var labelEl = this._root.querySelector('.label');
      var labelSlot = labelEl.querySelector('slot');
      var level = parseInt(this._strAttr('heading-level', '3'), 10);
      if (!(level >= 1 && level <= 6)) level = 3;
      var syncHeading = function () {
        var slotted = labelSlot.assignedNodes({ flatten: true }).length > 0;
        if (!slotted && fallbackLabel) {
          labelEl.setAttribute('role', 'heading');
          labelEl.setAttribute('aria-level', String(level));
        } else {
          labelEl.removeAttribute('role');
          labelEl.removeAttribute('aria-level');
        }
      };
      labelSlot.addEventListener('slotchange', syncHeading);
      syncHeading();
    }
  }

  window.LWT.define('lwtg-card', LWTCard);
})();

/* ---- lwt-gen-carousel.js ---- */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-carousel.js requires lwt-core.js to be loaded first.');
  }

  var CSS = `
    :host { display: block; font-family: inherit; }
    .track {
      display: flex;
      gap: var(--lwt-carousel-gap, var(--lwt-gap, 1rem));
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scroll-behavior: smooth;
      padding-bottom: 0.25rem;
      scrollbar-width: thin;
    }
    ::slotted(lwtg-card) { scroll-snap-align: start; flex: 0 0 auto; width: var(--lwt-carousel-card-width, 260px); }
    .dots {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.1rem;
      margin-top: 0.6rem;
    }
    /* Each dot is a 24x24 tap target (WCAG 2.5.8) drawing a small circle. */
    .dot {
      width: 24px;
      height: 24px;
      padding: 0;
      margin: 0;
      border: none;
      border-radius: 50%;
      background: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
    }
    .dot::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--lwt-carousel-dot-color, var(--lwt-color-border-strong, #9ca3af));
    }
    .dot[aria-current="true"]::before {
      background: var(--lwt-carousel-dot-active-color, var(--lwt-color-text, #374151));
    }
    :host([dot-as-image]) .dot::before { content: none; }
    .dot:focus-visible {
      outline: 2px solid var(--lwt-carousel-dot-active-color, var(--lwt-color-text, #374151));
      outline-offset: 2px;
    }
    :host([dot-as-image]) .dot {
      width: var(--lwt-carousel-dot-size, 32px);
      height: var(--lwt-carousel-dot-size, 32px);
      border-radius: var(--lwt-carousel-dot-radius, var(--lwt-border-radius, 6px));
      overflow: hidden;
      background: var(--lwt-carousel-dot-color, var(--lwt-border-color, #e5e7eb));
    }
    :host([dot-as-image]) .dot img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      aspect-ratio: 1 / 1;
      display: block;
    }
    :host([dot-as-image]) .dot[aria-current="true"] {
      outline: 2px solid var(--lwt-carousel-dot-active-color, var(--lwt-color-text, #374151));
      outline-offset: 2px;
    }
  `;

  var TEMPLATE =
    '<div class="wrap" part="wrap">' +
    '<div class="track" part="track" role="region" aria-roledescription="carousel" tabindex="0"><slot></slot></div>' +
    '<div class="dots" part="dots" role="group" aria-label="Choose slide"></div>' +
    '</div>';

  class LWTCarousel extends window.LWT.Element {
    static get observedAttributes() {
      return ['dot-as-image', 'image-position', 'label', 'aria-label'];
    }

    constructor() {
      super();
      this._initialized = false;
      this._activeIndex = 0;
      this._observer = null;
    }

    connectedCallback() {
      super.connectedCallback();

      if (!this._initialized) {
        this._initialized = true;
        this._syncImagePosition();
        var self = this;
        Promise.resolve().then(function () {
          self._buildDots();
          self._setupObserver();
        });
      }

      // With scripts in <head>, cards are parsed *after* this element
      // connects, so the one-shot build above can see zero cards. Rebuild
      // dots and re-observe cards whenever the child list changes.
      if (typeof MutationObserver === 'function') {
        if (!this._childObserver) {
          var carousel = this;
          this._childObserver = new MutationObserver(function () {
            carousel._syncImagePosition();
            carousel._buildDots();
            carousel._setupObserver();
          });
        }
        this._childObserver.observe(this, { childList: true });
      }
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._observer) this._observer.disconnect();
      if (this._childObserver) this._childObserver.disconnect();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (name === 'dot-as-image') this._buildDots();
      else if (name === 'image-position') this._syncImagePosition();
      else if ((name === 'label' || name === 'aria-label') && this._trackEl) {
        this._trackEl.setAttribute('aria-label', this._a11yName([this._strAttr('label', '')], 'Carousel', 'Add a label attribute'));
      }
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      this._trackEl = this._root.querySelector('.track');
      this._dotsEl = this._root.querySelector('.dots');
      this._trackEl.setAttribute('aria-label', this._a11yName([this._strAttr('label', '')], 'Carousel', 'Add a label attribute'));
    }

    get activeIndex() {
      return this._activeIndex;
    }

    _cards() {
      return Array.prototype.filter.call(this.children, function (c) { return c.tagName === 'LWTG-CARD'; });
    }

    _syncImagePosition() {
      if (!this.hasAttribute('image-position')) return;
      var pos = this._strAttr('image-position', 'top');
      this._cards().forEach(function (card) { card.setAttribute('image-position', pos); });
    }

    _buildDots() {
      if (!this._dotsEl) return;
      var self = this;
      var dotAsImage = this._boolAttr('dot-as-image');
      this._dotsEl.innerHTML = '';

      var cards = this._cards();
      cards.forEach(function (card, index) {
        // Announce each card as "slide N of M" unless the developer gave
        // the card its own role/name.
        if (!card.hasAttribute('role') || card.hasAttribute('data-lwt-slide')) {
          card.setAttribute('role', 'group');
          card.setAttribute('aria-roledescription', 'slide');
          card.setAttribute('data-lwt-slide', '');
          if (!card.hasAttribute('aria-label') || card.hasAttribute('data-lwt-slide-label')) {
            var cardLabel = card.getAttribute('label');
            card.setAttribute('aria-label', (index + 1) + ' of ' + cards.length + (cardLabel ? ': ' + cardLabel : ''));
            card.setAttribute('data-lwt-slide-label', '');
          }
        }
        var dot = self._genhtml({
          type: 'button',
          attr: {
            type: 'button',
            part: 'dot',
            'aria-label': 'Go to slide ' + (index + 1),
            'aria-current': index === self._activeIndex ? 'true' : 'false'
          }
        });
        dot.className = 'dot';

        var imageSrc = card.getAttribute('image');
        if (dotAsImage && imageSrc) {
          dot.appendChild(self._genhtml({ type: 'img', attr: { src: imageSrc, alt: '' } }));
        }

        dot.addEventListener('click', function () { self.goTo(index); });
        self._dotsEl.appendChild(dot);
      });
    }

    _syncDots() {
      if (!this._dotsEl) return;
      var self = this;
      Array.prototype.forEach.call(this._dotsEl.children, function (dot, index) {
        dot.setAttribute('aria-current', index === self._activeIndex ? 'true' : 'false');
      });
    }

    _setupObserver() {
      if (typeof IntersectionObserver !== 'function' || !this._trackEl) return;
      if (this._observer) this._observer.disconnect();
      var self = this;
      this._observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            self._setActiveCard(entry.target, false);
          }
        });
      }, { root: this._trackEl, threshold: [0, 0.6, 1] });

      this._cards().forEach(function (card) { self._observer.observe(card); });
    }

    // shouldScroll: true when navigation was requested programmatically
    // (goTo/next/prev/dot click) and the card needs to be scrolled into
    // view; false when this is just the observer reporting that the
    // user has already scrolled a new card into view on their own.
    _setActiveCard(card, shouldScroll) {
      var cards = this._cards();
      var index = cards.indexOf(card);
      if (index === -1) return;

      if (shouldScroll && typeof card.scrollIntoView === 'function') {
        card.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      }

      if (index === this._activeIndex) return;
      this._activeIndex = index;
      this._syncDots();
      this.emit('change', { index: index, card: card });
    }

    goTo(index) {
      var card = this._cards()[index];
      if (!card) return;
      this._setActiveCard(card, true);
    }

    next() {
      this.goTo(this._activeIndex + 1);
    }

    prev() {
      this.goTo(this._activeIndex - 1);
    }
  }

  window.LWT.define('lwtg-carousel', LWTCarousel);
})();

/* ---- lwt-gen-grid-item.js ---- */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-grid-item.js requires lwt-core.js to be loaded first.');
  }

  function escapeXml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/;

  function extractYouTubeId(src) {
    var match = YOUTUBE_RE.exec(src || '');
    return match ? match[1] : '';
  }

  var PLAY_ICON =
    '<svg viewBox="0 0 68 48" aria-hidden="true">' +
    '<path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z" fill="rgba(0,0,0,0.65)"></path>' +
    '<path d="M45 24 27 14v20" fill="#fff"></path>' +
    '</svg>';

  var CSS = `
    :host {
      display: block;
      position: relative;
      box-sizing: border-box;
      font-family: inherit;
      cursor: pointer;
      border-radius: var(--lwt-grid-item-radius, var(--lwt-border-radius, 10px));
      overflow: hidden;
      background: var(--lwt-grid-item-bg, var(--lwt-border-color, #e5e7eb));
      outline: none;
    }
    /* Cell spanning defaults — wrapped in :where() so their specificity
       is (0,0,0). ANY external selector ("lwtg-grid-item.hero", a media
       query, an id, etc.) wins with no !important, so users can override
       the span responsively:

       @media (max-width: 600px) {
         lwtg-grid-item.hero { grid-column: auto; grid-row: auto; }
       }

       Anything outside the 2-8 col / 2-6 row range still works — just set
       style="grid-column: span 12" directly on the item; inline styles
       beat these defaults automatically. */
    :where(:host([col-span="2"])) { grid-column: span 2; }
    :where(:host([col-span="3"])) { grid-column: span 3; }
    :where(:host([col-span="4"])) { grid-column: span 4; }
    :where(:host([col-span="5"])) { grid-column: span 5; }
    :where(:host([col-span="6"])) { grid-column: span 6; }
    :where(:host([col-span="7"])) { grid-column: span 7; }
    :where(:host([col-span="8"])) { grid-column: span 8; }
    :where(:host([col-span="full"])) { grid-column: 1 / -1; }
    :where(:host([row-span="2"])) { grid-row: span 2; }
    :where(:host([row-span="3"])) { grid-row: span 3; }
    :where(:host([row-span="4"])) { grid-row: span 4; }
    :where(:host([row-span="5"])) { grid-row: span 5; }
    :where(:host([row-span="6"])) { grid-row: span 6; }
    :host(:focus-visible) {
      outline: 2px solid var(--lwt-grid-item-focus-color, var(--lwt-focus-color, #3b82f6));
      outline-offset: 2px;
    }
    .media {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .media img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .media a { display: block; width: 100%; height: 100%; }
    .media ::slotted(*) { width: 100%; height: 100%; }
    .yt-facade { position: relative; width: 100%; height: 100%; }
    .yt-facade img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .yt-play {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .yt-play svg {
      width: 25%;
      min-width: 40px;
      max-width: 68px;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,.35));
    }
    .yt-embed {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
    }
    .label-overlay {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: var(--lwt-grid-item-label-padding, 0.55rem 0.7rem 0.5rem);
      background: var(--lwt-grid-item-label-bg, linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0)));
      color: var(--lwt-grid-item-label-color, #fff);
      font-size: 0.85rem;
      font-weight: 600;
      line-height: 1.3;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 160ms ease, transform 160ms ease;
      pointer-events: none;
    }
    :host(:hover) .label-overlay, :host(:focus-visible) .label-overlay { opacity: 1; transform: translateY(0); }
  
    /* Resize handles (only inside <lwtg-grid resizable>, see lwt-gen-grid.js).
       The grab area is always there; the line shows on hover / focus. */
    .rz { display: none; position: absolute; z-index: 3; touch-action: none; outline: none; }
    :host([data-resizable]) .rz { display: block; }
    :host([data-resizable="rows"]) .rz-left, :host([data-resizable="rows"]) .rz-right { display: none; }
    .rz-left, .rz-right { top: 0; bottom: 0; width: var(--lwt-grid-resize-size, 10px); cursor: col-resize; }
    .rz-left { left: 0; }
    .rz-right { right: 0; }
    .rz-top, .rz-bottom { left: 0; right: 0; height: var(--lwt-grid-resize-size, 10px); cursor: row-resize; }
    .rz-top { top: 0; }
    .rz-bottom { bottom: 0; }
    .rz::before {
      content: "";
      position: absolute;
      background: var(--lwt-grid-resize-color, var(--lwt-primary, #2563eb));
      opacity: 0;
      transition: opacity 120ms ease;
      border-radius: 2px;
    }
    .rz-left::before, .rz-right::before { top: 0; bottom: 0; width: 3px; }
    .rz-left::before { left: 0; }
    .rz-right::before { right: 0; }
    .rz-top::before, .rz-bottom::before { left: 0; right: 0; height: 3px; }
    .rz-top::before { top: 0; }
    .rz-bottom::before { bottom: 0; }
    /* Grip in the middle of the edge. */
    .rz::after {
      content: "";
      position: absolute;
      background: var(--lwt-grid-resize-color, var(--lwt-primary, #2563eb));
      border: 2px solid var(--lwt-color-surface, #fff);
      border-radius: 999px;
      opacity: 0;
      transition: opacity 120ms ease;
    }
    .rz-left::after, .rz-right::after { top: 50%; width: 6px; height: 32px; margin-top: -16px; }
    .rz-left::after { left: -1px; }
    .rz-right::after { right: -1px; }
    .rz-top::after, .rz-bottom::after { left: 50%; height: 6px; width: 32px; margin-left: -16px; }
    .rz-top::after { top: -1px; }
    .rz-bottom::after { bottom: -1px; }
    :host(:hover) .rz::before { opacity: 0.45; }
    :host(:hover) .rz::after { opacity: 1; }
    .rz:hover::before, .rz.active::before, .rz:focus-visible::before { opacity: 1; }
    .rz:focus-visible::after, .rz.active::after { opacity: 1; }
    .rz:focus-visible { box-shadow: inset 0 0 0 2px var(--lwt-grid-item-focus-color, var(--lwt-focus-color, #3b82f6)); }
    @media (prefers-reduced-motion: reduce) { .rz::before, .rz::after { transition: none; } }
  `;

  class LWTGridItem extends window.LWT.Element {
    static get observedAttributes() {
      return ['src', 'href', 'type', 'label', 'video-id', 'alt', 'col-span', 'row-span',
              'resize-left', 'resize-right', 'resize-top', 'resize-bottom', 'min-width', 'min-height'];
    }

    constructor() {
      super();
      this._handleActivate = this._handleActivate.bind(this);
      this._handleKeydown = this._handleKeydown.bind(this);

      // Resize handles live in the shadow root. Their events are handled
      // here and stopped, so a drag / key press on a handle never also
      // "clicks" the item.
      var self = this;
      var handleOf = function (e) { return e.target && e.target.closest ? e.target.closest('.rz') : null; };
      var grid = function () { var p = self.parentElement; return p && p.localName === 'lwtg-grid' ? p : null; };
      this._root.addEventListener('pointerdown', function (e) {
        var h = handleOf(e); if (!h) return;
        e.stopPropagation();
        if (e.button !== 0 || !grid()) return;
        e.preventDefault();
        h.focus({ preventScroll: true });
        if (grid()._beginResize(self, h.getAttribute('data-edge'), e)) {
          h.classList.add('active');
          var done = function () { h.classList.remove('active'); window.removeEventListener('pointerup', done); window.removeEventListener('pointercancel', done); };
          window.addEventListener('pointerup', done);
          window.addEventListener('pointercancel', done);
        }
      });
      this._root.addEventListener('click', function (e) { if (handleOf(e)) e.stopPropagation(); });
      this._root.addEventListener('dblclick', function (e) {
        var h = handleOf(e); if (!h) return;
        e.stopPropagation();
        if (grid() && grid()._equalize(self, h.getAttribute('data-edge'))) self._refreshHandles();
      });
      this._root.addEventListener('keydown', function (e) {
        var h = handleOf(e); if (!h) return;
        e.stopPropagation(); // keep Enter / Space from activating the item
        var edge = h.getAttribute('data-edge');
        var horizontal = edge === 'left' || edge === 'right';
        var step = e.shiftKey ? 50 : 10;
        var delta = 0;
        if (horizontal && e.key === 'ArrowLeft') delta = -step;
        else if (horizontal && e.key === 'ArrowRight') delta = step;
        else if (!horizontal && e.key === 'ArrowUp') delta = -step;
        else if (!horizontal && e.key === 'ArrowDown') delta = step;
        if (!delta || !grid()) return;
        e.preventDefault();
        if (grid()._nudge(self, edge, delta)) self._refreshHandles();
      });
      this._root.addEventListener('focusin', function (e) { if (handleOf(e)) self._refreshHandles(); });
    }

    connectedCallback() {
      super.connectedCallback();
      this.addEventListener('click', this._handleActivate);
      this.addEventListener('keydown', this._handleKeydown);
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.removeEventListener('click', this._handleActivate);
      this.removeEventListener('keydown', this._handleKeydown);
    }

    render() {
      var type = this._resolveType();
      var label = this._strAttr('label', '');

      var html =
        '<div class="media" part="media">' + this._buildMediaHtml(type) + '</div>' +
        (label ? '<div class="label-overlay" part="label">' + escapeXml(label) + '</div>' : '') +
        this._handlesHtml();

      this._renderShadow(html, CSS);
      this._mediaEl = this._root.querySelector('.media');
      // min-width / min-height are applied by the parent grid to the tracks
      // this item spans.
      var grid = this.parentElement;
      if (grid && grid.localName === 'lwtg-grid' && typeof grid._scheduleMins === 'function') grid._scheduleMins();
      this._applyA11y(type);
    }

    // One drag handle per resize-* attribute. They only show (and are only
    // focusable) when the parent <lwtg-grid> has `resizable`.
    _handlesHtml() {
      var self = this;
      return ['left', 'right', 'top', 'bottom'].filter(function (edge) {
        return self.hasAttribute('resize-' + edge);
      }).map(function (edge) {
        var vertical = edge === 'left' || edge === 'right';
        return '<div class="rz rz-' + edge + '" part="resize-handle resize-' + edge + '" data-edge="' + edge + '"' +
          ' role="separator" tabindex="0" aria-orientation="' + (vertical ? 'vertical' : 'horizontal') + '"' +
          ' aria-valuemin="0" aria-valuemax="100" aria-label="Resize ' + (vertical ? 'column' : 'row') + ' (' + edge + ' edge)"></div>';
      }).join('');
    }

    // Keep each handle's aria-valuenow / valuetext in step with the layout.
    _refreshHandles() {
      var p = this.parentElement;
      if (!p || p.localName !== 'lwtg-grid' || typeof p._handleState !== 'function') return;
      var self = this;
      this._root.querySelectorAll('.rz').forEach(function (h) {
        var st = p._handleState(self, h.getAttribute('data-edge'));
        if (st) {
          h.setAttribute('aria-valuenow', String(st.now));
          h.setAttribute('aria-valuetext', st.text);
          h.removeAttribute('aria-disabled');
        } else {
          // An outer grid edge: nothing to resize.
          h.setAttribute('aria-disabled', 'true');
        }
      });
    }

    // Accessible name: label, then alt, then a name derived from the file
    // (e.g. "summer-sale.jpg" -> "Summer sale"), then a generic fallback.
    _accessibleName(type) {
      var src = this._strAttr('src', '');
      var fromFile = '';
      if (src && type !== 'youtube') {
        var file = src.split(/[?#]/)[0].split('/').pop().replace(/\.[a-z0-9]+$/i, '');
        fromFile = window.LWT.a11y.humanize(decodeURIComponent(file));
      }
      var fallback = type === 'youtube' ? 'Play video' : (fromFile || 'Image');
      var name = this._a11yName([this._strAttr('label', ''), this._strAttr('alt', '')], fallback,
        'Add a label or alt attribute');
      return type === 'youtube' && !this._playing && name.indexOf('Play') !== 0 ? 'Play video: ' + name : name;
    }

    _applyA11y(type) {
      var name = this._accessibleName(type);
      var link = this._root.querySelector('a.media-link');

      if (link) {
        // A real link does the work: name it, and keep the host out of the
        // tab order so there's no button-wrapping-a-link nesting.
        link.setAttribute('aria-label', name);
        var img = link.querySelector('img');
        if (img) img.setAttribute('alt', '');
        this._removeAutoAttr('role');
        this._removeAutoAttr('aria-label');
        if (this._autoTabIndex) { this.removeAttribute('tabindex'); this._autoTabIndex = false; }
        return;
      }

      // Otherwise the host itself is the button; the media inside is
      // presentational (its meaning is carried by the host's name).
      this._ensureAttr('role', 'button');
      this._ensureAttr('aria-label', name);
      if (!this.hasAttribute('tabindex') || this._autoTabIndex) { this.tabIndex = 0; this._autoTabIndex = true; }
      if (this._mediaEl) this._mediaEl.setAttribute('aria-hidden', 'true');
    }

    _resolveType() {
      if (this.hasAttribute('video-id') || extractYouTubeId(this._strAttr('src', ''))) return 'youtube';
      var explicit = this._strAttr('type', '');
      if (explicit) return explicit;
      if (!this.hasAttribute('src')) return 'embed';
      return 'image';
    }

    _buildMediaHtml(type) {
      var src = this._strAttr('src', '');
      var alt = escapeXml(this._strAttr('alt', ''));
      var href = this._strAttr('href', '');

      if (type === 'youtube') {
        var id = this._strAttr('video-id', '') || extractYouTubeId(src);
        if (!id) return '<slot></slot>';
        var thumb = 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg';
        return (
          '<div class="yt-facade" part="yt-facade" data-video-id="' + id + '">' +
          '<img src="' + thumb + '" alt="' + alt + '">' +
          '<div class="yt-play" part="yt-play">' + PLAY_ICON + '</div>' +
          '</div>'
        );
      }

      if (type === 'svg' || type === 'embed') {
        return this.hasAttribute('src')
          ? this._linkWrap(href, '<img src="' + escapeXml(src) + '" alt="' + alt + '">')
          : '<slot></slot>';
      }

      // "image" (default)
      return this._linkWrap(href, '<img src="' + escapeXml(src) + '" alt="' + alt + '" loading="lazy">');
    }

    // Wraps `inner` markup in an <a> when `href` is set; otherwise returns
    // `inner` untouched. target="_blank" + rel="noopener noreferrer" since
    // these are typically media links out of the current page.
    _linkWrap(href, inner) {
      if (!href) return inner;
      return '<a class="media-link" part="media-link" href="' + escapeXml(href) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>';
    }

    _index() {
      var parent = this.parentElement;
      if (!parent) return -1;
      var siblings = Array.prototype.filter.call(parent.children, function (c) {
        return c.tagName === 'LWTG-GRID-ITEM';
      });
      return siblings.indexOf(this);
    }

    _handleActivate() {
      var type = this._resolveType();

      if (type === 'youtube' && this._boolAttr('play-inline') && this._mediaEl && !this._mediaEl.querySelector('.yt-embed')) {
        this._playInline();
      }

      this.emit('click', {
        type: type,
        src: this._strAttr('src', ''),
        label: this._strAttr('label', ''),
        index: this._index()
      });
    }

    _handleKeydown(event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      // When the tile is a link, the native <a> handles the keyboard.
      if (this._root.querySelector('a.media-link')) return;
      event.preventDefault();
      this._handleActivate();
    }

    _playInline() {
      var id = this._strAttr('video-id', '') || extractYouTubeId(this._strAttr('src', ''));
      if (!id || !this._mediaEl) return;
      var self = this;

      this._mediaEl.innerHTML = '';
      var iframe = this._genhtml({
        type: 'iframe',
        attr: {
          class: 'yt-embed',
          part: 'yt-embed',
          src: 'https://www.youtube.com/embed/' + id + '?autoplay=1',
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
          allowfullscreen: '',
          frameborder: '0',
          title: this._a11yName([this._strAttr('label', ''), this._strAttr('alt', '')], 'YouTube video player', 'Add a label attribute')
        }
      });
      this._mediaEl.appendChild(iframe);
      // The player is now the interactive thing: drop the host's button
      // role so it doesn't wrap an iframe full of its own controls.
      this._playing = true;
      this._mediaEl.removeAttribute('aria-hidden');
      this._removeAutoAttr('role');
      this._removeAutoAttr('aria-label');
      if (this._autoTabIndex) { this.removeAttribute('tabindex'); this._autoTabIndex = false; }
      self.emit('play', { videoId: id });
    }
  }

  window.LWT.define('lwtg-grid-item', LWTGridItem);
})();

/* ---- lwt-gen-grid.js ---- */
/*!
 * <lwtg-grid>
 * A CSS grid container for <lwtg-grid-item> (or any) children.
 *
 *   <lwtg-grid columns="4" gap="12px" min-col-width="140px"> ... </lwtg-grid>
 *
 * Column modes (picked from the attributes):
 *   - no `columns`            responsive: as many columns as fit at
 *                             min-col-width (default 200px), wrapping on
 *                             small screens.
 *   - `columns` + `responsive` at most N columns, still collapsing once a
 *                             column would drop below min-col-width.
 *   - `columns` alone         exactly N columns of min-col-width each
 *                             (default 1fr). Needed for `resizable` columns.
 *
 * Attributes: columns, rows, gap, min-col-width, row-height, dense,
 * responsive (copied onto the host as --lwt-grid-* variables, so the same
 * variables can also be set from a stylesheet). In the responsive modes
 * rows default to their content height; set row-height (e.g. 160px) for
 * an even image wall.
 *
 * <lwtg-image-grid> is the same element under its old name (see
 * lwt-gen-image-grid.js) -- kept so existing pages keep working.
 *
 * ---------------------------------------------------------------------
 * Resizable panels
 * ---------------------------------------------------------------------
 * Add `resizable` and the grid's column and row sizes can be dragged
 * (columns only in the fixed mode -- responsive columns have no fixed
 * count to resize; row handles still work there),
 * like panels in a desktop app. Which edges get a drag handle is chosen
 * per item with resize-left / resize-right / resize-top / resize-bottom
 * on <lwtg-grid-item>; the handle appears when the item is hovered (or
 * focused with Tab). Dragging an item's edge moves that grid line for
 * the whole grid, so every item sharing the line follows.
 *
 *   <lwtg-grid resizable columns="3" rows="2" row-height="160px" resize-min="80px">
 *     <lwtg-grid-item row-span="2" resize-right min-width="200px">Sidebar</lwtg-grid-item>
 *     <lwtg-grid-item col-span="2" resize-bottom>Main</lwtg-grid-item>
 *     <lwtg-grid-item resize-left resize-right>A</lwtg-grid-item>
 *     <lwtg-grid-item>B</lwtg-grid-item>
 *   </lwtg-grid>
 *
 *   resize-min   — smallest size a dragged column/row can reach (default 48px)
 *
 * Minimum sizes per item: min-width / min-height on <lwtg-grid-item> keep
 * the tracks that item spans from shrinking below that size -- while
 * dragging AND when the window resizes (each column becomes
 * minmax(<min>, ...)). A spanning item's minimum is shared equally across
 * its tracks. Where several items share a track, the largest minimum
 * wins. If the minimums add up to more than the available width, the grid
 * scrolls sideways instead of squeezing the panels.
 *
 * - A column line trades width between the two columns either side of it
 *   (columns stay proportional, so the grid still stretches with its
 *   container). The grid's outer left/right edges can't be dragged.
 * - A row line trades height between the two rows either side. Dragging
 *   the bottom edge of the last row makes that row (and the grid) taller.
 * - Keyboard: Tab to a handle, arrow keys move it 10px (Shift: 50px).
 * - Double-click a handle to share the two tracks equally again.
 *
 * Properties / methods:
 *   .sizes          — { columns: ['240px' ...] | null, rows: [...] | null }:
 *                     the current track sizes in px (null = not resized).
 *                     Set it with the same shape (any CSS sizes) to restore
 *                     a saved layout.
 *   .resetSizes()   — back to the attribute-defined layout
 *
 * Events: lwt-resize — after each drag / key nudge;
 *   detail: { axis: 'columns' | 'rows', sizes: .sizes }
 *
 * Theming: --lwt-grid-resize-color (handle line color),
 * --lwt-grid-resize-size (handle grab width, default 10px) -- both read by
 * <lwtg-grid-item>.
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-grid.js requires lwt-core.js to be loaded first.');
  }

  var KEY_STEP = 10, KEY_STEP_BIG = 50;

  // Attributes (gap, columns, rows, ...) are copied onto the host as
  // --lwt-grid-* variables by _syncVars(), so the CSS itself stays static
  // and the same variables can also be set from a stylesheet. A resized
  // layout is written to --lwt-grid-template-columns / -rows.
  var CSS = `
    :host { display: block; font-family: inherit; width: 100%; }
    :host([hidden]) { display: none; }
    .grid {
      display: grid;
      width: 100%;
      gap: var(--lwt-grid-gap, var(--lwt-gap, 1rem));
    }
    /* Track rules all have zero specificity (:where), so the mode rules
       below win by order and a page's own CSS wins over all of them. */
    :where(.grid) {
      grid-template-rows: var(--lwt-grid-template-rows, repeat(var(--lwt-grid-rows, 1), var(--lwt-grid-row-height, 1fr)));
      grid-template-columns: var(--lwt-grid-template-columns, repeat(var(--lwt-grid-columns, 1), var(--lwt-grid-min-col-width, 1fr)));
    }
    /* Responsive modes (see the header). Wrapped in :where() so a page's own
       CSS on ::part(grid) wins without !important. */
    :where(:host([data-mode="responsive"]) .grid) {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--lwt-grid-min-col-width, 200px)), 1fr));
    }
    :where(:host([data-mode="capped"]) .grid) {
      grid-template-columns: repeat(auto-fit, minmax(max(var(--lwt-grid-min-col-width, 200px),
        calc((100% - (var(--lwt-grid-columns, 4) - 1) * var(--lwt-grid-gap, var(--lwt-gap, 1rem))) / var(--lwt-grid-columns, 4))), 1fr));
    }
    :where(:host([data-mode="responsive"]) .grid, :host([data-mode="capped"]) .grid) {
      grid-template-rows: var(--lwt-grid-template-rows, none);
      grid-auto-rows: var(--lwt-grid-row-height, auto);
    }
    :where(:host([data-mode="responsive"][rows]) .grid, :host([data-mode="capped"][rows]) .grid) {
      grid-template-rows: var(--lwt-grid-template-rows, repeat(var(--lwt-grid-rows, 1), var(--lwt-grid-row-height, 1fr)));
    }
    :where(:host([dense]) .grid) { grid-auto-flow: dense; }
    /* Item minimums can add up to more than the available width: scroll. */
    :host([data-has-mins]) { overflow-x: auto; }
    /* While dragging: no text selection, and iframes / videos inside items
       can't swallow the pointer. */
    :host([data-resizing]) { user-select: none; -webkit-user-select: none; }
    :host([data-resizing]) ::slotted(*) { pointer-events: none; }
  `;

  function px(list) { return list.map(function (n) { return Math.round(n * 100) / 100 + 'px'; }); }

  class LWTGrid extends window.LWT.Element {
    static get observedAttributes() {
      return ['columns', 'rows', 'gap', 'min-col-width', 'row-height', 'dense', 'resizable', 'resize-min', 'responsive'];
    }

    constructor() {
      super();
      this._colSizes = null; // px per column once resized
      this._rowSizes = null; // px per row once resized
      this._onSlotChange = this._syncItems.bind(this);
      this._mins = { columns: [], rows: [] }; // px minimum per track, from item min-width / min-height
      this._minsPending = false;
    }

    connectedCallback() {
      super.connectedCallback();
      // Re-check item minimums when the grid gets a size (e.g. a closed
      // <details> opening) or changes size.
      if (typeof ResizeObserver === 'function' && !this._ro) {
        var self = this;
        this._ro = new ResizeObserver(function () { self._scheduleMins(); });
      }
      if (this._ro) this._ro.observe(this);
      this._scheduleMins();
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._ro) this._ro.disconnect();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      // A different track count or base size invalidates a resized layout.
      if (name === 'columns' || name === 'min-col-width' || name === 'responsive') this._colSizes = null;
      if (name === 'rows' || name === 'row-height') this._rowSizes = null;
      if (name === 'resizable' && newValue === null) { this._colSizes = null; this._rowSizes = null; }
      super.attributeChangedCallback(name, oldValue, newValue);
    }

    // 'fixed' | 'responsive' | 'capped' -- see the header.
    _mode() {
      if (!this.hasAttribute('columns')) return 'responsive';
      return this._boolAttr('responsive') ? 'capped' : 'fixed';
    }

    render() {
      this._syncVars();
      this.setAttribute('data-mode', this._mode());
      this._renderShadow('<div class="grid" part="grid"><slot></slot></div>', CSS + (this.constructor.extraCSS || ''));
      this._gridEl = this._root.querySelector('.grid');
      this._root.querySelector('slot').addEventListener('slotchange', this._onSlotChange);
      this._applyTemplates();
      this._syncItems();
    }

    _syncVars() {
      var pairs = [
        ['columns',       '--lwt-grid-columns'],
        ['rows',          '--lwt-grid-rows'],
        ['gap',           '--lwt-grid-gap'],
        ['min-col-width', '--lwt-grid-min-col-width'],
        ['row-height',    '--lwt-grid-row-height']
      ];
      var self = this;
      pairs.forEach(function (p) {
        var attr = p[0], cssVar = p[1];
        if (self.hasAttribute(attr)) self.style.setProperty(cssVar, self._strAttr(attr, ''));
        else self.style.removeProperty(cssVar);
      });
    }

    // Tell child items whether to show their resize handles.
    _syncItems() {
      this._scheduleMins();
      var on = this._boolAttr('resizable');
      // Responsive columns can't be dragged: only row handles stay live.
      var axes = this._mode() === 'fixed' ? 'both' : 'rows';
      Array.prototype.forEach.call(this.children, function (child) {
        if (child.localName !== 'lwtg-grid-item') return;
        if (on) child.setAttribute('data-resizable', axes);
        else child.removeAttribute('data-resizable');
      });
    }

    // Columns stay proportional: each column's px size becomes its fr factor.
    // Tracks with an item minimum become minmax(<min>, <size>).
    _applyTemplates() {
      var mins = this._mins || { columns: [], rows: [] };
      if (this._mode() !== 'fixed') { this._colSizes = null; mins = { columns: [], rows: mins.rows }; }
      var hasColMins = mins.columns.some(function (m) { return m > 0; });
      var hasRowMins = mins.rows.some(function (m) { return m > 0; });
      var wrap = function (min, size) { return min > 0 ? 'minmax(' + Math.round(min * 100) / 100 + 'px, ' + size + ')' : size; };
      var cols = null, rows = null;

      if (this._colSizes) {
        cols = this._colSizes.map(function (n, i) { return wrap(mins.columns[i], (Math.round(n * 100) / 100) + 'fr'); });
      } else if (hasColMins) {
        var colBase = this._strAttr('min-col-width', '') || '1fr';
        cols = mins.columns.map(function (m) { return wrap(m, colBase); });
      }
      if (this._rowSizes) {
        rows = this._rowSizes.map(function (n, i) { return (Math.round(Math.max(n, mins.rows[i] || 0) * 100) / 100) + 'px'; });
      } else if (hasRowMins) {
        var rowBase = this._strAttr('row-height', '') || '1fr';
        rows = mins.rows.map(function (m) { return wrap(m, rowBase); });
      }

      this._setVar('--lwt-grid-template-columns', cols && cols.join(' '));
      this._setVar('--lwt-grid-template-rows', rows && rows.join(' '));
      if (hasColMins || hasRowMins) this.setAttribute('data-has-mins', ''); else this.removeAttribute('data-has-mins');
    }

    _setVar(name, value) {
      if (!value) { if (this.style.getPropertyValue(name)) this.style.removeProperty(name); return; }
      if (this.style.getPropertyValue(name) !== value) this.style.setProperty(name, value);
    }

    // ---- item minimums ----
    _scheduleMins() {
      if (this._minsPending) return;
      this._minsPending = true;
      var self = this;
      requestAnimationFrame(function () { self._minsPending = false; self._updateMins(); });
    }

    // "200px", "12rem", "20em", "25%" (of the grid), "20vw" / "20vh" -> px
    _toPx(value, axis) {
      var m = /^\s*(-?[\d.]+)\s*(px|rem|em|%|vw|vh)?\s*$/i.exec(String(value || ''));
      if (!m) return 0;
      var n = parseFloat(m[1]), unit = (m[2] || 'px').toLowerCase();
      if (unit === 'rem') return n * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
      if (unit === 'em') return n * (parseFloat(getComputedStyle(this).fontSize) || 16);
      if (unit === 'vw') return n * window.innerWidth / 100;
      if (unit === 'vh') return n * window.innerHeight / 100;
      if (unit === '%') {
        var r = this.getBoundingClientRect();
        return n * (axis === 'columns' ? r.width : r.height) / 100;
      }
      return n;
    }

    // Work out each track's minimum from the items' min-width / min-height.
    _updateMins() {
      if (!this._gridEl || !this.isConnected) return;
      var rect = this._gridEl.getBoundingClientRect();
      if (!rect.width && !rect.height) return; // not rendered yet (e.g. inside a closed <details>)
      var self = this;
      var mins = { columns: [], rows: [] };
      ['columns', 'rows'].forEach(function (axis) {
        var m = self._measure(axis);
        mins[axis] = m.sizes.map(function () { return 0; });
      });
      Array.prototype.forEach.call(this.children, function (item) {
        [['min-width', 'columns'], ['min-height', 'rows']].forEach(function (pair) {
          if (!item.hasAttribute(pair[0])) return;
          var min = self._toPx(item.getAttribute(pair[0]), pair[1]);
          if (!(min > 0)) return;
          var lines = self._itemLines(item, pair[1]);
          var span = Math.max(1, lines.last - lines.first + 1);
          var share = Math.max(0, (min - lines.measure.gap * (span - 1)) / span);
          for (var i = lines.first; i <= lines.last; i++) mins[pair[1]][i] = Math.max(mins[pair[1]][i] || 0, share);
        });
      });
      this._mins = mins;
      this._applyTemplates();
    }

    // ---- measuring ----
    _measure(axis) {
      var cs = getComputedStyle(this._gridEl);
      var list = (axis === 'columns' ? cs.gridTemplateColumns : cs.gridTemplateRows)
        .split(/\s+/).map(parseFloat).filter(function (n) { return !isNaN(n); });
      var gap = parseFloat(axis === 'columns' ? cs.columnGap : cs.rowGap) || 0;
      return { sizes: list, gap: gap };
    }

    _minSize() {
      var v = parseFloat(this._strAttr('resize-min', '48'));
      return v > 0 ? v : 48;
    }

    // Which track lines an item's edges sit on, from its position.
    _itemLines(item, axis) {
      var m = this._measure(axis);
      var gridRect = this._gridEl.getBoundingClientRect();
      var rect = item.getBoundingClientRect();
      var start = axis === 'columns' ? rect.left - gridRect.left : rect.top - gridRect.top;
      var end = axis === 'columns' ? rect.right - gridRect.left : rect.bottom - gridRect.top;
      var starts = [], ends = [], pos = 0;
      m.sizes.forEach(function (s) { starts.push(pos); ends.push(pos + s); pos += s + m.gap; });
      function nearest(list, v) {
        var best = 0;
        for (var i = 1; i < list.length; i++) if (Math.abs(list[i] - v) < Math.abs(list[best] - v)) best = i;
        return best;
      }
      return { first: nearest(starts, start), last: nearest(ends, end), measure: m };
    }

    // The pair of tracks an edge controls: { axis, a, b (null = outer edge), measure }
    _target(item, edge) {
      if (!this._boolAttr('resizable') || !this._gridEl) return null;
      var axis = edge === 'left' || edge === 'right' ? 'columns' : 'rows';
      if (axis === 'columns' && this._mode() !== 'fixed') return null;
      var lines = this._itemLines(item, axis);
      var n = lines.measure.sizes.length;
      var a, b;
      if (edge === 'left' || edge === 'top') { a = lines.first - 1; b = lines.first; }
      else { a = lines.last; b = lines.last + 1 < n ? lines.last + 1 : null; }
      if (a < 0) return null;                          // outer left / top edge
      if (b === null && axis === 'columns') return null; // outer right edge
      return { axis: axis, a: a, b: b, measure: lines.measure };
    }

    // Sizes after moving the line by `delta` px from `start` sizes.
    _resized(t, start, delta) {
      var sizes = start.slice();
      var floor = this._minSize();
      var trackMins = (this._mins && this._mins[t.axis]) || [];
      // An item minimum replaces the resize-min fallback for that track.
      var minA = trackMins[t.a] > 0 ? trackMins[t.a] : floor;
      if (t.b === null) {
        sizes[t.a] = Math.max(minA, start[t.a] + delta);
      } else {
        var minB = trackMins[t.b] > 0 ? trackMins[t.b] : floor;
        var total = start[t.a] + start[t.b];
        if (minA + minB > total) { // can't satisfy both: split what's there proportionally
          var ratio = minA / (minA + minB);
          minA = total * ratio; minB = total - minA;
        }
        var newA = Math.max(minA, Math.min(total - minB, start[t.a] + delta));
        sizes[t.a] = newA;
        sizes[t.b] = total - newA;
      }
      return sizes;
    }

    _commit(axis, sizes) {
      if (axis === 'columns') this._colSizes = sizes; else this._rowSizes = sizes;
      this._applyTemplates();
    }

    // Value for the handle's aria-valuenow: the first track's share of the pair (%).
    _handleState(item, edge) {
      var t = this._target(item, edge);
      if (!t) return null;
      var s = t.measure.sizes;
      var label = (t.axis === 'columns' ? 'Column ' : 'Row ') + (t.a + 1) + ' ' + (t.axis === 'columns' ? 'width' : 'height');
      if (t.b === null) {
        var full = s.reduce(function (x, y) { return x + y; }, 0) || 1;
        return { now: Math.round(s[t.a] / full * 100), text: label + ' ' + Math.round(s[t.a]) + ' pixels' };
      }
      return { now: Math.round(s[t.a] / (s[t.a] + s[t.b]) * 100), text: label + ' ' + Math.round(s[t.a]) + ' pixels' };
    }

    _emitResize(axis) {
      this.emit('resize', { axis: axis, sizes: this.sizes });
    }

    // ---- called by <lwtg-grid-item> handles ----
    _beginResize(item, edge, event) {
      var t = this._target(item, edge);
      if (!t) return false;
      var self = this;
      var start = t.measure.sizes.slice();
      var origin = t.axis === 'columns' ? event.clientX : event.clientY;
      var root = document.documentElement;
      var prevCursor = null;
      var dragging = false;

      // Resizing starts once the pointer has moved a few px, so a plain
      // click or double-click on a handle still reaches it.
      function startDrag() {
        dragging = true;
        prevCursor = root.style.cursor;
        root.style.cursor = t.axis === 'columns' ? 'col-resize' : 'row-resize';
        self.setAttribute('data-resizing', '');
      }
      function move(e) {
        var pos = t.axis === 'columns' ? e.clientX : e.clientY;
        if (!dragging) {
          if (Math.abs(pos - origin) < 3) return;
          startDrag();
        }
        self._commit(t.axis, self._resized(t, start, pos - origin));
        e.preventDefault();
      }
      function up() {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        if (!dragging) return;
        root.style.cursor = prevCursor;
        self.removeAttribute('data-resizing');
        self._emitResize(t.axis);
        if (typeof item._refreshHandles === 'function') item._refreshHandles();
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      return true;
    }

    _nudge(item, edge, delta) {
      var t = this._target(item, edge);
      if (!t) return false;
      this._commit(t.axis, this._resized(t, t.measure.sizes, delta));
      this._emitResize(t.axis);
      return true;
    }

    _equalize(item, edge) {
      var t = this._target(item, edge);
      if (!t) return false;
      if (t.b === null) {
        // Outer bottom edge: drop the row sizing back to the attribute layout.
        this._commit(t.axis, null);
      } else {
        var s = t.measure.sizes;
        var half = (s[t.a] + s[t.b]) / 2;
        // Through the same clamp as a drag, so minimums still hold.
        this._commit(t.axis, this._resized(t, s, half - s[t.a]));
      }
      this._emitResize(t.axis);
      return true;
    }

    // ---- public API ----
    get sizes() {
      if (!this._gridEl) return { columns: null, rows: null };
      return {
        columns: this._colSizes ? px(this._measure('columns').sizes) : null,
        rows: this._rowSizes ? px(this._rowSizes) : null
      };
    }

    set sizes(v) {
      v = v || {};
      var self = this;
      var toPx = function (list, axis) {
        if (!list) return null;
        // Apply the CSS sizes, then read them back as px.
        self.style.setProperty('--lwt-grid-template-' + axis, [].concat(list).join(' '));
        var m = self._measure(axis).sizes;
        return m.length ? m : null;
      };
      this._colSizes = toPx(v.columns, 'columns');
      this._rowSizes = toPx(v.rows, 'rows');
      this._applyTemplates();
    }

    resetSizes() {
      this._colSizes = null;
      this._rowSizes = null;
      this._applyTemplates();
    }
  }

  window.LWT.Grid = LWTGrid; // base class for the <lwtg-image-grid> alias
  window.LWT.define('lwtg-grid', LWTGrid);
})();

/* ---- lwt-gen-icon.js ---- */
/* ICON */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-icon requires lwt-core.js to be loaded first.');
  }

  let CSS = `
    .lwti { display: inline-block; font-family: inherit; }
  `;
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

/* ---- lwt-gen-image-grid.js ---- */
/*!
 * <lwtg-image-grid>  (deprecated alias of <lwtg-grid>)
 * Kept so existing pages keep working. It is <lwtg-grid> with the old
 * image-grid defaults; new pages should use <lwtg-grid> directly:
 *
 *   <lwtg-image-grid>                 -> <lwtg-grid row-height="160px">
 *   <lwtg-image-grid columns="4">     -> <lwtg-grid columns="4" responsive row-height="160px">
 *   <lwtg-image-grid columns="4" rows="2">
 *                                     -> <lwtg-grid columns="4" rows="2" row-height="160px">
 *
 * Old behaviour kept: rows default to 160px, columns collapse at 200px,
 * `columns` alone caps the count (still responsive), `columns` + `rows`
 * gives exactly that many equal columns, and the --lwt-image-grid-gap /
 * -row-height / -min-width / -columns / -rows variables still work.
 *
 * Requires lwt-core.js and lwt-gen-grid.js (both in lwt-general.js).
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Grid) {
    throw new Error('lwt-gen-image-grid.js requires lwt-core.js and lwt-gen-grid.js to be loaded first.');
  }

  class LWTImageGrid extends window.LWT.Grid {
    // Old mode rules: no columns -> responsive; columns -> capped
    // (still responsive); columns + rows -> exactly N equal columns.
    _mode() {
      if (!this.hasAttribute('columns')) return 'responsive';
      return this.hasAttribute('rows') ? 'fixed' : 'capped';
    }
  }

  // The old --lwt-image-grid-* variables and defaults, mapped onto the
  // grid's. Attributes (copied inline by the grid) still win.
  LWTImageGrid.extraCSS = `
    :host {
      --lwt-grid-gap: var(--lwt-image-grid-gap, var(--lwt-gap, 1rem));
      --lwt-grid-row-height: var(--lwt-image-grid-row-height, 160px);
      --lwt-grid-min-col-width: var(--lwt-image-grid-min-width, 200px);
      --lwt-grid-columns: var(--lwt-image-grid-columns, 4);
      --lwt-grid-rows: var(--lwt-image-grid-rows, 1);
    }
    /* columns + rows: equal columns (min-col-width is the collapse point here, not the track size). */
    :where(:host([data-mode="fixed"]) .grid) {
      grid-template-columns: var(--lwt-grid-template-columns, repeat(var(--lwt-grid-columns, 4), 1fr));
    }
  `;

  window.LWT.define('lwtg-image-grid', LWTImageGrid);
})();

/* ---- lwt-gen-modal.js ---- */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-modal.js requires lwt-core.js to be loaded first.');
  }

  var CSS = `
    dialog {
      border: var(--lwt-modal-border, none);
      border-radius: var(--lwt-modal-radius, var(--lwt-border-radius, 10px));
      padding: var(--lwt-modal-padding, var(--lwt-padding, 1.5rem));
      max-width: var(--lwt-modal-max-width, min(90vw, 32rem));
      max-height: 85vh;
      overflow: auto;
      box-shadow: var(--lwt-modal-shadow, 0 20px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1));
      background: var(--lwt-modal-bg, var(--lwt-color-surface, #fff));
      color: var(--lwt-modal-color, var(--lwt-color-text, inherit));
      font-family: inherit;
    }
    dialog::backdrop { background: var(--lwt-modal-backdrop, var(--lwt-color-overlay, rgba(15, 23, 42, 0.55))); }
    ::slotted(*:first-child) { margin-top: 0; }
    ::slotted(*:last-child) { margin-bottom: 0; }
  `;

  class LWTModal extends window.LWT.Element {
    static get observedAttributes() {
      return ['label', 'aria-label', 'aria-labelledby'];
    }

    constructor() {
      super();
      this._handleDismissClick = this._handleDismissClick.bind(this);
      this._handleCancel = this._handleCancel.bind(this);
      this._handleClose = this._handleClose.bind(this);
      this._handleBackdropClick = this._handleBackdropClick.bind(this);
      this._closeReason = null;
    }

    connectedCallback() {
      super.connectedCallback(); // builds shadow DOM + calls render()
      this.addEventListener('click', this._handleDismissClick);
      if (this.hasAttribute('open')) {
        this.show();
      }
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.removeEventListener('click', this._handleDismissClick);
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (this._dialog) {
        this._applyLabel();
      }
    }

    render() {
      this._renderShadow('<dialog part="dialog"><slot></slot></dialog>', CSS);
      this._dialog = this._root.querySelector('dialog');
      this._dialog.addEventListener('cancel', this._handleCancel);
      this._dialog.addEventListener('close', this._handleClose);
      this._dialog.addEventListener('click', this._handleBackdropClick);
      this._whenParsed(this._applyLabel);
    }

    // A dialog must have a name (WCAG 4.1.2): label attribute, the host's
    // aria-label/labelledby, or the first heading inside it.
    _applyLabel() {
      var heading = this.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]');
      var name = this._a11yName([this._strAttr('label', ''), heading ? heading.textContent : ''],
        'Dialog', 'Add a label attribute or a heading inside the modal');
      this._dialog.setAttribute('aria-label', name);
    }

    // Public API -----------------------------------------------------

    show() {
      if (!this._dialog || this._dialog.open) return;
      // Remember where focus was so it can go back there on close.
      var active = document.activeElement;
      while (active && active.shadowRoot && active.shadowRoot.activeElement) active = active.shadowRoot.activeElement;
      this._returnFocus = active && active !== document.body ? active : null;
      this._applyLabel(); // content may have changed since connect
      this._dialog.showModal();
      this.setAttribute('open', '');
      this.emit('open', {});
    }

    close(reason) {
      if (!this._dialog || !this._dialog.open) return;
      this._closeReason = reason || 'api';
      this._dialog.close();
    }

    toggle(force) {
      var willOpen = typeof force === 'boolean' ? force : !(this._dialog && this._dialog.open);
      if (willOpen) this.show();
      else this.close('api');
      return willOpen;
    }

    get isOpen() {
      return !!(this._dialog && this._dialog.open);
    }

    // Internal handlers ------------------------------------------------

    _handleDismissClick(event) {
      var trigger = event.target && event.target.closest
        ? event.target.closest('[data-lwt-dismiss]')
        : null;
      if (trigger) this.close('dismiss-button');
    }

    _handleCancel(event) {
      // Fires when the user presses Escape, before the dialog closes.
      if (this._boolAttr('no-dismiss')) {
        event.preventDefault();
        return;
      }
      this._closeReason = 'escape';
    }

    _handleBackdropClick(event) {
      // Only a click OUTSIDE the dialog's box is a backdrop click. (Clicks
      // on the dialog's own padding also target the <dialog> element, so
      // checking the target alone would close it by accident.)
      if (event.target !== this._dialog) return;
      var rect = this._dialog.getBoundingClientRect();
      var inside = event.clientX >= rect.left && event.clientX <= rect.right &&
                   event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (inside || (event.clientX === 0 && event.clientY === 0 && event.detail === 0)) return;
      if (this._boolAttr('no-dismiss')) return;
      this.close('backdrop');
    }

    _handleClose() {
      // Fires after the dialog actually closes, however it happened.
      this.removeAttribute('open');
      var reason = this._closeReason || 'api';
      this._closeReason = null;
      var target = this._returnFocus;
      this._returnFocus = null;
      if (target && target.isConnected && typeof target.focus === 'function') target.focus();
      this.emit('close', { reason: reason });
    }
  }

  window.LWT.define('lwtg-modal', LWTModal);
})();

/* ---- lwt-gen-nav-item.js ---- */
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

/* ---- lwt-gen-nav-menu.js ---- */
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

/* ---- lwt-gen-pricing-table.js ---- */

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

/* ---- lwt-gen-pricing-tier.js ---- */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-pricing-tier.js requires lwt-core.js to be loaded first.');
  }

  var CSS = `
    :host {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      border: var(--lwt-pricing-border, var(--lwt-border, 1px solid #e5e7eb));
      border-radius: var(--lwt-pricing-radius, var(--lwt-border-radius, 12px));
      background: var(--lwt-pricing-bg, var(--lwt-color-surface, #fff));
      overflow: hidden;
      font-family: inherit;
    }
    :host([featured]) {
      border-color: var(--lwt-pricing-featured-border, var(--lwt-color-text-strong, #111827));
      box-shadow: var(--lwt-pricing-featured-shadow, 0 10px 25px -5px rgba(0,0,0,0.15));
    }
    .badge {
      display: none;
      background: var(--lwt-pricing-featured-bg, var(--lwt-color-text-strong, #111827));
      color: var(--lwt-pricing-featured-color, var(--lwt-color-surface, #fff));
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      text-align: center;
      padding: 0.4rem 0;
    }
    :host([featured]) .badge { display: block; }
    .header { padding: var(--lwt-pricing-padding, var(--lwt-padding, 1.5rem)); }
    .header ::slotted(h1), .header ::slotted(h2), .header ::slotted(h3) { margin: 0 0 0.4rem; font-size: 1.15rem; }
    .header ::slotted(p) {
      margin: 0 0 1.25rem;
      font-size: 0.88rem;
      color: var(--lwt-pricing-muted, var(--lwt-color-text-muted, #6b7280));
    }
    .price {
      margin: 0 0 1.25rem;
      font-size: 2rem;
      font-weight: 700;
      color: var(--lwt-pricing-price-color, var(--lwt-color-text-strong, #111827));
    }
    .period {
      display: block;
      font-size: 0.82rem;
      font-weight: 400;
      color: var(--lwt-pricing-muted, var(--lwt-color-text-muted, #6b7280));
      margin-top: 0.15rem;
    }
    .divider { border-top: var(--lwt-pricing-border, var(--lwt-border, 1px solid #e5e7eb)); }
    .features {
      list-style: none;
      margin: 0;
      padding: var(--lwt-pricing-features-padding, 1.25rem 1.5rem);
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--lwt-pricing-features-gap, var(--lwt-gap, 0.6rem));
    }
    ::slotted([slot="features"]) {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      font-size: 0.92rem;
      line-height: 1.4;
    }
    ::slotted([slot="features"])::before {
      content: "\\203A";
      color: var(--lwt-pricing-accent, var(--lwt-color-text-muted, #6b7280));
      font-weight: 700;
      flex-shrink: 0;
    }
  `;

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

/* ---- lwt-gen-qr.js ---- */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-qr.js requires lwt-core.js to be loaded first.');
  }

  // ---- Spec tables (ISO/IEC 18004) ----
  //
  // These are the standard's own published capacity/block/format/alignment
  // tables -- factual, spec-mandated numbers (every QR implementation
  // reproduces the same values), not anyone's original expression.

  // QR_BLOCK_TABLE[version-1][levelIndex 0=L,1=M,2=Q,3=H]
  //   = [eccCodewordsPerBlock, group1BlockCount, group1BlockSize, group2BlockCount, group2BlockSize]
  var QR_BLOCK_TABLE = [[[7,1,19,0,0],[10,1,16,0,0],[13,1,13,0,0],[17,1,9,0,0]],[[10,1,34,0,0],[16,1,28,0,0],[22,1,22,0,0],[28,1,16,0,0]],[[15,1,55,0,0],[26,1,44,0,0],[18,2,17,0,0],[22,2,13,0,0]],[[20,1,80,0,0],[18,2,32,0,0],[26,2,24,0,0],[16,4,9,0,0]],[[26,1,108,0,0],[24,2,43,0,0],[18,2,15,2,16],[22,2,11,2,12]],[[18,2,68,0,0],[16,4,27,0,0],[24,4,19,0,0],[28,4,15,0,0]],[[20,2,78,0,0],[18,4,31,0,0],[18,2,14,4,15],[26,4,13,1,14]],[[24,2,97,0,0],[22,2,38,2,39],[22,4,18,2,19],[26,4,14,2,15]],[[30,2,116,0,0],[22,3,36,2,37],[20,4,16,4,17],[24,4,12,4,13]],[[18,2,68,2,69],[26,4,43,1,44],[24,6,19,2,20],[28,6,15,2,16]],[[20,4,81,0,0],[30,1,50,4,51],[28,4,22,4,23],[24,3,12,8,13]],[[24,2,92,2,93],[22,6,36,2,37],[26,4,20,6,21],[28,7,14,4,15]],[[26,4,107,0,0],[22,8,37,1,38],[24,8,20,4,21],[22,12,11,4,12]],[[30,3,115,1,116],[24,4,40,5,41],[20,11,16,5,17],[24,11,12,5,13]],[[22,5,87,1,88],[24,5,41,5,42],[30,5,24,7,25],[24,11,12,7,13]],[[24,5,98,1,99],[28,7,45,3,46],[24,15,19,2,20],[30,3,15,13,16]],[[28,1,107,5,108],[28,10,46,1,47],[28,1,22,15,23],[28,2,14,17,15]],[[30,5,120,1,121],[26,9,43,4,44],[28,17,22,1,23],[28,2,14,19,15]],[[28,3,113,4,114],[26,3,44,11,45],[26,17,21,4,22],[26,9,13,16,14]],[[28,3,107,5,108],[26,3,41,13,42],[30,15,24,5,25],[28,15,15,10,16]],[[28,4,116,4,117],[26,17,42,0,0],[28,17,22,6,23],[30,19,16,6,17]],[[28,2,111,7,112],[28,17,46,0,0],[30,7,24,16,25],[24,34,13,0,0]],[[30,4,121,5,122],[28,4,47,14,48],[30,11,24,14,25],[30,16,15,14,16]],[[30,6,117,4,118],[28,6,45,14,46],[30,11,24,16,25],[30,30,16,2,17]],[[26,8,106,4,107],[28,8,47,13,48],[30,7,24,22,25],[30,22,15,13,16]],[[28,10,114,2,115],[28,19,46,4,47],[28,28,22,6,23],[30,33,16,4,17]],[[30,8,122,4,123],[28,22,45,3,46],[30,8,23,26,24],[30,12,15,28,16]],[[30,3,117,10,118],[28,3,45,23,46],[30,4,24,31,25],[30,11,15,31,16]],[[30,7,116,7,117],[28,21,45,7,46],[30,1,23,37,24],[30,19,15,26,16]],[[30,5,115,10,116],[28,19,47,10,48],[30,15,24,25,25],[30,23,15,25,16]],[[30,13,115,3,116],[28,2,46,29,47],[30,42,24,1,25],[30,23,15,28,16]],[[30,17,115,0,0],[28,10,46,23,47],[30,10,24,35,25],[30,19,15,35,16]],[[30,17,115,1,116],[28,14,46,21,47],[30,29,24,19,25],[30,11,15,46,16]],[[30,13,115,6,116],[28,14,46,23,47],[30,44,24,7,25],[30,59,16,1,17]],[[30,12,121,7,122],[28,12,47,26,48],[30,39,24,14,25],[30,22,15,41,16]],[[30,6,121,14,122],[28,6,47,34,48],[30,46,24,10,25],[30,2,15,64,16]],[[30,17,122,4,123],[28,29,46,14,47],[30,49,24,10,25],[30,24,15,46,16]],[[30,4,122,18,123],[28,13,46,32,47],[30,48,24,14,25],[30,42,15,32,16]],[[30,20,117,4,118],[28,40,47,7,48],[30,43,24,22,25],[30,10,15,67,16]],[[30,19,118,6,119],[28,18,47,31,48],[30,34,24,34,25],[30,20,15,61,16]]];

  // ALIGN_POSITIONS[version-1] = alignment-pattern center coordinates (both row & col)
  var ALIGN_POSITIONS = [[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]];

  // FORMAT_INFO[levelIndex][maskPattern] = literal 15-bit format string
  var FORMAT_INFO = [[30660,29427,32170,30877,26159,25368,27713,26998],[21522,20773,24188,23371,17913,16590,20375,19104],[13663,12392,16177,14854,9396,8579,11994,11245],[5769,5054,7399,6608,1890,597,3340,2107]];

  // VERSION_INFO[version-7] = literal 18-bit version string (versions 7-40)
  var VERSION_INFO = [31892,34236,39577,42195,48118,51042,55367,58893,63784,68472,70749,76311,79154,84390,87683,92361,96236,102084,102881,110507,110734,117786,119615,126325,127568,133589,136944,141498,145311,150283,152622,158308,161089,167017];

  var LEVELS = ['L', 'M', 'Q', 'H'];

  // ---- GF(256) tables for Reed-Solomon, primitive polynomial x^8+x^4+x^3+x^2+1 (0x11D) ----
  var GF_EXP = new Array(512);
  var GF_LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;
    }
    for (i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  // Reed-Solomon generator polynomial of given degree (highest degree
  // first, monic). Built by multiplying (x + 2^i) in for i = 0..degree-1.
  function rsGeneratorPoly(degree) {
    var coefs = [1];
    for (var i = 0; i < degree; i++) {
      var r = GF_EXP[i];
      var n = coefs.length - 1;
      var next = new Array(n + 2).fill(0);
      next[0] = coefs[0];
      for (var j = 1; j <= n; j++) next[j] = coefs[j] ^ gfMul(coefs[j - 1], r);
      next[n + 1] = gfMul(coefs[n], r);
      coefs = next;
    }
    return coefs;
  }

  function rsEncode(dataBytes, eccLen) {
    var gen = rsGeneratorPoly(eccLen);
    var res = new Array(eccLen).fill(0);
    for (var i = 0; i < dataBytes.length; i++) {
      var factor = dataBytes[i] ^ res[0];
      res.shift();
      res.push(0);
      for (var j = 0; j < eccLen; j++) res[j] ^= gfMul(gen[j + 1], factor);
    }
    return res;
  }

  function utf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(str));
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.codePointAt(i);
      if (code > 0xFFFF) i++;
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
      } else if (code < 0x10000) {
        bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
      } else {
        bytes.push(0xF0 | (code >> 18), 0x80 | ((code >> 12) & 0x3F), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
      }
    }
    return bytes;
  }

  function blockInfo(version, levelIdx) {
    var row = QR_BLOCK_TABLE[version - 1][levelIdx];
    return { ecc: row[0], g1cnt: row[1], g1size: row[2], g2cnt: row[3], g2size: row[4] };
  }

  function totalDataCodewords(version, levelIdx) {
    var b = blockInfo(version, levelIdx);
    return b.g1cnt * b.g1size + b.g2cnt * b.g2size;
  }

  function getNumRawDataModules(version) {
    var result = (16 * version + 128) * version + 64;
    if (version >= 2) {
      var numAlign = Math.floor(version / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (version >= 7) result -= 36;
    }
    return result;
  }

  function chooseVersion(byteLen, levelIdx) {
    for (var v = 1; v <= 40; v++) {
      var countBits = v < 10 ? 8 : 16;
      var headerBits = 4 + countBits;
      var capacityBits = totalDataCodewords(v, levelIdx) * 8;
      if (headerBits + byteLen * 8 <= capacityBits) return v;
    }
    return -1;
  }

  function appendBits(bitArr, val, len) {
    for (var i = len - 1; i >= 0; i--) bitArr.push((val >>> i) & 1);
  }

  function buildDataCodewords(bytes, version, levelIdx) {
    var bits = [];
    appendBits(bits, 4, 4); // byte-mode indicator
    var countBits = version < 10 ? 8 : 16;
    appendBits(bits, bytes.length, countBits);
    for (var i = 0; i < bytes.length; i++) appendBits(bits, bytes[i], 8);

    var capacityBits = totalDataCodewords(version, levelIdx) * 8;
    var termLen = Math.min(4, capacityBits - bits.length);
    for (i = 0; i < termLen; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    var padBytes = [0xEC, 0x11];
    var p = 0;
    while (bits.length < capacityBits) {
      appendBits(bits, padBytes[p % 2], 8);
      p++;
    }

    var codewords = [];
    for (i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      codewords.push(b);
    }
    return codewords;
  }

  function buildFinalBits(dataCodewords, version, levelIdx) {
    var info = blockInfo(version, levelIdx);
    var blocks = [], eccBlocks = [], pos = 0;
    [[info.g1cnt, info.g1size], [info.g2cnt, info.g2size]].forEach(function (g) {
      var count = g[0], size = g[1];
      for (var i = 0; i < count; i++) {
        var block = dataCodewords.slice(pos, pos + size);
        pos += size;
        blocks.push(block);
        eccBlocks.push(rsEncode(block, info.ecc));
      }
    });

    var maxDataLen = Math.max.apply(null, blocks.map(function (b) { return b.length; }));
    var result = [];
    for (var i = 0; i < maxDataLen; i++) {
      blocks.forEach(function (b) { if (i < b.length) result.push(b[i]); });
    }
    for (i = 0; i < info.ecc; i++) {
      eccBlocks.forEach(function (b) { result.push(b[i]); });
    }

    var bits = [];
    result.forEach(function (byte) { appendBits(bits, byte, 8); });
    var remainder = getNumRawDataModules(version) - bits.length;
    for (i = 0; i < remainder; i++) bits.push(0);
    return bits;
  }

  function newMatrix(size, fill) {
    var m = [];
    for (var r = 0; r < size; r++) m.push(new Array(size).fill(fill));
    return m;
  }

  function maskFn(m, r, c) {
    switch (m) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return (r * c) % 2 + (r * c) % 3 === 0;
      case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
      default: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
    }
  }

  function penalty(m, size) {
    var total = 0, r, c;
    for (r = 0; r < size; r++) {
      var run = 1;
      for (c = 1; c < size; c++) {
        if (m[r][c] === m[r][c - 1]) run++;
        else { if (run >= 5) total += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) total += 3 + (run - 5);
    }
    for (c = 0; c < size; c++) {
      var run2 = 1;
      for (r = 1; r < size; r++) {
        if (m[r][c] === m[r - 1][c]) run2++;
        else { if (run2 >= 5) total += 3 + (run2 - 5); run2 = 1; }
      }
      if (run2 >= 5) total += 3 + (run2 - 5);
    }
    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        var v = m[r][c];
        if (m[r][c + 1] === v && m[r + 1][c] === v && m[r + 1][c + 1] === v) total += 3;
      }
    }
    var patt1 = [true, false, true, true, true, false, true, false, false, false, false];
    var patt2 = [false, false, false, false, true, false, true, true, true, false, true];
    function matchAt(arr, idx, patt) {
      for (var k = 0; k < patt.length; k++) if (arr[idx + k] !== patt[k]) return false;
      return true;
    }
    for (r = 0; r < size; r++) {
      for (c = 0; c <= size - 11; c++) {
        var rowArr = m[r];
        if (matchAt(rowArr, c, patt1) || matchAt(rowArr, c, patt2)) total += 40;
      }
    }
    for (c = 0; c < size; c++) {
      var colArr = [];
      for (r = 0; r < size; r++) colArr.push(m[r][c]);
      for (r = 0; r <= size - 11; r++) {
        if (matchAt(colArr, r, patt1) || matchAt(colArr, r, patt2)) total += 40;
      }
    }
    var darkCount = 0;
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (m[r][c]) darkCount++;
    var percent = (darkCount * 100) / (size * size);
    var prevMultiple = Math.abs(Math.floor(percent / 5) * 5 - 50) / 5;
    var nextMultiple = Math.abs(Math.ceil(percent / 5) * 5 - 50) / 5;
    total += Math.min(prevMultiple, nextMultiple) * 10;
    return total;
  }

  function buildMatrix(version, levelIdx, finalBits) {
    var size = 17 + 4 * version;
    var dark = newMatrix(size, false);
    var isFn = newMatrix(size, false);
    var isFinder = newMatrix(size, false);

    function setFn(r, c, val, finder) {
      if (r < 0 || r >= size || c < 0 || c >= size) return;
      dark[r][c] = val;
      isFn[r][c] = true;
      if (finder) isFinder[r][c] = val;
    }

    function drawFinder(r0, c0) {
      for (var dr = -1; dr <= 7; dr++) {
        for (var dc = -1; dc <= 7; dc++) {
          var r = r0 + dr, c = c0 + dc;
          if (r < 0 || r >= size || c < 0 || c >= size) continue;
          var isBorder = dr === -1 || dr === 7 || dc === -1 || dc === 7;
          var isRing = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6);
          var isCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          setFn(r, c, !isBorder && (isRing || isCenter), true);
        }
      }
    }
    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    for (var i = 8; i < size - 8; i++) {
      setFn(6, i, i % 2 === 0);
      setFn(i, 6, i % 2 === 0);
    }

    var positions = ALIGN_POSITIONS[version - 1];
    positions.forEach(function (r) {
      positions.forEach(function (c) {
        if ((r < 9 && c < 9) || (r < 9 && c > size - 9) || (r > size - 9 && c < 9)) return;
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            var isRing = Math.max(Math.abs(dr), Math.abs(dc)) === 2;
            var isCenter = dr === 0 && dc === 0;
            setFn(r + dr, c + dc, isRing || isCenter);
          }
        }
      });
    });

    for (i = 0; i < 9; i++) {
      if (i !== 6) { setFn(8, i, false); setFn(i, 8, false); }
    }
    for (i = 0; i < 8; i++) {
      setFn(8, size - 1 - i, false);
      setFn(size - 1 - i, 8, false);
    }
    setFn(size - 8, 8, true);

    if (version >= 7) {
      for (var a = 0; a < 6; a++) {
        for (var b = 0; b < 3; b++) {
          setFn(a, size - 11 + b, false);
          setFn(size - 11 + b, a, false);
        }
      }
    }

    // ---- data placement: zigzag, two columns at a time from the
    // bottom-right, alternating scan direction, skipping the timing
    // column and any function module. ----
    var bitIndex = 0, upward = true;
    for (var col = size - 1; col >= 1; col -= 2) {
      if (col === 6) col--;
      for (var rowStep = 0; rowStep < size; rowStep++) {
        var row = upward ? size - 1 - rowStep : rowStep;
        for (var cOff = 0; cOff < 2; cOff++) {
          var c2 = col - cOff;
          if (isFn[row][c2]) continue;
          var bit = bitIndex < finalBits.length ? finalBits[bitIndex] : 0;
          dark[row][c2] = bit === 1;
          bitIndex++;
        }
      }
      upward = !upward;
    }

    // ---- try all 8 masks, keep the one with the lowest penalty score ----
    var bestMask = 0, bestPenalty = Infinity, bestMatrix = null;
    for (var mask = 0; mask <= 7; mask++) {
      var copy = dark.map(function (row) { return row.slice(); });
      for (var r2 = 0; r2 < size; r2++) {
        for (var c3 = 0; c3 < size; c3++) {
          if (!isFn[r2][c3] && maskFn(mask, r2, c3)) copy[r2][c3] = !copy[r2][c3];
        }
      }
      var pen = penalty(copy, size);
      if (pen < bestPenalty) { bestPenalty = pen; bestMask = mask; bestMatrix = copy; }
    }

    // ---- format info (two copies around the top-left finder + split
    // across the other two) and version info (versions 7+) ----
    var fmtBits = FORMAT_INFO[levelIdx][bestMask];
    function fmtBit(i) { return (fmtBits >>> (14 - i)) & 1; }
    for (i = 0; i <= 5; i++) bestMatrix[8][i] = fmtBit(i) === 1;
    bestMatrix[8][7] = fmtBit(6) === 1;
    bestMatrix[8][8] = fmtBit(7) === 1;
    bestMatrix[7][8] = fmtBit(8) === 1;
    for (i = 9; i <= 14; i++) bestMatrix[14 - i][8] = fmtBit(i) === 1;
    for (i = 0; i <= 6; i++) bestMatrix[size - 1 - i][8] = fmtBit(i) === 1;
    for (i = 7; i <= 14; i++) bestMatrix[8][size - 15 + i] = fmtBit(i) === 1;
    bestMatrix[size - 8][8] = true;

    if (version >= 7) {
      var verBits = VERSION_INFO[version - 7];
      function verBit(i) { return (verBits >>> i) & 1; }
      for (i = 0; i < 18; i++) {
        var vr = Math.floor(i / 3), vc = i % 3;
        bestMatrix[vr][size - 11 + vc] = verBit(i) === 1;
        bestMatrix[size - 11 + vc][vr] = verBit(i) === 1;
      }
    }

    return { size: size, matrix: bestMatrix, isFinder: isFinder };
  }

  function generateQr(text, levelChar) {
    var levelIdx = LEVELS.indexOf((levelChar || 'M').toUpperCase());
    if (levelIdx === -1) levelIdx = 1;
    var bytes = utf8Bytes(text);
    var version = chooseVersion(bytes.length, levelIdx);
    if (version === -1) return null;
    var dataCodewords = buildDataCodewords(bytes, version, levelIdx);
    var finalBits = buildFinalBits(dataCodewords, version, levelIdx);
    var result = buildMatrix(version, levelIdx, finalBits);
    result.version = version;
    result.level = LEVELS[levelIdx];
    return result;
  }

  // ---- the custom element itself ----

  function escapeXml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var CSS = `
    :host { display: inline-block; line-height: 0; }
    svg { display: block; }
  `;

  class LWTQr extends window.LWT.Element {
    static get observedAttributes() {
      return ['src', 'size', 'level', 'background-color', 'color', 'corner-color', 'radius', 'margin', 'label', 'aria-label'];
    }

    render() {
      var src = this._strAttr('src', '');
      var size = parseFloat(this._strAttr('size', '200')) || 200;
      var level = this._strAttr('level', 'M');
      var bg = this._strAttr('background-color', '') || 'var(--lwt-qr-bg, var(--lwt-color-surface, #ffffff))';
      var color = this._strAttr('color', '') || 'var(--lwt-qr-color, var(--lwt-color-text-strong, #000000))';
      var cornerColor = this._strAttr('corner-color', '') || 'var(--lwt-qr-corner-color, ' + color + ')';
      var radius = parseFloat(this._strAttr('radius', '')) ;
      if (isNaN(radius)) radius = 0;
      radius = Math.max(0, Math.min(0.5, radius));
      var margin = parseInt(this._strAttr('margin', '4'), 10);
      if (isNaN(margin) || margin < 0) margin = 4;

      if (!src) {
        this._renderShadow('', CSS);
        return;
      }

      var result = generateQr(src, level);
      if (!result) {
        this._renderShadow('', CSS);
        this.emit('error', { message: 'Content is too long to encode at error-correction level ' + level.toUpperCase() + ', even at the largest QR version (40).' });
        return;
      }

      // Fills go through style="fill:...;" rather than a bare fill="..."
      // attribute -- inline style is where CSS var() reliably resolves;
      // a plain SVG presentation attribute is not guaranteed to.
      var n = result.size + margin * 2;
      var rects = '<rect x="0" y="0" width="' + n + '" height="' + n + '" style="fill: ' + escapeXml(bg) + ';"></rect>';
      for (var r = 0; r < result.size; r++) {
        for (var c = 0; c < result.size; c++) {
          if (!result.matrix[r][c]) continue;
          var fill = result.isFinder[r][c] ? cornerColor : color;
          rects += '<rect x="' + (c + margin) + '" y="' + (r + margin) + '" width="1" height="1"' +
            (radius > 0 ? ' rx="' + radius + '" ry="' + radius + '"' : '') +
            ' style="fill: ' + escapeXml(fill) + ';"></rect>';
        }
      }

      // Name: the developer's label if given, else what the code encodes.
      var name = this._hostLabel() || this._strAttr('label', '') || ('QR code for: ' + src);
      var svg = '<svg viewBox="0 0 ' + n + ' ' + n + '" width="' + size + '" height="' + size + '"' +
        ' role="img" aria-label="' + escapeXml(name) + '">' + rects + '</svg>';

      this._renderShadow(svg, CSS);
      this.emit('render', { version: result.version, size: result.size, level: result.level });
    }
  }

  window.LWT.define('lwtg-qr', LWTQr);
})();

/* ---- lwt-gen-rive.js ---- */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-rive.js requires lwt-core.js to be loaded first.');
  }

  var RIVE_SRC = 'https://unpkg.com/@rive-app/canvas';
  var loaderPromise = null;

  // Shared across every <lwtg-rive> on the page -- only ever injects the
  // <script> tag once, and reuses one that was already there (whether we
  // added it or the page author did).
  function loadRiveRuntime() {
    if (window.rive && window.rive.Rive) return Promise.resolve(window.rive);
    if (loaderPromise) return loaderPromise;

    loaderPromise = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + RIVE_SRC + '"]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.rive); });
        existing.addEventListener('error', function () {
          reject(new Error('lwtg-rive: failed to load the Rive runtime script.'));
        });
        return;
      }
      var script = document.createElement('script');
      script.src = RIVE_SRC;
      script.async = true;
      script.addEventListener('load', function () { resolve(window.rive); });
      script.addEventListener('error', function () {
        reject(new Error('lwtg-rive: failed to load the Rive runtime script.'));
      });
      document.head.appendChild(script);
    });

    return loaderPromise;
  }

  function splitNames(value) {
    if (!value) return [];
    return value.indexOf(',') !== -1
      ? value.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
      : [value];
  }

  var CSS = `
    :host { display: block; position: relative; line-height: 0; }
    canvas { display: block; width: 100%; height: 100%; }
  `;

  var TEMPLATE = '<canvas part="canvas"></canvas>';

  class LWTRive extends window.LWT.Element {
    static get observedAttributes() {
      return ['src', 'state-machine', 'artboard', 'autoplay', 'fit', 'alignment', 'width', 'height', 'label', 'aria-label', 'auto-bind'];
    }

    constructor() {
      super();
      this.rive = null;
      this._inputs = null; // state machine inputs, read lazily (deprecated Rive API)
      this._loadToken = 0;
      this._onResize = this._onResize.bind(this);
    }

    connectedCallback() {
      super.connectedCallback();
      if (typeof ResizeObserver === 'function') {
        this._resizeObserver = new ResizeObserver(this._onResize);
        this._resizeObserver.observe(this);
      }
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._resizeObserver) this._resizeObserver.disconnect();
      this._teardown();
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      this._canvas = this._root.querySelector('canvas');
      // The canvas is an image to assistive tech; it needs a name.
      this._canvas.setAttribute('role', 'img');
      this._canvas.setAttribute('aria-label', this._a11yName([this._strAttr('label', ''), this._strAttr('alt', '')],
        'Animation', 'Add a label attribute describing the animation'));

      var width = this._strAttr('width', '');
      var height = this._strAttr('height', '');
      this.style.width = width || '';
      this.style.height = height || '';

      this._init();
    }

    _teardown() {
      this._loadToken++; // invalidates any in-flight load meant for the previous config
      this._inputs = null;
      if (this.rive && typeof this.rive.cleanup === 'function') {
        try { this.rive.cleanup(); } catch (e) { /* already torn down */ }
      }
      this.rive = null;
    }

    _init() {
      this._teardown();

      var src = this._strAttr('src', '');
      if (!src || !this._canvas) return;

      var token = this._loadToken;
      var self = this;

      loadRiveRuntime().then(function (riveNs) {
        // Stale if the element was reconfigured/removed while we were
        // waiting on the (possibly shared, possibly network) load.
        if (token !== self._loadToken || !self.isConnected) return;

        var opts = {
          src: src,
          canvas: self._canvas,
          // Respect the visitor's reduced-motion setting (WCAG 2.2.2 /
          // 2.3.3): don't start animating on its own. .play() still works.
          autoplay: self._strAttr('autoplay', 'true') !== 'false' && !window.LWT.a11y.reducedMotion(),
          // Data binding (Rive's replacement for state machine inputs):
          // bind the file's default view model instance automatically.
          // Harmless for files without view models. auto-bind="false" opts out.
          autoBind: self._strAttr('auto-bind', 'true') !== 'false',
          onLoad: function () {
            if (token !== self._loadToken) return; // superseded before this fired
            var instance = self.rive;
            if (instance && typeof instance.resizeDrawingSurfaceToCanvas === 'function') {
              instance.resizeDrawingSurfaceToCanvas();
            }
            // State machine inputs are NOT read here any more: touching
            // them makes Rive log a deprecation warning on every load.
            // They're read lazily only if your code asks for them.
            self._inputs = null;
            var viewModel = self.viewModel;

            if (typeof self.onLoad === 'function') self._callOnLoad(self.onLoad, instance, viewModel);
            var onLoadFnName = self._strAttr('on-load', '');
            if (onLoadFnName && typeof window[onLoadFnName] === 'function') {
              self._callOnLoad(window[onLoadFnName], instance, viewModel);
            }

            var detail = { rive: instance, viewModel: viewModel };
            // Kept for backwards compatibility; only collected if accessed.
            Object.defineProperty(detail, 'inputs', { get: function () { return self._getInputs(); }, enumerable: false });
            self.emit('load', detail);
          },
          onLoadError: function (err) {
            self.emit('error', { error: err });
          }
        };

        var stateMachine = splitNames(self._strAttr('state-machine', ''));
        if (stateMachine.length === 1) opts.stateMachine = stateMachine[0];
        else if (stateMachine.length > 1) opts.stateMachine = stateMachine;

        var artboard = self._strAttr('artboard', '');
        if (artboard) opts.artboard = artboard;

        var fit = self._strAttr('fit', '');
        if (fit && riveNs.Layout && riveNs.Fit && riveNs.Fit[fit] !== undefined) {
          var alignmentName = self._strAttr('alignment', '');
          var layoutOpts = { fit: riveNs.Fit[fit] };
          if (alignmentName && riveNs.Alignment && riveNs.Alignment[alignmentName] !== undefined) {
            layoutOpts.alignment = riveNs.Alignment[alignmentName];
          }
          opts.layout = new riveNs.Layout(layoutOpts);
        }

        self.rive = new riveNs.Rive(opts);
      }).catch(function (err) {
        self.emit('error', { error: err });
      });
    }

    // onLoad callbacks: function (rive, inputs) still works -- the inputs
    // array is only built when the callback actually declares a second
    // parameter, so callbacks that only use `rive` never touch the
    // deprecated API. A third parameter receives the bound view model.
    _callOnLoad(fn, instance, viewModel) {
      try {
        if (fn.length >= 2) fn.call(this, instance, this._getInputs(), viewModel);
        else fn.call(this, instance);
      } catch (e) { console.error(e); }
    }

    _getInputs() {
      if (this._inputs === null) this._inputs = this._collectInputs(this.rive);
      return this._inputs;
    }

    _collectInputs(instance) {
      if (!instance || typeof instance.stateMachineInputs !== 'function') return [];
      var names = splitNames(this._strAttr('state-machine', ''));
      var all = [];
      names.forEach(function (name) {
        var inputs = instance.stateMachineInputs(name) || [];
        all = all.concat(inputs);
      });
      return all;
    }

    _onResize() {
      if (this.rive && typeof this.rive.resizeDrawingSurfaceToCanvas === 'function') {
        this.rive.resizeDrawingSurfaceToCanvas();
      }
    }

    resize() {
      this._onResize();
    }

    // Deprecated by Rive (state machine inputs) -- prefer setValue()/fire().
    getInput(name) {
      var found = this._getInputs().filter(function (i) { return i.name === name; });
      return found.length ? found[0] : null;
    }

    // ---- data binding (view model) API ----

    // The bound view model instance (auto-bound on load), or null when the
    // file has no view model or hasn't loaded yet.
    get viewModel() {
      return (this.rive && this.rive.viewModelInstance) || null;
    }

    // Finds a view model property by name or slash path ("Nested/Prop").
    // `kinds` limits which property types to try, in order.
    _property(path, kinds) {
      var vmi = this.viewModel;
      if (!vmi || !path) return null;
      var declared = this._declaredType(path);
      var order = declared ? [declared] : (kinds || ['number', 'boolean', 'string', 'enum', 'color', 'trigger']);
      for (var i = 0; i < order.length; i++) {
        var kind = order[i];
        if (typeof vmi[kind] !== 'function') continue;
        try {
          var prop = vmi[kind](path);
          if (prop) return { prop: prop, kind: kind };
        } catch (e) { /* not this type -- try the next */ }
      }
      return null;
    }

    // Uses the view model's property list (when available) to know a
    // top-level property's type up front instead of guessing.
    _declaredType(path) {
      if (path.indexOf('/') !== -1 || !this.rive || typeof this.rive.defaultViewModel !== 'function') return null;
      var vm;
      try { vm = this.rive.defaultViewModel(); } catch (e) { return null; }
      var props = vm && vm.properties;
      if (!props || !props.length) return null;
      var match = props.filter(function (p) { return p && p.name === path; })[0];
      if (!match) return null;
      var t = String(match.type).toLowerCase();
      var kinds = ['boolean', 'number', 'string', 'enum', 'color', 'trigger'];
      for (var i = 0; i < kinds.length; i++) if (t.indexOf(kinds[i]) !== -1) return kinds[i];
      return null;
    }

    // Sets a value: view model property if the file has one by that name,
    // else falls back to a state machine input of the same name (older
    // files). Returns true if something was set.
    setValue(path, value) {
      var kinds = typeof value === 'boolean' ? ['boolean']
        : typeof value === 'number' ? ['number', 'color']
        : ['string', 'enum'];
      var found = this._property(path, kinds);
      if (found && found.kind !== 'trigger') { found.prop.value = value; return true; }
      var input = this.viewModel ? null : this.getInput(path);
      if (input && 'value' in input) { input.value = value; return true; }
      return false;
    }

    getValue(path) {
      var found = this._property(path);
      if (found && found.kind !== 'trigger') return found.prop.value;
      var input = this.viewModel ? null : this.getInput(path);
      return input && 'value' in input ? input.value : undefined;
    }

    // Fires a trigger property (or, for older files, a trigger input).
    fire(path) {
      var found = this._property(path, ['trigger']);
      if (found && typeof found.prop.trigger === 'function') { found.prop.trigger(); return true; }
      var input = this.viewModel ? null : this.getInput(path);
      if (input && typeof input.fire === 'function') { input.fire(); return true; }
      return false;
    }

    // Calls callback(value) whenever the property changes (triggers call it
    // with no value). Returns a function that stops observing.
    observe(path, callback) {
      var found = this._property(path);
      if (!found || typeof found.prop.on !== 'function') return function () {};
      var prop = found.prop;
      var handler = function (event) { callback(event && 'data' in event ? event.data : prop.value); };
      prop.on(handler);
      return function () { if (typeof prop.off === 'function') prop.off(handler); };
    }
  }

  window.LWT.define('lwtg-rive', LWTRive);
})();

/* ---- lwt-gen-skill-bar.js ---- */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-dsh-skill-bar.js requires lwt-core.js to be loaded first.');
  }

  function escapeXml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var CSS = `
    :host { display: block; font-family: inherit; }
    .row {
      display: grid;
      grid-template-columns: var(--lwt-skill-bar-label-width, 220px) var(--lwt-skill-bar-value-width, 44px) 1fr;
      align-items: center;
      column-gap: var(--lwt-skill-bar-gap, var(--lwt-gap, 0.9rem));
      padding: var(--lwt-skill-bar-padding, 0.55rem 0);
    }
    .row.hide-value { grid-template-columns: var(--lwt-skill-bar-label-width, 220px) 1fr; }
    .label {
      font-size: 0.92rem;
      color: var(--lwt-skill-bar-label-color, var(--lwt-color-text, #2f4a6b));
      overflow-wrap: anywhere;
    }
    .value { font-size: 0.85rem; color: var(--lwt-skill-bar-value-color, var(--lwt-color-text, #374151)); }
    .track {
      height: var(--lwt-skill-bar-height, 10px);
      border-radius: var(--lwt-skill-bar-radius, 999px);
      background: var(--lwt-skill-bar-track-color, var(--lwt-border-color, #e5e7eb));
      overflow: hidden;
    }
    .fill {
      height: 100%;
      border-radius: var(--lwt-skill-bar-radius, 999px);
      background: var(--lwt-skill-bar-fill-color, var(--lwt-color-success, #8bc34a));
      width: 0%;
      transition: width 900ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    @media (prefers-reduced-motion: reduce) { .fill { transition: none; } }
  `;

  class LWTSkillBar extends window.LWT.Element {
    static get observedAttributes() {
      return ['label', 'value', 'max', 'color', 'hide-value'];
    }

    constructor() {
      super();
      this._initialized = false;
      this._revealed = false;
      this._targetPercent = 0;
      this._observer = null;
    }

    connectedCallback() {
      super.connectedCallback(); // triggers the first render(), which starts the fill at 0%

      if (!this._initialized) {
        this._initialized = true;
        var reduceMotion = typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (this._boolAttr('no-animate') || reduceMotion || typeof IntersectionObserver !== 'function') {
          this._reveal();
        } else {
          this._setupObserver();
        }
      }
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._observer) this._observer.disconnect();
    }

    render() {
      var fallbackLabel = escapeXml(this._strAttr('label', ''));
      var value = parseFloat(this._strAttr('value', '0')) || 0;
      var max = parseFloat(this._strAttr('max', '100')) || 100;
      var rawPercent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
      var percent = Math.round(rawPercent * 100) / 100; // avoid float artifacts like 55.00000000000001
      var valueText = max === 100 ? (Math.round(value) + '%') : (value + ' / ' + max);
      var color = this._strAttr('color', '');
      var hideValue = this._boolAttr('hide-value');

      var html =
        '<div class="row' + (hideValue ? ' hide-value' : '') + '" part="row">' +
        '<div class="label" part="label"><slot name="label">' + fallbackLabel + '</slot></div>' +
        (hideValue ? '' : '<div class="value" part="value">' + escapeXml(valueText) + '</div>') +
        '<div class="track" part="track">' +
        '<div class="fill" part="fill"' + (color ? ' style="background:' + escapeXml(color) + '"' : '') + '></div>' +
        '</div>' +
        '</div>';

      this._renderShadow(html, CSS);

      this._fillEl = this._root.querySelector('.fill');
      this._targetPercent = percent;
      this._fillEl.style.width = (this._revealed ? percent : 0) + '%';

      this.setAttribute('role', 'progressbar');
      this.setAttribute('aria-valuenow', String(value));
      this.setAttribute('aria-valuemin', '0');
      this.setAttribute('aria-valuemax', String(max));
      this.setAttribute('aria-valuetext', valueText);
      // Name the progressbar from the label attribute (raw text, not the
      // HTML-escaped copy used in the template), or the slotted label.
      var rawLabel = this._strAttr('label', '');
      var labelSlot = this._root.querySelector('slot[name="label"]');
      var self = this;
      var syncName = function () {
        if (!labelSlot.isConnected) return; // superseded by a newer render
        var slotted = labelSlot.assignedNodes({ flatten: true }).map(function (n) { return n.textContent; }).join('').trim();
        self._ensureAttr('aria-label', self._a11yName([slotted, rawLabel], 'Skill level', 'Add a label attribute'));
      };
      labelSlot.addEventListener('slotchange', syncName);
      if (rawLabel || this._hostLabel()) syncName(); else this._whenParsed(syncName);
    }

    get value() {
      return parseFloat(this._strAttr('value', '0')) || 0;
    }
    set value(v) {
      this.setAttribute('value', String(v));
    }

    _reveal() {
      if (this._revealed) return;
      this._revealed = true;
      if (this._fillEl) this._fillEl.style.width = this._targetPercent + '%';
    }

    _setupObserver() {
      var self = this;
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            self._reveal();
            observer.disconnect();
          }
        });
      }, { threshold: 0.3 });
      observer.observe(this);
      this._observer = observer;
    }
  }

  window.LWT.define('lwtg-skill-bar', LWTSkillBar);
})();

/* ---- lwt-gen-tab-panel.js ---- */
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

/* ---- lwt-gen-tab.js ---- */
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

/* ---- lwt-gen-tabs.js ---- */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-tabs.js requires lwt-core.js to be loaded first.');
  }

  var CSS = `
    :host { display: block; font-family: inherit; }
    .wrap { display: flex; height: 100%; }
    .tab-bar {
      display: flex;
      gap: var(--lwt-tabs-gap, 0.15rem);
      flex-shrink: 0;
      scrollbar-width: thin;
    }
    .panel-area {
      flex: 1;
      min-width: 0;
      min-height: 0;
      padding: var(--lwt-tabs-panel-padding, var(--lwt-padding, 1rem 0.25rem));
      overflow: auto;
    }
    /* Position-driven layout wrapped in :where() so any external CSS
       targeting the same parts (e.g. ::part(tab-bar) at a breakpoint)
       wins with no !important. See lwt-gen-grid-item.js for the pattern. */
    :where(:host([position="top"]) .wrap, :host(:not([position])) .wrap) { flex-direction: column; }
    :where(:host([position="top"]) .tab-bar, :host(:not([position])) .tab-bar) {
      order: 0;
      flex-direction: row;
      overflow-x: auto;
      overflow-y: hidden;
      border-bottom: var(--lwt-tabs-border, var(--lwt-border, 1px solid #e5e7eb));
      max-width: 100%;
    }
    :where(:host([position="top"]) .panel-area, :host(:not([position])) .panel-area) { order: 1; }
    :where(:host([position="bottom"]) .wrap) { flex-direction: column; }
    :where(:host([position="bottom"]) .tab-bar) {
      order: 1;
      flex-direction: row;
      overflow-x: auto;
      overflow-y: hidden;
      border-top: var(--lwt-tabs-border, var(--lwt-border, 1px solid #e5e7eb));
      max-width: 100%;
    }
    :where(:host([position="bottom"]) .panel-area) { order: 0; }
    :where(:host([position="left"]) .wrap) { flex-direction: row; }
    :where(:host([position="left"]) .tab-bar) {
      order: 0;
      flex-direction: column;
      overflow-y: auto;
      overflow-x: hidden;
      border-right: var(--lwt-tabs-border, var(--lwt-border, 1px solid #e5e7eb));
      flex-basis: var(--lwt-tabs-bar-size, 180px);
      max-height: 100%;
    }
    :where(:host([position="left"]) .panel-area) { order: 1; }
    :where(:host([position="right"]) .wrap) { flex-direction: row; }
    :where(:host([position="right"]) .tab-bar) {
      order: 1;
      flex-direction: column;
      overflow-y: auto;
      overflow-x: hidden;
      border-left: var(--lwt-tabs-border, var(--lwt-border, 1px solid #e5e7eb));
      flex-basis: var(--lwt-tabs-bar-size, 180px);
      max-height: 100%;
    }
    :where(:host([position="right"]) .panel-area) { order: 0; }
  `;

  var TEMPLATE =
    '<div class="wrap" part="wrap">' +
    '  <div class="tab-bar" part="tab-bar" role="tablist"><slot name="tab"></slot></div>' +
    '  <div class="panel-area" part="panel-area"><slot name="panel"></slot></div>' +
    '</div>';

  class LWTTabs extends window.LWT.Element {
    static get observedAttributes() {
      return ['position', 'label', 'aria-label'];
    }

    constructor() {
      super();
      this._activePanel = null;
      this._autoId = 0;
      this._initialized = false;
      this._handleSelect = this._handleSelect.bind(this);
    }

    connectedCallback() {
      super.connectedCallback();
      this.addEventListener('lwt-select', this._handleSelect);

      if (!this._initialized) {
        this._initialized = true;
        this._syncTabPositions();
        var initial = this._strAttr('active', '') || this._firstTabPanel();
        if (initial) this.selectTab(initial, { silent: true });
      }

      // With scripts in <head>, tabs/panels are parsed *after* this element
      // connects, so the initial selection above can find nothing. Re-sync
      // whenever children are added/removed: pick an initial tab if none is
      // active yet, and hide any newly-added panels that aren't active.
      if (typeof MutationObserver === 'function') {
        if (!this._childObserver) {
          var tabs = this;
          this._childObserver = new MutationObserver(function () { tabs._syncFromChildren(); });
        }
        this._childObserver.observe(this, { childList: true });
      }
    }

    _syncFromChildren() {
      this._syncTabPositions();
      var active = this._activePanel;
      var stillThere = active && this.querySelector(':scope > lwtg-tab[panel="' + (window.CSS && CSS.escape ? CSS.escape(active) : active) + '"]');
      if (!stillThere) {
        var initial = this._strAttr('active', '') || this._firstTabPanel();
        if (initial) this.selectTab(initial, { silent: true });
        else this._activePanel = null;
      } else {
        this.selectTab(active, { silent: true });
      }
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.removeEventListener('lwt-select', this._handleSelect);
      if (this._childObserver) this._childObserver.disconnect();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (name === 'position') this._syncTabPositions();
      this._syncTablist();
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      this._syncTablist();
    }

    // The tab bar is the role="tablist" (inside the shadow root): give it
    // the container's label and the right orientation.
    _syncTablist() {
      var bar = this._root.querySelector('.tab-bar');
      if (!bar) return;
      var label = this._hostLabel() || this._strAttr('label', '');
      if (label) bar.setAttribute('aria-label', label); else bar.removeAttribute('aria-label');
      var position = this._strAttr('position', 'top');
      bar.setAttribute('aria-orientation', (position === 'left' || position === 'right') ? 'vertical' : 'horizontal');
    }

    _ownTabs() { return Array.prototype.slice.call(this.querySelectorAll(':scope > lwtg-tab')); }
    _ownPanels() { return Array.prototype.slice.call(this.querySelectorAll(':scope > lwtg-tab-panel')); }

    // Wires each tab to its panel with page-unique ids (so two tab sets
    // with the same panel names never collide), and keeps a roving
    // tabindex: only the active tab is in the Tab order; arrow keys move
    // between tabs (WAI-ARIA tabs pattern).
    _syncA11y() {
      var a11y = window.LWT.a11y;
      var panels = this._ownPanels();
      var active = this._activePanel;
      this._ownTabs().forEach(function (tab) {
        var name = tab.getAttribute('panel');
        var panel = panels.filter(function (p) { return p.getAttribute('name') === name; })[0];
        if (!tab.id) tab.id = a11y.uid('lwt-tab');
        if (panel) {
          if (!panel.id) panel.id = a11y.uid('lwt-tabpanel');
          tab.setAttribute('aria-controls', panel.id);
          panel.setAttribute('aria-labelledby', tab.id);
        }
        tab.setAttribute('data-lwt-roving', '');
        tab.tabIndex = (name === active && !tab.hasAttribute('disabled')) ? 0 : -1;
      });
    }

    _syncTabPositions() {
      var position = this._strAttr('position', 'top');
      this._ownTabs().forEach(function (tab) {
        tab.setAttribute('position', position);
      });
    }

    _firstTabPanel() {
      var first = this.querySelector(':scope > lwtg-tab:not([disabled])') || this.querySelector(':scope > lwtg-tab');
      return first ? first.getAttribute('panel') : null;
    }

    _handleSelect(event) {
      // lwt-select bubbles up from any descendant (lwtf-select, lwtf-input
      // comboboxes, nav items, a nested <lwtg-tabs>' own tabs) -- only
      // react to this container's own direct <lwtg-tab> children.
      var tab = event.target;
      if (!tab || tab.tagName !== 'LWTG-TAB' || tab.parentElement !== this) return;
      this.selectTab(event.detail.panel);
    }

    get activePanel() {
      return this._activePanel;
    }

    selectTab(panelName, opts) {
      opts = opts || {};
      this._activePanel = panelName;

      // Direct children only, so a nested <lwtg-tabs> keeps its own state.
      this._ownTabs().forEach(function (tab) {
        tab.active = tab.getAttribute('panel') === panelName;
      });
      this._ownPanels().forEach(function (panel) {
        panel.hidden = panel.getAttribute('name') !== panelName;
      });
      this._syncA11y();

      if (!opts.silent) this.emit('change', { panel: panelName });
    }

    addTab(options) {
      options = options || {};
      var panelName = options.panel || ('tab-' + (++this._autoId));

      var tab = this._genhtml({type: 'lwtg-tab', attr:{'slot':'tab', 'panel':panelName, 'position':this._strAttr('position', 'top')}});
      if (options.disabled) tab.setAttribute('disabled', '');
      if (options.label instanceof Node) tab.appendChild(options.label);
      else if (options.label !== undefined) tab.textContent = options.label;

      var panel = this._genhtml({type: 'lwtg-tab-panel', attr:{'slot':'panel', 'name':panelName}});
      if (options.content instanceof Node) panel.appendChild(options.content);
      else if (options.content !== undefined) panel.textContent = options.content;

      this.appendChild(tab);
      this.appendChild(panel);

      if (options.active || !this._activePanel) this.selectTab(panelName);
      else panel.hidden = true; // keep non-active new panels hidden right away

      return { tab: tab, panel: panel, panelName: panelName };
    }

    removeTab(panelName) {
      var tab = this.querySelector('lwtg-tab[panel="' + panelName + '"]');
      var panel = this.querySelector('lwtg-tab-panel[name="' + panelName + '"]');
      var wasActive = this._activePanel === panelName;

      if (tab) tab.remove();
      if (panel) panel.remove();

      if (wasActive) {
        var next = this.querySelector(':scope > lwtg-tab');
        if (next) this.selectTab(next.getAttribute('panel'));
        else this._activePanel = null;
      }
    }
  }

  window.LWT.define('lwtg-tabs', LWTTabs);
})();

/* ---- lwt-gen-toast.js ---- */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-toast.js requires lwt-core.js to be loaded first.');
  }

  var ICONS = {
    success: '<svg class="icon" viewBox="0 0 20 20"><circle class="icon-bg" cx="10" cy="10" r="10"></circle><path d="M6 10.5l2.5 2.5L14 7" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
    warning: '<svg class="icon" viewBox="0 0 20 20"><path class="icon-bg" d="M10 1.5 L19.5 18.5 L0.5 18.5 Z"></path><line x1="10" y1="8" x2="10" y2="12.3" stroke="#fff" stroke-width="2" stroke-linecap="round"></line><circle cx="10" cy="15.3" r="1" fill="#fff"></circle></svg>',
    info: '<svg class="icon" viewBox="0 0 20 20"><circle class="icon-bg" cx="10" cy="10" r="10"></circle><circle cx="10" cy="6.5" r="1.2" fill="#fff"></circle><line x1="10" y1="9.5" x2="10" y2="15" stroke="#fff" stroke-width="2" stroke-linecap="round"></line></svg>',
    error: '<svg class="icon" viewBox="0 0 20 20"><circle class="icon-bg" cx="10" cy="10" r="10"></circle><line x1="7" y1="7" x2="13" y2="13" stroke="#fff" stroke-width="2" stroke-linecap="round"></line><line x1="13" y1="7" x2="7" y2="13" stroke="#fff" stroke-width="2" stroke-linecap="round"></line></svg>'
  };

  var CSS = `
    :host { display: block; font-family: inherit; }
    .toast-stack {
      position: fixed;
      z-index: 2147483000;
      display: flex;
      flex-direction: column;
      gap: var(--lwt-toast-gap, var(--lwt-gap, 0.5rem));
      pointer-events: none;
      max-width: min(90vw, 360px);
    }
    .pos-top-right { top: var(--lwt-toast-offset, 1rem); right: var(--lwt-toast-offset, 1rem); }
    .pos-top-left { top: var(--lwt-toast-offset, 1rem); left: var(--lwt-toast-offset, 1rem); }
    .pos-bottom-right {
      bottom: var(--lwt-toast-offset, 1rem);
      right: var(--lwt-toast-offset, 1rem);
      flex-direction: column-reverse;
    }
    .pos-bottom-left {
      bottom: var(--lwt-toast-offset, 1rem);
      left: var(--lwt-toast-offset, 1rem);
      flex-direction: column-reverse;
    }
    .pos-top-center { top: var(--lwt-toast-offset, 1rem); left: 50%; transform: translateX(-50%); }
    .pos-bottom-center {
      bottom: var(--lwt-toast-offset, 1rem);
      left: 50%;
      transform: translateX(-50%);
      flex-direction: column-reverse;
    }
    .toast-card {
      pointer-events: auto;
      display: flex;
      align-items: flex-start;
      gap: var(--lwt-toast-card-gap, var(--lwt-gap, 0.6rem));
      padding: var(--lwt-toast-padding, var(--lwt-padding, 0.8rem 0.9rem));
      border-radius: var(--lwt-toast-radius, var(--lwt-border-radius, 10px));
      background: var(--lwt-toast-bg, var(--lwt-color-surface, #fff));
      box-shadow: var(--lwt-toast-shadow, 0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1));
      border-left: 4px solid currentColor;
      animation: lwt-toast-in 180ms ease;
    }
    .toast-card.variant-success { color: var(--lwt-toast-success-color, var(--lwt-color-success, #22c55e)); }
    .toast-card.variant-warning { color: var(--lwt-toast-warning-color, var(--lwt-color-warning, #f59e0b)); }
    .toast-card.variant-info { color: var(--lwt-toast-info-color, var(--lwt-color-info, #3b82f6)); }
    .toast-card.variant-error { color: var(--lwt-toast-error-color, var(--lwt-color-danger, #ef4444)); }
    .toast-icon-wrap {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      margin-top: 0.1rem;
    }
    .icon-bg { fill: currentColor; }
    .toast-content { flex: 1; min-width: 0; }
    .toast-title {
      font-weight: 700;
      font-size: 0.9rem;
      color: var(--lwt-toast-title-color, var(--lwt-color-text-strong, #111827));
      margin-bottom: 0.1rem;
    }
    .toast-message {
      font-size: 0.86rem;
      color: var(--lwt-toast-text-color, var(--lwt-color-text, #374151));
      word-wrap: break-word;
    }
    .toast-close {
      flex-shrink: 0;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 1.15rem;
      line-height: 1;
      color: inherit;
      opacity: 0.7;
      padding: 0;
      min-width: 24px;
      min-height: 24px;
      margin: -0.25rem -0.3rem -0.25rem 0;
      border-radius: 4px;
    }
    .toast-close:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; opacity: 1; }
    .toast-close:hover { opacity: 1; }
    @keyframes lwt-toast-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
  `;

  class LWTToast extends window.LWT.Element {
    constructor() {
      super();
      this._nextId = 1;
    }

    connectedCallback() {
      super.connectedCallback();
      var position = this._strAttr('position', 'top-right');
      this._stack.className = 'toast-stack pos-' + position;
    }

    render() {
      // The stack exists before any toast is added, so it works as a live
      // region: new toasts are read out politely (WCAG 4.1.3).
      this._renderShadow('<div class="toast-stack" part="stack" role="region" aria-label="Notifications" aria-live="polite" aria-relevant="additions"></div>', CSS);
      this._stack = this._root.querySelector('.toast-stack');

      // Hovering or focusing a toast pauses auto-dismiss so people have
      // time to read it (WCAG 2.2.1); leaving resumes the countdown.
      var self = this;
      this._stack.addEventListener('mouseenter', function () { self._pauseAll(); });
      this._stack.addEventListener('mouseleave', function () { self._resumeAll(); });
      this._stack.addEventListener('focusin', function () { self._pauseAll(); });
      this._stack.addEventListener('focusout', function (e) {
        if (!self._stack.contains(e.relatedTarget)) self._resumeAll();
      });
    }

    _startTimer(card) {
      var self = this;
      if (!(card._lwtRemaining > 0)) return;
      card._lwtStarted = Date.now();
      card._lwtTimer = setTimeout(function () { self.close(card.getAttribute('data-toast-id'), 'timeout'); }, card._lwtRemaining);
    }

    _pauseAll() {
      Array.prototype.forEach.call(this._stack.children, function (card) {
        if (!card._lwtTimer) return;
        clearTimeout(card._lwtTimer);
        card._lwtTimer = null;
        card._lwtRemaining -= Date.now() - card._lwtStarted;
      });
    }

    _resumeAll() {
      var self = this;
      Array.prototype.forEach.call(this._stack.children, function (card) {
        if (!card._lwtTimer && card._lwtRemaining > 0) self._startTimer(card);
      });
    }

    show(options) {
      options = options || {};
      var id = 'toast-' + (this._nextId++);
      var variant = ICONS[options.variant] ? options.variant : 'info';
      var duration = typeof options.duration === 'number' ? options.duration : 4000;
      var self = this;

      var contentChildren = [];
      if (options.title) contentChildren.push({ type: 'div', attr: { class: 'toast-title' }, text: options.title });
      contentChildren.push({ type: 'div', attr: { class: 'toast-message' }, text: options.message || '' });

      var card = this._genhtml({
        type: 'div',
        attr: { class: 'toast-card variant-' + variant, 'data-toast-id': id },
        children: [
          { type: 'div', attr: { class: 'toast-icon-wrap', 'aria-hidden': 'true' }, html: ICONS[variant] },
          { type: 'div', attr: { class: 'toast-content' }, children: contentChildren },
          {
            type: 'button',
            attr: { type: 'button', class: 'toast-close', 'aria-label': 'Dismiss notification' },
            html: '&times;',
            events: { click: function () { self.close(id, 'dismiss'); } }
          }
        ]
      });

      // Errors and warnings interrupt; everything else waits its turn.
      if (variant === 'error' || variant === 'warning') card.setAttribute('role', 'alert');
      this._stack.appendChild(card);
      this.emit('show', { id: id, variant: variant });

      if (duration > 0) {
        card._lwtRemaining = duration;
        this._startTimer(card);
      }

      return id;
    }

    close(id, reason) {
      var card = this._stack.querySelector('[data-toast-id="' + id + '"]');
      if (!card) return;
      if (card._lwtTimer) clearTimeout(card._lwtTimer);
      card.remove();
      this.emit('close', { id: id, reason: reason || 'api' });
    }

    clear() {
      var self = this;
      Array.prototype.slice.call(this._stack.children).forEach(function (card) {
        self.close(card.getAttribute('data-toast-id'), 'api');
      });
    }
  }

  window.LWT.define('lwtg-toast', LWTToast);

  // Zero-setup global helper: finds (or lazily creates) a <lwtg-toast> and
  // shows on it, so callers don't have to place the element themselves.
  window.LWT.toast = function (options) {
    var el = document.querySelector('lwtg-toast');
    if (!el) {
      // Plain function, not a class method -- there's no <lwtg-toast>
      // instance yet to call ._genhtml() on (that's exactly what we're
      // creating), so this one spot has to fall back to
      // document.createElement directly rather than the _genhtml
      // pattern used everywhere else in this file.
      el = document.createElement('lwtg-toast');
      document.body.appendChild(el);
    }
    return el.show(options);
  };

  ['success', 'warning', 'info', 'error'].forEach(function (variant) {
    window.LWT.toast[variant] = function (message, options) {
      var merged = {};
      for (var k in options) if (Object.prototype.hasOwnProperty.call(options, k)) merged[k] = options[k];
      merged.variant = variant;
      merged.message = message;
      return window.LWT.toast(merged);
    };
  });
})();

/* ---- lwt-gen-tree-item.js ---- */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-tree-item.js requires lwt-core.js to be loaded first.');
  }

  function escapeXml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Small factory shared conceptually with lwt-gen-tree.js's own .addItem(),
  // but duplicated rather than imported — every element file in this
  // library only depends on lwt-core.js, never on a sibling element file.
  //
  // Takes `owner` (whichever <lwtg-tree> or <lwtg-tree-item> instance is
  // calling it) so it can build nodes via owner._genhtml(...) — this
  // function itself has no `this` of its own to call it through, since
  // it's a plain function, not a class method.
  function createTreeItem(options, owner) {
    options = options || {};
    var attr = {};
    if (options.value !== undefined) attr['data-value'] = options.value;
    if (options.expanded) attr.expanded = '';
    if (options.checked) attr.checked = '';
    if (options.disabled) attr.disabled = '';
    if (!(options.label instanceof Node) && options.label !== undefined) attr.label = options.label;

    var item = owner._genhtml({ type: 'lwtg-tree-item', attr: attr });

    if (options.label instanceof Node) {
      var span = owner._genhtml({ type: 'span', attr: { slot: 'label' } });
      span.appendChild(options.label);
      item.appendChild(span);
    }
    return item;
  }

  var CSS = `
    :host { display: block; font-family: inherit; }
    .row {
      display: flex;
      align-items: center;
      gap: var(--lwt-tree-gap, 0.35rem);
      padding: 0.35rem 0.5rem;
      border-radius: var(--lwt-tree-radius, var(--lwt-border-radius, 6px));
      cursor: pointer;
    }
    :host([disabled]) .row { opacity: 0.45; cursor: not-allowed; pointer-events: none; }
    :host(:focus-visible) { outline: none; }
    :host(:focus-visible) .row { box-shadow: 0 0 0 2px var(--lwt-tree-focus-color, var(--lwt-focus-color, #2563eb)); }
    .toggle {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--lwt-tree-chevron-color, var(--lwt-color-text-muted, #6b7280));
    }
    .toggle svg { width: 14px; height: 14px; transition: transform 150ms ease; }
    :host([expanded]) .toggle svg { transform: rotate(90deg); }
    .toggle.no-children { visibility: hidden; cursor: default; }
    .check {
      flex-shrink: 0;
      width: 15px;
      height: 15px;
      margin: 0;
      cursor: pointer;
      accent-color: var(--lwt-tree-check-color, var(--lwt-color-primary, #2563eb));
    }
    .label {
      flex: 1;
      min-width: 0;
      font-size: 0.9rem;
      color: var(--lwt-tree-label-color, var(--lwt-color-text, #1f2937));
    }
    :host([selected]) .row {
      background: var(--lwt-tree-selected-bg, var(--lwt-color-primary-soft, #eff6ff));
      border-left: 3px solid var(--lwt-tree-selected-border, var(--lwt-color-primary, #2563eb));
      padding-left: calc(0.5rem - 3px);
    }
    .children {
      padding-left: var(--lwt-tree-indent, 1.25rem);
      margin-left: 0.55rem;
      border-left: 1px solid var(--lwt-tree-guide-color, var(--lwt-border-color, #e5e7eb));
    }
    .children[hidden] { display: none; }
  `;

  // Uppercase tag names for .tagName comparisons. Keep in sync with the
  // LWT.define() calls — these were left as 'LWT-TREE*' after the rename
  // to lwtg-*, which made every item look like a leaf.
  var ITEM_TAG = 'LWTG-TREE-ITEM';
  var TREE_TAG = 'LWTG-TREE';

  var CHEVRON_SVG =
    '<svg viewBox="0 0 20 20"><path d="M7 4l6 6l-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

  class LWTTreeItem extends window.LWT.Element {
    static get observedAttributes() {
      return ['checkable'];
    }

    constructor() {
      super();
      this._expanded = false;
      this._checked = false;
      this._indeterminate = false;
      this._selected = false;
      this._initialized = false;
      this._handleRowClick = this._handleRowClick.bind(this);
      this._handleKeydown = this._handleKeydown.bind(this);
      this._handleCheckboxChange = this._handleCheckboxChange.bind(this);
      this._renderedAsBranch = false;
      this._childObserver = null;
    }

    connectedCallback() {
      super.connectedCallback(); // builds shadow via render()

      if (!this._initialized) {
        this._initialized = true;
        // When scripts load in <head>, the parser upgrades this element
        // as soon as its start tag is seen — before its children exist —
        // so isLeaf is not trustworthy here. Store the requested state and
        // let render()/_syncVisualState() decide based on real children.
        this._expanded = this.hasAttribute('expanded');
        this._selected = this.hasAttribute('selected');
        this._applyChecked(this.hasAttribute('checked'), false);
        this._syncVisualState();
      }

      this.addEventListener('click', this._handleRowClick);
      this.addEventListener('keydown', this._handleKeydown);

      // Re-render when child items arrive later (streaming parse) or are
      // added/removed directly via the DOM, so the chevron + children
      // container match reality.
      if (!this._childObserver) {
        var self = this;
        this._childObserver = new MutationObserver(function () {
          if (self._renderedAsBranch !== !self.isLeaf) self.render();
        });
      }
      this._childObserver.observe(this, { childList: true });
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.removeEventListener('click', this._handleRowClick);
      this.removeEventListener('keydown', this._handleKeydown);
      if (this._childObserver) this._childObserver.disconnect();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (name === 'checkable') this.render();
    }

    render() {
      var checkable = this._boolAttr('checkable');
      var hasChildren = !this.isLeaf;
      this._renderedAsBranch = hasChildren;
      var fallbackLabel = escapeXml(this._strAttr('label', ''));

      var html =
        '<div class="row" part="row">' +
        (hasChildren
          ? '<span class="toggle" part="toggle">' + CHEVRON_SVG + '</span>'
          : '<span class="toggle no-children" part="toggle"></span>') +
        // The treeitem itself carries aria-checked; the visual checkbox is
        // hidden from assistive tech so it isn't announced twice.
        (checkable ? '<input type="checkbox" class="check" part="checkbox" tabindex="-1" aria-hidden="true">' : '') +
        '<span class="label" part="label"><slot name="label">' + fallbackLabel + '</slot></span>' +
        '</div>' +
        '<div class="children" part="children" role="group"><slot></slot></div>';

      this._renderShadow(html, CSS);

      this._toggleEl = hasChildren ? this._root.querySelector('.toggle') : null;
      this._checkboxEl = checkable ? this._root.querySelector('.check') : null;
      this._childrenEl = this._root.querySelector('.children');

      if (this._checkboxEl) this._checkboxEl.addEventListener('change', this._handleCheckboxChange);

      this.setAttribute('role', 'treeitem');
      this.setAttribute('aria-level', String(this._depth()));
      // Name = this item's own label only. Without this, a parent item's
      // name would include the text of every nested child.
      var self = this;
      var labelSlot = this._root.querySelector('slot[name="label"]');
      var syncName = function () {
        self._ensureAttr('aria-label', self._a11yName([self.labelText], 'Tree item', 'Add a label attribute'));
      };
      labelSlot.addEventListener('slotchange', syncName);
      if (this._strAttr('label', '') || this._hostLabel()) syncName(); else this._whenParsed(syncName);
      if (hasChildren) this.setAttribute('aria-expanded', this._expanded ? 'true' : 'false');
      else this.removeAttribute('aria-expanded');

      this._syncVisualState();
    }

    // Re-applies current in-memory state (_expanded/_checked/_indeterminate/
    // _selected) onto whatever the shadow DOM currently looks like. Safe to
    // call any time — used after both initial connect and every render().
    _syncVisualState() {
      var hasChildren = !this.isLeaf;
      if (this._childrenEl) this._childrenEl.hidden = !hasChildren || !this._expanded;
      if (this._checkboxEl) {
        this._checkboxEl.checked = this._checked;
        this._checkboxEl.indeterminate = this._indeterminate;
        this.setAttribute('aria-checked', this._indeterminate ? 'mixed' : (this._checked ? 'true' : 'false'));
      } else {
        this.removeAttribute('aria-checked');
      }
      // Checkable trees use aria-checked; aria-selected is for select mode.
      if (this._checkboxEl) this.removeAttribute('aria-selected');
      else this.setAttribute('aria-selected', this._selected ? 'true' : 'false');
      if (this._boolAttr('disabled')) this.setAttribute('aria-disabled', 'true');
      else this.removeAttribute('aria-disabled');
      // Inside a <lwtg-tree>, the tree runs a roving tabindex (one item in
      // the Tab order at a time); standalone items stay focusable.
      if (!this.hasAttribute('data-lwt-roving')) this.tabIndex = this._boolAttr('disabled') ? -1 : 0;
    }

    get isLeaf() {
      return !Array.prototype.some.call(this.children, function (c) { return c.tagName === ITEM_TAG; });
    }

    get isExpanded() {
      return this._expanded;
    }

    get labelText() {
      var slot = this._root && this._root.querySelector('slot[name="label"]');
      if (slot) {
        var assigned = slot.assignedNodes({ flatten: true });
        if (assigned.length) {
          return assigned.map(function (n) { return n.textContent; }).join('').trim();
        }
      }
      return this._strAttr('label', '');
    }

    get checked() {
      return this._checked;
    }
    set checked(value) {
      value = !!value;
      this._applyChecked(value, false);
      this._cascadeDown(value);
      this._cascadeUp();
      this.emit('itemcheck', {});
    }

    get selected() {
      return this._selected;
    }
    set selected(value) {
      this._selected = !!value;
      if (this._selected) this.setAttribute('selected', '');
      else this.removeAttribute('selected');
      if (!this._checkboxEl) this.setAttribute('aria-selected', this._selected ? 'true' : 'false');
    }

    expand() {
      if (this.isLeaf || this._expanded) return;
      this._expanded = true;
      this.setAttribute('expanded', '');
      this.setAttribute('aria-expanded', 'true');
      if (this._childrenEl) this._childrenEl.hidden = false;
    }

    collapse() {
      if (!this._expanded) return;
      this._expanded = false;
      this.removeAttribute('expanded');
      this.setAttribute('aria-expanded', 'false');
      if (this._childrenEl) this._childrenEl.hidden = true;
    }

    toggleExpand() {
      if (this._expanded) this.collapse();
      else this.expand();
    }

    addItem(options) {
      var wasLeaf = this.isLeaf;
      var child = createTreeItem(options, this);
      this.appendChild(child);
      if (wasLeaf) this.render();

      var tree = this._findTree();
      if (tree) {
        if (typeof tree._syncCheckable === 'function') tree._syncCheckable();
        if (typeof tree._recomputeChecked === 'function') tree._recomputeChecked();
      }
      return child;
    }

    _findTree() {
      var p = this.parentElement;
      while (p && p.tagName !== TREE_TAG) p = p.parentElement;
      return p;
    }

    _parentItem() {
      var p = this.parentElement;
      return (p && p.tagName === ITEM_TAG) ? p : null;
    }

    _depth() {
      var depth = 1;
      var p = this._parentItem();
      while (p) {
        depth++;
        p = p._parentItem();
      }
      return depth;
    }

    // Sets this item's own checked/indeterminate state and syncs the
    // visuals — no cascading. Used both by the public .checked setter
    // (which layers cascading on top) and internally during cascades.
    _applyChecked(checked, indeterminate) {
      this._checked = !!checked;
      this._indeterminate = !!indeterminate;
      if (this._checked) this.setAttribute('checked', '');
      else this.removeAttribute('checked');
      if (this._checkboxEl) {
        this._checkboxEl.checked = this._checked;
        this._checkboxEl.indeterminate = this._indeterminate;
        this.setAttribute('aria-checked', this._indeterminate ? 'mixed' : (this._checked ? 'true' : 'false'));
      }
    }

    _cascadeDown(value) {
      this.querySelectorAll('lwtg-tree-item').forEach(function (item) {
        item._applyChecked(value, false);
      });
    }

    _cascadeUp() {
      var parent = this._parentItem();
      if (!parent) return;
      var siblings = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === ITEM_TAG; });
      var allChecked = siblings.every(function (c) { return c._checked && !c._indeterminate; });
      var noneChecked = siblings.every(function (c) { return !c._checked && !c._indeterminate; });
      if (allChecked) parent._applyChecked(true, false);
      else if (noneChecked) parent._applyChecked(false, false);
      else parent._applyChecked(false, true);
      parent._cascadeUp();
    }

    // Bottom-up derivation pass: leaves trust their own `checked`
    // attribute; branches always recompute from their children. Used by
    // <lwtg-tree> once at connect (and after addItem) so markup-declared
    // state comes out consistent even if a branch's attribute disagrees
    // with what its children actually say.
    _recomputeSelf() {
      var childItems = Array.prototype.filter.call(this.children, function (c) { return c.tagName === ITEM_TAG; });
      if (!childItems.length) {
        this._applyChecked(this.hasAttribute('checked'), false);
        return;
      }
      childItems.forEach(function (c) { c._recomputeSelf(); });
      var allChecked = childItems.every(function (c) { return c._checked && !c._indeterminate; });
      var noneChecked = childItems.every(function (c) { return !c._checked && !c._indeterminate; });
      if (allChecked) this._applyChecked(true, false);
      else if (noneChecked) this._applyChecked(false, false);
      else this._applyChecked(false, true);
    }

    _handleRowClick(event) {
      var originalTarget = event.composedPath()[0];

      // Native clicks are composed, so a click on a nested child item's
      // own shadow row bubbles all the way up through every ancestor
      // item's click listener too. Only react if the click actually
      // originated on this item itself: either a real click somewhere
      // inside this item's own shadow tree, or a direct, synthetic
      // .click() call made on this item's host (composedPath()[0] is
      // the host itself in that case, not a shadow-internal node).
      // Otherwise it belongs to a descendant item, which has already
      // handled it and stopped it from bubbling any further (below).
      var belongsToThisItem = originalTarget === this || (this._root && originalTarget.getRootNode() === this._root);
      if (!belongsToThisItem) return;

      event.stopPropagation();
      if (this._boolAttr('disabled')) return;

      if (this._toggleEl && (originalTarget === this._toggleEl || this._toggleEl.contains(originalTarget))) {
        this.toggleExpand();
        return;
      }
      if (originalTarget === this._checkboxEl) return; // native toggle + change listener already handles it

      if (this._boolAttr('checkable')) {
        if (this._checkboxEl) this._checkboxEl.click();
      } else {
        this.emit('itemselect', {});
      }
    }

    _handleCheckboxChange(event) {
      this.checked = event.target.checked;
    }

    _handleKeydown(event) {
      // Keydown bubbles through every ancestor item's own listener too;
      // only the item that's actually focused (the real target) should
      // react to Enter/Space. Arrow/Home/End are deliberately left alone
      // here (no branch below acts on them) so they keep bubbling up to
      // <lwtg-tree>, which owns cross-item navigation.
      if (event.target !== this) return;
      if (this._boolAttr('disabled')) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (this._boolAttr('checkable')) {
          if (this._checkboxEl) this._checkboxEl.click();
        } else {
          this.emit('itemselect', {});
        }
      }
    }
  }

  window.LWT.define('lwtg-tree-item', LWTTreeItem);
})();

/* ---- lwt-gen-tree.js ---- */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-tree.js requires lwt-core.js to be loaded first.');
  }

  // Duplicated from lwt-gen-tree-item.js on purpose — see that file's header
  // for why element files never depend on each other, only on lwt-core.js.
  //
  // Takes `owner` (whichever <lwtg-tree> or <lwtg-tree-item> instance is
  // calling it) so it can build nodes via owner._genhtml(...) — this
  // function itself has no `this` of its own to call it through, since
  // it's a plain function, not a class method.
  function createTreeItem(options, owner) {
    options = options || {};
    var attr = {};
    if (options.value !== undefined) attr['data-value'] = options.value;
    if (options.expanded) attr.expanded = '';
    if (options.checked) attr.checked = '';
    if (options.disabled) attr.disabled = '';
    if (!(options.label instanceof Node) && options.label !== undefined) attr.label = options.label;

    var item = owner._genhtml({ type: 'lwtg-tree-item', attr: attr });

    if (options.label instanceof Node) {
      var span = owner._genhtml({ type: 'span', attr: { slot: 'label' } });
      span.appendChild(options.label);
      item.appendChild(span);
    }
    return item;
  }

  var CSS = `
    :host { display: block; font-family: inherit; }
  `;
  var TEMPLATE = '<div class="tree" part="tree" role="tree"><slot></slot></div>';

  // Uppercase tag name for .tagName comparisons — keep in sync with define().
  var ITEM_TAG = 'LWTG-TREE-ITEM';

  var NAV_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];

  class LWTTree extends window.LWT.Element {
    static get observedAttributes() {
      return ['checkable', 'label', 'aria-label'];
    }

    constructor() {
      super();
      this._initialized = false;
      this._handleSelect = this._handleSelect.bind(this);
      this._handleCheckChange = this._handleCheckChange.bind(this);
      this._handleKeydown = this._handleKeydown.bind(this);
      this._handleFocusIn = this._handleFocusIn.bind(this);
      this._treeObserver = null;
      this._syncQueued = false;
    }

    connectedCallback() {
      super.connectedCallback();
      this.addEventListener('lwt-itemselect', this._handleSelect);
      this.addEventListener('lwt-itemcheck', this._handleCheckChange);
      this.addEventListener('keydown', this._handleKeydown);
      this.addEventListener('focusin', this._handleFocusIn);

      if (!this._initialized) {
        this._initialized = true;
        var self = this;
        // Deferred a tick so any <lwtg-tree-item> descendants that
        // haven't finished upgrading yet (e.g. this element's script
        // happened to run before theirs) are ready before we walk them.
        Promise.resolve().then(function () {
          self._syncCheckable();
          self._recomputeChecked();
        });
      }

      // With scripts in <head>, items are parsed *after* this element
      // connects, so the one-shot sync above can run against an empty
      // tree. Watch for items being added anywhere below and re-sync
      // checkable + derived check state once per batch.
      if (!this._treeObserver) {
        var tree = this;
        this._treeObserver = new MutationObserver(function () { tree._queueSync(); });
      }
      this._treeObserver.observe(this, { childList: true, subtree: true });
    }

    _queueSync() {
      if (this._syncQueued) return;
      this._syncQueued = true;
      var self = this;
      Promise.resolve().then(function () {
        self._syncQueued = false;
        self._syncCheckable();
        self._recomputeChecked();
        self._syncRoving();
      });
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.removeEventListener('lwt-itemselect', this._handleSelect);
      this.removeEventListener('lwt-itemcheck', this._handleCheckChange);
      this.removeEventListener('keydown', this._handleKeydown);
      this.removeEventListener('focusin', this._handleFocusIn);
      if (this._treeObserver) this._treeObserver.disconnect();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (name === 'checkable') this._syncCheckable();
      this._syncTreeA11y();
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      this._syncTreeA11y();
    }

    // role="tree" lives on the shadow wrapper; give it a name and say
    // whether several items can be checked at once.
    _syncTreeA11y() {
      var tree = this._root.querySelector('.tree');
      if (!tree) return;
      tree.setAttribute('aria-label', this._a11yName([this._strAttr('label', '')], 'Tree', 'Add a label attribute'));
      if (this._boolAttr('checkable')) tree.setAttribute('aria-multiselectable', 'true');
      else tree.removeAttribute('aria-multiselectable');
    }

    // Roving tabindex (WAI-ARIA tree pattern): exactly one visible item is
    // in the Tab order -- the last one focused, else the selected one,
    // else the first. Arrow keys (see _handleKeydown) move between items.
    _syncRoving(preferred) {
      var items = Array.prototype.slice.call(this.querySelectorAll('lwtg-tree-item'));
      if (!items.length) return;
      var visible = this._visibleItems().filter(function (i) { return !i.hasAttribute('disabled'); });
      var current = preferred && visible.indexOf(preferred) !== -1 ? preferred
        : (visible.filter(function (i) { return i.tabIndex === 0 && i.hasAttribute('data-lwt-roving'); })[0] ||
           visible.filter(function (i) { return i.hasAttribute('selected'); })[0] || visible[0]);
      items.forEach(function (item) {
        item.setAttribute('data-lwt-roving', '');
        item.tabIndex = item === current ? 0 : -1;
      });
    }

    _handleFocusIn(event) {
      var item = event.target;
      if (item && item.tagName === 'LWTG-TREE-ITEM') this._syncRoving(item);
    }

    _syncCheckable() {
      var checkable = this._boolAttr('checkable');
      this.querySelectorAll('lwtg-tree-item').forEach(function (item) {
        if (checkable) item.setAttribute('checkable', '');
        else item.removeAttribute('checkable');
      });
    }

    _recomputeChecked() {
      var roots = Array.prototype.filter.call(this.children, function (c) { return c.tagName === ITEM_TAG; });
      roots.forEach(function (r) { r._recomputeSelf(); });
    }

    _handleSelect(event) {
      if (this._boolAttr('checkable')) return;
      var target = event.target;
      this.querySelectorAll('lwtg-tree-item').forEach(function (item) {
        item.selected = (item === target);
      });
      this.emit('change', {});
    }

    _handleCheckChange() {
      this.emit('change', {});
    }

    getSelectedLeaves() {
      var checkable = this._boolAttr('checkable');
      var results = [];
      this.querySelectorAll('lwtg-tree-item').forEach(function (item) {
        if (!item.isLeaf) return;
        var isSelected = checkable ? item.checked : item.selected;
        if (!isSelected) return;
        results.push({
          label: item.labelText,
          value: item.hasAttribute('data-value') ? item.getAttribute('data-value') : null,
          element: item
        });
      });
      return results;
    }

    addItem(options, parentItem) {
      var item = createTreeItem(options, this);
      if (parentItem && parentItem.tagName === ITEM_TAG) {
        var wasLeaf = parentItem.isLeaf;
        parentItem.appendChild(item);
        if (wasLeaf) parentItem.render();
      } else {
        this.appendChild(item);
      }
      this._syncCheckable();
      this._recomputeChecked();
      return item;
    }

    removeItem(item) {
      if (!item) return;
      var parent = (typeof item._parentItem === 'function') ? item._parentItem() : null;
      item.remove();
      if (parent) {
        if (parent.isLeaf) parent.render();
        parent._cascadeUp();
      } else {
        this._recomputeChecked();
      }
    }

    _visibleItems() {
      var all = Array.prototype.slice.call(this.querySelectorAll('lwtg-tree-item'));
      return all.filter(function (item) {
        var p = item._parentItem();
        while (p) {
          if (!p.isExpanded) return false;
          p = p._parentItem();
        }
        return true;
      });
    }

    _handleKeydown(event) {
      if (NAV_KEYS.indexOf(event.key) === -1) return;
      var current = event.target;
      if (!current || current.tagName !== ITEM_TAG) return;

      var visible = this._visibleItems();
      var idx = visible.indexOf(current);
      if (idx === -1) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        var next = visible[idx + 1];
        if (next) next.focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        var prev = visible[idx - 1];
        if (prev) prev.focus();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (!current.isLeaf) {
          if (!current.isExpanded) {
            current.expand();
          } else {
            var firstChild = visible[idx + 1];
            if (firstChild && current.contains(firstChild)) firstChild.focus();
          }
        }
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (!current.isLeaf && current.isExpanded) {
          current.collapse();
        } else {
          var parentItem = current._parentItem();
          if (parentItem) parentItem.focus();
        }
      } else if (event.key === 'Home') {
        event.preventDefault();
        if (visible[0]) visible[0].focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        if (visible[visible.length - 1]) visible[visible.length - 1].focus();
      }
    }
  }

  window.LWT.define('lwtg-tree', LWTTree);
})();

/* ---- lwt-gen-whitespace.js ---- */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-whitespace.js requires lwt-core.js to be loaded first.');
  }

  function toLength(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    return /^-?[0-9]*\.?[0-9]+$/.test(value) ? value + 'px' : value;
  }

  class LWTWhitespace extends window.LWT.Element {
    static get observedAttributes() {
      return ['height', 'width', 'axis'];
    }

    render() {
      var axis = this._strAttr('axis', 'block');
      var height = toLength(this._strAttr('height', null), '1rem');
      var width = toLength(this._strAttr('width', null), 'auto');

      this.style.display = axis === 'inline' ? 'inline-block' : 'block';
      this.style.flexShrink = '0';
      this.style.height = axis === 'inline' ? '1px' : height;
      this.style.width = axis === 'inline' ? width : (this._strAttr('width', null) ? width : 'auto');

      // Keep it truly empty and out of the accessibility tree — this is
      // layout spacing, not content.
      this.setAttribute('aria-hidden', 'true');
    }
  }

  window.LWT.define('lwtg-whitespace', LWTWhitespace);
})();

