/*!
 * <lwtf-phone>
 * A phone number field with a country picker on the left (flag + dial
 * code, searchable dropdown of every country) and an optional extension
 * field on the right, all in one input box with one label and one error
 * line. Works like a native input inside a standard <form>.
 *
 *   <lwtf-phone label="Phone" name="phone" default-country="US"
 *     preferred="US,CA,GB" extension required></lwtf-phone>
 *
 * ---------------------------------------------------------------------
 * Value
 * ---------------------------------------------------------------------
 *   .value -> {
 *     "country": "US",                       // ISO code of the picked country
 *     "country-code": "+1",
 *     "phone": "123-456-7890",               // national number, formatted
 *     "extension": "123",
 *     "full": "+1 123-456-7890 ext.123"      // what the form submits
 *   }
 *   Set it with the same object (any subset of keys) or a string such as
 *   "+44 7700 900123 ext. 12". A normal form submit sends `full` under
 *   `name` (an empty string when there's no number, like a native input).
 *
 * Formatting while typing: +1 countries (US, Canada, Caribbean) format as
 * 123-456-7890. Other countries keep the user's own grouping, cleaned up
 * to digits and single dashes ("7700 900123" -> "7700-900123").
 * A leading trunk prefix (the 0 in UK "07700 900123", the 1 in
 * "1 415 555 2671") is dropped, except where it's part of the number
 * (e.g. Italy). Pasting or autofilling an international number
 * ("+44 20 7946 0958") switches the country automatically.
 *
 * Validation (light): the number's digit count must be a valid length for
 * the picked country (data from Google's libphonenumber metadata).
 * `required` needs a number. Errors show after leaving the field or on
 * reportValidity()/submit, never while still typing.
 *
 * ---------------------------------------------------------------------
 * Attributes
 * ---------------------------------------------------------------------
 *   label, helper, error, name, placeholder — display / form basics
 *   value            — initial value (string, e.g. "+1 415-555-2671 ext.12")
 *   default-country  — ISO code picked when there's no value (default:
 *                      from the browser language, e.g. en-GB -> GB, else US)
 *   preferred        — "US,CA,GB": pinned to the top of the list
 *   countries        — "US,CA": limit the list to these countries
 *   extension        — boolean; shows the extension field on the right
 *   extension-label  — text before the extension field (default "Ext.")
 *   required, disabled, readonly — standard form states
 *   flag-path        — folder or URL holding <iso>.svg flags. Default:
 *                      window.LWT.flagPath, else this repo's icons/flags
 *                      folder on the jsDelivr CDN.
 *
 * Properties / methods: .value (get/set), .country (get/set ISO code),
 * .name, .form, .checkValidity(), .reportValidity(), .focus()
 *
 * Events: lwt-input (+ input) on every change while typing;
 * lwt-change (+ change) when a change is committed (leaving a field or
 * picking a country); lwt-country-change { country, countryCode }.
 * All carry detail: the value object (plus the country fields).
 *
 * Accessibility: the country button reads as "Country code: United
 * States, +1". The dropdown is a searchable listbox (type a name, ISO
 * code or dial code; arrows, Home/End, Enter, Escape). Flags are
 * decorative -- the country name and code are always in text.
 *
 * Theming: --lwt-phone-bg, --lwt-phone-color, --lwt-phone-border,
 * --lwt-phone-radius, --lwt-phone-padding, --lwt-phone-focus-color,
 * --lwt-phone-error-color, --lwt-phone-divider-color,
 * --lwt-phone-label-color, --lwt-phone-helper-color,
 * --lwt-phone-popup-bg, --lwt-phone-popup-max-height,
 * --lwt-phone-option-active-bg, --lwt-phone-flag-width,
 * --lwt-phone-extension-width
 *
 * Country data: dial codes, valid lengths and trunk prefixes generated
 * from libphonenumber-js (MIT) metadata. Flags: flag-icons (MIT), see
 * icons/flags/LICENSE. Country names come from the browser
 * (Intl.DisplayNames) in the page's language.
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-frm-phone.js requires lwt-core.js to be loaded first.');
  }

  var supportsInternals = typeof HTMLElement !== 'undefined' && !!HTMLElement.prototype.attachInternals;
  var DEFAULT_FLAG_PATH = 'https://cdn.jsdelivr.net/gh/LWW-LWTECH/LWW-CORE-DNA@main/icons/flags/';
  // Territories that share another country's flag.
  var FLAG_ALIAS = { AC: 'sh', TA: 'sh' };

  // ISO|dialCode|validLengths(dot separated)|trunkPrefix|isMainCountryForCode
  // Generated from libphonenumber-js 1.13.15 metadata.
  var DATA = 'AC|247|5.6||1;AD|376|6.8.9||1;AE|971|5.6.7.8.9.10.11.12|0|1;AF|93|9|0|1;AG|1|10|1|0;AI|1|10|1|0;AL|355|6.7.8.9|0|1;AM|374|8|0|1;AO|244|9||1;AR|54|10.11|0|1;AS|1|10|1|0;AT|43|4.5.6.7.8.9.10.11.12.13|0|1;AU|61|5.6.7.8.9.10.12|0|1;AW|297|7||1;AX|358|5.6.7.8.9.10.11.12|0|0;AZ|994|9|0|1;BA|387|8.9|0|1;BB|1|10|1|0;BD|880|6.7.8.9.10|0|1;BE|32|8.9|0|1;BF|226|8||1;BG|359|6.7.8.9.12|0|1;BH|973|8||1;BI|257|8||1;BJ|229|8.10||1;BL|590|9|0|0;BM|1|10|1|0;BN|673|7||1;BO|591|8.9|0|1;BQ|599|7||0;BR|55|8.9.10.11|0|1;BS|1|10|1|0;BT|975|7.8||1;BW|267|7.8.10||1;BY|375|6.7.8.9.10.11|8|1;BZ|501|7.11||1;CA|1|7.10|1|0;CC|61|6.7.8.9.10.12|0|0;CD|243|7.8.9.10|0|1;CF|236|8||1;CG|242|9||1;CH|41|9.12|0|1;CI|225|10||1;CK|682|5||1;CL|56|9.10.11||1;CM|237|8.9||1;CN|86|7.8.9.10.11.12|0|1;CO|57|8.10.11|0|1;CR|506|8.10||1;CU|53|6.7.8.10|0|1;CV|238|7||1;CW|599|7.8||1;CX|61|6.7.8.9.10.12|0|0;CY|357|8||1;CZ|420|9.10.11.12||1;DE|49|4.5.6.7.8.9.10.11.12.13.14.15|0|1;DJ|253|8||1;DK|45|8||1;DM|1|10|1|0;DO|1|10|1|0;DZ|213|8.9|0|1;EC|593|8.9.10.11|0|1;EE|372|7.8.10||1;EG|20|8.9.10|0|1;EH|212|9|0|0;ER|291|7|0|1;ES|34|9||1;ET|251|9|0|1;FI|358|5.6.7.8.9.10.11.12|0|1;FJ|679|7.11||1;FK|500|5||1;FM|691|7||1;FO|298|6||1;FR|33|9|0|1;GA|241|7.8||1;GB|44|7.9.10|0|1;GD|1|10|1|0;GE|995|9|0|1;GF|594|9|0|1;GG|44|7.9.10|0|0;GH|233|8.9|0|1;GI|350|8||1;GL|299|6||1;GM|220|7.9||1;GN|224|8.9||1;GP|590|9|0|1;GQ|240|9||1;GR|30|10.11.12||1;GT|502|8.11||1;GU|1|10|1|0;GW|245|7.9||1;GY|592|7||1;HK|852|5.6.7.8.9.11||1;HN|504|8.11||1;HR|385|7.8.9|0|1;HT|509|8||1;HU|36|8.9|06|1;ID|62|7.8.9.10.11.12.13.14.15.16.17|0|1;IE|353|7.8.9.10|0|1;IL|972|7.8.9.10.11.12|0|1;IM|44|10|0|0;IN|91|8.9.10.11.12.13|0|1;IO|246|7||1;IQ|964|8.9.10|0|1;IR|98|4.5.6.7.10|0|1;IS|354|7.9||1;IT|39|6.7.8.9.10.11.12||1;JE|44|10|0|0;JM|1|10|1|0;JO|962|8.9|0|1;JP|81|8.9.10.11.12.13.14.15.16.17|0|1;KE|254|7.8.9.10|0|1;KG|996|9.10|0|1;KH|855|8.9.10|0|1;KI|686|5.8|0|1;KM|269|7||1;KN|1|10|1|0;KP|850|8.10|0|1;KR|82|5.6.8.9.10.11.12.13.14|0|1;KW|965|7.8||1;KY|1|10|1|0;KZ|7|10.14|8|0;LA|856|8.9.10|0|1;LB|961|7.8|0|1;LC|1|10|1|0;LI|423|7.9|0|1;LK|94|9|0|1;LR|231|7.8.9|0|1;LS|266|8||1;LT|370|8|0|1;LU|352|4.5.6.7.8.9.10.11||1;LV|371|8||1;LY|218|9|0|1;MA|212|9|0|1;MC|377|8.9|0|1;MD|373|8|0|1;ME|382|8.9|0|1;MF|590|9|0|0;MG|261|9|0|1;MH|692|7|1|1;MK|389|8|0|1;ML|223|8||1;MM|95|6.7.8.9.10|0|1;MN|976|8.9.10|0|1;MO|853|7.8||1;MP|1|10|1|0;MQ|596|9|0|1;MR|222|8||1;MS|1|10|1|0;MT|356|8||1;MU|230|7.8.10||1;MV|960|7.10||1;MW|265|7.9|0|1;MX|52|10||1;MY|60|8.9.10|0|1;MZ|258|8.9||1;NA|264|8.9|0|1;NC|687|6||1;NE|227|8||1;NF|672|6||1;NG|234|10.11.12.13.14|0|1;NI|505|8||1;NL|31|5.6.7.8.9.10.11|0|1;NO|47|5.8||1;NP|977|8.10.11|0|1;NR|674|7||1;NU|683|4.7||1;NZ|64|5.6.7.8.9.10|0|1;OM|968|7.8.9||1;PA|507|7.8.10.11||1;PE|51|8.9|0|1;PF|689|6.8.9||1;PG|675|7.8||1;PH|63|6.8.9.10.11.12.13|0|1;PK|92|8.9.10.11.12|0|1;PL|48|6.7.8.9.10||1;PM|508|6.9|0|1;PR|1|10|1|0;PS|970|8.9.10|0|1;PT|351|9||1;PW|680|7||1;PY|595|6.7.8.9.10.11|0|1;QA|974|7.8.9.11||1;RE|262|9|0|1;RO|40|6.9|0|1;RS|381|6.7.8.9.10.11.12|0|1;RU|7|10.14|8|1;RW|250|8.9|0|1;SA|966|9.10|0|1;SB|677|5.7||1;SC|248|7||1;SD|249|9|0|1;SE|46|6.7.8.9.10.12|0|1;SG|65|8.10.11||1;SH|290|4.5||1;SI|386|5.6.7.8|0|1;SJ|47|5.8||0;SK|421|6.7.9|0|1;SL|232|8|0|1;SM|378|8.10||1;SN|221|9||1;SO|252|6.7.8.9|0|1;SR|597|6.7||1;SS|211|9|0|1;ST|239|7||1;SV|503|7.8.11||1;SX|1|10|1|0;SY|963|8.9|0|1;SZ|268|8.9||1;TA|290|4||0;TC|1|10|1|0;TD|235|8||1;TG|228|8||1;TH|66|8.9.10.13|0|1;TJ|992|9||1;TK|690|4.5.6.7||1;TL|670|7.8||1;TM|993|8|8|1;TN|216|8||1;TO|676|5.7||1;TR|90|7.10.12.13|0|1;TT|1|10|1|0;TV|688|5.6.7||1;TW|886|7.8.9.10.11|0|1;TZ|255|9|0|1;UA|380|9.10|0|1;UG|256|9|0|1;US|1|10|1|1;UY|598|4.5.6.7.8.9.10.11.12.13|0|1;UZ|998|9||1;VA|39|6.7.8.9.10.11.12||0;VC|1|10|1|0;VE|58|10|0|1;VG|1|10|1|0;VI|1|10|1|0;VN|84|7.8.9.10|0|1;VU|678|5.7||1;WF|681|6.9||1;WS|685|5.6.7.10||1;XK|383|8.9.10.11.12|0|1;YE|967|7.8.9|0|1;YT|262|9|0|0;ZA|27|5.6.7.8.9.10|0|1;ZM|260|9|0|1;ZW|263|7.9.10|0|1';

  var COUNTRIES = {};      // ISO -> { iso, code, lengths:[], trunk, main }
  var BY_CODE = {};        // '44' -> ['GB', 'GG', ...] (main country first)
  DATA.split(';').forEach(function (row) {
    var p = row.split('|');
    var c = { iso: p[0], code: p[1], lengths: p[2] ? p[2].split('.').map(Number) : [], trunk: p[3], main: p[4] === '1' };
    COUNTRIES[c.iso] = c;
    (BY_CODE[c.code] = BY_CODE[c.code] || [])[c.main ? 'unshift' : 'push'](c.iso);
  });

  var displayNames = null;
  function countryName(iso) {
    try {
      if (!displayNames && typeof Intl !== 'undefined' && Intl.DisplayNames) {
        var lang = (document.documentElement.getAttribute('lang') || navigator.language || 'en');
        displayNames = new Intl.DisplayNames([lang, 'en'], { type: 'region' });
      }
      var n = displayNames && displayNames.of(iso);
      if (n && n !== iso) return n;
    } catch (e) { /* unknown region code -- fall through */ }
    return { AC: 'Ascension Island', TA: 'Tristan da Cunha', XK: 'Kosovo' }[iso] || iso;
  }

  function digitsOf(str) { return String(str || '').replace(/\D/g, ''); }

  // 123-456-7890, built up as the user types.
  function formatNanp(d) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return d.slice(0, 3) + '-' + d.slice(3);
    return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6, 10);
  }

  // Other countries: keep the user's grouping, separators -> single '-'.
  function cleanGrouping(str, keepTrailing) {
    var s = String(str || '').replace(/[^\d\s\-.()]/g, '').replace(/[\s\-.()]+/g, '-').replace(/^-+/, '');
    return keepTrailing ? s : s.replace(/-+$/, '');
  }

  // "+44 20 7946 0958 ext. 12" -> { code:'44', national:'2079460958', extension:'12' } (or null)
  function splitExtension(str) {
    var m = String(str || '').match(/^(.*?)(?:\s*(?:ext\.?|extension|x|#)\s*(\d+))\s*$/i);
    return m ? { main: m[1], extension: m[2] } : { main: String(str || ''), extension: '' };
  }

  function parseInternational(str) {
    var s = String(str || '').trim();
    var intl = /^\+/.test(s) || /^00/.test(s.replace(/[^\d+]/g, ''));
    if (!intl) return null;
    var d = digitsOf(s);
    if (/^00/.test(s.replace(/[^\d+]/g, ''))) d = d.slice(2);
    for (var len = 3; len >= 1; len--) {
      var code = d.slice(0, len);
      if (BY_CODE[code]) return { code: code, national: d.slice(len) };
    }
    return null;
  }

  var CHEVRON =
    '<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

  var CSS = `
    :host { display: block; font-family: inherit; color: var(--lwt-phone-color, var(--lwt-color-text, #1f2937)); }
    :host([hidden]) { display: none; }
    * { box-sizing: border-box; }
    .field-label {
      display: flex;
      gap: 0.2rem;
      font-size: 0.82rem;
      font-weight: 600;
      margin-bottom: 0.35rem;
      color: var(--lwt-phone-label-color, var(--lwt-color-text, #374151));
    }
    .field-label[hidden] { display: none; }
    .required-mark { color: var(--lwt-phone-error-color, var(--lwt-color-danger, #ef4444)); }
    .wrap { position: relative; }
    .field-box {
      display: flex;
      align-items: stretch;
      min-height: 2.4rem;
      width: 100%;
      background: var(--lwt-phone-bg, var(--lwt-color-surface, #fff));
      border: var(--lwt-phone-border, var(--lwt-border, 1px solid #d1d5db));
      border-radius: var(--lwt-phone-radius, var(--lwt-border-radius, 6px));
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .field-box:focus-within {
      border-color: var(--lwt-phone-focus-color, var(--lwt-focus-color, #2563eb));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--lwt-phone-focus-color, var(--lwt-focus-color, #2563eb)) 22%, transparent);
    }
    :host([data-invalid]) .field-box { border-color: var(--lwt-phone-error-color, var(--lwt-color-danger, #ef4444)); }
    :host([disabled]) .field-box, .field-box.disabled { opacity: 0.6; cursor: not-allowed; background: var(--lwt-color-surface-muted, #f3f4f6); }
    .country-btn {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-shrink: 0;
      padding: 0 0.5rem 0 0.6rem;
      border: none;
      border-right: 1px solid var(--lwt-phone-divider-color, var(--lwt-border-color, #e5e7eb));
      border-radius: var(--lwt-phone-radius, var(--lwt-border-radius, 6px)) 0 0 var(--lwt-phone-radius, var(--lwt-border-radius, 6px));
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 0.92rem;
      cursor: pointer;
    }
    .country-btn:hover:not(:disabled) { background: var(--lwt-phone-option-active-bg, var(--lwt-color-surface-alt, rgba(0,0,0,0.04))); }
    .country-btn:focus-visible { outline: 2px solid var(--lwt-phone-focus-color, var(--lwt-focus-color, #2563eb)); outline-offset: -2px; }
    .country-btn:disabled { cursor: not-allowed; }
    .chevron { width: 0.9rem; height: 0.9rem; color: var(--lwt-icon-color, #6b7280); transition: transform 150ms ease; }
    .country-btn[aria-expanded="true"] .chevron { transform: rotate(180deg); }
    .flag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: var(--lwt-phone-flag-width, 1.5rem);
      aspect-ratio: 4 / 3;
      border-radius: 2px;
      overflow: hidden;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.12);
      background: var(--lwt-color-surface-muted, #f3f4f6);
      font-size: 0.6rem;
      font-weight: 700;
      color: var(--lwt-color-text-muted, #6b7280);
    }
    .flag img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .number {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      padding: var(--lwt-phone-padding, 0.5rem 0.6rem);
      font: inherit;
      font-size: 0.95rem;
      color: inherit;
    }
    .number::placeholder, .ext::placeholder { color: var(--lwt-color-text-muted, #6b7280); }
    .ext-wrap {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-shrink: 0;
      padding: 0 0.6rem;
      border-left: 1px solid var(--lwt-phone-divider-color, var(--lwt-border-color, #e5e7eb));
    }
    .ext-wrap[hidden] { display: none; }
    .ext-label { font-size: 0.82rem; color: var(--lwt-color-text-muted, #6b7280); }
    .ext {
      width: var(--lwt-phone-extension-width, 4.5rem);
      border: none;
      outline: none;
      background: transparent;
      font: inherit;
      font-size: 0.95rem;
      color: inherit;
      padding: 0.5rem 0;
    }
    input:disabled, button:disabled { cursor: not-allowed; }
    .popup {
      position: absolute;
      left: 0;
      top: calc(100% + 4px);
      z-index: 20;
      width: min(100%, 22rem);
      min-width: 16rem;
      background: var(--lwt-phone-popup-bg, var(--lwt-color-surface, #fff));
      border: 1px solid var(--lwt-color-border-strong, #d1d5db);
      border-radius: var(--lwt-phone-radius, var(--lwt-border-radius, 6px));
      box-shadow: 0 8px 20px var(--lwt-color-shadow, rgba(0,0,0,0.15));
      overflow: hidden;
    }
    .popup[hidden] { display: none; }
    .search {
      display: block;
      width: calc(100% - 1rem);
      margin: 0.5rem;
      padding: 0.4rem 0.55rem;
      font: inherit;
      font-size: 0.88rem;
      color: inherit;
      background: transparent;
      border: 1px solid var(--lwt-color-border-strong, #d1d5db);
      border-radius: var(--lwt-phone-radius, var(--lwt-border-radius, 6px));
      outline: none;
    }
    .search:focus { border-color: var(--lwt-phone-focus-color, var(--lwt-focus-color, #2563eb)); }
    .list {
      list-style: none;
      margin: 0;
      padding: 0 0 0.25rem;
      max-height: var(--lwt-phone-popup-max-height, 15rem);
      overflow-y: auto;
    }
    .option {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.4rem 0.75rem;
      cursor: pointer;
      font-size: 0.9rem;
    }
    .option.active { background: var(--lwt-phone-option-active-bg, var(--lwt-color-primary-soft, #eff6ff)); }
    .option[aria-selected="true"] { font-weight: 600; }
    .option.last-preferred { border-bottom: 1px solid var(--lwt-phone-divider-color, var(--lwt-border-color, #e5e7eb)); padding-bottom: 0.5rem; margin-bottom: 0.25rem; }
    .option .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .option .code { color: var(--lwt-color-text-muted, #6b7280); font-variant-numeric: tabular-nums; }
    .empty { padding: 0.6rem 0.75rem; font-size: 0.85rem; color: var(--lwt-color-text-muted, #6b7280); }
    .helper { display: block; margin-top: 0.3rem; font-size: 0.78rem; color: var(--lwt-phone-helper-color, var(--lwt-color-text-muted, #6b7280)); }
    .helper:empty { display: none; }
    .helper.error { color: var(--lwt-phone-error-color, var(--lwt-color-danger, #b91c1c)); }
    @media (prefers-reduced-motion: reduce) { .field-box, .chevron { transition: none; } }
  `;

  var TEMPLATE =
    '<div class="field-label" part="label"><label class="label-text"></label><span class="required-mark" aria-hidden="true" hidden>*</span></div>' +
    '<div class="wrap" part="wrap">' +
    '  <div class="field-box" part="field-box">' +
    '    <button type="button" class="country-btn" part="country-button" aria-haspopup="listbox" aria-expanded="false">' +
    '      <span class="flag" part="flag"></span><span class="dial" part="dial-code"></span>' + CHEVRON +
    '    </button>' +
    '    <input class="number" part="input" type="tel" inputmode="tel" autocomplete="tel-national">' +
    '    <span class="ext-wrap" part="extension-wrap" hidden>' +
    '      <label class="ext-label" part="extension-label"></label>' +
    '      <input class="ext" part="extension" type="text" inputmode="numeric" maxlength="8" autocomplete="tel-extension">' +
    '    </span>' +
    '  </div>' +
    '  <div class="popup" part="popup" hidden>' +
    '    <input class="search" part="search" type="text" role="combobox" aria-autocomplete="list" aria-expanded="true" autocomplete="off" placeholder="Search country or code">' +
    '    <ul class="list" part="list" role="listbox"></ul>' +
    '  </div>' +
    '</div>' +
    '<span class="helper" part="helper"></span>';

  class LWTPhone extends window.LWT.Element {
    static get formAssociated() { return true; }

    static get observedAttributes() {
      return ['label', 'helper', 'error', 'name', 'placeholder', 'default-country', 'preferred', 'countries',
              'extension', 'extension-label', 'required', 'disabled', 'readonly', 'flag-path',
              'aria-label', 'aria-labelledby'];
    }

    constructor() {
      super();
      this._internals = null;
      if (supportsInternals) {
        try { this._internals = this.attachInternals(); }
        catch (e) { this._internals = null; }
      }
      this._country = null;       // ISO
      this._national = '';        // what's shown in the number field
      this._extension = '';
      this._open = false;
      this._filtered = [];
      this._activeIndex = -1;
      this._showInvalid = false;  // only show errors after blur / report
      this._formDisabled = false;
      this._initialized = false;
      this._committed = '';
      this._onDocDown = this._onDocDown.bind(this);
    }

    connectedCallback() {
      super.connectedCallback();
      this.setAttribute('control-type', 'tel');
      document.addEventListener('mousedown', this._onDocDown, true);
      if (!this._initialized) {
        this._initialized = true;
        this._initialValue = this._strAttr('value', '');
        this._applyValue(this._initialValue, true);
        this._committed = this._full();
      }
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      document.removeEventListener('mousedown', this._onDocDown, true);
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (!this._btn) return;
      if (name === 'countries' && this._country && !this._isAllowed(this._country)) this._setCountry(this._resolveDefault(), { silent: true });
      if (name === 'default-country' && !this._national && this._initialized) this._setCountry(this._resolveDefault(), { silent: true });
      this._listBuiltFor = null; // rebuild the dropdown next time it opens
      this._syncAttrs();
    }

    render() {
      if (this._btn) { this._syncAttrs(); return; }
      this._renderShadow(TEMPLATE, CSS);
      var root = this._root;
      var a11y = window.LWT.a11y;
      this._labelWrap = root.querySelector('.field-label');
      this._labelEl = root.querySelector('.label-text');
      this._requiredMark = root.querySelector('.required-mark');
      this._box = root.querySelector('.field-box');
      this._btn = root.querySelector('.country-btn');
      this._flagEl = root.querySelector('.country-btn .flag');
      this._dialEl = root.querySelector('.dial');
      this._input = root.querySelector('.number');
      this._extWrap = root.querySelector('.ext-wrap');
      this._extLabel = root.querySelector('.ext-label');
      this._ext = root.querySelector('.ext');
      this._popup = root.querySelector('.popup');
      this._search = root.querySelector('.search');
      this._list = root.querySelector('.list');
      this._helper = root.querySelector('.helper');

      this._input.id = a11y.uid('lwt-phone-number');
      this._ext.id = a11y.uid('lwt-phone-ext');
      this._list.id = a11y.uid('lwt-phone-list');
      this._helper.id = a11y.uid('lwt-phone-helper');
      this._labelEl.setAttribute('for', this._input.id);
      this._extLabel.setAttribute('for', this._ext.id);
      this._search.setAttribute('aria-controls', this._list.id);
      this._btn.setAttribute('aria-controls', this._list.id);

      var self = this;
      // A flag that fails to load shows its ISO code instead.
      root.addEventListener('error', function (e) {
        var img = e.target;
        if (img && img.tagName === 'IMG' && img.parentNode) img.parentNode.textContent = img.getAttribute('data-iso') || '';
      }, true);
      this._btn.addEventListener('click', function () { self._open ? self._closePopup(true) : self._openPopup(); });
      this._btn.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); self._openPopup(); }
      });
      this._input.addEventListener('input', function () { self._onNumberInput(); });
      this._input.addEventListener('blur', function () { self._onBlur(); });
      this._ext.addEventListener('input', function () {
        var d = digitsOf(self._ext.value);
        if (d !== self._ext.value) self._ext.value = d;
        self._extension = d;
        self._afterChange(false);
      });
      this._ext.addEventListener('blur', function () { self._onBlur(); });
      this._search.addEventListener('input', function () { self._filter(); });
      this._search.addEventListener('keydown', function (e) { self._onSearchKey(e); });
      this._list.addEventListener('mousedown', function (e) { e.preventDefault(); });
      this._list.addEventListener('click', function (e) {
        var li = e.target.closest && e.target.closest('.option');
        if (li) self._choose(li.getAttribute('data-iso'));
      });
      this._list.addEventListener('mousemove', function (e) {
        var li = e.target.closest && e.target.closest('.option');
        if (li) self._setActive(parseInt(li.getAttribute('data-index'), 10), false);
      });

      this._syncAttrs();
    }

    // ---- attributes -> DOM ----
    _syncAttrs() {
      var label = this._strAttr('label', '');
      var helper = this._strAttr('helper', '');
      var error = this._strAttr('error', '');
      var disabled = this._isDisabled();
      var readonly = this._boolAttr('readonly');

      this._labelEl.textContent = label;
      this._labelWrap.hidden = !label;
      this._requiredMark.hidden = !this._boolAttr('required');
      this._input.placeholder = this._strAttr('placeholder', '');
      this._input.required = this._boolAttr('required');
      this._extWrap.hidden = !this._boolAttr('extension');
      this._extLabel.textContent = this._strAttr('extension-label', 'Ext.');

      var name = this._a11yName([label, window.LWT.a11y.humanize(this._strAttr('name', ''))], 'Phone number', 'Add a label attribute');
      this._ensureAttr('role', 'group');
      this._ensureAttr('aria-label', name);
      if (!label) this._input.setAttribute('aria-label', name); else this._input.removeAttribute('aria-label');
      this._ext.setAttribute('aria-label', name + ' extension');
      this._search.setAttribute('aria-label', 'Search countries');
      this._list.setAttribute('aria-label', 'Countries');

      this._input.disabled = disabled;
      this._ext.disabled = disabled;
      this._btn.disabled = disabled || readonly;
      this._input.readOnly = readonly;
      this._ext.readOnly = readonly;
      this._box.classList.toggle('disabled', disabled);
      if (disabled || readonly) this._closePopup(false);

      if (!this._country || !this._isAllowed(this._country)) this._country = this._resolveDefault();
      this._renderCountry();
      this._renderHelper();
      this._report();
    }

    _isDisabled() { return this._boolAttr('disabled') || this._formDisabled; }

    _listAttr(name) {
      return this._strAttr(name, '').split(/[\s,]+/).map(function (s) { return s.trim().toUpperCase(); })
        .filter(function (s) { return COUNTRIES[s]; });
    }

    _allowed() {
      var limit = this._listAttr('countries');
      return limit.length ? limit : Object.keys(COUNTRIES);
    }

    _isAllowed(iso) { return this._allowed().indexOf(iso) !== -1; }

    _resolveDefault() {
      var allowed = this._allowed();
      var pick = function (iso) { return iso && COUNTRIES[iso] && allowed.indexOf(iso) !== -1 ? iso : null; };
      var attr = pick(this._strAttr('default-country', '').toUpperCase());
      if (attr) return attr;
      var lang = (navigator.languages && navigator.languages[0]) || navigator.language || '';
      var region = (lang.split('-')[1] || '').toUpperCase();
      return pick(region) || pick(this._listAttr('preferred')[0]) || pick('US') || allowed[0];
    }

    _flagPath() {
      var p = this._strAttr('flag-path', '') || (window.LWT && window.LWT.flagPath) || DEFAULT_FLAG_PATH;
      return /\/$/.test(p) ? p : p + '/';
    }

    _flagHtml(iso, lazy) {
      var file = (FLAG_ALIAS[iso] || iso).toLowerCase();
      return '<img alt="" ' + (lazy ? 'loading="lazy" ' : '') + 'data-iso="' + iso + '" src="' +
        window.LWT.a11y.escape(this._flagPath() + file + '.svg') + '">';
    }

    _renderCountry() {
      var c = COUNTRIES[this._country];
      if (!c) return;
      if (this._flagEl.getAttribute('data-iso') !== c.iso || this._flagEl.getAttribute('data-path') !== this._flagPath()) {
        this._flagEl.innerHTML = this._flagHtml(c.iso, false);
        this._flagEl.setAttribute('data-iso', c.iso);
        this._flagEl.setAttribute('data-path', this._flagPath());
      }
      this._dialEl.textContent = '+' + c.code;
      this._btn.setAttribute('aria-label', 'Country code: ' + countryName(c.iso) + ', +' + c.code);
    }

    // ---- number field ----
    _onNumberInput() {
      var raw = this._input.value;
      var startsIntl = /^\s*(\+|00)/.test(raw);
      var intl = parseInternational(splitExtension(raw).main);
      this._partialIntl = false;
      if (startsIntl && !intl) {
        // Still typing a dial code ("+4" on the way to "+44"): keep it as
        // typed until it matches one. Dial codes never start another
        // code, so the first match is the right one.
        var partial = raw.replace(/[^\d+\s]/g, '');
        if (partial !== raw) this._input.value = partial;
        this._national = '';
        this._partialIntl = true;
        this._afterChange(false);
        return;
      }
      if (intl && startsIntl) {
        // Pasted / autofilled international number: switch country.
        var parts = splitExtension(raw);
        this._takeInternational(parts.main, intl);
        if (parts.extension && this._boolAttr('extension')) { this._extension = parts.extension; this._ext.value = parts.extension; }
        this._afterChange(false);
        return;
      }
      var caret = this._input.selectionStart == null ? raw.length : this._input.selectionStart;
      var before = raw.slice(0, caret);
      var caretDigits = digitsOf(before).length;
      var afterSeparator = /[\s\-.()]$/.test(before);
      this._setNational(raw, false);
      this._placeCaret(caretDigits, afterSeparator);
      if (!this._validity()) this._showInvalid = false; // fixed -> clear the error straight away
      this._afterChange(false);
    }

    _takeInternational(main, intl) {
      var candidates = BY_CODE[intl.code].filter(this._isAllowed, this);
      if (!candidates.length) { this._setNational(intl.national, true); return; }
      var keep = candidates.indexOf(this._country) !== -1 ? this._country : null;
      var def = this._resolveDefault();
      var iso = keep || (candidates.indexOf(def) !== -1 ? def : candidates[0]);
      this._setCountry(iso, { silent: false, keepNumber: true });
      // Keep the user's grouping after the dial code.
      var afterCode = main.replace(/^\s*(\+|00)\s*/, '');
      var codeDigits = intl.code.length, seen = 0, i = 0;
      for (; i < afterCode.length && seen < codeDigits; i++) if (/\d/.test(afterCode[i])) seen++;
      this._setNational(afterCode.slice(i), true);
    }

    // Normalise and show `raw` as the national number. `final` strips a
    // trunk prefix and trailing separators (used on blur / when set).
    _setNational(raw, final) {
      var c = COUNTRIES[this._country];
      var d = digitsOf(raw);
      var maxLen = c.lengths.length ? Math.max.apply(null, c.lengths) : 15;
      var shown;
      if (c.code === '1') {
        if (d.length > 10 && d[0] === '1') d = d.slice(1);
        if (final && d.length === 11 && d[0] === '1') d = d.slice(1);
        d = d.slice(0, 10);
        shown = formatNanp(d);
      } else {
        var trunkLen = c.trunk ? c.trunk.length : 0;
        var cap = maxLen + (c.trunk && d.indexOf(c.trunk) === 0 ? trunkLen : 0);
        shown = this._capDigits(cleanGrouping(raw, !final), cap);
        if (final) shown = this._stripTrunk(shown);
      }
      this._national = shown;
      if (this._input.value !== shown) this._input.value = shown;
    }

    _capDigits(str, cap) {
      var out = '', n = 0;
      for (var i = 0; i < str.length; i++) {
        if (/\d/.test(str[i])) { if (n >= cap) break; n++; }
        out += str[i];
      }
      return out;
    }

    // Drop a leading trunk prefix when what's left is a valid length.
    _stripTrunk(shown) {
      var c = COUNTRIES[this._country];
      if (!c.trunk) return shown;
      var d = digitsOf(shown);
      if (d.indexOf(c.trunk) !== 0) return shown;
      var rest = d.length - c.trunk.length;
      if (c.lengths.indexOf(d.length) !== -1 && c.lengths.indexOf(rest) === -1) return shown;
      if (c.lengths.length && c.lengths.indexOf(rest) === -1) return shown;
      var i = 0, seen = 0;
      while (i < shown.length && seen < c.trunk.length) { if (/\d/.test(shown[i])) seen++; i++; }
      return shown.slice(i).replace(/^-+/, '');
    }

    // Put the caret back after the same number of digits (and after the
    // separator the user just typed, so it isn't pushed to the end).
    _placeCaret(digitCount, afterSeparator) {
      if (this._root.activeElement !== this._input) return;
      var v = this._input.value, pos = 0, seen = 0;
      while (pos < v.length && seen < digitCount) { if (/\d/.test(v[pos])) seen++; pos++; }
      if (afterSeparator && v[pos] === '-') pos++;
      try { this._input.setSelectionRange(pos, pos); } catch (e) { /* type=tel supports it; ignore elsewhere */ }
    }

    _onBlur() {
      var self = this;
      setTimeout(function () {
        var active = self._root.activeElement;
        if (active === self._input || active === self._ext) return; // moved within the field
        if (!self._partialIntl) self._setNational(self._input.value, true);
        self._showInvalid = !!self._validity();
        self._afterChange(true);
      }, 0);
    }

    // ---- value ----
    _phoneDisplay() { return this._national.replace(/-+$/, ''); }

    _full() {
      var phone = this._phoneDisplay();
      if (!digitsOf(phone)) return '';
      var c = COUNTRIES[this._country];
      return '+' + c.code + ' ' + phone + (this._extension ? ' ext.' + this._extension : '');
    }

    get value() {
      var c = COUNTRIES[this._country] || { code: '' };
      return {
        'country': this._country || '',
        'country-code': c.code ? '+' + c.code : '',
        'phone': this._phoneDisplay(),
        'extension': this._extension,
        'full': this._full()
      };
    }

    set value(v) { this._applyValue(v, false); this._committed = this._full(); }

    get country() { return this._country; }
    set country(iso) {
      iso = String(iso || '').toUpperCase();
      if (COUNTRIES[iso] && this._isAllowed(iso)) this._setCountry(iso, { silent: true, keepNumber: true });
    }

    get name() { return this._strAttr('name', ''); }
    set name(v) { this.setAttribute('name', v); }
    get form() { return this._internals ? this._internals.form : null; }

    focus(opts) { if (this._input) this._input.focus(opts); }

    _applyValue(v, silent) {
      if (!this._btn) return;
      var obj = v;
      if (typeof v === 'string' || v == null) {
        var parts = splitExtension(v || '');
        var intl = parseInternational(parts.main);
        obj = { extension: parts.extension };
        if (intl) { obj['country-code'] = '+' + intl.code; obj._main = parts.main; obj._intl = intl; }
        else obj.phone = parts.main;
      }
      var iso = String(obj.country || '').toUpperCase();
      var code = digitsOf(obj['country-code'] || '');
      if (!(COUNTRIES[iso] && this._isAllowed(iso))) {
        iso = null;
        if (code && BY_CODE[code]) {
          var cands = BY_CODE[code].filter(this._isAllowed, this);
          var def = this._resolveDefault();
          iso = cands.indexOf(this._country) !== -1 ? this._country : (cands.indexOf(def) !== -1 ? def : cands[0]) || null;
        }
      }
      this._country = iso || this._country || this._resolveDefault();
      this._renderCountry();
      if (obj._intl) {
        var afterCode = obj._main.replace(/^\s*(\+|00)\s*/, '');
        var seen = 0, i = 0;
        for (; i < afterCode.length && seen < obj._intl.code.length; i++) if (/\d/.test(afterCode[i])) seen++;
        this._setNational(afterCode.slice(i), true);
      } else {
        this._setNational(obj.phone || '', true);
      }
      this._extension = digitsOf(obj.extension || '');
      this._ext.value = this._extension;
      this._partialIntl = false;
      this._showInvalid = false;
      this._report();
      this._renderHelper();
      if (!silent) this.emit('change', this.value);
    }

    _afterChange(commit) {
      this._report();
      this._renderHelper();
      this.emit('input', this.value);
      if (commit) {
        var full = this._full();
        if (full !== this._committed) {
          this._committed = full;
          this.emit('change', this.value);
        }
      }
    }

    // ---- validation / form ----
    _validity() {
      var d = digitsOf(this._national);
      var c = COUNTRIES[this._country];
      if (this._partialIntl) return { flags: { patternMismatch: true }, message: 'Enter a valid country code, e.g. +44.' };
      if (!d) return this._boolAttr('required') ? { flags: { valueMissing: true }, message: 'Please enter a phone number.' } : null;
      if (c && c.lengths.length && c.lengths.indexOf(d.length) === -1) {
        return { flags: { patternMismatch: true }, message: 'Enter a valid ' + countryName(c.iso) + ' phone number.' };
      }
      return null;
    }

    _report() {
      if (!this._internals || !this._btn) return;
      // Always submitted, even when empty ("phone="), like a native input.
      this._internals.setFormValue(this._full());
      var v = this._validity();
      if (v) this._internals.setValidity(v.flags, v.message, this._input);
      else this._internals.setValidity({});
    }

    _renderHelper() {
      if (!this._helper) return;
      var error = this._strAttr('error', '');
      var v = this._showInvalid ? this._validity() : null;
      var msg = error || (v && v.message) || this._strAttr('helper', '');
      var isError = !!(error || v);
      this._helper.textContent = msg;
      this._helper.classList.toggle('error', isError);
      this.toggleAttribute('data-invalid', isError);
      if (msg) this._input.setAttribute('aria-describedby', this._helper.id); else this._input.removeAttribute('aria-describedby');
      if (isError) this._input.setAttribute('aria-invalid', 'true'); else this._input.removeAttribute('aria-invalid');
    }

    checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
    reportValidity() {
      this._showInvalid = true;
      this._renderHelper();
      return this._internals ? this._internals.reportValidity() : true;
    }

    formResetCallback() {
      this._country = null;
      this._applyValue(this._initialValue || '', true);
      this._committed = this._full();
      this._showInvalid = false;
      this._renderHelper();
    }

    formDisabledCallback(disabled) {
      this._formDisabled = disabled;
      if (this._btn) this._syncAttrs();
    }

    formStateRestoreCallback(state) {
      if (typeof state === 'string') this._applyValue(state, true);
    }

    // ---- country dropdown ----
    _setCountry(iso, opts) {
      opts = opts || {};
      if (!COUNTRIES[iso]) return;
      var changed = iso !== this._country;
      this._country = iso;
      this._renderCountry();
      if (!opts.keepNumber) this._setNational(this._input.value, false);
      if (changed && !opts.silent) {
        var c = COUNTRIES[iso];
        this.emit('country-change', { country: iso, countryCode: '+' + c.code });
        this._report();
        this._renderHelper();
        this._afterChange(true);
      } else {
        this._report();
      }
    }

    _buildList() {
      var key = this._allowed().join(',') + '|' + this._strAttr('preferred', '') + '|' + this._flagPath();
      if (this._listBuiltFor === key) return;
      this._listBuiltFor = key;
      var allowed = this._allowed();
      var preferred = this._listAttr('preferred').filter(function (iso) { return allowed.indexOf(iso) !== -1; });
      var rest = allowed.filter(function (iso) { return preferred.indexOf(iso) === -1; })
        .map(function (iso) { return { iso: iso, name: countryName(iso) }; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });
      this._entries = preferred.map(function (iso) { return { iso: iso, name: countryName(iso), preferred: true }; }).concat(rest);
      this._entries.forEach(function (e) {
        var c = COUNTRIES[e.iso];
        e.code = c.code;
        e.search = (e.name + ' ' + e.iso).toLowerCase();
      });
    }

    _filter() {
      var q = this._search.value.trim().toLowerCase();
      var dial = q.replace(/^\+/, '');
      var isDial = /^\+?\d+$/.test(q);
      this._filtered = !q ? this._entries.slice() : this._entries.filter(function (e) {
        if (isDial) return e.code.indexOf(dial) === 0;
        return e.search.indexOf(q) !== -1;
      });
      if (q) {
        // Exact ISO / name-start matches first; drop preferred duplicates.
        var seen = {};
        this._filtered = this._filtered.filter(function (e) { if (seen[e.iso]) return false; seen[e.iso] = true; return true; });
        this._filtered.sort(function (a, b) {
          var ra = a.iso.toLowerCase() === q || a.name.toLowerCase().indexOf(q) === 0 ? 0 : 1;
          var rb = b.iso.toLowerCase() === q || b.name.toLowerCase().indexOf(q) === 0 ? 0 : 1;
          return ra - rb || (isDial ? a.code.length - b.code.length : 0);
        });
      }
      this._renderList(!!q);
      var sel = -1;
      for (var i = 0; i < this._filtered.length; i++) if (this._filtered[i].iso === this._country) { sel = i; break; }
      this._setActive(q ? 0 : Math.max(sel, 0), true);
    }

    _renderList(searching) {
      var self = this;
      var esc = window.LWT.a11y.escape;
      if (!this._filtered.length) {
        this._list.innerHTML = '<li class="empty" role="presentation">No countries match</li>';
        this._search.removeAttribute('aria-activedescendant');
        return;
      }
      var lastPreferred = -1;
      if (!searching) this._filtered.forEach(function (e, i) { if (e.preferred) lastPreferred = i; });
      var idBase = this._list.id + '-';
      this._list.innerHTML = this._filtered.map(function (e, i) {
        return '<li class="option' + (i === lastPreferred ? ' last-preferred' : '') + '" role="option" id="' + idBase + i + '"' +
          ' data-iso="' + e.iso + '" data-index="' + i + '" aria-selected="' + (e.iso === self._country) + '">' +
          '<span class="flag" aria-hidden="true">' + self._flagHtml(e.iso, true) + '</span>' +
          '<span class="name">' + esc(e.name) + '</span><span class="code">+' + e.code + '</span></li>';
      }).join('');
    }

    _setActive(index, scroll) {
      var opts = this._list.querySelectorAll('.option');
      if (!opts.length) { this._activeIndex = -1; return; }
      index = Math.max(0, Math.min(opts.length - 1, index));
      if (this._activeIndex >= 0 && opts[this._activeIndex]) opts[this._activeIndex].classList.remove('active');
      this._activeIndex = index;
      var el = opts[index];
      el.classList.add('active');
      this._search.setAttribute('aria-activedescendant', el.id);
      if (scroll) el.scrollIntoView({ block: 'nearest' });
    }

    _openPopup() {
      if (this._open || this._isDisabled() || this._boolAttr('readonly')) return;
      this._buildList();
      this._open = true;
      this._popup.hidden = false;
      this._btn.setAttribute('aria-expanded', 'true');
      this._search.value = '';
      this._filter();
      var opts = this._list.querySelectorAll('.option');
      if (opts[this._activeIndex]) opts[this._activeIndex].scrollIntoView({ block: 'center' });
      this._search.focus();
    }

    _closePopup(returnFocus) {
      if (!this._open) return;
      this._open = false;
      this._popup.hidden = true;
      this._btn.setAttribute('aria-expanded', 'false');
      this._search.removeAttribute('aria-activedescendant');
      if (returnFocus) this._btn.focus();
    }

    _choose(iso) {
      this._closePopup(false);
      this._setCountry(iso, {});
      window.LWT.a11y.announce(countryName(iso) + ', +' + COUNTRIES[iso].code + ' selected.');
      this._input.focus();
    }

    _onSearchKey(e) {
      var n = this._filtered.length;
      if (e.key === 'ArrowDown') { e.preventDefault(); this._setActive(this._activeIndex + 1, true); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this._setActive(this._activeIndex - 1, true); }
      else if (e.key === 'Home' && !this._search.value) { e.preventDefault(); this._setActive(0, true); }
      else if (e.key === 'End' && !this._search.value) { e.preventDefault(); this._setActive(n - 1, true); }
      else if (e.key === 'PageDown') { e.preventDefault(); this._setActive(this._activeIndex + 8, true); }
      else if (e.key === 'PageUp') { e.preventDefault(); this._setActive(this._activeIndex - 8, true); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (this._activeIndex >= 0 && this._filtered[this._activeIndex]) this._choose(this._filtered[this._activeIndex].iso);
      }
      else if (e.key === 'Escape') { e.preventDefault(); this._closePopup(true); }
      else if (e.key === 'Tab') { this._closePopup(false); }
    }

    _onDocDown(e) {
      if (!this._open) return;
      var path = e.composedPath ? e.composedPath() : [];
      if (path.indexOf(this._popup) === -1 && path.indexOf(this._btn) === -1) this._closePopup(false);
    }
  }

  window.LWT.define('lwtf-phone', LWTPhone);
})();
