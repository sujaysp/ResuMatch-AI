
import { Router } from "express";

import { authenticate } from "../middleware/authMiddleware.js";

import {
  analyzeResumeAgainstJob,
  getAnalysisHistory,
  getAnalysisById,
  generateAnalysisRecommendations,
} from "../controllers/analysisController.js";

const router = Router();

// Static history route must be registered before the dynamic ID route.
router.get(
  "/history",
  authenticate,
  getAnalysisHistory
);

// Retrieve a complete report by its MongoDB ID.
router.get(
  "/:analysisId",
  authenticate,
  getAnalysisById
);

// Generate AI recommendations.
router.post(
  "/:analysisId/recommendations",
  authenticate,
  generateAnalysisRecommendations
);

// Create a new resume analysis.
router.post(
  "/compare",
  authenticate,
  analyzeResumeAgainstJob
);

export default router;
