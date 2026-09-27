export default function Badge({
  children,
  tone = "default",
  className = "",
  ...props
}) {
  return (
    <span
      className={`cs-badge cs-badge--${tone} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}
