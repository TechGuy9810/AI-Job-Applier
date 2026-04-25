/**
 * popup.js
 * Controls all popup UI interactions:
 */

// ─────────────────────────────────────────────
// DOM REFERENCES
// ─────────────────────────────────────────────
const tabHome = document.getElementById('tabHome');
const tabProfile = document.getElementById('tabProfile');
const viewHome = document.getElementById('viewHome');
const viewProfile = document.getElementById('viewProfile');

const activeResumeInfo = document.getElementById('activeResumeInfo');
const activeResumeName = document.getElementById('activeResumeName');
const noResumeWarning = document.getElementById('noResumeWarning');

const pdfDropZone = document.getElementById('pdfDropZone');
const pdfFileInput = document.getElementById('pdfFileInput');
const fillBtn = document.getElementById('fillBtn');
const answerBtn = document.getElementById('answerBtn');
const resultCard = document.getElementById('resultCard');

const jdToggle = document.getElementById('jdToggle');
const jdBody = document.getElementById('jdBody');
const jdInput = document.getElementById('jdInput');
const jdCharCount = document.getElementById('jdCharCount');

const authStatusBadge = document.getElementById('authStatusBadge');
const authStatusText = document.getElementById('authStatusText');

const loginSection = document.getElementById('loginSection');
const loggedInSection = document.getElementById('loggedInSection');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const signupName = document.getElementById('signupName');
const signupFields = document.getElementById('signupFields');
const toggleAuthModeBtn = document.getElementById('toggleAuthModeBtn');
const authModeLabel = document.getElementById('authModeLabel');

let isSignupMode = false;

// Profile Form Elements
const profileForm = document.getElementById('profileForm');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const extractResumeBtn = document.getElementById('extractResumeBtn');
const profileResultCard = document.getElementById('profileResultCard');
const extractResultCard = document.getElementById('extractResultCard');

// ─────────────────────────────────────────────
// TAB SWITCHING
// ─────────────────────────────────────────────
tabHome.addEventListener('click', () => {
  tabHome.classList.add('active');
  tabProfile.classList.remove('active');
  viewHome.classList.add('active');
  viewProfile.classList.remove('active');
});

tabProfile.addEventListener('click', () => {
  tabProfile.classList.add('active');
  tabHome.classList.remove('active');
  viewProfile.classList.add('active');
  viewHome.classList.remove('active');
  loadProfile();
});

// ─────────────────────────────────────────────
// AUTHENTICATION
// ─────────────────────────────────────────────
function setAuthStatusBadge(state, label) {
  authStatusBadge.className = `status-badge status-badge--${state}`;
  authStatusText.textContent = label;
}

function checkAuthStatus() {
  chrome.runtime.sendMessage({ action: 'GET_AUTH_STATUS' }, (response) => {
    if (chrome.runtime.lastError || !response || !response.isLoggedIn) {
      setAuthStatusBadge('missing', 'Not logged in');
      loginSection.style.display = '';
      loggedInSection.style.display = 'none';
      setResumeUI(false);
    } else {
      setAuthStatusBadge('ok', 'Logged in ✓');
      loginSection.style.display = 'none';
      loggedInSection.style.display = '';
      checkResumes();
    }
  });
}

toggleAuthModeBtn.addEventListener('click', () => {
  isSignupMode = !isSignupMode;
  if (isSignupMode) {
    authModeLabel.textContent = 'Create Account';
    toggleAuthModeBtn.textContent = 'Login instead';
    signupFields.style.display = 'block';
    loginBtn.textContent = 'Sign Up';
  } else {
    authModeLabel.textContent = 'Login';
    toggleAuthModeBtn.textContent = 'Create Account instead';
    signupFields.style.display = 'none';
    loginBtn.textContent = 'Login';
  }
});

