"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/header/header";
import LoginForm from "@/components/login-form/loginForm";
import ProductsReport from "@/components/products-report/productsReport";
import {
  fetchDesignApprovals,
  fetchDifficultyHeaders,
  fetchPolRates,
  type DifficultyRate,
  type PolRate,
} from "@/services/api";
import type { Product } from "@/types/product";
import type { Profile } from "@/types/profile";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; products: Product[] }
  | { status: "error"; message: string };

export type RateDataStatus = "idle" | "loading" | "ready" | "error";

export default function Home() {
  const [user, setUser] = useState<Profile | null>(null);
  const [load, setLoad] = useState<LoadState>({ status: "idle" });
  const [difficultyRates, setDifficultyRates] = useState<DifficultyRate[]>([]);
  const [polRates, setPolRates] = useState<PolRate[]>([]);
  const [rateDataStatus, setRateDataStatus] = useState<RateDataStatus>("idle");
  const [refetchKey, setRefetchKey] = useState(0);

  const sessionRef = useRef(0);
  const rateStatusRef = useRef<RateDataStatus>("idle");

  useEffect(() => {
    sessionRef.current += 1;
    rateStatusRef.current = "idle";
    setRateDataStatus("idle");
    setDifficultyRates([]);
    setPolRates([]);

    if (!user) {
      setLoad({ status: "idle" });
      return;
    }

    const session = sessionRef.current;
    setLoad({ status: "loading" });

    fetchDesignApprovals()
      .then((products) => {
        if (sessionRef.current !== session) return;
        setLoad({ status: "success", products });
      })
      .catch((err: unknown) => {
        if (sessionRef.current !== session) return;
        const message =
          err instanceof Error ? err.message : "Could not load designs.";
        setLoad({ status: "error", message });
      });
  }, [user, refetchKey]);

  const loadRateData = useCallback(async () => {
    if (!user) return;
    if (
      rateStatusRef.current === "loading" ||
      rateStatusRef.current === "ready"
    ) {
      return;
    }

    const session = sessionRef.current;
    rateStatusRef.current = "loading";
    setRateDataStatus("loading");

    try {
      if (user.role === "FIL" || user.role === "MANAGER") {
        const diffs = await fetchDifficultyHeaders();
        if (sessionRef.current !== session) return;
        setDifficultyRates(diffs);
      }
      if (user.role === "POL" || user.role === "MANAGER") {
        const pols = await fetchPolRates();
        if (sessionRef.current !== session) return;
        setPolRates(pols);
      }
      if (sessionRef.current !== session) return;
      rateStatusRef.current = "ready";
      setRateDataStatus("ready");
    } catch (err) {
      if (sessionRef.current !== session) return;
      rateStatusRef.current = "error";
      setRateDataStatus("error");
      console.warn("Failed to load rate data:", err);
    }
  }, [user]);

  const difficultyHeaders = useMemo(
    () => difficultyRates.map((r) => r.code),
    [difficultyRates]
  );

  const handleLogout = useCallback(() => setUser(null), []);
  const handleRetry = useCallback(() => setRefetchKey((k) => k + 1), []);

  if (!user) {
    return <LoginForm onSuccess={setUser} />;
  }

  return (
    <>
      <Header user={user} onLogout={handleLogout} />
      <main>
        {load.status === "loading" || load.status === "idle" ? (
          <LoadingState />
        ) : load.status === "error" ? (
          <ErrorState message={load.message} onRetry={handleRetry} />
        ) : (
          <ProductsReport
            products={load.products}
            user={user}
            difficultyHeaders={difficultyHeaders}
            difficultyRates={difficultyRates}
            polRates={polRates}
            rateDataStatus={rateDataStatus}
            onLoadRateData={loadRateData}
          />
        )}
      </main>
    </>
  );
}

function LoadingState() {
  return (
    <div className="page-state">
      <div className="page-state__spinner" aria-hidden="true" />
      <p className="page-state__title">Loading designs…</p>
      <p className="page-state__subtitle">Fetching the latest data from the server.</p>
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="page-state page-state--error">
      <div className="page-state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="28" height="28">
          <path
            d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="page-state__title">Couldn’t load designs</p>
      <p className="page-state__subtitle">{message}</p>
      <button type="button" className="page-state__retry" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
