import ImageBox from "@/components/image-box/imageBox";
import type { Product } from "@/types/product";
import { totalRate } from "@/types/product";
import "./productCard.css";

type Tone = "amber" | "rose" | "emerald" | "sky" | "violet";
type CustMeta = { label: string; tone: Tone };

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

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const cust = custMetaFor(product.custType);
  const diff = difficultyMetaFor(product.difficulty);
  const total = totalRate(product);

  return (
    <article className="product-card">
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
