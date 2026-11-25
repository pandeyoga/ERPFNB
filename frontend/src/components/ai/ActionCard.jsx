/** ActionCard — usulan aksi tulis dari Asisten AI: apa yang akan dilakukan, dasar, risiko, isi data (bisa diedit),
 * sebelum→sesudah untuk ubah/hapus, lalu Setujui / Tolak. Aksi dijalankan sebagai pengguna (izin route tetap berlaku). */
import { useState } from "react";
import { Check, X, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import StatusPill from "@/components/shared/StatusPill";
import DataTable from "@/components/shared/DataTable";
import { cn } from "@/lib/utils";

const METHOD_LABEL = { POST: "Buat / jalankan", PUT: "Ubah", PATCH: "Ubah", DELETE: "Hapus" };

function fmt(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const CHANGE_COLS = [
  { key: "field", label: "Field", primary: true, render: (c) => <code className="font-mono">{c.field}</code> },
  { key: "sebelum", label: "Sebelum", render: (c) => <span className="text-muted-foreground">{fmt(c.sebelum)}</span> },
  { key: "sesudah", label: "Sesudah", render: (c) => <span className="font-medium">{fmt(c.sesudah)}</span> },
];

function ResultLine({ a }) {
  if (a.status === "done") {
    const r = a.result || {};
    const ref = r.doc_no || r.je_number || r.code || r.name || r.title || r.id;
    return <p className="text-xs text-emerald-700 dark:text-emerald-400">Berhasil{ref ? ` · ${ref}` : ""}{r.status ? ` · status ${r.status}` : ""}</p>;
  }
  if (a.status === "simulated") return <p className="text-xs text-blue-700 dark:text-blue-400">Mode latihan — disimulasikan, data tidak berubah</p>;
  if (a.status === "failed") return <p className="text-xs text-rose-700 dark:text-rose-400">Gagal: {a.error || "galat"}</p>;
  if (a.status === "rejected") return <p className="text-xs text-muted-foreground">Ditolak{a.reject_reason ? `: ${a.reject_reason}` : ""}</p>;
  return null;
}

export default function ActionCard({ action: a, onDecide, disabled }) {
  const [open, setOpen] = useState(a.status === "pending");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => JSON.stringify(a.body ?? {}, null, 2));
  const [jsonError, setJsonError] = useState("");
  const [working, setWorking] = useState(false);
  const pending = a.status === "pending";
  const changes = a.preview?.perubahan;
  const before = a.preview?.sebelum;

  const run = async (decision) => {
    let body;
    if (decision === "approve" && editing) {
      try { body = JSON.parse(draft); } catch { setJsonError("Format isi tidak valid (JSON)"); return; }
    }
    setWorking(true);
    await onDecide(a.id, decision, { body });
    setWorking(false);
    setEditing(false);
  };

  return (
    <div className={cn("rounded-md border border-border bg-background p-3 space-y-2", pending && "border-primary/40")} data-testid={`ai-action-${a.id}`}>
      <div className="flex items-start gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-0.5 text-muted-foreground" aria-label={open ? "Tutup rincian" : "Buka rincian"}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-medium leading-snug">{a.title}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill status={a.status} />
            <StatusPill status={`risk_${a.risk}`} />
            <span className="text-xs text-muted-foreground">{METHOD_LABEL[a.method] || a.method} · <code className="font-mono">{a.path}</code></span>
          </div>
          {a.reason && <p className="text-xs text-muted-foreground">{a.reason}</p>}
          <ResultLine a={a} />
        </div>
      </div>

      {open && (
        <div className="space-y-2 pl-6">
          {changes?.length > 0 && (
            <DataTable columns={CHANGE_COLS} rows={changes} keyField="field" loading={false} empty={null} stickyHeader={false} rowTestIdPrefix="ai-action-change" />
          )}
          {before && a.method === "DELETE" && (
            <p className="text-xs text-muted-foreground">Data yang akan dihapus: {fmt(before.doc_no || before.name || before.code || before.id)}</p>
          )}
          {a.body && Object.keys(a.body).length > 0 && (
            editing ? (
              <div className="space-y-1">
                <Textarea value={draft} onChange={(e) => { setDraft(e.target.value); setJsonError(""); }} rows={10}
                  className="font-mono text-xs" aria-label="Isi data aksi" data-testid={`ai-action-edit-${a.id}`} />
                {jsonError && <p className="text-xs text-rose-700 dark:text-rose-400">{jsonError}</p>}
              </div>
            ) : (
              <pre className="text-xs font-mono bg-muted rounded-md p-2 overflow-x-auto max-h-56">{JSON.stringify(a.body, null, 2)}</pre>
            )
          )}
          {a.status !== "pending" && a.original_body && JSON.stringify(a.original_body) !== JSON.stringify(a.body) && (
            <p className="text-xs text-muted-foreground">Isi diubah pengguna sebelum dijalankan.</p>
          )}
        </div>
      )}

      {pending && (
        <div className="flex flex-wrap justify-end gap-2">
          {a.body && Object.keys(a.body).length > 0 && !editing && (
            <Button size="sm" variant="ghost" onClick={() => { setEditing(true); setOpen(true); }} disabled={disabled || working} data-testid={`ai-action-edit-btn-${a.id}`}>
              <Pencil className="h-3.5 w-3.5" /> Ubah isi
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => run("reject")} disabled={disabled || working} data-testid={`ai-action-reject-${a.id}`}>
            <X className="h-3.5 w-3.5" /> Tolak
          </Button>
          <Button size="sm" variant="success" onClick={() => run("approve")} disabled={disabled || working} data-testid={`ai-action-approve-${a.id}`}>
            <Check className="h-3.5 w-3.5" /> {working ? "Menjalankan…" : "Setujui & jalankan"}
          </Button>
        </div>
      )}
    </div>
  );
}
