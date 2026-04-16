/**
 * popup.js
 * Controls all popup UI interactions:
 * - Context textarea and character counter
 * - Fill button with loading state
 * - API key management (save, reveal, status check)
 * - Settings panel toggle
 * - Result/status display
 */

// ─────────────────────────────────────────────
// DOM REFERENCES
// ─────────────────────────────────────────────
const contextInput        = document.getElementById('contextInput');
const charCount           = document.getElementById('charCount');
const fillBtn             = document.getElementById('fillBtn');
const fillBtnText         = document.getElementById('fillBtnText');
const resultCard          = document.getElementById('resultCard');

const settingsToggle      = document.getElementById('settingsToggle');
const settingsBody        = document.getElementById('settingsBody');
const apiKeyInput         = document.getElementById('apiKeyInput');
const toggleApiVisibility = document.getElementById('toggleApiVisibility');
const saveApiKeyBtn       = document.getElementById('saveApiKeyBtn');

const apiStatusBadge      = document.getElementById('apiStatusBadge');
const apiStatusText       = document.getElementById('apiStatusText');

// PDF upload elements
const pdfDropZone         = document.getElementById('pdfDropZone');
const pdfFileInput        = document.getElementById('pdfFileInput');
const pdfFileInfo         = document.getElementById('pdfFileInfo');
const pdfFileName         = document.getElementById('pdfFileName');
const pdfClearBtn         = document.getElementById('pdfClearBtn');

// Job Description elements
const jdToggle            = document.getElementById('jdToggle');
const jdBody              = document.getElementById('jdBody');
const jdInput             = document.getElementById('jdInput');
const jdCharCount         = document.getElementById('jdCharCount');

// Answer Questions button
const answerBtn           = document.getElementById('answerBtn');
const answerBtnText       = document.getElementById('answerBtnText');

// ─────────────────────────────────────────────
// PDF STATE
// ─────────────────────────────────────────────

/** Holds the currently selected PDF as a base64 string (or null). */
let currentPdfBase64    = null;
let currentPdfMimeType  = 'application/pdf';
let currentPdfFileName  = 'document.pdf';

// ─────────────────────────────────────────────
// PDF UPLOAD — HELPERS
// ─────────────────────────────────────────────

/**
 * Reads a File object and returns its base64-encoded string.
 * @param {File} file
 * @returns {Promise<string>} base64 data (no prefix)
 */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result is "data:application/pdf;base64,XXXX" — strip the prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read PDF file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Processes a selected PDF File: validates, reads, and updates UI.
 * @param {File} file
 */
