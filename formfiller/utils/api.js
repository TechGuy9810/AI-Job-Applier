/**
 * api.js  (Extension API Client)
 *
 * Thin wrapper around fetch() for calling the AI Job Applier backend.
 * Used exclusively from background.js (service worker context).
 *
 * All exported functions return plain objects / throw on failure.
 */

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND URL RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the configured backend base URL from chrome.storage.local.
 * Defaults to localhost:3000 for local development.
 * @returns {Promise<string>}  e.g. "http://localhost:3000"
 */
export async function getBackendUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['backendUrl'], (result) => {
      resolve(result.backendUrl || 'http://localhost:3000');
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH TOKEN HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stores a JWT token in chrome.storage.local.
 * @param {string} token
 */
export function saveAuthToken(token) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ authToken: token }, resolve);
  });
}

/**
 * Retrieves the stored JWT token (or null).
 * @returns {Promise<string|null>}
 */
export async function getAuthToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['authToken'], (result) => {
      resolve(result.authToken || null);
    });
  });
}

/**
 * Removes the stored JWT token (logout).
 */
export function clearAuthToken() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['authToken', 'profileFormDataCache'], resolve);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATION — POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Logs in with email + password and stores the returned JWT.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, user: object }>}
 * @throws {Error} on network failure or non-2xx status
 */
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
    } catch (_) { /* ignore parse errors */ }
    throw new Error(message);
  }

  const data = await response.json();
  const token = data?.data?.token;
  if (!token) throw new Error('No token returned from login endpoint');

  await saveAuthToken(token);
  return data.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE FORM DATA — GET /api/profile/form-data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cache TTL for profile form data (5 minutes).
 * Reduces API calls when filling multiple forms in a session.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Fetches the alias-expanded profile form data from the backend.
 * Results are cached in chrome.storage.local for CACHE_TTL_MS.
 *
 * @param {boolean} [forceRefresh=false] — bypass cache and force a fresh fetch
 * @returns {Promise<Object>} — flat { "Label": "value" } map
 * @throws {Error} if no auth token or the network request fails
 */
export async function fetchProfileFormData(forceRefresh = false) {
  // ── 1. Check cache ────────────────────────────────────────────────────────
  if (!forceRefresh) {
    const cached = await getCachedFormData();
    if (cached) {
      console.log('[AI Form Filler API] Using cached profile form data.');
      return cached;
    }
  }

  // ── 2. Get token + base URL ───────────────────────────────────────────────
  const token = await getAuthToken();
  if (!token) {
    throw new Error('NOT_AUTHENTICATED');
  }

  const baseUrl = await getBackendUrl();

  // ── 3. Fetch ──────────────────────────────────────────────────────────────
  const response = await fetch(`${baseUrl}/api/profile/form-data`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('AUTH_EXPIRED');
    if (response.status === 404) throw new Error('PROFILE_NOT_FOUND');
    let message = `Profile fetch failed (${response.status})`;
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch (_) { /* ignore */ }
    throw new Error(message);
  }

  const data = await response.json();
  const formData = data?.data?.formData;
  if (!formData || typeof formData !== 'object') {
    throw new Error('Invalid form data response from server');
  }

  // ── 4. Cache the result ───────────────────────────────────────────────────
  await cacheFormData(formData);

  console.log(`[AI Form Filler API] Fetched ${Object.keys(formData).length} alias keys from backend.`);
  return formData;
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHE HELPERS (internal)
// ─────────────────────────────────────────────────────────────────────────────

async function cacheFormData(formData) {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      profileFormDataCache: {
        data: formData,
        timestamp: Date.now(),
      },
    }, resolve);
  });
}

async function getCachedFormData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['profileFormDataCache'], (result) => {
      const cache = result.profileFormDataCache;
      if (!cache) return resolve(null);
      if (Date.now() - cache.timestamp > CACHE_TTL_MS) return resolve(null);
      resolve(cache.data);
    });
  });
}
