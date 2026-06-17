"use client";

import { useState } from "react";
import type { Profile } from "@/types/profile";
import "./adminPanel.css";

interface AdminPanelProps {
  user: Profile;
  onLogout: () => void;
}

type AdminTab = "all-designs" | "fil-entries" | "pol-entries" | "manager-entries";

export default function AdminPanel({ user, onLogout }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("all-designs");

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
              className={`admin-nav-item ${activeTab === "all-designs" ? "admin-nav-item--active" : ""
                }`}
              onClick={() => setActiveTab("all-designs")}
            >
              <span className="admin-nav-icon">🎨</span>
              All designs
            </button>
            <button
              className={`admin-nav-item ${activeTab === "fil-entries" ? "admin-nav-item--active" : ""
                }`}
              onClick={() => setActiveTab("fil-entries")}
            >
              <span className="admin-nav-icon">�</span>
              FIL entries
            </button>
            <button
              className={`admin-nav-item ${activeTab === "pol-entries" ? "admin-nav-item--active" : ""
                }`}
              onClick={() => setActiveTab("pol-entries")}
            >
              <span className="admin-nav-icon">�</span>
              POL entries
            </button>
            <button
              className={`admin-nav-item ${activeTab === "manager-entries" ? "admin-nav-item--active" : ""
                }`}
              onClick={() => setActiveTab("manager-entries")}
            >
              <span className="admin-nav-icon">✅</span>
              Manager entries
            </button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="admin-content">
          {/* All designs Tab */}
          {activeTab === "all-designs" && (
            <section className="admin-section">
              <h2 className="admin-section-title">All designs</h2>
              <div className="admin-placeholder">
                <p>View and manage all designs across the system</p>
              </div>
            </section>
          )}

          {/* FIL entries Tab */}
          {activeTab === "fil-entries" && (
            <section className="admin-section">
              <h2 className="admin-section-title">FIL entries</h2>
              <div className="admin-placeholder">
                <p>Review and manage FIL rate entries</p>
              </div>
            </section>
          )}

          {/* POL entries Tab */}
          {activeTab === "pol-entries" && (
            <section className="admin-section">
              <h2 className="admin-section-title">POL entries</h2>
              <div className="admin-placeholder">
                <p>Review and manage POL rate entries</p>
              </div>
            </section>
          )}

          {/* Manager entries Tab */}
          {activeTab === "manager-entries" && (
            <section className="admin-section">
              <h2 className="admin-section-title">Manager entries</h2>
              <div className="admin-placeholder">
                <p>Review and manage manager-approved entries</p>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
