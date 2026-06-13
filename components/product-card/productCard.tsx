"use client";

import ImageBox from "@/components/image-box/imageBox";
import type { Product } from "@/types/product";
import { totalRate } from "@/types/product";
import type { Role } from "@/types/profile";
import "./productCard.css";

type Tone = "amber" | "rose" | "emerald" | "sky" | "violet";
type CustMeta = { label: string; tone: Tone };
type CardSubmitState = "idle" | "submitting" | "done" | "error";

const custTypeMeta: Record<string, CustMeta> = {
  O: { label: "Original", tone: "amber" },
  B: { label: "Bulk", tone: "violet" },
  S: { label: "Special", tone: "emerald" },
  P: { label: "Premium", tone: "rose" },
};

const custMetaFor = (custType: string): CustMeta =>
  custTypeMeta[custType] ?? { label: custType || "—", tone: "sky" };

const difficultyLabelMap: Record<string, string> = {
  E1: "Easy",
  E2: "Standard",
  E3: "Complex",
  E4: "Expert",
  M1: "Medium",
  D1: "Detailed",
  SP: "Special",
  TM1: "Tiny / Micro",
};

const difficultyMetaFor = (
  difficulty: string
): { label: string; level: number } => {
  if (!difficulty || difficulty === "—") return { label: "Unrated", level: 2 };
  const match = difficulty.match(/([A-Z]+\d*)$/);
  const suffix = match ? match[1] : "";
  const label = difficultyLabelMap[suffix] ?? difficulty;
  let level = 2;
  if (/E1$/.test(difficulty)) level = 1;
  else if (/E2$/.test(difficulty)) level = 2;
  else if (/E3$/.test(difficulty) || /M1$/.test(difficulty)) level = 3;
  else if (/E4$/.test(difficulty) || /SP$/.test(difficulty)) level = 4;
  return { label, level };
};

const inr = (n: number): string =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

export interface CardRateEntryProps {
  role: Role;
  difficultyOptions: string[];
  polDropdownOptions: string[];
  polCategoryCodes: string[];
  usePolDualDropdown: boolean;
  polRatesEditable: boolean;
  difficulty?: string;
  polDropdownValue: string;
  dmCtg: string;
  filRate?: number;
  polRate?: number;
  prpRate?: number;
  dhagaRate?: number;
  suggestedPolRate?: number;
  suggestedPrpRate?: number;
  suggestedDhagaRate?: number;
  onDifficultyChange: (code: string) => void;
  onPolOptionChange: (option: string) => void;
  onDmCtgChange: (dmCtg: string) => void;
  onPolRateChange: (rate: number | undefined) => void;
  onPrpRateChange: (rate: number | undefined) => void;
  onDhagaRateChange: (rate: number | undefined) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  submitState: CardSubmitState;
  submitMessage?: string;
}

interface ProductCardProps {
  product: Product;
  rateEntry?: CardRateEntryProps;
}

