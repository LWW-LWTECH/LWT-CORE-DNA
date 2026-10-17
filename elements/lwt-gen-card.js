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
