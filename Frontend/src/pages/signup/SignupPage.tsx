import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import logo from '../../assets/taskflow-logo.png'
import "./SignupPage.css";

// During Vite development, call the API through the Vite proxy (/api).
// This keeps requests same-origin and avoids browser CORS failures.
// In production, set VITE_API_BASE_URL to your deployed backend API URL,
// or keep it as /api when the frontend and backend share the same origin.
const viteEnvironment = (import.meta as ImportMeta & {
  env?: { VITE_API_BASE_URL?: string; DEV?: boolean };
}).env;
const API_BASE_URL = (
  viteEnvironment?.DEV
    ? "/api"
    : viteEnvironment?.VITE_API_BASE_URL || "/api"
).replace(/\/$/, "");

// The backend currently returns this shape from /auth/check-username.
interface UsernameAvailabilityResponse {
  success: boolean;
  message: string;
  data?: {
    available: boolean;
  };
}

// The backend returns the created user inside the data property.
interface RegisterResponse {
  success: boolean;
  message: string;
  data?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    createdAt: string;
  };
  code?: string;
}

type NameStatus = "idle" | "checking" | "available" | "taken" | "error";

interface IconProps {
  name: string;
  size?: number;
}

// Small inline SVG icon set. This avoids adding another icon dependency to your project.
const Icon = ({ name, size = 20 }: IconProps) => {
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
      return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.5-3.5 3.2-5.5 7-5.5s6.5 2 7 5.5" /></svg>;
    case "mail":
      return <svg {...common}><rect x="2.8" y="4.5" width="18.4" height="15" rx="2" /><path d="m4 6 8 6.2L20 6" /></svg>;
    case "lock":
      return <svg {...common}><rect x="4.2" y="10" width="15.6" height="11" rx="2" /><path d="M7.5 10V7a4.5 4.5 0 0 1 9 0v3" /><path d="M12 14.2v2.6" /></svg>;
    case "eye":
      return <svg {...common}><path d="M2.2 12s3.4-6.3 9.8-6.3 9.8 6.3 9.8 6.3-3.4 6.3-9.8 6.3S2.2 12 2.2 12Z" /><circle cx="12" cy="12" r="2.7" /></svg>;
    case "eye-off":
      return <svg {...common}><path d="m3 3 18 18" /><path d="M10.6 5.9A10.8 10.8 0 0 1 12 5.8c6.4 0 9.8 6.2 9.8 6.2a16 16 0 0 1-3.1 3.8" /><path d="M6.2 6.3C3.6 8.1 2.2 12 2.2 12s3.4 6.2 9.8 6.2c1.2 0 2.3-.2 3.3-.6" /><path d="M9.8 9.8a3.1 3.1 0 0 0 4.4 4.4" /></svg>;
    case "arrow":
      return <svg {...common}><path d="M4 12h15" /><path d="m13 5 7 7-7 7" /></svg>;
    case "check":
      return <svg {...common}><path d="m5 12.5 4.2 4.2L19.5 6" /></svg>;
    case "users":
      return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 19c.3-3 2.4-4.8 6-4.8s5.7 1.8 6 4.8" /><path d="M16 5.5a3 3 0 0 1 0 5.8M17 14.5c2.4.5 3.7 2 4 4.5" /></svg>;
    case "chart":
      return <svg {...common}><path d="M4 20V11h4v9M10 20V5h4v15M16 20v-7h4v7" /></svg>;
    case "folder":
      return <svg {...common}><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z" /></svg>;
    case "tasks":
      return <svg {...common}><path d="M8 6h12M8 12h12M8 18h12" /><path d="m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2" /></svg>;
    case "bell":
      return <svg {...common}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>;
    case "settings":
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.2 1-1.2 2.1-1.5-.5a8 8 0 0 1-1.6.9l-.3 1.6h-2.4l-.3-1.6a8 8 0 0 1-1.6-.9l-1.5.5-1.2-2.1 1.2-1a8 8 0 0 1 0-1.9l-1.2-1 1.2-2.1 1.5.5a8 8 0 0 1 1.6-.9l.3-1.6h2.4l.3 1.6a8 8 0 0 1 1.6.9l1.5-.5 1.2 2.1-1.2 1a8 8 0 0 1-.1 1.9Z" transform="translate(-1 -1) scale(1.08)" /></svg>;
    case "google":
      return <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15Z" /><path fill="#FF3D00" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z" /><path fill="#4CAF50" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z" /><path fill="#1976D2" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.1 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.7 18.7 12.1 24 12.1Z" /></svg>;
    case "github":
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .9a11.1 11.1 0 0 0-3.5 21.6c.6.1.8-.3.8-.6v-2.1c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.6-1.3-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 .1.7 2.1 3.5 1.6.1-.7.4-1.2.7-1.5-2.6-.3-5.4-1.3-5.4-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.4 5.9.4.3.8 1 .8 2v2.6c0 .3.2.7.8.6A11.1 11.1 0 0 0 12 .9Z" /></svg>;
    case "apple":
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.7 12.8c0-2.4 2-3.6 2.1-3.7a4.6 4.6 0 0 0-3.6-1.9c-1.5-.2-2.9.9-3.7.9s-1.9-.9-3.2-.9a4.8 4.8 0 0 0-4 2.5c-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.7 2.5 2.9 2.4 1.2 0 1.6-.8 3.1-.8s1.9.8 3.2.8c1.3 0 2.1-1.2 2.9-2.5a11 11 0 0 0 1.3-2.6 4.1 4.1 0 0 1-2.2-4Zm-2.4-7.2A4.4 4.4 0 0 0 15.4 2a4.5 4.5 0 0 0-3 1.5 4.2 4.2 0 0 0-1.1 3.2 3.7 3.7 0 0 0 3-1.1Z" /></svg>;
    case "home":
      return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></svg>;
    case "trend":
      return <svg {...common}><path d="m3 17 6-6 4 3 7-8" /><path d="M14 6h6v6" /></svg>;
    case "calendar":
      return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h3M8 17h2" /></svg>;
    default:
      return null;
  }
};

