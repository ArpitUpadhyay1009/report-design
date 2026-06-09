"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import "./loginForm.css";

export default function LoginForm() {
  const { login } = useAuth();
  const [empCode, setEmpCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmpCode = empCode.trim();
    if (!trimmedEmpCode || !password) {
      setError("Please enter both EmpCode and password.");
      return;
    }

    setSubmitting(true);
    try {
      await login(trimmedEmpCode, password);
      // On success the AuthProvider switches state to "authenticated" and
      // the parent unmounts this form — nothing else to do here.
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "Login failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login">
      <div className="login__bg" aria-hidden="true" />
      <form className="login__card" onSubmit={handleSubmit} noValidate>
        <div className="login__brand">
          <span className="login__logo" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="22" height="22">
              <circle
                cx="16"
                cy="20"
                r="8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
              />
              <polygon
                points="16,4 20,9 18,13 14,13 12,9"
                fill="currentColor"
                opacity="0.9"
              />
            </svg>
          </span>
          <div>
            <h1 className="login__title">Welcome back</h1>
            <p className="login__subtitle">
              Sign in with your employee code to view the production report
            </p>
          </div>
        </div>

        <label className="login__field">
          <span>EmpCode</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="username"
            placeholder="e.g. 12345"
            value={empCode}
            onChange={(e) => setEmpCode(e.target.value)}
            disabled={submitting}
            required
          />
        </label>

        <label className="login__field">
          <span>Password</span>
          <div className="login__password">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
            />
            <button
              type="button"
              className="login__toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={submitting}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        {error ? (
          <div className="login__error" role="alert">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          className="login__submit"
          disabled={submitting}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
