export function Input({ label, hint, className = "", ...props }) {
  return (
    <label className={`cs-field ${className}`.trim()}>
      {label ? <span className="cs-field__label">{label}</span> : null}
      <input className="cs-input" {...props} />
      {hint ? <span className="cs-field__hint">{hint}</span> : null}
    </label>
  );
}

export function Textarea({ label, hint, className = "", ...props }) {
  return (
    <label className={`cs-field ${className}`.trim()}>
      {label ? <span className="cs-field__label">{label}</span> : null}
      <textarea className="cs-input cs-textarea" {...props} />
      {hint ? <span className="cs-field__hint">{hint}</span> : null}
    </label>
  );
}

export function Select({ label, hint, children, className = "", ...props }) {
  return (
    <label className={`cs-field ${className}`.trim()}>
      {label ? <span className="cs-field__label">{label}</span> : null}
      <select className="cs-input" {...props}>
        {children}
      </select>
      {hint ? <span className="cs-field__hint">{hint}</span> : null}
    </label>
  );
}
