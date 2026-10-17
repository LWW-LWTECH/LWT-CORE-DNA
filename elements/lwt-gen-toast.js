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
