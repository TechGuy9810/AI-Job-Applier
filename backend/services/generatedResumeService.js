import GeneratedResume from '../models/GeneratedResume.js';
import Resume from '../models/Resume.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL — all generated resumes for a user
// ─────────────────────────────────────────────────────────────────────────────
export const getAllGeneratedResumesService = async (userId) => {
  return await GeneratedResume.find({ user_id: userId })
    .populate('base_resume_id', 'label version file_url')
    .sort({ createdAt: -1 });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ONE
// ─────────────────────────────────────────────────────────────────────────────
export const getGeneratedResumeByIdService = async (userId, id) => {
  const doc = await GeneratedResume.findOne({ _id: id, user_id: userId }).populate(
    'base_resume_id',
    'label version file_url'
  );
  if (!doc) throw new Error('GENERATED_RESUME_NOT_FOUND');
  return doc;
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE — store a new AI-generated resume record
// Validates that base_resume_id belongs to the same user.
// ─────────────────────────────────────────────────────────────────────────────
export const createGeneratedResumeService = async (userId, data) => {
  // Ensure the base resume exists and belongs to this user
  const base = await Resume.findOne({ _id: data.base_resume_id, user_id: userId });
  if (!base) throw new Error('BASE_RESUME_NOT_FOUND');

  const doc = await GeneratedResume.create({
    user_id: userId,
    ...data,
  });

  return doc;
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE — update pdf_url or generated_content after generation finishes
// ─────────────────────────────────────────────────────────────────────────────
export const updateGeneratedResumeService = async (userId, id, data) => {
  const existing = await GeneratedResume.findOne({ _id: id, user_id: userId });
  if (!existing) throw new Error('GENERATED_RESUME_NOT_FOUND');

  const allowed = ['pdf_url', 'generated_content', 'jd_snapshot'];
  const update = {};
  for (const key of allowed) {
    if (data[key] !== undefined) update[key] = data[key];
  }

  return await GeneratedResume.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, runValidators: true }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────
export const deleteGeneratedResumeService = async (userId, id) => {
  const doc = await GeneratedResume.findOneAndDelete({ _id: id, user_id: userId });
  if (!doc) throw new Error('GENERATED_RESUME_NOT_FOUND');
  return doc;
};
