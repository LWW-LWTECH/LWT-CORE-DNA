(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-image-grid.js requires lwt-core.js to be loaded first.');
  }

  var CSS = `
    :host { display: block; font-family: inherit; }
    .grid {
      display: grid;
      gap: var(--lwt-image-grid-gap, var(--lwt-gap, 1rem));
      grid-auto-rows: var(--lwt-image-grid-row-height, 160px);
      grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--lwt-image-grid-min-width, 200px)), 1fr));
    }
    /* With "columns" set: cap the count, but let it collapse on small
       screens once each column would fall below --lwt-image-grid-min-width.
       The columns/dense structural rules are wrapped in :where() so
       external CSS via ::part(grid) or a responsive override wins with
       no !important. Same pattern applied to <lwtg-grid-item> and friends. */
    :where(:host([columns]) .grid) {
      grid-template-columns: repeat(auto-fit, minmax( max(var(--lwt-image-grid-min-width, 200px), calc((100% - (var(--lwt-image-grid-columns, 4) - 1) * var(--lwt-image-grid-gap, var(--lwt-gap, 1rem))) / var(--lwt-image-grid-columns, 4))), 1fr));
    }
    /* "rows" alone: fixed row count, columns still responsive. */
    :where(:host([rows]) .grid) {
      grid-template-rows: repeat(var(--lwt-image-grid-rows, 1), var(--lwt-image-grid-row-height, 160px));
    }
    /* Both "columns" AND "rows" set: user has committed to a fixed grid,
       so drop the responsive auto-fit magic and hard-cap the column count
       at exactly N. Comes AFTER the "[columns]" rule so it wins the
       cascade (same zero specificity, order matters). */
    :where(:host([columns][rows]) .grid) { grid-template-columns: repeat(var(--lwt-image-grid-columns, 4), 1fr); }
    :where(:host([dense]) .grid) { grid-auto-flow: dense; }
  `;

  class LWTImageGrid extends window.LWT.Element {
    static get observedAttributes() {
      return ['columns', 'rows', 'gap', 'row-height', 'dense'];
    }

    render() {
      this._syncVars();
      this._renderShadow('<div class="grid" part="grid"><slot></slot></div>', CSS);
    }

    _syncVars() {
      if (this.hasAttribute('columns')) {
        this.style.setProperty('--lwt-image-grid-columns', this._strAttr('columns', '4'));
      } else {
        this.style.removeProperty('--lwt-image-grid-columns');
      }

      if (this.hasAttribute('rows')) {
        this.style.setProperty('--lwt-image-grid-rows', this._strAttr('rows', '1'));
      } else {
        this.style.removeProperty('--lwt-image-grid-rows');
      }

      if (this.hasAttribute('gap')) {
        this.style.setProperty('--lwt-image-grid-gap', this._strAttr('gap', ''));
      } else {
        this.style.removeProperty('--lwt-image-grid-gap');
      }

      if (this.hasAttribute('row-height')) {
        this.style.setProperty('--lwt-image-grid-row-height', this._strAttr('row-height', ''));
      } else {
        this.style.removeProperty('--lwt-image-grid-row-height');
      }
    }
  }

  window.LWT.define('lwtg-image-grid', LWTImageGrid);
})();
