"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/header/header";
import LoginForm from "@/components/login-form/loginForm";
import ProductsReport from "@/components/products-report/productsReport";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchCompletedFilDesignIds,
  fetchCompletedPolDesignIds,
  fetchDesignApprovals,
  fetchDesignWiseDifficulty,
  fetchDifficultyHeaders,
  fetchFilledRates,
  fetchPolRates,
  type DifficultyRate,
  type DesignWiseDifficulty,
  type FilledRate,
  type PolRate,
} from "@/services/api";
import type { LoadState } from "@/components/products-report/productsReport";

export type RateDataStatus = "idle" | "loading" | "ready" | "error";

const formatDate = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const todayString = () => formatDate(new Date());

export default function Home() {
  const { status: authStatus, user, logout } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: "idle" });
  const [difficultyRates, setDifficultyRates] = useState<DifficultyRate[]>([]);
  const [polRates, setPolRates] = useState<PolRate[]>([]);
  const [filledRates, setFilledRates] = useState<FilledRate[]>([]);
  const [completedFilDesignIds, setCompletedFilDesignIds] = useState<string[]>(
    []
  );
  const [completedPolDesignIds, setCompletedPolDesignIds] = useState<string[]>(
    []
  );
  const [designWiseDifficulties, setDesignWiseDifficulties] = useState<
    DesignWiseDifficulty[]
  >([]);
  const [rateDataStatus, setRateDataStatus] = useState<RateDataStatus>("idle");
  const [refetchKey, setRefetchKey] = useState(0);

  // Date range used by the design-approvals API. Default to "today" for
  // both so the first load returns *something*; user can widen the range
  // from the toolbar.
  const [fromDate, setFromDate] = useState<string>(() => todayString());
  const [toDate, setToDate] = useState<string>(() => todayString());

  const sessionRef = useRef(0);
  const rateStatusRef = useRef<RateDataStatus>("idle");

  // Reset rate-data caches whenever the user changes (login / logout).
  // Date changes deliberately do NOT trigger this reset because the rate
  // APIs are independent of the design date range.
  useEffect(() => {
    sessionRef.current += 1;
    rateStatusRef.current = "idle";
    setRateDataStatus("idle");
    setDifficultyRates([]);
    setPolRates([]);
    setFilledRates([]);
    setCompletedFilDesignIds([]);
    setCompletedPolDesignIds([]);
    setDesignWiseDifficulties([]);
  }, [user]);

  // Fetch designs whenever user, dates, or a manual retry changes.
  // The setState calls below are intentional: this effect synchronizes the
  // React tree with an external system (the API), which is exactly what
  // useEffect is for. The lint rule over-fires on this canonical pattern.
  useEffect(() => {
    if (!user) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setLoad({ status: "idle" });
      return;
    }
    if (!fromDate || !toDate) {
      // Toolbar hasn't been fully populated yet — show the empty prompt
      // instead of firing the API with a missing field.
      setLoad({ status: "needs-dates" });
      return;
    }
    if (fromDate > toDate) {
      setLoad({
        status: "error",
        message: "From date must be on or before To date.",
      });
      return;
    }

    const session = sessionRef.current;
    setLoad({ status: "loading" });

    // Always send roleId (raw EmpRoleid from login). Only send managerName
    // when the logged-in user is a MANAGER — for FIL / POL the SP scopes
    // results from the role alone, so we deliberately leave it off.
    fetchDesignApprovals({
      fromDate,
      toDate,
      roleId: user.empRoleId,
      managerName: user.role === "MANAGER" ? user.name : undefined,
    })
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
  }, [user, refetchKey, fromDate, toDate]);

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
      if (user.role === "FIL") {
        const [completedFil, designWise] = await Promise.all([
          fetchCompletedFilDesignIds(),
          fetchDesignWiseDifficulty(),
        ]);
        if (sessionRef.current !== session) return;
        setCompletedFilDesignIds(completedFil);
        setDesignWiseDifficulties(designWise);
      }
      if (user.role === "POL" || user.role === "MANAGER") {
        const pols = await fetchPolRates();
        if (sessionRef.current !== session) return;
        setPolRates(pols);
      }
      if (user.role === "POL") {
        const completedPol = await fetchCompletedPolDesignIds();
        if (sessionRef.current !== session) return;
        setCompletedPolDesignIds(completedPol);
      }
      if (user.role === "MANAGER") {
        // Designs where both FIL and POL are COMPLETED — drives which rows
        // the manager sees and what goes in the read-only FIL/POL columns.
        const filled = await fetchFilledRates();
        if (sessionRef.current !== session) return;
        setFilledRates(filled);
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
        <ProductsReport
          load={load}
          user={user}
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onRetryLoad={handleRetry}
          difficultyHeaders={difficultyHeaders}
          difficultyRates={difficultyRates}
          polRates={polRates}
          filledRates={filledRates}
          completedFilDesignIds={completedFilDesignIds}
          completedPolDesignIds={completedPolDesignIds}
          designWiseDifficulties={designWiseDifficulties}
          rateDataStatus={rateDataStatus}
          onLoadRateData={loadRateData}
        />
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
