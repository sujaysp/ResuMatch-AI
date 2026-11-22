import express from "express";
import rateLimit from "express-rate-limit";

import {
  requestPhoneLoginOtp,
  verifyPhoneLoginOtp,
  requestPhoneLinkOtp,
  verifyPhoneLinkOtp,
} from "../controllers/phoneAuthController.js";

import {
  phoneRequestSchema,
  phoneVerifySchema,
  phoneLinkRequestSchema,
  phoneLinkVerifySchema,
} from "../validators/phoneAuthValidators.js";

import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many OTP requests. Please try again later.",
  },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many verification requests. Please try again later.",
  },
});

// Phone login.
router.post(
  "/request",
  otpRequestLimiter,
  validate(phoneRequestSchema),
  requestPhoneLoginOtp
);

router.post(
  "/verify",
  otpVerifyLimiter,
  validate(phoneVerifySchema),
  verifyPhoneLoginOtp
);

// Link a phone to the currently authenticated account.
router.post(
  "/link/request",
  authenticate,
  otpRequestLimiter,
  validate(phoneLinkRequestSchema),
  requestPhoneLinkOtp
);

router.post(
  "/link/verify",
  authenticate,
  otpVerifyLimiter,
  validate(phoneLinkVerifySchema),
  verifyPhoneLinkOtp
);

export default router;