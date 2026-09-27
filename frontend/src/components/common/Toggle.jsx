export default function Toggle({ checked, onChange, label }) {
  return (
    <label className="cs-toggle">
      <span>{label}</span>
      <button
        type="button"
        className={`cs-toggle__track ${checked ? "is-on" : ""}`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      >
        <span className="cs-toggle__thumb" />
      </button>
    </label>
  );
}
