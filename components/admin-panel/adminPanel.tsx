"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Profile } from "@/types/profile";
import type { Product } from "@/types/product";
import { fetchDesignApprovals, fetchCompletedFilDesignIds, fetchCompletedPolDesignIds } from "@/services/api";
import "./adminPanel.css";
import "./adminPanel-responsive.css";
import "./adminPanel-header.css";
import "./adminPanel-status.css";
import "./adminPanel-manager.css";

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
  const [visibleCount, setVisibleCount] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [filEntries, setFilEntries] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message?: string;
    designIds?: string[];
  }>({ status: "idle" });
  const [polEntries, setPolEntries] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message?: string;
    designIds?: string[];
  }>({ status: "idle" });
  const [managerFromDate, setManagerFromDate] = useState<string>(() => todayString());
  const [managerToDate, setManagerToDate] = useState<string>(() => todayString());
  const [selectedManager, setSelectedManager] = useState<string>("");
  const [managerEntries, setManagerEntries] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message?: string;
    products?: Product[];
  }>({ status: "idle" });
  const [filVisibleCount, setFilVisibleCount] = useState(10);
  const [polVisibleCount, setPolVisibleCount] = useState(10);
  const [managerVisibleCount, setManagerVisibleCount] = useState(10);
  const [filSearchQuery, setFilSearchQuery] = useState("");
  const [polSearchQuery, setPolSearchQuery] = useState("");
  const [managerSearchQuery, setManagerSearchQuery] = useState("");

  const managerNames = [
    "KIRAN NANJI VIRAS",
    "BHAVIN KISHAN GORADIA",
    "HARDIK KAPADIA",
    "RAHUL K KHAIRE",
    "RAJESH UTTAM LONDHE",
    "AKASH CHODHARY"
  ];
  const PAGE_SIZE = 10;

  const handleFetchDesigns = useCallback(async () => {
    if (!fromDate || !toDate || fromDate > toDate) return;
    setLoadState({ status: "loading" });
    setVisibleCount(10); // Reset pagination
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

  const handleShowMore = () => {
    setVisibleCount(prev => prev + PAGE_SIZE);
  };

  const handleShowMoreFil = () => {
    setFilVisibleCount(prev => prev + PAGE_SIZE);
  };

  const handleShowMorePol = () => {
    setPolVisibleCount(prev => prev + PAGE_SIZE);
  };

  const handleShowMoreManager = () => {
    setManagerVisibleCount(prev => prev + PAGE_SIZE);
  };

  const handleFetchFilEntries = useCallback(async () => {
    setFilEntries({ status: "loading" });
    setFilVisibleCount(10); // Reset pagination
    try {
      const designIds = await fetchCompletedFilDesignIds();
      setFilEntries({ status: "success", designIds });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch FIL entries.";
      setFilEntries({ status: "error", message });
    }
  }, []);

  const handleFetchPolEntries = useCallback(async () => {
    setPolEntries({ status: "loading" });
    setPolVisibleCount(10); // Reset pagination
    try {
      const designIds = await fetchCompletedPolDesignIds();
      setPolEntries({ status: "success", designIds });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch POL entries.";
      setPolEntries({ status: "error", message });
    }
  }, []);

  const handleFetchManagerEntries = useCallback(async () => {
    if (!managerFromDate || !managerToDate || managerFromDate > managerToDate || !selectedManager) return;
    setManagerEntries({ status: "loading" });
    setManagerVisibleCount(10); // Reset pagination
    try {
      const products = await fetchDesignApprovals({
        fromDate: managerFromDate,
        toDate: managerToDate,
        roleId: "4", // Manager role
        managerName: selectedManager,
      });
      setManagerEntries({ status: "success", products });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch manager entries.";
      setManagerEntries({ status: "error", message });
    }
  }, [managerFromDate, managerToDate, selectedManager]);

  const filteredProducts = useMemo(() => {
    const products = loadState.products ?? [];
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(p =>
      p.designCode.toLowerCase().includes(q) ||
      p.managerName.toLowerCase().includes(q) ||
      p.manufacturer.toLowerCase().includes(q) ||
      p.custCode.toLowerCase().includes(q) ||
      p.difficulty.toLowerCase().includes(q)
    );
  }, [loadState.products, searchQuery]);

  const filteredFilEntries = useMemo(() => {
    const designIds = filEntries.designIds ?? [];
    if (!filSearchQuery.trim()) return designIds;
    const q = filSearchQuery.toLowerCase();
    return designIds.filter(id => id.toLowerCase().includes(q));
  }, [filEntries.designIds, filSearchQuery]);

  const filteredPolEntries = useMemo(() => {
    const designIds = polEntries.designIds ?? [];
    if (!polSearchQuery.trim()) return designIds;
    const q = polSearchQuery.toLowerCase();
    return designIds.filter(id => id.toLowerCase().includes(q));
  }, [polEntries.designIds, polSearchQuery]);

  const filteredManagerEntries = useMemo(() => {
    const products = managerEntries.products ?? [];
    if (!managerSearchQuery.trim()) return products;
    const q = managerSearchQuery.toLowerCase();
    return products.filter(p =>
      p.designCode.toLowerCase().includes(q) ||
      p.managerName.toLowerCase().includes(q) ||
      p.manufacturer.toLowerCase().includes(q) ||
      p.custCode.toLowerCase().includes(q) ||
      p.difficulty.toLowerCase().includes(q)
    );
  }, [managerEntries.products, managerSearchQuery]);

  // Auto-fetch when both dates are selected and valid
  useEffect(() => {
    if (fromDate && toDate && fromDate <= toDate) {
      handleFetchDesigns();
    }
  }, [fromDate, toDate, handleFetchDesigns]);

  // Fetch FIL entries when tab is active
  useEffect(() => {
    if (activeTab === "fil-entries" && filEntries.status === "idle") {
      handleFetchFilEntries();
    }
  }, [activeTab, filEntries.status, handleFetchFilEntries]);

  // Fetch POL entries when tab is active
  useEffect(() => {
    if (activeTab === "pol-entries" && polEntries.status === "idle") {
      handleFetchPolEntries();
    }
  }, [activeTab, polEntries.status, handleFetchPolEntries]);

  // Auto-fetch manager entries when all inputs are valid
  useEffect(() => {
    if (activeTab === "manager-entries" && managerFromDate && managerToDate &&
      managerFromDate <= managerToDate && selectedManager) {
      handleFetchManagerEntries();
    }
  }, [activeTab, managerFromDate, managerToDate, selectedManager, handleFetchManagerEntries]);

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
                <div className="admin-date-filter admin-date-filter--search">
                  <span>Search</span>
                  <input
                    type="text"
                    placeholder="Search designs..."
                    className="admin-search-bar-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
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
                  <div className="admin-table-wrapper">
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
                        {filteredProducts.slice(0, visibleCount).map((product) => (
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
                  </div>
                  {filteredProducts.length === 0 && (
                    <div className="admin-placeholder">
                      <p>{searchQuery ? `No results found for "${searchQuery}".` : "No designs found for the selected date range."}</p>
                    </div>
                  )}
                  {filteredProducts.length > visibleCount && (
                    <div className="admin-show-more">
                      <button className="admin-show-more-btn" onClick={handleShowMore}>
                        Show {Math.min(PAGE_SIZE, filteredProducts.length - visibleCount)} more
                        <span className="admin-show-more-count">
                          ({filteredProducts.length - visibleCount} remaining)
                        </span>
                      </button>
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
              {filEntries.status === "idle" && (
                <div className="admin-placeholder">
                  <p>Loading FIL entries...</p>
                </div>
              )}
              {filEntries.status === "loading" && (
                <div className="admin-placeholder">
                  <p>Loading FIL entries...</p>
                </div>
              )}
              {filEntries.status === "error" && (
                <div className="admin-placeholder admin-placeholder--error">
                  <p>Error: {filEntries.message}</p>
                  <button onClick={handleFetchFilEntries}>Retry</button>
                </div>
              )}
              {filEntries.status === "success" && filEntries.designIds && (
                <div className="admin-date-filters">
                  <div className="admin-date-filter admin-date-filter--search">
                    <span>Search</span>
                    <input
                      type="text"
                      placeholder="Search design IDs..."
                      className="admin-search-bar-input"
                      value={filSearchQuery}
                      onChange={(e) => setFilSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              )}
              {filEntries.status === "success" && filEntries.designIds && (
                <div className="admin-designs-table">
                  <div className="admin-table-wrapper">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Design ID</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFilEntries.slice(0, filVisibleCount).map((designId, index) => (
                          <tr key={designId}>
                            <td>{designId}</td>
                            <td>
                              <span className="admin-status-badge admin-status-badge--success">
                                FIL Completed
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredFilEntries.length === 0 && (
                    <div className="admin-placeholder">
                      <p>{filSearchQuery ? `No results found for "${filSearchQuery}".` : "No FIL entries found."}</p>
                    </div>
                  )}
                  {filteredFilEntries.length > filVisibleCount && (
                    <div className="admin-show-more">
                      <button className="admin-show-more-btn" onClick={handleShowMoreFil}>
                        Show {Math.min(PAGE_SIZE, filteredFilEntries.length - filVisibleCount)} more
                        <span className="admin-show-more-count">
                          ({filteredFilEntries.length - filVisibleCount} remaining)
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* POL entries Tab */}
          {activeTab === "pol-entries" && (
            <section className="admin-section">
              <h2 className="admin-section-title">POL entries</h2>
              {polEntries.status === "idle" && (
                <div className="admin-placeholder">
                  <p>Loading POL entries...</p>
                </div>
              )}
              {polEntries.status === "loading" && (
                <div className="admin-placeholder">
                  <p>Loading POL entries...</p>
                </div>
              )}
              {polEntries.status === "error" && (
                <div className="admin-placeholder admin-placeholder--error">
                  <p>Error: {polEntries.message}</p>
                  <button onClick={handleFetchPolEntries}>Retry</button>
                </div>
              )}
              {polEntries.status === "success" && polEntries.designIds && (
                <div className="admin-date-filters">
                  <div className="admin-date-filter admin-date-filter--search">
                    <span>Search</span>
                    <input
                      type="text"
                      placeholder="Search design IDs..."
                      className="admin-search-bar-input"
                      value={polSearchQuery}
                      onChange={(e) => setPolSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              )}
              {polEntries.status === "success" && polEntries.designIds && (
                <div className="admin-designs-table">
                  <div className="admin-table-wrapper">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Design ID</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPolEntries.slice(0, polVisibleCount).map((designId, index) => (
                          <tr key={designId}>
                            <td>{designId}</td>
                            <td>
                              <span className="admin-status-badge admin-status-badge--success">
                                POL Completed
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredPolEntries.length === 0 && (
                    <div className="admin-placeholder">
                      <p>{polSearchQuery ? `No results found for "${polSearchQuery}".` : "No POL entries found."}</p>
                    </div>
                  )}
                  {filteredPolEntries.length > polVisibleCount && (
                    <div className="admin-show-more">
                      <button className="admin-show-more-btn" onClick={handleShowMorePol}>
                        Show {Math.min(PAGE_SIZE, filteredPolEntries.length - polVisibleCount)} more
                        <span className="admin-show-more-count">
                          ({filteredPolEntries.length - polVisibleCount} remaining)
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Manager entries Tab */}
          {activeTab === "manager-entries" && (
            <section className="admin-section">
              <h2 className="admin-section-title">Manager entries</h2>
              <div className="admin-date-filters">
                <label className="admin-date-filter">
                  <span>From date</span>
                  <input
                    type="date"
                    value={managerFromDate}
                    onChange={(e) => setManagerFromDate(e.target.value)}
                    max={managerToDate}
                  />
                </label>
                <label className="admin-date-filter">
                  <span>To date</span>
                  <input
                    type="date"
                    value={managerToDate}
                    onChange={(e) => setManagerToDate(e.target.value)}
                    min={managerFromDate}
                  />
                </label>
                <div className="admin-date-filter">
                  <span>Manager</span>
                  <select
                    className="admin-manager-select"
                    value={selectedManager}
                    onChange={(e) => setSelectedManager(e.target.value)}
                  >
                    <option value="">Select manager...</option>
                    {managerNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {managerEntries.status === "success" && managerEntries.products && (
                <div className="admin-date-filters">
                  <div className="admin-date-filter admin-date-filter--search">
                    <span>Search</span>
                    <input
                      type="text"
                      placeholder="Search designs..."
                      className="admin-search-bar-input"
                      value={managerSearchQuery}
                      onChange={(e) => setManagerSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              )}
              {!managerFromDate || !managerToDate || !selectedManager ? (
                <div className="admin-placeholder">
                  <p>Select date range and manager to automatically load entries.</p>
                </div>
              ) : managerEntries.status === "loading" ? (
                <div className="admin-placeholder">
                  <p>Loading manager entries...</p>
                </div>
              ) : managerEntries.status === "error" ? (
                <div className="admin-placeholder admin-placeholder--error">
                  <p>Error: {managerEntries.message}</p>
                  <button onClick={handleFetchManagerEntries}>Retry</button>
                </div>
              ) : managerEntries.status === "success" && managerEntries.products ? (
                <div className="admin-designs-table">
                  <div className="admin-table-wrapper">
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
                        {filteredManagerEntries.slice(0, managerVisibleCount).map((product) => (
                          <tr key={product.id}>
                            <td>
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.designCode}
                                  style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }}
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
                  </div>
                  {filteredManagerEntries.length === 0 && (
                    <div className="admin-placeholder">
                      <p>{managerSearchQuery ? `No results found for "${managerSearchQuery}".` : "No entries found for the selected manager and date range."}</p>
                    </div>
                  )}
                  {filteredManagerEntries.length > managerVisibleCount && (
                    <div className="admin-show-more">
                      <button className="admin-show-more-btn" onClick={handleShowMoreManager}>
                        Show {Math.min(PAGE_SIZE, filteredManagerEntries.length - managerVisibleCount)} more
                        <span className="admin-show-more-count">
                          ({filteredManagerEntries.length - managerVisibleCount} remaining)
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
