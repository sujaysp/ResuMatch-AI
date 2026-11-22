
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";

import User from "../models/User.js";
import { createAccessToken } from "../utils/createToken.js";

const googleOAuthClient = new OAuth2Client();

// Format user information before sending it to the frontend.
const formatUser = (user, googleLinked = Boolean(user.googleId)) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  phoneNumber: user.phoneNumber || null,
  phoneVerified: Boolean(user.phoneVerifiedAt),
  authProvider: user.authProvider || "password",
  googleLinked,
  createdAt: user.createdAt,
});

// Create the standard ResuMatch authentication response.
const createSessionResponse = (user, options = {}) => ({
  user: formatUser(
    user,
    options.googleLinked ?? Boolean(user.googleId)
  ),
  token: createAccessToken(user._id),
});

// Verify Google's ID token on the backend.
const verifyGoogleToken = async (idToken) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    const error = new Error("Google sign-in is not configured.");
    error.status = 503;
    throw error;
  }

  const ticket = await googleOAuthClient.verifyIdToken({
    idToken,
    audience: clientId,
  });

  const payload = ticket.getPayload();

  if (
    !payload?.sub ||
    !payload.email ||
    payload.email_verified !== true
  ) {
    const error = new Error(
      "Google did not provide a verified identity."
    );

    error.status = 401;
    throw error;
  }

  return payload;
};

// ==========================================
// REGISTER WITH EMAIL AND PASSWORD
// ==========================================

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.exists({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email: normalizedEmail,
      passwordHash,
      authProvider: "password",
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      data: createSessionResponse(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    next(error);
  }
};

// ==========================================
// LOGIN WITH EMAIL AND PASSWORD
// ==========================================

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+passwordHash");

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: createSessionResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// LOGIN WITH GOOGLE
// ==========================================

export const loginWithGoogle = async (req, res, next) => {
  try {
    let payload;

    try {
      payload = await verifyGoogleToken(req.body.idToken);
    } catch (error) {
      return res.status(error.status || 401).json({
        success: false,
        message:
          error.status === 503
            ? error.message
            : "Google sign-in verification failed. Please try again.",
      });
    }

    // Find the MongoDB record that owns this Google identity.
    const googleIdentity = await User.findOne({
      googleId: payload.sub,
    });

    if (googleIdentity) {
      let sessionUser = googleIdentity;

      // Resolve linked Google identities to the original
      // ResuMatch account so its saved reports remain accessible.
      if (googleIdentity.linkedToUserId) {
        sessionUser = await User.findById(
          googleIdentity.linkedToUserId
        );

        if (!sessionUser) {
          return res.status(409).json({
            success: false,
            message:
              "The linked ResuMatch account could not be found. Contact support.",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Google sign-in successful.",
        data: createSessionResponse(sessionUser, {
          googleLinked: true,
        }),
      });
    }

    // Never automatically merge accounts using email alone.
    const existingUser = await User.findOne({
      email: payload.email.trim().toLowerCase(),
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account already uses this email. Sign in to that account and link Google from your profile.",
      });
    }

    const candidateName = String(
      payload.name ||
        payload.email.split("@")[0] ||
        "Google Candidate"
    ).trim();

    const safeName =
      candidateName.length >= 2
        ? candidateName.slice(0, 80)
        : "Google Candidate";

    const user = await User.create({
      name: safeName,
      email: payload.email.trim().toLowerCase(),
      googleId: payload.sub,
      authProvider: "google",
    });

    return res.status(201).json({
      success: true,
      message: "Google account created successfully.",
      data: createSessionResponse(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This Google account is already registered.",
      });
    }

    next(error);
  }
};

// ==========================================
// LINK GOOGLE IDENTITY TO ORIGINAL ACCOUNT
// ==========================================

export const linkGoogleAccount = async (req, res, next) => {
  try {
    const originalUserId = req.auth?.userId;
    const { password, idToken } = req.body;

    if (!originalUserId) {
      return res.status(401).json({
        success: false,
        message: "Please sign in to your original ResuMatch account.",
      });
    }

    // Retrieve the original account and its password hash.
    const originalUser = await User.findById(originalUserId)
      .select("+passwordHash");

    if (!originalUser) {
      return res.status(404).json({
        success: false,
        message: "Your original ResuMatch account was not found.",
      });
    }

    if (!originalUser.passwordHash) {
      return res.status(409).json({
        success: false,
        message:
          "This account does not have password authentication enabled.",
      });
    }

    // Verify ownership of the original ResuMatch account.
    const passwordIsValid = await bcrypt.compare(
      password,
      originalUser.passwordHash
    );

    if (!passwordIsValid) {
      return res.status(401).json({
        success: false,
        message: "Your existing ResuMatch password is incorrect.",
      });
    }

    // Verify ownership of the Google account.
    let payload;

    try {
      payload = await verifyGoogleToken(idToken);
    } catch (error) {
      return res.status(error.status || 401).json({
        success: false,
        message:
          error.status === 503
            ? error.message
            : "Google account verification failed.",
      });
    }

    const googleIdentity = await User.findOne({
      googleId: payload.sub,
    });

    if (!googleIdentity) {
      return res.status(404).json({
        success: false,
        message:
          "The Google account was not found in ResuMatch. Sign in with Google once before linking it.",
      });
    }

    // The Google identity is already stored directly
    // on the original account.
    if (googleIdentity._id.equals(originalUser._id)) {
      return res.status(200).json({
        success: true,
        message: "This Google account is already linked.",
        data: {
          user: formatUser(originalUser, true),
        },
      });
    }

    // Prevent an identity from being moved between accounts.
    if (
      googleIdentity.linkedToUserId &&
      !googleIdentity.linkedToUserId.equals(originalUser._id)
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This Google account is already linked to another ResuMatch account.",
      });
    }

    if (
      originalUser.googleId &&
      originalUser.googleId !== payload.sub
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Your original account already has a different Google identity.",
      });
    }

    // Allow only one linked Google identity per original account.
    const anotherLinkedIdentity = await User.findOne({
      linkedToUserId: originalUser._id,
      googleId: { $ne: payload.sub },
    });

    if (anotherLinkedIdentity) {
      return res.status(409).json({
        success: false,
        message:
          "Another Google account is already linked to your ResuMatch account.",
      });
    }

    // Preserve both MongoDB documents.
    // Only establish the relationship between them.
    googleIdentity.linkedToUserId = originalUser._id;

    await googleIdentity.save();

    return res.status(200).json({
      success: true,
      message:
        "Google account linked successfully. Your existing reports are preserved.",
      data: {
        user: formatUser(originalUser, true),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET CURRENT AUTHENTICATED USER
// ==========================================

export const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account no longer exists.",
      });
    }

    // The Google identity may be stored in a separate
    // account document linked to this original user.
    const linkedGoogleIdentity = await User.exists({
      linkedToUserId: user._id,
      googleId: { $exists: true },
    });

    const googleLinked = Boolean(
      user.googleId || linkedGoogleIdentity
    );

    return res.status(200).json({
      success: true,
      data: {
        user: formatUser(user, googleLinked),
      },
    });
  } catch (error) {
    next(error);
  }
};