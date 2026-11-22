import mongoose from "mongoose";

const otpChallengeSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },

    purpose: {
      type: String,
      enum: ["login", "link"],
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Never store the six-digit OTP itself.
    codeHash: {
      type: String,
      required: true,
      select: false,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    resendAvailableAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// One active challenge per phone, purpose, and account.
otpChallengeSchema.index(
  {
    phoneNumber: 1,
    purpose: 1,
    userId: 1,
  },
  {
    unique: true,
  }
);

// MongoDB automatically removes expired challenge documents.
otpChallengeSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);

const OtpChallenge =
  mongoose.models.OtpChallenge ||
  mongoose.model("OtpChallenge", otpChallengeSchema);

export default OtpChallenge;