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