loginBtn.addEventListener('click', () => {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) return;

  if (isSignupMode) {
    const name = signupName.value.trim();
    if (!name) return;
    
    loginBtn.textContent = 'Signing up…';
    loginBtn.disabled = true;

    chrome.runtime.sendMessage({ action: 'SIGNUP', name, email, password }, (res) => {
      loginBtn.textContent = 'Sign Up';
      loginBtn.disabled = false;
      if (res?.success) {
        checkAuthStatus();
      } else {
        alert(`Signup failed: ${res?.error}`);
      }
    });
  } else {
    loginBtn.textContent = 'Logging in…';
    loginBtn.disabled = true;

    chrome.runtime.sendMessage({ action: 'LOGIN', email, password }, (res) => {
      loginBtn.textContent = 'Login';
      loginBtn.disabled = false;
      if (res?.success) {
        checkAuthStatus();
      } else {
        alert(`Login failed: ${res?.error}`);
      }
    });
  }
});

logoutBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'LOGOUT' }, () => {
    checkAuthStatus();
  });
});

document.getElementById('toggleLoginPwVisibility').addEventListener('click', (e) => {
  const isPassword = loginPassword.type === 'password';
  loginPassword.type = isPassword ? 'text' : 'password';
  e.target.textContent = isPassword ? '🙈' : '👁';
});

// ─────────────────────────────────────────────
// RESUME UPLOAD & CHECK
// ─────────────────────────────────────────────
function setResumeUI(hasResume, name = '') {
  if (hasResume) {
    activeResumeInfo.style.display = 'flex';
    activeResumeInfo.classList.remove('pdf-file-info--hidden');
    activeResumeName.textContent = name;
    noResumeWarning.style.display = 'none';
    fillBtn.disabled = false;
    answerBtn.disabled = false;
  } else {
    activeResumeInfo.style.display = 'none';
    activeResumeInfo.classList.add('pdf-file-info--hidden');
    noResumeWarning.style.display = 'flex';
    fillBtn.disabled = true;
    answerBtn.disabled = true;
  }
}

function checkResumes() {
  chrome.runtime.sendMessage({ action: 'CHECK_RESUMES' }, (res) => {
    if (res?.success && res.hasResume) {
      setResumeUI(true, res.resume.label || 'document.pdf');
    } else {
      setResumeUI(false);
    }
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read PDF file.'));
    reader.readAsDataURL(file);
  });
}

async function handlePdfUpload(file) {
  if (!file || file.type !== 'application/pdf') {
    alert('Please upload a valid PDF file.');
    return;
  }

  try {
    const fileData = await readFileAsDataURL(file);
    chrome.runtime.sendMessage({
      action: 'UPLOAD_RESUME',
      fileData,
      fileName: file.name,
      mimeType: file.type
    }, (res) => {
      if (res?.success) {
        checkResumes();
        alert('Resume uploaded and set as primary!');
      } else {
        alert(`Failed to upload resume: ${res?.error}`);
      }
    });
  } catch (e) {
    alert(e.message);
  }
}

pdfDropZone.addEventListener('click', () => pdfFileInput.click());
pdfFileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handlePdfUpload(e.target.files[0]);
});

pdfDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  pdfDropZone.classList.add('pdf-drop-zone--dragover');
});
pdfDropZone.addEventListener('dragleave', () => {
  pdfDropZone.classList.remove('pdf-drop-zone--dragover');
});
pdfDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  pdfDropZone.classList.remove('pdf-drop-zone--dragover');
  const file = e.dataTransfer.files[0];
  if (file) handlePdfUpload(file);
});

// ─────────────────────────────────────────────
// FILLING / ANSWERING
// ─────────────────────────────────────────────
function showResult(html, type = 'info') {
  resultCard.innerHTML = html;
  resultCard.className = `result-card result-card--${type}`;
}
function hideResult() {
  resultCard.className = 'result-card result-card--hidden';
}

fillBtn.addEventListener('click', () => {
  hideResult();
  fillBtn.disabled = true;
  fillBtn.textContent = 'Analyzing…';
  
  chrome.runtime.sendMessage({ action: 'FILL_REQUEST' }, (res) => {
    fillBtn.disabled = false;
    fillBtn.innerHTML = '<span class="btn-icon">⚡</span> Fill Fields';
    
    if (res?.success) {
      showResult(`
        <strong>✅ Form filled!</strong>
        <div class="result-stats">
          <div class="stat"><span class="stat-value">${res.fieldsMapped}</span><span class="stat-label">Mapped</span></div>
          <div class="stat"><span class="stat-value">${res.fieldsFilled}</span><span class="stat-label">Filled</span></div>
        </div>
      `, 'success');
    } else {
      showResult(`❌ Error: ${res?.error}`, 'error');
    }
  });
});

