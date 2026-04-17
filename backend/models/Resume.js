import mongoose from 'mongoose';

/**
 * Resume — one-to-many with User.
 * Each document represents one uploaded resume file (PDF, DOCX, etc.)
 * stored externally (S3 / GCS) with a signed or public URL.
 */
const resumeSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Link to the stored file (S3 / GCS pre-signed or public URL)
    file_url: {
      type: String,
      required: true,
      trim: true,
    },

    // Human-readable label — e.g. "Backend Dev Resume", "Generic"
    label: {
      type: String,
      trim: true,
      default: 'My Resume',
    },

    // Only one resume per user can be primary at a time
    is_primary: {
      type: Boolean,
      default: false,
    },

    // Monotonically increasing integer managed in service layer
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

export default mongoose.model('Resume', resumeSchema);
