/**
 * api.js  (Extension API Client)
 *
 * Thin wrapper around fetch() for calling the AI Job Applier backend.
 * Used exclusively from background.js (service worker context) or popup.js.
 */

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND URL RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────
export async function getBackendUrl() {
  return 'http://localhost:3000';
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH TOKEN HELPERS
// ─────────────────────────────────────────────────────────────────────────────
export function saveAuthToken(token) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ authToken: token }, resolve);
  });
}

export async function getAuthToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['authToken'], (result) => {
      resolve(result.authToken || null);
    });
  });
}

export function clearAuthToken() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['authToken', 'profileFormDataCache'], resolve);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATION — POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
export async function login(email, password) {
  const baseUrl = await getBackendUrl();
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    let message = `Login failed (${response.status})`;
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch (_) {}
    throw new Error(message);
  }

  const data = await response.json();
  const token = data?.data?.token;
  if (!token) throw new Error('No token returned from login endpoint');

  await saveAuthToken(token);
  return data.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM FILLER APIs (delegated to backend AI)
// ─────────────────────────────────────────────────────────────────────────────
export async function fillFormFields(fields, context = '') {
  const token = await getAuthToken();
  if (!token) throw new Error('NOT_AUTHENTICATED');

  const baseUrl = await getBackendUrl();
  const response = await fetch(`${baseUrl}/api/form-filler/fill`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields, context })
  });

  if (!response.ok) {
    let message = `Form fill failed (${response.status})`;
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch (_) {}
    throw new Error(message);
  }

  const data = await response.json();
  return data.data; // mapping
}

export async function answerQuestionsAPI(questions, jd = '', context = '') {
  const token = await getAuthToken();
  if (!token) throw new Error('NOT_AUTHENTICATED');

  const baseUrl = await getBackendUrl();
  const response = await fetch(`${baseUrl}/api/form-filler/answer`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ questions, jd, context })
  });

  if (!response.ok) {
    let message = `Answer questions failed (${response.status})`;
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch (_) {}
    throw new Error(message);
  }

  const data = await response.json();
  return data.data; // mapping
}

// ─────────────────────────────────────────────────────────────────────────────
// RESUME APIs
// ─────────────────────────────────────────────────────────────────────────────
export async function getResumes() {
  const token = await getAuthToken();
  if (!token) throw new Error('NOT_AUTHENTICATED');

  const baseUrl = await getBackendUrl();
  const response = await fetch(`${baseUrl}/api/resumes`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) throw new Error('Failed to fetch resumes');
  const data = await response.json();
  return data.data;
}

export async function uploadResume(file, label = 'My Resume', isPrimary = true) {
  const token = await getAuthToken();
  if (!token) throw new Error('NOT_AUTHENTICATED');

  const baseUrl = await getBackendUrl();
  const formData = new FormData();
  formData.append('resume', file);
  formData.append('label', label);
  formData.append('is_primary', isPrimary);

  const response = await fetch(`${baseUrl}/api/resumes`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  if (!response.ok) {
    let message = `Upload failed (${response.status})`;
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch (_) {}
    throw new Error(message);
  }

  const data = await response.json();
  return data.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE APIs
// ─────────────────────────────────────────────────────────────────────────────
export async function getProfile() {
  const token = await getAuthToken();
  if (!token) throw new Error('NOT_AUTHENTICATED');

  const baseUrl = await getBackendUrl();
  const response = await fetch(`${baseUrl}/api/profile`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    if (response.status === 404) return null; // no profile
    throw new Error('Failed to fetch profile');
  }
  const data = await response.json();
  return data.data;
}

export async function saveProfile(profileData) {
  const token = await getAuthToken();
  if (!token) throw new Error('NOT_AUTHENTICATED');

  const baseUrl = await getBackendUrl();
  // First check if profile exists
  const existing = await getProfile();
  const method = existing ? 'PATCH' : 'POST';

  const response = await fetch(`${baseUrl}/api/profile`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(profileData)
  });

  if (!response.ok) throw new Error('Failed to save profile');
  const data = await response.json();
  return data.data;
}

export async function extractProfileFromResumeAPI(file) {
  const token = await getAuthToken();
  if (!token) throw new Error('NOT_AUTHENTICATED');

  const baseUrl = await getBackendUrl();
  const formData = new FormData();
  formData.append('resume', file);

  const response = await fetch(`${baseUrl}/api/profile/extract-resume`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  if (!response.ok) {
    let message = `Extract failed (${response.status})`;
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch (_) {}
    throw new Error(message);
  }

  const data = await response.json();
  return data.data;
}
