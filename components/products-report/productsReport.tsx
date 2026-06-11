"use client";

import { useCallback, useMemo, useState } from "react";
import ProductCard from "@/components/product-card/productCard";
import ProductRow from "@/components/product-row/productRow";
import RateEntryView from "@/components/rate-entry-view/rateEntryView";
import StatCard from "@/components/stat-card/statCard";
import type {
  DifficultyRate,
  FilledRate,
  PolRate,
} from "@/services/api";
import type { Product } from "@/types/product";
import { totalRate } from "@/types/product";
import type { Profile } from "@/types/profile";
import type {
  RateEntries,
  RateEntry,
  RateRole,
} from "@/types/rateEntry";
import "./productsReport.css";

type ViewMode = "grid" | "table" | "entry";

export type RateDataStatus = "idle" | "loading" | "ready" | "error";

export type LoadState =
  | { status: "idle" }
  | { status: "needs-dates" }
  | { status: "loading" }
  | { status: "success"; products: Product[] }
  | { status: "error"; message: string };

interface ProductsReportProps {
  load: LoadState;
  user: Profile;
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onRetryLoad: () => void;
  difficultyHeaders?: string[];
  difficultyRates?: DifficultyRate[];
  polRates?: PolRate[];
  filledRates?: FilledRate[];
  rateDataStatus?: RateDataStatus;
  onLoadRateData?: () => void;
}

const inr = (n: number): string =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

