import asyncHandler from '../utils/asyncHandler.js';
import {
  sendSuccess,
  sendCreated,
  sendBadRequest,
  sendNotFound,
  sendConflict,
  sendError,
} from '../utils/response.js';
import {
  getProfileService,
  createProfileService,
  updateProfileService,
  deleteProfileService,
} from '../services/profileService.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/profile
// Returns the authenticated user's profile.
// ─────────────────────────────────────────────────────────────────────────────
export const getProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    const profile = await getProfileService(userId);
    return sendSuccess(res, profile, 'Profile fetched successfully');
  } catch (err) {
    if (err.message === 'PROFILE_NOT_FOUND') {
      return sendNotFound(res, 'Profile not found');
    }
    throw err; // bubble up to global errorHandler
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/profile
// Creates a new profile for the authenticated user.
// ─────────────────────────────────────────────────────────────────────────────
export const createProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Whitelist only accepted fields to prevent pollution
  const {
    full_name, phone, email,
    gender, nationality, dob,
    disability,
    address_line, city, state, pincode, country,
    current_salary, expected_salary, notice_period,
    highest_education, degree,
    highest_education_start_year, highest_education_end_year,
    preferred_locations,
    linkedin_url, portfolio_url, github_url,
  } = req.body;

  try {
    const profile = await createProfileService(userId, {
      full_name, phone, email,
      gender, nationality, dob,
      disability,
      address_line, city, state, pincode, country,
      current_salary, expected_salary, notice_period,
      highest_education, degree,
      highest_education_start_year, highest_education_end_year,
      preferred_locations,
      linkedin_url, portfolio_url, github_url,
    });

    return sendCreated(res, profile, 'Profile created successfully');
  } catch (err) {
    if (err.message === 'PROFILE_ALREADY_EXISTS') {
      return sendConflict(res, 'Profile already exists — use PATCH to update it');
    }
    throw err;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/profile
// Partial update (upsert) — only provided fields are overwritten.
// ─────────────────────────────────────────────────────────────────────────────
export const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Strip unknown keys
  const allowed = [
    'full_name', 'phone', 'email',
    'gender', 'nationality', 'dob',
    'disability',
    'address_line', 'city', 'state', 'pincode', 'country',
    'current_salary', 'expected_salary', 'notice_period',
    'highest_education', 'degree',
    'highest_education_start_year', 'highest_education_end_year',
    'preferred_locations',
    'linkedin_url', 'portfolio_url', 'github_url',
  ];

  const data = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      data[key] = req.body[key];
    }
  }

  if (Object.keys(data).length === 0) {
    return sendBadRequest(res, 'No valid fields provided to update');
  }

  const profile = await updateProfileService(userId, data);

  return sendSuccess(res, profile, 'Profile updated successfully');
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/profile
// Removes the authenticated user's profile.
// ─────────────────────────────────────────────────────────────────────────────
export const deleteProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    await deleteProfileService(userId);
    return sendSuccess(res, null, 'Profile deleted successfully');
  } catch (err) {
    if (err.message === 'PROFILE_NOT_FOUND') {
      return sendNotFound(res, 'Profile not found');
    }
    throw err;
  }
});
