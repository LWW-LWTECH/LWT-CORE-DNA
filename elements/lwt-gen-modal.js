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