async function handlePdfFile(file) {
  if (!file || file.type !== 'application/pdf') {
    showResult('<span class="result-card__icon">⚠️</span> Please upload a valid PDF file.', 'error');
    return;
  }

  const MAX_MB = 20;
  if (file.size > MAX_MB * 1024 * 1024) {
    showResult(`<span class="result-card__icon">⚠️</span> PDF exceeds ${MAX_MB} MB limit.`, 'error');
    return;
  }

  try {
    currentPdfBase64   = await readFileAsBase64(file);
    currentPdfMimeType = file.type;
    currentPdfFileName = file.name;

    // Update UI: hide drop zone, show file info bar
    pdfDropZone.classList.add('pdf-drop-zone--has-file');
    pdfFileInfo.classList.remove('pdf-file-info--hidden');
    pdfFileName.textContent = file.name;

    console.log(`[AI Form Filler] PDF loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
  } catch (err) {
    showResult(`<span class="result-card__icon">❌</span> ${escapeHtml(err.message)}`, 'error');
  }
}

/**
 * Clears the selected PDF and resets the upload zone.
 */
function clearPdf() {
  currentPdfBase64   = null;
  currentPdfFileName = 'document.pdf';
  pdfFileInput.value = '';
  pdfDropZone.classList.remove('pdf-drop-zone--has-file');
  pdfFileInfo.classList.add('pdf-file-info--hidden');
  pdfFileName.textContent = '';
}

// ─────────────────────────────────────────────
// PDF UPLOAD — EVENT LISTENERS
// ─────────────────────────────────────────────

// Click on drop zone → open file picker
pdfDropZone.addEventListener('click', () => pdfFileInput.click());
pdfDropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') pdfFileInput.click();
});

// File picker changed
pdfFileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handlePdfFile(e.target.files[0]);
});

// Drag & Drop
pdfDropZone.addEventListener('dragenter', (e) => {
  e.preventDefault();
  pdfDropZone.classList.add('pdf-drop-zone--dragover');
});
pdfDropZone.addEventListener('dragover', (e) => {
  e.preventDefault(); // Required to allow drop
  pdfDropZone.classList.add('pdf-drop-zone--dragover');
});
pdfDropZone.addEventListener('dragleave', () => {
  pdfDropZone.classList.remove('pdf-drop-zone--dragover');
});
pdfDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  pdfDropZone.classList.remove('pdf-drop-zone--dragover');
  const file = e.dataTransfer.files[0];
  if (file) handlePdfFile(file);
});

// Clear PDF button
pdfClearBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  clearPdf();
  hideResult();
});

// ─────────────────────────────────────────────
// RESULT CARD HELPERS
// ─────────────────────────────────────────────

/**
 * Displays the result card with a message and optional type.
 * @param {string} html - Inner HTML content for the card
 * @param {'success'|'error'|'info'} type - Visual style
 */
function showResult(html, type = 'info') {
  resultCard.innerHTML = html;
  resultCard.className = `result-card result-card--${type}`;
}

function hideResult() {
  resultCard.className = 'result-card result-card--hidden';
}

// ─────────────────────────────────────────────
// LOADING STATE
// ─────────────────────────────────────────────

/**
 * Sets the fill button into a loading state to prevent double clicks.
 */
function setLoading(isLoading) {
  fillBtn.disabled   = isLoading;
  answerBtn.disabled = isLoading;
  if (isLoading) {
    fillBtn.classList.add('btn--loading');
    fillBtnText.textContent = 'Analyzing…';
    fillBtn.querySelector('.btn-icon').textContent = '';
  } else {
    fillBtn.classList.remove('btn--loading');
    fillBtnText.textContent = 'Fill Fields';
    fillBtn.querySelector('.btn-icon').textContent = '⚡';
  }
}

function setAnswerLoading(isLoading) {
  answerBtn.disabled = isLoading;
  fillBtn.disabled   = isLoading;
  if (isLoading) {
    answerBtnText.textContent = 'Writing Answers…';
    answerBtn.querySelector('.btn-icon').textContent = '⏳';
  } else {
    answerBtnText.textContent = 'Answer Questions';
    answerBtn.querySelector('.btn-icon').textContent = '✍️';
  }
}

// ─────────────────────────────────────────────
// API STATUS CHECK
// ─────────────────────────────────────────────

/**
 * Checks if the API key is saved and updates the status badge accordingly.
 */
function checkApiKeyStatus() {
  chrome.runtime.sendMessage({ action: 'GET_API_KEY_STATUS' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      setApiStatusBadge('missing', 'No Key');
      return;
    }
    if (response.hasKey) {
      setApiStatusBadge('ok', 'API Ready');
    } else {
      setApiStatusBadge('missing', 'No Key');
    }
  });
}

/**
 * Updates the API status badge visual state.
 */
function setApiStatusBadge(state, label) {
  apiStatusBadge.className = `status-badge status-badge--${state}`;
  apiStatusText.textContent = label;
}

// ─────────────────────────────────────────────
// CHARACTER COUNTER
// ─────────────────────────────────────────────

contextInput.addEventListener('input', () => {
  charCount.textContent = contextInput.value.length;
});

// JD char counter
jdInput.addEventListener('input', () => {
  jdCharCount.textContent = jdInput.value.length;
});

// ─────────────────────────────────────────────
// JD PANEL TOGGLE
// ─────────────────────────────────────────────

jdToggle.addEventListener('click', () => {
  const isExpanded = jdToggle.getAttribute('aria-expanded') === 'true';
  jdToggle.setAttribute('aria-expanded', String(!isExpanded));
  if (isExpanded) {
    jdBody.classList.remove('jd-body--open');
    jdBody.classList.add('jd-body--collapsed');
  } else {
    jdBody.classList.remove('jd-body--collapsed');
    jdBody.classList.add('jd-body--open');
  }
});

// ─────────────────────────────────────────────
// SETTINGS PANEL TOGGLE
// ─────────────────────────────────────────────

settingsToggle.addEventListener('click', () => {
  const isExpanded = settingsToggle.getAttribute('aria-expanded') === 'true';
  settingsToggle.setAttribute('aria-expanded', String(!isExpanded));

  if (isExpanded) {
    settingsBody.classList.remove('settings-body--open');
    settingsBody.classList.add('settings-body--collapsed');
  } else {
    settingsBody.classList.remove('settings-body--collapsed');
    settingsBody.classList.add('settings-body--open');
  }
});

// ─────────────────────────────────────────────
// API KEY VISIBILITY TOGGLE
// ─────────────────────────────────────────────

toggleApiVisibility.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleApiVisibility.textContent = isPassword ? '🙈' : '👁';
});

// ─────────────────────────────────────────────
// SAVE API KEY
// ─────────────────────────────────────────────

saveApiKeyBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();

  if (!key) {
    showResult('<span class="result-card__icon">⚠️</span> Please enter a valid API key.', 'error');
    return;
  }

  if (!key.startsWith('AIza')) {
    showResult('<span class="result-card__icon">⚠️</span> Gemini API key should start with "AIza".', 'error');
    return;
  }

  chrome.runtime.sendMessage({ action: 'SAVE_API_KEY', apiKey: key }, (response) => {
    if (chrome.runtime.lastError || !response?.success) {
      showResult('<span class="result-card__icon">❌</span> Failed to save API key.', 'error');
      return;
    }
    apiKeyInput.value = '';
    apiKeyInput.type = 'password';
    toggleApiVisibility.textContent = '👁';
    setApiStatusBadge('ok', 'API Ready');
    showResult('<span class="result-card__icon">✅</span> API key saved successfully!', 'success');
  });
});

// ─────────────────────────────────────────────
// ANSWER QUESTIONS — MAIN ACTION
// ─────────────────────────────────────────────

answerBtn.addEventListener('click', async () => {
  const context = contextInput.value.trim();
  const jd      = jdInput.value.trim();

  if (!context && !currentPdfBase64) {
    showResult(
      '<span class="result-card__icon">⚠️</span> Please enter your context or upload a resume PDF first.',
      'info'
    );
    return;
  }

  hideResult();
  setAnswerLoading(true);

  try {
    const message = {
      action:  'ANSWER_QUESTIONS',
      context: context || '',
      jd:      jd || '',
    };

    if (currentPdfBase64) {
      message.pdfBase64   = currentPdfBase64;
      message.pdfMimeType = currentPdfMimeType;
      message.pdfFileName = currentPdfFileName;
    }

    chrome.runtime.sendMessage(message, (response) => {
      setAnswerLoading(false);

      if (chrome.runtime.lastError) {
        showResult(
          `<span class="result-card__icon">❌</span> Extension error: ${chrome.runtime.lastError.message}`,
          'error'
        );
        return;
      }

      if (!response?.success) {
        showResult(
          `<span class="result-card__icon">❌</span> ${escapeHtml(response?.error || 'Unknown error.')}`,
          'error'
        );
        return;
      }

      const { questionsFound, questionsFilled } = response;
      if (questionsFound === 0) {
        showResult(
          '<span class="result-card__icon">ℹ️</span> No behavioral / open-ended questions detected on this page.',
          'info'
        );
        return;
      }

      showResult(
        `<div>
          <strong>✍️ Questions answered!</strong>
          <div class="result-stats">
            <div class="stat">
              <span class="stat-value">${questionsFound}</span>
              <span class="stat-label">Found</span>
            </div>
            <div class="stat">
              <span class="stat-value">${questionsFilled}</span>
              <span class="stat-label">Filled</span>
            </div>
          </div>
        </div>`,
        'success'
      );
    });
  } catch (err) {
    setAnswerLoading(false);
    showResult(
      `<span class="result-card__icon">❌</span> Unexpected error: ${escapeHtml(err.message)}`,
      'error'
    );
  }
});

// ─────────────────────────────────────────────
// FILL FORM — MAIN ACTION
// ─────────────────────────────────────────────

fillBtn.addEventListener('click', async () => {
  const context = contextInput.value.trim();

  // Validate: need at least context OR a PDF
  if (!context && !currentPdfBase64) {
    showResult(
      '<span class="result-card__icon">⚠️</span> Please enter context text or upload a PDF.',
      'info'
    );
    return;
  }

  if (!currentPdfBase64 && context.length < 20) {
    showResult(
      '<span class="result-card__icon">⚠️</span> Context is too short. Provide more details or upload a PDF.',
      'info'
    );
    return;
  }

  hideResult();
  setLoading(true);

  try {
    // Build the message payload — include PDF if one was uploaded
    const message = {
      action: 'FILL_REQUEST',
      context: context || '', // May be empty if only PDF was provided
    };

    if (currentPdfBase64) {
      message.pdfBase64    = currentPdfBase64;
      message.pdfMimeType  = currentPdfMimeType;
      message.pdfFileName  = currentPdfFileName;
      console.log(`[AI Form Filler] Sending PDF "${currentPdfFileName}" to background...`);
    }

    // Send fill request to background service worker
    chrome.runtime.sendMessage(message, (response) => {
        setLoading(false);

        // Handle case where background didn't respond (e.g., service worker restarted)
        if (chrome.runtime.lastError) {
          showResult(
            `<span class="result-card__icon">❌</span> Extension error: ${chrome.runtime.lastError.message}`,
            'error'
          );
          return;
        }

        if (!response) {
          showResult(
            '<span class="result-card__icon">❌</span> No response from extension. Try refreshing the page.',
            'error'
          );
          return;
        }

        if (!response.success) {
          showResult(
            `<span class="result-card__icon">❌</span> ${escapeHtml(response.error || 'Unknown error occurred.')}`,
            'error'
          );
          return;
        }

        // Success — show fill statistics
        const { fieldsFound, fieldsMapped, fieldsFilled, fieldsFailed } = response;
        showResult(
          `<div>
            <strong>✅ Form filled successfully!</strong>
            <div class="result-stats">
              <div class="stat">
                <span class="stat-value">${fieldsFound}</span>
                <span class="stat-label">Found</span>
              </div>
              <div class="stat">
                <span class="stat-value">${fieldsMapped}</span>
                <span class="stat-label">Mapped</span>
              </div>
              <div class="stat">
                <span class="stat-value">${fieldsFilled}</span>
                <span class="stat-label">Filled</span>
              </div>
              ${fieldsFailed > 0 ? `<div class="stat"><span class="stat-value">${fieldsFailed}</span><span class="stat-label">Skipped</span></div>` : ''}
            </div>
          </div>`,
          'success'
        );
      }
    );
  } catch (err) {
    setLoading(false);
    showResult(
      `<span class="result-card__icon">❌</span> Unexpected error: ${escapeHtml(err.message)}`,
      'error'
    );
  }
});

// ─────────────────────────────────────────────
// UTILITY: HTML ESCAPE (prevent XSS in result card)
// ─────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────

// Check API key status on popup open
checkApiKeyStatus();

// ─── Load saved context ───────────────────────────────────────────────────────
const DEFAULT_CONTEXT = `Citizenship: Indian
Nationality: Indian
Gender: Male
Full Address: A-191/C Sainik Enclave, Vikas Nagar, Uttam Nagar, New Delhi, 110059
Address Line 1: A-191/C Sainik Enclave
Address Line 2: Vikas Nagar, Uttam Nagar
Street: A-191/C Sainik Enclave
Locality / Area: Vikas Nagar
Sub-locality: Uttam Nagar
City: New Delhi
District: West Delhi
State: Delhi
Country: India
PIN Code: 110059
Pincode: 110059
Zip Code: 110059
Preferred Job Location: Delhi NCR (Delhi, Gurgaon, Noida, Faridabad, Gurugram)
Current Location: New Delhi, Delhi
Disability: None (No disability)
Prior relation with organization: None (No prior relation / Not applicable)
Highest Education: BCA (Bachelor of Computer Applications)
Degree: BCA
Course: Bachelor of Computer Applications
Education Level: Graduate
Graduation Year: 2024
Passing Year: 2024
Expected Annual Salary: 300000
Expected CTC: 300000
Expected Salary (LPA): 3
Current Annual Salary: 120000
Current CTC: 120000
Current Salary (LPA): 1.2
Notice Period: Immediately (0 days)
Joining Availability: Immediately / Can join immediately
Available to join in (days): 0
`;

// Load previously saved context from local storage (UX quality of life)
chrome.storage.local.get(['savedContext'], (result) => {
  const saved = result.savedContext;
  if (saved && saved.trim().length > 0) {
    // User has edited context before — restore their version
    contextInput.value = saved;
  } else {
    // First time — pre-fill with the default facts
    contextInput.value = DEFAULT_CONTEXT;
    chrome.storage.local.set({ savedContext: DEFAULT_CONTEXT });
  }
  charCount.textContent = contextInput.value.length;
});

// Auto-save context to storage as user types (debounced)
let saveTimer;
contextInput.addEventListener('input', () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.local.set({ savedContext: contextInput.value });
  }, 800);
});

// Auto-save JD to storage as user types (debounced)
let jdSaveTimer;
jdInput.addEventListener('input', () => {
  clearTimeout(jdSaveTimer);
  jdSaveTimer = setTimeout(() => {
    chrome.storage.local.set({ savedJd: jdInput.value });
  }, 800);
});

// Load saved JD
chrome.storage.local.get(['savedJd'], (result) => {
  if (result.savedJd) {
    jdInput.value = result.savedJd;
    jdCharCount.textContent = result.savedJd.length;
    if (result.savedJd.trim().length > 0) {
      jdToggle.setAttribute('aria-expanded', 'true');
      jdBody.classList.remove('jd-body--collapsed');
      jdBody.classList.add('jd-body--open');
    }
  }
});

console.log('[AI Form Filler] Popup initialized.');
