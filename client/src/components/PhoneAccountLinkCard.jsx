
import { useEffect, useState } from "react";
import {
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

export default function PhoneAccountLinkCard({
  token,
  phoneNumber = "",
  phoneVerified = false,
  onLinked,
}) {
  const [number, setNumber] = useState(phoneNumber || "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const [step, setStep] = useState("request");
  const [verified, setVerified] = useState(Boolean(phoneVerified));

  const [developmentCode, setDevelopmentCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Countdown timer for the OTP resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  // Request an OTP to link the phone to the current account.
  const handleRequestOtp = async (event) => {
    event.preventDefault();

    const normalizedPhone = normalizePhoneNumber(number);

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await authApi.requestPhoneLinkOtp(
        token,
        normalizedPhone,
        password
      );

      const data = response.data || {};

      setNumber(normalizedPhone);
      setDevelopmentCode(data.developmentCode || "");
      setCooldown(Number(data.resendAfterSeconds) || 60);
      setCode("");
      setStep("verify");

      setNotice(
        "Your verification request is ready. Verify the number to link it to this account."
      );
    } catch (requestError) {
      setError(requestError.message || "Could not request a verification code.");

      if (requestError.retryAfterSeconds) {
        setCooldown(requestError.retryAfterSeconds);
      }
    } finally {
      setBusy(false);
    }
  };

  // Request another OTP after the cooldown expires.
  const handleResend = async () => {
    if (busy || cooldown > 0) {
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await authApi.requestPhoneLinkOtp(
        token,
        number,
        password
      );

      const data = response.data || {};

      setDevelopmentCode(data.developmentCode || "");
      setCode("");
      setCooldown(Number(data.resendAfterSeconds) || 60);

      setNotice("A new verification request has been processed.");
    } catch (requestError) {
      setError(requestError.message || "Could not resend the verification code.");

      if (requestError.retryAfterSeconds) {
        setCooldown(requestError.retryAfterSeconds);
      }
    } finally {
      setBusy(false);
    }
  };

  // Verify the OTP and link the phone to the existing account.
  const handleVerify = async (event) => {
    event.preventDefault();

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await authApi.verifyPhoneLinkOtp(
        token,
        number,
        code.trim()
      );

      const linkedUser = response.data?.user;

      if (!linkedUser) {
        throw new Error(
          "Phone verification completed without returning account information."
        );
      }

      // Update the parent profile.
      onLinked?.(linkedUser);

      // Update this component after successful verification.
      setVerified(true);
      setStep("done");
      setPassword("");
      setCode("");
      setDevelopmentCode("");

      setNotice(
        "Your phone number is now linked to your existing ResuMatch account."
      );
    } catch (verificationError) {
      setError(
        verificationError.message || "Phone verification failed."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="phone-auth-card">
      <div className="phone-auth-heading">
        <h3>Phone number verification</h3>

        <p>
          Add phone sign-in to your existing account while keeping
          your saved reports and other sign-in methods.
        </p>
      </div>

      {verified ? (
        <div className="phone-auth-verified">
          <CheckCircle2 size={22} color="#16a34a" />

          <strong>Phone number verified</strong>

          <span>{number}</span>

          <p className="phone-auth-helper">
            You can now use this verified number for ResuMatch phone sign-in.
          </p>
        </div>
      ) : (
        <>
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

          {step === "request" ? (
            <form onSubmit={handleRequestOtp}>
              <div className="phone-auth-field">
                <label htmlFor="profile-phone-number">
                  Phone number with country code
                </label>

                <input
                  id="profile-phone-number"
                  className="phone-auth-input"
                  type="tel"
                  placeholder="+919876543210"
                  autoComplete="tel"
                  value={number}
                  onChange={(event) => setNumber(event.target.value)}
                  required
                  minLength={9}
                  maxLength={16}
                />
              </div>

              <div className="phone-auth-field">
                <label htmlFor="profile-phone-password">
                  Confirm your existing ResuMatch password
                </label>

                <input
                  id="profile-phone-password"
                  className="phone-auth-input"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your account password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              <p className="phone-auth-helper">
                Password confirmation protects your existing account
                before a new phone number is linked.
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
                      Verify phone number
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
                  <label htmlFor="profile-phone-otp">
                    Six-digit verification code
                  </label>

                  <input
                    id="profile-phone-otp"
                    className="phone-auth-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={code}
                    onChange={(event) => {
                      setCode(
                        event.target.value
                          .replace(/\D/g, "")
                          .slice(0, 6)
                      );
                    }}
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
                        Verify and link phone
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

              <p className="phone-auth-helper">
                Number being verified: {number}
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
