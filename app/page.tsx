"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/header/header";
import LoginForm from "@/components/login-form/loginForm";
import ProductsReport from "@/components/products-report/productsReport";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchDesignApprovals,
  fetchDifficultyHeaders,
  fetchFilRatesByUser,
  fetchPolRates,
  fetchPolRatesByUser,
  type DifficultyRate,
  type PolRate,
  type SubmittedFilRate,
  type SubmittedPolRate,
} from "@/services/api";
import type { Product } from "@/types/product";

// Hard-coded for now: the manager always pulls FIL submissions from this
// FIL user and POL submissions from this POL user. Swap to a dynamic
// lookup if/when the backend exposes "all submitters".
const FIL_USER_ID_FOR_MANAGER = "2";
const POL_USER_ID_FOR_MANAGER = "1";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; products: Product[] }
  | { status: "error"; message: string };

export type RateDataStatus = "idle" | "loading" | "ready" | "error";

export default function Home() {
  const { status: authStatus, user, logout } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: "idle" });
  const [difficultyRates, setDifficultyRates] = useState<DifficultyRate[]>([]);
  const [polRates, setPolRates] = useState<PolRate[]>([]);
  const [submittedFilRates, setSubmittedFilRates] = useState<
    SubmittedFilRate[]
  >([]);
  const [submittedPolRates, setSubmittedPolRates] = useState<
    SubmittedPolRate[]
  >([]);
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
    setSubmittedFilRates([]);
    setSubmittedPolRates([]);

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
      if (user.role === "MANAGER") {
        // Sequentially pull what FIL and POL have submitted so the manager's
        // read-only sections can be filled in. Stays sequential because the
        // server has had timeout issues with parallel calls.
        const filSubs = await fetchFilRatesByUser(FIL_USER_ID_FOR_MANAGER);
        if (sessionRef.current !== session) return;
        setSubmittedFilRates(filSubs);

        const polSubs = await fetchPolRatesByUser(POL_USER_ID_FOR_MANAGER);
        if (sessionRef.current !== session) return;
        setSubmittedPolRates(polSubs);
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

  const handleRetry = useCallback(() => setRefetchKey((k) => k + 1), []);

  // Auth still hydrating from localStorage — don't flash the login screen.
  if (authStatus === "loading") {
    return (
      <main>
        <LoadingState
          title="Restoring session…"
          subtitle="Checking for an existing login on this device."
        />
      </main>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <>
      <Header user={user} onLogout={logout} />
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
            submittedFilRates={submittedFilRates}
            submittedPolRates={submittedPolRates}
            rateDataStatus={rateDataStatus}
            onLoadRateData={loadRateData}
          />
        )}
      </main>
    </>
  );
}

interface LoadingStateProps {
  title?: string;
  subtitle?: string;
}

function LoadingState({
  title = "Loading designs…",
  subtitle = "Fetching the latest data from the server.",
}: LoadingStateProps) {
  return (
    <div className="page-state">
      <div className="page-state__spinner" aria-hidden="true" />
      <p className="page-state__title">{title}</p>
      <p className="page-state__subtitle">{subtitle}</p>
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
