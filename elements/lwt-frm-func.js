/*!
 * LWT form helpers (window.LWT.form)
 * Functions for working with a whole <form> that mixes lwtf- elements and
 * plain native inputs. No element of its own -- it just reads the form.
 *
 *   var form = document.getElementById('signup');
 *
 *   var check = LWT.form.validate(form);    // checks every field, shows the first error
 *   if (check.valid) {
 *     var data = LWT.form.getData(form);    // { full_name: 'Jane', phone: {...}, cities: [...] }
 *     console.log(LWT.form.stringify(data)); // readable JSON (files / data URLs shortened)
 *   }
 *
 * ---------------------------------------------------------------------
 * LWT.form.getData(form, options) -> object
 * ---------------------------------------------------------------------
 *   One key per field `name`. lwtf- elements give their own typed .value
 *   (arrays for multi-selects and ranges, numbers for sliders, an object
 *   for the phone field, File objects for the dropzone). Native inputs:
 *   checkboxes/radios give their value only when checked, a multi-select
 *   gives an array, a file input gives File object(s), everything else its
 *   .value string. Several fields with the same name become an array.
 *   Disabled fields are skipped, like a native submit.
 *     options.includeDisabled — true to include disabled fields too
 *
 * ---------------------------------------------------------------------
 * LWT.form.validate(form, options) -> { valid, invalid: [{ element, name, label, message }] }
 * ---------------------------------------------------------------------
 *   Runs checkValidity() on every named, enabled field. When something is
 *   invalid it reveals the first one: opens any closed <details> around
 *   it, scrolls it into view and shows its error (reportValidity()).
 *     options.report — false to only check, without revealing anything
 *
 * ---------------------------------------------------------------------
 * LWT.form.stringify(data, options) -> string
 * ---------------------------------------------------------------------
 *   JSON.stringify(data, null, 2) made readable: File objects print as
 *   "[File] name (size bytes)" instead of {}, and long data: URLs (e.g. a
 *   signature image) are shortened.
 *     options.shorten — false to keep data: URLs in full
 *
 * `form` can be a <form> element, an element id, or a CSS selector.
 *
 * Requires lwt-core.js to be loaded first.
 */
(function () {
  'use strict';

  if (!window.LWT) {
    throw new Error('lwt-frm-func.js requires lwt-core.js to be loaded first.');
  }

  var SKIP_TYPES = { submit: 1, button: 1, reset: 1, image: 1 };

  function resolveForm(form) {
    if (typeof form === 'string') {
      form = document.getElementById(form) || document.querySelector(form);
    }
    if (!form || !form.elements) throw new Error('LWT.form: expected a <form> element, id or selector.');
    return form;
  }

  // Not every lwtf- element has a .name property, so read the attribute.
  function nameOf(el) { return el.getAttribute('name') || el.name || ''; }

  function labelOf(el) {
    return el.getAttribute('label') || el.getAttribute('aria-label') ||
      (el.labels && el.labels[0] && el.labels[0].textContent.trim()) || nameOf(el);
  }

  function isLwt(el) { return el.localName.indexOf('lwtf-') === 0; }

  // Named, value-carrying fields of the form, in document order.
  function fieldsOf(form, includeDisabled) {
    return Array.prototype.filter.call(form.elements, function (el) {
      if (!nameOf(el)) return false;
      if (el.localName === 'fieldset' || el.localName === 'output' || el.localName === 'object') return false;
      if (el.localName === 'button' || SKIP_TYPES[el.type]) return false;
      if (!includeDisabled && el.matches(':disabled')) return false;
      return true;
    });
  }

  function valueOf(el) {
    if (isLwt(el)) return el.value;
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? el.value : undefined;
    if (el.localName === 'select' && el.multiple) {
      return Array.prototype.map.call(el.selectedOptions, function (o) { return o.value; });
    }
    if (el.type === 'file') {
      var files = Array.prototype.slice.call(el.files || []);
      return el.multiple ? files : (files[0] || null);
    }
    return el.value;
  }

  function getData(form, options) {
    options = options || {};
    form = resolveForm(form);
    var data = {};
    fieldsOf(form, !!options.includeDisabled).forEach(function (el) {
      var val = valueOf(el);
      if (val === undefined) return;
      var key = nameOf(el);
      if (Object.prototype.hasOwnProperty.call(data, key)) data[key] = [].concat(data[key], val);
      else data[key] = val;
    });
    return data;
  }

  function validate(form, options) {
    options = options || {};
    form = resolveForm(form);
    var invalid = fieldsOf(form, false).filter(function (el) {
      return typeof el.checkValidity === 'function' && !el.checkValidity();
    }).map(function (el) {
      return { element: el, name: nameOf(el), label: labelOf(el), message: el.validationMessage || '' };
    });

    if (invalid.length && options.report !== false) {
      var first = invalid[0].element;
      // Open every closed <details> around the field so it can be shown.
      for (var p = first.parentElement; p; p = p.parentElement) {
        if (p.localName === 'details' && !p.open) p.open = true;
      }
      requestAnimationFrame(function () {
        first.scrollIntoView({ block: 'center' });
        if (typeof first.reportValidity === 'function') first.reportValidity();
      });
    }
    return { valid: invalid.length === 0, invalid: invalid };
  }

  function stringify(data, options) {
    options = options || {};
    var shorten = options.shorten !== false;
    return JSON.stringify(data, function (key, val) {
      if (typeof File !== 'undefined' && val instanceof File) return '[File] ' + val.name + ' (' + val.size + ' bytes)';
      if (shorten && typeof val === 'string' && val.indexOf('data:') === 0 && val.length > 80) {
        return val.slice(0, 60) + '... (' + val.length + ' chars)';
      }
      return val;
    }, 2);
  }

  window.LWT.form = window.LWT.form || {};
  window.LWT.form.getData = getData;
  window.LWT.form.validate = validate;
  window.LWT.form.stringify = stringify;
})();
