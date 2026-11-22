import {
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

import { env } from "../config/env.js";

export const OTP_LENGTH = 6;

export const OTP_TTL_MS = 5 * 60 * 1000;

export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export const OTP_MAX_ATTEMPTS = 5;

// Generate a cryptographically secure six-digit code.
export const generateOtp = () =>
  String(randomInt(0, 1_000_000)).padStart(OTP_LENGTH, "0");

// Bind the hash to the phone, purpose, and account.
// This prevents a code issued for one challenge from
// being reused for a different challenge.
export const hashOtpCode = ({
  phoneNumber,
  purpose,
  userId,
  code,
}) => {
  const context = [
    phoneNumber,
    purpose,
    userId ? String(userId) : "none",
    code,
  ].join("|");

  return createHmac("sha256", env.JWT_SECRET)
    .update(context)
    .digest("hex");
};

export const isOtpCodeMatch = ({
  phoneNumber,
  purpose,
  userId,
  code,
  codeHash,
}) => {
  if (
    typeof codeHash !== "string" ||
    !/^[a-f0-9]{64}$/i.test(codeHash)
  ) {
    return false;
  }

  const expectedHash = hashOtpCode({
    phoneNumber,
    purpose,
    userId,
    code,
  });

  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const storedBuffer = Buffer.from(codeHash, "hex");

  if (expectedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, storedBuffer);
};

const toMilliseconds = (value) => {
  if (value instanceof Date) {
    return value.getTime();
  }

  return new Date(value).getTime();
};

export const getOtpChallengeState = (
  challenge,
  now = new Date()
) => {
  if (!challenge) {
    return "missing";
  }

  const currentTime = toMilliseconds(now);
  const expiryTime = toMilliseconds(challenge.expiresAt);

  if (
    !Number.isFinite(expiryTime) ||
    expiryTime <= currentTime
  ) {
    return "expired";
  }

  if (
    Number(challenge.attempts || 0) >= OTP_MAX_ATTEMPTS
  ) {
    return "locked";
  }

  return "active";
};

export const getResendCooldownSeconds = (
  challenge,
  now = new Date()
) => {
  if (!challenge?.resendAvailableAt) {
    return 0;
  }

  const remaining =
    toMilliseconds(challenge.resendAvailableAt) -
    toMilliseconds(now);

  if (!Number.isFinite(remaining)) {
    return 0;
  }

  return Math.max(0, Math.ceil(remaining / 1000));
};

// Evaluate one verification attempt.
// The controller persists the returned attempt count.
export const evaluateOtpAttempt = ({
  challenge,
  code,
  now = new Date(),
}) => {
  const state = getOtpChallengeState(challenge, now);

  if (state !== "active") {
    return {
      success: false,
      reason: state,
    };
  }

  const matches = isOtpCodeMatch({
    phoneNumber: challenge.phoneNumber,
    purpose: challenge.purpose,
    userId: challenge.userId,
    code,
    codeHash: challenge.codeHash,
  });

  if (matches) {
    return {
      success: true,
      reason: "verified",
    };
  }

  const attempts = Number(challenge.attempts || 0) + 1;

  return {
    success: false,
    reason:
      attempts >= OTP_MAX_ATTEMPTS
        ? "locked"
        : "invalid",
    attempts,
  };
};