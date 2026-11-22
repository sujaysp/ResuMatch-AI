import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    originalFileName: {
      type: String,
      required: true,
      trim: true,
    },

    mimeType: {
      type: String,
      required: true,
      default: "application/pdf",
    },

    fileSizeBytes: {
      type: Number,
      required: true,
      min: 1,
    },

    pageCount: {
      type: Number,
      required: true,
      min: 1,
    },

    extractedText: {
      type: String,
      required: true,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

const Resume = mongoose.model("Resume", resumeSchema);

export default Resume;