"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Profile } from "@/types/profile";
import type { Product } from "@/types/product";
import { fetchDesignApprovals, fetchCompletedFilDesignIds, fetchCompletedPolDesignIds, fetchManagerRatesByUser, fetchFilForAdmin, fetchPolForAdmin } from "@/services/api";
import type { DesignRateRow } from "@/services/api";
import * as XLSX from "xlsx";
import "./adminPanel.css";
import "./adminPanel-responsive.css";
import "./adminPanel-header.css";
import "./adminPanel-status.css";
import "./adminPanel-manager.css";
import "./adminPanel-export.css";
import "./adminPanel-summary.css";

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

// Excel Export utilities
const exportToExcel = (data: any[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

const handleExportAllDesigns = (products: Product[]) => {
  const data = products.map(p => ({
    'Design Code': p.designCode,
    'Manager': p.managerName,
    'Customer Type': p.custType,
    'Parts': p.numberOfParts,
    'Manufacturer': p.manufacturer,
    'Location': p.dep,
    'Difficulty': p.difficulty,
    'FIL Rate': p.filRate,
    'POL Rate': p.polRate,
    'PRP Rate': p.prpRate,
    'Dhaga Rate': p.dhagaRate,
    'Client Code': p.custCode,
    'Category': p.polCtg,
    'TP RM Category': p.tpRmCtg || '',
    'Image URL': p.imageUrl || ''
  }));
  exportToExcel(data, 'all-designs');
};

interface FilPolMergedRow {
  designId: string;
  difficulty: string;
  systemFilRate: number;
  systemPolRate: number;
  systemPrpRate: number;
  systemDhagaRate: number;
  userFilRate: number | null;
  userPolRate: number | null;
  userPrpRate: number | null;
  userDhagaRate: number | null;
  status: string;
  submittedAt: string;
}

const handleExportFilEntries = (rows: FilPolMergedRow[]) => {
  const data = rows.map(row => ({
    'Design ID': row.designId,
    'Difficulty': row.difficulty,
    'System FIL Rate': row.systemFilRate,
    'System POL Rate': row.systemPolRate,
    'System PRP Rate': row.systemPrpRate,
    'System Dhaga Rate': row.systemDhagaRate,
    'FIL User Rate': row.userFilRate ?? '',
    'FIL User POL Rate': row.userPolRate ?? '',
    'FIL User PRP Rate': row.userPrpRate ?? '',
    'FIL User Dhaga Rate': row.userDhagaRate ?? '',
    'Status': row.status,
    'Submitted At': row.submittedAt,
  }));
  exportToExcel(data, 'fil-entries');
};

const handleExportPolEntries = (rows: FilPolMergedRow[]) => {
  const data = rows.map(row => ({
    'Design ID': row.designId,
    'Difficulty': row.difficulty,
    'System FIL Rate': row.systemFilRate,
    'System POL Rate': row.systemPolRate,
    'System PRP Rate': row.systemPrpRate,
    'System Dhaga Rate': row.systemDhagaRate,
    'POL User Rate': row.userPolRate ?? '',
    'POL User FIL Rate': row.userFilRate ?? '',
    'POL User PRP Rate': row.userPrpRate ?? '',
    'POL User Dhaga Rate': row.userDhagaRate ?? '',
    'Status': row.status,
    'Submitted At': row.submittedAt,
  }));
  exportToExcel(data, 'pol-entries');
};

const handleExportManagerEntries = (rows: {
  designId: string;
  managerName: string;
  difficulty: string;
  filRate: number;
  polRate: number;
  prpRate: number;
  dhagaRate: number;
  managerFilRate: number | null;
  managerPolRate: number | null;
  managerPrpRate: number | null;
  managerDhagaRate: number | null;
  filUserFilRate: number | null;
  filUserPrpRate: number | null;
  polUserPolRate: number | null;
  polUserPrpRate: number | null;
  managerStatus: string;
  managerSubmittedAt: string;
}[]) => {
  const data = rows.map(row => ({
    'Design ID': row.designId,
    'Manager Name': row.managerName,
    'Difficulty': row.difficulty,
    'System FIL Rate': row.filRate,
    'System POL Rate': row.polRate,
    'System PRP Rate': row.prpRate,
    'System Dhaga Rate': row.dhagaRate,
    'Manager FIL Rate': row.managerFilRate ?? '',
    'Manager POL Rate': row.managerPolRate ?? '',
    'Manager PRP Rate': row.managerPrpRate ?? '',
    'FIL User FIL Rate': row.filUserFilRate ?? '',
    'POL User POL Rate': row.polUserPolRate ?? '',
    'POL User PRP Rate': row.polUserPrpRate ?? '',
    'Status': row.managerStatus,
    'Submitted At': row.managerSubmittedAt,
  }));
  exportToExcel(data, 'manager-entries');
};

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
  const [filFromDate, setFilFromDate] = useState<string>(() => todayString());
  const [filToDate, setFilToDate] = useState<string>(() => todayString());
  const [filEntries, setFilEntries] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message?: string;
    rows?: FilPolMergedRow[];
  }>({ status: "idle" });
  const [polFromDate, setPolFromDate] = useState<string>(() => todayString());
  const [polToDate, setPolToDate] = useState<string>(() => todayString());
  const [polEntries, setPolEntries] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message?: string;
    rows?: FilPolMergedRow[];
  }>({ status: "idle" });
  const [managerFromDate, setManagerFromDate] = useState<string>(() => todayString());
  const [managerToDate, setManagerToDate] = useState<string>(() => todayString());
  const [selectedManager, setSelectedManager] = useState<string>("");
  const [managerEntries, setManagerEntries] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message?: string;
    rows?: {
      designId: string;
      managerName: string;
      difficulty: string;
      filRate: number;
      polRate: number;
      prpRate: number;
      dhagaRate: number;
      managerFilRate: number | null;
      managerPolRate: number | null;
      managerPrpRate: number | null;
      managerDhagaRate: number | null;
      filUserFilRate: number | null;
      filUserPrpRate: number | null;
      polUserPolRate: number | null;
      polUserPrpRate: number | null;
      managerStatus: string;
      managerSubmittedAt: string;
    }[];
  }>({ status: "idle" });
  const [filVisibleCount, setFilVisibleCount] = useState(10);
  const [polVisibleCount, setPolVisibleCount] = useState(10);
  const [managerVisibleCount, setManagerVisibleCount] = useState(10);
  const [filSearchQuery, setFilSearchQuery] = useState("");
  const [polSearchQuery, setPolSearchQuery] = useState("");
  const [managerSearchQuery, setManagerSearchQuery] = useState("");

  const managerNames = [
    "All Managers",
    "KIRAN NANJI VIRAS",
    "BHAVIN KISHAN GORADIA",
    "HARDIK KAPADIA",
    "RAHUL K KHAIRE",
    "RAJESH UTTAM LONDHE",
    "AKASH CHODHARY"
  ];

  const managerToEmpUniqId: Record<string, string> = {
    "All Managers": "ALL MANAGERS",
    "KIRAN NANJI VIRAS": "5",
    "BHAVIN KISHAN GORADIA": "322024",
    "HARDIK KAPADIA": "324415",
    "RAHUL K KHAIRE": "27",
    "RAJESH UTTAM LONDHE": "500",
    "AKASH CHODHARY": "324416"
  };
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

  const mergeRatesWithSystem = (rateRows: DesignRateRow[], systemProducts: Product[], type: "fil" | "pol"): FilPolMergedRow[] => {
    const systemMap = new Map<string, Product>();
    for (const p of systemProducts) {
      systemMap.set(p.designCode.trim(), p);
    }
    return rateRows.map(rate => {
      const sys = systemMap.get((rate.design_id ?? "").trim());
      return {
        designId: rate.design_id ?? "",
        difficulty: sys?.difficulty ?? rate.difficulty ?? "",
        systemFilRate: sys?.filRate ?? 0,
        systemPolRate: sys?.polRate ?? 0,
        systemPrpRate: sys?.prpRate ?? 0,
        systemDhagaRate: sys?.dhagaRate ?? 0,
        userFilRate: rate.fil_rate != null ? Number(rate.fil_rate) : null,
        userPolRate: rate.pol_rate != null ? Number(rate.pol_rate) : null,
        userPrpRate: rate.prp_rate != null ? Number(rate.prp_rate) : null,
        userDhagaRate: rate.dhaga_rate != null ? Number(rate.dhaga_rate) : null,
        status: type === "fil" ? (rate.fil_status ?? "") : (rate.pol_status ?? ""),
        submittedAt: type === "fil" ? (rate.fil_submitted_at ?? "") : (rate.pol_submitted_at ?? ""),
      };
    });
  };

  const handleFetchFilEntries = useCallback(async () => {
    if (!filFromDate || !filToDate || filFromDate > filToDate) return;
    setFilEntries({ status: "loading" });
    setFilVisibleCount(10);
    try {
      const [filRates, systemProducts] = await Promise.all([
        fetchFilForAdmin(),
        fetchDesignApprovals({ fromDate: filFromDate, toDate: filToDate, roleId: user.empRoleId }),
      ]);
      // Completed FIL entries
      const completedRows = mergeRatesWithSystem(filRates, systemProducts, "fil");

      // Pending: system designs that don't have a FIL entry yet
      const filDesignIds = new Set(filRates.map(r => (r.design_id ?? "").trim()));
      const pendingRows: FilPolMergedRow[] = systemProducts
        .filter(p => !filDesignIds.has(p.designCode.trim()))
        .map(p => ({
          designId: p.designCode,
          difficulty: p.difficulty ?? "",
          systemFilRate: p.filRate ?? 0,
          systemPolRate: p.polRate ?? 0,
          systemPrpRate: p.prpRate ?? 0,
          systemDhagaRate: p.dhagaRate ?? 0,
          userFilRate: null,
          userPolRate: null,
          userPrpRate: null,
          userDhagaRate: null,
          status: "PENDING",
          submittedAt: "",
        }));

      setFilEntries({ status: "success", rows: [...completedRows, ...pendingRows] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch FIL entries.";
      setFilEntries({ status: "error", message });
    }
  }, [filFromDate, filToDate, user.empRoleId]);

  const handleFetchPolEntries = useCallback(async () => {
    if (!polFromDate || !polToDate || polFromDate > polToDate) return;
    setPolEntries({ status: "loading" });
    setPolVisibleCount(10);
    try {
      const [polRates, systemProducts] = await Promise.all([
        fetchPolForAdmin(),
        fetchDesignApprovals({ fromDate: polFromDate, toDate: polToDate, roleId: user.empRoleId }),
      ]);
      const rows = mergeRatesWithSystem(polRates, systemProducts, "pol");
      setPolEntries({ status: "success", rows });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch POL entries.";
      setPolEntries({ status: "error", message });
    }
  }, [polFromDate, polToDate, user.empRoleId]);

  const handleFetchManagerEntries = useCallback(async () => {
    if (!selectedManager || !managerFromDate || !managerToDate || managerFromDate > managerToDate) return;
    setManagerEntries({ status: "loading" });
    setManagerVisibleCount(10); // Reset pagination
    try {
      const empUniqId = managerToEmpUniqId[selectedManager];
      if (!empUniqId) throw new Error("Manager not found in mapping.");

      const isAllManagers = selectedManager === "All Managers";

      // Call all APIs in parallel
      const [managerRates, systemProducts, filData, polData] = await Promise.all([
        fetchManagerRatesByUser(empUniqId),
        fetchDesignApprovals({
          fromDate: managerFromDate,
          toDate: managerToDate,
          roleId: "5",
          ...(isAllManagers ? {} : { managerName: selectedManager }),
        }),
        fetchFilForAdmin(),
        fetchPolForAdmin(),
      ]);

      // Build lookup maps
      const systemMap = new Map<string, typeof systemProducts[0]>();
      for (const p of systemProducts) {
        systemMap.set(p.designCode.trim(), p);
      }

      const filMap = new Map<string, typeof filData[0]>();
      for (const f of filData) {
        filMap.set((f.design_id ?? "").trim(), f);
      }

      const polMap = new Map<string, typeof polData[0]>();
      for (const p of polData) {
        polMap.set((p.design_id ?? "").trim(), p);
      }

      // Build reverse lookup: empUniqId -> manager name
      const empIdToManager: Record<string, string> = {};
      for (const [name, id] of Object.entries(managerToEmpUniqId)) {
        if (name !== "All Managers") empIdToManager[id] = name;
      }

      // Merge: one row per manager rate entry, include FIL and POL rates for common design codes
      const rows = managerRates.map(rate => {
        const designId = (rate.design_id ?? "").trim();
        const sysProduct = systemMap.get(designId);
        const filRate = filMap.get(designId);
        const polRate = polMap.get(designId);
        const resolvedManagerName = isAllManagers
          ? (sysProduct?.managerName ?? empIdToManager[rate.manager_user_id ?? ""] ?? "Unknown")
          : selectedManager;

        return {
          designId: rate.design_id ?? "",
          managerName: resolvedManagerName,
          difficulty: sysProduct?.difficulty ?? "",
          filRate: sysProduct?.filRate ?? 0,
          polRate: sysProduct?.polRate ?? 0,
          prpRate: sysProduct?.prpRate ?? 0,
          dhagaRate: sysProduct?.dhagaRate ?? 0,
          managerFilRate: rate.fil_rate != null ? Number(rate.fil_rate) : null,
          managerPolRate: rate.pol_rate != null ? Number(rate.pol_rate) : null,
          managerPrpRate: rate.prp_rate != null ? Number(rate.prp_rate) : null,
          managerDhagaRate: rate.dhaga_rate != null ? Number(rate.dhaga_rate) : null,
          filUserFilRate: filRate?.fil_rate != null ? Number(filRate.fil_rate) : null,
          filUserPrpRate: filRate?.prp_rate != null ? Number(filRate.prp_rate) : null,
          polUserPolRate: polRate?.pol_rate != null ? Number(polRate.pol_rate) : null,
          polUserPrpRate: polRate?.prp_rate != null ? Number(polRate.prp_rate) : null,
          managerStatus: rate.manager_status ?? "",
          managerSubmittedAt: rate.manager_submitted_at ?? "",
        };
      });

      setManagerEntries({ status: "success", rows });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch manager entries.";
      setManagerEntries({ status: "error", message });
    }
  }, [selectedManager, managerFromDate, managerToDate]);

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
    const rows = filEntries.rows ?? [];
    if (!filSearchQuery.trim()) return rows;
    const q = filSearchQuery.toLowerCase();
    return rows.filter(row =>
      row.designId.toLowerCase().includes(q) ||
      row.difficulty.toLowerCase().includes(q)
    );
  }, [filEntries.rows, filSearchQuery]);

  const filteredPolEntries = useMemo(() => {
    const rows = polEntries.rows ?? [];
    if (!polSearchQuery.trim()) return rows;
    const q = polSearchQuery.toLowerCase();
    return rows.filter(row =>
      row.designId.toLowerCase().includes(q) ||
      row.difficulty.toLowerCase().includes(q)
    );
  }, [polEntries.rows, polSearchQuery]);

  const filteredManagerEntries = useMemo(() => {
    const rows = managerEntries.rows ?? [];
    if (!managerSearchQuery.trim()) return rows;
    const q = managerSearchQuery.toLowerCase();
    return rows.filter(row =>
      row.designId.toLowerCase().includes(q) ||
      row.managerName.toLowerCase().includes(q) ||
      row.difficulty.toLowerCase().includes(q)
    );
  }, [managerEntries.rows, managerSearchQuery]);

  // Auto-fetch when both dates are selected and valid
  useEffect(() => {
    if (fromDate && toDate && fromDate <= toDate) {
      handleFetchDesigns();
    }
  }, [fromDate, toDate, handleFetchDesigns]);

  // Auto-fetch FIL entries when tab is active and dates are valid
  useEffect(() => {
    if (activeTab === "fil-entries" && filFromDate && filToDate && filFromDate <= filToDate) {
      handleFetchFilEntries();
    }
  }, [activeTab, filFromDate, filToDate, handleFetchFilEntries]);

  // Auto-fetch POL entries when tab is active and dates are valid
  useEffect(() => {
    if (activeTab === "pol-entries" && polFromDate && polToDate && polFromDate <= polToDate) {
      handleFetchPolEntries();
    }
  }, [activeTab, polFromDate, polToDate, handleFetchPolEntries]);

  // Auto-fetch manager entries when all inputs are valid
  useEffect(() => {
    if (activeTab === "manager-entries" && selectedManager && managerFromDate && managerToDate && managerFromDate <= managerToDate) {
      handleFetchManagerEntries();
    }
  }, [activeTab, selectedManager, managerFromDate, managerToDate, handleFetchManagerEntries]);

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
              <div className="admin-toolbar">
                <label>From <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} max={toDate} /></label>
                <label>To <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} min={fromDate} /></label>
                <div className="admin-toolbar-search">
                  <input type="text" placeholder="Search designs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                {loadState.status === "success" && loadState.products && loadState.products.length > 0 && (
                  <div className="admin-toolbar-export">
                    <button className="admin-export-btn" onClick={() => handleExportAllDesigns(loadState.products!)}>📊 Export to Excel</button>
                  </div>
                )}
              </div>
              {loadState.status === "success" && loadState.products && (
                <div className="admin-summary">
                  <div className="admin-summary-card admin-summary-card--total">
                    <span className="admin-summary-icon">📋</span>
                    <div className="admin-summary-info">
                      <span className="admin-summary-value">{loadState.products.length}</span>
                      <span className="admin-summary-label">Total Designs</span>
                    </div>
                  </div>
                </div>
              )}
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
              <div className="admin-toolbar">
                <label>From <input type="date" value={filFromDate} onChange={(e) => setFilFromDate(e.target.value)} max={filToDate} /></label>
                <label>To <input type="date" value={filToDate} onChange={(e) => setFilToDate(e.target.value)} min={filFromDate} /></label>
                {filEntries.status === "success" && filEntries.rows && (
                  <div className="admin-toolbar-search">
                    <input type="text" placeholder="Search designs..." value={filSearchQuery} onChange={(e) => setFilSearchQuery(e.target.value)} />
                  </div>
                )}
                {filEntries.status === "success" && filEntries.rows && filEntries.rows.length > 0 && (
                  <div className="admin-toolbar-export">
                    <button className="admin-export-btn" onClick={() => handleExportFilEntries(filEntries.rows!)}>📊 Export to Excel</button>
                  </div>
                )}
              </div>
              {filEntries.status === "success" && filEntries.rows && (
                <div className="admin-summary">
                  <div className="admin-summary-card admin-summary-card--pending">
                    <span className="admin-summary-icon">⏳</span>
                    <div className="admin-summary-info">
                      <span className="admin-summary-value">{filEntries.rows.filter(r => r.status === "PENDING").length}</span>
                      <span className="admin-summary-label">Pending FIL</span>
                    </div>
                  </div>
                </div>
              )}
              {filEntries.status === "loading" ? (
                <div className="admin-placeholder"><p>Loading FIL entries...</p></div>
              ) : filEntries.status === "error" ? (
                <div className="admin-placeholder admin-placeholder--error">
                  <p>Error: {filEntries.message}</p>
                  <button onClick={handleFetchFilEntries}>Retry</button>
                </div>
              ) : filEntries.status === "success" && filEntries.rows ? (
                <div className="admin-designs-table">
                  <div className="admin-table-wrapper">
                    <table className="admin-table admin-table--compact">
                      <thead>
                        <tr>
                          <th rowSpan={2}>Design ID</th>
                          <th rowSpan={2}>Difficulty</th>
                          <th colSpan={4} style={{ textAlign: "center", background: "#ebf4ff", color: "#2b6cb0" }}>System Rates</th>
                          <th style={{ textAlign: "center", background: "#f0fff4", color: "#276749" }}>FIL User Rate</th>
                          <th rowSpan={2}>Status</th>
                          <th rowSpan={2}>Submitted At</th>
                        </tr>
                        <tr>
                          <th style={{ background: "#ebf4ff" }}>FIL</th>
                          <th style={{ background: "#ebf4ff" }}>POL</th>
                          <th style={{ background: "#ebf4ff" }}>PRP</th>
                          <th style={{ background: "#ebf4ff" }}>Dhaga</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFilEntries.slice(0, filVisibleCount).map((row, idx) => (
                          <tr key={`${row.designId}-${idx}`}>
                            <td>{row.designId}</td>
                            <td>{row.difficulty || "—"}</td>
                            <td>{inr(row.systemFilRate)}</td>
                            <td>{inr(row.systemPolRate)}</td>
                            <td>{inr(row.systemPrpRate)}</td>
                            <td>{inr(row.systemDhagaRate)}</td>
                            <td>{row.userFilRate != null ? inr(row.userFilRate) : "—"}</td>
                            <td><span className={`admin-status-badge ${row.status === "COMPLETED" ? "admin-status-badge--success" : "admin-status-badge--pending"}`}>{row.status}</span></td>
                            <td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "—"}</td>
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
                        <span className="admin-show-more-count">({filteredFilEntries.length - filVisibleCount} remaining)</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          )}

          {/* POL entries Tab */}
          {activeTab === "pol-entries" && (
            <section className="admin-section">
              <div className="admin-toolbar">
                <label>From <input type="date" value={polFromDate} onChange={(e) => setPolFromDate(e.target.value)} max={polToDate} /></label>
                <label>To <input type="date" value={polToDate} onChange={(e) => setPolToDate(e.target.value)} min={polFromDate} /></label>
                {polEntries.status === "success" && polEntries.rows && (
                  <div className="admin-toolbar-search">
                    <input type="text" placeholder="Search designs..." value={polSearchQuery} onChange={(e) => setPolSearchQuery(e.target.value)} />
                  </div>
                )}
                {polEntries.status === "success" && polEntries.rows && polEntries.rows.length > 0 && (
                  <div className="admin-toolbar-export">
                    <button className="admin-export-btn" onClick={() => handleExportPolEntries(polEntries.rows!)}>📊 Export to Excel</button>
                  </div>
                )}
              </div>
              {polEntries.status === "success" && polEntries.rows && (
                <div className="admin-summary">
                  <div className="admin-summary-card admin-summary-card--total">
                    <span className="admin-summary-icon">📋</span>
                    <div className="admin-summary-info">
                      <span className="admin-summary-value">{(loadState.products ?? []).length}</span>
                      <span className="admin-summary-label">Total Designs</span>
                    </div>
                  </div>
                  <div className="admin-summary-card admin-summary-card--completed">
                    <span className="admin-summary-icon">✅</span>
                    <div className="admin-summary-info">
                      <span className="admin-summary-value">{polEntries.rows.length}</span>
                      <span className="admin-summary-label">POL Completed</span>
                    </div>
                  </div>
                  <div className="admin-summary-card admin-summary-card--pending">
                    <span className="admin-summary-icon">⏳</span>
                    <div className="admin-summary-info">
                      <span className="admin-summary-value">{Math.max(0, (loadState.products ?? []).length - polEntries.rows.length)}</span>
                      <span className="admin-summary-label">Pending</span>
                    </div>
                  </div>
                </div>
              )}
              {polEntries.status === "loading" ? (
                <div className="admin-placeholder"><p>Loading POL entries...</p></div>
              ) : polEntries.status === "error" ? (
                <div className="admin-placeholder admin-placeholder--error">
                  <p>Error: {polEntries.message}</p>
                  <button onClick={handleFetchPolEntries}>Retry</button>
                </div>
              ) : polEntries.status === "success" && polEntries.rows ? (
                <div className="admin-designs-table">
                  <div className="admin-table-wrapper">
                    <table className="admin-table admin-table--compact">
                      <thead>
                        <tr>
                          <th rowSpan={2}>Design ID</th>
                          <th rowSpan={2}>Difficulty</th>
                          <th colSpan={4} style={{ textAlign: "center", background: "#ebf4ff", color: "#2b6cb0" }}>System Rates</th>
                          <th colSpan={2} style={{ textAlign: "center", background: "#fdf2f8", color: "#97266d" }}>POL User Rates</th>
                          <th rowSpan={2}>Status</th>
                          <th rowSpan={2}>Submitted At</th>
                        </tr>
                        <tr>
                          <th style={{ background: "#ebf4ff" }}>FIL</th>
                          <th style={{ background: "#ebf4ff" }}>POL</th>
                          <th style={{ background: "#ebf4ff" }}>PRP</th>
                          <th style={{ background: "#ebf4ff" }}>Dhaga</th>
                          <th style={{ background: "#fdf2f8" }}>POL</th>
                          <th style={{ background: "#fdf2f8" }}>PRP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPolEntries.slice(0, polVisibleCount).map((row, idx) => (
                          <tr key={`${row.designId}-${idx}`}>
                            <td>{row.designId}</td>
                            <td>{row.difficulty || "—"}</td>
                            <td>{inr(row.systemFilRate)}</td>
                            <td>{inr(row.systemPolRate)}</td>
                            <td>{inr(row.systemPrpRate)}</td>
                            <td>{inr(row.systemDhagaRate)}</td>
                            <td>{row.userPolRate != null ? inr(row.userPolRate) : "—"}</td>
                            <td>{row.userPrpRate != null ? inr(row.userPrpRate) : "—"}</td>
                            <td><span className="admin-status-badge admin-status-badge--success">{row.status}</span></td>
                            <td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "—"}</td>
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
                        <span className="admin-show-more-count">({filteredPolEntries.length - polVisibleCount} remaining)</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          )}

          {/* Manager entries Tab */}
          {activeTab === "manager-entries" && (
            <section className="admin-section">
              <div className="admin-toolbar">
                <label>From <input type="date" value={managerFromDate} onChange={(e) => setManagerFromDate(e.target.value)} max={managerToDate} /></label>
                <label>To <input type="date" value={managerToDate} onChange={(e) => setManagerToDate(e.target.value)} min={managerFromDate} /></label>
                <div className="admin-toolbar-group">
                  Manager
                  <select value={selectedManager} onChange={(e) => setSelectedManager(e.target.value)}>
                    <option value="">Select manager...</option>
                    {managerNames.map((name) => (<option key={name} value={name}>{name}</option>))}
                  </select>
                </div>
                {managerEntries.status === "success" && managerEntries.rows && (
                  <div className="admin-toolbar-search">
                    <input type="text" placeholder="Search designs..." value={managerSearchQuery} onChange={(e) => setManagerSearchQuery(e.target.value)} />
                  </div>
                )}
                {managerEntries.status === "success" && managerEntries.rows && managerEntries.rows.length > 0 && (
                  <div className="admin-toolbar-export">
                    <button className="admin-export-btn" onClick={() => handleExportManagerEntries(managerEntries.rows!)}>📊 Export to Excel</button>
                  </div>
                )}
              </div>
              {managerEntries.status === "success" && managerEntries.rows && (
                <div className="admin-summary">
                  <div className="admin-summary-card admin-summary-card--total">
                    <span className="admin-summary-icon">📋</span>
                    <div className="admin-summary-info">
                      <span className="admin-summary-value">{(loadState.products ?? []).length}</span>
                      <span className="admin-summary-label">Total Designs</span>
                    </div>
                  </div>
                  <div className="admin-summary-card admin-summary-card--completed">
                    <span className="admin-summary-icon">✅</span>
                    <div className="admin-summary-info">
                      <span className="admin-summary-value">{managerEntries.rows.length}</span>
                      <span className="admin-summary-label">Mgr Completed</span>
                    </div>
                  </div>
                  <div className="admin-summary-card admin-summary-card--pending">
                    <span className="admin-summary-icon">⏳</span>
                    <div className="admin-summary-info">
                      <span className="admin-summary-value">{Math.max(0, (loadState.products ?? []).length - managerEntries.rows.length)}</span>
                      <span className="admin-summary-label">Pending</span>
                    </div>
                  </div>
                </div>
              )}
              {!selectedManager || !managerFromDate || !managerToDate ? (
                <div className="admin-placeholder">
                  <p>Select date range and manager to automatically load entries.</p>
                </div>
              ) : managerEntries.status === "loading" ? (
                <div className="admin-placeholder"><p>Loading manager entries...</p></div>
              ) : managerEntries.status === "error" ? (
                <div className="admin-placeholder admin-placeholder--error">
                  <p>Error: {managerEntries.message}</p>
                  <button onClick={handleFetchManagerEntries}>Retry</button>
                </div>
              ) : managerEntries.status === "success" && managerEntries.rows ? (
                <div className="admin-designs-table">
                  <div className="admin-table-wrapper">
                    <table className="admin-table admin-table--compact">
                      <thead>
                        <tr>
                          <th rowSpan={2}>Design ID</th>
                          {selectedManager === "All Managers" && <th rowSpan={2}>Manager</th>}
                          <th rowSpan={2}>Difficulty</th>
                          <th colSpan={4} style={{ textAlign: "center", background: "#ebf4ff", color: "#2b6cb0" }}>System Rates</th>
                          <th colSpan={3} style={{ textAlign: "center", background: "#f0fff4", color: "#276749" }}>Manager Rates</th>
                          <th style={{ textAlign: "center", background: "#f0fff4", color: "#276749" }}>FIL User Rate</th>
                          <th colSpan={2} style={{ textAlign: "center", background: "#fdf2f8", color: "#97266d" }}>POL User Rates</th>
                          <th rowSpan={2}>Status</th>
                          <th rowSpan={2}>Submitted At</th>
                        </tr>
                        <tr>
                          <th style={{ background: "#ebf4ff" }}>FIL</th>
                          <th style={{ background: "#ebf4ff" }}>POL</th>
                          <th style={{ background: "#ebf4ff" }}>PRP</th>
                          <th style={{ background: "#ebf4ff" }}>Dhaga</th>
                          <th style={{ background: "#f0fff4" }}>Mgr FIL</th>
                          <th style={{ background: "#f0fff4" }}>Mgr POL</th>
                          <th style={{ background: "#f0fff4" }}>Mgr PRP</th>
                          <th style={{ background: "#f0fff4" }}>FIL</th>
                          <th style={{ background: "#fdf2f8" }}>POL</th>
                          <th style={{ background: "#fdf2f8" }}>PRP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredManagerEntries.slice(0, managerVisibleCount).map((row, idx) => (
                          <tr key={`${row.designId}-${idx}`}>
                            <td>{row.designId}</td>
                            {selectedManager === "All Managers" && <td>{row.managerName}</td>}
                            <td>{row.difficulty || "—"}</td>
                            <td>{inr(row.filRate)}</td>
                            <td>{inr(row.polRate)}</td>
                            <td>{inr(row.prpRate)}</td>
                            <td>{inr(row.dhagaRate)}</td>
                            <td>{row.managerFilRate != null ? inr(row.managerFilRate) : "—"}</td>
                            <td>{row.managerPolRate != null ? inr(row.managerPolRate) : "—"}</td>
                            <td>{row.managerPrpRate != null ? inr(row.managerPrpRate) : "—"}</td>
                            <td>{row.filUserFilRate != null ? inr(row.filUserFilRate) : "—"}</td>
                            <td>{row.polUserPolRate != null ? inr(row.polUserPolRate) : "—"}</td>
                            <td>{row.polUserPrpRate != null ? inr(row.polUserPrpRate) : "—"}</td>
                            <td><span className="admin-status-badge admin-status-badge--success">{row.managerStatus}</span></td>
                            <td>{row.managerSubmittedAt ? new Date(row.managerSubmittedAt).toLocaleString() : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredManagerEntries.length === 0 && (
                    <div className="admin-placeholder">
                      <p>{managerSearchQuery ? `No results found for "${managerSearchQuery}".` : "No entries found for the selected manager."}</p>
                    </div>
                  )}
                  {filteredManagerEntries.length > managerVisibleCount && (
                    <div className="admin-show-more">
                      <button className="admin-show-more-btn" onClick={handleShowMoreManager}>
                        Show {Math.min(PAGE_SIZE, filteredManagerEntries.length - managerVisibleCount)} more
                        <span className="admin-show-more-count">({filteredManagerEntries.length - managerVisibleCount} remaining)</span>
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