export default function ProductCard({ product, rateEntry }: ProductCardProps) {
  const cust = custMetaFor(product.custType);
  const diff = difficultyMetaFor(product.difficulty);
  const total = totalRate(product);

  const showFilField =
    rateEntry && (rateEntry.role === "FIL" || rateEntry.role === "MANAGER");
  const showPolField =
    rateEntry && (rateEntry.role === "POL" || rateEntry.role === "MANAGER");

  const submitLabel =
    rateEntry?.submitState === "submitting"
      ? "Submitting…"
      : rateEntry?.submitState === "done"
      ? "Saved"
      : rateEntry?.submitState === "error"
      ? "Retry"
      : rateEntry?.role === "FIL"
      ? "Submit FIL rate"
      : rateEntry?.role === "POL"
      ? "Submit POL rate"
      : "Submit approval";

  return (
    <article
      className={`product-card${
        rateEntry?.submitState === "done"
          ? " product-card--saved"
          : rateEntry?.submitState === "error"
          ? " product-card--error"
          : ""
      }`}
    >
      <header className="product-card__top">
        <div className="product-card__image">
          <ImageBox
            designCode={product.designCode}
            tone={cust.tone}
            size="lg"
            imageUrl={product.imageUrl}
          />
        </div>

        <span
          className={`product-card__cust-badge product-card__cust-badge--${cust.tone}`}
          title={`Customer type: ${cust.label}`}
        >
          {product.custType}
          <em>{cust.label}</em>
        </span>
      </header>

      <div className="product-card__body">
        <div className="product-card__title-row">
          <h3 className="product-card__design">{product.designCode}</h3>
          <span className="product-card__parts" title="Number of parts">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
            {product.numberOfParts} parts
          </span>
        </div>

        <p className="product-card__manager">
          <span className="product-card__manager-dot" />
          {product.managerName}
          <em>({product.managerShort})</em>
        </p>

        <div className="product-card__chips">
          <span className="product-card__chip" title="Manufacturer">
            <em>MFR</em>
            {product.manufacturer}
          </span>
          <span className="product-card__chip" title="Department">
            <em>DEP</em>
            {product.dep}
          </span>
          <span className="product-card__chip" title="Polish category">
            <em>POL</em>
            {product.polCtg}
          </span>
          <span
            className={`product-card__chip product-card__chip--diff product-card__chip--lvl-${diff.level}`}
            title={`Difficulty: ${diff.label}`}
          >
            <em>DIFF</em>
            {diff.label}
          </span>
        </div>

        {rateEntry ? (
          <div className="product-card__entry">
            <div className="product-card__entry-head">
              <span className="product-card__entry-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    d="M12 3v18M5 8h11a3 3 0 010 6H7m13 4l-3-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span>Quick rate entry</span>
            </div>

            <div className="product-card__entry-fields">
              {showFilField ? (
                <label className="product-card__entry-field">
                  <span>Difficulty</span>
                  <select
                    className="product-card__select"
                    value={rateEntry.difficulty ?? ""}
                    disabled={rateEntry.submitState === "submitting"}
                    onChange={(e) =>
                      rateEntry.onDifficultyChange(e.target.value)
                    }
                  >
                    <option value="">Select difficulty…</option>
                    {rateEntry.difficultyOptions.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                  {rateEntry.filRate !== undefined ? (
                    <span className="product-card__entry-derived">
                      FIL <strong>₹ {inr(rateEntry.filRate)}</strong>
                    </span>
                  ) : null}
                </label>
              ) : null}

              {showPolField ? (
                <label className="product-card__entry-field">
                  <span>DmCtg</span>
                  <select
                    className="product-card__select"
                    value={
                      rateEntry.usePolDualDropdown
                        ? rateEntry.polDropdownValue
                        : rateEntry.dmCtg
                    }
                    disabled={rateEntry.submitState === "submitting"}
                    onChange={(e) =>
                      rateEntry.usePolDualDropdown
                        ? rateEntry.onPolOptionChange(e.target.value)
                        : rateEntry.onDmCtgChange(e.target.value)
                    }
                  >
                    <option value="">Select category…</option>
                    {(rateEntry.usePolDualDropdown
                      ? rateEntry.polDropdownValue &&
                        !rateEntry.polDropdownOptions.includes(
                          rateEntry.polDropdownValue
                        )
                        ? [
                            rateEntry.polDropdownValue,
                            ...rateEntry.polDropdownOptions,
                          ]
                        : rateEntry.polDropdownOptions
                      : rateEntry.dmCtg &&
                        !rateEntry.polCategoryCodes.includes(rateEntry.dmCtg)
                      ? [rateEntry.dmCtg, ...rateEntry.polCategoryCodes]
                      : rateEntry.polCategoryCodes
                    ).map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            {showPolField &&
            (rateEntry.polRatesEditable ||
              (rateEntry.polRate !== undefined &&
                rateEntry.prpRate !== undefined &&
                rateEntry.dhagaRate !== undefined)) ? (
              <div
                className={`product-card__entry-rates${
                  rateEntry.polRatesEditable
                    ? " product-card__entry-rates--editable"
                    : ""
                }`}
              >
                {rateEntry.polRatesEditable ? (
                  <>
                    <CardRateInput
                      label="POL"
                      value={rateEntry.polRate}
                      suggested={rateEntry.suggestedPolRate}
                      tone="sky"
                      disabled={rateEntry.submitState === "submitting"}
                      onChange={rateEntry.onPolRateChange}
                    />
                    <CardRateInput
                      label="PRP"
                      value={rateEntry.prpRate}
                      suggested={rateEntry.suggestedPrpRate}
                      tone="amber"
                      disabled={rateEntry.submitState === "submitting"}
                      onChange={rateEntry.onPrpRateChange}
                    />
                    <CardRateInput
                      label="DHAGA"
                      value={rateEntry.dhagaRate}
                      suggested={rateEntry.suggestedDhagaRate}
                      tone="emerald"
                      disabled={rateEntry.submitState === "submitting"}
                      onChange={rateEntry.onDhagaRateChange}
                    />
                  </>
                ) : (
                  <>
                    <EntryRatePill
                      label="POL"
                      value={rateEntry.polRate!}
                      tone="sky"
                    />
                    <EntryRatePill
                      label="PRP"
                      value={rateEntry.prpRate!}
                      tone="amber"
                    />
                    <EntryRatePill
                      label="DHAGA"
                      value={rateEntry.dhagaRate!}
                      tone="emerald"
                    />
                  </>
                )}
              </div>
            ) : null}

            {rateEntry.submitMessage ? (
              <p
                className={`product-card__entry-feedback product-card__entry-feedback--${rateEntry.submitState}`}
                role="status"
              >
                {rateEntry.submitMessage}
              </p>
            ) : null}

            <button
              type="button"
              className="product-card__submit"
              disabled={
                !rateEntry.canSubmit ||
                rateEntry.submitState === "submitting" ||
                rateEntry.submitState === "done"
              }
              onClick={rateEntry.onSubmit}
            >
              {rateEntry.submitState === "done" ? (
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path
                    d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
              {submitLabel}
            </button>
          </div>
        ) : null}

        <div className="product-card__rates">
          <div className="product-card__rates-header">
            <span>System rate breakdown</span>
            <span className="product-card__rates-total">
              ₹ {inr(total)}
              <em>total</em>
            </span>
          </div>
          <div className="product-card__rates-grid">
            <RateCell label="FIL" value={product.filRate} accent="violet" />
            <RateCell label="POL" value={product.polRate} accent="sky" />
            <RateCell label="PRP" value={product.prpRate} accent="amber" />
            <RateCell label="DHAGA" value={product.dhagaRate} accent="emerald" />
          </div>
        </div>
      </div>

      <footer className="product-card__footer">
        <span className="product-card__cust-code">
          <em>Customer code</em>
          <strong>{product.custCode}</strong>
        </span>
        {!rateEntry ? (
          <button type="button" className="product-card__cta">
            Details
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M9 6l6 6-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <span className="product-card__entry-hint">Card entry</span>
        )}
      </footer>
    </article>
  );
}

interface RateCellProps {
  label: string;
  value: number;
  accent: "violet" | "sky" | "amber" | "emerald";
}

function RateCell({ label, value, accent }: RateCellProps) {
  return (
    <div className={`rate-cell rate-cell--${accent}`}>
      <span className="rate-cell__label">{label}</span>
      <span className="rate-cell__value">{inr(value)}</span>
    </div>
  );
}

interface EntryRatePillProps {
  label: string;
  value: number;
  tone: "sky" | "amber" | "emerald";
}

function EntryRatePill({ label, value, tone }: EntryRatePillProps) {
  return (
    <span className={`product-card__entry-pill product-card__entry-pill--${tone}`}>
      <em>{label}</em>
      <strong>₹ {inr(value)}</strong>
    </span>
  );
}

interface CardRateInputProps {
  label: string;
  value: number | undefined;
  suggested?: number;
  tone: "sky" | "amber" | "emerald";
  disabled?: boolean;
  onChange: (value: number | undefined) => void;
}

function CardRateInput({
  label,
  value,
  suggested,
  tone,
  disabled,
  onChange,
}: CardRateInputProps) {
  const display =
    value !== undefined
      ? String(value)
      : suggested !== undefined
      ? String(suggested)
      : "";

  return (
    <label
      className={`product-card__entry-rate-input product-card__entry-rate-input--${tone}`}
    >
      <span>{label}</span>
      <input
        type="number"
        className="product-card__rate-input"
        step="0.01"
        min="0"
        inputMode="decimal"
        value={display}
        placeholder="—"
        disabled={disabled}
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
    </label>
  );
}
