export default function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="cs-section-header">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
