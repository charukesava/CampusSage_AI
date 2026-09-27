export default function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={`cs-button cs-button--${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
