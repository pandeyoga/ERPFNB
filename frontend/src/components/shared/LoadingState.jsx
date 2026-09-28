/** LoadingState — skeleton placeholder with variants. */
export default function LoadingState({ rows = 5, variant = "table" }) {
  if (variant === "cards") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Memuat" role="status">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card p-5 sm:p-6">
            <div className="skeleton h-3 w-1/2 mb-3 rounded" />
            <div className="skeleton h-7 w-3/4 mb-2 rounded" />
            <div className="skeleton h-3 w-1/3 rounded" />
          </div>
        ))}
      </div>
    );
  }
  if (variant === "kpi") {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" aria-label="Memuat" role="status">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card p-4 sm:p-5">
            <div className="skeleton h-2.5 w-2/3 mb-2.5 rounded" />
            <div className="skeleton h-6 w-3/4 rounded" />
          </div>
        ))}
      </div>
    );
  }
  if (variant === "form") {
    return (
      <div className="space-y-4" aria-label="Memuat form" role="status">
        <div className="skeleton h-10 w-full rounded-lg" />
        <div className="skeleton h-10 w-full rounded-lg" />
        <div className="skeleton h-24 w-full rounded-lg" />
        <div className="skeleton h-10 w-1/3 rounded-full" />
      </div>
    );
  }
  if (variant === "page") {
    return (
      <div className="space-y-6 max-w-7xl mx-auto" aria-label="Memuat halaman" role="status">
        <div className="skeleton h-10 w-1/3 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }
  // default: table rows
  return (
    <div className="space-y-2" aria-label="Memuat" role="status">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-12 rounded-xl" />
      ))}
    </div>
  );
}
