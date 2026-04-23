import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    // ── Relationship ─────────────────────────────────────────────────────────
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // one-to-one
    },

    // ── Personal ─────────────────────────────────────────────────────────────
    full_name: {
      type: String,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    gender: {
      type: String,
      enum: ['male', 'female', 'non-binary', 'prefer_not_to_say', 'other'],
    },

    nationality: {
      type: String,
      trim: true,
    },

    dob: {
      type: Date, // stored as Date; send as ISO string (YYYY-MM-DD)
    },

    disability: {
      type: Boolean,
      default: false,
    },

    // ── Address ───────────────────────────────────────────────────────────────
    address_line: {
      type: String,
      trim: true,
    },

    city: {
      type: String,
      trim: true,
    },

    state: {
      type: String,
      trim: true,
    },

    pincode: {
      type: String,
      trim: true,
    },

    country: {
      type: String,
      trim: true,
    },

    // ── Financial / Availability ──────────────────────────────────────────────
    current_salary: {
      type: Number, // stored in local currency unit; no currency field — add if needed
      min: 0,
    },

    expected_salary: {
      type: Number,
      min: 0,
    },

    notice_period: {
      type: Number, // in days — e.g. 30, 60, 90
      min: 0,
    },

    // ── Education ─────────────────────────────────────────────────────────────
    highest_education: {
      type: String,
      enum: [
        'high_school',
        'diploma',
        'bachelors',
        'masters',
        'phd',
        'postdoc',
        'other',
      ],
    },

    degree: {
      type: String,
      trim: true, // e.g. "B.Tech Computer Science"
    },

    highest_education_start_year: {
      type: Number,
      min: 1950,
      max: new Date().getFullYear(),
    },

    highest_education_end_year: {
      type: Number,
      min: 1950,
      max: new Date().getFullYear() + 10, // allow future graduation
    },

    // ── Job Preferences ───────────────────────────────────────────────────────
    preferred_locations: {
      type: [String], // e.g. ["Bangalore", "Remote", "Mumbai"]
      default: [],
    },

    // ── Online Presence ───────────────────────────────────────────────────────
    linkedin_url: {
      type: String,
      trim: true,
    },

    portfolio_url: {
      type: String,
      trim: true,
    },

    github_url: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

export default mongoose.model('Profile', profileSchema);
