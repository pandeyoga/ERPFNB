/** Matriks izin: portal (accordion) → modul (baris) → izin (chip). Tingkat cepat per portal & per modul
 *  (Tidak ada / Lihat / Penuh), pencarian, filter "aktif saja / sensitif", dependensi otomatis.
 *  Pola mengikuti DAHOST RoleManagementModule (satu layar konfigurasi akses). */
import { useMemo, useState } from "react";
import { Check, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import SegmentedFilter from "@/components/shared/SegmentedFilter";
import ListToolbar, { ListSearch } from "@/components/shared/ListToolbar";
import { LEVELS, applyLevel, levelOf, togglePerm } from "./permissionUtils";

const SHOW = [
  { value: "all", label: "Semua" },
  { value: "on", label: "Aktif" },
  { value: "sensitive", label: "Sensitif" },
];

function LevelControl({ level, onChange, disabled, testId }) {
  if (disabled) return null;
  return (
    <div className="ml-auto flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {level === "custom" && <span className="text-xs text-muted-foreground">Kustom</span>}
      <SegmentedFilter value={level === "custom" ? "" : level} onChange={onChange} ariaLabel="Tingkat akses"
        options={LEVELS.map((l) => ({ ...l, testId: `${testId}-${l.value}` }))} testId={testId} />
    </div>
  );
}

export default function PermissionMatrix({ catalog, value, onChange, readOnly = false, canGrant = () => true, labelOf }) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState("all");
  const [open, setOpen] = useState([]);
  const set = value;

  const match = (p) => {
    if (show === "on" && !set.has(p.code)) return false;
    if (show === "sensitive" && !p.sensitive) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return p.code.toLowerCase().includes(s) || p.label.toLowerCase().includes(s);
  };
  const portals = useMemo(() => (catalog?.portals || []).map((portal) => ({
    ...portal,
    modules: portal.modules.map((m) => ({
      ...m,
      visible: m.permissions.filter((p) => match(p) || (q && m.label.toLowerCase().includes(q.toLowerCase()))),
    })).filter((m) => m.visible.length),
  })).filter((p) => p.modules.length), [catalog, q, show, set]); // eslint-disable-line react-hooks/exhaustive-deps
  const openIds = q || show !== "all" ? portals.map((p) => p.id) : open;

  const toggle = (perm, m) => {
    if (readOnly) return;
    if (!set.has(perm.code) && !canGrant(perm.code)) {
      toast.error("Anda tidak bisa memberi izin yang tidak Anda miliki sendiri");
      return;
    }
    const { next, auto } = togglePerm(set, perm, m.permissions);
    onChange(next);
    if (auto.length) toast.info(`${set.has(perm.code) ? "Ikut dicabut" : "Ikut ditambahkan"}: ${auto.map(labelOf).join(", ")}`);
  };

  return (
    <div data-testid="perm-matrix">
      <ListToolbar testId="perm-toolbar"
        search={<ListSearch value={q} onChange={setQ} placeholder="Cari izin atau modul…" testId="perm-search" />}>
        <SegmentedFilter value={show} onChange={setShow} options={SHOW.map((o) => ({ ...o, testId: `perm-show-${o.value}` }))}
          ariaLabel="Tampilkan izin" testId="perm-show" />
        {!q && show === "all" && (
          <Button size="sm" variant="ghost" onClick={() => setOpen(open.length ? [] : portals.map((p) => p.id))} data-testid="perm-expand-all">
            {open.length ? "Tutup semua" : "Buka semua"}
          </Button>
        )}
      </ListToolbar>
      {!portals.length && <p className="px-4 py-6 text-sm text-muted-foreground">Tidak ada izin yang cocok.</p>}
      <Accordion type="multiple" value={openIds} onValueChange={setOpen} className="divide-y divide-border/50">
        {portals.map((portal) => {
          const all = portal.modules.flatMap((m) => m.permissions);
          const on = all.filter((p) => set.has(p.code)).length;
          const lvl = levelOf(all, set);
          return (
            <AccordionItem key={portal.id} value={portal.id} className="border-0" data-testid={`perm-portal-${portal.id}`}>
              <div className="flex items-center gap-3 px-4">
                <AccordionTrigger className="py-3 hover:no-underline flex-1 min-w-0">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold">{portal.label}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                      on ? "bg-primary/10 text-foreground" : "bg-muted text-muted-foreground")}>{on}/{all.length}</span>
                  </span>
                </AccordionTrigger>
                <LevelControl level={lvl} disabled={readOnly}
                  onChange={(l) => onChange(applyLevel(set, all, l, canGrant))} testId={`perm-portal-level-${portal.id}`} />
              </div>
              <AccordionContent className="px-4 pb-3">
                <div className="divide-y divide-border/40 rounded-lg border border-border/60">
                  {portal.modules.map((m) => {
                    const ml = levelOf(m.permissions, set);
                    return (
                      <div key={m.id} className="p-3" data-testid={`perm-module-${m.id}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium">{m.label}</span>
                          <LevelControl level={ml} disabled={readOnly}
                            onChange={(l) => onChange(applyLevel(set, m.permissions, l, canGrant))} testId={`perm-module-level-${m.id}`} />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.visible.map((p) => {
                            const active = set.has(p.code);
                            const blocked = !active && !canGrant(p.code);
                            return (
                              <Button key={p.code} size="sm" variant="outline" aria-pressed={active} disabled={readOnly || blocked}
                                onClick={() => toggle(p, m)} title={`${p.code}${p.sensitive ? " · izin sensitif" : ""}${blocked ? " · Anda tidak memiliki izin ini" : ""}`}
                                className={cn(active && "border-primary bg-primary/10 text-foreground",
                                  p.sensitive && "border-amber-500/60")}
                                data-testid={`perm-${p.code}`}>
                                {active ? <Check /> : null}
                                {p.sensitive && <ShieldAlert className="text-amber-800 dark:text-amber-400" />}
                                {p.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
