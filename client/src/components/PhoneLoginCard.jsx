import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Phone,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { authApi } from "../services/api.js";
import "./PhoneAuth.css";

const normalizePhoneNumber = (value) =>
  value.trim().replace(/[()\s-]/g, "");

export default function PhoneLoginCard({
  onAuthenticated,
  onCancel,
}) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("phone");

  const [developmentCode, setDevelopmentCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return undefined;

    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleRequestOtp = async (event) => {
    event.preventDefault();

    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await authApi.requestPhoneLoginOtp(
        normalizedPhone
      );

      const data = response.data || {};

      setPhoneNumber(normalizedPhone);
      setDevelopmentCode(data.developmentCode || "");
      setCooldown(Number(data.resendAfterSeconds) || 60);
      setStep("verify");
      setNotice(
        "Enter the verification code to continue. Only verified phone numbers can sign in."
      );
    } catch (requestError) {
      setError(requestError.message);

      if (requestError.retryAfterSeconds) {
        setCooldown(requestError.retryAfterSeconds);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || busy) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await authApi.requestPhoneLoginOtp(
        phoneNumber
      );

      const data = response.data || {};

      setDevelopmentCode(data.developmentCode || "");
      setCode("");
      setCooldown(Number(data.resendAfterSeconds) || 60);

      setNotice("A new verification request has been processed.");
    } catch (requestError) {
      setError(requestError.message);

      if (requestError.retryAfterSeconds) {
        setCooldown(requestError.retryAfterSeconds);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (event) => {
    event.preventDefault();

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await authApi.verifyPhoneLoginOtp(
        phoneNumber,
        code.trim()
      );

      if (!response.data?.token) {
        throw new Error(
          "Phone verification succeeded without a session token."
        );
      }

      onAuthenticated(response);
    } catch (verificationError) {
      setError(verificationError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="phone-auth-card">
      <div className="phone-auth-heading">
        <h3>
          {step === "phone"
            ? "Sign in with your phone"
            : "Verify your phone number"}
        </h3>

        <p>
          {step === "phone"
            ? "Use the verified phone number linked to your ResuMatch account."
            : `Enter the six-digit code for ${phoneNumber}.`}
        </p>
      </div>

      {error && (
        <div className="phone-auth-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="phone-auth-success" role="status">
          <ShieldCheck size={16} />
          <span>{notice}</span>
        </div>
      )}

      {step === "phone" ? (
        <form onSubmit={handleRequestOtp}>
          <div className="phone-auth-field">
            <label htmlFor="login-phone-number">
              Phone number with country code
            </label>

            <input
              id="login-phone-number"
              className="phone-auth-input"
              type="tel"
              placeholder="+919876543210"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(event) =>
                setPhoneNumber(event.target.value)
              }
              required
              minLength={9}
              maxLength={16}
            />
          </div>

          <p className="phone-auth-helper">
            Include the plus sign and international country code.
            Example: +91 followed by your 10-digit mobile number.
          </p>

          <div className="phone-auth-actions">
            <button
              className="phone-auth-primary"
              type="submit"
              disabled={busy}
            >
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={15} />
                  Requesting...
                </>
              ) : (
                <>
                  <Phone size={15} />
                  Request OTP
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        <>
          {developmentCode && (
            <div className="phone-auth-dev-code">
              <small>LOCAL DEVELOPMENT OTP</small>
              <strong>{developmentCode}</strong>
              <p>
                Testing code only. No SMS has been sent.
              </p>
            </div>
          )}

          <form onSubmit={handleVerify}>
            <div className="phone-auth-field">
              <label htmlFor="login-phone-otp">
                Six-digit verification code
              </label>

              <input
                id="login-phone-otp"
                className="phone-auth-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(event) =>
                  setCode(
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 6)
                  )
                }
                required
                pattern="[0-9]{6}"
                maxLength={6}
              />
            </div>

            <div className="phone-auth-actions">
              <button
                className="phone-auth-primary"
                type="submit"
                disabled={busy || code.length !== 6}
              >
                {busy ? (
                  <>
                    <LoaderCircle className="spin" size={15} />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    Verify and sign in
                  </>
                )}
              </button>

              <button
                className="phone-auth-secondary"
                type="button"
                onClick={handleResend}
                disabled={busy || cooldown > 0}
              >
                <RefreshCw size={14} />
                {cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Resend code"}
              </button>
            </div>
          </form>
        </>
      )}

      <button
        className="phone-auth-back"
        type="button"
        onClick={onCancel}
        disabled={busy}
      >
        <ArrowLeft size={14} />
        Back to login options
      </button>
    </section>
  );
}