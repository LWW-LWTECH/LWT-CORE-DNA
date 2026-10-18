/*!
 * <lwtf-dropzone>
 * A drag-and-drop file picker that works like a native
 * <input type="file"> inside a standard <form>. Drop files on the zone
 * (or click it / press Enter or Space to open the file browser) and each
 * accepted file appears in a list below: a thumbnail (images) or file
 * icon, the file name and a readable size, an optional upload progress
 * bar, and a remove button. Invalid files are skipped -- never added to
 * the list -- and the reason is shown in an inline message under the zone.
 *
 *   <form method="post" enctype="multipart/form-data">
 *     <lwtf-dropzone label="Upload your files" name="attachments"
 *       accept="jpg, png, pdf" max-size="26214400" multiple required>
 *     </lwtf-dropzone>
 *   </form>
 *
 * NOTE: a normal (non-JS) form post only sends file contents when the
 * <form> has enctype="multipart/form-data". new FormData(form) always
 * includes them.
 *
 * ---------------------------------------------------------------------
 * Attributes
 * ---------------------------------------------------------------------
 *   label, helper, error — display basics (label shows above the zone)
 *   name         — form field name; every file is submitted under it
 *   accept       — comma separated list of accepted types. Extensions
 *                  with or without the dot ("jpg", ".pdf") and MIME types
 *                  ("image/*", "application/pdf") both work. jpg/jpeg and
 *                  tif/tiff count as the same type. When set, a hint
 *                  under the zone reads "Accepted: JPG, PNG, PDF".
 *   max-size     — maximum size per file, in bytes. When set, the hint
 *                  adds "Maximum file size: 25 MB" (1024 bytes per KB).
 *   multiple     — allow more than one file. Without it the list holds
 *                  one file and a new file replaces the current one.
 *   required     — at least one file must be in the list (standard form
 *                  validation: checkValidity / reportValidity / submit).
 *   disabled     — the zone can't be tabbed to, drops and clicks are
 *                  ignored, and remove buttons are disabled. A disabled
 *                  <fieldset> does the same, and a disabled dropzone is
 *                  left out of the submitted data.
 *   zone-text    — text inside the zone (default "Drop files here or
 *                  click to browse")
 *   list-label   — heading over the file list (default "Uploaded files");
 *                  the file count is added automatically: "Uploaded files (3)"
 *
 * Skipped (never added): files that aren't an accepted type, files over
 * max-size, a file whose name is already in the list, and folders. When
 * `multiple` is off and several files are dropped, only the first valid
 * one is kept.
 *
 * ---------------------------------------------------------------------
 * Properties / methods
 * ---------------------------------------------------------------------
 *   .files / .value       — array of the File objects in the list (read-only)
 *   .name, .form          — field name and owning <form>
 *   .addFiles(fileList)   — add files from code (same rules as a drop)
 *   .removeFile(file)     — remove one file (File object or file name)
 *   .clear()              — remove every file (form.reset() does this too)
 *   .setProgress(file, percent)
 *                         — show/animate that row's progress bar (0-100).
 *                           The bar stays hidden until this is first called.
 *   .setStatus(file, status, message)
 *                         — status: 'done' (bar fills, turns success color)
 *                           | 'error' (bar turns danger color, optional
 *                           message under the name) | '' (back to normal)
 *   .checkValidity() / .reportValidity()
 *
 *   Upload example (XMLHttpRequest reports upload progress; fetch doesn't):
 *     dz.files.forEach(function (file) {
 *       var xhr = new XMLHttpRequest(), body = new FormData();
 *       body.append('file', file);
 *       xhr.upload.onprogress = function (e) {
 *         if (e.lengthComputable) dz.setProgress(file, e.loaded / e.total * 100);
 *       };
 *       xhr.onload = function () { dz.setStatus(file, xhr.status < 300 ? 'done' : 'error', 'Upload failed'); };
 *       xhr.open('POST', '/upload'); xhr.send(body);
 *     });
 *
 * ---------------------------------------------------------------------
 * Events (each also available with the plain name where noted)
 * ---------------------------------------------------------------------
 *   lwt-change (+ change) — the list changed; detail: { files }
 *   lwt-add     — files were added; detail: { added, files }
 *   lwt-remove  — a file was removed; detail: { file, files }
 *   lwt-reject  — files were skipped; detail: { rejected: [{ name, reason, message }] }
 *                 reason: 'type' | 'size' | 'duplicate' | 'folder' | 'single'
 *
 * ---------------------------------------------------------------------
 * Accessibility
 * ---------------------------------------------------------------------
 * The zone is a keyboard-focusable button (Enter / Space opens the file
 * browser). Tab order: the zone, then each row's remove button. Removing
 * a row returns focus to the zone. Added files, skipped files and
 * removals are announced to screen readers; progress bars are
 * role="progressbar". Image thumbnails' object URLs are released when
 * their row is removed.
 *
 * ---------------------------------------------------------------------
 * Theming (CSS variables, all optional)
 * ---------------------------------------------------------------------
 *   --lwt-dropzone-bg, --lwt-dropzone-color, --lwt-dropzone-border,
 *   --lwt-dropzone-radius, --lwt-dropzone-padding, --lwt-dropzone-min-height,
 *   --lwt-dropzone-gap, --lwt-dropzone-hover-bg, --lwt-dropzone-accent
 *   (drag-over), --lwt-dropzone-dropped-color, --lwt-dropzone-focus-color,
 *   --lwt-dropzone-hint-color, --lwt-dropzone-error-color,
 *   --lwt-dropzone-list-label-color, --lwt-dropzone-visible-rows (3),
 *   --lwt-dropzone-row-height, --lwt-dropzone-row-gap,
 *   --lwt-dropzone-thumb-size, --lwt-dropzone-thumb-radius,
 *   --lwt-dropzone-progress-height, --lwt-dropzone-progress-track,
 *   --lwt-dropzone-progress-color, --lwt-dropzone-progress-done-color,
 *   --lwt-dropzone-remove-color
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-frm-dropzone.js requires lwt-core.js to be loaded first.');
  }

  var supportsInternals = typeof HTMLElement !== 'undefined' && !!HTMLElement.prototype.attachInternals;
  var DROPPED_MS = 1000;

  // Extensions that count as the same type.
  var EXT_ALIASES = { jpg: ['jpg', 'jpeg'], jpeg: ['jpg', 'jpeg'], tif: ['tif', 'tiff'], tiff: ['tif', 'tiff'] };

  // Friendly hint labels for common MIME types.
  var MIME_LABELS = {
    'image/*': 'Images', 'video/*': 'Videos', 'audio/*': 'Audio', 'text/*': 'Text files',
    'application/pdf': 'PDF', 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/gif': 'GIF',
    'image/webp': 'WEBP', 'image/svg+xml': 'SVG', 'text/csv': 'CSV', 'text/plain': 'TXT'
  };

  var ICON_UPLOAD =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
  var ICON_FILE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  var ICON_REMOVE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  // 1024 bytes per KB. "85.5 KB", "25 MB", "512 B".
  function formatSize(bytes) {
    var units = ['B', 'KB', 'MB', 'GB', 'TB'];
    var n = Number(bytes) || 0, i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    var txt = i === 0 ? String(Math.round(n)) : (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '');
    return txt + ' ' + units[i];
  }

  function extOf(name) {
    var i = String(name).lastIndexOf('.');
    return i > 0 ? String(name).slice(i + 1).toLowerCase() : '';
  }

  // "jpg, .PNG, image/*" -> [{ kind:'ext', exts:['jpg','jpeg'], label:'JPG' }, ...]
  function parseAccept(str) {
    var rules = [];
    var seenLabels = {};
    String(str || '').split(',').forEach(function (raw) {
      var token = raw.trim().toLowerCase();
      if (!token) return;
      var rule;
      if (token.indexOf('/') !== -1) {
        rule = { kind: 'mime', mime: token, label: MIME_LABELS[token] || token.split('/')[1].replace(/^\*$/, token.split('/')[0]).toUpperCase() };
      } else {
        var ext = token.replace(/^\./, '');
        rule = { kind: 'ext', exts: EXT_ALIASES[ext] || [ext], label: ext === 'jpeg' ? 'JPG' : ext === 'tiff' ? 'TIF' : ext.toUpperCase() };
      }
      rules.push(rule);
      seenLabels[rule.label] = true;
    });
    rules.labels = Object.keys(seenLabels);
    return rules;
  }

  // Value for the hidden native input's accept attribute (aliases expanded).
  function nativeAccept(rules) {
    var out = [];
    rules.forEach(function (r) {
      if (r.kind === 'mime') out.push(r.mime);
      else r.exts.forEach(function (e) { out.push('.' + e); });
    });
    return out.join(',');
  }

  function matchesAccept(file, rules) {
    if (!rules.length) return true;
    var ext = extOf(file.name);
    var type = String(file.type || '').toLowerCase();
    return rules.some(function (r) {
      if (r.kind === 'ext') return r.exts.indexOf(ext) !== -1;
      if (r.mime.slice(-2) === '/*') return type.indexOf(r.mime.slice(0, -1)) === 0;
      return type === r.mime;
    });
  }

  var CSS = `
    :host { display: block; font-family: inherit; color: var(--lwt-dropzone-color, var(--lwt-color-text, #374151)); }
    :host([hidden]) { display: none; }
    * { box-sizing: border-box; }
    .field-label {
      display: flex;
      gap: 0.2rem;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 0.4rem;
      color: var(--lwt-dropzone-label-color, var(--lwt-color-text-strong, #111827));
    }
    .field-label[hidden] { display: none; }
    .required-mark { color: var(--lwt-dropzone-error-color, var(--lwt-color-danger, #ef4444)); }
    .zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--lwt-dropzone-gap, var(--lwt-gap, 0.5rem));
      min-height: var(--lwt-dropzone-min-height, 8rem);
      padding: var(--lwt-dropzone-padding, 1.5rem 1rem);
      text-align: center;
      cursor: pointer;
      user-select: none;
      background: var(--lwt-dropzone-bg, var(--lwt-color-surface, #fff));
      border: var(--lwt-dropzone-border, 2px dashed var(--lwt-border-color, #d1d5db));
      border-radius: var(--lwt-dropzone-radius, var(--lwt-border-radius, 8px));
      transition: background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
    }
    .zone:hover { background: var(--lwt-dropzone-hover-bg, color-mix(in srgb, var(--lwt-dropzone-accent, var(--lwt-primary, #2563eb)) 4%, var(--lwt-dropzone-bg, var(--lwt-color-surface, #fff)))); }
    .zone:focus-visible {
      outline: 2px solid var(--lwt-dropzone-focus-color, var(--lwt-focus-color, #2563eb));
      outline-offset: 2px;
    }
    .zone-icon { width: 2rem; height: 2rem; color: var(--lwt-dropzone-icon-color, var(--lwt-icon-color, #6b7280)); }
    .zone-icon svg { width: 100%; height: 100%; display: block; }
    .zone-text { font-size: 0.92rem; }
    /* Drag-over: a file is being held over the zone. */
    .zone.dragover {
      border-color: var(--lwt-dropzone-accent, var(--lwt-primary, #2563eb));
      background: color-mix(in srgb, var(--lwt-dropzone-accent, var(--lwt-primary, #2563eb)) 10%, var(--lwt-dropzone-bg, var(--lwt-color-surface, #fff)));
    }
    .zone.dragover .zone-icon { color: var(--lwt-dropzone-accent, var(--lwt-primary, #2563eb)); }
    /* Dropped: brief confirmation after files were added (about 1s). */
    .zone.dropped {
      border-color: var(--lwt-dropzone-dropped-color, var(--lwt-success, #10b981));
      background: color-mix(in srgb, var(--lwt-dropzone-dropped-color, var(--lwt-success, #10b981)) 12%, var(--lwt-dropzone-bg, var(--lwt-color-surface, #fff)));
    }
    .zone.dropped .zone-icon { color: var(--lwt-dropzone-dropped-color, var(--lwt-success, #10b981)); }
    :host([disabled]) .zone, .zone[aria-disabled="true"] { cursor: not-allowed; opacity: 0.55; }
    .file-input { display: none; }
    .hints, .message, .helper { font-size: 0.8rem; margin-top: 0.4rem; }
    .hints { color: var(--lwt-dropzone-hint-color, var(--lwt-color-text-muted, #6b7280)); }
    .hints:empty, .message:empty, .helper:empty { display: none; }
    .message, .helper.error { color: var(--lwt-dropzone-error-color, var(--lwt-color-danger, #b91c1c)); }
    .helper { color: var(--lwt-dropzone-hint-color, var(--lwt-color-text-muted, #6b7280)); }
    .list-wrap { margin-top: 1rem; }
    .list-wrap[hidden] { display: none; }
    .list-label {
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--lwt-dropzone-list-label-color, var(--lwt-color-text-strong, #111827));
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--lwt-dropzone-row-gap, 0.5rem);
      overflow-y: auto;
      /* Show N rows, then scroll. */
      max-height: calc(var(--lwt-dropzone-visible-rows, 3) * var(--lwt-dropzone-row-height, 3.5rem) + (var(--lwt-dropzone-visible-rows, 3) - 1) * var(--lwt-dropzone-row-gap, 0.5rem));
    }
    .item {
      display: grid;
      grid-template-columns: var(--lwt-dropzone-thumb-size, 3rem) minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.75rem;
      flex: 0 0 auto;
      min-height: var(--lwt-dropzone-row-height, 3.5rem);
    }
    .thumb {
      width: var(--lwt-dropzone-thumb-size, 3rem);
      height: var(--lwt-dropzone-thumb-size, 3rem);
      border-radius: var(--lwt-dropzone-thumb-radius, var(--lwt-border-radius, 6px));
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--lwt-dropzone-thumb-bg, var(--lwt-color-surface-muted, #f3f4f6));
      color: var(--lwt-dropzone-icon-color, var(--lwt-icon-color, #6b7280));
    }
    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .thumb svg { width: 55%; height: 55%; }
    .info { min-width: 0; display: flex; flex-direction: column; gap: 0.3rem; }
    .meta { display: flex; align-items: baseline; gap: 0.4rem; min-width: 0; font-size: 0.88rem; }
    .file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
    .file-size { flex-shrink: 0; font-weight: 600; color: var(--lwt-dropzone-size-color, var(--lwt-color-text-muted, #6b7280)); }
    .progress {
      height: var(--lwt-dropzone-progress-height, 4px);
      border-radius: 999px;
      overflow: hidden;
      background: var(--lwt-dropzone-progress-track, var(--lwt-border-color, #e5e7eb));
    }
    .progress[hidden] { display: none; }
    .progress-fill {
      display: block;
      height: 100%;
      width: 0%;
      border-radius: inherit;
      background: var(--lwt-dropzone-progress-color, var(--lwt-primary, #2563eb));
      transition: width 200ms ease, background-color 200ms ease;
    }
    .item.done .progress-fill { background: var(--lwt-dropzone-progress-done-color, var(--lwt-success, #10b981)); }
    .item.error .progress-fill { background: var(--lwt-dropzone-error-color, var(--lwt-color-danger, #ef4444)); }
    .row-status { font-size: 0.75rem; color: var(--lwt-dropzone-error-color, var(--lwt-color-danger, #b91c1c)); }
    .row-status:empty { display: none; }
    .remove {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      min-height: 24px;
      padding: 0.2rem;
      border: none;
      background: none;
      cursor: pointer;
      color: var(--lwt-dropzone-remove-color, var(--lwt-color-danger, #ef4444));
      border-radius: var(--lwt-border-radius, 4px);
    }
    .remove svg { width: 1rem; height: 1rem; }
    .remove:hover:not(:disabled) { background: color-mix(in srgb, currentColor 10%, transparent); }
    .remove:focus-visible {
      outline: 2px solid var(--lwt-dropzone-focus-color, var(--lwt-focus-color, #2563eb));
      outline-offset: 1px;
    }
    .remove:disabled { cursor: not-allowed; opacity: 0.45; }
    @media (prefers-reduced-motion: reduce) {
      .zone, .progress-fill { transition: none; }
    }
  `;

  var TEMPLATE =
    '<div class="field-label" part="label"><span class="label-text"></span><span class="required-mark" aria-hidden="true" hidden>*</span></div>' +
    '<div class="zone" part="zone" role="button" tabindex="0">' +
    '  <span class="zone-icon" part="zone-icon">' + ICON_UPLOAD + '</span>' +
    '  <span class="zone-text" part="zone-text"></span>' +
    '</div>' +
    '<input class="file-input" type="file" tabindex="-1" aria-hidden="true">' +
    '<div class="hints" part="hints"></div>' +
    '<div class="message" part="message"></div>' +
    '<div class="helper" part="helper"></div>' +
    '<div class="list-wrap" part="list-wrap" hidden>' +
    '  <div class="list-label" part="list-label"></div>' +
    '  <ul class="list" part="list"></ul>' +
    '</div>';

  class LWTDropzone extends window.LWT.Element {
    static get formAssociated() { return true; }

    static get observedAttributes() {
      return ['label', 'helper', 'error', 'name', 'accept', 'max-size', 'multiple', 'required', 'disabled',
              'zone-text', 'list-label', 'aria-label', 'aria-labelledby'];
    }

    constructor() {
      super();
      this._internals = null;
      if (supportsInternals) {
        try { this._internals = this.attachInternals(); }
        catch (e) { this._internals = null; }
      }
      this._items = [];          // [{ file, url, row, bar, fill, status }]
      this._dragDepth = 0;       // dragenter/leave counter (children fire their own)
      this._droppedTimer = null;
      this._formDisabled = false;
      this._rules = [];
    }

    connectedCallback() {
      super.connectedCallback();
      this.setAttribute('control-type', 'file');
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      clearTimeout(this._droppedTimer);
    }

    // Attribute changes update in place -- re-rendering would lose the
    // list, thumbnails, progress and focus.
    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (this._zone) this._syncAttrs();
    }

    render() {
      if (this._zone) { this._syncAttrs(); return; } // already built (reconnect)
      this._renderShadow(TEMPLATE, CSS);
      var root = this._root;
      var a11y = window.LWT.a11y;
      this._labelEl = root.querySelector('.field-label');
      this._labelText = root.querySelector('.label-text');
      this._requiredMark = root.querySelector('.required-mark');
      this._zone = root.querySelector('.zone');
      this._zoneText = root.querySelector('.zone-text');
      this._input = root.querySelector('.file-input');
      this._hintsEl = root.querySelector('.hints');
      this._messageEl = root.querySelector('.message');
      this._helperEl = root.querySelector('.helper');
      this._listWrap = root.querySelector('.list-wrap');
      this._listLabel = root.querySelector('.list-label');
      this._list = root.querySelector('.list');

      this._labelText.id = a11y.uid('lwt-dz-label');
      this._zoneText.id = a11y.uid('lwt-dz-text');
      this._hintsEl.id = a11y.uid('lwt-dz-hints');
      this._messageEl.id = a11y.uid('lwt-dz-msg');
      this._helperEl.id = a11y.uid('lwt-dz-helper');
      this._listLabel.id = a11y.uid('lwt-dz-list');
      this._list.setAttribute('aria-labelledby', this._listLabel.id);
      this._zone.setAttribute('aria-describedby', [this._hintsEl.id, this._messageEl.id, this._helperEl.id].join(' '));

      var self = this;
      this._zone.addEventListener('click', function () { self._openPicker(); });
      this._zone.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self._openPicker(); }
      });
      this._zone.addEventListener('dragenter', function (e) { self._onDragEnter(e); });
      this._zone.addEventListener('dragover', function (e) { self._onDragOver(e); });
      this._zone.addEventListener('dragleave', function () { self._onDragLeave(); });
      this._zone.addEventListener('drop', function (e) { self._onDrop(e); });
      this._input.addEventListener('change', function () {
        var files = Array.prototype.slice.call(self._input.files || []);
        self._input.value = ''; // so picking the same file again still fires change
        if (files.length) self._handleIncoming(files, []);
      });

      this._syncAttrs();
    }

    // ---- attributes -> DOM ----
    _syncAttrs() {
      var label = this._strAttr('label', '');
      var helper = this._strAttr('helper', '');
      var error = this._strAttr('error', '');
      var multiple = this._boolAttr('multiple');
      var disabled = this._isDisabled();

      this._labelText.textContent = label;
      this._labelEl.hidden = !label;
      this._requiredMark.hidden = !this._boolAttr('required');

      this._rules = parseAccept(this._strAttr('accept', ''));
      this._input.multiple = multiple;
      if (this._rules.length) this._input.setAttribute('accept', nativeAccept(this._rules));
      else this._input.removeAttribute('accept');

      this._zoneText.textContent = this._strAttr('zone-text',
        multiple ? 'Drop files here or click to browse' : 'Drop a file here or click to browse');

      var hints = [];
      if (this._rules.length) hints.push('Accepted: ' + this._rules.labels.join(', ') + '.');
      var max = this._maxSize();
      if (max) hints.push('Maximum file size: ' + formatSize(max) + '.');
      this._hintsEl.textContent = hints.join(' ');

      this._helperEl.textContent = error || helper;
      this._helperEl.classList.toggle('error', !!error);
      this.toggleAttribute('data-invalid', !!error);

      var name = this._a11yName([label, window.LWT.a11y.humanize(this._strAttr('name', ''))],
        'File upload', 'Add a label attribute');
      this._ensureAttr('role', 'group');
      this._ensureAttr('aria-label', name);
      this._zone.setAttribute('aria-label', name + ': ' + this._zoneText.textContent);
      if (this._boolAttr('required')) this._zone.setAttribute('aria-required', 'true');
      else this._zone.removeAttribute('aria-required');

      this._applyDisabled(disabled);
      this._renderListLabel();
      this._reportValue();
      this._reportValidity();
    }

    _isDisabled() { return this._boolAttr('disabled') || this._formDisabled; }

    _maxSize() {
      var n = parseInt(this._strAttr('max-size', ''), 10);
      return n > 0 ? n : 0;
    }

    _applyDisabled(disabled) {
      if (!this._zone) return;
      this._zone.tabIndex = disabled ? -1 : 0;
      if (disabled) this._zone.setAttribute('aria-disabled', 'true');
      else this._zone.removeAttribute('aria-disabled');
      this._input.disabled = disabled;
      this._items.forEach(function (it) { it.removeBtn.disabled = disabled; });
      if (disabled) this._clearDragState();
    }

    // ---- picking / dropping ----
    _openPicker() {
      if (this._isDisabled()) return;
      this._input.click();
    }

    _hasFiles(e) {
      var types = e.dataTransfer && e.dataTransfer.types;
      return !!types && Array.prototype.indexOf.call(types, 'Files') !== -1;
    }

    _onDragEnter(e) {
      if (!this._hasFiles(e)) return;
      e.preventDefault();
      if (this._isDisabled()) return;
      this._dragDepth++;
      this._zone.classList.remove('dropped');
      this._zone.classList.add('dragover');
    }

    _onDragOver(e) {
      if (!this._hasFiles(e)) return;
      // Always prevent the default, even when disabled, so the browser
      // doesn't navigate away to the dropped file.
      e.preventDefault();
      e.dataTransfer.dropEffect = this._isDisabled() ? 'none' : 'copy';
    }

    _onDragLeave() {
      if (this._dragDepth > 0) this._dragDepth--;
      if (this._dragDepth === 0) this._zone.classList.remove('dragover');
    }

    _clearDragState() {
      this._dragDepth = 0;
      if (this._zone) this._zone.classList.remove('dragover');
    }

    _onDrop(e) {
      if (!this._hasFiles(e)) return;
      e.preventDefault();
      this._clearDragState();
      if (this._isDisabled()) return;

      var dt = e.dataTransfer;
      var files = [], folders = [];
      var items = dt.items ? Array.prototype.slice.call(dt.items) : [];
      if (items.length && typeof items[0].webkitGetAsEntry === 'function') {
        items.forEach(function (item) {
          if (item.kind !== 'file') return;
          var entry = item.webkitGetAsEntry();
          var file = item.getAsFile();
          if (entry && entry.isDirectory) folders.push(entry.name || (file && file.name) || 'Folder');
          else if (file) files.push(file);
        });
      } else {
        files = Array.prototype.slice.call(dt.files || []);
      }
      this._handleIncoming(files, folders);
    }

    // Validates, adds, reports. `folders` are names of dropped directories.
    _handleIncoming(files, folders) {
      var self = this;
      var multiple = this._boolAttr('multiple');
      var max = this._maxSize();
      var rejected = [];
      var accepted = [];

      (folders || []).forEach(function (name) {
        rejected.push({ name: name, reason: 'folder', message: name + ' is a folder; folders cannot be added' });
      });

      files.forEach(function (file) {
        if (!matchesAccept(file, self._rules)) {
          rejected.push({ name: file.name, reason: 'type', message: file.name + ' is not an accepted file type' });
          return;
        }
        if (max && file.size > max) {
          rejected.push({ name: file.name, reason: 'size', message: file.name + ' is too large (' + formatSize(file.size) + '; maximum ' + formatSize(max) + ')' });
          return;
        }
        if (!multiple && accepted.length) {
          rejected.push({ name: file.name, reason: 'single', message: file.name + ' was skipped; only one file can be added' });
          return;
        }
        var dupInList = multiple && self._items.some(function (it) { return it.file.name === file.name; });
        var dupInDrop = accepted.some(function (f) { return f.name === file.name; });
        if (dupInList || dupInDrop) {
          rejected.push({ name: file.name, reason: 'duplicate', message: file.name + ' is already in the list' });
          return;
        }
        accepted.push(file);
      });

      if (accepted.length) {
        if (!multiple) this._removeAllItems();
        accepted.forEach(function (file) { self._addItem(file); });
        this._afterListChange();
        this._flashDropped();
        this.emit('add', { added: accepted.slice(), files: this.files });
        this.emit('change', { files: this.files });
      }

      this._showMessage(rejected);
      if (rejected.length) this.emit('reject', { rejected: rejected });

      // One announcement for the whole drop.
      var parts = [];
      if (accepted.length) {
        parts.push(accepted.length === 1 ? accepted[0].name + ' added.' : accepted.length + ' files added.');
        parts.push(this._countText() + '.');
      }
      if (rejected.length) parts.push(this._messageEl.textContent);
      if (parts.length) window.LWT.a11y.announce(parts.join(' '), { assertive: rejected.length > 0 });
    }

    _showMessage(rejected) {
      if (!rejected.length) { this._messageEl.textContent = ''; return; }
      if (rejected.length === 1) {
        this._messageEl.textContent = rejected[0].message + '.';
      } else {
        this._messageEl.textContent = rejected.length + ' files were skipped: ' +
          rejected.map(function (r) { return r.message; }).join('; ') + '.';
      }
    }

    _flashDropped() {
      var zone = this._zone;
      clearTimeout(this._droppedTimer);
      zone.classList.remove('dropped');
      void zone.offsetWidth; // restart the transition if dropped again quickly
      zone.classList.add('dropped');
      this._droppedTimer = setTimeout(function () { zone.classList.remove('dropped'); }, DROPPED_MS);
    }

    // ---- list ----
    _addItem(file) {
      var self = this;
      var isImage = /^image\//.test(file.type || '');
      var url = isImage && window.URL && URL.createObjectURL ? URL.createObjectURL(file) : null;
      var esc = window.LWT.a11y.escape;

      var row = document.createElement('li');
      row.className = 'item';
      row.setAttribute('part', 'item');
      row.innerHTML =
        '<span class="thumb" part="thumb">' + (url ? '<img alt="" src="' + esc(url) + '">' : ICON_FILE) + '</span>' +
        '<span class="info" part="info">' +
        '  <span class="meta"><span class="file-name" part="file-name"></span><span class="file-size" part="file-size"></span></span>' +
        '  <span class="progress" part="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" hidden>' +
        '    <span class="progress-fill" part="progress-fill"></span></span>' +
        '  <span class="row-status" part="row-status"></span>' +
        '</span>' +
        '<button type="button" class="remove" part="remove">' + ICON_REMOVE + '</button>';

      row.querySelector('.file-name').textContent = file.name;
      row.querySelector('.file-name').title = file.name;
      row.querySelector('.file-size').textContent = formatSize(file.size);
      var bar = row.querySelector('.progress');
      bar.setAttribute('aria-label', 'Upload progress for ' + file.name);
      var removeBtn = row.querySelector('.remove');
      removeBtn.setAttribute('aria-label', 'Remove ' + file.name);
      removeBtn.disabled = this._isDisabled();

      // A thumbnail the browser can't decode (e.g. HEIC) falls back to the icon.
      var img = row.querySelector('img');
      if (img) img.addEventListener('error', function () { img.parentNode.innerHTML = ICON_FILE; });

      var item = { file: file, url: url, row: row, bar: bar, fill: row.querySelector('.progress-fill'),
                   statusEl: row.querySelector('.row-status'), removeBtn: removeBtn };
      removeBtn.addEventListener('click', function () { self._removeItem(item, true); });

      this._items.push(item);
      this._list.appendChild(row);
    }

    _releaseItem(item) {
      if (item.url && window.URL && URL.revokeObjectURL) URL.revokeObjectURL(item.url);
      item.url = null;
      if (item.row.parentNode) item.row.parentNode.removeChild(item.row);
    }

    _removeAllItems() {
      var self = this;
      this._items.forEach(function (it) { self._releaseItem(it); });
      this._items = [];
    }

    _removeItem(item, fromUser) {
      if (this._isDisabled() && fromUser) return;
      var idx = this._items.indexOf(item);
      if (idx === -1) return;
      var hadFocus = this._root.activeElement === item.removeBtn;
      this._items.splice(idx, 1);
      this._releaseItem(item);
      this._afterListChange();
      if (fromUser) this._messageEl.textContent = '';
      // Focus goes back to the drop zone (the removed button is gone).
      if (hadFocus) this._zone.focus();
      window.LWT.a11y.announce(item.file.name + ' removed. ' + this._countText() + '.');
      this.emit('remove', { file: item.file, files: this.files });
      this.emit('change', { files: this.files });
    }

    _countText() {
      var n = this._items.length;
      return n === 0 ? 'No files in the list' : n === 1 ? '1 file in the list' : n + ' files in the list';
    }

    _renderListLabel() {
      if (!this._listLabel) return;
      this._listLabel.textContent = this._strAttr('list-label', 'Uploaded files') + ' (' + this._items.length + ')';
      this._listWrap.hidden = this._items.length === 0;
    }

    _afterListChange() {
      this._renderListLabel();
      this._reportValue();
      this._reportValidity();
    }

    _findItem(fileOrName) {
      return this._items.filter(function (it) {
        return it.file === fileOrName || it.file.name === fileOrName;
      })[0] || null;
    }

    // ---- public API ----
    get files() { return this._items.map(function (it) { return it.file; }); }
    get value() { return this.files; }

    get name() { return this._strAttr('name', ''); }
    set name(v) { this.setAttribute('name', v); }
    get form() { return this._internals ? this._internals.form : null; }

    addFiles(list) {
      var files = Array.prototype.slice.call(list || []);
      if (files.length && this._zone) this._handleIncoming(files, []);
      return this;
    }

    removeFile(fileOrName) {
      var item = this._findItem(fileOrName);
      if (item) this._removeItem(item, false);
      return this;
    }

    clear() {
      if (!this._items.length) return this;
      this._removeAllItems();
      this._afterListChange();
      this._messageEl.textContent = '';
      this.emit('change', { files: [] });
      return this;
    }

    setProgress(fileOrName, percent) {
      var item = this._findItem(fileOrName);
      if (!item) return this;
      var pct = Math.max(0, Math.min(100, Number(percent) || 0));
      item.bar.hidden = false;
      item.fill.style.width = pct + '%';
      item.bar.setAttribute('aria-valuenow', String(Math.round(pct)));
      return this;
    }

    setStatus(fileOrName, status, message) {
      var item = this._findItem(fileOrName);
      if (!item) return this;
      item.row.classList.remove('done', 'error');
      item.statusEl.textContent = '';
      if (status === 'done') {
        item.row.classList.add('done');
        this.setProgress(item.file, 100);
        window.LWT.a11y.announce(item.file.name + ' uploaded.');
      } else if (status === 'error') {
        item.row.classList.add('error');
        item.bar.hidden = false;
        item.statusEl.textContent = message || 'Upload failed';
        window.LWT.a11y.announce(item.file.name + ': ' + (message || 'Upload failed'), { assertive: true });
      }
      return this;
    }

    checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
    reportValidity() { return this._internals ? this._internals.reportValidity() : true; }

    // ---- form integration ----
    _reportValue() {
      if (!this._internals) return;
      var name = this._strAttr('name', '');
      if (!name || !this._items.length) { this._internals.setFormValue(null); return; }
      var fd = new FormData();
      this._items.forEach(function (it) { fd.append(name, it.file, it.file.name); });
      this._internals.setFormValue(fd);
    }

    _reportValidity() {
      if (!this._internals || !this._zone) return;
      if (this._boolAttr('required') && !this._items.length) {
        this._internals.setValidity({ valueMissing: true },
          this._boolAttr('multiple') ? 'Please add at least one file.' : 'Please add a file.', this._zone);
      } else {
        this._internals.setValidity({});
      }
    }

    formResetCallback() {
      this._removeAllItems();
      if (this._messageEl) this._messageEl.textContent = '';
      this._afterListChange();
    }

    formDisabledCallback(disabled) {
      this._formDisabled = disabled;
      this._applyDisabled(this._isDisabled());
    }
  }

  window.LWT.define('lwtf-dropzone', LWTDropzone);
})();
