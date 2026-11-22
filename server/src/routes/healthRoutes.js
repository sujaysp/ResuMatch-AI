import express from "express";
import { env } from "../config/env.js";

const router = express.Router();

// GET /api/health
router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ResuMatch AI API is healthy",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

export default router;