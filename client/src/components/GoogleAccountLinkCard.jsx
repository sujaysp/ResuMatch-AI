
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { authApi } from "../services/api.js";

import {
  mountGoogleSignInButton,
  unmountGoogleSignInButton,
} from "../services/googleIdentity.js";

import "./GoogleAccountLinkCard.css";

export default function GoogleAccountLinkCard({
  token,
  googleClientId,
  googleLinked = false,
  onLinked,
}) {
  // Google button container.
  const googleButtonRef = useRef(null);

  // Keep the latest values available to Google's external callback.
  const passwordRef = useRef("");
  const tokenRef = useRef(token);
  const onLinkedRef = useRef(onLinked);

  // Prevent duplicate authentication requests.
  const busyRef = useRef(false);

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const normalizedClientId =
    typeof googleClientId === "string"
      ? googleClientId.trim()
      : "";

  // Keep external callback references synchronized with React state.
  useEffect(() => {
    tokenRef.current = token;
    onLinkedRef.current = onLinked;
  }, [token, onLinked]);

  // Handle a Google credential returned by Google Identity Services.
  const handleGoogleCredential = useCallback(async (idToken) => {
    if (busyRef.current) {
      return;
    }

    const currentPassword = passwordRef.current;
    const currentToken = tokenRef.current;

    if (!currentPassword) {
      setError(
        "Please enter your existing ResuMatch password before continuing."
      );
      return;
    }

    if (!currentToken) {
      setError(
        "Your ResuMatch session has expired. Please sign in again."
      );
      return;
    }

    if (!idToken || typeof idToken !== "string") {
      setError(
        "Google did not return a valid credential. Please try again."
      );
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError("");
    setLoadError("");
    setSuccessMessage("");

    try {
      // The backend verifies both the original account password
      // and the Google ID token before linking the identities.
      const response = await authApi.linkGoogle(
        currentToken,
        currentPassword,
        idToken
      );

      const linkedUser = response?.data?.user;

      if (!linkedUser || !linkedUser.id) {
        throw new Error(
          "The Google account was verified, but the updated account information was not returned."
        );
      }

      // Clear the password immediately after successful verification.
      passwordRef.current = "";
      setPassword("");

      const message =
        response.message ||
        "Google account linked successfully. Your existing reports are preserved.";

      setSuccessMessage(message);

      // Update the existing authenticated ResuMatch user.
      onLinkedRef.current?.({
        ...linkedUser,
        googleLinked: true,
      });
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Could not link your Google account. Please try again."
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  // Mount Google's official sign-in button.
  useEffect(() => {
    if (googleLinked || !normalizedClientId) {
      return undefined;
    }

    const container = googleButtonRef.current;

    if (!container) {
      return undefined;
    }

    let active = true;

    const credentialHandler = (credential) => {
      if (active) {
        void handleGoogleCredential(credential);
      }
    };

    mountGoogleSignInButton(container, {
      clientId: normalizedClientId,
      onCredential: credentialHandler,
    })
      .catch((scriptError) => {
        if (active) {
          setLoadError(
            scriptError?.message ||
              "Google Sign-In could not be loaded. Please refresh and try again."
          );
        }
      });

    return () => {
      active = false;

      // The identity service protects newer button instances
      // from cleanup belonging to an older React effect.
      unmountGoogleSignInButton(
        container,
        credentialHandler
      );
    };
  }, [
    normalizedClientId,
    googleLinked,
    handleGoogleCredential,
  ]);

  const handlePasswordChange = (event) => {
    const nextPassword = event.target.value;

    // Update the ref directly inside the user interaction,
    // not during component rendering.
    passwordRef.current = nextPassword;

    setPassword(nextPassword);
    setError("");
  };

  const configurationError = !normalizedClientId
    ? "Google authentication is not configured in this browser. Check client/.env."
    : "";

  const visibleError =
    error || loadError || configurationError;

  return (
    <article className="google-link-card">
      <div className="google-link-header">
        <div className="google-link-icon">
          <svg
            viewBox="0 0 48 48"
            width="23"
            height="23"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M43.6 24.5c0-1.5-.1-3-.4-4.4H24v8.3h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-8.9 6-15.3Z"
            />
            <path
              fill="#34A853"
              d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.7-5.2c-1.9 1.3-4.1 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2H5.9v5.4A20 20 0 0 0 24 44Z"
            />
            <path
              fill="#FBBC05"
              d="M12.8 27.8a12 12 0 0 1 0-7.6v-5.4H5.9a20 20 0 0 0 0 18.4l6.9-5.4Z"
            />
            <path
              fill="#EA4335"
              d="M24 12c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 6 29.5 4 24 4A20 20 0 0 0 5.9 14.8l6.9 5.4C14.4 15.5 18.8 12 24 12Z"
            />
          </svg>
        </div>

        <div className="google-link-heading">
          <div className="google-link-title-row">
            <h3>Connect your Google account</h3>

            {googleLinked && (
              <span className="google-link-connected-badge">
                <span />
                Connected
              </span>
            )}
          </div>

          <p>
            Link Google sign-in to your existing ResuMatch
            account so you can access your saved reports
            using either login method.
          </p>
        </div>
      </div>

      {googleLinked ? (
        <div
          className="google-link-success-panel"
          role="status"
        >
          <span className="google-link-success-icon">
            ✓
          </span>

          <div>
            <strong>Google account connected</strong>

            <p>
              {successMessage ||
                "You can now use your Google account to access your existing ResuMatch workspace and saved reports."}
            </p>
          </div>
        </div>
      ) : (
        <div className="google-link-form">
          <label htmlFor="google-link-password">
            Your existing ResuMatch password
          </label>

          <input
            id="google-link-password"
            type="password"
            value={password}
            onChange={handlePasswordChange}
            placeholder="Enter your current password"
            autoComplete="current-password"
            disabled={busy}
          />

          <p className="google-link-help">
            Enter the password for your original ResuMatch
            account. Google will then ask you to authenticate
            the account you want to connect.
          </p>

          <div
            className="google-link-button"
            ref={googleButtonRef}
            aria-label="Continue with Google to link your account"
            aria-busy={busy}
          />

          {busy && (
            <p
              className="google-link-progress"
              role="status"
            >
              Verifying both accounts and connecting them...
            </p>
          )}

          {visibleError && (
            <p
              className="google-link-error"
              role="alert"
            >
              {visibleError}
            </p>
          )}
        </div>
      )}

      <div className="google-link-footnote">
        <span aria-hidden="true">🔒</span>

        Your existing reports, resume analyses and account
        history will remain attached to your original
        ResuMatch account.
      </div>
    </article>
  );
}