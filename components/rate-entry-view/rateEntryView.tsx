"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import { difficulties } from "@/constants/rate";
import ImageBox from "@/components/image-box/imageBox";
import {
  submitFilRate,
  submitManagerRate,
  submitPolRate,
  type DifficultyRate,
  type FilRateResponse,
  type ManagerRateResponse,
  type FilledRate,
  type PolRate,
  type PolRateResponse,
} from "@/services/api";
import type { Product } from "@/types/product";
import type { Profile, Role } from "@/types/profile";
import type { RateEntry, RateEntries, RateRole } from "@/types/rateEntry";
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
  dhagaRate?: number;
}

interface RateEntryViewProps {
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
  POL: 4,
  MANAGER: 6,
};

const custTone = (custType: Product["custType"]): "amber" | "violet" | "emerald" | "rose" => {
  if (custType === "O") return "amber";
  if (custType === "B") return "violet";
  if (custType === "S") return "emerald";
  return "rose";
};

/** Build a display row for manager rate entry from get-Filled-Rates. */
function productForFilledRate(filled: FilledRate, existing?: Product): Product {
  if (existing) return existing;
  return {
    id: `filled__${filled.designId}`,
    designCode: filled.designId,
    managerName: "—",
    managerShort: "—",
    custType: "O",
    numberOfParts: 0,
    manufacturer: "—",
    dep: "—",
    polCtg: filled.dmCtg ?? "—",
    difficulty: filled.difficulty,
    filRate: filled.filRate,
    polRate: filled.polRate,
    prpRate: filled.prpRate,
    dhagaRate: filled.dhagaRate,
    custCode: "—",
  };
}

