import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Bot, Eye, EyeOff, Check } from "lucide-react";
import { motion } from "framer-motion";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import { Input } from "../components/common/Input";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "student",
  });

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "login") await login({ email: form.email, password: form.password });
      else await register({ name: form.name, email: form.email, password: form.password, role: form.role });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode() {
    setMode((current) => (current === "login" ? "register" : "login"));
    setShowPassword(false);
  }

  return (
    <main className="cs-auth cs-auth--classic">
      <div className="cs-auth__background" aria-hidden />

      <div className="cs-auth__content">
        <div className="cs-auth__brand cs-auth__brand--classic">
          <div className="cs-brand-mark cs-brand-mark--login">
            <GraduationCap size={21} />
          </div>
          <div>
            <h1>CampusSage AI</h1>
            <p>Your Intelligent Academic Assistant</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="cs-auth__panel cs-auth__panel--classic">
            <div className="cs-auth__welcome">
              <div className="cs-auth__welcome-icon">
                <GraduationCap size={22} />
              </div>
              <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
              <p>
                {mode === "login"
                  ? "Sign in to continue to your academic workspace."
                  : "Create your CampusSage account and get started."}
              </p>
            </div>

            <form className="cs-auth__form" onSubmit={handleSubmit}>
              {mode === "register" ? (
                <Input
                  label="Full Name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Enter your full name"
                  autoComplete="name"
                />
              ) : null}

              {mode === "register" ? (
                <div className="cs-field">
                  <span className="cs-field__label">I am a</span>
                  <div className="cs-auth__role-toggle">
                    <button
                      type="button"
                      className={`cs-auth__role-option ${form.role === "student" ? "is-active" : ""}`}
                      onClick={() => setForm((current) => ({ ...current, role: "student" }))}
                    >
                      Student
                    </button>
                    <button
                      type="button"
                      className={`cs-auth__role-option ${form.role === "teacher" ? "is-active" : ""}`}
                      onClick={() => setForm((current) => ({ ...current, role: "teacher" }))}
                    >
                      Teacher
                    </button>
                  </div>
                </div>
              ) : null}

              <Input
                label="Email or Roll Number"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="Enter your email or roll number"
                autoComplete="username"
              />

              <label className="cs-field">
                <span className="cs-field__label">Password</span>
                <div className="cs-auth__password-wrap">
                  <input
                    className="cs-input cs-auth__password-input"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder="Enter your password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    className="cs-auth__password-toggle"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>

              {mode === "login" ? (
                <div className="cs-auth__options">
                  <label className="cs-auth__remember">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                    />
                    <span className="cs-auth__checkbox" aria-hidden>
                      {rememberMe ? <Check size={13} strokeWidth={3} /> : null}
                    </span>
                    <span>Remember me</span>
                  </label>
                  <button type="button" className="cs-auth__forgot-link">
                    Forgot password?
                  </button>
                </div>
              ) : null}

              {error ? <div className="cs-auth__error" role="alert">{error}</div> : null}

              <Button type="submit" className="cs-auth__submit" disabled={submitting}>
                {submitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
              </Button>

              <div className="cs-auth__divider">
                <span>or</span>
              </div>

              <Button
                type="button"
                variant="ghost"
                className="cs-auth__campus-button"
                onClick={() => alert("SSO flow placeholder")}
              >
                <Bot size={16} />
                Sign in with Campus ID
              </Button>
            </form>

            <div className="cs-auth__footer-link">
              <span>
                {mode === "login" ? "Don't have an account?" : "Already have an account?"}
              </span>
              <button className="cs-auth__link" onClick={switchMode}>
                {mode === "login" ? "Create one" : "Sign in"}
              </button>
            </div>
          </Card>
        </motion.div>

        <p className="cs-auth__legal">Secure access to your academic workspace</p>
      </div>
    </main>
  );
}
