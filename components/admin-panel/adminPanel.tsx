"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Profile } from "@/types/profile";
import type { Product } from "@/types/product";
import { fetchDesignApprovals } from "@/services/api";
import "./adminPanel.css";

interface AdminPanelProps {
  user: Profile;
  onLogout: () => void;
}

type AdminTab = "all-designs" | "fil-entries" | "pol-entries" | "manager-entries";

const formatDate = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const todayString = () => formatDate(new Date());

const inr = (n: number | undefined | null): string =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n ?? 0);

export default function AdminPanel({ user, onLogout }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("all-designs");
  const [fromDate, setFromDate] = useState<string>(() => todayString());
  const [toDate, setToDate] = useState<string>(() => todayString());
  const [loadState, setLoadState] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message?: string;
    products?: Product[];
  }>({ status: "idle" });

  const handleFetchDesigns = useCallback(async () => {
    if (!fromDate || !toDate || fromDate > toDate) return;
    setLoadState({ status: "loading" });
    try {
      const products = await fetchDesignApprovals({
        fromDate,
        toDate,
        roleId: user.empRoleId,
      });
      setLoadState({ status: "success", products });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch designs.";
      setLoadState({ status: "error", message });
    }
  }, [fromDate, toDate, user.empRoleId]);

  // Auto-fetch when both dates are selected and valid
  useEffect(() => {
    if (fromDate && toDate && fromDate <= toDate) {
      handleFetchDesigns();
    }
  }, [fromDate, toDate, handleFetchDesigns]);

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
              <div className="admin-date-filters">
                <label className="admin-date-filter">
                  <span>From date</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    max={toDate}
                  />
                </label>
                <label className="admin-date-filter">
                  <span>To date</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    min={fromDate}
                  />
                </label>
              </div>
              {loadState.status === "idle" && (
                <div className="admin-placeholder">
                  <p>Select a date range to automatically load designs.</p>
                </div>
              )}
              {loadState.status === "loading" && (
                <div className="admin-placeholder">
                  <p>Loading designs…</p>
                </div>
              )}
              {loadState.status === "error" && (
                <div className="admin-placeholder admin-placeholder--error">
                  <p>Error: {loadState.message}</p>
                  <button onClick={handleFetchDesigns}>Retry</button>
                </div>
              )}
              {loadState.status === "success" && loadState.products && (
                <div className="admin-designs-table">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Image</th>
                        <th>Design</th>
                        <th>Manager</th>
                        <th>Cust Type</th>
                        <th>Parts</th>
                        <th>Manufacturer</th>
                        <th>Location</th>
                        <th>Difficulty</th>
                        <th>FIL Rate</th>
                        <th>POL Rate</th>
                        <th>PRP Rate</th>
                        <th>Dhaga Rate</th>
                        <th>Client Code</th>
                        <th>Category</th>
                        <th>TP RM Ctg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadState.products.map((product) => (
                        <tr key={product.id}>
                          <td>
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.designCode}
                                style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }}
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  target.style.display = "none";
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const fallback = document.createElement("span");
                                    fallback.style.color = "#a0aec0";
                                    fallback.style.fontSize = "0.875rem";
                                    fallback.textContent = "No image found";
                                    parent.appendChild(fallback);
                                  }
                                }}
                              />
                            ) : (
                              <span style={{ color: "#a0aec0", fontSize: "0.875rem" }}>No image found</span>
                            )}
                          </td>
                          <td>{product.designCode}</td>
                          <td>{product.managerName}</td>
                          <td>{product.custType}</td>
                          <td>{product.numberOfParts}</td>
                          <td>{product.manufacturer}</td>
                          <td>{product.dep}</td>
                          <td>{product.difficulty}</td>
                          <td>{inr(product.filRate)}</td>
                          <td>{inr(product.polRate)}</td>
                          <td>{inr(product.prpRate)}</td>
                          <td>{inr(product.dhagaRate)}</td>
                          <td>{product.custCode}</td>
                          <td>{product.polCtg}</td>
                          <td>{product.tpRmCtg || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {loadState.products.length === 0 && (
                    <div className="admin-placeholder">
                      <p>No designs found for the selected date range.</p>
                    </div>
                  )}
                </div>
              )}
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
