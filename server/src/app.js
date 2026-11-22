import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/authRoutes.js";
import resumeRoutes from "./routes/resumeRoutes.js";
import analysisRoutes from "./routes/analysisRoutes.js";

import { env } from "./config/env.js";
import healthRoutes from "./routes/healthRoutes.js";

const app = express();

// Security headers.
app.use(helmet());

// Allow communication with our frontend.
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

// Parse incoming JSON requests.
app.use(express.json({ limit: "1mb" }));

// Parse URL-encoded request bodies.
app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

// Limit repeated API requests.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

app.use("/api", apiLimiter);

// Register API routes.
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/analysis", analysisRoutes);

// Handle unknown routes.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Central error handler.
app.use((error, req, res, next) => {
  console.error("Application error:", error);

  res.status(error.status || 500).json({
    success: false,
    message:
      env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message,
  });
});

export default app;