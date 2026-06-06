"use client";

import { Fragment, useMemo } from "react";
import {
  difficulties,
  polRates as polTypeRates,
  prpRates as prpTypeRates,
  dhagaRates as dhagaTypeRates,
} from "@/constants/rate";
import ImageBox from "@/components/image-box/imageBox";
import type { DifficultyRate, PolRate } from "@/services/api";
import type { Product } from "@/types/product";
import type { Profile, Role } from "@/types/profile";
import type { RateEntry, RateEntries, RateRole } from "@/types/rateEntry";
import "./rateEntryView.css";

type RateTable = Record<string, number>;
type FilRateLookup = (code: string) => number | undefined;

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
  MANAGER: 5,
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
  const filDifficultyCodes =
    user.role === "FIL" &&
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
              return (
                <tr key={p.id} className="rate-entry__row">
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
                    <div className="rate-entry__design">{p.designCode}</div>
                    <div className="rate-entry__sub">{p.custCode}</div>
                  </td>
                  <td className="rate-entry__td">
                    <div className="rate-entry__manager">{p.managerShort}</div>
                  </td>
                  {sections.map((s) => {
                    const sectionEntry = productEntries[s] ?? {};
                    const effectiveDmCtg =
                      s === "POL" ? sectionEntry.dmCtg ?? p.polCtg : p.polCtg;
                    return (
                      <SectionCells
                        key={s}
                        section={s}
                        editable={s === editableSection}
                        entry={sectionEntry}
                        onPatch={(patch) => onChange(p.id, s, patch)}
                        difficultyCodes={
                          s === "FIL" ? filDifficultyCodes : localDifficultyCodes
                        }
                        getFilRate={buildFilRateLookup(p.custType)}
                        categoryRates={buildCategoryRates(
                          effectiveDmCtg,
                          p.custType
                        )}
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
    </div>
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
      <CombinedRateCell
        tdClass={tdClass}
        editable={editable}
        options={polTypeRates as RateTable}
        codeKey="polCode"
        rateKey="polRate"
        entry={entry}
        onPatch={onPatch}
      />
      <CombinedRateCell
        tdClass={tdClass}
        editable={editable}
        options={prpTypeRates as RateTable}
        codeKey="prpCode"
        rateKey="prpRate"
        entry={entry}
        onPatch={onPatch}
      />
      <CombinedRateCell
        tdClass={tdClass}
        editable={editable}
        options={dhagaTypeRates as RateTable}
        codeKey="dhagaCode"
        rateKey="dhagaRate"
        entry={entry}
        onPatch={onPatch}
      />
    </>
  );
}

interface CombinedRateCellProps {
  tdClass: string;
  editable: boolean;
  options: RateTable;
  codeKey: keyof RateEntry;
  rateKey: keyof RateEntry;
  entry: RateEntry;
  onPatch: (patch: Partial<RateEntry>) => void;
}

function CombinedRateCell({
  tdClass,
  editable,
  options,
  codeKey,
  rateKey,
  entry,
  onPatch,
}: CombinedRateCellProps) {
  const code = entry[codeKey] as string | undefined;
  const rate = entry[rateKey] as number | undefined;

  return (
    <td className={tdClass}>
      <div className="rate-entry__combo">
        <RateDropdown
          options={options}
          value={code}
          disabled={!editable}
          onSelect={(c) => {
            const next = c === undefined ? undefined : options[c];
            onPatch({
              [codeKey]: c,
              [rateKey]: next,
            } as Partial<RateEntry>);
          }}
        />
        <span className="rate-entry__combo-rate">
          {rate !== undefined ? (
            inr(rate)
          ) : (
            <span className="rate-entry__placeholder">—</span>
          )}
        </span>
      </div>
    </td>
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

interface RateDropdownProps {
  options: RateTable;
  value?: string;
  disabled?: boolean;
  onSelect: (code: string | undefined) => void;
}

function RateDropdown({ options, value, disabled, onSelect }: RateDropdownProps) {
  const codes = Object.keys(options);
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
