/**
 * background.js (Service Worker)
 * Handles all secure API communication.
 * Acts as the trusted intermediary between popup and content script.
 *
 * Flow:
 *   Popup → background (FILL_REQUEST with context)
 *   background → active tab content script (EXTRACT_FIELDS)
 *   background → Gemini API (fields + context)
 *   background → active tab content script (FILL_FORM with mapping)
 *   background → popup (result/status)
 */

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────

/**
 * Google Gemini API configuration.
 * The API key is stored in chrome.storage.local (managed via popup settings).
 * Pre-seeded with the user's Gemini API key as the default.
 */
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_API_KEY = 'AIzaSyDLSW1UsmzUybMG7E3xvjaQWAIKSlovLTs';

// ─────────────────────────────────────────────
// API KEY MANAGEMENT
// ─────────────────────────────────────────────

/**
 * Retrieves the Gemini API key from Chrome's local storage.
 * Falls back to the DEFAULT_API_KEY if none has been saved yet.
 */
async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiKey'], (result) => {
      resolve(result.apiKey || DEFAULT_API_KEY);
    });
  });
}

// ─────────────────────────────────────────────
// GEMINI PROMPT BUILDER
// ─────────────────────────────────────────────

/**
 * Constructs a structured Gemini prompt for field mapping.
 * @param {string} context - Unstructured user data (may be empty if PDF is provided)
 * @param {Array<Object>} fields - Extracted form fields
 * @param {boolean} hasPdf - Whether a PDF is being sent alongside
 * @returns {string} - Formatted prompt string
 */
function buildPrompt(context, fields, hasPdf = false) {
  const fieldList = fields
    .map((f, i) => {
      let entry = `${i + 1}. "${f.label}" (type: ${f.type})`;
      if (f.options && f.options.length > 0) {
        entry += ` [options: ${f.options.slice(0, 10).join(', ')}]`;
      }
      return entry;
    })
    .join('\n');

  const dataSource = hasPdf
    ? 'The user has provided a PDF document (attached). Extract all relevant personal information from it.'
    : 'The user has provided the following personal data as text.';

  const contextSection = context
    ? `User Context (Text):\n${context}`
    : '(No additional text context provided — use only the PDF.)';

  return `You are a smart form-filling assistant. Given the user's personal data and a list of form fields, map the data to the appropriate fields.

${dataSource}

Rules:
- Return ONLY valid JSON. No markdown, no explanation, no extra text.
- Keys must EXACTLY match the field labels provided.
- Only include fields you have relevant data for.
- For checkboxes/radio buttons, use "yes"/"no" or the matching option text.
- For dropdowns, use the exact option text from the provided list.
- If you don't have data for a field, omit it from the response.
- NUMERIC FIELDS: If the field type is "number", or the label relates to salary/CTC/experience/age/pincode/percentage/score/phone, return ONLY the raw number with NO units, NO commas, NO currency symbols, NO text (e.g. 300000 not "3 LPA", 1234567890 not "+91-1234567890").
- JOINING / NOTICE PERIOD: For any field asking about notice period, joining time, or availability to join, always prefer "Immediately" or "0" or the option with the fewest days (choose whichever is lowest, between 0–15 days). Never select options above 15 days.
- LOCATION: For preferred location fields, prefer Delhi, Gurgaon, Noida, or Delhi NCR. If multiple selections allowed, include all of them.
- GENDER: Always select "Male" or the equivalent option.

${contextSection}

Form Fields:
${fieldList}

Return ONLY valid JSON like:
{
  "Field Label": "Mapped Value"
}`;
}

// ─────────────────────────────────────────────
// QA PROMPT BUILDER + QUESTION DETECTOR
// ─────────────────────────────────────────────

/**
 * Keywords that indicate a field is a behavioral/personal open-ended question.
 * Any textarea whose label matches one of these is treated as a question field.
 */
const QUESTION_KEYWORDS = [
  'tell', 'describe', 'explain', 'write', 'share', 'discuss',
  'why', 'how did', 'what motivated', 'what drives', 'what are your',
  'cover letter', 'about yourself', 'about you', 'strength', 'weakness',
  'motivation', 'goal', 'achievement', 'experience', 'background',
  'interest', 'objective', 'summary', 'profile', 'expect', 'contribute',
  'aspiration', 'challenge', 'situation', 'behavior', 'example',
  'time when', 'passion', 'career', 'skill', 'qualify', 'fit',
  'message', 'note', 'additional', 'anything else', 'remarks',
  // "Why should you be hired" variants
  'why should we hire', 'why hire you', 'why should you be hired',
  'why are you the best', 'why are you suitable', 'why are you a good fit',
  'why do you deserve', 'what makes you the right', 'what makes you stand out',
  'why choose you', 'why should i hire', 'reason we should hire',
];

