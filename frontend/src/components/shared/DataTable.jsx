/** DataTable — the unified FnB Group ERP data table primitive.
 *
 *  Replaces ad-hoc <table> markup, giving every table the usability baseline
 *  defined in the UX Usability Standard:
 *    ✓ sortable columns (click header)        ✓ sticky header
 *    ✓ row hover + keyboard focus             ✓ tabular-nums on numeric cols
 *    ✓ click-to-expand row breakdown          ✓ responsive (mobile cards)
 *    ✓ built-in loading + empty states
 *
 *  Column = {
 *    key, label, render?(row), numeric?, align?, sortable?, sortAccessor?(row),
 *    primary?(mobile title), hideOnMobile?, className?, headerClassName?
 *  }
 */
import { memo, useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

function alignClass(c) {
  if (c.align === "right" || c.numeric) return "text-right";
  if (c.align === "center") return "text-center";
  return "text-left";
}

function sortRows(rows, columns, sort) {
  if (!sort?.key) return rows;
  const col = columns.find((c) => c.key === sort.key);
  if (!col) return rows;
  const acc = col.sortAccessor || ((r) => r[col.key]);
  const dir = sort.dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = acc(a), vb = acc(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
    return String(va).localeCompare(String(vb), "id", { numeric: true }) * dir;
  });
}

/* ----------------------------- Desktop row ----------------------------- */
const Row = memo(function Row({
  row, idx, columns, keyField, rowAction, expandable, isExpanded,
  onToggle, onRowClick, renderExpanded, rowTestIdPrefix, colSpan, rowClassName,
}) {
  const id = row[keyField] ?? idx;
  const clickable = expandable || !!onRowClick;
  const handle = useCallback(() => {
    if (expandable) onToggle(id);
    else if (onRowClick) onRowClick(row);
  }, [expandable, onRowClick, onToggle, id, row]);

  return (
    <>
      <tr
        onClick={clickable ? handle : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={clickable ? (e) => { if (e.key === "Enter") handle(); } : undefined}
        className={cn(
          "border-b border-border/40 transition-colors",
          clickable && "cursor-pointer hover:bg-foreground/[0.045] focus-visible:bg-foreground/[0.06] focus:outline-none",
          isExpanded && "bg-foreground/[0.035]",
          typeof rowClassName === "function" ? rowClassName(row) : rowClassName,
        )}
        data-testid={`${rowTestIdPrefix}-${id}`}
      >
        {columns.map((c, ci) => (
          <td key={c.key} className={cn("px-4 py-3", alignClass(c), c.numeric && "tabular-nums font-medium", c.className)}>
            {ci === 0 && expandable ? (
              <span className="flex items-center gap-2">
                <ChevronRight
                  className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", isExpanded && "rotate-90")}
                  data-testid={`${rowTestIdPrefix}-expand-${id}`}
                />
                <span className="min-w-0 flex-1">{c.render ? c.render(row) : row[c.key]}</span>
              </span>
            ) : (
              c.render ? c.render(row) : row[c.key]
            )}
          </td>
        ))}
        {rowAction && (
          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>{rowAction(row)}</td>
        )}
      </tr>
      {expandable && (
        <AnimatePresence initial={false}>
          {isExpanded && (
            <tr data-testid={`${rowTestIdPrefix}-expanded-${id}`}>
              <td colSpan={colSpan} className="p-0 border-b border-border/40">
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="bg-foreground/[0.025] px-4 py-4 border-l-2 border-aurora/50">
                    {renderExpanded(row)}
                  </div>
                </motion.div>
              </td>
            </tr>
          )}
        </AnimatePresence>
      )}
    </>
  );
});

/* ------------------------------ Mobile card ----------------------------- */
const Card = memo(function Card({
  row, idx, columns, keyField, rowAction, expandable, isExpanded,
  onToggle, onRowClick, renderExpanded, rowTestIdPrefix, rowClassName,
}) {
  const id = row[keyField] ?? idx;
  const primary = columns.find((c) => c.primary) || columns[0];
  const rest = columns.filter((c) => c !== primary && !c.hideOnMobile);
  const clickable = expandable || !!onRowClick;
  const handle = useCallback(() => {
    if (expandable) onToggle(id);
    else if (onRowClick) onRowClick(row);
  }, [expandable, onRowClick, onToggle, id, row]);

  return (
    <div className={cn("p-4", typeof rowClassName === "function" ? rowClassName(row) : rowClassName)} data-testid={`${rowTestIdPrefix}-card-${id}`}>
      <div
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? handle : undefined}
        onKeyDown={clickable ? (e) => { if (e.key === "Enter") handle(); } : undefined}
        className={cn(clickable && "cursor-pointer")}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="font-semibold text-base min-w-0 truncate">
            {primary?.render ? primary.render(row) : row[primary?.key]}
          </div>
          {expandable && (
            <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
          )}
        </div>
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
      </div>
      {expandable && isExpanded && (
        <div className="mt-3 pt-3 border-t border-border/40">{renderExpanded(row)}</div>
      )}
      {rowAction && (
        <div className="mt-3 pt-3 border-t border-border/30 flex justify-end" onClick={(e) => e.stopPropagation()}>
          {rowAction(row)}
        </div>
      )}
    </div>
  );
});

