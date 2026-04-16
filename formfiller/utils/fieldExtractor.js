/**
 * fieldExtractor.js
 * Utility module responsible for extracting all interactive form fields
 * from the current page DOM, including Google Forms support.
 */

/**
 * Generates a unique CSS selector for a given DOM element.
 * Used to re-locate the element when filling values later.
 * @param {Element} el - The target DOM element
 * @returns {string} - A unique CSS selector string
 */
function getUniqueSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;

  // Build a path from the element up to the body
  const parts = [];
  let current = el;
  while (current && current.nodeName !== 'BODY') {
    let selector = current.nodeName.toLowerCase();
    if (current.id) {
      selector += `#${CSS.escape(current.id)}`;
      parts.unshift(selector);
      break;
    } else {
      const parent = current.parentElement;
      if (parent) {
        // Find index among siblings of same tag
        const siblings = [...parent.children].filter(
          (c) => c.nodeName === current.nodeName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }
      parts.unshift(selector);
      current = current.parentElement;
    }
  }

  return parts.join(' > ');
}

/**
 * Resolves the human-readable label for a given form element.
 * Priority: aria-label → associated <label> → placeholder → name → id
 * @param {Element} el - The target form element
 * @returns {string} - The resolved label string
 */
function resolveLabel(el) {
  // 1. aria-label attribute (highest priority, used heavily by Google Forms)
  if (el.getAttribute('aria-label')) {
    return el.getAttribute('aria-label').trim();
  }

  // 2. aria-labelledby — find the referenced element's text
  const labelledById = el.getAttribute('aria-labelledby');
  if (labelledById) {
    const labelEl = document.getElementById(labelledById);
    if (labelEl && labelEl.textContent.trim()) {
      return labelEl.textContent.trim();
    }
  }

  // 3. Associated <label for="id"> element
  if (el.id) {
    const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (labelEl && labelEl.textContent.trim()) {
      return labelEl.textContent.trim();
    }
  }

  // 4. Wrapping <label> element ancestor
  const wrappingLabel = el.closest('label');
  if (wrappingLabel) {
    // Get text content excluding the input's own value
    const clone = wrappingLabel.cloneNode(true);
    clone.querySelectorAll('input, select, textarea').forEach((n) => n.remove());
    const text = clone.textContent.trim();
    if (text) return text;
  }

  // 5. placeholder attribute
  if (el.placeholder && el.placeholder.trim()) {
    return el.placeholder.trim();
  }

  // 6. name attribute
  if (el.name && el.name.trim()) {
    return el.name.trim();
  }

  // 7. id attribute as last resort
  if (el.id && el.id.trim()) {
    return el.id.trim();
  }

  return 'Unknown Field';
}

/**
 * Extracts all relevant form fields from the page.
 * Handles standard HTML forms and dynamic Google Forms structures.
 * @returns {Array<Object>} - Array of field descriptor objects
 */
function extractFormFields() {
  const fields = [];
  const seenSelectors = new Set();

  // Query all interactive form elements
  const selectors = [
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"])',
    'textarea',
    'select',
    // Google Forms uses role="listbox" and role="radio" on divs
    '[role="listbox"]',
    '[role="radiogroup"]',
    '[role="checkbox"]',
  ];

  const elements = document.querySelectorAll(selectors.join(', '));

  elements.forEach((el) => {
    // Skip invisible elements
    if (!el.offsetParent && el.type !== 'hidden') {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
    }

    // Skip disabled elements
    if (el.disabled) return;

    // Determine element type
    let type = el.type || el.tagName.toLowerCase();
    if (el.getAttribute('role') === 'listbox') type = 'select';
    if (el.getAttribute('role') === 'radiogroup') type = 'radio';
    if (el.getAttribute('role') === 'checkbox') type = 'checkbox';

    const label = resolveLabel(el);
    const selector = getUniqueSelector(el);

    // Avoid duplicate fields by selector
    if (seenSelectors.has(selector)) return;
    seenSelectors.add(selector);

    const fieldDescriptor = {
      label,
      type,
      selector,
    };

    // For select/radio, also capture available options
    if (el.tagName === 'SELECT') {
      fieldDescriptor.options = [...el.options].map((o) => o.text.trim());
    }

    fields.push(fieldDescriptor);
    console.log(`[AI Form Filler] Extracted field: "${label}" (${type})`);
  });

  console.log(`[AI Form Filler] Total fields extracted: ${fields.length}`);
  return fields;
}

// Export for use in content.js (loaded as regular script, not ES module)
// We attach to window so content.js can access it
if (typeof window !== 'undefined') {
  window.fieldExtractor = { extractFormFields, resolveLabel, getUniqueSelector };
}