export default function RateEntryView({
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
}: RateEntryViewProps) {
  const sections = sectionsForRole(user.role);

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

  // Manager rows come from get-Filled-Rates, not the date-filtered design
  // list. When a filled design also exists in `products`, we merge in the
  // richer card/table fields (image, manager, cust type, etc.).
  const displayProducts = useMemo(() => {
    if (user.role !== "MANAGER") return products;
    if (!filledRates?.length) return [];
    const productByDesign = new Map(
      products.map((p) => [p.designCode, p] as const)
    );
    return filledRates.map((filled) =>
      productForFilledRate(filled, productByDesign.get(filled.designId))
    );
  }, [user.role, products, filledRates]);
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
        dhagaRate: entry.normalDhaga ?? undefined,
      };
    }
    if (custType === "B") {
      return {
        polRate: entry.brandPol ?? undefined,
        prpRate: entry.brandPrp ?? undefined,
        dhagaRate: entry.brandDhaga ?? undefined,
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
      if (isStageCompleted(p.designCode)) return false;
      if (user.role === "FIL") {
        const e = entries[p.id]?.FIL;
        return (
          !!e &&
          typeof e.difficulty === "string" &&
          e.difficulty.length > 0 &&
          typeof e.filRate === "number" &&
          Number.isFinite(e.filRate)
        );
      }
      if (user.role === "POL") {
        const sectionEntry = entries[p.id]?.POL ?? {};
        const effectiveDmCtg = sectionEntry.dmCtg ?? p.polCtg;
        if (!effectiveDmCtg) return false;
        const polEntry = polRatesByCategory.get(effectiveDmCtg);
        if (!polEntry) return false;
        const isO = p.custType === "O";
        const isB = p.custType === "B";
        if (!isO && !isB) return false;
        const polRate = isO ? polEntry.normalPol : polEntry.brandPol;
        const prpRate = isO ? polEntry.normalPrp : polEntry.brandPrp;
        const dhagaRate = isO ? polEntry.normalDhaga : polEntry.brandDhaga;
        return (
          typeof polRate === "number" &&
          typeof prpRate === "number" &&
          typeof dhagaRate === "number"
        );
      }
      if (user.role === "MANAGER") {
        const sectionEntry = entries[p.id]?.MANAGER ?? {};
        if (
          typeof sectionEntry.difficulty !== "string" ||
          sectionEntry.difficulty.length === 0 ||
          typeof sectionEntry.filRate !== "number" ||
          !Number.isFinite(sectionEntry.filRate)
        ) {
          return false;
        }
        const effectiveDmCtg = sectionEntry.dmCtg ?? p.polCtg;
        if (!effectiveDmCtg) return false;
        const polEntry = polRatesByCategory.get(effectiveDmCtg);
        if (!polEntry) return false;
        const isO = p.custType === "O";
        const isB = p.custType === "B";
        if (!isO && !isB) return false;
        const polRate = isO ? polEntry.normalPol : polEntry.brandPol;
        const prpRate = isO ? polEntry.normalPrp : polEntry.brandPrp;
        const dhagaRate = isO ? polEntry.normalDhaga : polEntry.brandDhaga;
        return (
          typeof polRate === "number" &&
          typeof prpRate === "number" &&
          typeof dhagaRate === "number"
        );
      }
      return false;
    },
    [user.role, entries, polRatesByCategory, isStageCompleted]
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
        const e = entries[p.id]!.FIL!;
        const payload = {
          user_id: user.userId,
          design_id: p.designCode,
          difficulty: e.difficulty as string,
          fil_rate: e.filRate as number,
        };
        return { productId: p.id, run: () => submitFilRate(payload) };
      });
    } else if (user.role === "POL") {
      jobs = submittableProducts.map((p) => {
        const sectionEntry = entries[p.id]?.POL ?? {};
        const effectiveDmCtg = sectionEntry.dmCtg ?? p.polCtg;
        const polEntry = polRatesByCategory.get(effectiveDmCtg)!;
        const isO = p.custType === "O";
        const payload = {
          user_id: user.userId,
          design_id: p.designCode,
          pol_rate: (isO ? polEntry.normalPol : polEntry.brandPol) as number,
          prp_rate: (isO ? polEntry.normalPrp : polEntry.brandPrp) as number,
          dhaga_rate: (isO
            ? polEntry.normalDhaga
            : polEntry.brandDhaga) as number,
        };
        return { productId: p.id, run: () => submitPolRate(payload) };
      });
    } else if (user.role === "MANAGER") {
      jobs = submittableProducts.map((p) => {
        const sectionEntry = entries[p.id]?.MANAGER ?? {};
        const effectiveDmCtg = sectionEntry.dmCtg ?? p.polCtg;
        const polEntry = polRatesByCategory.get(effectiveDmCtg)!;
        const isO = p.custType === "O";
        const payload = {
          user_id: user.userId,
          design_id: p.designCode,
          difficulty: sectionEntry.difficulty as string,
          manager_fil_rate: sectionEntry.filRate as number,
          manager_pol_rate: (isO
            ? polEntry.normalPol
            : polEntry.brandPol) as number,
          manager_prp_rate: (isO
            ? polEntry.normalPrp
            : polEntry.brandPrp) as number,
          manager_dhaga_rate: (isO
            ? polEntry.normalDhaga
            : polEntry.brandDhaga) as number,
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
  ]);

  return (
    <div className="rate-entry">
      <div className="rate-entry__intro">
        <div>
          <h2 className="rate-entry__title">
            Rate entry &middot; <span>{user.role}</span>
          </h2>
          <p className="rate-entry__subtitle">
            {user.role === "MANAGER"
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
              <th colSpan={4} className="rate-entry__group rate-entry__group--design">
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
                    4 + sections.reduce((n, s) => n + colsPerSection[s], 0)
                  }
                  className="rate-entry__empty-row"
                >
                  {user.role === "MANAGER"
                    ? filledRates?.length
                      ? "Filled rates were loaded but none could be displayed. Try refreshing."
                      : "No designs are ready for manager review yet. FIL and POL must both be completed."
                    : "No designs to show."}
                </td>
              </tr>
            ) : null}
            {displayProducts.map((p) => {
              const productEntries = entries[p.id] ?? {};
              const rowStatus = rowStatuses[p.id];
              const rowMessage = rowMessages[p.id];
              const isSelected = selectedIds.has(p.id);
              const stageCompleted = isStageCompleted(p.designCode);
              const rowClass = [
                "rate-entry__row",
                rowStatus ? `rate-entry__row--${rowStatus}` : "",
                isSelected ? "rate-entry__row--selected" : "",
                stageCompleted ? "rate-entry__row--stage-completed" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <tr key={p.id} className={rowClass}>
                  <td className="rate-entry__td rate-entry__td--check">
                    <input
                      type="checkbox"
                      className="rate-entry__checkbox"
                      checked={isSelected}
                      onChange={(e) => toggleRow(p.id, e.target.checked)}
                      disabled={submitting || stageCompleted}
                      aria-label={`Select ${p.designCode} for submission`}
                    />
                  </td>
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
                          dhagaRate: filled.dhagaRate,
                        };
                      }
                    }

                    const effectiveDmCtg =
                      s === "FIL"
                        ? p.polCtg
                        : sectionEntry.dmCtg ??
                          (isEditable ? p.polCtg : filled?.dmCtg ?? "");

                    // For the POL section's three rate cells:
                    //   - editable (POL user / MANAGER): derive from DmCtg+custType.
                    //   - read-only (manager view): show whatever the POL user
                    //     actually submitted on this design (else "—").
                    const polSectionRates: CategoryRates =
                      s === "POL" && !isEditable
                        ? {
                            polRate: sectionEntry.polRate,
                            prpRate: sectionEntry.prpRate,
                            dhagaRate: sectionEntry.dhagaRate,
                          }
                        : buildCategoryRates(effectiveDmCtg, p.custType);

                    return (
                      <SectionCells
                        key={s}
                        section={s}
                        editable={isEditable}
                        stageCompleted={isEditable && stageCompleted}
                        entry={sectionEntry}
                        onPatch={(patch) => onChange(p.id, s, patch)}
                        difficultyCodes={
                          s === "POL" ? localDifficultyCodes : apiDifficultyCodes
                        }
                        getFilRate={buildFilRateLookup(p.custType)}
                        categoryRates={polSectionRates}
                        polCategoryCodes={polCategoryCodes}
                        dmCtgValue={effectiveDmCtg}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {user.role === "FIL" ||
      user.role === "POL" ||
      user.role === "MANAGER" ? (
        <div className="rate-entry__submit-bar">
          <div className="rate-entry__submit-info">
            {submittableProducts.length === 0 ? (
              <span className="rate-entry__submit-hint">
                {selectedCount === 0
                  ? "Check at least one row to submit."
                  : user.role === "POL"
                  ? "Selected rows need a valid DmCtg and rates before submitting."
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
        <th className={className}>DHAGA Rate</th>
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
      <th className={className}>DHAGA Rate</th>
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
  getFilRate: FilRateLookup;
  categoryRates: CategoryRates;
  polCategoryCodes: string[];
  dmCtgValue: string;
}

function SectionCells({
  section,
  editable,
  stageCompleted = false,
  entry,
  onPatch,
  difficultyCodes,
  getFilRate,
  categoryRates,
  polCategoryCodes,
  dmCtgValue,
}: SectionCellsProps) {
  const tdClass = `rate-entry__td rate-entry__td--${section.toLowerCase()}`;

  if (section === "FIL") {
    return (
      <>
        <td className={tdClass}>
          {stageCompleted ? (
            <CompletedLabel />
          ) : (
            <DifficultyDropdown
              codes={difficultyCodes}
              value={entry.difficulty}
              disabled={!editable}
              onSelect={(code) => {
                const filRate =
                  code === undefined ? undefined : getFilRate(code);
                onPatch({ difficulty: code, filRate });
              }}
            />
          )}
        </td>
        <td className={`${tdClass} rate-entry__td--num`}>
          {entry.filRate !== undefined ? inr(entry.filRate) : <span className="rate-entry__placeholder">—</span>}
        </td>
      </>
    );
  }

  if (section === "POL") {
    const dropdownCodes =
      dmCtgValue && !polCategoryCodes.includes(dmCtgValue)
        ? [dmCtgValue, ...polCategoryCodes]
        : polCategoryCodes;
    return (
      <>
        <td className={tdClass}>
          {stageCompleted ? (
            <CompletedLabel />
          ) : (
            <DifficultyDropdown
              codes={dropdownCodes}
              value={dmCtgValue}
              disabled={!editable}
              onSelect={(code) => onPatch({ dmCtg: code })}
            />
          )}
        </td>
        <DerivedRateCell tdClass={tdClass} value={categoryRates.polRate} />
        <DerivedRateCell tdClass={tdClass} value={categoryRates.prpRate} />
        <DerivedRateCell tdClass={tdClass} value={categoryRates.dhagaRate} />
      </>
    );
  }

  const dropdownCodes =
    dmCtgValue && !polCategoryCodes.includes(dmCtgValue)
      ? [dmCtgValue, ...polCategoryCodes]
      : polCategoryCodes;

  return (
    <>
      <td className={tdClass}>
        <DifficultyDropdown
          codes={difficultyCodes}
          value={entry.difficulty}
          disabled={!editable}
          onSelect={(code) => {
            const filRate = code === undefined ? undefined : getFilRate(code);
            onPatch({ difficulty: code, filRate });
          }}
        />
      </td>
      <td className={`${tdClass} rate-entry__td--num`}>
        {entry.filRate !== undefined ? inr(entry.filRate) : <span className="rate-entry__placeholder">—</span>}
      </td>
      <td className={tdClass}>
        <DifficultyDropdown
          codes={dropdownCodes}
          value={dmCtgValue}
          disabled={!editable}
          onSelect={(code) => onPatch({ dmCtg: code })}
        />
      </td>
      <DerivedRateCell tdClass={tdClass} value={categoryRates.polRate} />
      <DerivedRateCell tdClass={tdClass} value={categoryRates.prpRate} />
      <DerivedRateCell tdClass={tdClass} value={categoryRates.dhagaRate} />
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

