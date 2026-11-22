
import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must contain at least 2 characters")
    .max(80, "Name cannot exceed 80 characters"),

  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .toLowerCase(),

  password: z
    .string()
    .min(8, "Password must contain at least 8 characters")
    .max(72, "Password cannot exceed 72 characters"),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .toLowerCase(),

  password: z
    .string()
    .min(1, "Password is required")
    .max(72, "Invalid password"),
});

export const googleAuthSchema = z.object({
  idToken: z
    .string()
    .min(100, "A valid Google ID token is required")
    .max(10000, "Google ID token is too long"),
});

export const linkGoogleSchema = z.object({
  password: z
    .string()
    .min(1, "Your existing ResuMatch password is required")
    .max(72, "Invalid password"),

  idToken: z
    .string()
    .min(100, "A valid Google ID token is required")
    .max(10000, "Google ID token is too long"),
});