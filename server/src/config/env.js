
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  // Application environment.
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Express server port.
  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),

  // Frontend application URL.
  CLIENT_URL: z
    .string()
    .url()
    .default("http://localhost:5173"),

  // MongoDB Atlas connection string.
  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required"),

  // JWT authentication secret.
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must contain at least 32 characters"),

  JWT_EXPIRES_IN: z
    .string()
    .default("1d"),

  // Google Gemini API configuration.
  GEMINI_API_KEY: z
    .string()
    .trim()
    .optional(),

  GEMINI_MODEL: z
    .string()
    .default("gemini-3.8-flash"),
});

// Validate environment variables and export them.
export const env = envSchema.parse(process.env);