export default function ProductsReport({
  load,
  user,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onRetryLoad,
  difficultyHeaders,
  difficultyRates,
  polRates,
  filledRates,
  rateDataStatus = "idle",
  onLoadRateData,
}: ProductsReportProps) {
  const [view, setView] = useState<ViewMode>("table");
  const [query, setQuery] = useState("");
  const [rateEntries, setRateEntries] = useState<RateEntries>({});

  const products = useMemo<Product[]>(
    () => (load.status === "success" ? load.products : []),
    [load]
  );
  const hasProducts = load.status === "success";

  const handleOpenEntry = useCallback(() => {
    setView("entry");
    onLoadRateData?.();
  }, [onLoadRateData]);

  const handleRateChange = useCallback(
    (productId: string, role: RateRole, patch: Partial<RateEntry>) => {
      setRateEntries((prev) => {
        const product = prev[productId] ?? {};
        const current = product[role] ?? {};
        const next: RateEntry = { ...current, ...patch };
        return {
          ...prev,
          [productId]: {
            ...product,
            [role]: next,
          },
        };
      });
    },
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.designCode.toLowerCase().includes(q) ||
        p.managerName.toLowerCase().includes(q) ||
        p.managerShort.toLowerCase().includes(q) ||
        p.custCode.toLowerCase().includes(q) ||
        p.manufacturer.toLowerCase().includes(q)
    );
  }, [products, query]);

  const stats = useMemo(() => {
    const totals = products.map(totalRate);
    const sum = totals.reduce((a, b) => a + b, 0);
    const avg = totals.length ? sum / totals.length : 0;
    const managers = new Set(products.map((p) => p.managerShort)).size;
    const max = Math.max(0, ...totals);
    return {
      count: products.length,
      avg,
      managers,
      max,
    };
  }, [products]);

  return (
    <section className="products-report">
      {hasProducts ? (
      <div className="products-report__stats">
        <StatCard
          label="Total designs"
          value={String(stats.count)}
          hint="In current report"
          accent="violet"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          }
        />
        <StatCard
          label="Avg total rate"
          value={`₹ ${inr(stats.avg)}`}
          hint="FIL + POL + PRP + DHAGA"
          accent="amber"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M12 3v18M5 8h11a3 3 0 010 6H7m13 4l-3-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
        <StatCard
          label="Highest total"
          value={`₹ ${inr(stats.max)}`}
          hint="Single design"
          accent="emerald"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M3 17l6-6 4 4 7-8M14 7h7v7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
        <StatCard
          label="Managers"
          value={String(stats.managers)}
          hint="Unique"
          accent="sky"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
      </div>
      ) : null}

      <div className="products-report__toolbar">
        <div className="products-report__search">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            aria-hidden="true"
            className="products-report__search-icon"
          >
            <path
              d="M11 19a8 8 0 100-16 8 8 0 000 16zm10 2l-4.3-4.3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            type="search"
            placeholder="Search by design, manager, customer code, manufacturer..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="products-report__search-clear"
              aria-label="Clear search"
            >
              ×
            </button>
          ) : null}
        </div>

        <div className="products-report__dates" role="group" aria-label="Date range">
          <label className="products-report__date">
            <span className="products-report__date-label">From</span>
            <input
              type="date"
              className="products-report__date-input"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => onFromDateChange(e.target.value)}
            />
          </label>
          <span className="products-report__date-separator" aria-hidden="true">
            –
          </span>
          <label className="products-report__date">
            <span className="products-report__date-label">To</span>
            <input
              type="date"
              className="products-report__date-input"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => onToDateChange(e.target.value)}
            />
          </label>
        </div>

        <div className="products-report__view-toggle" role="tablist" aria-label="View mode">
          <button
            type="button"
            role="tab"
            aria-selected={view === "grid"}
            className={`products-report__view${
              view === "grid" ? " products-report__view--active" : ""
            }`}
            onClick={() => setView("grid")}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"
                fill="currentColor"
              />
            </svg>
            Cards
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "table"}
            className={`products-report__view${
              view === "table" ? " products-report__view--active" : ""
            }`}
            onClick={() => setView("table")}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M3 6h18M3 12h18M3 18h18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Table
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "entry"}
            className={`products-report__view${
              view === "entry" ? " products-report__view--active" : ""
            }`}
            onClick={handleOpenEntry}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M4 7h16M4 12h10M4 17h16M18 11l3 3-3 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Rate entry
          </button>
        </div>
      </div>

      {load.status === "needs-dates" ? (
        <NeedsDatesState />
      ) : load.status === "loading" || load.status === "idle" ? (
        <LoadingDesignsState />
      ) : load.status === "error" ? (
        <DesignsError message={load.message} onRetry={onRetryLoad} />
      ) : (
        <>
          {view !== "entry" ? (
            <div className="products-report__result-meta">
              Showing <strong>{filtered.length}</strong> of {products.length} designs
            </div>
          ) : null}

          {view === "entry" ? (
            rateDataStatus === "ready" ? (
              <RateEntryView
                products={filtered}
                user={user}
                entries={rateEntries}
                onChange={handleRateChange}
                difficultyOptions={difficultyHeaders}
                difficultyRates={difficultyRates}
                polRates={polRates}
                filledRates={filledRates}
              />
            ) : rateDataStatus === "error" ? (
              <RateDataError onRetry={() => onLoadRateData?.()} />
            ) : (
              <RateDataLoading />
            )
          ) : filtered.length === 0 ? (
            <div className="products-report__empty">
              {query ? (
                <>
                  <p>No designs match your search.</p>
                  <button type="button" onClick={() => setQuery("")}>
                    Clear search
                  </button>
                </>
              ) : (
                <p>
                  No designs were returned for {fromDate} – {toDate}. Try a
                  different date range.
                </p>
              )}
            </div>
          ) : view === "grid" ? (
            <div className="products-report__grid">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="products-report__table-wrap">
              <table className="products-report__table">
                <thead>
                  <tr>
                    <th rowSpan={2}>Image</th>
                    <th rowSpan={2}>Design</th>
                    <th rowSpan={2}>Manager</th>
                    <th rowSpan={2}>Cust</th>
                    <th rowSpan={2}>Parts</th>
                    <th colSpan={3} className="products-report__th-group">
                      As per standard norms
                    </th>
                    <th colSpan={5} className="products-report__th-group products-report__th-group--accent">
                      System rate
                    </th>
                    <th rowSpan={2} className="products-report__th-total">Total</th>
                  </tr>
                  <tr>
                    <th>MFR</th>
                    <th>Dep</th>
                    <th>POL CTG</th>
                    <th>Diff</th>
                    <th>FIL</th>
                    <th>POL</th>
                    <th>PRP</th>
                    <th>DHAGA</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <ProductRow key={p.id} product={p} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function NeedsDatesState() {
  return (
    <div className="products-report__rate-state">
      <p className="products-report__rate-title">Pick a date range</p>
      <p className="products-report__rate-subtitle">
        Choose both a From and To date above to load designs.
      </p>
    </div>
  );
}

function LoadingDesignsState() {
  return (
    <div className="products-report__rate-state">
      <div className="products-report__rate-spinner" aria-hidden="true" />
      <p className="products-report__rate-title">Loading designs…</p>
      <p className="products-report__rate-subtitle">
        Fetching the latest data from the server.
      </p>
    </div>
  );
}

interface DesignsErrorProps {
  message: string;
  onRetry: () => void;
}

function DesignsError({ message, onRetry }: DesignsErrorProps) {
  return (
    <div className="products-report__rate-state products-report__rate-state--error">
      <p className="products-report__rate-title">Couldn’t load designs</p>
      <p className="products-report__rate-subtitle">{message}</p>
      <button
        type="button"
        className="products-report__rate-retry"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}

function RateDataLoading() {
  return (
    <div className="products-report__rate-state">
      <div className="products-report__rate-spinner" aria-hidden="true" />
      <p className="products-report__rate-title">Loading rate data…</p>
      <p className="products-report__rate-subtitle">
        Fetching rate data for your role.
      </p>
    </div>
  );
}

interface RateDataErrorProps {
  onRetry: () => void;
}

function RateDataError({ onRetry }: RateDataErrorProps) {
  return (
    <div className="products-report__rate-state products-report__rate-state--error">
      <p className="products-report__rate-title">Couldn’t load rate data</p>
      <p className="products-report__rate-subtitle">
        The server took too long or returned an error. Try again in a moment.
      </p>
      <button
        type="button"
        className="products-report__rate-retry"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}
