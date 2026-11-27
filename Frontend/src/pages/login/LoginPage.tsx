import { useState, type FormEvent } from "react";
import logo from '../../assets/taskflow-logo.png'
import "./LoginPage.css";

// Use the same API base URL convention as SignupPage.
// During Vite development, the /api path should be proxied to localhost:3000.
// In production, VITE_API_BASE_URL can point to the deployed backend API.
const viteEnvironment = (import.meta as ImportMeta & {
  env?: { VITE_API_BASE_URL?: string; DEV?: boolean };
}).env;

const API_BASE_URL = (
  viteEnvironment?.DEV
    ? "/api"
    : viteEnvironment?.VITE_API_BASE_URL || "/api"
).replace(/\/$/, "");

interface LoginResponse {
  success: boolean;
  message?: string;
  data?: {
    user?: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
  };
}

interface IconProps {
  name: "user" | "lock" | "eye" | "eye-off" | "arrow";
  size?: number;
}

// Small inline SVG icons keep the page independent of extra icon packages.
const Icon = ({ name, size = 21 }: IconProps) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c.5-3.5 3.2-5.5 7-5.5s6.5 2 7 5.5" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <rect x="4.2" y="10" width="15.6" height="11" rx="2" />
          <path d="M7.5 10V7a4.5 4.5 0 0 1 9 0v3" />
          <path d="M12 14.2v2.6" />
        </svg>
      );
    case "eye":
      return (
        <svg {...common}>
          <path d="M2.2 12s3.4-6.3 9.8-6.3 9.8 6.3 9.8 6.3-3.4 6.3-9.8 6.3S2.2 12 2.2 12Z" />
          <circle cx="12" cy="12" r="2.7" />
        </svg>
      );
    case "eye-off":
      return (
        <svg {...common}>
          <path d="m3 3 18 18" />
          <path d="M10.6 5.9A10.8 10.8 0 0 1 12 5.8c6.4 0 9.8 6.2 9.8 6.2a16 16 0 0 1-3.1 3.8" />
          <path d="M6.2 6.3C3.6 8.1 2.2 12 2.2 12s3.4 6.2 9.8 6.2c1.2 0 2.3-.2 3.3-.6" />
          <path d="M9.8 9.8a3.1 3.1 0 0 0 4.4 4.4" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M4 12h15" />
          <path d="m13 5 7 7-7 7" />
        </svg>
      );
    default:
      return null;
  }
};

const LoginPage = () => {
  const [nameOrEmail, setNameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formNotice, setFormNotice] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setFormNotice("");

    const normalizedIdentifier = nameOrEmail.trim();

    // Basic client checks give immediate feedback before calling the API.
    if (!normalizedIdentifier) {
      setFormError("Please enter your email address or username.");
      return;
    }

    if (!password) {
      setFormError("Please enter your password.");
      return;
    }

    setIsSubmitting(true);

    try {
      // This is the exact login route and request shape from your backend.
      // The backend sets the HTTP-only token cookie in its response.
      const response = await fetch(`${API_BASE_URL}/auth/login-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          nameOrEmail: normalizedIdentifier,
          password,
        }),
      });

      // The backend's error middleware may return a non-JSON response,
      // so parse defensively and provide a useful fallback message.
      const result = (await response.json().catch(() => null)) as LoginResponse | null;

      if (!response.ok || !result?.success) {
        if (response.status === 401) {
          setFormError("Incorrect email/username or password. Please try again.");
        } else {
          setFormError(result?.message || "We couldn't sign you in. Please try again.");
        }
        return;
      }

      // The backend currently sets a fixed 7-day cookie.
      // Remember me is kept as a UI preference until the backend supports
      // choosing a different cookie lifetime.
      void rememberMe;

      // The app's authenticated landing page is expected at /home.
      // Change this path only if your React Router uses a different route.
      window.location.assign("/home");
    } catch {
      setFormError("Unable to connect to TaskFlow. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Password recovery is not part of the current backend API yet.
  const handleForgotPassword = () => {
    setFormNotice("Password recovery isn't available yet. Please contact your workspace administrator.");
    setFormError("");
  };

  return (
    <main className="login-page">
      {/* Decorative background layers. They are hidden from screen readers. */}
      <div className="login-background" aria-hidden="true">
        <div className="login-orb login-orb--top-left" />
        <div className="login-orb login-orb--bottom-right" />
        <div className="login-orbit login-orbit--left" />
        <div className="login-orbit login-orbit--right" />
        <div className="login-shape login-shape--square-one" />
        <div className="login-shape login-shape--square-two" />
        <div className="login-shape login-shape--dot-one" />
        <div className="login-shape login-shape--dot-two" />
        <div className="login-shape login-shape--dot-three" />
        <div className="login-dot-grid login-dot-grid--top-right" />
        <div className="login-dot-grid login-dot-grid--bottom-left" />
      </div>

      <section className="login-card" aria-labelledby="login-title">
        {/* Keep the supplied TF logo consistent with the signup page. */}
        <div className="login-brand" aria-label="TaskFlow">
          <img
            className="login-brand-mark"
            src={logo}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <span>TaskFlow</span>
        </div>

        <header className="login-heading">
          <h1 id="login-title">Welcome Back</h1>
          <p>Sign in to continue to your TaskFlow workspace.</p>
        </header>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="login-identifier">Email or Username</label>
            <div className="login-input-shell">
              <span className="login-input-icon">
                <Icon name="user" />
              </span>
              <input
                id="login-identifier"
                name="nameOrEmail"
                type="text"
                autoComplete="username"
                placeholder="Enter your email or username"
                value={nameOrEmail}
                onChange={(event) => {
                  setNameOrEmail(event.target.value);
                  setFormError("");
                  setFormNotice("");
                }}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <div className="login-input-shell">
              <span className="login-input-icon">
                <Icon name="lock" />
              </span>
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFormError("");
                  setFormNotice("");
                }}
                disabled={isSubmitting}
              />
              <button
                className="login-password-toggle"
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                disabled={isSubmitting}
              >
                <Icon name={showPassword ? "eye-off" : "eye"} size={22} />
              </button>
            </div>
          </div>

          <div className="login-options">
            <label className="remember-option">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                disabled={isSubmitting}
              />
              <span className="remember-checkbox" aria-hidden="true" />
              <span>Remember me</span>
            </label>
            <button
              className="forgot-password-link"
              type="button"
              onClick={handleForgotPassword}
              disabled={isSubmitting}
            >
              Forgot password?
            </button>
          </div>

          {formError && (
            <p className="login-feedback login-feedback--error" role="alert">
              {formError}
            </p>
          )}
          {formNotice && (
            <p className="login-feedback login-feedback--notice" role="status">
              {formNotice}
            </p>
          )}

          <button className="login-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="login-spinner" aria-hidden="true" />
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <Icon name="arrow" size={21} />
              </>
            )}
          </button>
        </form>

        <p className="login-signup-prompt">
          Don't have an account? <a href="/signup">Create an account</a>
        </p>
      </section>
    </main>
  );
};

export default LoginPage;
