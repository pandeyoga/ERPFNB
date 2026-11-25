/** POForm/TableHelpers.jsx — table cell helper components. */

function Th({ children, className = "" }) {
  return <th className={`px-3 py-2 text-[11px] uppercase tracking-[0.06em] text-muted-foreground ${className}`}>{children}</th>;
}

export { Th };
