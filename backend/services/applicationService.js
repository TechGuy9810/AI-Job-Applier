import Application from '../models/Application.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL — paginated list for a user, newest first
// ─────────────────────────────────────────────────────────────────────────────
export const getAllApplicationsService = async (userId, { page = 1, limit = 20, status } = {}) => {
  const filter = { user_id: userId };
  if (status) filter.status = status;

  const skip = (page - 1) * limit;

  const [applications, total] = await Promise.all([
    Application.find(filter)
      .populate('generated_resume_id', 'pdf_url jd_snapshot')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Application.countDocuments(filter),
  ]);

  return {
    applications,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ONE
// ─────────────────────────────────────────────────────────────────────────────
export const getApplicationByIdService = async (userId, id) => {
  const app = await Application.findOne({ _id: id, user_id: userId }).populate(
    'generated_resume_id',
    'pdf_url jd_snapshot'
  );
  if (!app) throw new Error('APPLICATION_NOT_FOUND');
  return app;
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE — called by the extension when it starts filling a form
// ─────────────────────────────────────────────────────────────────────────────
export const createApplicationService = async (userId, data) => {
  const application = await Application.create({
    user_id: userId,
    ...data,
  });
  return application;
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE STATUS — called by extension after submission succeeds / fails
// ─────────────────────────────────────────────────────────────────────────────
export const updateApplicationStatusService = async (userId, id, { status, notes, filled_at }) => {
  const existing = await Application.findOne({ _id: id, user_id: userId });
  if (!existing) throw new Error('APPLICATION_NOT_FOUND');

  const update = {};
  if (status) update.status = status;
  if (notes !== undefined) update.notes = notes;
  if (filled_at) update.filled_at = filled_at;
  else if (status === 'submitted') update.filled_at = new Date();

  return await Application.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────
export const deleteApplicationService = async (userId, id) => {
  const app = await Application.findOneAndDelete({ _id: id, user_id: userId });
  if (!app) throw new Error('APPLICATION_NOT_FOUND');
  return app;
};
