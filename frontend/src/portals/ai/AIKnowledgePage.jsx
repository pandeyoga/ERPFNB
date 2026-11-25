/** /ai/knowledge — Memori & Pengetahuan Asisten AI: memori (perusahaan/pribadi) yang diikuti AI, dokumen basis
 * pengetahuan (SOP, kontrak, kebijakan) yang dikutip AI, dan catatan riset sumber luar.
 * Backend: /api/ai/knowledge/memories | docs | research | search. */
import { useCallback, useEffect, useState } from "react";
import { BookMarked, Plus, Trash2, Upload, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import StatusPill from "@/components/shared/StatusPill";
import SegmentedFilter from "@/components/shared/SegmentedFilter";
import SimpleSelect from "@/components/shared/SimpleSelect";
import EmptyState from "@/components/shared/EmptyState";
import { confirmDialog } from "@/components/shared/confirmDialog";
import ListToolbar from "@/components/shared/ListToolbar";
import api, { unwrap, unwrapError } from "@/lib/api";
import { fmtDate } from "@/lib/format";

const KINDS = ["preferensi", "aturan", "target", "koreksi", "fakta"].map((k) => ({ value: k, label: k.charAt(0).toUpperCase() + k.slice(1) }));
const CATS = ["SOP", "kontrak", "kebijakan", "resep", "lainnya"].map((k) => ({ value: k, label: k.charAt(0).toUpperCase() + k.slice(1) }));
const TABS = [{ value: "memori", label: "Memori" }, { value: "dokumen", label: "Dokumen" }, { value: "riset", label: "Catatan riset" },
  { value: "privasi", label: "Privasi" }];

/** Hak subjek data (UU PDP): unduh & hapus data Asisten AI milik saya. */
function PrivacyCard() {
  const [busy, setBusy] = useState("");
  const download = async () => {
    setBusy("export");
    try {
      const res = await api.get("/ai/agent/me/export", { responseType: "blob", scope: false, timeout: 120000 });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "data-asisten-ai-saya.json"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { toast.error(unwrapError(e)); } finally { setBusy(""); }
  };
  const wipe = async () => {
    if (!(await confirmDialog({ title: "Hapus semua data AI saya?", destructive: true, confirmText: "Hapus permanen",
      description: "Percakapan, memori pribadi, file hasil AI, umpan balik & riwayat pesan WhatsApp Anda dihapus. Catatan audit usulan aksi tetap disimpan perusahaan." }))) return;
    setBusy("delete");
    try {
      const r = unwrap(await api.delete("/ai/agent/me/data"));
      toast.success(`Dihapus: ${r.percakapan} percakapan, ${r.memori} memori, ${r.file} file`);
    } catch (e) { toast.error(unwrapError(e)); } finally { setBusy(""); }
  };
  return (
    <Card className="p-4 space-y-3" data-testid="ai-privacy-card">
      <p className="text-sm">Data yang disimpan Asisten AI tentang Anda: percakapan, memori pribadi, file laporan, umpan balik, otomasi, dan tautan WhatsApp.
        Admin dapat mengatur masa simpan & penyamaran data pribadi di Pemakaian & Pengaturan.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={download} disabled={!!busy} data-testid="ai-privacy-export">{busy === "export" ? "Menyiapkan…" : "Unduh data saya (JSON)"}</Button>
        <Button variant="destructive" onClick={wipe} disabled={!!busy} data-testid="ai-privacy-delete">{busy === "delete" ? "Menghapus…" : "Hapus data AI saya"}</Button>
      </div>
    </Card>
  );
}

function MemoryDialog({ open, onOpenChange, initial, canCompany, onSaved }) {
  const [f, setF] = useState({ content: "", kind: "fakta", scope: "pribadi" });
  useEffect(() => { if (open) setF(initial ? { content: initial.content, kind: initial.kind, scope: initial.scope } : { content: "", kind: "fakta", scope: "pribadi" }); }, [open, initial]);
  const save = async () => {
    try {
      if (initial) await api.patch(`/ai/knowledge/memories/${initial.id}`, f); else await api.post("/ai/knowledge/memories", f);
      toast.success("Memori disimpan"); onOpenChange(false); onSaved();
    } catch (e) { toast.error(unwrapError(e)); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{initial ? "Ubah memori" : "Tambah memori"}</DialogTitle>
          <DialogDescription>Fakta ringkas yang diikuti Asisten AI, mis. "Target food cost 32%" atau "TRF GOTO = payout GoFood".</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="mem-content">Isi</Label>
            <Textarea id="mem-content" rows={3} maxLength={600} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} data-testid="mem-content" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="mem-kind">Jenis</Label>
              <SimpleSelect id="mem-kind" value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })} options={KINDS} ariaLabel="Jenis" className="w-full" /></div>
            <div className="space-y-1"><Label htmlFor="mem-scope">Berlaku untuk</Label>
              <SimpleSelect id="mem-scope" value={f.scope} onValueChange={(v) => setF({ ...f, scope: v })} ariaLabel="Berlaku untuk" className="w-full"
                options={[{ value: "pribadi", label: "Saya saja" }, ...(canCompany ? [{ value: "perusahaan", label: "Semua pengguna" }] : [])]} /></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} disabled={!f.content.trim()} data-testid="mem-save">Simpan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocDialog({ open, onOpenChange, onSaved }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("SOP");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setFile(null); setTitle(""); setCategory("SOP"); } }, [open]);
  const save = async () => {
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("category", "general");
      const att = unwrap(await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 }));
      const d = unwrap(await api.post("/ai/knowledge/docs", { attachment_id: att.id, title: title || undefined, category }, { timeout: 180000 }));
      toast.success(`Dokumen ditambahkan (${d.chunks} bagian)`); onOpenChange(false); onSaved();
    } catch (e) { toast.error(unwrapError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Tambah dokumen</DialogTitle>
          <DialogDescription>PDF, Word (.docx), teks, atau Excel. Asisten AI menjawab pertanyaan prosedur dengan mengutip dokumen ini.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="doc-file">File</Label>
            <Input id="doc-file" type="file" accept=".pdf,.docx,.txt,.md,.xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} data-testid="doc-file" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="doc-title">Judul (opsional)</Label>
              <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="doc-cat">Kategori</Label>
              <SimpleSelect id="doc-cat" value={category} onValueChange={setCategory} options={CATS} ariaLabel="Kategori" className="w-full" /></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} disabled={!file || busy} data-testid="doc-save">{busy ? "Membaca dokumen…" : "Tambah"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AIKnowledgePage() {
  const [tab, setTab] = useState("memori");
  const [mem, setMem] = useState(null);
  const [docs, setDocs] = useState(null);
  const [notes, setNotes] = useState(null);
  const [memOpen, setMemOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [docOpen, setDocOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null);

  const load = useCallback(() => {
    api.get("/ai/knowledge/memories", { scope: false }).then((r) => setMem(unwrap(r))).catch(() => setMem({ rows: [] }));
    api.get("/ai/knowledge/docs", { scope: false }).then((r) => setDocs(unwrap(r))).catch(() => setDocs({ rows: [] }));
    api.get("/ai/knowledge/research", { scope: false }).then((r) => setNotes(unwrap(r) || [])).catch(() => setNotes([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const del = async (url, label) => {
    if (!(await confirmDialog({ title: `Hapus ${label}?`, description: "Asisten AI tidak akan memakainya lagi.", confirmText: "Hapus", destructive: true }))) return;
    try { await api.delete(url); toast.success("Dihapus"); load(); } catch (e) { toast.error(unwrapError(e)); }
  };
  const search = async () => {
    if (q.trim().length < 2) return;
    try { setHits(unwrap(await api.get("/ai/knowledge/search", { params: { q }, scope: false })).hasil); } catch (e) { toast.error(unwrapError(e)); }
  };
  const canCompany = !!mem?.boleh_kelola_perusahaan;
  const canDocs = !!docs?.boleh_kelola;

  const actions = tab === "memori"
    ? <Button onClick={() => { setEditing(null); setMemOpen(true); }} data-testid="mem-add"><Plus /> Tambah memori</Button>
    : tab === "dokumen" && canDocs ? <Button onClick={() => setDocOpen(true)} data-testid="doc-add"><Upload /> Tambah dokumen</Button> : null;

  return (
    <div className="space-y-3 md:space-y-4" data-testid="ai-knowledge-page">
      <PageHeader icon={BookMarked} title="Memori & Pengetahuan" subtitle="Yang diingat & dirujuk Asisten AI: memori, dokumen SOP/kontrak/kebijakan, dan catatan riset" actions={actions} />
      <SegmentedFilter value={tab} onChange={setTab} options={TABS} ariaLabel="Bagian" testId="kb-tabs" />
      {tab === "memori" && (
        <Card className="p-0 overflow-hidden">
          <DataTable rows={mem?.rows || []} loading={!mem} rowTestIdPrefix="mem-row"
            columns={[
              { key: "content", label: "Memori", primary: true, render: (m) => <span className="whitespace-pre-wrap">{m.content}</span> },
              { key: "kind", label: "Jenis", render: (m) => m.kind },
              { key: "scope", label: "Berlaku", render: (m) => <StatusPill status={m.scope === "perusahaan" ? "active" : "draft"} label={m.scope === "perusahaan" ? "Semua pengguna" : "Saya"} /> },
              { key: "source", label: "Asal", hideOnMobile: true, render: (m) => (m.source === "chat" ? "Dari percakapan" : "Manual") },
              { key: "updated_at", label: "Diubah", hideOnMobile: true, render: (m) => fmtDate(m.updated_at) },
            ]}
            rowAction={(m) => ((m.scope === "pribadi" || canCompany) ? (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(m); setMemOpen(true); }}>Ubah</Button>
                <Button size="icon-sm" variant="ghost" onClick={() => del(`/ai/knowledge/memories/${m.id}`, "memori")} aria-label="Hapus memori"><Trash2 className="h-4 w-4" /></Button>
              </div>) : null)}
            empty={<EmptyState icon={BookMarked} title="Belum ada memori" description='Katakan "ingat bahwa…" di percakapan, atau tambah di sini.' />} />
        </Card>
      )}
      {tab === "dokumen" && (
        <Card className="p-0 overflow-hidden">
          <ListToolbar testId="kb-search-bar" search={(
            <div className="flex gap-2 w-full max-w-lg">
              <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Uji pencarian, mis. modal kas awal" aria-label="Cari di dokumen" />
              <Button variant="outline" onClick={search} aria-label="Cari"><Search /></Button>
            </div>)} />
          {hits && (
            <ul className="divide-y divide-border px-4" data-testid="kb-hits">
              {hits.length === 0 && <li className="py-3 text-sm text-muted-foreground">Tidak ditemukan.</li>}
              {hits.map((h, i) => (
                <li key={i} className="py-3 text-sm space-y-1">
                  <div className="font-medium">{h.dokumen || h.topik} <span className="text-xs text-muted-foreground">· {h.bagian || h.tanggal}</span></div>
                  <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{h.cuplikan || h.kutipan}</p>
                </li>
              ))}
            </ul>
          )}
          <DataTable rows={docs?.rows || []} loading={!docs} rowTestIdPrefix="doc-row"
            columns={[
              { key: "title", label: "Dokumen", primary: true, render: (d) => <span className="font-medium">{d.title}</span> },
              { key: "category", label: "Kategori" },
              { key: "chunks", label: "Bagian", numeric: true },
              { key: "filename", label: "File", hideOnMobile: true, render: (d) => <span className="text-xs">{d.filename}{d.note ? ` · ${d.note}` : ""}</span> },
              { key: "created_at", label: "Ditambahkan", hideOnMobile: true, render: (d) => fmtDate(d.created_at) },
            ]}
            rowAction={canDocs ? (d) => <Button size="icon-sm" variant="ghost" onClick={() => del(`/ai/knowledge/docs/${d.id}`, "dokumen")} aria-label={`Hapus ${d.title}`}><Trash2 className="h-4 w-4" /></Button> : undefined}
            empty={<EmptyState icon={BookMarked} title="Belum ada dokumen" description="Tambahkan SOP, kontrak supplier, atau kebijakan perusahaan." />} />
        </Card>
      )}
      {tab === "riset" && (
        <Card className="p-0 overflow-hidden">
          <DataTable rows={notes || []} loading={!notes} rowTestIdPrefix="note-row"
            renderExpanded={(n) => (
              <div className="text-sm space-y-2">
                <p className="whitespace-pre-wrap">{n.summary}</p>
                <ul className="text-xs space-y-0.5">{(n.sources || []).map((s, i) => (
                  <li key={i}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer noopener" className="underline inline-flex items-center gap-1">{s.title || s.url}<ExternalLink className="h-3 w-3" /></a> : s.title}{s.tanggal ? ` · ${s.tanggal}` : ""}</li>))}</ul>
              </div>)}
            columns={[
              { key: "topic", label: "Topik", primary: true, render: (n) => <span className="font-medium">{n.topic}</span> },
              { key: "sources", label: "Sumber", numeric: true, render: (n) => (n.sources || []).length },
              { key: "created_at", label: "Tanggal", render: (n) => fmtDate(n.created_at) },
            ]}
            rowAction={(n) => <Button size="icon-sm" variant="ghost" onClick={() => del(`/ai/knowledge/research/${n.id}`, "catatan riset")} aria-label={`Hapus ${n.topic}`}><Trash2 className="h-4 w-4" /></Button>}
            empty={<EmptyState icon={BookMarked} title="Belum ada catatan riset" description="Minta Asisten AI meriset harga pasar/regulasi lalu menyimpannya." />} />
        </Card>
      )}
      {tab === "privasi" && <PrivacyCard />}
      <MemoryDialog open={memOpen} onOpenChange={setMemOpen} initial={editing} canCompany={canCompany} onSaved={load} />
      <DocDialog open={docOpen} onOpenChange={setDocOpen} onSaved={load} />
    </div>
  );
}
