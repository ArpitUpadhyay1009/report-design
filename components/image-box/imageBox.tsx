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
}

export default function ImageBox({
  designCode,
  tone = "amber",
  size = "md",
}: ImageBoxProps) {
  const palette = toneToGradient[tone];
  const gradId = `grad-${designCode}`;
  const stoneGradId = `stone-${designCode}`;

  return (
    <div className={`image-box image-box--${size}`} aria-label={`Image of ${designCode}`}>
      <svg
        viewBox="0 0 200 200"
        className="image-box__svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.from} />
            <stop offset="100%" stopColor={palette.to} />
          </linearGradient>
          <radialGradient id={stoneGradId} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="60%" stopColor={palette.stone} stopOpacity="0.9" />
            <stop offset="100%" stopColor={palette.to} stopOpacity="0.6" />
          </radialGradient>
        </defs>

        <circle cx="100" cy="125" r="48" fill="none" stroke={`url(#${gradId})`} strokeWidth="9" />

        <g transform="translate(100 70)">
          <polygon
            points="0,-22 18,-6 12,18 -12,18 -18,-6"
            fill={`url(#${stoneGradId})`}
            stroke={palette.to}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <polyline
            points="-18,-6 0,-2 18,-6"
            fill="none"
            stroke={palette.to}
            strokeWidth="1"
            opacity="0.5"
          />
          <line x1="0" y1="-2" x2="0" y2="18" stroke={palette.to} strokeWidth="1" opacity="0.5" />
        </g>

        <ellipse cx="80" cy="155" rx="14" ry="3" fill="#0f172a" opacity="0.08" />
        <ellipse cx="120" cy="155" rx="14" ry="3" fill="#0f172a" opacity="0.08" />
      </svg>

      <span className="image-box__code">{designCode}</span>
    </div>
  );
}
