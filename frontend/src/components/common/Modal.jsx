import { X } from "lucide-react";

export default function Modal({
  open,
  title,
  children,
  onClose,
  width = "medium",
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="cs-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className={`cs-modal cs-modal--${width}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cs-modal__header">
          <h3>{title}</h3>
          <button
            className="cs-icon-button"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>
        <div className="cs-modal__body">{children}</div>
      </div>
    </div>
  );
}
