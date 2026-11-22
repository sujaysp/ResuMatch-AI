
import bcrypt from "bcryptjs";

import User from "../models/User.js";
import OtpChallenge from "../models/OtpChallenge.js";

import { env } from "../config/env.js";
import { createAccessToken } from "../utils/createToken.js";

import {
  generateOtp,
  hashOtpCode,
  evaluateOtpAttempt,
  getResendCooldownSeconds,
  OTP_TTL_MS,
  OTP_RESEND_COOLDOWN_MS,
} from "../services/phoneOtpService.js";

// ==========================================
// USER RESPONSE HELPERS
// ==========================================

const formatPhoneUser = (user, googleLinked = false) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  phoneNumber: user.phoneNumber || null,
  phoneVerified: Boolean(user.phoneVerifiedAt),
  authProvider: user.authProvider || "password",
  googleLinked,
  createdAt: user.createdAt,
});

const getGoogleLinkedStatus = async (user) => {
  if (user.googleId) {
    return true;
  }

  const linkedIdentity = await User.exists({
    linkedToUserId: user._id,
    googleId: { $exists: true },
  });

  return Boolean(linkedIdentity);
};

const createSessionResponse = async (user) => {
  const googleLinked = await getGoogleLinkedStatus(user);

  return {
    user: formatPhoneUser(user, googleLinked),
    token: createAccessToken(user._id),
  };
};

// ==========================================
// DEVELOPMENT OTP CONFIGURATION
// ==========================================

const isDevelopmentOtpEnabled = (res) => {
  if (env.NODE_ENV === "development") {
    return true;
  }

  res.status(503).json({
    success: false,
    message:
      "Phone OTP delivery is not configured. Local development OTPs are disabled outside development mode.",
  });

  return false;
};

// ==========================================
// CREATE OR REFRESH OTP CHALLENGE
// ==========================================