/**
 * Returns true if a field descriptor looks like an open-ended question.
 *
 * Rules:
 *  - <textarea> / role="textbox" (multi-line) → ALWAYS a question field.
 *    Every multi-line box on a job form is either a cover letter, message,
 *    or behavioral answer box — no keyword check needed.
 *  - <input type="text"> → only if label matches question keywords,
 *    so we don't accidentally try to "answer" Name / Email fields.
 */
function isQuestionField(field) {
  const type = (field.type || '').toLowerCase();

  // Multi-line → unconditionally a question field
  if (type === 'textarea') return true;

  // role="textbox" could be a single or multi-line contenteditable.
  // Treat it as a question only if the label is a question keyword.
  const label = field.label.toLowerCase();
  if (type === 'textbox') {
    return QUESTION_KEYWORDS.some((kw) => label.includes(kw));
  }

  // Single-line text input → keyword filter
  if (type === 'text') {
    return QUESTION_KEYWORDS.some((kw) => label.includes(kw));
  }

  return false;
}

/**
 * Builds the QA prompt sent to Gemini for writing 100-200 word answers.
 * @param {string} context   - User personal context
 * @param {string} jd        - Job description / candidate requirements
 * @param {Array}  questions - Array of { label } question field descriptors
 * @param {boolean} hasPdf   - Whether a resume PDF is attached
 */
function buildQAPrompt(context, jd, questions, hasPdf) {
  const questionList = questions
    .map((q, i) => `${i + 1}. "${q.label}"`)
    .join('\n');

  const resumeNote = hasPdf
    ? 'A resume PDF is attached — use its content as the primary source for experience, skills, and achievements.'
    : '';

  const jdSection = jd
    ? `Job Description / Candidate Requirements:\n${jd}`
    : '(No job description provided — write general professional answers.)';

  return `You are an expert career coach and professional writer. Write answers to the following application/interview questions on behalf of the candidate.

${resumeNote}

Candidate Personal Context:
${context || '(See attached resume)'}

${jdSection}

Instructions:
- Write each answer in 100 to 200 words. Never go below 100 or above 200 words.
- Write in first person ("I", "my", "me").
- Sound professional, confident, and genuine.
- Tailor each answer to the job description when provided.
- Highlight relevant skills, achievements, and motivation from the resume.
- For notice period / joining questions: state "I can join immediately."
- For salary questions: do not answer with full sentences — let the form fill handle those.
- For education/degree mentions: say "I am a BCA graduate" or "I hold a BCA degree" — do NOT mention the specific graduation year (2024) in written answers.
- Do NOT include the question text in your answer, just the answer itself.

Questions to answer:
${questionList}

Return ONLY valid JSON where keys EXACTLY match the question labels:
{
  "Question Label": "Your 100-200 word answer here"
}`;
}

// ─────────────────────────────────────────────
// GEMINI API CALL
// ─────────────────────────────────────────────

/**
 * Calls the Google Gemini generateContent API.
 * Supports both text-only and multimodal (PDF + text) requests.
 * @param {string} context - User context string (may be empty string if only PDF)
 * @param {Array<Object>} fields - Extracted form fields
 * @param {string|null} pdfBase64 - Optional base64-encoded PDF content
 * @param {string} pdfMimeType - MIME type of the PDF (default: application/pdf)
 * @returns {Object} - Parsed mapping object { "Field": "Value" }
 */
