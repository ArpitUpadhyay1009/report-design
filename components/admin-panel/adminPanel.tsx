"use client";

import { useState } from "react";
import type { Profile } from "@/types/profile";
import "./adminPanel.css";

interface AdminPanelProps {
  user: Profile;
  onLogout: () => void;
}

type AdminTab = "dashboard" | "users" | "reports" | "settings";

export default function AdminPanel({ user, onLogout }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");

  return (
    <div className="admin-panel">
      {/* Admin Header */}
      <header className="admin-header">
        <div className="admin-header__left">
          <h1 className="admin-header__title">Admin Dashboard</h1>
          <p className="admin-header__subtitle">Super Manager Control Panel</p>
        </div>
        <div className="admin-header__right">
          <div className="admin-user-info">
            <div>
              <p className="admin-user-name">{user.name}</p>
              <p className="admin-user-role">{user.role}</p>
            </div>
            <button
              className="admin-logout-btn"
              onClick={onLogout}
              aria-label="Logout"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="admin-container">
        {/* Sidebar Navigation */}
        <aside className="admin-sidebar">
          <nav className="admin-nav">
            <button
              className={`admin-nav-item ${
                activeTab === "dashboard" ? "admin-nav-item--active" : ""
              }`}
              onClick={() => setActiveTab("dashboard")}
            >
              <span className="admin-nav-icon">📊</span>
              Dashboard
            </button>
            <button
              className={`admin-nav-item ${
                activeTab === "users" ? "admin-nav-item--active" : ""
              }`}
              onClick={() => setActiveTab("users")}
            >
              <span className="admin-nav-icon">👥</span>
              Users
            </button>
            <button
              className={`admin-nav-item ${
                activeTab === "reports" ? "admin-nav-item--active" : ""
              }`}
              onClick={() => setActiveTab("reports")}
            >
              <span className="admin-nav-icon">📋</span>
              Reports
            </button>
            <button
              className={`admin-nav-item ${
                activeTab === "settings" ? "admin-nav-item--active" : ""
              }`}
              onClick={() => setActiveTab("settings")}
            >
              <span className="admin-nav-icon">⚙️</span>
              Settings
            </button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="admin-content">
          {/* Dashboard Tab */}
          {activeTab === "dashboard" && (
            <section className="admin-section">
              <h2 className="admin-section-title">Dashboard Overview</h2>
              <div className="admin-placeholder">
                <p>Dashboard content will be designed here</p>
              </div>
            </section>
          )}

          {/* Users Tab */}
          {activeTab === "users" && (
            <section className="admin-section">
              <h2 className="admin-section-title">User Management</h2>
              <div className="admin-placeholder">
                <p>User management interface will be designed here</p>
              </div>
            </section>
          )}

          {/* Reports Tab */}
          {activeTab === "reports" && (
            <section className="admin-section">
              <h2 className="admin-section-title">Reports & Analytics</h2>
              <div className="admin-placeholder">
                <p>Reports and analytics will be designed here</p>
              </div>
            </section>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <section className="admin-section">
              <h2 className="admin-section-title">System Settings</h2>
              <div className="admin-placeholder">
                <p>System settings will be designed here</p>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
