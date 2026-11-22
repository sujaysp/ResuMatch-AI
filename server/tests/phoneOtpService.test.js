import test from "node:test";
import assert from "node:assert/strict";

import {
  generateOtp,
  hashOtpCode,
  isOtpCodeMatch,
  evaluateOtpAttempt,
  getOtpChallengeState,
  getResendCooldownSeconds,
  OTP_MAX_ATTEMPTS,
} from "../src/services/phoneOtpService.js";

const createChallenge = ({
  code = "123456",
  attempts = 0,
  expiresAt = new Date(Date.now() + 5 * 60 * 1000),
  resendAvailableAt = new Date(Date.now() + 60 * 1000),
} = {}) => {
  const phoneNumber = "+919876543210";
  const purpose = "login";
  const userId = "user-test-id";

  return {
    phoneNumber,
    purpose,
    userId,
    attempts,
    expiresAt,
    resendAvailableAt,
    codeHash: hashOtpCode({
      phoneNumber,
      purpose,
      userId,
      code,
    }),
  };
};

test("generates a six-digit OTP", () => {
  const code = generateOtp();

  assert.match(code, /^\d{6}$/);
});

test("hashes and verifies the correct OTP", () => {
  const challenge = createChallenge();

  assert.equal(
    isOtpCodeMatch({
      phoneNumber: challenge.phoneNumber,
      purpose: challenge.purpose,
      userId: challenge.userId,
      code: "123456",
      codeHash: challenge.codeHash,
    }),
    true
  );
});

test("rejects an incorrect OTP", () => {
  const challenge = createChallenge();

  const result = evaluateOtpAttempt({
    challenge,
    code: "654321",
  });

  assert.equal(result.success, false);
  assert.equal(result.reason, "invalid");
  assert.equal(result.attempts, 1);
});

test("accepts the correct OTP before expiry", () => {
  const challenge = createChallenge();

  const result = evaluateOtpAttempt({
    challenge,
    code: "123456",
  });

  assert.equal(result.success, true);
  assert.equal(result.reason, "verified");
});

test("rejects an expired OTP", () => {
  const now = new Date();

  const challenge = createChallenge({
    expiresAt: new Date(now.getTime() - 1000),
  });

  const result = evaluateOtpAttempt({
    challenge,
    code: "123456",
    now,
  });

  assert.equal(result.success, false);
  assert.equal(result.reason, "expired");
});

test("locks a challenge after five incorrect attempts", () => {
  const now = new Date();

  let attempts = 0;

  for (let index = 0; index < OTP_MAX_ATTEMPTS; index += 1) {
    const challenge = createChallenge({
      attempts,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
    });

    const result = evaluateOtpAttempt({
      challenge,
      code: "654321",
      now,
    });

    assert.equal(result.success, false);

    attempts = result.attempts ?? attempts;
  }

  assert.equal(attempts, OTP_MAX_ATTEMPTS);

  const lockedChallenge = createChallenge({
    attempts,
    expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
  });

  const lockedResult = evaluateOtpAttempt({
    challenge: lockedChallenge,
    code: "123456",
    now,
  });

  assert.equal(lockedResult.success, false);
  assert.equal(lockedResult.reason, "locked");
});

test("calculates the remaining resend cooldown", () => {
  const now = new Date("2026-11-22T10:00:00.000Z");

  const challenge = createChallenge({
    resendAvailableAt: new Date(
      now.getTime() + 30_000
    ),
  });

  assert.equal(
    getResendCooldownSeconds(challenge, now),
    30
  );
});

test("allows a resend after the cooldown expires", () => {
  const now = new Date("2026-11-22T10:00:00.000Z");

  const challenge = createChallenge({
    resendAvailableAt: new Date(
      now.getTime() - 1000
    ),
  });

  assert.equal(
    getResendCooldownSeconds(challenge, now),
    0
  );
});

test("identifies an active challenge", () => {
  const challenge = createChallenge();

  assert.equal(
    getOtpChallengeState(challenge),
    "active"
  );
});