export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  description,
}) {
  return (
    <article className={`cs-stat cs-stat--${tone}`}>
      <div className="cs-stat__icon">
        <Icon size={18} />
      </div>
      <div>
        <div className="cs-stat__value">{value}</div>
        <div className="cs-stat__label">{label}</div>
        {description ? (
          <div className="cs-stat__desc">{description}</div>
        ) : null}
      </div>
    </article>
  );
}
