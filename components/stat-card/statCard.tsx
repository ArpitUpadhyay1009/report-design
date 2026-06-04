import "./statCard.css";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  accent?: "violet" | "amber" | "emerald" | "sky";
  icon?: React.ReactNode;
}

export default function StatCard({
  label,
  value,
  hint,
  accent = "violet",
  icon,
}: StatCardProps) {
  return (
    <div className={`stat-card stat-card--${accent}`}>
      {icon ? <div className="stat-card__icon">{icon}</div> : null}
      <div className="stat-card__content">
        <span className="stat-card__label">{label}</span>
        <span className="stat-card__value">{value}</span>
        {hint ? <span className="stat-card__hint">{hint}</span> : null}
      </div>
    </div>
  );
}
