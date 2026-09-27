import { FileSearch } from "lucide-react";
import Button from "./Button";

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = FileSearch,
}) {
  return (
    <div className="cs-empty">
      <div className="cs-empty__icon">
        <Icon size={26} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel ? <Button onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  );
}
