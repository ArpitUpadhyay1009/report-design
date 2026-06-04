import ImageBox from "@/components/image-box/imageBox";
import type { Product } from "@/types/product";
import { totalRate } from "@/types/product";
import "./productRow.css";

const custTone: Record<Product["custType"], "amber" | "violet" | "emerald" | "rose"> = {
  O: "amber",
  B: "violet",
  S: "emerald",
  P: "rose",
};

const inr = (n: number): string =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

interface ProductRowProps {
  product: Product;
}

export default function ProductRow({ product }: ProductRowProps) {
  const tone = custTone[product.custType];
  const total = totalRate(product);

  return (
    <tr className="product-row">
      <td className="product-row__cell product-row__cell--image">
        <div className="product-row__image">
          <ImageBox designCode={product.designCode} tone={tone} size="sm" />
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
      <td className="product-row__cell product-row__cell--num">{inr(product.filRate)}</td>
      <td className="product-row__cell product-row__cell--num">{inr(product.polRate)}</td>
      <td className="product-row__cell product-row__cell--num">{inr(product.prpRate)}</td>
      <td className="product-row__cell product-row__cell--num">{inr(product.dhagaRate)}</td>
      <td className="product-row__cell product-row__cell--num product-row__cell--total">
        {inr(total)}
      </td>
    </tr>
  );
}
