(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-carousel.js requires lwt-core.js to be loaded first.');
  }

  var CSS =
    ':host { display: block; font-family: inherit; }' +
    '.track { display: flex; gap: var(--lwt-carousel-gap, 1rem); overflow-x: auto;' +
    '  scroll-snap-type: x mandatory; scroll-behavior: smooth; padding-bottom: 0.25rem; scrollbar-width: thin; }' +
    '::slotted(lwtg-card) { scroll-snap-align: start; flex: 0 0 auto; width: var(--lwt-carousel-card-width, 260px); }' +
    '.dots { display: flex; justify-content: center; align-items: center; gap: 0.1rem; margin-top: 0.6rem; }' +
    // Each dot is a 24x24 tap target (WCAG 2.5.8) drawing a small circle.
    '.dot { width: 24px; height: 24px; padding: 0; margin: 0; border: none; border-radius: 50%; background: none;' +
    '  display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }' +
    '.dot::before { content: ""; width: 8px; height: 8px; border-radius: 50%;' +
    '  background: var(--lwt-carousel-dot-color, var(--lwt-color-border-strong, #9ca3af)); }' +
    '.dot[aria-current="true"]::before { background: var(--lwt-carousel-dot-active-color, var(--lwt-color-text, #374151)); }' +
    ':host([dot-as-image]) .dot::before { content: none; }' +
    '.dot:focus-visible { outline: 2px solid var(--lwt-carousel-dot-active-color, var(--lwt-color-text, #374151)); outline-offset: 2px; }' +
    ':host([dot-as-image]) .dot { width: var(--lwt-carousel-dot-size, 32px); height: var(--lwt-carousel-dot-size, 32px);' +
    '  border-radius: 6px; overflow: hidden; background: var(--lwt-carousel-dot-color, var(--lwt-color-border, #e5e7eb)); }' +
    ':host([dot-as-image]) .dot img { width: 100%; height: 100%; object-fit: cover; aspect-ratio: 1 / 1; display: block; }' +
    ':host([dot-as-image]) .dot[aria-current="true"] { outline: 2px solid var(--lwt-carousel-dot-active-color, var(--lwt-color-text, #374151)); outline-offset: 2px; }';

  var TEMPLATE =
    '<div class="wrap" part="wrap">' +
    '<div class="track" part="track" role="region" aria-roledescription="carousel" tabindex="0"><slot></slot></div>' +
    '<div class="dots" part="dots" role="group" aria-label="Choose slide"></div>' +
    '</div>';

  class LWTCarousel extends window.LWT.Element {
    static get observedAttributes() {
      return ['dot-as-image', 'image-position', 'label', 'aria-label'];
    }

    constructor() {
      super();
      this._initialized = false;
      this._activeIndex = 0;
      this._observer = null;
    }

    connectedCallback() {
      super.connectedCallback();

      if (!this._initialized) {
        this._initialized = true;
        this._syncImagePosition();
        var self = this;
        Promise.resolve().then(function () {
          self._buildDots();
          self._setupObserver();
        });
      }

      // With scripts in <head>, cards are parsed *after* this element
      // connects, so the one-shot build above can see zero cards. Rebuild
      // dots and re-observe cards whenever the child list changes.
      if (typeof MutationObserver === 'function') {
        if (!this._childObserver) {
          var carousel = this;
          this._childObserver = new MutationObserver(function () {
            carousel._syncImagePosition();
            carousel._buildDots();
            carousel._setupObserver();
          });
        }
        this._childObserver.observe(this, { childList: true });
      }
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._observer) this._observer.disconnect();
      if (this._childObserver) this._childObserver.disconnect();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (name === 'dot-as-image') this._buildDots();
      else if (name === 'image-position') this._syncImagePosition();
      else if ((name === 'label' || name === 'aria-label') && this._trackEl) {
        this._trackEl.setAttribute('aria-label', this._a11yName([this._strAttr('label', '')], 'Carousel', 'Add a label attribute'));
      }
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      this._trackEl = this._root.querySelector('.track');
      this._dotsEl = this._root.querySelector('.dots');
      this._trackEl.setAttribute('aria-label', this._a11yName([this._strAttr('label', '')], 'Carousel', 'Add a label attribute'));
    }

    get activeIndex() {
      return this._activeIndex;
    }

    _cards() {
      return Array.prototype.filter.call(this.children, function (c) { return c.tagName === 'LWTG-CARD'; });
    }

    _syncImagePosition() {
      if (!this.hasAttribute('image-position')) return;
      var pos = this._strAttr('image-position', 'top');
      this._cards().forEach(function (card) { card.setAttribute('image-position', pos); });
    }

    _buildDots() {
      if (!this._dotsEl) return;
      var self = this;
      var dotAsImage = this._boolAttr('dot-as-image');
      this._dotsEl.innerHTML = '';

      var cards = this._cards();
      cards.forEach(function (card, index) {
        // Announce each card as "slide N of M" unless the developer gave
        // the card its own role/name.
        if (!card.hasAttribute('role') || card.hasAttribute('data-lwt-slide')) {
          card.setAttribute('role', 'group');
          card.setAttribute('aria-roledescription', 'slide');
          card.setAttribute('data-lwt-slide', '');
          if (!card.hasAttribute('aria-label') || card.hasAttribute('data-lwt-slide-label')) {
            var cardLabel = card.getAttribute('label');
            card.setAttribute('aria-label', (index + 1) + ' of ' + cards.length + (cardLabel ? ': ' + cardLabel : ''));
            card.setAttribute('data-lwt-slide-label', '');
          }
        }
        var dot = self._genhtml({
          type: 'button',
          attr: {
            type: 'button',
            part: 'dot',
            'aria-label': 'Go to slide ' + (index + 1),
            'aria-current': index === self._activeIndex ? 'true' : 'false'
          }
        });
        dot.className = 'dot';

        var imageSrc = card.getAttribute('image');
        if (dotAsImage && imageSrc) {
          dot.appendChild(self._genhtml({ type: 'img', attr: { src: imageSrc, alt: '' } }));
        }

        dot.addEventListener('click', function () { self.goTo(index); });
        self._dotsEl.appendChild(dot);
      });
    }

    _syncDots() {
      if (!this._dotsEl) return;
      var self = this;
      Array.prototype.forEach.call(this._dotsEl.children, function (dot, index) {
        dot.setAttribute('aria-current', index === self._activeIndex ? 'true' : 'false');
      });
    }

    _setupObserver() {
      if (typeof IntersectionObserver !== 'function' || !this._trackEl) return;
      if (this._observer) this._observer.disconnect();
      var self = this;
      this._observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            self._setActiveCard(entry.target, false);
          }
        });
      }, { root: this._trackEl, threshold: [0, 0.6, 1] });

      this._cards().forEach(function (card) { self._observer.observe(card); });
    }

    // shouldScroll: true when navigation was requested programmatically
    // (goTo/next/prev/dot click) and the card needs to be scrolled into
    // view; false when this is just the observer reporting that the
    // user has already scrolled a new card into view on their own.
    _setActiveCard(card, shouldScroll) {
      var cards = this._cards();
      var index = cards.indexOf(card);
      if (index === -1) return;

      if (shouldScroll && typeof card.scrollIntoView === 'function') {
        card.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      }

      if (index === this._activeIndex) return;
      this._activeIndex = index;
      this._syncDots();
      this.emit('change', { index: index, card: card });
    }

    goTo(index) {
      var card = this._cards()[index];
      if (!card) return;
      this._setActiveCard(card, true);
    }

    next() {
      this.goTo(this._activeIndex + 1);
    }

    prev() {
      this.goTo(this._activeIndex - 1);
    }
  }

  window.LWT.define('lwtg-carousel', LWTCarousel);
})();
