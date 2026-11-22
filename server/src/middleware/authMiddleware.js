import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const authenticate = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const token = authorization.split(" ")[1];

  try {
    const decoded = jwt.verify(
      token,
      env.JWT_SECRET,
      {
        algorithms: ["HS256"],
      }
    );

    if (typeof decoded === "string" || !decoded.sub) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
    }

    req.auth = {
      userId: decoded.sub,
    };

    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message:
        error.name === "TokenExpiredError"
          ? "Authentication token has expired"
          : "Invalid authentication token",
    });
  }
};