answerBtn.addEventListener('click', () => {
  hideResult();
  answerBtn.disabled = true;
  answerBtn.textContent = 'Writing Answers…';
  
  chrome.runtime.sendMessage({ action: 'ANSWER_QUESTIONS', jd: jdInput.value.trim() }, (res) => {
    answerBtn.disabled = false;
    answerBtn.innerHTML = '<span class="btn-icon">✍️</span> Answer Questions';
    
    if (res?.success) {
      showResult(`
        <strong>✍️ Questions answered!</strong>
        <div class="result-stats">
          <div class="stat"><span class="stat-value">${res.questionsFound}</span><span class="stat-label">Found</span></div>
          <div class="stat"><span class="stat-value">${res.questionsFilled}</span><span class="stat-label">Filled</span></div>
        </div>
      `, 'success');
    } else {
      showResult(`❌ Error: ${res?.error}`, 'error');
    }
  });
});

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
jdInput.addEventListener('input', () => {
  jdCharCount.textContent = jdInput.value.length;
});

// ─────────────────────────────────────────────
// PROFILE MANAGEMENT
// ─────────────────────────────────────────────
function loadProfile() {
  chrome.runtime.sendMessage({ action: 'GET_PROFILE' }, (res) => {
    if (res?.success && res.profile) {
      const p = res.profile;
      document.getElementById('prof_full_name').value = p.full_name || '';
      document.getElementById('prof_email').value = p.email || '';
      document.getElementById('prof_phone').value = p.phone || '';
      document.getElementById('prof_gender').value = p.gender || '';
      document.getElementById('prof_nationality').value = p.nationality || '';
      if (p.dob) {
        document.getElementById('prof_dob').value = new Date(p.dob).toISOString().split('T')[0];
      } else {
        document.getElementById('prof_dob').value = '';
      }
      document.getElementById('prof_disability').checked = p.disability || false;
      document.getElementById('prof_address_line').value = p.address_line || '';
      document.getElementById('prof_city').value = p.city || '';
      document.getElementById('prof_state').value = p.state || '';
      document.getElementById('prof_pincode').value = p.pincode || '';
      document.getElementById('prof_country').value = p.country || '';
      document.getElementById('prof_current_salary').value = p.current_salary || '';
      document.getElementById('prof_expected_salary').value = p.expected_salary || '';
      document.getElementById('prof_notice_period').value = p.notice_period || '';
      document.getElementById('prof_preferred_locations').value = p.preferred_locations ? p.preferred_locations.join(', ') : '';
      document.getElementById('prof_linkedin_url').value = p.linkedin_url || '';
      document.getElementById('prof_github_url').value = p.github_url || '';
      document.getElementById('prof_portfolio_url').value = p.portfolio_url || '';
    }
  });
}

profileForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = {
    full_name: document.getElementById('prof_full_name').value,
    email: document.getElementById('prof_email').value,
    phone: document.getElementById('prof_phone').value,
    gender: document.getElementById('prof_gender').value,
    nationality: document.getElementById('prof_nationality').value,
    dob: document.getElementById('prof_dob').value || undefined,
    disability: document.getElementById('prof_disability').checked,
    address_line: document.getElementById('prof_address_line').value,
    city: document.getElementById('prof_city').value,
    state: document.getElementById('prof_state').value,
    pincode: document.getElementById('prof_pincode').value,
    country: document.getElementById('prof_country').value,
    current_salary: parseFloat(document.getElementById('prof_current_salary').value) || undefined,
    expected_salary: parseFloat(document.getElementById('prof_expected_salary').value) || undefined,
    notice_period: parseInt(document.getElementById('prof_notice_period').value) || undefined,
    preferred_locations: document.getElementById('prof_preferred_locations').value.split(',').map(l => l.trim()).filter(Boolean),
    linkedin_url: document.getElementById('prof_linkedin_url').value,
    github_url: document.getElementById('prof_github_url').value,
    portfolio_url: document.getElementById('prof_portfolio_url').value,
  };

  saveProfileBtn.disabled = true;
  chrome.runtime.sendMessage({ action: 'SAVE_PROFILE', profileData: data }, (res) => {
    saveProfileBtn.disabled = false;
    if (res?.success) {
      profileResultCard.innerHTML = '✅ Profile saved!';
      profileResultCard.className = 'result-card result-card--success';
    } else {
      profileResultCard.innerHTML = `❌ Error: ${res?.error}`;
      profileResultCard.className = 'result-card result-card--error';
    }
    setTimeout(() => { profileResultCard.className = 'result-card result-card--hidden'; }, 3000);
  });
});

