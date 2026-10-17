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
