(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-rive.js requires lwt-core.js to be loaded first.');
  }

  var RIVE_SRC = 'https://unpkg.com/@rive-app/canvas';
  var loaderPromise = null;

  // Shared across every <lwtg-rive> on the page -- only ever injects the
  // <script> tag once, and reuses one that was already there (whether we
  // added it or the page author did).
  function loadRiveRuntime() {
    if (window.rive && window.rive.Rive) return Promise.resolve(window.rive);
    if (loaderPromise) return loaderPromise;

    loaderPromise = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + RIVE_SRC + '"]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.rive); });
        existing.addEventListener('error', function () {
          reject(new Error('lwtg-rive: failed to load the Rive runtime script.'));
        });
        return;
      }
      var script = document.createElement('script');
      script.src = RIVE_SRC;
      script.async = true;
      script.addEventListener('load', function () { resolve(window.rive); });
      script.addEventListener('error', function () {
        reject(new Error('lwtg-rive: failed to load the Rive runtime script.'));
      });
      document.head.appendChild(script);
    });

    return loaderPromise;
  }

  function splitNames(value) {
    if (!value) return [];
    return value.indexOf(',') !== -1
      ? value.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
      : [value];
  }

  var CSS =
    ':host { display: block; position: relative; line-height: 0; }' +
    'canvas { display: block; width: 100%; height: 100%; }';

  var TEMPLATE = '<canvas part="canvas"></canvas>';

  class LWTRive extends window.LWT.Element {
    static get observedAttributes() {
      return ['src', 'state-machine', 'artboard', 'autoplay', 'fit', 'alignment', 'width', 'height', 'label', 'aria-label'];
    }

    constructor() {
      super();
      this.rive = null;
      this._inputs = [];
      this._loadToken = 0;
      this._onResize = this._onResize.bind(this);
    }

    connectedCallback() {
      super.connectedCallback();
      if (typeof ResizeObserver === 'function') {
        this._resizeObserver = new ResizeObserver(this._onResize);
        this._resizeObserver.observe(this);
      }
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._resizeObserver) this._resizeObserver.disconnect();
      this._teardown();
    }

    render() {
      this._renderShadow(TEMPLATE, CSS);
      this._canvas = this._root.querySelector('canvas');
      // The canvas is an image to assistive tech; it needs a name.
      this._canvas.setAttribute('role', 'img');
      this._canvas.setAttribute('aria-label', this._a11yName([this._strAttr('label', ''), this._strAttr('alt', '')],
        'Animation', 'Add a label attribute describing the animation'));

      var width = this._strAttr('width', '');
      var height = this._strAttr('height', '');
      this.style.width = width || '';
      this.style.height = height || '';

      this._init();
    }

    _teardown() {
      this._loadToken++; // invalidates any in-flight load meant for the previous config
      this._inputs = [];
      if (this.rive && typeof this.rive.cleanup === 'function') {
        try { this.rive.cleanup(); } catch (e) { /* already torn down */ }
      }
      this.rive = null;
    }

    _init() {
      this._teardown();

      var src = this._strAttr('src', '');
      if (!src || !this._canvas) return;

      var token = this._loadToken;
      var self = this;

      loadRiveRuntime().then(function (riveNs) {
        // Stale if the element was reconfigured/removed while we were
        // waiting on the (possibly shared, possibly network) load.
        if (token !== self._loadToken || !self.isConnected) return;

        var opts = {
          src: src,
          canvas: self._canvas,
          // Respect the visitor's reduced-motion setting (WCAG 2.2.2 /
          // 2.3.3): don't start animating on its own. .play() still works.
          autoplay: self._strAttr('autoplay', 'true') !== 'false' && !window.LWT.a11y.reducedMotion(),
          onLoad: function () {
            if (token !== self._loadToken) return; // superseded before this fired
            var instance = self.rive;
            if (instance && typeof instance.resizeDrawingSurfaceToCanvas === 'function') {
              instance.resizeDrawingSurfaceToCanvas();
            }
            self._inputs = self._collectInputs(instance);

            if (typeof self.onLoad === 'function') {
              try { self.onLoad(instance, self._inputs); } catch (e) { console.error(e); }
            }
            var onLoadFnName = self._strAttr('on-load', '');
            if (onLoadFnName && typeof window[onLoadFnName] === 'function') {
              try { window[onLoadFnName](instance, self._inputs); } catch (e) { console.error(e); }
            }
            self.emit('load', { rive: instance, inputs: self._inputs });
          },
          onLoadError: function (err) {
            self.emit('error', { error: err });
          }
        };

        var stateMachine = splitNames(self._strAttr('state-machine', ''));
        if (stateMachine.length === 1) opts.stateMachine = stateMachine[0];
        else if (stateMachine.length > 1) opts.stateMachine = stateMachine;

        var artboard = self._strAttr('artboard', '');
        if (artboard) opts.artboard = artboard;

        var fit = self._strAttr('fit', '');
        if (fit && riveNs.Layout && riveNs.Fit && riveNs.Fit[fit] !== undefined) {
          var alignmentName = self._strAttr('alignment', '');
          var layoutOpts = { fit: riveNs.Fit[fit] };
          if (alignmentName && riveNs.Alignment && riveNs.Alignment[alignmentName] !== undefined) {
            layoutOpts.alignment = riveNs.Alignment[alignmentName];
          }
          opts.layout = new riveNs.Layout(layoutOpts);
        }

        self.rive = new riveNs.Rive(opts);
      }).catch(function (err) {
        self.emit('error', { error: err });
      });
    }

    _collectInputs(instance) {
      if (!instance || typeof instance.stateMachineInputs !== 'function') return [];
      var names = splitNames(this._strAttr('state-machine', ''));
      var all = [];
      names.forEach(function (name) {
        var inputs = instance.stateMachineInputs(name) || [];
        all = all.concat(inputs);
      });
      return all;
    }

    _onResize() {
      if (this.rive && typeof this.rive.resizeDrawingSurfaceToCanvas === 'function') {
        this.rive.resizeDrawingSurfaceToCanvas();
      }
    }

    resize() {
      this._onResize();
    }

    getInput(name) {
      var found = this._inputs.filter(function (i) { return i.name === name; });
      return found.length ? found[0] : null;
    }
  }

  window.LWT.define('lwtg-rive', LWTRive);
})();
