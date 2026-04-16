/**
 * content.js
 * Injected into every webpage. Responsible for:
 * 1. Extracting form fields from the DOM
 * 2. Filling form fields using the AI mapping received from background
 * 3. Communicating with popup (via background) using chrome.runtime messaging
 */

// ─────────────────────────────────────────────
// SECTION 1: FIELD EXTRACTION
// ─────────────────────────────────────────────

/**
 * Generates a unique CSS selector for a DOM element.
 */
function getUniqueSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts = [];
  let current = el;
  while (current && current.nodeName !== 'BODY') {
    let selector = current.nodeName.toLowerCase();
    if (current.id) {
      selector += `#${CSS.escape(current.id)}`;
      parts.unshift(selector);
      break;
    }
    const parent = current.parentElement;
    if (parent) {
      const siblings = [...parent.children].filter((c) => c.nodeName === current.nodeName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
    parts.unshift(selector);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

/**
 * Resolves a human-readable label for a form element.
 * Priority: aria-label → aria-labelledby → <label for> → wrapping label → placeholder → name → id
 */
function resolveLabel(el) {
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();

  const labelledById = el.getAttribute('aria-labelledby');
  if (labelledById) {
    // aria-labelledby can reference multiple IDs
    const ids = labelledById.split(' ');
    const texts = ids.map((id) => {
      const ref = document.getElementById(id);
      return ref ? ref.textContent.trim() : '';
    });
    const joined = texts.filter(Boolean).join(' ');
    if (joined) return joined;
  }

  if (el.id) {
    const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (labelEl?.textContent.trim()) return labelEl.textContent.trim();
  }

  const wrapping = el.closest('label');
  if (wrapping) {
    const clone = wrapping.cloneNode(true);
    clone.querySelectorAll('input, select, textarea').forEach((n) => n.remove());
    const text = clone.textContent.trim();
    if (text) return text;
  }

  if (el.placeholder?.trim()) return el.placeholder.trim();
  if (el.name?.trim()) return el.name.trim();
  if (el.id?.trim()) return el.id.trim();

  // Google Forms: check parent containers for question text
  const questionContainer = el.closest('[data-params], .freebirdFormviewerComponentsQuestionBaseHeader');
  if (questionContainer) {
    const questionTitle = questionContainer.querySelector('.freebirdFormviewerComponentsQuestionBaseTitle, [role="heading"]');
    if (questionTitle?.textContent.trim()) return questionTitle.textContent.trim();
  }

  // Modal / dialog: walk up and look for a nearby heading or legend
  const modalRoot = el.closest('[role="dialog"], [aria-modal="true"], .modal, .dialog, [class*="modal"], [class*="dialog"]');
  if (modalRoot) {
    // Look for a <legend> or <label> or heading near the element inside the modal
    const legend = el.closest('fieldset')?.querySelector('legend');
    if (legend?.textContent.trim()) return legend.textContent.trim();

    // Check preceding sibling text elements
    let prev = el.previousElementSibling;
    while (prev) {
      const text = prev.textContent.trim();
      if (text && prev.tagName !== 'INPUT' && prev.tagName !== 'TEXTAREA') return text;
      prev = prev.previousElementSibling;
    }

    // Check the parent's label-like children
    const parentLabel = el.parentElement?.querySelector('label, [class*="label"], [class*="title"]');
    if (parentLabel?.textContent.trim()) return parentLabel.textContent.trim();
  }

  return 'Unknown Field';
}

/**
 * Checks whether an element is visible enough to interact with.
 * Standard rect check fails for elements inside modals/dialogs whose
 * wrapper has CSS transforms or is lazily painted — so we also check
 * the closest scrollable / modal ancestor.
 */
function isVisibleEnough(el) {
  // Elements inside open dialogs / modals are always considered visible
  const inModal = el.closest(
    '[role="dialog"], [aria-modal="true"], dialog[open], ' +
    '.modal, .dialog, [class*="modal"][class*="open"], ' +
    '[class*="modal"][style*="display: block"], ' +
    '[class*="modal"][style*="display:block"]'
  );
  if (inModal) return true;

  // Standard bounding rect check
  const rect = el.getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) return true;

  // Zero-size but might just be in an overflow-hidden container —
  // check if any ancestor has an explicit visible size
  let ancestor = el.parentElement;
  let depth = 0;
  while (ancestor && depth < 8) {
    const r = ancestor.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return true;
    ancestor = ancestor.parentElement;
    depth++;
  }

  return false;
}

/**
 * Extracts all interactive form fields from the current page DOM.
 * Handles standard forms, Google Forms, and fields inside modal/dialog overlays.
 * File inputs are ALWAYS extracted regardless of visibility (they are
 * intentionally hidden via CSS on virtually every modern job application site).
 * Returns a structured array of field descriptors.
 */
function extractFormFields() {
  const fields = [];
  const seenSelectors = new Set();

  const querySelectors = [
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="file"])',
    'textarea',
    'select',
    '[role="textbox"]',
    '[role="combobox"]',
    '[role="listbox"]',
    '[role="radio"]',
    '[role="checkbox"]',
  ].join(', ');

  // Primary pass: entire document (non-file inputs only)
  const elements = document.querySelectorAll(querySelectors);

  // Secondary pass: explicitly inside known modal containers
  const modalContainers = document.querySelectorAll(
    '[role="dialog"], [aria-modal="true"], dialog, ' +
    '.modal-content, .modal-body, .dialog-content, ' +
    '[class*="modal"], [class*="dialog"], [class*="overlay"], [class*="drawer"]'
  );
  const modalElements = [];
  modalContainers.forEach((container) => {
    container.querySelectorAll(querySelectors).forEach((el) => modalElements.push(el));
  });

  // Merge passes — deduplication via seenSelectors below
  const allElements = [...elements, ...modalElements];

  allElements.forEach((el) => {
    if (el.disabled || el.readOnly) return;
    if (!isVisibleEnough(el)) return;

    const label    = resolveLabel(el);
    const selector = getUniqueSelector(el);
    if (seenSelectors.has(selector)) return;
    seenSelectors.add(selector);

    let type = el.getAttribute('type') || el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    if (role) type = role;

    const descriptor = { label, type, selector };
    if (el.tagName === 'SELECT') {
      descriptor.options = [...el.options].map((o) => o.text.trim()).filter(Boolean);
    }
    fields.push(descriptor);
  });

  // ─────────────────────────────────────────────────
  // Dedicated FILE-INPUT PASS — always extract ALL file inputs,
  // even if hidden (display:none / visibility:hidden / opacity:0).
  // Job sites commonly hide the native <input type="file"> and show
  // a styled button on top — the input is still functional.
  // ─────────────────────────────────────────────────
  document.querySelectorAll('input[type="file"]').forEach((el) => {
    if (el.disabled) return;

    const selector = getUniqueSelector(el);
    if (seenSelectors.has(selector)) return;
    seenSelectors.add(selector);

    // Label resolution for file inputs:
    // Many sites hide the input and put a visible button next to it.
    // Try the standard resolveLabel first, then look for the sibling button text.
    let label = resolveLabel(el);
    if (!label || label === 'Unknown Field') {
      // Check nearby visible button text (the styled upload button)
      const parent = el.parentElement;
      if (parent) {
        const btn = parent.querySelector('button, [role="button"], label');
        if (btn?.textContent.trim()) label = btn.textContent.trim();
      }
      // Walk up one more level if still unknown
      if (!label || label === 'Unknown Field') {
        const grandParent = el.parentElement?.parentElement;
        if (grandParent) {
          const btn = grandParent.querySelector('button, [role="button"], label, [class*="upload"], [class*="resume"]');
          if (btn?.textContent.trim()) label = btn.textContent.trim();
        }
      }
    }
    if (!label || label === 'Unknown Field') label = 'Resume Upload';

    fields.push({ label, type: 'file', selector });
    console.log(`[AI Form Filler] File input found: "${label}" (${selector})`);
  });

  console.log(`[AI Form Filler] Extracted ${fields.length} fields total (incl. file inputs).`, fields);
  return fields;
}