/* ------------------------------- Component ------------------------------ */
export default function DataTable({
  columns,
  rows,
  keyField = "id",
  onRowClick,
  renderExpanded,
  rowAction,
  loading = false,
  loadingRows = 6,
  empty = null,
  stickyHeader = true,
  defaultSort = null,
  rowTestIdPrefix = "row",
  className = "",
  footer = null,
  rowClassName = undefined,
}) {
  const [sort, setSort] = useState(defaultSort);
  const [expanded, setExpanded] = useState(() => new Set());
  const expandable = !!renderExpanded;
  const colSpan = columns.length + (rowAction ? 1 : 0);

  const toggle = useCallback((id) => {
    setExpanded((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const cycleSort = useCallback((key) => {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: "asc" };
      if (cur.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }, []);

  const sorted = useMemo(() => sortRows(rows || [], columns, sort), [rows, columns, sort]);

  if (loading) {
    return (
      <div className={cn("p-3 space-y-2", className)} aria-label="Memuat" role="status" data-testid={`${rowTestIdPrefix}-loading`}>
        {Array.from({ length: loadingRows }).map((_, i) => (
          <div key={i} className="skeleton h-11 rounded-xl" />
        ))}
      </div>
    );
  }
  if (!sorted.length) return empty;

  return (
    <div className={cn("overflow-hidden", className)}>
      {/* Desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={cn(
                      "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border/60 bg-card/80",
                      stickyHeader && "sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-card/70",
                      alignClass(c), c.headerClassName,
                    )}
                  >
                    {c.sortable ? (
                      <span className="inline-flex items-center gap-1">
                        <button
                          onClick={() => cycleSort(c.key)}
                          className={cn(
                            "inline-flex items-center gap-1 hover:text-foreground transition-colors group/sort",
                            c.numeric && "flex-row-reverse",
                            active && "text-foreground",
                          )}
                          data-testid={`${rowTestIdPrefix}-sort-${c.key}`}
                        >
                          {c.label}
                          {active ? (
                            sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 opacity-40 group-hover/sort:opacity-70" />
                          )}
                        </button>
                        {c.help}
                      </span>
                    ) : (
                      c.help ? <span className="inline-flex items-center gap-1.5">{c.label}{c.help}</span> : c.label
                    )}
                  </th>
                );
              })}
              {rowAction && <th className="px-4 py-2.5 border-b border-border/60 bg-card/80" />}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <Row
                key={row[keyField] ?? idx}
                row={row} idx={idx} columns={columns} keyField={keyField}
                rowAction={rowAction} expandable={expandable}
                isExpanded={expanded.has(row[keyField] ?? idx)}
                onToggle={toggle} onRowClick={onRowClick}
                renderExpanded={renderExpanded} rowTestIdPrefix={rowTestIdPrefix}
                colSpan={colSpan} rowClassName={rowClassName}
              />
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>

      {/* Mobile */}
      <div className="sm:hidden divide-y divide-border/30">
        {sorted.map((row, idx) => (
          <Card
            key={row[keyField] ?? idx}
            row={row} idx={idx} columns={columns} keyField={keyField}
            rowAction={rowAction} expandable={expandable}
            isExpanded={expanded.has(row[keyField] ?? idx)}
            onToggle={toggle} onRowClick={onRowClick}
            renderExpanded={renderExpanded} rowTestIdPrefix={rowTestIdPrefix}
            rowClassName={rowClassName}
          />
        ))}
      </div>
    </div>
  );
}
