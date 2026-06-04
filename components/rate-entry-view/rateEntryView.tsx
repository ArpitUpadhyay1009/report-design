"use client";

import { Fragment } from "react";
import {
  difficulties,
  polRates,
  prpRates,
  dhagaRates,
} from "@/constants/rate";
import ImageBox from "@/components/image-box/imageBox";
import type { Product } from "@/types/product";
import type { Profile, Role } from "@/types/profile";
import type { RateEntry, RateEntries, RateRole } from "@/types/rateEntry";
import "./rateEntryView.css";

type RateTable = Record<string, number>;

interface RateEntryViewProps {
  products: Product[];
  user: Profile;
  entries: RateEntries;
  onChange: (productId: string, role: RateRole, patch: Partial<RateEntry>) => void;
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
                  {sections.map((s) => (
                    <SectionCells
                      key={s}
                      section={s}
                      editable={s === editableSection}
                      entry={productEntries[s] ?? {}}
                      onPatch={(patch) => onChange(p.id, s, patch)}
                    />
                  ))}
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
        <th className={className}>Difficulty</th>
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
}

function SectionCells({ section, editable, entry, onPatch }: SectionCellsProps) {
  const tdClass = `rate-entry__td rate-entry__td--${section.toLowerCase()}`;

  if (section === "FIL") {
    return (
      <>
        <td className={tdClass}>
          <DifficultyDropdown
            value={entry.difficulty}
            disabled={!editable}
            onSelect={(code) => {
              const filRate =
                code === undefined
                  ? undefined
                  : (difficulties as RateTable)[code];
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
    return (
      <>
        <td className={tdClass}>
          <DifficultyDropdown
            value={entry.difficulty}
            disabled={!editable}
            onSelect={(code) => onPatch({ difficulty: code })}
          />
        </td>
        <CombinedRateCell
          tdClass={tdClass}
          editable={editable}
          options={polRates as RateTable}
          codeKey="polCode"
          rateKey="polRate"
          entry={entry}
          onPatch={onPatch}
        />
        <CombinedRateCell
          tdClass={tdClass}
          editable={editable}
          options={prpRates as RateTable}
          codeKey="prpCode"
          rateKey="prpRate"
          entry={entry}
          onPatch={onPatch}
        />
        <CombinedRateCell
          tdClass={tdClass}
          editable={editable}
          options={dhagaRates as RateTable}
          codeKey="dhagaCode"
          rateKey="dhagaRate"
          entry={entry}
          onPatch={onPatch}
        />
      </>
    );
  }

  return (
    <>
      <td className={tdClass}>
        <DifficultyDropdown
          value={entry.difficulty}
          disabled={!editable}
          onSelect={(code) => {
            const filRate =
              code === undefined
                ? undefined
                : (difficulties as RateTable)[code];
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
        options={polRates as RateTable}
        codeKey="polCode"
        rateKey="polRate"
        entry={entry}
        onPatch={onPatch}
      />
      <CombinedRateCell
        tdClass={tdClass}
        editable={editable}
        options={prpRates as RateTable}
        codeKey="prpCode"
        rateKey="prpRate"
        entry={entry}
        onPatch={onPatch}
      />
      <CombinedRateCell
        tdClass={tdClass}
        editable={editable}
        options={dhagaRates as RateTable}
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

interface DifficultyDropdownProps {
  value?: string;
  disabled?: boolean;
  onSelect: (code: string | undefined) => void;
}

function DifficultyDropdown({ value, disabled, onSelect }: DifficultyDropdownProps) {
  const codes = Object.keys(difficulties);
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