// Use the supplied TaskFlow TF logo from /public/taskflow-logo.png.
// Keep this as one shared component so the header, signup card and preview stay consistent.
const BrandMark = ({ small = false }: { small?: boolean }) => (
  <img
    className={small ? "brand-mark brand-mark--small" : "brand-mark"}
    src={logo}
    alt=""
    aria-hidden="true"
    draggable={false}
  />
);

const passwordRules = [
  { key: "length", label: "8–32 characters", test: (value: string) => value.length >= 8 && value.length <= 32 },
  { key: "upper", label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { key: "lower", label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { key: "number", label: "One number", test: (value: string) => /\d/.test(value) },
  { key: "special", label: "One special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

const SignupPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [nameStatus, setNameStatus] = useState<NameStatus>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Calculate password rules from the current value; no duplicate state is needed.
  const passwordChecks = useMemo(
    () => passwordRules.map((rule) => ({ ...rule, passed: rule.test(password) })),
    [password],
  );
  const isPasswordValid = passwordChecks.every((rule) => rule.passed);

  // Check name availability after the user pauses typing.
  // AbortController prevents an older response from overwriting a newer name check.
  useEffect(() => {
    const normalizedName = name.trim();

    if (!normalizedName || normalizedName.length > 100) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setNameStatus("checking");

      try {
        const query = new URLSearchParams({ name: normalizedName });
        const response = await fetch(`${API_BASE_URL}/auth/check-username?${query.toString()}`, {
          method: "GET",
          credentials: "same-origin",
          signal: controller.signal,
        });

        const result = (await response.json()) as UsernameAvailabilityResponse;

        if (!response.ok || !result.success || typeof result.data?.available !== "boolean") {
          throw new Error(result.message || "Unable to check name availability.");
        }

        setNameStatus(result.data.available ? "available" : "taken");
      } catch (error) {
        // An aborted request is expected when the user continues typing.
        if (error instanceof DOMException && error.name === "AbortError") return;
        setNameStatus("error");
      }
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [name]);

  // Keep the name status in sync immediately when the user edits the field.
  const handleNameChange = (value: string) => {
    setName(value);
    setNameStatus("idle");
    setFormError("");
    setFormSuccess("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setFormSuccess("");

    const normalizedName = name.trim();
    const normalizedEmail = email.trim();

    // Client-side checks improve feedback, but the backend must enforce them too.
    if (!normalizedName) {
      setFormError("Please enter your full name.");
      return;
    }

    if (normalizedName.length > 100) {
      setFormError("Your name cannot exceed 100 characters.");
      return;
    }

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    if (!isPasswordValid) {
      setFormError("Please make sure your password meets all the requirements.");
      return;
    }

    if (nameStatus === "taken") {
      setFormError("That name is already taken. Please choose another one.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Re-check immediately before registration so the form does not rely only on the debounced result.
      const nameQuery = new URLSearchParams({ name: normalizedName });
      const nameResponse = await fetch(`${API_BASE_URL}/auth/check-username?${nameQuery.toString()}`, {
        method: "GET",
        credentials: "same-origin",
      });
      const nameResult = (await nameResponse.json()) as UsernameAvailabilityResponse;

      if (!nameResponse.ok || !nameResult.success || typeof nameResult.data?.available !== "boolean") {
        throw new Error(nameResult.message || "We couldn't verify your name. Please try again.");
      }

      if (!nameResult.data.available) {
        setNameStatus("taken");
        setFormError("That name is already taken. Please choose another one.");
        return;
      }

      // This matches the real public registration route in Backend/src/modules/auth/auth.route.ts.
      const response = await fetch(`${API_BASE_URL}/auth/register-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: normalizedName,
          email: normalizedEmail,
          password,
        }),
      });

      // The global backend error response may not always be JSON, so parse it defensively.
      const result = (await response.json().catch(() => null)) as RegisterResponse | null;

      if (!response.ok || !result?.success) {
        if (response.status === 409) {
          setFormError("That name or email is already registered. Please check both fields.");
        } else {
          setFormError(result?.message || "We couldn't create your account. Please try again.");
        }
        return;
      }

      // Registration does not currently set the login cookie; let the user sign in next.
      setFormSuccess("Your TaskFlow account has been created. You can now log in.");
      setNameStatus("available");
      setPassword("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const nameMessage: ReactNode = (() => {
    if (nameStatus === "checking") return <span className="field-status field-status--checking">Checking name availability…</span>;
    if (nameStatus === "available") return <span className="field-status field-status--available"><Icon name="check" size={14} /> This name is available</span>;
    if (nameStatus === "taken") return <span className="field-status field-status--taken">This name is already taken</span>;
    if (nameStatus === "error") return <span className="field-status field-status--error">Name check is temporarily unavailable. Check your connection and try again.</span>;
    return <span className="field-status field-status--hint">Your name must be unique on TaskFlow.</span>;
  })();

  return (
    <div className="signup-page">
      {/* Browser-style frame gives the signup screen the same polished composition as the reference. */}
      <div className="browser-shell">
        <div className="browser-chrome" aria-hidden="true">
          <div className="browser-controls"><i className="browser-dot browser-dot--red" /><i className="browser-dot browser-dot--yellow" /><i className="browser-dot browser-dot--green" /></div>
        </div>

        <div className="browser-content">
          {/* The TF image is the same supplied logo used on the previous signup version. */}
          <header className="signup-header">
            <a className="brand brand--header" href="/" aria-label="TaskFlow home">
              <BrandMark />
              <span>TaskFlow</span>
            </a>
            <div className="header-login">
              <span>Already have an account?</span>
              <a className="login-link" href="/login">Login <Icon name="arrow" size={17} /></a>
            </div>
          </header>

          <main className="signup-layout">
            <section className="signup-panel" aria-labelledby="signup-title">
              <div className="signup-card">
                <div className="form-heading">
                  <h1 id="signup-title">Create Your Account</h1>
                  <p>Join TaskFlow and start managing your projects<br className="desktop-break" /> with your team.</p>
                </div>

                <div className="social-buttons">
                  {/* OAuth is not wired in the current backend, so these options remain visibly disabled. */}
                  <button className="social-button" type="button" disabled title="Google sign-up is not configured yet"><Icon name="google" size={22} />Sign Up with Google</button>
                  <button className="social-button" type="button" disabled title="Apple sign-up is not configured yet"><Icon name="apple" size={22} />Sign Up with Apple</button>
                </div>

                <div className="social-divider"><span /><p>or</p><span /></div>

                <form className="signup-form" onSubmit={handleSubmit} noValidate>
                  <div className="form-field">
                    <label htmlFor="signup-name">Full Name</label>
                    <div className={`input-shell ${nameStatus === "taken" ? "input-shell--invalid" : nameStatus === "available" ? "input-shell--valid" : ""}`}>
                      <span className="input-icon"><Icon name="user" size={21} /></span>
                      <input
                        id="signup-name"
                        name="name"
                        type="text"
                        placeholder="Enter your full name"
                        autoComplete="name"
                        value={name}
                        maxLength={100}
                        onChange={(event) => handleNameChange(event.target.value)}
                        required
                        aria-describedby="name-status"
                      />
                      {nameStatus === "checking" && <span className="input-spinner" aria-label="Checking" />}
                      {nameStatus === "available" && <span className="input-valid-icon"><Icon name="check" size={17} /></span>}
                    </div>
                    <div id="name-status" className="field-status-row" aria-live="polite">{nameMessage}</div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="signup-email">Email Address</label>
                    <div className="input-shell">
                      <span className="input-icon"><Icon name="mail" size={21} /></span>
                      <input
                        id="signup-email"
                        name="email"
                        type="email"
                        placeholder="Enter your email address"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => { setEmail(event.target.value); setFormError(""); setFormSuccess(""); }}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-field form-field--password">
                    <label htmlFor="signup-password">Password</label>
                    <div className="input-shell">
                      <span className="input-icon"><Icon name="lock" size={21} /></span>
                      <input
                        id="signup-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        autoComplete="new-password"
                        value={password}
                        maxLength={32}
                        onChange={(event) => { setPassword(event.target.value); setFormError(""); setFormSuccess(""); }}
                        required
                        aria-describedby="password-rules"
                      />
                      <button
                        className="password-toggle"
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        <Icon name={showPassword ? "eye-off" : "eye"} size={21} />
                      </button>
                    </div>
                    <div className="password-rules" id="password-rules">
                      {passwordChecks.map((rule) => (
                        <span className={rule.passed ? "password-rule password-rule--passed" : "password-rule"} key={rule.key}>
                          <span className="rule-indicator">{rule.passed ? "✓" : "·"}</span>{rule.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {formError && <div className="form-alert form-alert--error" role="alert">{formError}</div>}
                  {formSuccess && <div className="form-alert form-alert--success" role="status">{formSuccess} <a href="/login">Log in</a></div>}

                  <button className="create-account-button" type="submit" disabled={isSubmitting || Boolean(formSuccess)}>
                    {isSubmitting ? <><span className="button-spinner" /> Creating account…</> : <>Create Account <Icon name="arrow" size={20} /></>}
                  </button>
                </form>

                <p className="terms-copy">By creating an account, you agree to our<br className="mobile-break" /> <span>Terms of Service</span> and <span>Privacy Policy.</span></p>
              </div>
            </section>

            <aside className="showcase-panel" aria-label="TaskFlow dashboard preview">
              {/* The floating elements are decorative only; all movement is CSS-based and reduced-motion aware. */}
              <div className="showcase-orb showcase-orb--large" aria-hidden="true" />
              <div className="showcase-orb showcase-orb--small" aria-hidden="true" />
              <div className="float-tile float-tile--check" aria-hidden="true"><Icon name="check" size={20} /></div>
              <div className="float-tile float-tile--chart" aria-hidden="true"><Icon name="chart" size={21} /></div>
              <div className="float-tile float-tile--calendar" aria-hidden="true"><Icon name="calendar" size={21} /></div>
              <div className="float-squiggle" aria-hidden="true">〰</div>

              <div className="dashboard-window">
                <div className="dashboard-window-bar">
                  <span className="window-dot window-dot--red" /><span className="window-dot window-dot--yellow" /><span className="window-dot window-dot--green" />
                </div>
                <div className="dashboard-shell">
                  <aside className="dashboard-sidebar">
                    <div className="dashboard-brand"><BrandMark small /><strong>TaskFlow</strong></div>
                    <nav className="dashboard-nav" aria-label="Dashboard preview navigation">
                      <span className="dashboard-nav-item dashboard-nav-item--active"><Icon name="home" size={16} />Dashboard</span>
                      <span className="dashboard-nav-item"><Icon name="folder" size={16} />Projects</span>
                      <span className="dashboard-nav-item"><Icon name="tasks" size={16} />Tasks</span>
                      <span className="dashboard-nav-item"><Icon name="users" size={16} />Team</span>
                      <span className="dashboard-nav-item"><Icon name="bell" size={16} />Notifications</span>
                      <span className="dashboard-nav-item"><Icon name="settings" size={16} />Settings</span>
                    </nav>
                    <div className="dashboard-profile">
                      <div className="profile-avatar">VR</div>
                      <div className="profile-details"><strong>Vansh Rawat</strong><span>Free Plan</span></div>
                      <span className="profile-caret">⌄</span>
                    </div>
                  </aside>

                  <div className="dashboard-main">
                    <h2>Dashboard</h2>
                    <div className="metric-grid">
                      <div className="metric-card"><span className="metric-icon metric-icon--blue"><Icon name="folder" size={20} /></span><strong>12</strong><small>Total Projects</small></div>
                      <div className="metric-card"><span className="metric-icon metric-icon--indigo"><Icon name="check" size={20} /></span><strong>48</strong><small>Total Tasks</small></div>
                      <div className="metric-card"><span className="metric-icon metric-icon--green"><Icon name="trend" size={20} /></span><strong>92%</strong><small>Completion</small></div>
                    </div>

                    <section className="dashboard-task-card">
                      <div className="dashboard-card-heading"><strong>Your Tasks</strong><span>View All <Icon name="arrow" size={13} /></span></div>
                      <div className="dashboard-task-row"><i className="status-dot status-dot--blue" /><span>Design Login Page</span><b className="priority-pill priority-pill--high">High</b></div>
                      <div className="dashboard-task-row"><i className="status-dot status-dot--yellow" /><span>Create Dashboard UI</span><b className="priority-pill priority-pill--medium">Medium</b></div>
                      <div className="dashboard-task-row"><i className="status-dot status-dot--sky" /><span>Develop API Endpoints</span><b className="priority-pill priority-pill--low">Low</b></div>
                    </section>

                    <div className="dashboard-tip-card">
                      <div className="tip-calendar"><Icon name="calendar" size={27} /></div>
                      <div><strong>Stay on track. Achieve more.</strong><p>Organize your work, meet deadlines,<br /> and grow together.</p></div>
                      <span className="tip-arrow">↻</span>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </main>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
