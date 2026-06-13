import type { Profile } from "@/types/profile";
import "./header.css";

interface HeaderProps {
  user?: Profile;
  onLogout?: () => void;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__brand">
          <span className="app-header__logo" aria-hidden="true">
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
          <div className="app-header__titles">
            <h1 className="app-header__title">Design Approval System</h1>
            <p className="app-header__subtitle">
              Standard norms &amp; system rates per design
            </p>
          </div>
        </div>

        <div className="app-header__meta">
          <span className="app-header__pill">
            <span className="app-header__pill-dot" />
            Live
          </span>

          {user ? (
            <div className="app-header__user">
              <span className="app-header__avatar" aria-hidden="true">
                {initials(user.name)}
              </span>
              <span className="app-header__user-info">
                <strong>{user.name}</strong>
                <em>{user.role}</em>
              </span>
              {onLogout ? (
                <button
                  type="button"
                  className="app-header__logout"
                  onClick={onLogout}
                  aria-label="Sign out"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path
                      d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 17l-5-5 5-5M5 12h12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Logout
                </button>
              ) : null}
            </div>
          ) : (
            <span className="app-header__date">
              Report period: <strong>FY 2026 &middot; Q1</strong>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