const createChallenge = async ({
  phoneNumber,
  purpose,
  userId,
}) => {
  const now = new Date();

  const filter = {
    phoneNumber,
    purpose,
    userId: userId || null,
  };

  const existingChallenge = await OtpChallenge.findOne(filter);

  if (
    existingChallenge &&
    new Date(existingChallenge.expiresAt).getTime() >
      now.getTime()
  ) {
    const cooldownSeconds = getResendCooldownSeconds(
      existingChallenge,
      now
    );

    if (cooldownSeconds > 0) {
      return {
        cooldownSeconds,
      };
    }
  }

  const code = generateOtp();

  const expiresAt = new Date(
    now.getTime() + OTP_TTL_MS
  );

  const resendAvailableAt = new Date(
    now.getTime() + OTP_RESEND_COOLDOWN_MS
  );

  const codeHash = hashOtpCode({
    phoneNumber,
    purpose,
    userId,
    code,
  });

  // The returned document is not needed here, so the
  // deprecated "new" option is intentionally omitted.
  await OtpChallenge.findOneAndUpdate(
    filter,
    {
      $set: {
        codeHash,
        attempts: 0,
        expiresAt,
        resendAvailableAt,
      },
    },
    {
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  return {
    code,
  };
};

// ==========================================
// RESPONSE HELPERS
// ==========================================

const sendCooldownResponse = (res, seconds) =>
  res.status(429).json({
    success: false,
    message: `Please wait ${seconds} seconds before requesting another code.`,
    retryAfterSeconds: seconds,
  });

const verifyChallenge = async (challenge, code) => {
  const result = evaluateOtpAttempt({
    challenge,
    code,
  });

  if (
    !result.success &&
    Number.isInteger(result.attempts)
  ) {
    challenge.attempts = result.attempts;
    await challenge.save();
  }

  return result;
};

const sendVerificationFailure = (res, reason) => {
  if (reason === "locked") {
    return res.status(429).json({
      success: false,
      message:
        "Too many incorrect verification attempts. Request a new code after the resend cooldown.",
    });
  }

  if (reason === "expired") {
    return res.status(410).json({
      success: false,
      message:
        "This verification code has expired. Request a new one.",
    });
  }

  if (reason === "missing") {
    return res.status(400).json({
      success: false,
      message:
        "No active verification request was found. Request a new code.",
    });
  }

  return res.status(401).json({
    success: false,
    message: "Incorrect verification code.",
  });
};

// ==========================================
// REQUEST OTP FOR PHONE LOGIN
// ==========================================

export const requestPhoneLoginOtp = async (req, res, next) => {
  try {
    if (!isDevelopmentOtpEnabled(res)) {
      return;
    }

    const { phoneNumber } = req.body;

    // Only verified phone numbers can be used for login.
    const user = await User.findOne({
      phoneNumber,
      phoneVerifiedAt: { $ne: null },
    }).select("_id");

    let developmentCode;

    if (user) {
      const result = await createChallenge({
        phoneNumber,
        purpose: "login",
        userId: user._id,
      });

      if (result.cooldownSeconds) {
        return sendCooldownResponse(
          res,
          result.cooldownSeconds
        );
      }

      developmentCode = result.code;
    }

    // Keep the response generic so account existence
    // is not revealed through the normal response.
    const data = {
      phoneNumber,
      expiresInSeconds: OTP_TTL_MS / 1000,
      resendAfterSeconds:
        OTP_RESEND_COOLDOWN_MS / 1000,
    };

    if (
      developmentCode &&
      env.NODE_ENV === "development"
    ) {
      data.developmentCode = developmentCode;
      data.deliveryMode = "local-development";
    }

    return res.status(200).json({
      success: true,
      message:
        "If this number belongs to a verified ResuMatch account, a sign-in code is ready.",
      data,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// VERIFY OTP AND LOG IN
// ==========================================

export const verifyPhoneLoginOtp = async (req, res, next) => {
  try {
    if (!isDevelopmentOtpEnabled(res)) {
      return;
    }

    const { phoneNumber, code } = req.body;

    const challenge = await OtpChallenge.findOne({
      phoneNumber,
      purpose: "login",
    }).select("+codeHash");

    if (!challenge) {
      return sendVerificationFailure(res, "missing");
    }

    const result = await verifyChallenge(challenge, code);

    if (!result.success) {
      return sendVerificationFailure(
        res,
        result.reason
      );
    }

    const user = await User.findOne({
      _id: challenge.userId,
      phoneNumber,
      phoneVerifiedAt: { $ne: null },
    });

    if (!user) {
      await OtpChallenge.deleteOne({
        _id: challenge._id,
      });

      return res.status(401).json({
        success: false,
        message:
          "This phone number is not linked to an active verified account.",
      });
    }

    // A successful OTP can be used only once.
    await OtpChallenge.deleteOne({
      _id: challenge._id,
    });

    return res.status(200).json({
      success: true,
      message: "Phone sign-in successful.",
      data: await createSessionResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// REQUEST OTP TO LINK PHONE TO AN ACCOUNT
// ==========================================

export const requestPhoneLinkOtp = async (req, res, next) => {
  try {
    if (!isDevelopmentOtpEnabled(res)) {
      return;
    }

    const { phoneNumber, password } = req.body;

    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    const user = await User.findById(userId)
      .select("+passwordHash");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Your ResuMatch account could not be found.",
      });
    }

    if (!user.passwordHash) {
      return res.status(409).json({
        success: false,
        message:
          "This account does not have password authentication enabled. Phone linking requires account re-authentication.",
      });
    }

    const passwordIsValid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordIsValid) {
      return res.status(401).json({
        success: false,
        message:
          "Your existing ResuMatch password is incorrect.",
      });
    }

    const existingOwner = await User.findOne({
      phoneNumber,
    }).select("_id phoneVerifiedAt");

    if (
      existingOwner &&
      !existingOwner._id.equals(user._id)
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This phone number is already linked to another ResuMatch account.",
      });
    }

    if (
      existingOwner &&
      existingOwner._id.equals(user._id) &&
      existingOwner.phoneVerifiedAt
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This phone number is already verified on your account.",
      });
    }

    const result = await createChallenge({
      phoneNumber,
      purpose: "link",
      userId: user._id,
    });

    if (result.cooldownSeconds) {
      return sendCooldownResponse(
        res,
        result.cooldownSeconds
      );
    }

    const data = {
      phoneNumber,
      expiresInSeconds: OTP_TTL_MS / 1000,
      resendAfterSeconds:
        OTP_RESEND_COOLDOWN_MS / 1000,
    };

    if (env.NODE_ENV === "development") {
      data.developmentCode = result.code;
      data.deliveryMode = "local-development";
    }

    return res.status(200).json({
      success: true,
      message:
        "A phone verification code has been prepared for local development.",
      data,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "This phone number is already associated with another account.",
      });
    }

    next(error);
  }
};

// ==========================================
// VERIFY OTP AND LINK PHONE TO ORIGINAL USER
// ==========================================

export const verifyPhoneLinkOtp = async (req, res, next) => {
  try {
    if (!isDevelopmentOtpEnabled(res)) {
      return;
    }

    const { phoneNumber, code } = req.body;

    // FIX: Obtain the authenticated user's ID from
    // the JWT authentication middleware.
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Your authenticated ResuMatch session could not be verified.",
      });
    }

    // Only accept a challenge created for this exact
    // phone number and authenticated ResuMatch account.
    const challenge = await OtpChallenge.findOne({
      phoneNumber,
      purpose: "link",
      userId,
    }).select("+codeHash");

    if (!challenge) {
      return sendVerificationFailure(res, "missing");
    }

    const result = await verifyChallenge(challenge, code);

    if (!result.success) {
      return sendVerificationFailure(
        res,
        result.reason
      );
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "Your ResuMatch account could not be found.",
      });
    }

    if (
      user.phoneNumber &&
      user.phoneNumber !== phoneNumber
    ) {
      return res.status(409).json({
        success: false,
        message:
          "A different phone number is already linked to your account.",
      });
    }

    const existingOwner = await User.findOne({
      phoneNumber,
    }).select("_id");

    if (
      existingOwner &&
      !existingOwner._id.equals(user._id)
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This phone number is already linked to another account.",
      });
    }

    // Link the verified number to the original account.
    // The existing email, password, Google connection,
    // resumes, and analysis records remain untouched.
    user.phoneNumber = phoneNumber;
    user.phoneVerifiedAt = new Date();

    await user.save();

    // A successful OTP can only be used once.
    await OtpChallenge.deleteOne({
      _id: challenge._id,
    });

    const googleLinked = await getGoogleLinkedStatus(user);

    return res.status(200).json({
      success: true,
      message:
        "Phone number verified and linked to your existing ResuMatch account.",
      data: {
        user: formatPhoneUser(user, googleLinked),
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "This phone number is already linked to another account.",
      });
    }

    next(error);
  }
};
