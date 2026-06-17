"use client";

import { useState } from "react";
import "./imageBox.css";

type Tone = "amber" | "rose" | "emerald" | "sky" | "violet";

const toneToGradient: Record<Tone, { from: string; to: string; stone: string }> = {
  amber: { from: "#fde68a", to: "#f59e0b", stone: "#fef3c7" },
  rose: { from: "#fecdd3", to: "#e11d48", stone: "#ffe4e6" },
  emerald: { from: "#a7f3d0", to: "#059669", stone: "#d1fae5" },
  sky: { from: "#bae6fd", to: "#0284c7", stone: "#e0f2fe" },
  violet: { from: "#ddd6fe", to: "#7c3aed", stone: "#ede9fe" },
};

interface ImageBoxProps {
  designCode: string;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  imageUrl?: string;
}

export default function ImageBox({
  designCode,
  tone = "amber",
  size = "md",
  imageUrl,
}: ImageBoxProps) {
  const palette = toneToGradient[tone];
  const gradId = `grad-${designCode}`;
  const stoneGradId = `stone-${designCode}`;
  const [imgFailed, setImgFailed] = useState(false);

  const showImage = Boolean(imageUrl) && !imgFailed;

  return (
    <div
      className={`image-box image-box--${size}${showImage ? " image-box--photo" : ""}`}
      aria-label={`Image of ${designCode}`}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={designCode}
          className="image-box__img"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="image-box__placeholder">
          <span className="image-box__placeholder-text">No image found</span>
        </div>
      )}

      <span className="image-box__code">{designCode}</span>
    </div>
  );
}