// ─────────────────────────────────────────────
// SECTION 2: FORM FILLING
// ─────────────────────────────────────────────

/**
 * Triggers native browser events on an element to ensure frameworks
 * (React, Angular, Vue, Google Forms) register the value change.
 */
function triggerNativeEvents(el) {
  ['input', 'change', 'blur'].forEach((eventType) => {
    el.dispatchEvent(new Event(eventType, { bubbles: true }));
  });
  // Also dispatch a keyboard event for frameworks listening to keyup
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
}

/**
 * Sets the value of a React-controlled input by bypassing the virtual DOM.
 * Necessary for inputs managed by React's synthetic event system.
 */
function setReactNativeValue(el, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  const nativeTextareaSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
  )?.set;

  if (el.tagName === 'TEXTAREA' && nativeTextareaSetter) {
    nativeTextareaSetter.call(el, value);
  } else if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value);
  } else {
    el.value = value;
  }
}

/**
 * Injects a PDF into a <input type="file"> using the DataTransfer API.
 * Fires multiple events to ensure React/Angular/Vue upload handlers trigger.
 * @param {Element} el       - The file input element
 * @param {string}  base64   - Base64-encoded file content
 * @param {string}  mimeType - MIME type (e.g. 'application/pdf')
 * @param {string}  fileName - The filename to show
 */
