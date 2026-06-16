"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { difficulties } from "@/constants/rate";
import ImageBox from "@/components/image-box/imageBox";
import {
  submitFilRate,
  submitManagerRate,
  submitPolRate,
  type DifficultyRate,
  type DesignWiseDifficulty,
  type FilRateResponse,
  type ManagerRateResponse,
  type FilledRate,
  type PolRate,
  type PolRateResponse,
} from "@/services/api";
import type { Product } from "@/types/product";
import type { Profile, Role } from "@/types/profile";
import type { RateEntry, RateEntries, RateRole } from "@/types/rateEntry";
import {
  buildDesignDifficultiesByDmCtg,
  buildDifficultyToDmCtgMap,
  designDifficultiesForDmCtg,
  filRateForDesignDifficulty,
  isPolSpCode,
  patchFromDmCtg,
  patchFromPolSp,
  polDropdownOptionsForDmCtg,
  productForFilledRate,
  resolveDefaultDesignDifficulty,
  resolveProductDmCtg,
} from "@/utils/rateEntryHelpers";
import "./rateEntryView.css";

type RateTable = Record<string, number>;
type FilRateLookup = (code: string) => number | undefined;
type RowSubmitState = "submitting" | "done" | "error";

interface SubmitSummary {
  total: number;
  done: number;
  failed: number;
}

interface CategoryRates {
  polRate?: number;
  prpRate?: number;
}

export type RateEntryMode = "pending" | "completed";

interface RateEntryViewProps {
  mode?: RateEntryMode;
  products: Product[];
  user: Profile;
  entries: RateEntries;
  onChange: (productId: string, role: RateRole, patch: Partial<RateEntry>) => void;
  difficultyOptions?: string[];
  difficultyRates?: DifficultyRate[];
  polRates?: PolRate[];
  filledRates?: FilledRate[];
  completedFilDesignIds?: string[];
  completedPolDesignIds?: string[];
  designWiseDifficulties?: DesignWiseDifficulty[];
  onListMetaChange?: (meta: { shown: number; total: number }) => void;
}

const inr = (n: number): string =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);

const roleSectionLabel: Record<RateRole, string> = {
  FIL: "FIL Entry",
  POL: "POL Entry",
  MANAGER: "Final Manager Approval",
};

const sectionsForRole = (role: Role): RateRole[] => {
  if (role === "MANAGER") return ["FIL", "POL", "MANAGER"];
  if (role === "POL") return ["POL"];
  if (role === "FIL") return ["FIL"];
  return [];
};

const colsPerSection: Record<RateRole, number> = {
  FIL: 2,
  POL: 3,
  MANAGER: 5,
};

const PAGE_SIZE = 10;

const custTone = (custType: Product["custType"]): "amber" | "violet" | "emerald" | "rose" => {
  if (custType === "O") return "amber";
  if (custType === "B") return "violet";
  if (custType === "S") return "emerald";
  return "rose";
};