extractResumeBtn.addEventListener('click', async () => {
  // If we already have a primary resume, we could extract from the backend directly
  // But wait, our API takes a file upload. Let's just ask user to select a file if they click this.
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/pdf';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    extractResumeBtn.disabled = true;
    extractResultCard.innerHTML = '🪄 Extracting...';
    extractResultCard.className = 'result-card result-card--info';

    try {
      const fileData = await readFileAsDataURL(file);
      chrome.runtime.sendMessage({
        action: 'EXTRACT_RESUME',
        fileData,
        fileName: file.name,
        mimeType: file.type
      }, (res) => {
        extractResumeBtn.disabled = false;
        if (res?.success) {
          extractResultCard.innerHTML = '✅ Extraction complete!';
          extractResultCard.className = 'result-card result-card--success';
          const p = res.data;
          if(p.full_name) document.getElementById('prof_full_name').value = p.full_name;
          if(p.email) document.getElementById('prof_email').value = p.email;
          if(p.phone) document.getElementById('prof_phone').value = p.phone;
          if(p.gender) document.getElementById('prof_gender').value = p.gender;
          if(p.nationality) document.getElementById('prof_nationality').value = p.nationality;
          if(p.dob) document.getElementById('prof_dob').value = new Date(p.dob).toISOString().split('T')[0];
          if(p.disability !== undefined) document.getElementById('prof_disability').checked = p.disability;
          if(p.address_line) document.getElementById('prof_address_line').value = p.address_line;
          if(p.city) document.getElementById('prof_city').value = p.city;
          if(p.state) document.getElementById('prof_state').value = p.state;
          if(p.pincode) document.getElementById('prof_pincode').value = p.pincode;
          if(p.country) document.getElementById('prof_country').value = p.country;
          if(p.current_salary) document.getElementById('prof_current_salary').value = p.current_salary;
          if(p.expected_salary) document.getElementById('prof_expected_salary').value = p.expected_salary;
          if(p.notice_period) document.getElementById('prof_notice_period').value = p.notice_period;
          if(p.preferred_locations) document.getElementById('prof_preferred_locations').value = p.preferred_locations.join(', ');
          if(p.linkedin_url) document.getElementById('prof_linkedin_url').value = p.linkedin_url;
          if(p.github_url) document.getElementById('prof_github_url').value = p.github_url;
          if(p.portfolio_url) document.getElementById('prof_portfolio_url').value = p.portfolio_url;
        } else {
          extractResultCard.innerHTML = `❌ Error: ${res?.error}`;
          extractResultCard.className = 'result-card result-card--error';
        }
        setTimeout(() => { extractResultCard.className = 'result-card result-card--hidden'; }, 5000);
      });
    } catch (err) {
      extractResumeBtn.disabled = false;
      extractResultCard.innerHTML = `❌ Error: ${err.message}`;
      extractResultCard.className = 'result-card result-card--error';
    }
  };
  input.click();
});

// Settings panel toggle
document.getElementById('settingsToggle').addEventListener('click', (e) => {
  const toggle = e.currentTarget;
  const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!isExpanded));
  const body = document.getElementById('settingsBody');
  if (isExpanded) {
    body.classList.remove('settings-body--open');
    body.classList.add('settings-body--collapsed');
  } else {
    body.classList.remove('settings-body--collapsed');
    body.classList.add('settings-body--open');
  }
});

// INIT
checkAuthStatus();
