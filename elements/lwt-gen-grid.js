/*!
 * <lwtg-grid>
 * A CSS grid container for <lwtg-grid-item> (or any) children.
 *
 *   <lwtg-grid columns="4" gap="12px" min-col-width="140px"> ... </lwtg-grid>
 *
 * Attributes: columns, rows, gap, min-col-width, row-height, dense
 * (copied onto the host as --lwt-grid-* variables, so the same variables
 * can also be set from a stylesheet).
 *
 * ---------------------------------------------------------------------
 * Resizable panels
 * ---------------------------------------------------------------------
 * Add `resizable` and the grid's column and row sizes can be dragged,
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
      grid-template-rows: var(--lwt-grid-template-rows, repeat(var(--lwt-grid-rows, 1), var(--lwt-grid-row-height, 1fr)));
      grid-template-columns: var(--lwt-grid-template-columns, repeat(var(--lwt-grid-columns, 1), var(--lwt-grid-min-col-width, 1fr)));
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
      return ['columns', 'rows', 'gap', 'min-col-width', 'row-height', 'dense', 'resizable', 'resize-min'];
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
      if (name === 'columns' || name === 'min-col-width') this._colSizes = null;
      if (name === 'rows' || name === 'row-height') this._rowSizes = null;
      if (name === 'resizable' && newValue === null) { this._colSizes = null; this._rowSizes = null; }
      super.attributeChangedCallback(name, oldValue, newValue);
    }

    render() {
      this._syncVars();
      this._renderShadow('<div class="grid" part="grid"><slot></slot></div>', CSS);
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
      Array.prototype.forEach.call(this.children, function (child) {
        if (child.localName !== 'lwtg-grid-item') return;
        if (on) child.setAttribute('data-resizable', '');
        else child.removeAttribute('data-resizable');
      });
    }

    // Columns stay proportional: each column's px size becomes its fr factor.
    // Tracks with an item minimum become minmax(<min>, <size>).
    _applyTemplates() {
      var mins = this._mins || { columns: [], rows: [] };
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

  window.LWT.define('lwtg-grid', LWTGrid);
})();
