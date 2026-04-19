/**
 * profileToFormData.js
 *
 * Converts a Mongoose Profile document into a flat key→value map where
 * every common field label / synonym is pre-expanded as a separate key.
 *
 * The extension's fuzzy-matcher already handles minor variations; this utility
 * goes one step further and emits EXACT labels that job sites commonly use,
 * so deterministic matches are guaranteed even before Gemini is consulted.
 *
 * Alias groups:
 *   - Name           → Full Name · Name · First Name · Last Name · Candidate Name · Applicant Name
 *   - Phone          → Phone · Mobile · Mobile Number · Cell · Cell Phone · Contact · Contact Number · Phone Number · WhatsApp · WhatsApp Number · Telephone
 *   - Email          → Email · Email Address · E-mail · Work Email · Personal Email
 *   - Address        → full / line / street / locality / city / state / country / pin / zip
 *   - Current Salary → multiple CTC / LPA / annual variants
 *   - Expected Salary→ multiple CTC / LPA / annual variants
 *   - Notice Period  → joining-time synonyms
 *   - Education      → degree / qualification / course / graduation year / passing year
 *   - Work/Social    → LinkedIn · Portfolio · GitHub · GitHub URL
 *   - Personal       → Gender · DOB · Date of Birth · Nationality · Citizenship · Disability
 *   - Preferences    → Preferred Location · Preferred Job Location
 */

/**
 * Splits a full name into first and last parts (best-effort).
 * @param {string} fullName
 * @returns {{ first: string, last: string }}
 */
