(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-grid-item.js requires lwt-core.js to be loaded first.');
  }

  function escapeXml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/;

  function extractYouTubeId(src) {
    var match = YOUTUBE_RE.exec(src || '');
    return match ? match[1] : '';
  }

  var PLAY_ICON =
    '<svg viewBox="0 0 68 48" aria-hidden="true">' +
    '<path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z" fill="rgba(0,0,0,0.65)"></path>' +
    '<path d="M45 24 27 14v20" fill="#fff"></path>' +
    '</svg>';

  var CSS =
    ':host { display: block; position: relative; box-sizing: border-box; font-family: inherit; cursor: pointer;' +
    '  border-radius: var(--lwt-grid-item-radius, 10px); overflow: hidden;' +
    '  background: var(--lwt-grid-item-bg, var(--lwt-color-border, #e5e7eb)); outline: none; }' +

    // Cell spanning defaults — wrapped in :where() so their specificity
    // is (0,0,0). ANY external selector (`lwtg-grid-item.hero`, a media
    // query, an id, etc.) wins with no !important, so users can override
    // the span responsively:
    //
    //   @media (max-width: 600px) {
    //     lwtg-grid-item.hero { grid-column: auto; grid-row: auto; }
    //   }
    //
    // Anything outside the 2-8 col / 2-6 row range still works — just set
    // `style="grid-column: span 12"` directly on the item; inline styles
    // beat these defaults automatically.
    ':where(:host([col-span="2"])) { grid-column: span 2; }' +
    ':where(:host([col-span="3"])) { grid-column: span 3; }' +
    ':where(:host([col-span="4"])) { grid-column: span 4; }' +
    ':where(:host([col-span="5"])) { grid-column: span 5; }' +
    ':where(:host([col-span="6"])) { grid-column: span 6; }' +
    ':where(:host([col-span="7"])) { grid-column: span 7; }' +
    ':where(:host([col-span="8"])) { grid-column: span 8; }' +
    ':where(:host([col-span="full"])) { grid-column: 1 / -1; }' +
    ':where(:host([row-span="2"])) { grid-row: span 2; }' +
    ':where(:host([row-span="3"])) { grid-row: span 3; }' +
    ':where(:host([row-span="4"])) { grid-row: span 4; }' +
    ':where(:host([row-span="5"])) { grid-row: span 5; }' +
    ':where(:host([row-span="6"])) { grid-row: span 6; }' +
    ':host(:focus-visible) { outline: 2px solid var(--lwt-grid-item-focus-color, var(--lwt-focus-ring, #3b82f6)); outline-offset: 2px; }' +
    '.media { position: absolute; inset: 0; width: 100%; height: 100%; }' +
    '.media img { width: 100%; height: 100%; object-fit: cover; display: block; }' +
    '.media a { display: block; width: 100%; height: 100%; }' +
    '.media ::slotted(*) { width: 100%; height: 100%; }' +
    '.yt-facade { position: relative; width: 100%; height: 100%; }' +
    '.yt-facade img { width: 100%; height: 100%; object-fit: cover; display: block; }' +
    '.yt-play { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }' +
    '.yt-play svg { width: 25%; min-width: 40px; max-width: 68px; filter: drop-shadow(0 2px 6px rgba(0,0,0,.35)); }' +
    '.yt-embed { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }' +
    '.label-overlay { position: absolute; left: 0; right: 0; bottom: 0; padding: 0.55rem 0.7rem 0.5rem;' +
    '  background: var(--lwt-grid-item-label-bg, linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0)));' +
    '  color: var(--lwt-grid-item-label-color, #fff); font-size: 0.85rem; font-weight: 600; line-height: 1.3;' +
    '  opacity: 0; transform: translateY(4px); transition: opacity 160ms ease, transform 160ms ease; pointer-events: none; }' +
    ':host(:hover) .label-overlay, :host(:focus-visible) .label-overlay { opacity: 1; transform: translateY(0); }';

  class LWTGridItem extends window.LWT.Element {
    static get observedAttributes() {
      return ['src', 'href', 'type', 'label', 'video-id', 'alt', 'col-span', 'row-span'];
    }

    constructor() {
      super();
      this._handleActivate = this._handleActivate.bind(this);
      this._handleKeydown = this._handleKeydown.bind(this);
    }

    connectedCallback() {
      super.connectedCallback();
      this.addEventListener('click', this._handleActivate);
      this.addEventListener('keydown', this._handleKeydown);
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.removeEventListener('click', this._handleActivate);
      this.removeEventListener('keydown', this._handleKeydown);
    }

    render() {
      var type = this._resolveType();
      var label = this._strAttr('label', '');

      var html =
        '<div class="media" part="media">' + this._buildMediaHtml(type) + '</div>' +
        (label ? '<div class="label-overlay" part="label">' + escapeXml(label) + '</div>' : '');

      this._renderShadow(html, CSS);
      this._mediaEl = this._root.querySelector('.media');
      this._applyA11y(type);
    }

    // Accessible name: label, then alt, then a name derived from the file
    // (e.g. "summer-sale.jpg" -> "Summer sale"), then a generic fallback.
    _accessibleName(type) {
      var src = this._strAttr('src', '');
      var fromFile = '';
      if (src && type !== 'youtube') {
        var file = src.split(/[?#]/)[0].split('/').pop().replace(/\.[a-z0-9]+$/i, '');
        fromFile = window.LWT.a11y.humanize(decodeURIComponent(file));
      }
      var fallback = type === 'youtube' ? 'Play video' : (fromFile || 'Image');
      var name = this._a11yName([this._strAttr('label', ''), this._strAttr('alt', '')], fallback,
        'Add a label or alt attribute');
      return type === 'youtube' && !this._playing && name.indexOf('Play') !== 0 ? 'Play video: ' + name : name;
    }

    _applyA11y(type) {
      var name = this._accessibleName(type);
      var link = this._root.querySelector('a.media-link');

      if (link) {
        // A real link does the work: name it, and keep the host out of the
        // tab order so there's no button-wrapping-a-link nesting.
        link.setAttribute('aria-label', name);
        var img = link.querySelector('img');
        if (img) img.setAttribute('alt', '');
        this._removeAutoAttr('role');
        this._removeAutoAttr('aria-label');
        if (this._autoTabIndex) { this.removeAttribute('tabindex'); this._autoTabIndex = false; }
        return;
      }

      // Otherwise the host itself is the button; the media inside is
      // presentational (its meaning is carried by the host's name).
      this._ensureAttr('role', 'button');
      this._ensureAttr('aria-label', name);
      if (!this.hasAttribute('tabindex') || this._autoTabIndex) { this.tabIndex = 0; this._autoTabIndex = true; }
      if (this._mediaEl) this._mediaEl.setAttribute('aria-hidden', 'true');
    }

    _resolveType() {
      if (this.hasAttribute('video-id') || extractYouTubeId(this._strAttr('src', ''))) return 'youtube';
      var explicit = this._strAttr('type', '');
      if (explicit) return explicit;
      if (!this.hasAttribute('src')) return 'embed';
      return 'image';
    }

    _buildMediaHtml(type) {
      var src = this._strAttr('src', '');
      var alt = escapeXml(this._strAttr('alt', ''));
      var href = this._strAttr('href', '');

      if (type === 'youtube') {
        var id = this._strAttr('video-id', '') || extractYouTubeId(src);
        if (!id) return '<slot></slot>';
        var thumb = 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg';
        return (
          '<div class="yt-facade" part="yt-facade" data-video-id="' + id + '">' +
          '<img src="' + thumb + '" alt="' + alt + '">' +
          '<div class="yt-play" part="yt-play">' + PLAY_ICON + '</div>' +
          '</div>'
        );
      }

      if (type === 'svg' || type === 'embed') {
        return this.hasAttribute('src')
          ? this._linkWrap(href, '<img src="' + escapeXml(src) + '" alt="' + alt + '">')
          : '<slot></slot>';
      }

      // "image" (default)
      return this._linkWrap(href, '<img src="' + escapeXml(src) + '" alt="' + alt + '" loading="lazy">');
    }

    // Wraps `inner` markup in an <a> when `href` is set; otherwise returns
    // `inner` untouched. target="_blank" + rel="noopener noreferrer" since
    // these are typically media links out of the current page.
    _linkWrap(href, inner) {
      if (!href) return inner;
      return '<a class="media-link" part="media-link" href="' + escapeXml(href) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>';
    }

    _index() {
      var parent = this.parentElement;
      if (!parent) return -1;
      var siblings = Array.prototype.filter.call(parent.children, function (c) {
        return c.tagName === 'LWTG-GRID-ITEM';
      });
      return siblings.indexOf(this);
    }

    _handleActivate() {
      var type = this._resolveType();

      if (type === 'youtube' && this._boolAttr('play-inline') && this._mediaEl && !this._mediaEl.querySelector('.yt-embed')) {
        this._playInline();
      }

      this.emit('click', {
        type: type,
        src: this._strAttr('src', ''),
        label: this._strAttr('label', ''),
        index: this._index()
      });
    }

    _handleKeydown(event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      // When the tile is a link, the native <a> handles the keyboard.
      if (this._root.querySelector('a.media-link')) return;
      event.preventDefault();
      this._handleActivate();
    }

    _playInline() {
      var id = this._strAttr('video-id', '') || extractYouTubeId(this._strAttr('src', ''));
      if (!id || !this._mediaEl) return;
      var self = this;

      this._mediaEl.innerHTML = '';
      var iframe = this._genhtml({
        type: 'iframe',
        attr: {
          class: 'yt-embed',
          part: 'yt-embed',
          src: 'https://www.youtube.com/embed/' + id + '?autoplay=1',
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
          allowfullscreen: '',
          frameborder: '0',
          title: this._a11yName([this._strAttr('label', ''), this._strAttr('alt', '')], 'YouTube video player', 'Add a label attribute')
        }
      });
      this._mediaEl.appendChild(iframe);
      // The player is now the interactive thing: drop the host's button
      // role so it doesn't wrap an iframe full of its own controls.
      this._playing = true;
      this._mediaEl.removeAttribute('aria-hidden');
      this._removeAutoAttr('role');
      this._removeAutoAttr('aria-label');
      if (this._autoTabIndex) { this.removeAttribute('tabindex'); this._autoTabIndex = false; }
      self.emit('play', { videoId: id });
    }
  }

  window.LWT.define('lwtg-grid-item', LWTGridItem);
})();
