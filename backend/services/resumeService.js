import Resume from '../models/Resume.js';

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────
export const createResumeService = async (userId, data) => {
  if (data.is_primary) {
    await Resume.updateMany({ user_id: userId }, { $set: { is_primary: false } });
  } else {
    const existingCount = await Resume.countDocuments({ user_id: userId });
    if (existingCount === 0) {
      data.is_primary = true;
    }
  }

  const resume = new Resume({
    ...data,
    user_id: userId,
  });

  await resume.save();
  return resume;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL — all resumes for a user
// ─────────────────────────────────────────────────────────────────────────────
export const getAllResumesService = async (userId) => {
  return await Resume.find({ user_id: userId }).sort({ createdAt: -1 });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ONE
// ─────────────────────────────────────────────────────────────────────────────
export const getResumeByIdService = async (userId, resumeId) => {
  const resume = await Resume.findOne({ _id: resumeId, user_id: userId });
  if (!resume) throw new Error('RESUME_NOT_FOUND');
  return resume;
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE (label, file_url, is_primary)
// ─────────────────────────────────────────────────────────────────────────────
export const updateResumeService = async (userId, resumeId, data) => {
  const existing = await Resume.findOne({ _id: resumeId, user_id: userId });
  if (!existing) throw new Error('RESUME_NOT_FOUND');

  if (data.is_primary) {
    await Resume.updateMany({ user_id: userId }, { $set: { is_primary: false } });
  }

  const resume = await Resume.findByIdAndUpdate(
    resumeId,
    { $set: data },
    { new: true, runValidators: true }
  );

  return resume;
};

// ─────────────────────────────────────────────────────────────────────────────
// SET PRIMARY — convenience endpoint
// ─────────────────────────────────────────────────────────────────────────────
export const setPrimaryResumeService = async (userId, resumeId) => {
  const existing = await Resume.findOne({ _id: resumeId, user_id: userId });
  if (!existing) throw new Error('RESUME_NOT_FOUND');

  await Resume.updateMany({ user_id: userId }, { $set: { is_primary: false } });

  existing.is_primary = true;
  await existing.save();

  return existing;
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────
export const deleteResumeService = async (userId, resumeId) => {
  const resume = await Resume.findOneAndDelete({ _id: resumeId, user_id: userId });
  if (!resume) throw new Error('RESUME_NOT_FOUND');
  return resume;
};
