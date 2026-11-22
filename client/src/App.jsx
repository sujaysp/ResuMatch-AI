
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  FileUp,
  History,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";

import { authApi, resumeApi, analysisApi } from "./services/api.js";

import {
  mountGoogleSignInButton,
  unmountGoogleSignInButton,
  disableGoogleAutoSelect,
} from "./services/googleIdentity.js";

import GoogleAccountLinkCard from "./components/GoogleAccountLinkCard.jsx";
import PhoneLoginCard from "./components/PhoneLoginCard.jsx";
import PhoneAccountLinkCard from "./components/PhoneAccountLinkCard.jsx";

import "./App.css";

const TOKEN_KEY = "resumatch_token";

const APP_VIEWS = new Set([
  "dashboard",
  "analyze",
  "history",
  "report",
  "profile",
  "logout",
]);

function readBrowserRoute() {
  const segments = window.location.hash
    .replace(/^#\/?/, "")
    .split("/")
    .filter(Boolean);

  const requestedView = segments[0] || "dashboard";

  const view = APP_VIEWS.has(requestedView)
    ? requestedView
    : "dashboard";

  const reportId =
    view === "report" && segments[1]
      ? decodeURIComponent(segments[1])
      : null;

  return { view, reportId };
}

function writeBrowserRoute(view, reportId = null, replace = false) {
  const suffix =
    view === "report" && reportId
      ? `/${encodeURIComponent(reportId)}`
      : "";

  const hash = `#/${view}${suffix}`;

  if (window.location.hash === hash) return;

  const url = `${window.location.pathname}${window.location.search}${hash}`;

  const method = replace ? "replaceState" : "pushState";

  window.history[method](
    { resumatch: true, view, reportId },
    "",
    url
  );
}

const SAMPLE_JOB_DESCRIPTION = `We are looking for a Full Stack Developer.

Required technical skills:
Python, React, Node.js, MongoDB, REST APIs, JavaScript and Git.

The candidate should have experience building web applications,
developing backend services, working with databases,
and integrating APIs.

Strong problem-solving skills and knowledge of modern software
development practices are preferred.`;

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name = "Candidate") {
  return (
    String(name)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "C"
  );
}

function getUserFromResponse(data) {
  if (!data || typeof data !== "object") return null;

  return (
    data.user ??
    data.profile ??
    (data.id || data.email ? data : null)
  );
}

function GoogleMark() {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="google-mark"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
      />

      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.9c-.58 2.96-2.25 5.47-4.73 7.16l7.62 5.91c4.45-4.1 7.19-10.14 7.19-17.54Z"
      />

      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.75-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.89.93 7.57 2.56 10.78l7.97-6.19Z"
      />

      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.62-5.91c-2.12 1.43-4.84 2.28-8.28 2.28-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
      />
    </svg>
  );
}

