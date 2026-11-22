import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Required for password accounts, optional for Google accounts.
    passwordHash: {
      type: String,
      required: false,
      select: false,
    },

    // Google's stable account identifier.
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    linkedToUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // Optional phone number in international E.164 format.
    phoneNumber: {
      type: String,
      unique: true,
      sparse: true,
    },

    // Set only after a successful OTP verification.
    phoneVerifiedAt: {
      type: Date,
      default: null,
    },

    authProvider: {
      type: String,
      enum: ["password", "google", "phone"],
      default: "password",
    },
  },
  {
    timestamps: true,
  }
);

const User =
  mongoose.models.User ||
  mongoose.model("User", userSchema);

export default User;