/** StatCard — metric card for import results. */

function StatCard({ label, value, color, bg, testid }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${bg}`} data-testid={testid}>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export default StatCard;
