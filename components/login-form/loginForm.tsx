"use client";

import { useState } from "react";
import { profiles } from "@/constants/profile";
import type { Profile } from "@/types/profile";
import "./loginForm.css";

interface LoginFormProps {
  onSuccess: (user: Profile) => void;
}

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError("Please enter both email and password.");
      return;
    }

    const match = (profiles as Profile[]).find(
      (p) => p.email.toLowerCase() === trimmedEmail && p.password === password
    );

    if (!match) {
      setError("Invalid email or password.");
      return;
    }

    onSuccess(match);
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
            <p className="login__subtitle">Sign in to view the production report</p>
          </div>
        </div>

        <label className="login__field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
              required
            />
            <button
              type="button"
              className="login__toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
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

        <button type="submit" className="login__submit">
          Sign in
        </button>

        <p className="login__hint">
          Demo: <code>arpit@example.com</code> / <code>123</code>
        </p>
      </form>
    </div>
  );
}