function fillFileInput(el, base64, mimeType, fileName) {
  try {
    // Decode base64 → ArrayBuffer → Blob → File
    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeType });
    const file = new File([blob], fileName, { type: mimeType, lastModified: Date.now() });

    // Inject via DataTransfer (only reliable way to set files programmatically)
    const dt = new DataTransfer();
    dt.items.add(file);
    el.files = dt.files;

    // Validate the file was actually set
    if (!el.files || el.files.length === 0) {
      console.warn('[AI Form Filler] DataTransfer injection failed — files not set.');
      return;
    }

    // Fire a comprehensive set of events to cover all framework scenarios:
    // React uses SyntheticEvents backed by native events
    // Angular uses change + input
    // Vue uses change
    // Custom handlers often listen to change on the input or the label
    el.dispatchEvent(new Event('focus',      { bubbles: true }));
    el.dispatchEvent(new Event('change',     { bubbles: true }));
    el.dispatchEvent(new Event('input',      { bubbles: true }));
    el.dispatchEvent(new Event('blur',       { bubbles: true }));

    // Also fire on any associated <label> (for custom-styled upload buttons)
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) {
        label.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    console.log(`[AI Form Filler] ✅ File injected: "${fileName}" → ${el.files[0]?.name} (${(el.files[0]?.size / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error('[AI Form Filler] Failed to inject file into input:', err);
  }
}

/**
 * Fills a single form element with the given value.
 * Handles text, textarea, select, radio, checkbox, file, and Google Forms role-based elements.
 * @param {Element} el - The DOM element to fill
 * @param {string} value - The value to set
 * @param {Object|null} pdfData - { base64, mimeType, fileName } — used for file inputs
 */
function fillElement(el, value, pdfData = null) {
  const tag = el.tagName.toLowerCase();
  const type = (el.getAttribute('type') || '').toLowerCase();
  const role = (el.getAttribute('role') || '').toLowerCase();

  try {
    if (type === 'file') {
      // Inject the uploaded PDF directly into the file input
      if (pdfData?.base64) {
        fillFileInput(el, pdfData.base64, pdfData.mimeType, pdfData.fileName);
      } else {
        console.warn('[AI Form Filler] File input detected but no PDF uploaded in extension.');
      }
    } else if (tag === 'select') {
      // Find best-matching option (case-insensitive)
      const optionToSelect = [...el.options].find(
        (o) => o.text.toLowerCase() === value.toLowerCase() || o.value.toLowerCase() === value.toLowerCase()
      );
      if (optionToSelect) {
        el.value = optionToSelect.value;
        triggerNativeEvents(el);
      } else {
        console.warn(`[AI Form Filler] No matching option for select: "${value}"`);
      }
    } else if (type === 'checkbox') {
      const shouldCheck = ['true', 'yes', '1', 'checked', 'on'].includes(value.toLowerCase());
      if (el.checked !== shouldCheck) {
        el.click(); // Use click to trigger native checkbox toggle
      }
    } else if (type === 'radio') {
      // Find the radio button matching the value
      const name = el.name;
      if (name) {
        const matchingRadio = document.querySelector(
          `input[type="radio"][name="${CSS.escape(name)}"][value="${CSS.escape(value)}"]`
        );
        if (matchingRadio) {
          matchingRadio.click();
        }
      } else {
        // If no name, check if value matches label
        const labelText = resolveLabel(el).toLowerCase();
        if (labelText.includes(value.toLowerCase())) {
          el.click();
        }
      }
    } else if (role === 'textbox' || role === 'combobox') {
      // Google Forms uses contenteditable divs with role="textbox"
      el.focus();
      if (el.isContentEditable) {
        el.textContent = value;
        triggerNativeEvents(el);
      } else {
        setReactNativeValue(el, value);
        triggerNativeEvents(el);
      }
    } else if (tag === 'input' || tag === 'textarea') {
      el.focus();
      setReactNativeValue(el, value);
      triggerNativeEvents(el);
    } else if (el.isContentEditable) {
      el.focus();
      el.textContent = value;
      triggerNativeEvents(el);
    }

    console.log(`[AI Form Filler] Filled field: value="${value}"`);
  } catch (err) {
    console.error(`[AI Form Filler] Error filling element:`, err);
  }
}

// ─────────────────────────────────────────────
// SECTION 3: FUZZY MATCHING
// ─────────────────────────────────────────────

/**
 * Normalizes a label string for comparison (lowercase, remove special chars).
 */
function normalizeLabel(label) {
  return label.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

/**
 * Calculates a simple similarity score between two strings.
 * Uses substring containment and word overlap.
 * @returns {number} - Score between 0 and 1
 */
function similarityScore(a, b) {
  const normA = normalizeLabel(a);
  const normB = normalizeLabel(b);
  if (normA === normB) return 1.0;
  if (normA.includes(normB) || normB.includes(normA)) return 0.8;

  const wordsA = new Set(normA.split(/\s+/));
  const wordsB = new Set(normB.split(/\s+/));
  const intersection = [...wordsA].filter((w) => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.length / union.size; // Jaccard similarity
}

/**
 * Finds the best matching field selector from the extracted fields
 * for a given GPT-returned key using fuzzy matching.
 * @param {string} gptKey - The field name returned by GPT
 * @param {Array<Object>} fields - Extracted field descriptors
 * @returns {Object|null} - The best matching field descriptor or null
 */
function findBestMatch(gptKey, fields) {
  let bestMatch = null;
  let bestScore = 0.3; // Minimum threshold for a match

  fields.forEach((field) => {
    const score = similarityScore(gptKey, field.label);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = field;
    }
  });

  if (bestMatch) {
    console.log(`[AI Form Filler] Matched "${gptKey}" → "${bestMatch.label}" (score: ${bestScore.toFixed(2)})`);
  } else {
    console.warn(`[AI Form Filler] No match found for key: "${gptKey}"`);
  }

  return bestMatch;
}

// ─────────────────────────────────────────────
// SECTION 4: FILL FORM WITH MAPPING
// ─────────────────────────────────────────────

/**
 * Main function to fill all matched form fields using the AI mapping.
 * @param {Object} mapping   - { "Field Name": "Value" } from Gemini
 * @param {Array}  fields    - Extracted field descriptors
 * @param {Object} pdfData   - { base64, mimeType, fileName } for file inputs
 */
function fillFormWithMapping(mapping, fields, pdfData = null) {
  let filled = 0;
  let failed = 0;

  Object.entries(mapping).forEach(([gptKey, value]) => {
    if (!value || String(value).trim() === '') return;

    const matchedField = findBestMatch(gptKey, fields);
    if (!matchedField) {
      failed++;
      return;
    }

    const el = document.querySelector(matchedField.selector);
    if (!el) {
      console.warn(`[AI Form Filler] Element not found for selector: ${matchedField.selector}`);
      failed++;
      return;
    }

    fillElement(el, String(value), pdfData);
    filled++;
  });

  // Also attempt to fill any unmatched file inputs directly with the PDF
  if (pdfData?.base64) {
    fields.forEach((field) => {
      if (field.type === 'file') {
        const alreadyMapped = Object.keys(mapping).some(
          (k) => similarityScore(k, field.label) >= 0.3
        );
        if (!alreadyMapped) {
          const el = document.querySelector(field.selector);
          if (el) {
            fillFileInput(el, pdfData.base64, pdfData.mimeType, pdfData.fileName);
            filled++;
            console.log(`[AI Form Filler] Auto-injected PDF into unmapped file input: "${field.label}"`);
          }
        }
      }
    });
  }

  console.log(`[AI Form Filler] Fill complete. Filled: ${filled}, Failed: ${failed}`);
  return { filled, failed };
}

// ─────────────────────────────────────────────
// SECTION 5: MESSAGE LISTENER
// ─────────────────────────────────────────────

/**
 * Listen for messages from background script or popup.
 * Handles:
 * - "EXTRACT_FIELDS": extracts and returns form fields
 * - "FILL_FORM": fills the form using the provided mapping
 * - "PING": health check to verify content script is loaded
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[AI Form Filler] Message received in content script:', message.action);

  if (message.action === 'PING') {
    sendResponse({ status: 'alive' });
    return true;
  }

  if (message.action === 'EXTRACT_FIELDS') {
    try {
      const fields = extractFormFields();
      sendResponse({ success: true, fields });
    } catch (err) {
      console.error('[AI Form Filler] Field extraction error:', err);
      sendResponse({ success: false, error: err.message });
    }
    return true; // Keep channel open for async
  }

  if (message.action === 'FILL_FORM') {
    try {
      const { mapping, fields, pdfBase64, pdfMimeType, pdfFileName } = message;

      // Bundle PDF data for file input injection
      const pdfData = pdfBase64
        ? { base64: pdfBase64, mimeType: pdfMimeType || 'application/pdf', fileName: pdfFileName || 'document.pdf' }
        : null;

      const result = fillFormWithMapping(mapping, fields, pdfData);
      sendResponse({ success: true, ...result });
    } catch (err) {
      console.error('[AI Form Filler] Form fill error:', err);
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }
});

console.log('[AI Form Filler] Content script loaded and ready.');
