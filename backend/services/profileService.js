import Profile from '../models/Profile.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET  — fetch the profile for the authenticated user
// ─────────────────────────────────────────────────────────────────────────────
export const getProfileService = async (userId) => {
  const profile = await Profile.findOne({ user_id: userId });

  if (!profile) {
    throw new Error('PROFILE_NOT_FOUND');
  }

  return profile;
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE  — create a profile (only if one doesn't already exist)
// ─────────────────────────────────────────────────────────────────────────────
export const createProfileService = async (userId, data) => {
  const existing = await Profile.findOne({ user_id: userId });

  if (existing) {
    throw new Error('PROFILE_ALREADY_EXISTS');
  }

  const profile = await Profile.create({ user_id: userId, ...data });

  return profile;
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE  — upsert: create if not found, update if found
// ─────────────────────────────────────────────────────────────────────────────
export const updateProfileService = async (userId, data) => {
  const profile = await Profile.findOneAndUpdate(
    { user_id: userId },
    { $set: data },
    {
      new: true,        // return the updated document
      upsert: true,     // create if not found
      runValidators: true,
    }
  );

  return profile;
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE  — remove the profile document
// ─────────────────────────────────────────────────────────────────────────────
export const deleteProfileService = async (userId) => {
  const result = await Profile.findOneAndDelete({ user_id: userId });

  if (!result) {
    throw new Error('PROFILE_NOT_FOUND');
  }

  return result;
};
