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
      return ['src', 'state-machine', 'artboard', 'autoplay', 'fit', 'alignment', 'width', 'height', 'label', 'aria-label', 'auto-bind'];
    }

    constructor() {
      super();
      this.rive = null;
      this._inputs = null; // state machine inputs, read lazily (deprecated Rive API)
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
      this._inputs = null;
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
          // Data binding (Rive's replacement for state machine inputs):
          // bind the file's default view model instance automatically.
          // Harmless for files without view models. auto-bind="false" opts out.
          autoBind: self._strAttr('auto-bind', 'true') !== 'false',
          onLoad: function () {
            if (token !== self._loadToken) return; // superseded before this fired
            var instance = self.rive;
            if (instance && typeof instance.resizeDrawingSurfaceToCanvas === 'function') {
              instance.resizeDrawingSurfaceToCanvas();
            }
            // State machine inputs are NOT read here any more: touching
            // them makes Rive log a deprecation warning on every load.
            // They're read lazily only if your code asks for them.
            self._inputs = null;
            var viewModel = self.viewModel;

            if (typeof self.onLoad === 'function') self._callOnLoad(self.onLoad, instance, viewModel);
            var onLoadFnName = self._strAttr('on-load', '');
            if (onLoadFnName && typeof window[onLoadFnName] === 'function') {
              self._callOnLoad(window[onLoadFnName], instance, viewModel);
            }

            var detail = { rive: instance, viewModel: viewModel };
            // Kept for backwards compatibility; only collected if accessed.
            Object.defineProperty(detail, 'inputs', { get: function () { return self._getInputs(); }, enumerable: false });
            self.emit('load', detail);
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

    // onLoad callbacks: function (rive, inputs) still works -- the inputs
    // array is only built when the callback actually declares a second
    // parameter, so callbacks that only use `rive` never touch the
    // deprecated API. A third parameter receives the bound view model.
    _callOnLoad(fn, instance, viewModel) {
      try {
        if (fn.length >= 2) fn.call(this, instance, this._getInputs(), viewModel);
        else fn.call(this, instance);
      } catch (e) { console.error(e); }
    }

    _getInputs() {
      if (this._inputs === null) this._inputs = this._collectInputs(this.rive);
      return this._inputs;
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

    // Deprecated by Rive (state machine inputs) -- prefer setValue()/fire().
    getInput(name) {
      var found = this._getInputs().filter(function (i) { return i.name === name; });
      return found.length ? found[0] : null;
    }

    // ---- data binding (view model) API ----

    // The bound view model instance (auto-bound on load), or null when the
    // file has no view model or hasn't loaded yet.
    get viewModel() {
      return (this.rive && this.rive.viewModelInstance) || null;
    }

    // Finds a view model property by name or slash path ("Nested/Prop").
    // `kinds` limits which property types to try, in order.
    _property(path, kinds) {
      var vmi = this.viewModel;
      if (!vmi || !path) return null;
      var declared = this._declaredType(path);
      var order = declared ? [declared] : (kinds || ['number', 'boolean', 'string', 'enum', 'color', 'trigger']);
      for (var i = 0; i < order.length; i++) {
        var kind = order[i];
        if (typeof vmi[kind] !== 'function') continue;
        try {
          var prop = vmi[kind](path);
          if (prop) return { prop: prop, kind: kind };
        } catch (e) { /* not this type -- try the next */ }
      }
      return null;
    }

    // Uses the view model's property list (when available) to know a
    // top-level property's type up front instead of guessing.
    _declaredType(path) {
      if (path.indexOf('/') !== -1 || !this.rive || typeof this.rive.defaultViewModel !== 'function') return null;
      var vm;
      try { vm = this.rive.defaultViewModel(); } catch (e) { return null; }
      var props = vm && vm.properties;
      if (!props || !props.length) return null;
      var match = props.filter(function (p) { return p && p.name === path; })[0];
      if (!match) return null;
      var t = String(match.type).toLowerCase();
      var kinds = ['boolean', 'number', 'string', 'enum', 'color', 'trigger'];
      for (var i = 0; i < kinds.length; i++) if (t.indexOf(kinds[i]) !== -1) return kinds[i];
      return null;
    }

    // Sets a value: view model property if the file has one by that name,
    // else falls back to a state machine input of the same name (older
    // files). Returns true if something was set.
    setValue(path, value) {
      var kinds = typeof value === 'boolean' ? ['boolean']
        : typeof value === 'number' ? ['number', 'color']
        : ['string', 'enum'];
      var found = this._property(path, kinds);
      if (found && found.kind !== 'trigger') { found.prop.value = value; return true; }
      var input = this.viewModel ? null : this.getInput(path);
      if (input && 'value' in input) { input.value = value; return true; }
      return false;
    }

    getValue(path) {
      var found = this._property(path);
      if (found && found.kind !== 'trigger') return found.prop.value;
      var input = this.viewModel ? null : this.getInput(path);
      return input && 'value' in input ? input.value : undefined;
    }

    // Fires a trigger property (or, for older files, a trigger input).
    fire(path) {
      var found = this._property(path, ['trigger']);
      if (found && typeof found.prop.trigger === 'function') { found.prop.trigger(); return true; }
      var input = this.viewModel ? null : this.getInput(path);
      if (input && typeof input.fire === 'function') { input.fire(); return true; }
      return false;
    }

    // Calls callback(value) whenever the property changes (triggers call it
    // with no value). Returns a function that stops observing.
    observe(path, callback) {
      var found = this._property(path);
      if (!found || typeof found.prop.on !== 'function') return function () {};
      var prop = found.prop;
      var handler = function (event) { callback(event && 'data' in event ? event.data : prop.value); };
      prop.on(handler);
      return function () { if (typeof prop.off === 'function') prop.off(handler); };
    }
  }

  window.LWT.define('lwtg-rive', LWTRive);
})();