function splitName(fullName = '') {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

/**
 * Formats notice_period (days) into human-readable strings.
 * @param {number|null} days
 * @returns {string}
 */
function formatNoticePeriod(days) {
  if (days == null) return '';
  if (days === 0) return 'Immediately';
  if (days === 1) return '1 day';
  return `${days} days`;
}

/**
 * Formats a degree / education level into common display strings.
 * @param {string} highest_education  — enum value from Profile schema
 * @returns {string}
 */
function formatEducationLevel(highest_education = '') {
  const map = {
    high_school: 'High School',
    diploma: 'Diploma',
    bachelors: 'Graduate',
    masters: 'Post Graduate',
    phd: 'PhD',
    postdoc: 'Post Doctorate',
    other: 'Other',
  };
  return map[highest_education] || highest_education;
}

/**
 * Converts salary from raw number (assumed annual, rupees) to LPA string.
 * @param {number} amount
 * @returns {string}
 */
function toLPA(amount) {
  if (!amount && amount !== 0) return '';
  return (amount / 100000).toFixed(1); // e.g. 300000 → "3.0"
}

/**
 * Main export — converts a Profile document to a flat, alias-expanded map.
 *
 * @param {Object} profile — Mongoose Profile document (plain or toObject())
 * @returns {Object}       — flat { "Label": "value" } map
 */
export function profileToFormData(profile) {
  if (!profile) return {};

  const p = typeof profile.toObject === 'function' ? profile.toObject() : profile;

  const map = {};

  // ── Helpers ────────────────────────────────────────────────────────────────
  const set = (keys, value) => {
    if (value === undefined || value === null || value === '') return;
    const val = String(value);
    (Array.isArray(keys) ? keys : [keys]).forEach((k) => {
      map[k] = val;
    });
  };

  // ── Name ───────────────────────────────────────────────────────────────────
  if (p.full_name) {
    const { first, last } = splitName(p.full_name);
    set([
      'Full Name', 'Name', 'Candidate Name', 'Applicant Name',
      'Your Name', 'Legal Name',
    ], p.full_name);
    set(['First Name', 'Given Name'], first);
    set(['Last Name', 'Surname', 'Family Name'], last);
  }

  // ── Phone ──────────────────────────────────────────────────────────────────
  if (p.phone) {
    set([
      'Phone', 'Phone Number', 'Mobile', 'Mobile Number',
      'Cell', 'Cell Phone', 'Cell Number',
      'Contact', 'Contact Number', 'Contact No',
      'WhatsApp', 'WhatsApp Number', 'WhatsApp No',
      'Telephone', 'Telephone Number',
      'Primary Phone', 'Personal Phone',
    ], p.phone);
  }

  // ── Email ──────────────────────────────────────────────────────────────────
  if (p.email) {
    set([
      'Email', 'Email Address', 'E-mail', 'E-Mail',
      'Work Email', 'Personal Email', 'Primary Email',
      'Email ID', 'Mail',
    ], p.email);
  }

  // ── Address ────────────────────────────────────────────────────────────────
  if (p.address_line) {
    set([
      'Address', 'Full Address', 'Address Line 1',
      'Street', 'Street Address', 'Residential Address',
    ], p.address_line);
  }

  if (p.city) {
    set(['City', 'City / Town', 'Town', 'Current City', 'Location'], p.city);
  }

  if (p.state) {
    set(['State', 'State / Province', 'Province', 'Region'], p.state);
  }

  if (p.country) {
    set(['Country', 'Nationality Country', 'Country of Residence'], p.country);
  }

  if (p.pincode) {
    set([
      'PIN Code', 'Pincode', 'Zip Code', 'Zip', 'Postal Code',
      'Post Code', 'ZIP', 'PIN',
    ], p.pincode);
  }

  // Full address composite (for single-field address inputs)
  if (p.address_line || p.city || p.state) {
    const parts = [p.address_line, p.city, p.state, p.country, p.pincode].filter(Boolean);
    if (parts.length > 1) {
      set(['Complete Address', 'Mailing Address'], parts.join(', '));
    }
  }

  // ── Current Salary ─────────────────────────────────────────────────────────
  if (p.current_salary != null) {
    const lpa = toLPA(p.current_salary);
    set([
      'Current Salary', 'Current CTC', 'Current Annual Salary',
      'Current Annual CTC', 'Present Salary', 'Present CTC',
    ], p.current_salary);
    set(['Current Salary (LPA)', 'Current CTC (LPA)', 'CTC (LPA)'], lpa);
  }

  // ── Expected Salary ────────────────────────────────────────────────────────
  if (p.expected_salary != null) {
    const lpa = toLPA(p.expected_salary);
    set([
      'Expected Salary', 'Expected CTC', 'Expected Annual Salary',
      'Expected Annual CTC', 'Desired Salary', 'Desired CTC',
      'Salary Expectation', 'CTC Expectation',
    ], p.expected_salary);
    set([
      'Expected Salary (LPA)', 'Expected CTC (LPA)',
      'Annual CTC (in LPA)', 'Salary (LPA)',
    ], lpa);
  }

  // ── Notice Period ──────────────────────────────────────────────────────────
  if (p.notice_period != null) {
    const label = formatNoticePeriod(p.notice_period);
    set([
      'Notice Period', 'Notice Period (Days)', 'Notice Period (in days)',
      'Days to Join', 'Joining Time', 'Joining Period',
      'Available in Days', 'Availability to Join', 'When can you join?',
      'How soon can you join?',
    ], label);
    // Also emit raw number for numeric fields
    set(['Available to join in (days)', 'Notice Period (Days)'], p.notice_period);
  }

  // ── Education ──────────────────────────────────────────────────────────────
  if (p.highest_education) {
    const eduLabel = formatEducationLevel(p.highest_education);
    set([
      'Highest Education', 'Education Level', 'Qualification',
      'Highest Qualification', 'Educational Qualification',
    ], eduLabel);
  }

  if (p.degree) {
    set([
      'Degree', 'Degree / Course', 'Course', 'Program', 'Major',
      'Field of Study', 'Stream',
    ], p.degree);
  }

  if (p.highest_education_end_year) {
    set([
      'Graduation Year', 'Passing Year', 'Year of Passing',
      'Year of Graduation', 'Pass Out Year', 'Completion Year',
    ], p.highest_education_end_year);
  }

  if (p.highest_education_start_year) {
    set(['Start Year', 'Year of Admission', 'Joining Year (Education)'], p.highest_education_start_year);
  }

  // ── Job Preferences ────────────────────────────────────────────────────────
  if (p.preferred_locations && p.preferred_locations.length > 0) {
    const locStr = p.preferred_locations.join(', ');
    set([
      'Preferred Location', 'Preferred Locations', 'Preferred Job Location',
      'Preferred City', 'Preferred Work Location', 'Location Preference',
    ], locStr);
  }

  // ── Online Presence ────────────────────────────────────────────────────────
  if (p.linkedin_url) {
    set(['LinkedIn', 'LinkedIn URL', 'LinkedIn Profile', 'LinkedIn Profile URL'], p.linkedin_url);
  }

  if (p.portfolio_url) {
    set(['Portfolio', 'Portfolio URL', 'Portfolio Website', 'Personal Website', 'Website'], p.portfolio_url);
  }

  if (p.github_url) {
    set(['GitHub', 'GitHub URL', 'GitHub Profile', 'GitHub Profile URL', 'Git'], p.github_url);
  }

  // ── Personal ───────────────────────────────────────────────────────────────
  if (p.gender) {
    // Capitalise for display
    const genderDisplay = p.gender.charAt(0).toUpperCase() + p.gender.slice(1).replace('_', ' ');
    set(['Gender', 'Sex'], genderDisplay);
  }

  if (p.nationality) {
    set(['Nationality', 'Citizenship', 'Country of Citizenship'], p.nationality);
  }

  if (p.dob) {
    const dob = new Date(p.dob);
    const iso = dob.toISOString().split('T')[0]; // YYYY-MM-DD
    const display = dob.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    set([
      'Date of Birth', 'DOB', 'Birth Date', 'Birthday',
      'Date of Birth (YYYY-MM-DD)',
    ], iso);
    set(['Date of Birth (Display)', 'Date of Birth (Long)'], display);
  }

  if (p.disability !== undefined) {
    const val = p.disability ? 'Yes' : 'No';
    set([
      'Disability', 'Do you have a disability?',
      'Person with Disability', 'PWD', 'Differently Abled',
    ], val);
  }

  return map;
}
