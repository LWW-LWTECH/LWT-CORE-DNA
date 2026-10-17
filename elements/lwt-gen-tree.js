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
