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
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    title: {
      type: String,
      required: true,
      default: "My Resume"
    },

    data: {
      skills: [{ type: String }],

      experience: [experienceSchema],

      projects: [projectSchema],

      education: [educationSchema]
    },

    pdfUrl: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true // adds createdAt & updatedAt
  }
);

export default mongoose.model("Resume", resumeSchema);