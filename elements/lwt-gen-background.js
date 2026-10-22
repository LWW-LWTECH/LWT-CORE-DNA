/*!
 * <lwtg-background>
 * A full-bleed background that fills its parent (or the whole window when
 * placed directly in <body>) and sits behind the parent's other content,
 * so buttons, headings and forms can go on top. Holds an optional base
 * image plus any number of <lwtg-bglayer> children that move by different
 * amounts with the mouse and/or scroll position — stagger their `rate`
 * values and you get a parallax depth effect.
 *
 *   <section class="hero">
 *     <lwtg-background src="sky.jpg" trigger="mouse scroll" overlay="rgba(0,0,0,.25)">
 *       <lwtg-bglayer src="mountains.png" rate="0.2"></lwtg-bglayer>
 *       <lwtg-bglayer src="hills.png" rate="0.5"></lwtg-bglayer>
 *       <lwtg-bglayer src="trees.png" rate="1"></lwtg-bglayer>
 *     </lwtg-background>
 *     <h1>Content sits on top</h1>
 *   </section>
 *
 * Rate convention (one rule for mouse and scroll): higher rate = closer to
 * the viewer = moves more. 0 stays put; negative values move the other way.
 *
 * Placement: the element is position:absolute; inset:0 with z-index -1.
 * If the parent is position:static it is set to position:relative, and the
 * parent gets isolation:isolate so the background stays above the parent's
 * own background colour but below its content. Inside <body> it switches
 * to position:fixed (the `fixed` attribute) and covers the viewport.
 *
 * Attributes:
 *   src           base (lowest) image URL. Optional.
 *   color         base colour under everything (also --lwt-background-color).
 *   size          base image background-size. Default "cover".
 *   position      base image background-position. Default "center".
 *   overlay       colour or gradient laid over all layers, under the
 *                 content, e.g. "rgba(0,0,0,.35)" for text contrast
 *                 (also --lwt-background-overlay).
 *   trigger       "mouse" (default) | "scroll" | "mouse scroll" | "none".
 *   axis          mouse movement axis: "both" (default) | "x" | "y".
 *   depth         max mouse travel in px for a rate-1 layer. Default 40.
 *   scroll-speed  scroll multiplier: px moved = px scrolled x rate x this.
 *                 Default 0.3.
 *   smoothing     0-1, how quickly layers catch up with the mouse.
 *                 Default 0.08; 1 = instant.
 *   track         "window" (default): mouse position across the whole
 *                 window. "self": only while over this element; layers
 *                 drift back to centre when the mouse leaves.
 *   invert        boolean; layers move toward the mouse instead of away.
 *   rate          rate for the base image. Default 0 (static).
 *   fixed         boolean; cover the viewport (set automatically in <body>).
 *   label         accessible description; without it the element is
 *                 decorative (aria-hidden).
 *
 * Methods: refresh() — re-measure after layout changes.
 * Theming: --lwt-background-color, --lwt-background-overlay, --lwt-background-z.
 *
 * Users with "reduce motion" turned on get a still background.
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-background.js requires lwt-core.js to be loaded first.');
  }

  var CSS = `
    :host {
      position: absolute;
      inset: 0;
      display: block;
      overflow: hidden;
      z-index: var(--lwt-background-z, -1);
      pointer-events: none;
      background-color: var(--lwt-background-color, transparent);
    }
    :host([fixed]) { position: fixed; }
    :host([hidden]) { display: none; }
    .base, .overlay { position: absolute; inset: 0; }
    .move {
      position: absolute;
      top: calc(-1 * var(--lwt-bleed-top, 0px));
      bottom: calc(-1 * var(--lwt-bleed-bottom, 0px));
      left: calc(-1 * var(--lwt-bleed-x, 0px));
      right: calc(-1 * var(--lwt-bleed-x, 0px));
      background-repeat: no-repeat;
      will-change: transform;
    }
    .overlay { background: var(--lwt-background-overlay, none); }
  `;

  function num(value, fallback) {
    var n = parseFloat(value);
    return isNaN(n) ? fallback : n;
  }

  function cssUrl(src) {
    return 'url("' + String(src).replace(/"/g, '%22') + '")';
  }

  function reducedMotion() {
    return window.LWT.a11y && typeof window.LWT.a11y.reducedMotion === 'function'
      ? window.LWT.a11y.reducedMotion()
      : false;
  }

  class LWTBackground extends window.LWT.Element {
    static get observedAttributes() {
      return ['src', 'color', 'size', 'position', 'overlay', 'trigger', 'axis', 'depth',
              'scroll-speed', 'smoothing', 'track', 'invert', 'rate', 'label'];
    }

    constructor() {
      super();
      this._built = false;
      this._target = { x: 0, y: 0 };   // normalised pointer, -1..1
      this._pointer = { x: 0, y: 0 };  // smoothed pointer
      this._raf = 0;
      this._visible = true;
      this._listening = false;
      this._frame = this._frame.bind(this);
      this._onPointer = this._onPointer.bind(this);
      this._onLeave = this._onLeave.bind(this);
      this._onScroll = this._onScroll.bind(this);
      this._onResize = this._onResize.bind(this);
    }

    // ---- lifecycle ----

    connectedCallback() {
      this._prepareParent();
      super.connectedCallback();
      this._listen();
      this._layout();
      this._tick();
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this._unlisten();
    }

    render() {
      if (!this._built) {
        this._renderShadow(
          '<div class="base" part="base"><div class="move" part="base-image"></div></div>' +
          '<slot></slot>' +
          '<div class="overlay" part="overlay"></div>', CSS);
        this._baseMove = this._root.querySelector('.move');
        this._overlay = this._root.querySelector('.overlay');
        this._built = true;
      }

      var src = this._strAttr('src', '');
      var color = this._strAttr('color', '');
      this._baseMove.style.backgroundImage = src ? cssUrl(src) : 'none';
      this._baseMove.style.backgroundSize = this._strAttr('size', 'cover');
      this._baseMove.style.backgroundPosition = this._strAttr('position', 'center');
      this.style.backgroundColor = color || '';
      this._overlay.style.background = this._strAttr('overlay', '') || '';

      var label = this._strAttr('label', '');
      if (label) {
        this.setAttribute('role', 'img');
        this.setAttribute('aria-label', label);
        this.removeAttribute('aria-hidden');
      } else {
        this.removeAttribute('role');
        this.removeAttribute('aria-label');
        this.setAttribute('aria-hidden', 'true');
      }

      // Trigger / track changes need the listeners rewired.
      if (this.isConnected && this._listening) {
        this._unlisten();
        this._listen();
        this._layout();
        this._tick();
      }
    }

    // ---- public ----

    refresh() {
      this._layout();
      this._tick();
    }

    // ---- settings ----

    get _triggers() {
      var t = (this._strAttr('trigger', 'mouse') || '').toLowerCase();
      return { mouse: /\bmouse\b/.test(t), scroll: /\bscroll\b/.test(t) };
    }
    get _depth() { return num(this.getAttribute('depth'), 40); }
    get _scrollSpeed() { return num(this.getAttribute('scroll-speed'), 0.3); }
    get _smoothing() { return Math.min(1, Math.max(0.01, num(this.getAttribute('smoothing'), 0.08))); }
    get _isFixed() { return this.hasAttribute('fixed'); }

    _layers() {
      var out = [];
      for (var i = 0; i < this.children.length; i++) {
        var c = this.children[i];
        if (c.localName === 'lwtg-bglayer' && typeof c._lwtMoveEl === 'function' && !c.hidden) out.push(c);
      }
      return out;
    }

    // ---- placement ----

    _prepareParent() {
      var parent = this.parentElement;
      if (!parent) return;
      if (parent === document.body) {
        if (!this.hasAttribute('fixed')) this._setAutoAttr('fixed', '');
        return;
      }
      var cs = getComputedStyle(parent);
      if (cs.position === 'static') parent.style.position = 'relative';
      if (cs.isolation !== 'isolate') parent.style.isolation = 'isolate';
    }

    // ---- listeners ----

    _listen() {
      if (this._listening) return;
      this._listening = true;
      if (reducedMotion()) return; // still background, nothing to wire

      var t = this._triggers;
      if (t.mouse) {
        window.addEventListener('pointermove', this._onPointer, { passive: true });
        document.documentElement.addEventListener('pointerleave', this._onLeave);
        window.addEventListener('blur', this._onLeave);
      }
      if (t.scroll) window.addEventListener('scroll', this._onScroll, { passive: true });
      window.addEventListener('resize', this._onResize, { passive: true });

      if (typeof IntersectionObserver === 'function') {
        var self = this;
        this._io = new IntersectionObserver(function (entries) {
          self._visible = entries[entries.length - 1].isIntersecting;
          if (self._visible) self._tick();
        });
        this._io.observe(this);
      }
      // Size changes that aren't window resizes (a <details> opening, a
      // container growing) change how far cover layers must bleed.
      if (typeof ResizeObserver === 'function') {
        this._ro = new ResizeObserver(this._onResize);
        this._ro.observe(this);
      }
      // Layers added or removed later
      if (typeof MutationObserver === 'function') {
        this._mo = new MutationObserver(this._onResize);
        this._mo.observe(this, { childList: true });
      }
    }

    _unlisten() {
      this._listening = false;
      window.removeEventListener('pointermove', this._onPointer);
      document.documentElement.removeEventListener('pointerleave', this._onLeave);
      window.removeEventListener('blur', this._onLeave);
      window.removeEventListener('scroll', this._onScroll);
      window.removeEventListener('resize', this._onResize);
      if (this._io) { this._io.disconnect(); this._io = null; }
      if (this._mo) { this._mo.disconnect(); this._mo = null; }
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
    }

    _onPointer(e) {
      if (e.pointerType === 'touch') return; // a finger drag shouldn't swing the scene
      var x, y;
      if (this._strAttr('track', 'window') === 'self') {
        var r = this.getBoundingClientRect();
        var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside || !r.width || !r.height) { this._onLeave(); return; }
        x = ((e.clientX - r.left) / r.width) * 2 - 1;
        y = ((e.clientY - r.top) / r.height) * 2 - 1;
      } else {
        x = (e.clientX / window.innerWidth) * 2 - 1;
        y = (e.clientY / window.innerHeight) * 2 - 1;
      }
      this._target.x = Math.max(-1, Math.min(1, x));
      this._target.y = Math.max(-1, Math.min(1, y));
      this._tick();
    }

    _onLeave() {
      this._target.x = 0;
      this._target.y = 0;
      this._tick();
    }

    _onScroll() { this._tick(); }

    _onResize() {
      this._layout();
      this._tick();
    }

    // ---- motion ----

    // Scroll distance in px. Page mode: how far the page has scrolled.
    // Container mode: how far the element's centre is above the viewport's
    // centre (0 when centred, so layers line up where they're seen most).
    _scrollDistance() {
      if (this._isFixed) return window.scrollY || window.pageYOffset || 0;
      var r = this.getBoundingClientRect();
      return window.innerHeight / 2 - (r.top + r.height / 2);
    }

    _offset(mouseRate, scrollRate, axis, d) {
      var t = this._triggers;
      var x = 0, y = 0;
      if (t.mouse && mouseRate) {
        var dir = this.hasAttribute('invert') ? 1 : -1;
        var travel = this._depth * mouseRate * dir;
        if (axis !== 'y') x += this._pointer.x * travel;
        if (axis !== 'x') y += this._pointer.y * travel;
      }
      if (t.scroll && scrollRate) y += -d * scrollRate * this._scrollSpeed;
      return 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
    }

    _tick() {
      if (!this._raf && this.isConnected) this._raf = requestAnimationFrame(this._frame);
    }

    _frame() {
      this._raf = 0;
      if (reducedMotion()) return;

      var s = this._smoothing, p = this._pointer, t = this._target;
      p.x += (t.x - p.x) * s;
      p.y += (t.y - p.y) * s;
      var settling = Math.abs(t.x - p.x) > 0.0005 || Math.abs(t.y - p.y) > 0.0005;
      if (!settling) { p.x = t.x; p.y = t.y; }

      if (this._visible) {
        var axis = this._strAttr('axis', 'both');
        var d = this._triggers.scroll ? this._scrollDistance() : 0;
        var baseRate = num(this.getAttribute('rate'), 0);
        this._baseMove.style.transform = baseRate ? this._offset(baseRate, baseRate, axis, d) : '';

        var self = this;
        this._layers().forEach(function (layer) {
          layer._lwtMoveEl().style.transform =
            self._offset(layer._lwtMouseRate(), layer._lwtScrollRate(), layer._lwtAxis(axis), d);
        });
      }
      if (settling) this._tick();
    }

    // Enlarges every "cover" image just enough that the furthest it can
    // travel never reveals an empty edge.
    _bleedFor(mouseRate, scrollRate, axis, hostHeight) {
      var t = this._triggers;
      var b = { x: 0, top: 0, bottom: 0 };
      if (t.mouse && mouseRate) {
        var m = Math.abs(this._depth * mouseRate);
        if (axis !== 'y') b.x = m;
        if (axis !== 'x') { b.top = m; b.bottom = m; }
      }
      if (t.scroll && scrollRate) {
        if (this._isFixed) {
          // Page mode only ever scrolls one way, so only one edge needs cover.
          var s = Math.max(0, document.documentElement.scrollHeight - window.innerHeight) * scrollRate * this._scrollSpeed;
          if (s > 0) b.bottom += s; else b.top += -s;
        } else {
          var c = Math.abs((window.innerHeight + hostHeight) / 2 * scrollRate * this._scrollSpeed);
          b.top += c; b.bottom += c;
        }
      }
      b.x = Math.ceil(b.x); b.top = Math.ceil(b.top); b.bottom = Math.ceil(b.bottom);
      return b;
    }

    _layout() {
      if (!this._built) return;
      var still = reducedMotion();
      var h = this.getBoundingClientRect().height;
      var axis = this._strAttr('axis', 'both');

      var baseRate = num(this.getAttribute('rate'), 0);
      var baseCover = this._strAttr('size', 'cover') === 'cover';
      var none = { x: 0, top: 0, bottom: 0 };
      var b = still || !baseCover ? none : this._bleedFor(baseRate, baseRate, axis, h);
      this._baseMove.style.setProperty('--lwt-bleed-x', b.x + 'px');
      this._baseMove.style.setProperty('--lwt-bleed-top', b.top + 'px');
      this._baseMove.style.setProperty('--lwt-bleed-bottom', b.bottom + 'px');

      var self = this;
      this._layers().forEach(function (layer) {
        var lb;
        var manual = layer.getAttribute('bleed');
        if (manual !== null && manual !== '') {
          var v = num(manual, 0);
          lb = { x: v, top: v, bottom: v };
        } else if (still || !layer._lwtCover()) {
          lb = none;
        } else {
          lb = self._bleedFor(layer._lwtMouseRate(), layer._lwtScrollRate(), layer._lwtAxis(axis), h);
        }
        layer._lwtSetBleed(lb);
        if (still) layer._lwtMoveEl().style.transform = '';
      });
    }
  }

  window.LWT.define('lwtg-background', LWTBackground);
})();


/*!
 * <lwtg-bglayer>
 * One moving layer inside <lwtg-background>. Usually a transparent PNG or
 * SVG (mountains, clouds, foliage), but it can also hold any HTML in its
 * default slot. Layers stack in source order: first is furthest back.
 *
 *   <lwtg-background src="sky.jpg" trigger="mouse scroll">
 *     <lwtg-bglayer src="far-hills.png" rate="0.2"></lwtg-bglayer>
 *     <lwtg-bglayer src="trees.png" rate="0.8" position="bottom center"></lwtg-bglayer>
 *   </lwtg-background>
 *
 * Attributes:
 *   src          image URL. Optional when the layer holds HTML instead.
 *   size         background-size. Default "cover".
 *   position     background-position. Default "center".
 *   repeat       background-repeat. Default "no-repeat".
 *   rate         how much this layer moves; higher = closer to the viewer.
 *                Default 1. Negative values move the other way.
 *   mouse-rate   overrides `rate` for mouse movement only.
 *   scroll-rate  overrides `rate` for scroll movement only.
 *   axis         "both" | "x" | "y"; overrides the background's axis.
 *   opacity      0-1.
 *   blend        mix-blend-mode, e.g. "screen", "multiply".
 *   bleed        px the layer extends past each edge. Automatic for
 *                size="cover" (just enough to hide the edges while it
 *                moves); 0 otherwise, so bottom-aligned art stays put.
 *
 * Requires lwt-core.js, and <lwtg-background> as its parent.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-bglayer.js requires lwt-core.js to be loaded first.');
  }

  var CSS = `
    :host {
      position: absolute;
      inset: 0;
      display: block;
      pointer-events: none;
    }
    :host([hidden]) { display: none; }
    .move {
      position: absolute;
      top: calc(-1 * var(--lwt-bleed-top, 0px));
      bottom: calc(-1 * var(--lwt-bleed-bottom, 0px));
      left: calc(-1 * var(--lwt-bleed-x, 0px));
      right: calc(-1 * var(--lwt-bleed-x, 0px));
      will-change: transform;
    }
    .img { position: absolute; inset: 0; }
  `;

  function num(value, fallback) {
    var n = parseFloat(value);
    return isNaN(n) ? fallback : n;
  }

  class LWTBgLayer extends window.LWT.Element {
    static get observedAttributes() {
      return ['src', 'size', 'position', 'repeat', 'rate', 'mouse-rate', 'scroll-rate',
              'axis', 'opacity', 'blend', 'bleed'];
    }

    constructor() {
      super();
      this._built = false;
    }

    render() {
      if (!this._built) {
        this._renderShadow('<div class="move" part="layer"><div class="img" part="image"></div><slot></slot></div>', CSS);
        this._move = this._root.querySelector('.move');
        this._img = this._root.querySelector('.img');
        this._built = true;
      }

      var src = this._strAttr('src', '');
      this._img.style.backgroundImage = src ? 'url("' + src.replace(/"/g, '%22') + '")' : 'none';
      this._img.style.backgroundSize = this._strAttr('size', 'cover');
      this._img.style.backgroundPosition = this._strAttr('position', 'center');
      this._img.style.backgroundRepeat = this._strAttr('repeat', 'no-repeat');

      var opacity = this._strAttr('opacity', '');
      this._move.style.opacity = opacity;
      this.style.mixBlendMode = this._strAttr('blend', '');

      this.setAttribute('aria-hidden', 'true');

      // Rate / size changes alter how far the layer must bleed.
      var parent = this.parentElement;
      if (parent && typeof parent.refresh === 'function' && parent.localName === 'lwtg-background') {
        parent.refresh();
      }
    }

    // ---- used by <lwtg-background> ----
    _lwtMoveEl() { return this._move; }
    _lwtMouseRate() { return num(this.getAttribute('mouse-rate'), num(this.getAttribute('rate'), 1)); }
    _lwtScrollRate() { return num(this.getAttribute('scroll-rate'), num(this.getAttribute('rate'), 1)); }
    _lwtAxis(fallback) { return this._strAttr('axis', fallback); }
    _lwtCover() { return this._strAttr('size', 'cover') === 'cover'; }
    _lwtSetBleed(b) {
      this._move.style.setProperty('--lwt-bleed-x', b.x + 'px');
      this._move.style.setProperty('--lwt-bleed-top', b.top + 'px');
      this._move.style.setProperty('--lwt-bleed-bottom', b.bottom + 'px');
    }
  }

  window.LWT.define('lwtg-bglayer', LWTBgLayer);
})();
