import mongoose from 'mongoose';

/**
 * GeneratedResume — AI-tailored resume per job application.
 * References both the User and the base Resume it was derived from.
 * The rendered PDF is stored externally (S3 / GCS).
 */
const generatedResumeSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // The uploaded resume this was tailored from
    base_resume_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resume',
      required: true,
    },

    // S3 / GCS link to the rendered PDF
    pdf_url: {
      type: String,
      trim: true,
    },

    // Full text of the job description used by the AI
    jd_snapshot: {
      type: String,
      trim: true,
    },

    // The AI-generated resume content (structured JSON or plain text)
    generated_content: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true, // createdAt acts as the generation timestamp
  }
);

export default mongoose.model('GeneratedResume', generatedResumeSchema);
