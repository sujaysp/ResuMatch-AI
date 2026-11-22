import { z } from "zod";

const phoneNumberSchema = z
  .string()
  .trim()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    "Enter a valid international phone number, including its country code."
  );

const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the six-digit verification code.");

export const phoneRequestSchema = z.object({
  phoneNumber: phoneNumberSchema,
});

export const phoneVerifySchema = z.object({
  phoneNumber: phoneNumberSchema,
  code: otpCodeSchema,
});

export const phoneLinkRequestSchema = z.object({
  phoneNumber: phoneNumberSchema,

  password: z
    .string()
    .min(1, "Your existing ResuMatch password is required.")
    .max(72, "Invalid password."),
});

export const phoneLinkVerifySchema = z.object({
  phoneNumber: phoneNumberSchema,
  code: otpCodeSchema,
});