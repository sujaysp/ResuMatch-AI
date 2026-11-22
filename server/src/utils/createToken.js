import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const createAccessToken = (userId) => {
  return jwt.sign(
    {},
    env.JWT_SECRET,
    {
      subject: userId.toString(),
      expiresIn: env.JWT_EXPIRES_IN,
      algorithm: "HS256",
    }
  );
};