export default function Card({ children, className = "", ...props }) {
  return (
    <section className={`cs-card ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}
