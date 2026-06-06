"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

export default function Home() {
  const [user, setUser] = useState<Profile | null>(null);
  const [load, setLoad] = useState<LoadState>({ status: "idle" });
  const [difficultyRates, setDifficultyRates] = useState<DifficultyRate[]>([]);
  const [polRates, setPolRates] = useState<PolRate[]>([]);
  const [refetchKey, setRefetchKey] = useState(0);

  useEffect(() => {
    if (!user) {
      setLoad({ status: "idle" });
      setDifficultyRates([]);
      setPolRates([]);
      return;
    }

    let cancelled = false;
    setLoad({ status: "loading" });

    fetchDesignApprovals()
      .then((products) => {
        if (cancelled) return;
        setLoad({ status: "success", products });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Could not load designs.";
        setLoad({ status: "error", message });
      });

    fetchDifficultyHeaders()
      .then((rates) => {
        if (cancelled) return;
        setDifficultyRates(rates);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Non-blocking: rate-entry will fall back to local constants if this fails.
        console.warn("Failed to load difficulty headers:", err);
      });

    fetchPolRates()
      .then((rates) => {
        if (cancelled) return;
        setPolRates(rates);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Non-blocking: stored for later use by the POL flow.
        console.warn("Failed to load POL rates:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [user, refetchKey]);

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
