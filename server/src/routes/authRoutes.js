import express from "express";

import {
  register,
  login,
  loginWithGoogle,
  linkGoogleAccount,
  getCurrentUser,
} from "../controllers/authController.js";

import phoneAuthRoutes from "./phoneAuthRoutes.js";

import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/authMiddleware.js";

import {
  registerSchema,
  loginSchema,
  googleAuthSchema,
  linkGoogleSchema,
} from "../validators/authValidators.js";

const router = express.Router();

// Register with email and password.
router.post("/register", validate(registerSchema), register);

// Login with email and password.
router.post("/login", validate(loginSchema), login);

// Login with Google.
router.post("/google", validate(googleAuthSchema), loginWithGoogle);

// Securely link Google to the currently authenticated account.
router.post(
  "/link-google",
  authenticate,
  validate(linkGoogleSchema),
  linkGoogleAccount
);

// Phone OTP login and phone account linking.
router.use("/phone", phoneAuthRoutes);

// Get current authenticated user.
router.get("/me", authenticate, getCurrentUser);

export default router;