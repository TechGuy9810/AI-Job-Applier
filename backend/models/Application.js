import mongoose from 'mongoose';

/**
 * Application — one record per job applied to.
 * Tracks the job URL, company, role, status lifecycle, and which
 * generated resume was used (optional).
 */
const applicationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Optional: which AI-generated resume was submitted
    generated_resume_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GeneratedResume',
      default: null,
    },

    // ── Job Info ───────────────────────────────────────────────────────────
    job_url: {
      type: String,
      trim: true,
      required: true,
    },

    company: {
      type: String,
      trim: true,
    },

    role: {
      type: String,
      trim: true,
    },

    // ── Lifecycle ──────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'submitted', 'failed'],
      default: 'pending',
    },

    // Timestamp when the form was actually submitted / filled
    filled_at: {
      type: Date,
      default: null,
    },

    // Optional notes (e.g. error message if status === 'failed')
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // createdAt = when record was created, updatedAt = last change
  }
);

export default mongoose.model('Application', applicationSchema);
