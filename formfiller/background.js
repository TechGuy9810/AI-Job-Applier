/**
 * background.js (Service Worker)
 * Handles all secure API communication.
 * Acts as the trusted intermediary between popup and content script.
 */

import {
  login,
  signup,
  getAuthToken,
  clearAuthToken,
  fillFormFields,
  answerQuestionsAPI,
  getResumes,
  uploadResume,
  getProfile,
  saveProfile,
  extractProfileFromResumeAPI
} from './utils/api.js';

// ─────────────────────────────────────────────
// TAB COMMUNICATION HELPERS
// ─────────────────────────────────────────────

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

async function ensureContentScriptInjected(tabId) {
  try {
    await sendToContentScript(tabId, { action: 'PING' });
  } catch {
    console.log('[AI Form Filler BG] Injecting content script into tab', tabId);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
    await new Promise((r) => setTimeout(r, 300));
  }
}

// ─────────────────────────────────────────────
// MAIN ORCHESTRATION
// ─────────────────────────────────────────────

async function runFormFillFlow(tabId) {
  await ensureContentScriptInjected(tabId);

  // Extract form fields from the active tab
  console.log('[AI Form Filler BG] Extracting fields from tab', tabId);
  const extractResponse = await sendToContentScript(tabId, { action: 'EXTRACT_FIELDS' });

  if (!extractResponse?.success) {
    throw new Error(`Field extraction failed: ${extractResponse?.error || 'Unknown error'}`);
  }

  const fields = extractResponse.fields;
  if (!fields || fields.length === 0) {
    throw new Error('No form fields found on this page.');
  }

  console.log(`[AI Form Filler BG] Got ${fields.length} fields. Sending to backend for mapping...`);

  // Call backend to get mapping
  const mapping = await fillFormFields(fields);
  console.log('[AI Form Filler BG] Received mapping from backend:', mapping);

  if (!mapping || Object.keys(mapping).length === 0) {
    throw new Error('Backend returned an empty mapping.');
  }

  // Fill the form using the mapping
  const fillResponse = await sendToContentScript(tabId, {
    action: 'FILL_FORM',
    mapping,
    fields,
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

async function runAnswerQuestionsFlow(jd, tabId) {
  await ensureContentScriptInjected(tabId);

  const extractResponse = await sendToContentScript(tabId, { action: 'EXTRACT_FIELDS' });
  if (!extractResponse?.success) {
    throw new Error(`Field extraction failed: ${extractResponse?.error || 'Unknown error'}`);
  }

  const allFields = extractResponse.fields || [];
  
  // Helper to identify question fields
  const QUESTION_KEYWORDS = [
    'tell', 'describe', 'explain', 'write', 'share', 'discuss',
    'why', 'how did', 'what motivated', 'what drives', 'what are your',
    'cover letter', 'about yourself', 'about you', 'strength', 'weakness',
    'motivation', 'goal', 'achievement', 'experience', 'background',
    'interest', 'objective', 'summary', 'profile', 'expect', 'contribute',
    'aspiration', 'challenge', 'situation', 'behavior', 'example',
    'time when', 'passion', 'career', 'skill', 'qualify', 'fit',
    'message', 'note', 'additional', 'anything else', 'remarks',
    'why should we hire', 'why hire you', 'why should you be hired'
  ];
  const isQuestionField = (field) => {
    const type = (field.type || '').toLowerCase();
    if (type === 'textarea') return true;
    const label = field.label.toLowerCase();
    if (type === 'textbox' || type === 'text') {
      return QUESTION_KEYWORDS.some((kw) => label.includes(kw));
    }
    return false;
  };

  const questionFields = allFields.filter(isQuestionField);

  if (questionFields.length === 0) {
    return { questionsFound: 0, questionsFilled: 0 };
  }

  const mapping = await answerQuestionsAPI(questionFields, jd);
  
  const fillResponse = await sendToContentScript(tabId, {
    action: 'FILL_FORM',
    mapping,
    fields: questionFields,
  });

  return {
    questionsFound: questionFields.length,
    questionsFilled: fillResponse?.filled || 0,
  };
}

// ─────────────────────────────────────────────
// MESSAGE LISTENER
// ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[AI Form Filler BG] Message received:', message.action);

  if (message.action === 'LOGIN') {
    (async () => {
      try {
        const userData = await login(message.email, message.password);
        sendResponse({ success: true, user: userData.user });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.action === 'SIGNUP') {
    (async () => {
      try {
        const userData = await signup(message.name, message.email, message.password);
        sendResponse({ success: true, user: userData.user });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.action === 'LOGOUT') {
    (async () => {
      await clearAuthToken();
      sendResponse({ success: true });
    })();
    return true;
  }

  if (message.action === 'GET_AUTH_STATUS') {
    (async () => {
      const token = await getAuthToken();
      sendResponse({ isLoggedIn: !!token });
    })();
    return true;
  }

  if (message.action === 'FILL_REQUEST') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) {
        return sendResponse({ success: false, error: 'No active tab found.' });
      }
      try {
        const result = await runFormFillFlow(activeTab.id);
        sendResponse({ success: true, ...result });
      } catch (err) {
        console.error('[AI Form Filler BG] Flow error:', err);
        sendResponse({ success: false, error: err.message });
      }
    });
    return true;
  }

  if (message.action === 'ANSWER_QUESTIONS') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) {
        return sendResponse({ success: false, error: 'No active tab found.' });
      }
      try {
        const result = await runAnswerQuestionsFlow(message.jd, activeTab.id);
        sendResponse({ success: true, ...result });
      } catch (err) {
        console.error('[AI Form Filler BG] QA flow error:', err);
        sendResponse({ success: false, error: err.message });
      }
    });
    return true;
  }

  // --- NEW ROUTES ---
  if (message.action === 'CHECK_RESUMES') {
    (async () => {
      try {
        const resumes = await getResumes();
        const primary = resumes.find(r => r.is_primary);
        sendResponse({ success: true, hasResume: !!primary, resume: primary });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // Handle file uploads by passing them directly through message might fail for binary
  // We expect dataURL from popup
  if (message.action === 'UPLOAD_RESUME') {
    (async () => {
      try {
        // message.fileData is base64
        const res = await fetch(message.fileData);
        const blob = await res.blob();
        const file = new File([blob], message.fileName, { type: message.mimeType });
        const data = await uploadResume(file, message.fileName, true);
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.action === 'GET_PROFILE') {
    (async () => {
      try {
        const profile = await getProfile();
        sendResponse({ success: true, profile });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.action === 'SAVE_PROFILE') {
    (async () => {
      try {
        const profile = await saveProfile(message.profileData);
        sendResponse({ success: true, profile });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.action === 'EXTRACT_RESUME') {
    (async () => {
      try {
        const res = await fetch(message.fileData);
        const blob = await res.blob();
        const file = new File([blob], message.fileName, { type: message.mimeType });
        const data = await extractProfileFromResumeAPI(file);
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

});

console.log('[AI Form Filler] Background service worker started.');