function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`}>
      <div className="brand-mark">
        <BrainCircuit size={22} strokeWidth={2.1} />
      </div>

      <div className="brand-copy">
        <span>ResuMatch</span>
        <small>AI CAREER INTELLIGENCE</small>
      </div>
    </div>
  );
}

/* ==========================================
   AUTHENTICATION SCREEN
========================================== */

function AuthScreen({
  mode,
  setMode,
  form,
  setForm,
  onSubmit,
  busy,
  error,
  googleClientId,
  onGoogleCredential,
  onPhoneAuthenticated,
}) {
  const isRegister = mode === "register";

  const googleButtonRef = useRef(null);
  const credentialHandlerRef = useRef(onGoogleCredential);

  const [googleButtonError, setGoogleButtonError] = useState("");
  const [phoneLoginOpen, setPhoneLoginOpen] = useState(false);

  useEffect(() => {
    credentialHandlerRef.current = onGoogleCredential;
  }, [onGoogleCredential]);

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) {
      return undefined;
    }

    let active = true;

    const element = googleButtonRef.current;

    const credentialHandler = (credential) => {
      if (active && credential) {
        credentialHandlerRef.current?.(credential);
      }
    };

    mountGoogleSignInButton(element, {
      clientId: googleClientId,
      onCredential: credentialHandler,
    })
      .then(() => {
        if (!active) {
          unmountGoogleSignInButton(
            element,
            credentialHandler
          );
        }
      })
      .catch((loadError) => {
        if (active) {
          setGoogleButtonError(
            loadError?.message ||
              "Google Sign-In could not be loaded. Refresh and try again."
          );
        }
      });

    return () => {
      active = false;

      unmountGoogleSignInButton(
        element,
        credentialHandler
      );
    };
  }, [googleClientId]);

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  return (
    <div className="auth-layout">
      <section className="auth-showcase">
        <Brand />

        <div className="auth-showcase-content">
          <div className="eyebrow light-eyebrow">
            <Sparkles size={15} />
            YOUR CAREER, MORE INTELLIGENT
          </div>

          <h1>
            Make your next <span>career move count.</span>
          </h1>

          <p>
            Understand your resume, uncover skill gaps, and turn
            your career goals into an actionable plan with
            AI-powered insights.
          </p>

          <div className="showcase-points">
            <div>
              <CheckCircle2 size={19} />
              Resume-to-job skill analysis
            </div>

            <div>
              <CheckCircle2 size={19} />
              Clear, explainable match scores
            </div>

            <div>
              <CheckCircle2 size={19} />
              Personalized learning recommendations
            </div>
          </div>
        </div>

        <div className="showcase-bottom">
          <ShieldCheck size={17} />
          Your career data is available through your authenticated account.
        </div>
      </section>

      <section className="auth-form-section">
        <div className="auth-mobile-brand">
          <Brand />
        </div>

        <div className="auth-form-wrap">
          <div className="auth-heading">
            <div className="eyebrow">
              <Sparkles size={14} />
              RESUMATCH AI
            </div>

            <h2>
              {isRegister
                ? "Create your account"
                : "Welcome back"}
            </h2>

            <p>
              {isRegister
                ? "Start understanding your career potential."
                : "Sign in to continue your career journey."}
            </p>
          </div>

          {error && (
            <div className="notice notice-error">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}

          {googleButtonError && (
            <div className="notice notice-error">
              <AlertCircle size={17} />
              <span>{googleButtonError}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="auth-form">
            {isRegister && (
              <label className="field-label">
                Full name

                <div className="input-wrap">
                  <UserRound size={18} />

                  <input
                    type="text"
                    placeholder="Your name"
                    value={form.name}
                    onChange={(event) =>
                      updateField("name", event.target.value)
                    }
                    required
                    minLength={2}
                    autoComplete="name"
                  />
                </div>
              </label>
            )}

            <label className="field-label">
              Email address

              <div className="input-wrap">
                <Mail size={18} />

                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(event) =>
                    updateField("email", event.target.value)
                  }
                  required
                  autoComplete="email"
                />
              </div>
            </label>

            <label className="field-label">
              Password

              <div className="input-wrap">
                <LockKeyhole size={18} />

                <input
                  type="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(event) =>
                    updateField("password", event.target.value)
                  }
                  required
                  minLength={8}
                  autoComplete={
                    isRegister
                      ? "new-password"
                      : "current-password"
                  }
                />
              </div>
            </label>

            <button
              className="button button-primary auth-submit"
              type="submit"
              disabled={busy}
            >
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={18} />
                  Please wait...
                </>
              ) : (
                <>
                  {isRegister ? "Create account" : "Sign in"}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>or continue with</span>
          </div>

          <div className="auth-provider-stack">
            {googleClientId ? (
              <div
                ref={googleButtonRef}
                className={`google-signin-container ${
                  busy ? "is-busy" : ""
                }`}
                aria-label="Continue with Google"
              />
            ) : (
              <button
                className="provider-button"
                type="button"
                disabled
                title="Add VITE_GOOGLE_CLIENT_ID to client/.env to enable Google sign-in"
              >
                <GoogleMark />
                Configure Google sign-in
              </button>
            )}

            <button
              className="provider-button"
              type="button"
              disabled={busy || isRegister}
              onClick={() =>
                setPhoneLoginOpen((current) => !current)
              }
              title={
                isRegister
                  ? "Phone sign-in is available from the login screen."
                  : "Sign in using your verified phone number."
              }
            >
              <Phone size={18} />

              {phoneLoginOpen
                ? "Close phone sign-in"
                : "Continue with phone"}
            </button>
          </div>

          <p className="auth-provider-note">
            {googleClientId
              ? "Google sign-in is connected. Phone sign-in is available using your verified phone number."
              : "Google sign-in becomes available after the OAuth client ID is configured. Phone sign-in is available using your verified phone number."}
          </p>

          {phoneLoginOpen && !isRegister && (
            <PhoneLoginCard
              onAuthenticated={onPhoneAuthenticated}
              onCancel={() => setPhoneLoginOpen(false)}
            />
          )}

          <div className="auth-switch">
            {isRegister
              ? "Already have an account?"
              : "New to ResuMatch AI?"}

            <button
              type="button"
              onClick={() =>
                setMode(isRegister ? "login" : "register")
              }
            >
              {isRegister ? "Sign in" : "Create an account"}
            </button>
          </div>

          <div className="auth-security">
            <ShieldCheck size={15} />
            Secure access to your personal career workspace
          </div>
        </div>
      </section>
    </div>
  );
}

/* ==========================================
   SCORE RING
========================================== */

function ScoreRing({ score }) {
  const safeScore = Math.min(
    100,
    Math.max(0, Number(score) || 0)
  );

  return (
    <div
      className="score-ring"
      style={{
        "--score": `${safeScore * 3.6}deg`,
      }}
    >
      <div className="score-ring-inner">
        <strong>{safeScore}%</strong>
        <span>SKILL MATCH</span>
      </div>
    </div>
  );
}

/* ==========================================
   AI RECOMMENDATIONS
========================================== */

function RecommendationPanel({
  recommendations,
  generating,
  onGenerate,
}) {
  if (!recommendations) {
    return (
      <section className="recommendation-empty">
        <div className="recommendation-icon">
          <Sparkles size={25} />
        </div>

        <div>
          <h3>Get your AI career action plan</h3>

          <p>
            Let Gemini turn your skill gaps into practical
            learning steps, resume improvements and interview
            preparation.
          </p>
        </div>

        <button
          className="button button-primary"
          onClick={onGenerate}
          disabled={generating}
          type="button"
        >
          {generating ? (
            <>
              <LoaderCircle className="spin" size={17} />
              Generating...
            </>
          ) : (
            <>
              Generate recommendations
              <Sparkles size={17} />
            </>
          )}
        </button>
      </section>
    );
  }

  const prioritySkills = recommendations.prioritySkills ?? [];
  const learningPlan = recommendations.learningPlan ?? [];
  const resumeImprovements =
    recommendations.resumeImprovements ?? [];
  const interviewPreparation =
    recommendations.interviewPreparation ?? [];

  return (
    <section className="ai-results">
      <div className="section-heading">
        <div>
          <div className="eyebrow">
            <Sparkles size={14} />
            GEMINI AI INSIGHTS
          </div>

          <h2>Your career action plan</h2>
        </div>

        <span className="ai-status">
          <span className="status-dot" />
          Generated
        </span>
      </div>

      <div className="ai-summary">
        <div className="ai-summary-icon">
          <BrainCircuit size={23} />
        </div>

        <div>
          <h3>Career overview</h3>
          <p>{recommendations.summary}</p>
        </div>
      </div>

      <div className="recommendation-block">
        <div className="subsection-heading">
          <Target size={19} />
          <h3>Priority skills to develop</h3>
        </div>

        <div className="priority-list">
          {prioritySkills.length ? (
            prioritySkills.map((item, index) => (
              <article
                className="priority-card"
                key={`${item.skill}-${index}`}
              >
                <div className="priority-card-top">
                  <h4>{item.skill}</h4>

                  <span
                    className={`priority-badge ${item.priority}`}
                  >
                    {item.priority} priority
                  </span>
                </div>

                <p>{item.reason}</p>

                <ul>
                  {(item.actions ?? []).map(
                    (action, actionIndex) => (
                      <li key={`${index}-${actionIndex}`}>
                        <Check size={15} />
                        {action}
                      </li>
                    )
                  )}
                </ul>
              </article>
            ))
          ) : (
            <p className="empty-skills">
              No priority skills were returned.
            </p>
          )}
        </div>
      </div>

      <div className="recommendation-block">
        <div className="subsection-heading">
          <TrendingUp size={19} />
          <h3>Your learning roadmap</h3>
        </div>

        <div className="learning-roadmap">
          {learningPlan.length ? (
            learningPlan.map((phase, index) => (
              <article
                className="roadmap-step"
                key={`${phase.phase}-${index}`}
              >
                <div className="roadmap-number">
                  {index + 1}
                </div>

                <div>
                  <h4>{phase.phase}</h4>
                  <p>{phase.goal}</p>

                  <ul>
                    {(phase.tasks ?? []).map(
                      (task, taskIndex) => (
                        <li key={`${index}-${taskIndex}`}>
                          {task}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </article>
            ))
          ) : (
            <p className="empty-skills">
              No learning phases were returned.
            </p>
          )}
        </div>
      </div>

      <div className="recommendation-two-column">
        <div className="recommendation-block">
          <div className="subsection-heading">
            <FileText size={19} />
            <h3>Resume improvements</h3>
          </div>

          <ul className="plain-action-list">
            {resumeImprovements.map((item, index) => (
              <li key={index}>
                <CheckCircle2 size={16} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="recommendation-block">
          <div className="subsection-heading">
            <BriefcaseBusiness size={19} />
            <h3>Interview preparation</h3>
          </div>

          <ul className="plain-action-list">
            {interviewPreparation.map((item, index) => (
              <li key={index}>
                <CheckCircle2 size={16} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="ai-disclaimer">
        AI-generated suggestions are guidance, not verified
        facts about your skills or qualifications. Review
        recommendations before acting on them.
      </p>
    </section>
  );
}

/* ==========================================
   SKILL EVIDENCE
========================================== */

function getEvidenceText(evidence) {
  if (typeof evidence === "string") return evidence;

  if (Array.isArray(evidence)) {
    return evidence
      .map(getEvidenceText)
      .filter(Boolean)
      .join(" · ");
  }

  if (!evidence || typeof evidence !== "object") {
    return "";
  }

  return (
    evidence.text ||
    evidence.evidence ||
    evidence.snippet ||
    evidence.line ||
    ""
  );
}

function SkillGroup({
  title,
  description,
  skills = [],
  type,
}) {
  return (
    <div className={`skill-group ${type}`}>
      <div className="skill-group-heading">
        <h3>{title}</h3>
        <span>{skills.length}</span>
      </div>

      <p>{description}</p>

      <div className="skill-chips skill-evidence-list">
        {skills.length > 0 ? (
          skills.map((skill) => {
            const resumeEvidence = getEvidenceText(
              skill.resumeEvidence ||
                skill.resumeEvidenceText ||
                skill.evidence
            );

            const requirementEvidence = getEvidenceText(
              skill.requirementEvidence ||
                skill.jobRequirementEvidence ||
                skill.jobDescriptionEvidence ||
                skill.jobEvidence
            );

            return (
              <div
                className="skill-evidence-item"
                key={skill.name}
              >
                <span className="skill-chip">
                  {skill.name}
                </span>

                {resumeEvidence && (
                  <small>
                    <strong>Resume evidence:</strong>
                    {resumeEvidence}
                  </small>
                )}

                {requirementEvidence && (
                  <small>
                    <strong>Job requirement:</strong>
                    {requirementEvidence}
                  </small>
                )}
              </div>
            );
          })
        ) : (
          <span className="empty-skills">
            No skills in this category
          </span>
        )}
      </div>
    </div>
  );
}

/* ==========================================
   ANALYSIS RESULTS
========================================== */

function AnalysisResults({
  result,
  recommendations,
  generating,
  onGenerate,
  reportDate,
  reportFileName,
}) {
  if (!result?.analysis) return null;

  const analysis = result.analysis;

  const matchedSkills = analysis.matchedSkills ?? [];
  const missingSkills = analysis.missingSkills ?? [];
  const additionalSkills = analysis.additionalSkills ?? [];

  const breakdown = analysis.scoreBreakdown ?? {};
  const requirementBreakdown =
    analysis.requirementBreakdown ?? {};

  const matchedWeight =
    requirementBreakdown.matchedWeight ??
    analysis.matchedWeight;

  const totalWeight =
    requirementBreakdown.totalWeight ??
    analysis.totalWeight;

  const displayedScore =
    analysis.weightedSkillMatchScore ??
    analysis.skillMatchScore ??
    0;

  return (
    <section className="results-section report-results-section">
      {reportFileName && (
        <div className="report-context-line">
          <span>
            <FileText size={15} />
            {reportFileName}
          </span>

          {reportDate && (
            <span>
              <CalendarDays size={15} />
              {formatDate(reportDate)}
            </span>
          )}
        </div>
      )}

      <div className="section-heading">
        <div>
          <div className="eyebrow">
            <Activity size={14} />
            ANALYSIS COMPLETE
          </div>

          <h2>Your resume match report</h2>

          <p className="section-description">
            Based on the recognized skills in your resume
            and the job description.
          </p>
        </div>

        <span className="completed-label">
          <CheckCircle2 size={16} />
          Saved
        </span>
      </div>

      <div className="score-overview">
        <div className="score-main">
          <ScoreRing score={displayedScore} />

          <div className="score-description">
            <h3>Skill coverage</h3>

            <p>
              Your resume contains{" "}
              <strong>
                {breakdown.matchedRequiredSkills ??
                  analysis.matchedRequiredSkills ??
                  matchedSkills.length}
              </strong>{" "}
              of{" "}
              <strong>
                {breakdown.totalRequiredSkills ??
                  analysis.requiredSkillCount ??
                  missingSkills.length + matchedSkills.length}
              </strong>{" "}
              recognized job requirements.
            </p>

            <span>
              This is a skill-overlap measure, not an official ATS score.
            </span>

            {analysis.mandatorySkillCoverage !== undefined &&
              analysis.mandatorySkillCoverage !== null && (
                <span className="mandatory-coverage-note">
                  Mandatory requirement coverage:{" "}
                  <strong>
                    {analysis.mandatorySkillCoverage}%
                  </strong>
                </span>
              )}
          </div>
        </div>

        <div className="score-metrics">
          <div className="metric metric-match">
            <span className="metric-icon">
              <CheckCircle2 size={18} />
            </span>
            <strong>{matchedSkills.length}</strong>
            <small>Matched skills</small>
          </div>

          <div className="metric metric-missing">
            <span className="metric-icon">
              <Target size={18} />
            </span>
            <strong>{missingSkills.length}</strong>
            <small>Missing skills</small>
          </div>

          <div className="metric metric-extra">
            <span className="metric-icon">
              <Sparkles size={18} />
            </span>
            <strong>{additionalSkills.length}</strong>
            <small>Additional skills</small>
          </div>
        </div>
      </div>

      <div className="skill-groups">
        <SkillGroup
          title="Matched skills"
          description="Recognized in both resume and job description"
          skills={matchedSkills}
          type="matched"
        />

        <SkillGroup
          title="Skills to explore"
          description="Required by the job but not detected in the resume"
          skills={missingSkills}
          type="missing"
        />

        <SkillGroup
          title="Additional skills"
          description="Detected in your resume but not in this job description"
          skills={additionalSkills}
          type="additional"
        />
      </div>

      {Number.isFinite(Number(matchedWeight)) &&
        Number.isFinite(Number(totalWeight)) &&
        Number(totalWeight) > 0 && (
          <section className="requirement-breakdown-panel">
            <div className="subsection-heading">
              <Target size={19} />
              <h3>Weighted requirement coverage</h3>
            </div>

            <p className="section-description">
              Matched requirement weight:{" "}
              <strong>
                {matchedWeight} / {totalWeight}
              </strong>
              . Required skills carry more weight than
              preferred or optional skills.
            </p>
          </section>
        )}

      {analysis.jobDescription && (
        <details className="job-description-report">
          <summary>
            <BriefcaseBusiness size={16} />
            View the job description used for this report
          </summary>

          <p>{analysis.jobDescription}</p>
        </details>
      )}

      <RecommendationPanel
        recommendations={recommendations}
        generating={generating}
        onGenerate={onGenerate}
      />
    </section>
  );
}

/* ==========================================
   MAIN APPLICATION
========================================== */

export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem(TOKEN_KEY) || ""
  );

  const [user, setUser] = useState(null);

  const [sessionChecking, setSessionChecking] = useState(
    () => Boolean(localStorage.getItem(TOKEN_KEY))
  );

  const [authMode, setAuthMode] = useState("login");

  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  const [view, setView] = useState(
    () => readBrowserRoute().view
  );

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notice, setNotice] = useState(null);

  const [history, setHistory] = useState([]);
  const [historyMeta, setHistoryMeta] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedResume, setUploadedResume] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [jobDescription, setJobDescription] = useState(
    SAMPLE_JOB_DESCRIPTION
  );

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const [recommendations, setRecommendations] = useState(null);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [generatingForId, setGeneratingForId] = useState(null);

  const [activeReport, setActiveReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");

  const [logoutBusy, setLogoutBusy] = useState(false);

  /* ==========================================
     RESTORE AUTHENTICATED SESSION
  ========================================== */

  useEffect(() => {
    if (!token) return undefined;

    let cancelled = false;

    authApi
      .me(token)
      .then(async (response) => {
        if (cancelled) return;

        setUser(getUserFromResponse(response.data));

        try {
          const historyResponse = await analysisApi.history(
            token,
            1,
            10
          );

          if (cancelled) return;

          setHistory(
            historyResponse.data?.analyses ?? []
          );

          setHistoryMeta(
            historyResponse.data?.pagination ?? null
          );
        } catch (historyError) {
          if (!cancelled) {
            setNotice({
              type: "error",
              message: historyError.message,
            });
          }
        }
      })
      .catch(() => {
        if (cancelled) return;

        localStorage.removeItem(TOKEN_KEY);

        setToken("");
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) {
          setSessionChecking(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  /* ==========================================
     ANALYSIS HISTORY
  ========================================== */

  const fetchHistory = useCallback(async () => {
    if (!token) return;

    try {
      const response = await analysisApi.history(
        token,
        1,
        10
      );

      setHistory(response.data?.analyses ?? []);

      setHistoryMeta(
        response.data?.pagination ?? null
      );
    } catch (error) {
      setNotice({
        type: "error",
        message: error.message,
      });
    }
  }, [token]);

  const refreshHistory = useCallback(async () => {
    if (!token) return;

    setHistoryLoading(true);

    try {
      await fetchHistory();
    } finally {
      setHistoryLoading(false);
    }
  }, [token, fetchHistory]);

  /* ==========================================
     ESTABLISH AUTHENTICATED SESSION
  ========================================== */

  const establishSession = (response, successMessage) => {
    const data = response.data ?? {};
    const newToken = data.token;

    if (!newToken) {
      throw new Error(
        "Authentication succeeded without returning a ResuMatch session token."
      );
    }

    const sessionUser = getUserFromResponse(data);

    if (!sessionUser) {
      throw new Error(
        "Authentication succeeded without returning user information."
      );
    }

    localStorage.setItem(TOKEN_KEY, newToken);

    setUser(sessionUser);
    setToken(newToken);

    writeBrowserRoute("dashboard", null, true);

    setView("dashboard");
    setMobileNavOpen(false);

    setNotice({
      type: "success",
      message: successMessage,
    });

    setAuthError("");
  };

  /* ==========================================
     EMAIL/PASSWORD AUTHENTICATION
  ========================================== */

  const handleAuthSubmit = async (event) => {
    event.preventDefault();

    setAuthBusy(true);
    setAuthError("");

    try {
      const credentials = {
        email: authForm.email.trim(),
        password: authForm.password,
      };

      const response =
        authMode === "register"
          ? await authApi.register({
              ...credentials,
              name: authForm.name.trim(),
            })
          : await authApi.login(credentials);

      establishSession(
        response,
        authMode === "register"
          ? "Your account has been created successfully."
          : "Welcome back to ResuMatch AI."
      );
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  };

  /* ==========================================
     GOOGLE AUTHENTICATION
  ========================================== */

  const handleGoogleCredential = async (idToken) => {
    if (!idToken || typeof idToken !== "string") {
      setAuthError(
        "Google did not return a valid sign-in credential. Please try again."
      );

      return;
    }

    setAuthBusy(true);
    setAuthError("");

    try {
      const response = await authApi.google(idToken);

      establishSession(
        response,
        "Signed in with Google successfully."
      );
    } catch (error) {
      setAuthError(
        error.message ||
          "Could not complete Google sign-in with ResuMatch."
      );
    } finally {
      setAuthBusy(false);
    }
  };

  /* ==========================================
     LOGOUT
  ========================================== */

  const handleLogout = async () => {
    setLogoutBusy(true);

    try {
      disableGoogleAutoSelect();

      localStorage.removeItem(TOKEN_KEY);

      setToken("");
      setUser(null);
      setSessionChecking(false);

      setHistory([]);
      setHistoryMeta(null);

      setSelectedFile(null);
      setUploadedResume(null);

      setAnalysisResult(null);
      setRecommendations(null);

      setActiveReport(null);
      setReportError("");

      writeBrowserRoute("dashboard", null, true);

      setView("dashboard");
      setNotice(null);
    } finally {
      setLogoutBusy(false);
    }
  };

  /* ==========================================
     RESUME FILE SELECTION
  ========================================== */

  const handleFileSelection = (event) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    const hasPdfExtension = file.name
      .toLowerCase()
      .endsWith(".pdf");

    const hasValidMime =
      !file.type || file.type === "application/pdf";

    if (!hasPdfExtension || !hasValidMime) {
      setNotice({
        type: "error",
        message: "Please select a valid PDF file.",
      });

      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setNotice({
        type: "error",
        message: "Resume file must be 5 MB or smaller.",
      });

      return;
    }

    setSelectedFile(file);
    setUploadedResume(null);
    setAnalysisResult(null);
    setRecommendations(null);
    setNotice(null);
  };

  /* ==========================================
     RESUME UPLOAD
  ========================================== */

  const handleUpload = async () => {
    if (!selectedFile) {
      setNotice({
        type: "error",
        message: "Choose a PDF resume before uploading.",
      });

      return;
    }

    setUploading(true);
    setNotice(null);

    try {
      const formData = new FormData();

      formData.append("resume", selectedFile);

      const response = await resumeApi.upload(
        formData,
        token
      );

      setUploadedResume(response.data.resume);
      setSelectedFile(null);

      setAnalysisResult(null);
      setRecommendations(null);

      setNotice({
        type: "success",
        message: "Resume uploaded and processed successfully.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  /* ==========================================
     RESUME ANALYSIS
  ========================================== */

  const handleAnalyze = async () => {
    if (!uploadedResume?.id) {
      setNotice({
        type: "error",
        message: "Upload your resume before starting the analysis.",
      });

      return;
    }

    if (jobDescription.trim().length < 50) {
      setNotice({
        type: "error",
        message: "Please enter a job description with at least 50 characters.",
      });

      return;
    }

    setAnalyzing(true);
    setNotice(null);

    try {
      const response = await analysisApi.compare(
        {
          resumeId: uploadedResume.id,
          jobDescription: jobDescription.trim(),
        },
        token
      );

      setAnalysisResult(response.data);
      setRecommendations(null);

      writeBrowserRoute("analyze");

      setView("analyze");

      setNotice({
        type: "success",
        message: "Your resume analysis has been completed and saved.",
      });

      await refreshHistory();
    } catch (error) {
      setNotice({
        type: "error",
        message: error.message,
      });
    } finally {
      setAnalyzing(false);
    }
  };

  /* ==========================================
     LOAD SAVED REPORT
  ========================================== */

  const loadReport = useCallback(
    async (analysisId) => {
      if (!analysisId || !token) return;

      setReportLoading(true);
      setReportError("");

      setActiveReport(null);
      setRecommendations(null);

      try {
        const response = await analysisApi.getById(
          analysisId,
          token
        );

        const report =
          response.data?.analysis ??
          response.data?.report ??
          response.data;

        if (!report || typeof report !== "object") {
          throw new Error(
            "The report response was empty or invalid."
          );
        }

        setActiveReport({
          id: analysisId,
          report,
        });

        const savedRecommendations =
          report.aiRecommendations ??
          report.recommendations ??
          null;

        if (savedRecommendations) {
          setRecommendations({
            analysisId,
            data: savedRecommendations,
          });
        }
      } catch (error) {
        setReportError(
          error.message || "Could not load this saved report."
        );
      } finally {
        setReportLoading(false);
      }
    },
    [token]
  );

  const handleOpenReport = (analysisId) => {
    if (!analysisId) return;

    writeBrowserRoute("report", analysisId);

    setView("report");
    setMobileNavOpen(false);

    loadReport(analysisId);
  };

  /* ==========================================
     BROWSER BACK/FORWARD NAVIGATION
  ========================================== */

  useEffect(() => {
    const restoreRouteFromBrowserHistory = () => {
      const route = readBrowserRoute();

      setView(route.view);
      setMobileNavOpen(false);

      if (
        route.view === "report" &&
        route.reportId &&
        token
      ) {
        loadReport(route.reportId);
      } else {
        setReportLoading(false);
        setReportError("");
      }
    };

    if (!window.location.hash) {
      writeBrowserRoute("dashboard", null, true);
    } else {
      restoreRouteFromBrowserHistory();
    }

    window.addEventListener(
      "popstate",
      restoreRouteFromBrowserHistory
    );

    return () => {
      window.removeEventListener(
        "popstate",
        restoreRouteFromBrowserHistory
      );
    };
  }, [loadReport, token]);

  /* ==========================================
     AI RECOMMENDATIONS
  ========================================== */

  const handleGenerateRecommendations = async (analysisId) => {
    if (!analysisId) {
      setNotice({
        type: "error",
        message: "Analysis ID is missing.",
      });

      return;
    }

    setGeneratingAI(true);
    setGeneratingForId(analysisId);
    setNotice(null);

    try {
      const response = await analysisApi.recommendations(
        analysisId,
        token
      );

      const aiRecommendations =
        response.data.aiRecommendations;

      setRecommendations({
        analysisId,
        data: aiRecommendations,
      });

      setActiveReport((previous) =>
        previous?.id === analysisId
          ? {
              ...previous,
              report: {
                ...previous.report,
                aiRecommendations,
              },
            }
          : previous
      );

      setNotice({
        type: "success",
        message: "AI career recommendations generated successfully.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: error.message,
      });
    } finally {
      setGeneratingAI(false);
      setGeneratingForId(null);
    }
  };

  /* ==========================================
     DERIVED APPLICATION DATA
  ========================================== */

  const averageScore = useMemo(() => {
    if (!history.length) return 0;

    const total = history.reduce(
      (sum, item) =>
        sum +
        (Number(
          item.weightedSkillMatchScore ??
            item.skillMatchScore
        ) || 0),
      0
    );

    return Math.round(total / history.length);
  }, [history]);

  const profileName =
    user?.name ||
    user?.fullName ||
    user?.email?.split("@")[0] ||
    "Candidate";

  const currentAnalysisId =
    analysisResult?.analysisRecord?.id;

  const currentRecommendations =
    recommendations &&
    currentAnalysisId &&
    recommendations.analysisId === currentAnalysisId
      ? recommendations.data
      : null;

  const activeReportRecommendations =
    recommendations &&
    activeReport?.id &&
    recommendations.analysisId === activeReport.id
      ? recommendations.data
      : activeReport?.report?.aiRecommendations ??
        activeReport?.report?.recommendations ??
        null;

  const navItems = [
    {
      id: "dashboard",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      id: "analyze",
      label: "New analysis",
      icon: Plus,
    },
    {
      id: "history",
      label: "Saved reports",
      icon: History,
    },
  ];

  const pageTitle = {
    dashboard: "Overview",
    analyze: "New analysis",
    history: "Saved reports",
    report: "Report details",
    profile: "Account",
    logout: "Sign out",
  }[view] || "Overview";

  /* ==========================================
     SESSION LOADING SCREEN
  ========================================== */

  if (sessionChecking) {
    return (
      <div className="session-loading">
        <Brand />
        <LoaderCircle className="spin" size={26} />
        <span>Restoring your workspace...</span>
      </div>
    );
  }

  /* ==========================================
     LOGIN / REGISTRATION SCREEN
  ========================================== */

  if (!token) {
    return (
      <AuthScreen
        mode={authMode}
        setMode={(nextMode) => {
          setAuthMode(nextMode);
          setAuthError("");
        }}
        form={authForm}
        setForm={setAuthForm}
        onSubmit={handleAuthSubmit}
        busy={authBusy}
        error={authError}
        googleClientId={
          import.meta.env.VITE_GOOGLE_CLIENT_ID || ""
        }
        onGoogleCredential={handleGoogleCredential}
        onPhoneAuthenticated={(response) =>
          establishSession(
            response,
            "Signed in with phone successfully."
          )
        }
      />
    );
  }

  /* ==========================================
     APPLICATION NAVIGATION
  ========================================== */

  const openView = (nextView) => {
    writeBrowserRoute(nextView);

    setView(nextView);
    setMobileNavOpen(false);

    if (nextView !== "report") {
      setReportError("");
    }
  };

  return (
    <div className="app-shell">
      {/* ======================================
          TOP NAVIGATION
      ====================================== */}

      <header className="topbar">
        <div className="topbar-inner">
          <button
            className="brand-home-button"
            type="button"
            onClick={() => openView("dashboard")}
            aria-label="ResuMatch overview"
          >
            <Brand />
          </button>

          <button
            className="mobile-menu-button icon-button"
            type="button"
            onClick={() =>
              setMobileNavOpen((open) => !open)
            }
            aria-label={
              mobileNavOpen
                ? "Close navigation"
                : "Open navigation"
            }
          >
            {mobileNavOpen ? (
              <X size={21} />
            ) : (
              <Menu size={21} />
            )}
          </button>

          <nav
            className={`primary-nav ${
              mobileNavOpen ? "primary-nav-open" : ""
            }`}
            aria-label="Main navigation"
          >
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`top-nav-link ${
                    view === item.id ||
                    (view === "report" &&
                      item.id === "history")
                      ? "active"
                      : ""
                  }`}
                  onClick={() => openView(item.id)}
                >
                  <Icon size={17} strokeWidth={1.9} />

                  <span>{item.label}</span>

                  {item.id === "history" &&
                    (historyMeta?.totalRecords ?? 0) > 0 && (
                      <small>
                        {historyMeta.totalRecords}
                      </small>
                    )}
                </button>
              );
            })}
          </nav>

          <div className="topbar-right">
            <span className="secure-label">
              <ShieldCheck size={15} />
              Secure workspace
            </span>

            <button
              className={`account-launcher ${
                view === "profile" ? "active" : ""
              }`}
              type="button"
              onClick={() => openView("profile")}
              aria-label="Open account profile"
            >
              <span className="topbar-avatar">
                {getInitials(profileName)}
              </span>

              <span className="account-launcher-copy">
                <strong>{profileName}</strong>
                <small>Account</small>
              </span>

              <ChevronDown size={15} />
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <button
            className="mobile-nav-backdrop"
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
        )}
      </header>

      {/* ======================================
          MAIN APPLICATION CONTENT
      ====================================== */}

      <main className="main-area">
        <div className="page-content">
          <div className="page-context-bar">
            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={14} />
              <strong>{pageTitle}</strong>
            </div>

            <span className="context-date">
              <CalendarDays size={14} />
              {new Date().toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>

          {notice && (
            <div
              className={`notice app-notice notice-${notice.type}`}
              role="status"
            >
              {notice.type === "error" ? (
                <AlertCircle size={17} />
              ) : (
                <CheckCircle2 size={17} />
              )}

              <span>{notice.message}</span>

              <button
                type="button"
                className="notice-close"
                onClick={() => setNotice(null)}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* ==================================
              DASHBOARD AND ANALYSIS
          ================================== */}

          {(view === "dashboard" || view === "analyze") && (
            <>
              <section className="page-heading">
                <div>
                  <div className="eyebrow">
                    <Sparkles size={14} />
                    CAREER INTELLIGENCE WORKSPACE
                  </div>

                  <h1>
                    {view === "analyze"
                      ? "Start a new analysis"
                      : `Welcome back, ${
                          profileName.split(" ")[0]
                        }.`}
                  </h1>

                  <p>
                    {view === "analyze"
                      ? "Upload your resume and compare it with your target role."
                      : "Your next career move starts with understanding where you stand."}
                  </p>
                </div>

                {view === "dashboard" && (
                  <button
                    type="button"
                    className="button button-primary heading-action"
                    onClick={() => {
                      openView("analyze");
                      setAnalysisResult(null);
                      setRecommendations(null);
                    }}
                  >
                    <Plus size={18} />
                    New analysis
                  </button>
                )}
              </section>

              {view === "dashboard" && (
                <section className="stats-grid">
                  <article className="stat-card">
                    <div className="stat-top">
                      <span className="stat-icon purple">
                        <FileText size={19} />
                      </span>

                      <span className="stat-caption">
                        TOTAL REPORTS
                      </span>
                    </div>

                    <strong>
                      {historyMeta?.totalRecords ??
                        history.length}
                    </strong>

                    <span className="stat-note">
                      Saved resume analyses
                    </span>
                  </article>

                  <article className="stat-card">
                    <div className="stat-top">
                      <span className="stat-icon green">
                        <Target size={19} />
                      </span>

                      <span className="stat-caption">
                        AVERAGE MATCH
                      </span>
                    </div>

                    <strong>{averageScore}%</strong>

                    <span className="stat-note">
                      Across recent reports
                    </span>
                  </article>

                  <article className="stat-card">
                    <div className="stat-top">
                      <span className="stat-icon orange">
                        <Clock3 size={19} />
                      </span>

                      <span className="stat-caption">
                        LATEST ACTIVITY
                      </span>
                    </div>

                    <strong className="stat-date">
                      {history[0]
                        ? formatDate(history[0].createdAt)
                        : "—"}
                    </strong>

                    <span className="stat-note">
                      Most recent analysis
                    </span>
                  </article>
                </section>
              )}

              <section className="workspace-section">
                <div className="section-heading workspace-title">
                  <div>
                    <h2>Resume-to-job analysis</h2>

                    <p className="section-description">
                      Complete both steps to generate your match report.
                    </p>
                  </div>

                  <span className="step-counter">
                    <span>01</span>
                    UPLOAD
                    <i />
                    <span>02</span>
                    COMPARE
                  </span>
                </div>

                <div className="input-grid">
                  <article className="panel upload-panel">
                    <div className="panel-heading">
                      <div className="panel-icon">
                        <FileUp size={20} />
                      </div>

                      <div>
                        <h3>Your resume</h3>
                        <p>Upload a PDF to extract your skills.</p>
                      </div>
                    </div>

                    <label
                      className={`dropzone ${
                        selectedFile || uploadedResume
                          ? "has-file"
                          : ""
                      }`}
                    >
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handleFileSelection}
                        disabled={uploading || analyzing}
                      />

                      <div className="upload-visual">
                        {uploadedResume ? (
                          <CheckCircle2 size={27} />
                        ) : (
                          <UploadCloud size={28} />
                        )}
                      </div>

                      <strong>
                        {selectedFile
                          ? selectedFile.name
                          : uploadedResume?.originalFileName ||
                            "Choose your resume"}
                      </strong>

                      <span>
                        {selectedFile
                          ? `${(
                              selectedFile.size / 1024
                            ).toFixed(1)} KB · Ready to upload`
                          : uploadedResume
                            ? `${uploadedResume.pageCount} page(s) · Successfully processed`
                            : "Click to browse and select your PDF"}
                      </span>

                      <small>PDF format · Maximum 5 MB</small>
                    </label>

                    {uploadedResume && (
                      <div className="uploaded-status">
                        <CheckCircle2 size={16} />
                        <span>
                          Extracted {uploadedResume.characterCount} characters
                        </span>
                      </div>
                    )}

                    <button
                      className="button button-secondary panel-action"
                      onClick={handleUpload}
                      disabled={
                        !selectedFile || uploading || analyzing
                      }
                      type="button"
                    >
                      {uploading ? (
                        <>
                          <LoaderCircle
                            className="spin"
                            size={17}
                          />
                          Processing resume...
                        </>
                      ) : uploadedResume ? (
                        <>
                          Upload another resume
                          <ArrowRight size={16} />
                        </>
                      ) : (
                        <>
                          Upload and process
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </article>

                  <article className="panel job-panel">
                    <div className="panel-heading">
                      <div className="panel-icon blue">
                        <BriefcaseBusiness size={20} />
                      </div>

                      <div>
                        <h3>Target job description</h3>
                        <p>Paste the role you're preparing for.</p>
                      </div>
                    </div>

                    <textarea
                      className="job-description-input"
                      value={jobDescription}
                      onChange={(event) =>
                        setJobDescription(event.target.value)
                      }
                      placeholder="Paste the job description here, including required skills and responsibilities..."
                      maxLength={20000}
                    />

                    <div className="textarea-footer">
                      <span>
                        {jobDescription.length} / 20,000 characters
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setJobDescription(SAMPLE_JOB_DESCRIPTION)
                        }
                      >
                        Use sample
                      </button>
                    </div>

                    <button
                      className="button button-primary panel-action"
                      onClick={handleAnalyze}
                      disabled={
                        analyzing ||
                        uploading ||
                        !uploadedResume
                      }
                      type="button"
                    >
                      {analyzing ? (
                        <>
                          <LoaderCircle
                            className="spin"
                            size={17}
                          />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          Analyze my resume
                          <Sparkles size={17} />
                        </>
                      )}
                    </button>
                  </article>
                </div>
              </section>

              {analysisResult && (
                <AnalysisResults
                  result={analysisResult}
                  recommendations={currentRecommendations}
                  generating={
                    generatingAI &&
                    generatingForId === currentAnalysisId
                  }
                  onGenerate={() =>
                    handleGenerateRecommendations(
                      currentAnalysisId
                    )
                  }
                  reportFileName={
                    analysisResult.analysis?.resume
                      ?.originalFileName ||
                    uploadedResume?.originalFileName
                  }
                  reportDate={
                    analysisResult.analysisRecord?.createdAt
                  }
                />
              )}

              {view === "dashboard" && history.length > 0 && (
                <section className="recent-section">
                  <div className="section-heading">
                    <div>
                      <h2>Recent analyses</h2>

                      <p className="section-description">
                        Continue from your latest career reports.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="text-button"
                      onClick={() => openView("history")}
                    >
                      View all reports
                      <ArrowRight size={15} />
                    </button>
                  </div>

                  <div className="recent-list">
                    {history.slice(0, 3).map((item) => (
                      <button
                        className="recent-row recent-row-button"
                        type="button"
                        key={item.id || item._id}
                        onClick={() =>
                          handleOpenReport(item.id || item._id)
                        }
                      >
                        <div className="recent-file-icon">
                          <FileText size={19} />
                        </div>

                        <div className="recent-copy">
                          <strong>
                            {item.resume?.originalFileName ||
                              "Resume analysis"}
                          </strong>

                          <span>
                            {formatDate(item.createdAt)}
                          </span>
                        </div>

                        <div className="recent-score">
                          <strong>
                            {item.weightedSkillMatchScore ??
                              item.skillMatchScore}
                            %
                          </strong>

                          <span>Skill match</span>
                        </div>

                        <ArrowRight
                          className="recent-row-arrow"
                          size={18}
                        />
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* ==================================
              SAVED REPORT HISTORY
          ================================== */}

          {view === "history" && (
            <section className="history-page">
              <div className="page-heading history-heading">
                <div>
                  <div className="eyebrow">
                    <History size={14} />
                    YOUR CAREER ACTIVITY
                  </div>

                  <h1>Saved reports</h1>

                  <p>
                    Open any report to review the full match
                    breakdown and AI recommendations.
                  </p>
                </div>

                <button
                  className="button button-primary"
                  onClick={() => openView("analyze")}
                  type="button"
                >
                  <Plus size={17} />
                  New analysis
                </button>
              </div>

              <div className="history-panel">
                <div className="history-panel-heading">
                  <div>
                    <h2>Your reports</h2>

                    <p>
                      {historyMeta?.totalRecords ??
                        history.length}{" "}
                      saved reports
                    </p>
                  </div>

                  <button
                    className="icon-button refresh-button"
                    onClick={refreshHistory}
                    disabled={historyLoading}
                    title="Refresh history"
                    aria-label="Refresh history"
                    type="button"
                  >
                    <RefreshCw
                      size={17}
                      className={
                        historyLoading ? "spin" : ""
                      }
                    />
                  </button>
                </div>

                {historyLoading ? (
                  <div className="empty-state">
                    <LoaderCircle
                      className="spin"
                      size={25}
                    />
                    Loading your history...
                  </div>
                ) : history.length === 0 ? (
                  <div className="empty-state">
                    <FileText size={30} />

                    <h3>No analyses yet</h3>

                    <p>
                      Upload a resume and compare it with a job
                      description to create your first report.
                    </p>

                    <button
                      className="button button-primary"
                      onClick={() => openView("analyze")}
                      type="button"
                    >
                      Start your first analysis
                    </button>
                  </div>
                ) : (
                  <div className="history-list">
                    {history.map((item) => (
                      <article
                        className="history-row history-card"
                        key={item.id || item._id}
                      >
                        <button
                          className="history-card-main"
                          type="button"
                          onClick={() =>
                            handleOpenReport(
                              item.id || item._id
                            )
                          }
                        >
                          <div className="history-file-icon">
                            <FileText size={21} />
                          </div>

                          <div className="history-description">
                            <strong>
                              {item.resume?.originalFileName ||
                                "Resume report"}
                            </strong>

                            <span>
                              {formatDate(item.createdAt)} ·{" "}
                              {item.requiredSkillCount ??
                                (item.matchedSkills?.length || 0) +
                                  (item.missingSkills?.length || 0)}{" "}
                              recognized requirements
                            </span>

                            <div className="history-row-skills">
                              {(item.matchedSkills ?? [])
                                .slice(0, 3)
                                .map((skill) => (
                                  <span key={skill.name}>
                                    {skill.name}
                                  </span>
                                ))}
                            </div>
                          </div>

                          <div className="history-score">
                            <strong>
                              {item.weightedSkillMatchScore ??
                                item.skillMatchScore}
                              %
                            </strong>

                            <span>Skill match</span>
                          </div>

                          <span className="history-open-label">
                            Open report
                            <ArrowRight size={15} />
                          </span>
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ==================================
              SAVED REPORT DETAILS
          ================================== */}

          {view === "report" && (
            <section className="report-page">
              <button
                type="button"
                className="back-link"
                onClick={() => openView("history")}
              >
                <ArrowLeft size={16} />
                Back to saved reports
              </button>

              {reportLoading ? (
                <div className="report-loading">
                  <LoaderCircle
                    className="spin"
                    size={28}
                  />

                  <strong>Loading your report...</strong>

                  <span>
                    Retrieving the saved analysis from your account.
                  </span>
                </div>
              ) : reportError ? (
                <div className="report-error-card">
                  <AlertCircle size={25} />

                  <h2>Could not open this report</h2>

                  <p>{reportError}</p>

                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => openView("history")}
                  >
                    Return to saved reports
                  </button>
                </div>
              ) : activeReport ? (
                <>
                  <div className="page-heading report-page-heading">
                    <div>
                      <div className="eyebrow">
                        <FileText size={14} />
                        SAVED ANALYSIS REPORT
                      </div>

                      <h1>
                        {activeReport.report.resume
                          ?.originalFileName ||
                          "Resume match report"}
                      </h1>

                      <p>
                        Created{" "}
                        {formatDate(
                          activeReport.report.createdAt
                        )}{" "}
                        · Full report and recommendations
                      </p>
                    </div>

                    <span className="completed-label">
                      <CheckCircle2 size={16} />
                      Saved
                    </span>
                  </div>

                  <AnalysisResults
                    result={{
                      analysis: activeReport.report,
                    }}
                    recommendations={
                      activeReportRecommendations
                    }
                    generating={
                      generatingAI &&
                      generatingForId === activeReport.id
                    }
                    onGenerate={() =>
                      handleGenerateRecommendations(
                        activeReport.id
                      )
                    }
                    reportFileName={
                      activeReport.report.resume
                        ?.originalFileName
                    }
                    reportDate={
                      activeReport.report.createdAt
                    }
                  />
                </>
              ) : null}
            </section>
          )}

          {/* ==================================
              ACCOUNT PROFILE
          ================================== */}

          {view === "profile" && (
            <section className="profile-page">
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    <UserRound size={14} />
                    YOUR ACCOUNT
                  </div>

                  <h1>Account profile</h1>

                  <p>
                    Review your ResuMatch account and sign-in details.
                  </p>
                </div>
              </div>

              <div className="profile-layout">
                <article className="profile-identity-card">
                  <div className="profile-large-avatar">
                    {getInitials(profileName)}
                  </div>

                  <h2>{profileName}</h2>

                  <p>
                    {user?.email ||
                      user?.phoneNumber ||
                      "ResuMatch member"}
                  </p>

                  <span className="profile-member-badge">
                    <ShieldCheck size={14} />
                    Account workspace
                  </span>
                </article>

                <article className="profile-details-card">
                  <div className="profile-details-heading">
                    <div>
                      <h2>Account information</h2>

                      <p>
                        Your account information currently stored by ResuMatch.
                      </p>
                    </div>

                    <span className="profile-status">
                      Active
                    </span>
                  </div>

                  <div className="profile-detail-row">
                    <span>Full name</span>
                    <strong>
                      {user?.name || profileName}
                    </strong>
                  </div>

                  <div className="profile-detail-row">
                    <span>Email address</span>
                    <strong>
                      {user?.email || "Not provided"}
                    </strong>
                  </div>

                  <div className="profile-detail-row">
                    <span>Phone number</span>
                    <strong>
                      {user?.phoneNumber || "Not linked"}
                    </strong>
                  </div>

                  <div className="profile-detail-row">
                    <span>Sign-in method</span>

                    <strong>
                      {[
                        user?.authProvider === "google"
                          ? "Google"
                          : "Email and password",

                        user?.authProvider !== "google" &&
                        user?.googleLinked
                          ? "Google"
                          : null,

                        user?.phoneVerified
                          ? "Phone OTP"
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" + ")}
                    </strong>
                  </div>

                  <div className="profile-detail-row">
                    <span>Member since</span>

                    <strong>
                      {formatDate(user?.createdAt)}
                    </strong>
                  </div>
                </article>
              </div>

              {/* Existing Google account linking */}
              <GoogleAccountLinkCard
                token={token}
                googleClientId={
                  import.meta.env.VITE_GOOGLE_CLIENT_ID || ""
                }
                googleLinked={Boolean(user?.googleLinked)}
                onLinked={(linkedUser) => {
                  setUser((current) => ({
                    ...current,
                    ...linkedUser,
                    googleLinked: true,
                  }));
                }}
              />

              {/* New phone account linking */}
              <PhoneAccountLinkCard
                token={token}
                phoneNumber={user?.phoneNumber || ""}
                phoneVerified={Boolean(user?.phoneVerified)}
                onLinked={(linkedUser) => {
                  setUser((current) => ({
                    ...current,
                    ...linkedUser,
                  }));
                }}
              />

              <article className="profile-security-card">
                <div className="profile-security-icon">
                  <ShieldCheck size={21} />
                </div>

                <div>
                  <h3>Account security</h3>

                  <p>
                    Your saved reports and resume analyses are protected
                    by your authenticated ResuMatch session.
                  </p>
                </div>

                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => openView("logout")}
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </article>
            </section>
          )}

          {/* ==================================
              LOGOUT CONFIRMATION
          ================================== */}

          {view === "logout" && (
            <section className="logout-page">
              <div className="logout-confirm-card">
                <div className="logout-icon">
                  <LogOut size={25} />
                </div>

                <div className="eyebrow">
                  SESSION MANAGEMENT
                </div>

                <h1>Sign out of ResuMatch?</h1>

                <p>
                  You will be signed out of this browser. Your saved
                  resumes, analysis reports, and recommendations will
                  remain linked to your account.
                </p>

                <div className="logout-actions">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => openView("profile")}
                    disabled={logoutBusy}
                  >
                    Stay signed in
                  </button>

                  <button
                    className="button button-danger"
                    type="button"
                    onClick={handleLogout}
                    disabled={logoutBusy}
                  >
                    {logoutBusy ? (
                      <>
                        <LoaderCircle
                          className="spin"
                          size={17}
                        />
                        Signing out...
                      </>
                    ) : (
                      <>
                        <LogOut size={17} />
                        Yes, sign me out
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ==================================
              FOOTER
          ================================== */}

          <footer className="page-footer">
            <span>© 2026 ResuMatch AI</span>

            <span>
              <ShieldCheck size={14} />
              Built for smarter career decisions
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
