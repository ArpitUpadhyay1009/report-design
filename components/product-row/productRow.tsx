import ImageBox from "@/components/image-box/imageBox";
import type { Product } from "@/types/product";
import { totalRate } from "@/types/product";
import type { Role } from "@/types/profile";
import "./productRow.css";

type Tone = "amber" | "violet" | "emerald" | "rose";

const custToneMap: Record<string, Tone> = {
  O: "amber",
  B: "violet",
  S: "emerald",
  P: "rose",
};

const toneFor = (custType: string): Tone => custToneMap[custType] ?? "amber";

const inr = (n: number | undefined | null): string =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n ?? 0);

interface ProductRowProps {
  product: Product;
  role: Role;
}

export default function ProductRow({ product, role }: ProductRowProps) {
  const tone = toneFor(product.custType);
  const total =
    role === "POL"
      ? (product.polRate ?? 0) + (product.prpRate ?? 0)
      : role === "FIL"
        ? product.filRate ?? 0
        : totalRate(product);

  return (
    <tr className="product-row">
      <td className="product-row__cell product-row__cell--image">
        <div className="product-row__image">
          <ImageBox
            designCode={product.designCode}
            tone={tone}
            size="sm"
            imageUrl={product.imageUrl}
          />
        </div>
      </td>
      <td className="product-row__cell">
        <div className="product-row__design">{product.designCode}</div>
        <div className="product-row__sub">{product.custCode}</div>
      </td>
      <td className="product-row__cell">
        <div className="product-row__manager">{product.managerName}</div>
        <div className="product-row__sub">{product.managerShort}</div>
      </td>
      <td className="product-row__cell product-row__cell--center">
        <span className={`product-row__cust product-row__cust--${tone}`}>{product.custType}</span>
      </td>
      <td className="product-row__cell product-row__cell--center">{product.numberOfParts}</td>
      <td className="product-row__cell product-row__cell--center">{product.manufacturer}</td>
      <td className="product-row__cell product-row__cell--center">{product.dep}</td>
      <td className="product-row__cell product-row__cell--center">{product.polCtg}</td>
      <td className="product-row__cell product-row__cell--center">{product.difficulty}</td>
      {role !== "POL" ? (
        <td className="product-row__cell product-row__cell--num">{inr(product.filRate)}</td>
      ) : null}
      {role !== "FIL" ? (
        <td className="product-row__cell product-row__cell--num">{inr(product.polRate)}</td>
      ) : null}
      {role !== "FIL" ? (
        <td className="product-row__cell product-row__cell--num">{inr(product.prpRate)}</td>
      ) : null}
      <td className="product-row__cell product-row__cell--num product-row__cell--total">
        {inr(total)}
      </td>
    </tr>
  );
}
