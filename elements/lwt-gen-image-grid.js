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
