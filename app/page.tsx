"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/components/header/header";
import LoginForm from "@/components/login-form/loginForm";
import ProductsReport from "@/components/products-report/productsReport";
import { fetchDesignApprovals } from "@/services/api";
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
  const [refetchKey, setRefetchKey] = useState(0);

  useEffect(() => {
    if (!user) {
      setLoad({ status: "idle" });
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

    return () => {
      cancelled = true;
    };
  }, [user, refetchKey]);

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
          <ProductsReport products={load.products} user={user} />
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