async function callGeminiApi(context, fields, pdfBase64 = null, pdfMimeType = 'application/pdf') {
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error('API key not set. Please add your Gemini API key in the extension settings.');
  }

  const hasPdf = !!pdfBase64;
  const prompt = buildPrompt(context, fields, hasPdf);
  const endpoint = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  console.log(`[AI Form Filler BG] Calling Gemini API (PDF: ${hasPdf})...`);

  // Build the parts array — always include the text prompt,
  // and optionally prepend the PDF as inline_data
  const parts = [];

  if (hasPdf) {
    parts.push({
      inline_data: {
        mime_type: pdfMimeType,
        data: pdfBase64,
      },
    });
  }

  parts.push({ text: prompt });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts, // Contains optional PDF inline_data + text prompt
        },
      ],
      generationConfig: {
        temperature: 0.1,       // Low temperature → deterministic, accurate output
        maxOutputTokens: 8192,  // Large enough for any form mapping response
        responseMimeType: 'application/json', // Request JSON output directly
      },
      systemInstruction: {
        parts: [{ text: 'You are a form-filling assistant. Always respond with valid JSON only. No markdown, no explanation.' }],
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[AI Form Filler BG] Gemini API error response:', errorBody);
    throw new Error(`Gemini API failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Extract text from Gemini's response structure
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!content) {
    throw new Error('Gemini returned an empty response.');
  }

  console.log('[AI Form Filler BG] Gemini raw response:', content);

  // Parse the JSON response — strip markdown code fences if present
  let mapping;
  try {
    const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    mapping = JSON.parse(cleaned);
  } catch (parseErr) {
    throw new Error(`Failed to parse Gemini response as JSON: ${content}`);
  }

  return mapping;
}

// ─────────────────────────────────────────────
// TAB COMMUNICATION HELPERS
// ─────────────────────────────────────────────

/**
 * Sends a message to the content script on the active tab.
 * @param {number} tabId - The active tab ID
 * @param {Object} message - Message payload
 * @returns {Promise<Object>} - Response from content script
 */
function sendToContentScript(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

/**
 * Injects the content script into the tab if it isn't already injected.
 * Used as a fallback when the content script is not loaded.
 */
async function ensureContentScriptInjected(tabId) {
  try {
    // Ping the content script to check if it's alive
    await sendToContentScript(tabId, { action: 'PING' });
  } catch {
    // Content script not injected yet — inject it now
    console.log('[AI Form Filler BG] Injecting content script into tab', tabId);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
    // Small delay to let the script initialize
    await new Promise((r) => setTimeout(r, 300));
  }
}

// ─────────────────────────────────────────────
// MAIN ORCHESTRATION
// ─────────────────────────────────────────────

/**
 * Full flow: extract fields → call Gemini → fill form.
 * @param {string} context - User context text
 * @param {number} tabId - Active tab ID
 * @param {string|null} pdfBase64 - Optional PDF as base64
 * @param {string} pdfMimeType - PDF mime type
 * @returns {Object} - Result summary
 */
async function runFormFillFlow(context, tabId, pdfBase64 = null, pdfMimeType = 'application/pdf', pdfFileName = 'document.pdf') {
  // Step 1: Ensure content script is injected
  await ensureContentScriptInjected(tabId);

  // Step 2: Extract form fields from the active tab
  console.log('[AI Form Filler BG] Extracting fields from tab', tabId);
  const extractResponse = await sendToContentScript(tabId, { action: 'EXTRACT_FIELDS' });

  if (!extractResponse?.success) {
    throw new Error(`Field extraction failed: ${extractResponse?.error || 'Unknown error'}`);
  }

  const fields = extractResponse.fields;
  if (!fields || fields.length === 0) {
    throw new Error('No form fields found on this page.');
  }

  console.log(`[AI Form Filler BG] Got ${fields.length} fields. Calling Gemini...`);

  // Step 3: Call Gemini API (with optional PDF) to get the field mapping
  const mapping = await callGeminiApi(context, fields, pdfBase64, pdfMimeType);
  console.log('[AI Form Filler BG] Received mapping from Gemini:', mapping);

  if (!mapping || Object.keys(mapping).length === 0) {
    throw new Error('Gemini returned an empty mapping. Please provide more detailed context.');
  }

  // Step 4: Fill the form using the mapping, passing PDF data for file inputs
  const fillResponse = await sendToContentScript(tabId, {
    action: 'FILL_FORM',
    mapping,
    fields,
    pdfBase64,
    pdfMimeType,
    pdfFileName,
  });

  if (!fillResponse?.success) {
    throw new Error(`Form fill failed: ${fillResponse?.error || 'Unknown error'}`);
  }

  return {
    fieldsFound: fields.length,
    fieldsMapped: Object.keys(mapping).length,
    fieldsFilled: fillResponse.filled,
    fieldsFailed: fillResponse.failed,
  };
}

// ─────────────────────────────────────────────
// ANSWER QUESTIONS FLOW
// ─────────────────────────────────────────────

/**
 * Extracts question fields, writes 100-200 word answers via Gemini, fills them.
 */
async function runAnswerQuestionsFlow(context, jd, tabId, pdfBase64, pdfMimeType, pdfFileName) {
  await ensureContentScriptInjected(tabId);

  // Extract ALL fields first
  const extractResponse = await sendToContentScript(tabId, { action: 'EXTRACT_FIELDS' });
  if (!extractResponse?.success) {
    throw new Error(`Field extraction failed: ${extractResponse?.error || 'Unknown error'}`);
  }

  // Filter to only question-like fields
  const allFields     = extractResponse.fields || [];
  const questionFields = allFields.filter(isQuestionField);

  console.log(`[AI Form Filler BG] Question fields found: ${questionFields.length} / ${allFields.length}`);

  if (questionFields.length === 0) {
    return { questionsFound: 0, questionsFilled: 0 };
  }

  // Build QA prompt and call Gemini
  const hasPdf = !!pdfBase64;
  const prompt = buildQAPrompt(context, jd, questionFields, hasPdf);

  // Reuse callGeminiApi but with QA-specific prompt already embedded
  // We call it directly with a fake field list wrapping our question fields
  const apiKey  = await getApiKey();
  const endpoint = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const parts = [];
  if (hasPdf) {
    parts.push({ inline_data: { mime_type: pdfMimeType, data: pdfBase64 } });
  }
  parts.push({ text: prompt });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.7,       // Higher temp — more natural, varied writing
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
      systemInstruction: {
        parts: [{ text: 'You are a professional career writer. Return only valid JSON with question labels as keys and written answers as values.' }],
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini QA API failed: ${response.status} — ${err}`);
  }

  const data    = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!content) throw new Error('Gemini returned empty QA response.');

  let mapping;
  try {
    const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    mapping = JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse QA response as JSON: ${content}`);
  }

  console.log('[AI Form Filler BG] QA mapping from Gemini:', mapping);

  // Fill only the question fields
  const pdfData = pdfBase64
    ? { base64: pdfBase64, mimeType: pdfMimeType, fileName: pdfFileName }
    : null;

  const fillResponse = await sendToContentScript(tabId, {
    action: 'FILL_FORM',
    mapping,
    fields:  questionFields,
    pdfBase64,
    pdfMimeType,
    pdfFileName,
  });

  return {
    questionsFound:  questionFields.length,
    questionsFilled: fillResponse?.filled || 0,
  };
}

// ─────────────────────────────────────────────
// MESSAGE LISTENER
// ─────────────────────────────────────────────

/**
 * Listen for messages from the popup.
 * Handles:
 * - FILL_REQUEST: orchestrate the full form-fill flow
 * - SAVE_API_KEY: save API key to local storage
 * - GET_API_KEY_STATUS: check if API key is configured
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[AI Form Filler BG] Message received:', message.action);

  if (message.action === 'SAVE_API_KEY') {
    chrome.storage.local.set({ apiKey: message.apiKey }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === 'GET_API_KEY_STATUS') {
    chrome.storage.local.get(['apiKey'], (result) => {
      sendResponse({ hasKey: !!result.apiKey });
    });
    return true;
  }

  if (message.action === 'FILL_REQUEST') {
    const { context, pdfBase64 = null, pdfMimeType = 'application/pdf', pdfFileName = 'document.pdf' } = message;

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) { sendResponse({ success: false, error: 'No active tab found.' }); return; }
      try {
        const result = await runFormFillFlow(context, activeTab.id, pdfBase64, pdfMimeType, pdfFileName);
        sendResponse({ success: true, ...result });
      } catch (err) {
        console.error('[AI Form Filler BG] Flow error:', err);
        sendResponse({ success: false, error: err.message });
      }
    });
    return true;
  }

  if (message.action === 'ANSWER_QUESTIONS') {
    const {
      context    = '',
      jd         = '',
      pdfBase64  = null,
      pdfMimeType = 'application/pdf',
      pdfFileName = 'document.pdf',
    } = message;

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) { sendResponse({ success: false, error: 'No active tab found.' }); return; }
      try {
        const result = await runAnswerQuestionsFlow(context, jd, activeTab.id, pdfBase64, pdfMimeType, pdfFileName);
        sendResponse({ success: true, ...result });
      } catch (err) {
        console.error('[AI Form Filler BG] QA flow error:', err);
        sendResponse({ success: false, error: err.message });
      }
    });
    return true;
  }
});

// Pre-seed the default Gemini API key on first install (if not already set)
chrome.storage.local.get(['apiKey'], (result) => {
  if (!result.apiKey) {
    chrome.storage.local.set({ apiKey: DEFAULT_API_KEY }, () => {
      console.log('[AI Form Filler BG] Default Gemini API key pre-seeded.');
    });
  }
});

console.log('[AI Form Filler] Background service worker started (Gemini powered).');
