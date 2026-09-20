/**
 * DataList — responsive list component.
 *  - Desktop (sm+): renders as <table> for dense view.
 *  - Mobile (< sm): renders as stacked card list with primary/secondary fields.
 *
 * Optimized 2026-05-26:
 *   - Extracted DataListRow (desktop) + DataListCard (mobile) as React.memo
 *     to prevent unnecessary re-renders when parent state changes but row data
 *     remains stable. Used across ~12+ pages so this is a high-leverage change.
 *
 * Usage unchanged.
 */
import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";

/* --------------------- Desktop row (memoized) --------------------- */
const DataListRow = memo(function DataListRow({
  row, idx, columns, keyField, rowAction, onRowClick, rowTestIdPrefix,
}) {
  const id = row[keyField] ?? idx;
  const handleClick = useCallback(
    () => { if (onRowClick) onRowClick(row); },
    [row, onRowClick],
  );
  return (
    <tr
      onClick={onRowClick ? handleClick : undefined}
      className={cn(
        "border-b border-border/30 transition-colors",
        onRowClick && "cursor-pointer hover:bg-foreground/5",
      )}
      data-testid={`${rowTestIdPrefix}-${id}`}
    >
      {columns.map((c) => (
        <td
          key={c.key}
          className={cn(
            "px-4 py-3",
            c.numeric && "text-right tabular-nums",
            c.cellClass,
          )}
        >
          {c.render ? c.render(row) : row[c.key]}
        </td>
      ))}
      {rowAction && (
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          {rowAction(row)}
        </td>
      )}
    </tr>
  );
});

/* --------------------- Mobile card (memoized) --------------------- */
const DataListCard = memo(function DataListCard({
  row, idx, columns, keyField, rowAction, onRowClick, rowTestIdPrefix,
}) {
  const id = row[keyField] ?? idx;
  const primary = columns.find((c) => c.primary);
  const rest = columns.filter((c) => !c.primary && !c.hideOnMobile);
  const handleClick = useCallback(
    () => { if (onRowClick) onRowClick(row); },
    [row, onRowClick],
  );
  return (
    <div
      role={onRowClick ? "button" : undefined}
      tabIndex={onRowClick ? 0 : undefined}
      onClick={onRowClick ? handleClick : undefined}
      onKeyDown={onRowClick ? (e) => { if (e.key === "Enter") handleClick(); } : undefined}
      className={cn(
        "p-4 transition-colors",
        onRowClick && "cursor-pointer hover:bg-foreground/5 active:bg-foreground/10",
      )}
      data-testid={`${rowTestIdPrefix}-card-${id}`}
    >
      {primary && (
        <div className="font-semibold text-base mb-1.5">
          {primary.render ? primary.render(row) : row[primary.key]}
        </div>
      )}
      <div className="grid grid-cols-1 gap-1.5">
        {rest.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-xs text-muted-foreground font-medium">{c.label}</span>
            <span className={cn("text-right", c.numeric && "tabular-nums font-medium")}>
              {c.render ? c.render(row) : row[c.key]}
            </span>
          </div>
        ))}
      </div>
      {rowAction && (
        <div className="mt-3 pt-3 border-t border-border/30 flex justify-end" onClick={(e) => e.stopPropagation()}>
          {rowAction(row)}
        </div>
      )}
    </div>
  );
});

export default function DataList({
  columns,
  rows,
  keyField = "id",
  onRowClick,
  rowAction,
  loading = false,
  loadingNode,
  empty,
  className = "",
  rowTestIdPrefix = "row",
}) {
  if (loading) return loadingNode || null;
  if (!rows || rows.length === 0) return empty || null;

  return (
    <div className={cn("overflow-hidden", className)}>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-border/50">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                    "sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
                    c.numeric && "text-right",
                    c.headerClass,
                  )}
                  scope="col"
                >
                  {c.label}
                </th>
              ))}
              {rowAction && <th className="px-4 py-3 sticky top-0 z-10 bg-background/95 backdrop-blur" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <DataListRow
                key={row[keyField] ?? idx}
                row={row}
                idx={idx}
                columns={columns}
                keyField={keyField}
                rowAction={rowAction}
                onRowClick={onRowClick}
                rowTestIdPrefix={rowTestIdPrefix}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card */}
      <div className="sm:hidden divide-y divide-border/30">
        {rows.map((row, idx) => (
          <DataListCard
            key={row[keyField] ?? idx}
            row={row}
            idx={idx}
            columns={columns}
            keyField={keyField}
            rowAction={rowAction}
            onRowClick={onRowClick}
            rowTestIdPrefix={rowTestIdPrefix}
          />
        ))}
      </div>
    </div>
  );
}