export default function RateEntryView({
  mode = "pending",
  products,
  user,
  entries,
  onChange,
  difficultyOptions,
  difficultyRates,
  polRates,
  filledRates,
  completedFilDesignIds,
  completedPolDesignIds,
  designWiseDifficulties,
  onListMetaChange,
}: RateEntryViewProps) {
  const sections = sectionsForRole(user.role);
  const showCheckboxes = mode === "pending";

  const completedFilSet = useMemo(
    () => new Set(completedFilDesignIds ?? []),
    [completedFilDesignIds]
  );
  const completedPolSet = useMemo(
    () => new Set(completedPolDesignIds ?? []),
    [completedPolDesignIds]
  );

  const isStageCompleted = useCallback(
    (designCode: string): boolean => {
      if (user.role === "FIL") return completedFilSet.has(designCode);
      if (user.role === "POL") return completedPolSet.has(designCode);
      return false;
    },
    [user.role, completedFilSet, completedPolSet]
  );

  const filledByDesign = useMemo(() => {
    const map = new Map<string, FilledRate>();
    (filledRates ?? []).forEach((r) => map.set(r.designId, r));
    return map;
  }, [filledRates]);

  const designDifficultiesByDmCtg = useMemo(
    () => buildDesignDifficultiesByDmCtg(designWiseDifficulties ?? []),
    [designWiseDifficulties]
  );

  const difficultyToDmCtg = useMemo(
    () => buildDifficultyToDmCtgMap(designWiseDifficulties ?? []),
    [designWiseDifficulties]
  );

  const allDisplayProducts = useMemo(() => {
    if (user.role !== "MANAGER") return products;
    if (!filledRates?.length) return [];
    const productByDesign = new Map(
      products.map((p) => [p.designCode, p] as const)
    );
    return filledRates.map((filled) =>
      productForFilledRate(
        filled,
        productByDesign.get(filled.designId),
        difficultyToDmCtg
      )
    );
  }, [user.role, products, filledRates, difficultyToDmCtg]);

  // FIL / POL: pending tab excludes completed IDs; completed tab shows only
  // those IDs (intersected with the current design list). Manager unchanged.
  const displayProducts = useMemo(() => {
    if (user.role === "MANAGER") return allDisplayProducts;
    if (mode === "completed") {
      return allDisplayProducts.filter((p) => isStageCompleted(p.designCode));
    }
    return allDisplayProducts.filter((p) => !isStageCompleted(p.designCode));
  }, [user.role, allDisplayProducts, mode, isStageCompleted]);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [displayProducts, mode]);

  const visibleProducts = useMemo(
    () => displayProducts.slice(0, visibleCount),
    [displayProducts, visibleCount]
  );

  const hasMore = visibleCount < displayProducts.length;
  const remainingCount = displayProducts.length - visibleCount;

  const handleShowMore = useCallback(() => {
    setVisibleCount((n) => Math.min(n + PAGE_SIZE, displayProducts.length));
  }, [displayProducts.length]);

  useEffect(() => {
    onListMetaChange?.({
      shown: Math.min(visibleCount, displayProducts.length),
      total: displayProducts.length,
    });
  }, [visibleCount, displayProducts.length, onListMetaChange]);

  const designColSpan = showCheckboxes ? 4 : 3;
  const isSuperManager =
    user.empCode.trim().toUpperCase() === "FS10493" &&
    String(user.empRoleId).trim() === "5";
  const editableSection: RateRole | null =
    user.role === "POL"
      ? "POL"
      : user.role === "FIL"
      ? "FIL"
      : user.role === "MANAGER"
      ? "MANAGER"
      : null;

  const localDifficultyCodes = Object.keys(difficulties);
  const apiDifficultyCodes =
    (user.role === "FIL" || user.role === "MANAGER") &&
    difficultyOptions &&
    difficultyOptions.length > 0
      ? difficultyOptions
      : localDifficultyCodes;

  const ratesByCode = useMemo(() => {
    const map = new Map<string, DifficultyRate>();
    (difficultyRates ?? []).forEach((r) => map.set(r.code, r));
    return map;
  }, [difficultyRates]);

  const polRatesByCategory = useMemo(() => {
    const map = new Map<string, PolRate>();
    (polRates ?? []).forEach((r) => map.set(r.category, r));
    return map;
  }, [polRates]);

  const polCategoryCodes = useMemo(() => {
    const codes = (polRates ?? []).map((r) => r.category).filter(Boolean);
    return Array.from(new Set(codes)).sort();
  }, [polRates]);

  const buildFilRateLookup = (custType: string): FilRateLookup => {
    return (code: string): number | undefined => {
      if (
        (user.role === "FIL" || user.role === "MANAGER") &&
        designWiseDifficulties?.length
      ) {
        return filRateForDesignDifficulty(
          difficultyRates ?? [],
          code,
          custType
        );
      }
      const apiEntry = ratesByCode.get(code);
      if (apiEntry) {
        if (custType === "O") return apiEntry.normalRate ?? undefined;
        if (custType === "B") return apiEntry.brandRate ?? undefined;
        return undefined;
      }
      const localRate = (difficulties as RateTable)[code];
      return localRate;
    };
  };

  const buildCategoryRates = (
    polCtg: string,
    custType: string
  ): CategoryRates => {
    const entry = polRatesByCategory.get(polCtg);
    if (!entry) return {};
    if (custType === "O") {
      return {
        polRate: entry.normalPol ?? undefined,
        prpRate: entry.normalPrp ?? undefined,
      };
    }
    if (custType === "B") {
      return {
        polRate: entry.brandPol ?? undefined,
        prpRate: entry.brandPrp ?? undefined,
      };
    }
    return {};
  };

  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [rowStatuses, setRowStatuses] = useState<
    Record<string, RowSubmitState>
  >({});
  const [rowMessages, setRowMessages] = useState<Record<string, string>>({});
  const [submitSummary, setSubmitSummary] = useState<SubmitSummary | null>(
    null
  );

  const isProductValid = useCallback(
    (p: Product): boolean => {
      if (mode === "completed") return false;
      if (user.role === "FIL") {
        const e = entries[p.id]?.FIL;
        const resolvedDmCtg = resolveProductDmCtg(
          p,
          designDifficultiesByDmCtg,
          difficultyToDmCtg
        );
        const options = designDifficultiesForDmCtg(
          designDifficultiesByDmCtg,
          resolvedDmCtg
        );
        const difficulty =
          e?.difficulty ?? resolveDefaultDesignDifficulty(options, p.difficulty);
        const filRate =
          e?.filRate ??
          (difficulty
            ? filRateForDesignDifficulty(
                difficultyRates ?? [],
                difficulty,
                p.custType
              )
            : undefined);
        return (
          !!difficulty &&
          difficulty.length > 0 &&
          typeof filRate === "number" &&
          Number.isFinite(filRate)
        );
      }
      if (user.role === "POL") {
        const sectionEntry = entries[p.id]?.POL ?? {};
        const effectiveDmCtg = sectionEntry.dmCtg ?? p.polCtg;
        if (!effectiveDmCtg) return false;
        const lookup = buildCategoryRates(effectiveDmCtg, p.custType);
        const polRate = sectionEntry.polRate ?? lookup.polRate;
        const prpRate = sectionEntry.prpRate ?? lookup.prpRate;
        return (
          typeof polRate === "number" &&
          Number.isFinite(polRate) &&
          typeof prpRate === "number" &&
          Number.isFinite(prpRate)
        );
      }
      if (user.role === "MANAGER") {
        const filled = filledByDesign.get(p.designCode);
        const sectionEntry = entries[p.id]?.MANAGER ?? {};
        const resolvedDmCtg = resolveProductDmCtg(
          p,
          designDifficultiesByDmCtg,
          difficultyToDmCtg,
          filled
        );
        const options = designDifficultiesForDmCtg(
          designDifficultiesByDmCtg,
          resolvedDmCtg
        );
        const difficulty =
          sectionEntry.difficulty ??
          resolveDefaultDesignDifficulty(
            options,
            filled?.difficulty ?? p.difficulty
          );
        const filRate =
          sectionEntry.filRate ??
          (difficulty
            ? filRateForDesignDifficulty(
                difficultyRates ?? [],
                difficulty,
                p.custType
              )
            : filled?.filRate);
        if (
          typeof difficulty !== "string" ||
          difficulty.length === 0 ||
          typeof filRate !== "number" ||
          !Number.isFinite(filRate)
        ) {
          return false;
        }
        const effectiveDmCtg =
          sectionEntry.dmCtg ?? resolvedDmCtg ?? filled?.dmCtg ?? "";
        if (!effectiveDmCtg) return false;
        const lookup = buildCategoryRates(effectiveDmCtg, p.custType);
        const polRate = sectionEntry.polRate ?? lookup.polRate;
        const prpRate = sectionEntry.prpRate ?? lookup.prpRate;
        return (
          typeof polRate === "number" &&
          Number.isFinite(polRate) &&
          typeof prpRate === "number" &&
          Number.isFinite(prpRate)
        );
      }
      return false;
    },
    [mode, user.role, entries, polRatesByCategory, designDifficultiesByDmCtg, difficultyToDmCtg, difficultyRates, filledByDesign]
  );

  const submittableProducts = useMemo(
    () =>
      displayProducts.filter((p) => selectedIds.has(p.id) && isProductValid(p)),
    [displayProducts, selectedIds, isProductValid]
  );

  const selectedCount = useMemo(
    () => displayProducts.filter((p) => selectedIds.has(p.id)).length,
    [displayProducts, selectedIds]
  );

  const allSelected =
    displayProducts.length > 0 &&
    displayProducts.every((p) => selectedIds.has(p.id));

  const toggleRow = useCallback((productId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(productId);
      else next.delete(productId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (displayProducts.length === 0) return prev;
      const everySelected = displayProducts.every((p) => prev.has(p.id));
      if (everySelected) return new Set();
      return new Set(displayProducts.map((p) => p.id));
    });
  }, [displayProducts]);

  const handleSubmit = useCallback(async () => {
    if (submitting || submittableProducts.length === 0) return;
    if (!user.userId) {
      console.warn("Cannot submit rates without a user id.");
      return;
    }

    // Snapshot per-row API calls at click time so a mid-submit edit can't
    // change what's in flight. Each job is a productId + a thunk that
    // resolves to the server response.
    type Job = {
      productId: string;
      run: () => Promise<
        FilRateResponse | PolRateResponse | ManagerRateResponse
      >;
    };

    let jobs: Job[] = [];

    if (user.role === "FIL") {
      jobs = submittableProducts.map((p) => {
        const resolvedDmCtg = resolveProductDmCtg(
          p,
          designDifficultiesByDmCtg,
          difficultyToDmCtg
        );
        const options = designDifficultiesForDmCtg(
          designDifficultiesByDmCtg,
          resolvedDmCtg
        );
        const e = entries[p.id]?.FIL ?? {};
        const difficulty =
          e.difficulty ?? resolveDefaultDesignDifficulty(options, p.difficulty);
        const filRate =
          e.filRate ??
          (difficulty
            ? filRateForDesignDifficulty(
                difficultyRates ?? [],
                difficulty,
                p.custType
              )
            : undefined);
        const payload = {
          user_id: user.userId,
          design_id: p.designCode,
          difficulty: difficulty as string,
          fil_rate: filRate as number,
        };
        return { productId: p.id, run: () => submitFilRate(payload) };
      });
    } else if (user.role === "POL") {
      jobs = submittableProducts.map((p) => {
        const sectionEntry = entries[p.id]?.POL ?? {};
        const effectiveDmCtg = sectionEntry.dmCtg ?? p.polCtg;
        const lookup = buildCategoryRates(effectiveDmCtg, p.custType);
        const payload = {
          user_id: user.userId,
          design_id: p.designCode,
          pol_rate: (sectionEntry.polRate ?? lookup.polRate) as number,
          prp_rate: (sectionEntry.prpRate ?? lookup.prpRate) as number,
        };
        return { productId: p.id, run: () => submitPolRate(payload) };
      });
    } else if (user.role === "MANAGER") {
      jobs = submittableProducts.map((p) => {
        const filled = filledByDesign.get(p.designCode);
        const sectionEntry = entries[p.id]?.MANAGER ?? {};
        const resolvedDmCtg = resolveProductDmCtg(
          p,
          designDifficultiesByDmCtg,
          difficultyToDmCtg,
          filled
        );
        const options = designDifficultiesForDmCtg(
          designDifficultiesByDmCtg,
          resolvedDmCtg
        );
        const difficulty =
          sectionEntry.difficulty ??
          resolveDefaultDesignDifficulty(
            options,
            filled?.difficulty ?? p.difficulty
          );
        const filRate =
          sectionEntry.filRate ??
          (difficulty
            ? filRateForDesignDifficulty(
                difficultyRates ?? [],
                difficulty,
                p.custType
              )
            : filled?.filRate);
        const effectiveDmCtg =
          sectionEntry.dmCtg ?? resolvedDmCtg ?? filled?.dmCtg ?? "";
        const lookup = buildCategoryRates(effectiveDmCtg, p.custType);
        const payload = {
          user_id: user.userId,
          design_id: p.designCode,
          difficulty: difficulty as string,
          manager_fil_rate: filRate as number,
          manager_pol_rate: (sectionEntry.polRate ?? lookup.polRate) as number,
          manager_prp_rate: (sectionEntry.prpRate ?? lookup.prpRate) as number,
        };
        return { productId: p.id, run: () => submitManagerRate(payload) };
      });
    } else {
      return;
    }

    setSubmitting(true);
    setSubmitSummary(null);
    setRowStatuses({});
    setRowMessages({});

    let done = 0;
    let failed = 0;

    // Worker-pool: up to MAX_CONCURRENCY jobs in flight at once. Each worker
    // pulls the next index from a shared cursor and processes one job,
    // looping until the queue is drained.
    const MAX_CONCURRENCY = 5;
    let cursor = 0;

    const processOne = async (job: Job) => {
      setRowStatuses((s) => ({ ...s, [job.productId]: "submitting" }));
      try {
        const result = await job.run();
        if (result.status === "1") {
          done++;
          setRowStatuses((s) => ({ ...s, [job.productId]: "done" }));
        } else {
          failed++;
          const message = Array.isArray(result.message)
            ? result.message.join(", ")
            : result.message;
          setRowStatuses((s) => ({ ...s, [job.productId]: "error" }));
          setRowMessages((m) => ({ ...m, [job.productId]: message }));
        }
      } catch (err) {
        failed++;
        const message =
          err instanceof Error ? err.message : "Network error.";
        setRowStatuses((s) => ({ ...s, [job.productId]: "error" }));
        setRowMessages((m) => ({ ...m, [job.productId]: message }));
      }
    };

    const worker = async () => {
      while (true) {
        const i = cursor++;
        if (i >= jobs.length) return;
        await processOne(jobs[i]);
      }
    };

    const workerCount = Math.min(MAX_CONCURRENCY, jobs.length);
    await Promise.all(
      Array.from({ length: workerCount }, () => worker())
    );

    setSubmitSummary({ total: jobs.length, done, failed });
    setSubmitting(false);
  }, [
    submitting,
    submittableProducts,
    entries,
    user.userId,
    user.role,
    polRatesByCategory,
    designDifficultiesByDmCtg,
    difficultyToDmCtg,
    difficultyRates,
    filledByDesign,
  ]);

  const handleExportExcel = useCallback(() => {
    if (!displayProducts.length) return;

    const headers = [
      "Design Code",
      "Manager",
      "Customer Type",
      "Parts",
      "Manufacturer",
      "Department",
      "POL Category",
      "Difficulty",
      "FIL Rate",
      "POL Rate",
      "PRP Rate",
      "Total",
    ];

    const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

    const rows = displayProducts.map((p) => [
      p.designCode,
      p.managerName,
      p.custType,
      String(p.numberOfParts),
      p.manufacturer,
      p.dep,
      p.polCtg,
      p.difficulty,
      String(p.filRate),
      String(p.polRate),
      String(p.prpRate),
      String(
        p.filRate + p.polRate + p.prpRate
      ),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCell).join(","))
      .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rate-entry-export-${mode}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [displayProducts, mode]);

  return (
    <div className="rate-entry">
      <div className="rate-entry__intro">
        <div>
          <h2 className="rate-entry__title">
            {mode === "completed" ? "Completed" : "Rate entry"} &middot;{" "}
            <span>{user.role}</span>
          </h2>
          <p className="rate-entry__subtitle">
            {mode === "completed"
              ? user.role === "FIL"
                ? "Designs where FIL rates have already been submitted."
                : user.role === "POL"
                ? "Designs where POL rates have already been submitted."
                : "Previously submitted entries."
              : user.role === "MANAGER"
              ? "Review what FIL and POL filled, enter your final approved rates, then check the rows to submit."
              : "Pick from the dropdowns below — rates fill in automatically. Check the rows you want to submit."}
          </p>
        </div>
        <div className="rate-entry__legend">
          <span className="rate-entry__legend-pill rate-entry__legend-pill--fil">FIL</span>
          <span className="rate-entry__legend-pill rate-entry__legend-pill--pol">POL</span>
          <span className="rate-entry__legend-pill rate-entry__legend-pill--mgr">Manager</span>
        </div>
      </div>

      <div className="rate-entry__table-wrap">
        <table className="rate-entry__table">
          <thead>
            <tr className="rate-entry__group-row">
              <th
                colSpan={designColSpan}
                className="rate-entry__group rate-entry__group--design"
              >
                Design
              </th>
              {sections.map((s) => (
                <th
                  key={s}
                  colSpan={colsPerSection[s]}
                  className={`rate-entry__group rate-entry__group--${s.toLowerCase()}`}
                >
                  {roleSectionLabel[s]}
                  {s === editableSection ? (
                    <em className="rate-entry__editable-tag">you</em>
                  ) : (
                    <em className="rate-entry__readonly-tag">read-only</em>
                  )}
                </th>
              ))}
            </tr>
            <tr className="rate-entry__col-row">
              {showCheckboxes ? (
                <th className="rate-entry__th rate-entry__th--check">
                  <input
                    type="checkbox"
                    className="rate-entry__checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={submitting || displayProducts.length === 0}
                    aria-label="Select all rows"
                    title="Select all rows"
                  />
                </th>
              ) : null}
              <th className="rate-entry__th rate-entry__th--image">Image</th>
              <th className="rate-entry__th">Design</th>
              <th className="rate-entry__th">Manager</th>
              {sections.map((s) => (
                <Fragment key={s}>{renderSectionHeaders(s)}</Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayProducts.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    designColSpan +
                    sections.reduce((n, s) => n + colsPerSection[s], 0)
                  }
                  className="rate-entry__empty-row"
                >
                  {mode === "completed"
                    ? "No completed designs in the current list. Widen the date range or check back after submissions."
                    : user.role === "MANAGER"
                    ? filledRates?.length
                      ? "Filled rates were loaded but none could be displayed. Try refreshing."
                      : "No designs are ready for manager review yet. FIL and POL must both be completed."
                    : user.role === "FIL" || user.role === "POL"
                    ? "No pending designs — matching rows are in the Completed tab."
                    : "No designs to show."}
                </td>
              </tr>
            ) : null}
            {visibleProducts.map((p) => {
              const productEntries = entries[p.id] ?? {};
              const rowFilled = filledByDesign.get(p.designCode);
              const resolvedDmCtg = resolveProductDmCtg(
                p,
                designDifficultiesByDmCtg,
                difficultyToDmCtg,
                rowFilled
              );
              const rowStatus = rowStatuses[p.id];
              const rowMessage = rowMessages[p.id];
              const isSelected = selectedIds.has(p.id);
              const rowClass = [
                "rate-entry__row",
                rowStatus ? `rate-entry__row--${rowStatus}` : "",
                isSelected ? "rate-entry__row--selected" : "",
                mode === "completed" ? "rate-entry__row--stage-completed" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <tr key={p.id} className={rowClass}>
                  {showCheckboxes ? (
                    <td className="rate-entry__td rate-entry__td--check">
                      <input
                        type="checkbox"
                        className="rate-entry__checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleRow(p.id, e.target.checked)}
                        disabled={submitting}
                        aria-label={`Select ${p.designCode} for submission`}
                      />
                    </td>
                  ) : null}
                  <td className="rate-entry__td rate-entry__td--image">
                    <div className="rate-entry__thumb">
                      <ImageBox
                        designCode={p.designCode}
                        tone={custTone(p.custType)}
                        size="sm"
                        imageUrl={p.imageUrl}
                      />
                    </div>
                  </td>
                  <td className="rate-entry__td">
                    <div className="rate-entry__design-row">
                      <span className="rate-entry__design">{p.designCode}</span>
                      {rowStatus ? (
                        <RowStatusBadge
                          status={rowStatus}
                          message={rowMessage}
                        />
                      ) : null}
                    </div>
                    <div className="rate-entry__sub">{p.custCode}</div>
                  </td>
                  <td className="rate-entry__td">
                    <div className="rate-entry__manager">{p.managerShort}</div>
                  </td>
                  {sections.map((s) => {
                    const ownEntry = productEntries[s] ?? {};
                    const isEditable = s === editableSection;

                    // Manager's read-only FIL / POL columns come from
                    // get-Filled-Rates (Tbl_Design_Rates, both stages COMPLETED).
                    let sectionEntry: RateEntry = ownEntry;
                    const filled = filledByDesign.get(p.designCode);
                    if (
                      user.role === "MANAGER" &&
                      !isEditable &&
                      filled
                    ) {
                      if (s === "FIL") {
                        sectionEntry = {
                          ...ownEntry,
                          difficulty: filled.difficulty,
                          filRate: filled.filRate,
                        };
                      } else if (s === "POL") {
                        sectionEntry = {
                          ...ownEntry,
                          dmCtg: filled.dmCtg,
                          polRate: filled.polRate,
                          prpRate: filled.prpRate,
                        };
                      }
                    } else if (
                      mode === "completed" &&
                      isEditable &&
                      user.role === "FIL" &&
                      s === "FIL"
                    ) {
                      sectionEntry = {
                        ...sectionEntry,
                        filRate: sectionEntry.filRate ?? p.filRate,
                      };
                    }

                    const effectiveDmCtg =
                      s === "FIL"
                        ? resolvedDmCtg
                        : sectionEntry.dmCtg ??
                          (isEditable ? resolvedDmCtg : filled?.dmCtg ?? "");

                    const polDropdownOptions = polDropdownOptionsForDmCtg(
                      polRates ?? [],
                      resolvedDmCtg
                    );

                    const polDropdownValue =
                      sectionEntry.polSp ??
                      sectionEntry.dmCtg ??
                      resolvedDmCtg;

                    const lookupRates = buildCategoryRates(
                      effectiveDmCtg,
                      p.custType
                    );

                    const polSectionRates: CategoryRates =
                      mode === "completed" &&
                      isEditable &&
                      user.role === "POL" &&
                      s === "POL"
                        ? {
                            polRate: p.polRate,
                            prpRate: p.prpRate,
                          }
                        : s === "POL" && isEditable && user.role === "POL"
                        ? {
                            polRate: sectionEntry.polRate ?? lookupRates.polRate,
                            prpRate: sectionEntry.prpRate ?? lookupRates.prpRate,
                          }
                        : s === "POL" && !isEditable
                        ? {
                            polRate: sectionEntry.polRate,
                            prpRate: sectionEntry.prpRate,
                          }
                        : s === "MANAGER" &&
                          isEditable &&
                          user.role === "MANAGER"
                        ? {
                            polRate: sectionEntry.polRate ?? lookupRates.polRate,
                            prpRate: sectionEntry.prpRate ?? lookupRates.prpRate,
                          }
                        : lookupRates;

                    const useDesignWiseDifficulty =
                      ((user.role === "FIL" && s === "FIL") ||
                        (user.role === "MANAGER" &&
                          s === "MANAGER" &&
                          isEditable)) &&
                      (designWiseDifficulties?.length ?? 0) > 0;

                    const filDifficultyOptions = useDesignWiseDifficulty
                      ? designDifficultiesForDmCtg(
                          designDifficultiesByDmCtg,
                          resolvedDmCtg
                        )
                      : apiDifficultyCodes;

                    const defaultFilDifficulty = useDesignWiseDifficulty
                      ? resolveDefaultDesignDifficulty(
                          filDifficultyOptions,
                          sectionEntry.difficulty ??
                            filled?.difficulty ??
                            p.difficulty
                        )
                      : undefined;

                    const usePolDualDropdown =
                      mode === "pending" &&
                      isEditable &&
                      ((user.role === "POL" && s === "POL") ||
                        (user.role === "MANAGER" && s === "MANAGER"));

                    return (
                      <SectionCells
                        key={s}
                        section={s}
                        editable={isEditable && mode === "pending"}
                        stageCompleted={
                          mode === "completed" && isEditable
                        }
                        entry={sectionEntry}
                        onPatch={(patch) => onChange(p.id, s, patch)}
                        difficultyCodes={
                          s === "POL"
                            ? localDifficultyCodes
                            : filDifficultyOptions
                        }
                        defaultDifficulty={defaultFilDifficulty}
                        getFilRate={buildFilRateLookup(p.custType)}
                        categoryRates={polSectionRates}
                        polCategoryCodes={polCategoryCodes}
                        dmCtgValue={effectiveDmCtg}
                        polDropdownOptions={polDropdownOptions}
                        polDropdownValue={polDropdownValue}
                        usePolDualDropdown={usePolDualDropdown}
                        getCategoryRates={(dmCtg) =>
                          buildCategoryRates(dmCtg, p.custType)
                        }
                        resolveDmCtgPatch={(dmCtg) =>
                          patchFromDmCtg(polRates ?? [], dmCtg, p.custType)
                        }
                        resolvePolSpPatch={(polSp) =>
                          patchFromPolSp(polRates ?? [], polSp, p.custType)
                        }
                        polRatesForLookup={polRates ?? []}
                        ratesEditable={
                          s === "POL" &&
                          isEditable &&
                          user.role === "POL" &&
                          mode === "pending"
                        }
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasMore ? (
        <div className="rate-entry__show-more">
          <button
            type="button"
            className="rate-entry__show-more-btn"
            onClick={handleShowMore}
          >
            Show {Math.min(PAGE_SIZE, remainingCount)} more
          </button>
          <span className="rate-entry__show-more-meta">
            {remainingCount} remaining
          </span>
        </div>
      ) : null}

      {showCheckboxes &&
      (user.role === "FIL" ||
        user.role === "POL" ||
        user.role === "MANAGER") ? (
        <div className="rate-entry__submit-bar">
          <div className="rate-entry__submit-info">
            {submittableProducts.length === 0 ? (
              <span className="rate-entry__submit-hint">
                {selectedCount === 0
                  ? "Check at least one row to submit."
                  : user.role === "POL"
                  ? "Selected rows need valid POL and PRP rates before submitting."
                  : "Selected rows need a difficulty before submitting."}
              </span>
            ) : (
              <span className="rate-entry__submit-hint">
                Ready to submit{" "}
                <strong>{submittableProducts.length}</strong> checked{" "}
                {submittableProducts.length === 1 ? "row" : "rows"}.
              </span>
            )}
            {submitSummary ? (
              <span
                className={`rate-entry__submit-summary${
                  submitSummary.failed > 0
                    ? " rate-entry__submit-summary--mixed"
                    : " rate-entry__submit-summary--ok"
                }`}
              >
                Saved {submitSummary.done} of {submitSummary.total}
                {submitSummary.failed > 0
                  ? ` · ${submitSummary.failed} failed`
                  : ""}
                .
              </span>
            ) : null}
          </div>
          <div className="rate-entry__submit-actions">
            {isSuperManager ? (
              <button
                type="button"
                className="rate-entry__export-btn"
                onClick={handleExportExcel}
                disabled={displayProducts.length === 0}
              >
                Export Excel
              </button>
            ) : null}
            <button
              type="button"
              className="rate-entry__submit-btn"
              onClick={handleSubmit}
              disabled={submitting || submittableProducts.length === 0}
            >
              {submitting
                ? "Submitting…"
                : user.role === "FIL"
                ? "Submit FIL rates"
                : user.role === "POL"
                ? "Submit POL rates"
                : "Submit Manager approvals"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface RowStatusBadgeProps {
  status: RowSubmitState;
  message?: string;
}

function RowStatusBadge({ status, message }: RowStatusBadgeProps) {
  const label =
    status === "submitting"
      ? "Sending…"
      : status === "done"
      ? "Saved"
      : "Failed";
  return (
    <span
      className={`rate-entry__row-badge rate-entry__row-badge--${status}`}
      title={message ?? label}
    >
      {label}
    </span>
  );
}

function renderSectionHeaders(section: RateRole) {
  const className = `rate-entry__th rate-entry__th--${section.toLowerCase()}`;
  if (section === "FIL") {
    return (
      <>
        <th className={className}>Difficulty</th>
        <th className={className}>FIL Rate</th>
      </>
    );
  }
  if (section === "POL") {
    return (
      <>
        <th className={className}>DmCtg</th>
        <th className={className}>POL Rate</th>
        <th className={className}>PRP Rate</th>
      </>
    );
  }
  return (
    <>
      <th className={className}>Difficulty</th>
      <th className={className}>FIL Rate</th>
      <th className={className}>DmCtg</th>
      <th className={className}>POL Rate</th>
      <th className={className}>PRP Rate</th>
    </>
  );
}

interface SectionCellsProps {
  section: RateRole;
  editable: boolean;
  stageCompleted?: boolean;
  entry: RateEntry;
  onPatch: (patch: Partial<RateEntry>) => void;
  difficultyCodes: string[];
  defaultDifficulty?: string;
  getFilRate: FilRateLookup;
  categoryRates: CategoryRates;
  polCategoryCodes: string[];
  dmCtgValue: string;
  polDropdownOptions?: string[];
  polDropdownValue?: string;
  usePolDualDropdown?: boolean;
  getCategoryRates?: (dmCtg: string) => CategoryRates;
  resolveDmCtgPatch?: (dmCtg: string) => Partial<RateEntry>;
  resolvePolSpPatch?: (polSp: string) => Partial<RateEntry>;
  polRatesForLookup?: PolRate[];
  ratesEditable?: boolean;
}

function SectionCells({
  section,
  editable,
  stageCompleted = false,
  entry,
  onPatch,
  difficultyCodes,
  defaultDifficulty,
  getFilRate,
  categoryRates,
  polCategoryCodes,
  dmCtgValue,
  polDropdownOptions,
  polDropdownValue,
  usePolDualDropdown = false,
  getCategoryRates,
  resolveDmCtgPatch,
  resolvePolSpPatch,
  polRatesForLookup,
  ratesEditable = false,
}: SectionCellsProps) {
  const tdClass = `rate-entry__td rate-entry__td--${section.toLowerCase()}`;

  if (section === "FIL") {
    const effectiveDifficulty = entry.difficulty ?? defaultDifficulty;
    const effectiveFilRate =
      entry.filRate ??
      (effectiveDifficulty ? getFilRate(effectiveDifficulty) : undefined);
    const isFilSpCode = effectiveDifficulty?.endsWith("SP") ?? false;
    const defaultFilRate = effectiveDifficulty ? getFilRate(effectiveDifficulty) : undefined;

    return (
      <>
        <td className={tdClass}>
          {stageCompleted ? (
            <CompletedLabel />
          ) : (
            <DifficultyDropdown
              codes={difficultyCodes}
              value={effectiveDifficulty}
              disabled={!editable}
              onSelect={(code) => {
                const filRate = code === undefined ? undefined : (code?.endsWith("SP") ? 0 : getFilRate(code));
                onPatch({ difficulty: code, filRate });
              }}
            />
          )}
        </td>
        {editable && isFilSpCode ? (
          <EditableRateCell
            tdClass={tdClass}
            value={entry.filRate}
            suggested={0}
            onChange={(rate) => onPatch({ filRate: rate })}
          />
        ) : (
          <DerivedRateCell tdClass={tdClass} value={effectiveFilRate} />
        )}
      </>
    );
  }

  if (section === "POL") {
    const dropdownCodes = usePolDualDropdown
      ? (polDropdownOptions ?? [])
      : dmCtgValue && !polCategoryCodes.includes(dmCtgValue)
      ? [dmCtgValue, ...polCategoryCodes]
      : polCategoryCodes;

    const dropdownValue = usePolDualDropdown
      ? polDropdownValue ?? dmCtgValue
      : dmCtgValue;

    const handleDropdownSelect = (code: string | undefined) => {
      if (!code) {
        onPatch(
          usePolDualDropdown
            ? { polSp: undefined, dmCtg: undefined }
            : { dmCtg: undefined }
        );
        return;
      }
      // Build the patch to apply for this selection. If the special
      // "POL_CTG" option is chosen, ensure editable POL/PRP inputs start at 0.
      let patch: Partial<RateEntry>;
      if (
        ratesEditable &&
        usePolDualDropdown &&
        resolvePolSpPatch &&
        resolveDmCtgPatch &&
        polRatesForLookup
      ) {
        patch = isPolSpCode(polRatesForLookup, code)
          ? resolvePolSpPatch(code)
          : resolveDmCtgPatch(code);
      } else if (ratesEditable && getCategoryRates && code) {
        const rates = getCategoryRates(code);
        patch = {
          dmCtg: code,
          polRate: rates.polRate,
          prpRate: rates.prpRate,
        };
      } else {
        patch = usePolDualDropdown ? { polSp: code } : { dmCtg: code };
      }

      if (code && isPolSpCode(polRatesForLookup ?? [], code)) {
        patch = { ...patch, polRate: 0, prpRate: 0 };
      }

      onPatch(patch);
    };

    return (
      <>
        <td className={tdClass}>
          {stageCompleted ? (
            <CompletedLabel />
          ) : (
            <DifficultyDropdown
              codes={dropdownCodes}
              value={dropdownValue || undefined}
              disabled={!editable}
              onSelect={handleDropdownSelect}
            />
          )}
        </td>
        {ratesEditable && dropdownValue && isPolSpCode(polRatesForLookup ?? [], dropdownValue) ? (
          <>
            <EditableRateCell
              tdClass={tdClass}
              value={entry.polRate}
              suggested={categoryRates.polRate}
              onChange={(rate) => onPatch({ polRate: rate })}
            />
            <EditableRateCell
              tdClass={tdClass}
              value={entry.prpRate}
              suggested={categoryRates.prpRate}
              onChange={(rate) => onPatch({ prpRate: rate })}
            />
          </>
        ) : (
          <>
            <DerivedRateCell tdClass={tdClass} value={categoryRates.polRate} />
            <DerivedRateCell tdClass={tdClass} value={categoryRates.prpRate} />
          </>
        )}
      </>
    );
  }

  const dropdownCodes =
    usePolDualDropdown
      ? (polDropdownOptions ?? [])
      : dmCtgValue && !polCategoryCodes.includes(dmCtgValue)
      ? [dmCtgValue, ...polCategoryCodes]
      : polCategoryCodes;

  const dropdownValue = usePolDualDropdown
    ? polDropdownValue ?? dmCtgValue
    : dmCtgValue;

  const handleManagerDmCtgSelect = (code: string | undefined) => {
    if (!code) {
      onPatch(
        usePolDualDropdown
          ? { polSp: undefined, dmCtg: undefined }
          : { dmCtg: undefined }
      );
      return;
    }
    let patch: Partial<RateEntry>;
    if (
      editable &&
      usePolDualDropdown &&
      resolvePolSpPatch &&
      resolveDmCtgPatch &&
      polRatesForLookup
    ) {
      patch = isPolSpCode(polRatesForLookup, code)
        ? resolvePolSpPatch(code)
        : resolveDmCtgPatch(code);
    } else if (editable && getCategoryRates && code) {
      const rates = getCategoryRates(code);
      patch = {
        dmCtg: code,
        polRate: rates.polRate,
        prpRate: rates.prpRate,
      };
    } else {
      patch = usePolDualDropdown ? { polSp: code } : { dmCtg: code };
    }

if (code && isPolSpCode(polRatesForLookup ?? [], code)) {
      patch = { ...patch, polRate: 0, prpRate: 0 };
    }

    onPatch(patch);
  };

  const effectiveDifficulty = entry.difficulty ?? defaultDifficulty;
  const effectiveFilRate =
    entry.filRate ??
    (effectiveDifficulty ? getFilRate(effectiveDifficulty) : undefined);

  const isCurrentlyPolSp = dropdownValue && isPolSpCode(polRatesForLookup ?? [], dropdownValue);

  return (
    <>
      <td className={tdClass}>
        <DifficultyDropdown
          codes={difficultyCodes}
          value={effectiveDifficulty}
          disabled={!editable}
          onSelect={(code) => {
            const filRate = code === undefined ? undefined : getFilRate(code);
            onPatch({ difficulty: code, filRate });
          }}
        />
      </td>
      <td className={`${tdClass} rate-entry__td--num`}>
        {effectiveFilRate !== undefined ? (
          inr(effectiveFilRate)
        ) : (
          <span className="rate-entry__placeholder">—</span>
        )}
      </td>
      <td className={tdClass}>
        <DifficultyDropdown
          codes={dropdownCodes}
          value={dropdownValue || undefined}
          disabled={!editable}
          onSelect={handleManagerDmCtgSelect}
        />
      </td>
      {editable && isCurrentlyPolSp ? (
        <>
          <EditableRateCell
            tdClass={tdClass}
            value={entry.polRate}
            suggested={categoryRates.polRate}
            onChange={(rate) => onPatch({ polRate: rate })}
          />
          <EditableRateCell
            tdClass={tdClass}
            value={entry.prpRate}
            suggested={categoryRates.prpRate}
            onChange={(rate) => onPatch({ prpRate: rate })}
          />
        </>
      ) : (
        <>
          <DerivedRateCell tdClass={tdClass} value={categoryRates.polRate} />
          <DerivedRateCell tdClass={tdClass} value={categoryRates.prpRate} />
        </>
      )}
    </>
  );
}

interface DerivedRateCellProps {
  tdClass: string;
  value: number | undefined;
}

function CompletedLabel() {
  return <span className="rate-entry__completed">Completed</span>;
}

function DerivedRateCell({ tdClass, value }: DerivedRateCellProps) {
  return (
    <td className={`${tdClass} rate-entry__td--num`}>
      {value !== undefined ? (
        inr(value)
      ) : (
        <span className="rate-entry__placeholder">—</span>
      )}
    </td>
  );
}

interface EditableRateCellProps {
  tdClass: string;
  value: number | undefined;
  suggested?: number;
  onChange: (value: number | undefined) => void;
}

function EditableRateCell({
  tdClass,
  value,
  suggested,
  onChange,
}: EditableRateCellProps) {
  const display =
    value !== undefined ? String(value) : suggested !== undefined ? String(suggested) : "0";

  return (
    <td className={`${tdClass} rate-entry__td--num`}>
      <input
        type="number"
        className="rate-entry__rate-input"
        step="0.01"
        min="0"
        inputMode="decimal"
        value={display}
        placeholder="—"
        aria-label="Rate value"
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (raw === "") {
            onChange(undefined);
            return;
          }
          const parsed = Number.parseFloat(raw);
          onChange(Number.isFinite(parsed) ? parsed : undefined);
        }}
      />
    </td>
  );
}

interface DifficultyDropdownProps {
  codes: string[];
  value?: string;
  disabled?: boolean;
  onSelect: (code: string | undefined) => void;
}

function DifficultyDropdown({ codes, value, disabled, onSelect }: DifficultyDropdownProps) {
  if (disabled) {
    return value ? (
      <span className="rate-entry__readonly">{value}</span>
    ) : (
      <span className="rate-entry__placeholder">—</span>
    );
  }
  return (
    <select
      className="rate-entry__select"
      value={value ?? ""}
      onChange={(e) => onSelect(e.target.value || undefined)}
    >
      <option value="">Select…</option>
      {codes.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

