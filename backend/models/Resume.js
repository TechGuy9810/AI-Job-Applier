import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const experienceSchema = new Schema(
  {
    company: { type: String, required: true },
    role: { type: String, required: true },
    duration: { type: String },
    points: [{ type: String }]
  },
  { _id: false }
);

const projectSchema = new Schema(
  {
    name: { type: String, required: true },
    tech: [{ type: String }],
    points: [{ type: String }]
  },
  { _id: false }
);

const educationSchema = new Schema(
  {
    college: { type: String, required: true },
    degree: { type: String },
    year: { type: String }
  },
  { _id: false }
);

// 🔹 Main Resume Schema

const resumeSchema = new Schema(
  {
    user_id: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    label: {
      type: String,
      required: true,
      default: "My Resume"
    },
    is_primary: {
      type: Boolean,
      default: false
    },
    file_url: {
      type: String,
      default: null
    },
    pdfBase64: { // We store the base64 just in case they need to upload the actual file to forms later
      type: String,
      default: null
    },
    mimeType: {
      type: String,
      default: "application/pdf"
    },
    data: {
      skills: [{ type: String }],
      experience: [experienceSchema],
      projects: [projectSchema],
      education: [educationSchema]
    }
  },
  {
    timestamps: true // adds createdAt & updatedAt
  }
);

export default mongoose.model("Resume", resumeSchema);