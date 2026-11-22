import express from "express";

import { authenticate } from "../middleware/authMiddleware.js";
import { uploadResumeFile } from "../middleware/upload.js";

import { uploadResume } from "../controllers/resumeController.js";

const router = express.Router();

// Upload a PDF resume.
// Authentication runs before file processing.
router.post(
  "/upload",
  authenticate,
  uploadResumeFile,
  uploadResume
);

export default router;