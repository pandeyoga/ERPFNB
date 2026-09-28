/**
 * Procurement Kanban Workboard — Phase 9B.
 *
 * Drag-and-drop card from one column to another triggers the appropriate
 * action via the existing approve / send / submit / receive endpoints.
 *
 * Uses @dnd-kit/core for drag-and-drop.
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  Layers,
  RefreshCw,
  ExternalLink,
  Calendar,
  FileText,
  FileCheck,
  Filter as FilterIcon,
  CheckCircle2,
  Send,
  Truck,
  ClipboardCheck,
  ShoppingCart,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { fmtRp, fmtDate, fmtRelative } from "@/lib/format";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill from "@/components/shared/StatusPill";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import useOutletScope from "@/hooks/useOutletScope";

const COL_TONE = {
  muted: "border-foreground/10 bg-foreground/[0.02]",
  amber: "border-amber-500/30 bg-amber-500/5",
  blue: "border-blue-500/30 bg-blue-500/5",
  indigo: "border-indigo-500/30 bg-indigo-500/5",
  violet: "border-violet-500/30 bg-violet-500/5",
  orange: "border-orange-500/30 bg-orange-500/5",
  green: "border-emerald-500/30 bg-emerald-500/5",
};
const COL_PILL_TONE = {
  muted: "bg-foreground/10 text-foreground/70",
  amber: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  blue: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  indigo: "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300",
  violet: "bg-violet-500/20 text-violet-700 dark:text-violet-300",
  orange: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  green: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
};

export default function KanbanWorkboard() {
  const { can } = useAuth();
  const { outletId, setOutletId, scopedOutlets } = useOutletScope();
  const [data, setData] = useState(null);
  const [transitions, setTransitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(60);
  const [vendorId, setVendorId] = useState("");
  const [vendors, setVendors] = useState([]);
  const [activeCard, setActiveCard] = useState(null);
  const [dragMoving, setDragMoving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { days, limit_per_column: 50 };
      if (outletId) params.outlet_id = outletId;
      if (vendorId) params.vendor_id = vendorId;
      const [wb, tr] = await Promise.all([
        api.get("/procurement/workboard", { params }),
        api.get("/procurement/workboard/transitions"),
      ]);
      setData(unwrap(wb));
      setTransitions(unwrap(tr)?.transitions || []);
    } catch (e) {
      toast.error("Gagal load workboard");
    } finally { setLoading(false); }
  }, [days, outletId, vendorId]);

  useEffect(() => {
    api.get("/master/vendors", { params: { per_page: 200 } })
      .then(v => setVendors(unwrap(v) || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const findCardById = useCallback((id) => {
    if (!data) return null;
    for (const col of Object.keys(data.cards || {})) {
      const c = (data.cards[col] || []).find(x => x.id === id);
      if (c) return { ...c, _col: col };
    }
    return null;
  }, [data]);

  const transitionFor = useCallback((card, toCol) => {
    return transitions.find(t =>
      t.type === card.type && t.from === card.status && t.to === toCol,
    );
  }, [transitions]);

  const handleDragStart = (event) => {
    const card = findCardById(event.active.id);
    setActiveCard(card);
  };

  const handleDragEnd = async (event) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const card = findCardById(active.id);
    if (!card) return;

    const toCol = over.id;
    const fromCol = card._col;
    if (toCol === fromCol) return;

    const t = transitionFor(card, toCol);
    if (!t) {
      toast.error(`Tidak bisa pindahkan dari "${fromCol}" ke "${toCol}"`);
      return;
    }
    if (t.perm && !can(t.perm) && !can("*")) {
      toast.error(`Tidak ada izin: ${t.perm}`);
      return;
    }

    if (t.redirect) {
      // Open in new tab/page (e.g., GR creation form)
      const path = t.path.replace("{id}", card.id);
      window.location.assign(path);
      return;
    }

    setDragMoving(true);
    try {
      const path = t.path.replace("{id}", card.id);
      // Map shared API path - drop /api prefix
      const apiPath = path.startsWith("/api") ? path.slice(4) : path;
      const resp = await api.request({
        method: t.method,
        url: apiPath,
        data: t.action === "approve" ? { note: "Approved via Kanban" } : {},
      });
      toast.success(`${card.title}: ${t.label}`);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal pindahkan");
    } finally { setDragMoving(false); }
  };

  const totalCount = useMemo(() => {
    if (!data) return 0;
    return Object.values(data.counts || {}).reduce((a, b) => a + b, 0);
  }, [data]);

  return (
    <div className="space-y-4" data-testid="kanban-workboard-page">
      {/* Header / Filters */}
      <div className="glass-card p-4" data-testid="wb-header">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-foreground/70" />
              <h2 className="text-lg font-bold">Procurement Workboard</h2>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Drag &amp; drop card untuk transition status
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1" data-testid="wb-meta">
              <span data-testid="wb-total-count">{totalCount}</span> card{totalCount > 1 ? "s" : ""} aktif {data?.as_of && `· refreshed ${fmtRelative(data.as_of)}`}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2" data-testid="wb-filters">
            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground" htmlFor="wb-outlet">Outlet</label>
              <SimpleSelect
                value={outletId}
                onValueChange={setOutletId}
                options={[{ value: "", label: "Semua" }, ...scopedOutlets.map(o => ({ value: o.id, label: o.name }))]}
                placeholder="Semua"
                className="glass-input rounded-lg h-9 text-xs mt-0.5 min-w-[140px]"
                testId="wb-filter-outlet"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground" htmlFor="wb-vendor">Vendor</label>
              <SimpleSelect
                value={vendorId}
                onValueChange={setVendorId}
                options={[{ value: "", label: "Semua" }, ...vendors.map(v => ({ value: v.id, label: v.name }))]}
                placeholder="Semua"
                className="glass-input rounded-lg h-9 text-xs mt-0.5 min-w-[160px]"
                testId="wb-filter-vendor"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground" htmlFor="wb-days">Periode</label>
              <SimpleSelect
                value={days}
                onValueChange={(v) => setDays(Number(v))}
                options={[
                  { value: 30, label: "30 hari" },
                  { value: 60, label: "60 hari" },
                  { value: 90, label: "90 hari" },
                  { value: 180, label: "180 hari" },
                ]}
                className="glass-input rounded-lg h-9 text-xs mt-0.5"
                testId="wb-filter-days"
              />
            </div>
            <Button onClick={load} disabled={loading} variant="outline" size="sm"
              className="rounded-full h-9 gap-1.5" data-testid="wb-refresh">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="glass-card p-8" data-testid="wb-loading"><LoadingState rows={4} /></div>
      ) : !data || totalCount === 0 ? (
        <div className="glass-card p-8" data-testid="wb-empty">
          <EmptyState
            icon={Layers}
            title="Belum ada card di workboard"
            description="Buat PR atau PO baru untuk memulai pipeline procurement."
            action={
              <div className="flex gap-2 mt-3">
                <Link to="/procurement/pr/new"><Button className="pill-active rounded-full" data-testid="wb-empty-new-pr">PR Baru</Button></Link>
                <Link to="/procurement/po/new"><Button variant="outline" className="rounded-full" data-testid="wb-empty-new-po">PO Baru</Button></Link>
              </div>
            }
          />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3" data-testid="wb-board">
            {data.columns.map((col) => (
              <KanbanColumn
                key={col.key}
                column={col}
                cards={data.cards[col.key] || []}
                count={data.counts[col.key] || 0}
                dimmed={dragMoving && activeCard?._col === col.key}
              />
            ))}
          </div>
          <DragOverlay>
            {activeCard ? <KanbanCard card={activeCard} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Help / Legend */}
      <div className="glass-card p-3">
        <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
          <span><strong>Tip:</strong> drag card untuk approve/send/receive.</span>
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Approve PR/PO
          </span>
          <span className="inline-flex items-center gap-1">
            <Send className="h-3 w-3 text-violet-600" /> Send to Vendor
          </span>
          <span className="inline-flex items-center gap-1">
            <Truck className="h-3 w-3 text-orange-600" /> Receive (open GR form)
          </span>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ column, cards, count, dimmed }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  const tone = COL_TONE[column.tone] || COL_TONE.muted;
  const pillTone = COL_PILL_TONE[column.tone] || COL_PILL_TONE.muted;

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border ${tone} p-3 min-h-[400px] transition-colors ${isOver ? "ring-2 ring-foreground/20" : ""} ${dimmed ? "opacity-50" : ""}`}
      data-testid={`wb-col-${column.key}`}
      role="region"
      aria-label={column.label}
    >
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/40">
        <div className="text-xs font-bold uppercase tracking-wide text-foreground/80 truncate">
          {column.label}
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pillTone} flex-shrink-0`}>
          {count}
        </span>
      </div>
      <div className="space-y-2">
        {cards.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic px-1 py-3 text-center">
            (kosong)
          </div>
        ) : (
          cards.map((card) => (
            <KanbanCard key={card.id} card={card} />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCard({ card, dragging = false }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: card,
    disabled: dragging,
  });
  const Icon = card.type === "pr" ? FileText : (card.type === "po" ? FileCheck : ShoppingCart);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        opacity: isDragging ? 0.4 : 1,
        cursor: dragging ? "grabbing" : "grab",
      }}
      className={`bg-background rounded-xl border border-border/60 p-3 hover:border-foreground/30 hover:shadow-md transition-all ${dragging ? "shadow-2xl ring-2 ring-foreground/20" : ""}`}
      data-testid={`wb-card-${card.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="font-mono text-[11px] truncate">{card.title}</span>
        </div>
        <Link to={card.url} target="_self" rel="noopener" onClick={(e) => e.stopPropagation()}
          className="h-6 w-6 rounded hover:bg-foreground/10 flex items-center justify-center flex-shrink-0"
          aria-label="Buka detail">
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-1 text-[11px]">
        {card.vendor_name && (
          <div className="text-foreground font-medium truncate" title={card.vendor_name} data-testid={`wb-card-vendor-${card.id}`}>
            {card.vendor_name}
          </div>
        )}
        {card.outlet_name && (
          <div className="text-muted-foreground truncate">
            {card.outlet_name}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {fmtDate(card.date)}
          </span>
          <StatusPill status={card.status} className="!text-[10px] !px-1.5 !py-0.5" />
        </div>
        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/30">
          <span className="text-[10px] text-muted-foreground" data-testid={`wb-card-lines-${card.id}`}>
            {card.line_count} line{card.line_count > 1 ? "s" : ""}
          </span>
          {card.total > 0 && (
            <span className="font-semibold tabular-nums" data-testid={`wb-card-total-${card.id}`}>{fmtRp(card.total)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
