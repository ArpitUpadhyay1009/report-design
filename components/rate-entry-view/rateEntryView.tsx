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
  type PolRate,
  type PolRateResponse,
  type SubmittedFilRate,
  type SubmittedPolRate,
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
  submittedFilRates?: SubmittedFilRate[];
  submittedPolRates?: SubmittedPolRate[];
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

export default function RateEntryView({
  products,
  user,
  entries,
  onChange,
  difficultyOptions,
  difficultyRates,
  polRates,
  submittedFilRates,
  submittedPolRates,
}: RateEntryViewProps) {
  const sections = sectionsForRole(user.role);
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

  // Manager-only: design-id -> submitted FIL/POL row, used to fill the
  // read-only FIL Entry / POL Entry sections.
  const submittedFilByDesign = useMemo(() => {
    const map = new Map<string, SubmittedFilRate>();
    (submittedFilRates ?? []).forEach((r) => map.set(r.designId, r));
    return map;
  }, [submittedFilRates]);

  const submittedPolByDesign = useMemo(() => {
    const map = new Map<string, SubmittedPolRate>();
    (submittedPolRates ?? []).forEach((r) => map.set(r.designId, r));
    return map;
  }, [submittedPolRates]);

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
  const [rowStatuses, setRowStatuses] = useState<
    Record<string, RowSubmitState>
  >({});
  const [rowMessages, setRowMessages] = useState<Record<string, string>>({});
  const [submitSummary, setSubmitSummary] = useState<SubmitSummary | null>(
    null
  );

  const submittableProducts = useMemo(() => {
    if (user.role === "FIL") {
      return products.filter((p) => {
        const e = entries[p.id]?.FIL;
        return (
          !!e &&
          typeof e.difficulty === "string" &&
          e.difficulty.length > 0 &&
          typeof e.filRate === "number" &&
          Number.isFinite(e.filRate)
        );
      });
    }
    if (user.role === "POL") {
      return products.filter((p) => {
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
      });
    }
    if (user.role === "MANAGER") {
      return products.filter((p) => {
        const sectionEntry = entries[p.id]?.MANAGER ?? {};
        // Manager must have picked a difficulty (which auto-fills filRate via
        // the FIL-rate lookup; we still guard both fields).
        if (
          typeof sectionEntry.difficulty !== "string" ||
          sectionEntry.difficulty.length === 0 ||
          typeof sectionEntry.filRate !== "number" ||
          !Number.isFinite(sectionEntry.filRate)
        ) {
          return false;
        }
        // POL/PRP/DHAGA come from polCtg (or manager's DmCtg override) ×
        // custType, exactly like the POL section.
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
      });
    }
    return [] as Product[];
  }, [user.role, products, entries, polRatesByCategory]);

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
              ? "Review what FIL and POL filled, then enter your final approved rates."
              : "Pick from the dropdowns below — rates fill in automatically."}
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
              <th colSpan={3} className="rate-entry__group rate-entry__group--design">
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
              <th className="rate-entry__th rate-entry__th--image">Image</th>
              <th className="rate-entry__th">Design</th>
              <th className="rate-entry__th">Manager</th>
              {sections.map((s) => (
                <Fragment key={s}>{renderSectionHeaders(s)}</Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const productEntries = entries[p.id] ?? {};
              const rowStatus = rowStatuses[p.id];
              const rowMessage = rowMessages[p.id];
              const rowClass = rowStatus
                ? `rate-entry__row rate-entry__row--${rowStatus}`
                : "rate-entry__row";
              return (
                <tr key={p.id} className={rowClass}>
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

                    // Manager's read-only FIL / POL sections fall back to what
                    // those users have actually submitted, fetched from the
                    // by-user endpoints.
                    let sectionEntry: RateEntry = ownEntry;
                    if (
                      user.role === "MANAGER" &&
                      !isEditable &&
                      s === "FIL"
                    ) {
                      const submitted = submittedFilByDesign.get(p.designCode);
                      if (submitted) {
                        sectionEntry = {
                          ...ownEntry,
                          difficulty:
                            ownEntry.difficulty ?? submitted.difficulty,
                          filRate: ownEntry.filRate ?? submitted.filRate,
                        };
                      }
                    } else if (
                      user.role === "MANAGER" &&
                      !isEditable &&
                      s === "POL"
                    ) {
                      const submitted = submittedPolByDesign.get(p.designCode);
                      if (submitted) {
                        sectionEntry = {
                          ...ownEntry,
                          polRate: ownEntry.polRate ?? submitted.polRate,
                          prpRate: ownEntry.prpRate ?? submitted.prpRate,
                          dhagaRate:
                            ownEntry.dhagaRate ?? submitted.dhagaRate,
                        };
                      }
                    }

                    // POL section in manager's read-only view stays empty until
                    // real POL data arrives — don't pre-fill from the design.
                    const effectiveDmCtg =
                      s === "FIL"
                        ? p.polCtg
                        : sectionEntry.dmCtg ??
                          (isEditable ? p.polCtg : "");

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
                {user.role === "POL"
                  ? "Pick a DmCtg for at least one row to enable submission."
                  : "Pick a difficulty for at least one row to enable submission."}
              </span>
            ) : (
              <span className="rate-entry__submit-hint">
                Ready to submit{" "}
                <strong>{submittableProducts.length}</strong>{" "}
                {submittableProducts.length === 1 ? "rate" : "rates"}.
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

