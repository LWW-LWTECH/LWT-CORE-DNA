(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-grid.js requires lwt-core.js to be loaded first.');
  }

  // Attributes (gap, columns, rows, ...) are copied onto the host as
  // --lwt-grid-* variables by _syncVars(), so the CSS itself stays static
  // and the same variables can also be set from a stylesheet.
  var CSS = `
    :host { display: block; font-family: inherit; width: 100%; }
    :host([hidden]) { display: none; }
    .grid {
      display: grid;
      width: 100%;
      gap: var(--lwt-grid-gap, var(--lwt-gap, 1rem));
      grid-template-rows: repeat(var(--lwt-grid-rows, 1), var(--lwt-grid-row-height, 1fr));
      grid-template-columns: repeat(var(--lwt-grid-columns, 1), var(--lwt-grid-min-col-width, 1fr));
    }
    :where(:host([dense]) .grid) { grid-auto-flow: dense; }
  `;

  class LWTGrid extends window.LWT.Element {
    static get observedAttributes() {
      return ['columns', 'rows', 'gap', 'min-col-width', 'row-height', 'dense'];
    }

    render() {
      this._syncVars();
      this._renderShadow('<div class="grid" part="grid"><slot></slot></div>', CSS);
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
  }

  window.LWT.define('lwtg-grid', LWTGrid);
})();
