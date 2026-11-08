/** Kondisi barang per baris GR: qty ditolak + alasan + catatan + foto bukti (Tahap 2 sourcing — kualitas terukur).
 *  Barang ditolak tidak masuk stok & tagihan, dan tidak mengurangi sisa PO. Datanya dipakai skor kualitas supplier. */
import { useState } from "react";
import { CheckCircle2, AlertTriangle, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import SimpleSelect from "@/components/shared/SimpleSelect";
import FileDropZone from "@/components/shared/FileDropZone";

/** Sama dengan GR_REJECT_REASONS di backend/services/procurement_service.py. */
export const REJECT_REASONS = [
  { value: "busuk", label: "Busuk / tidak segar" },
  { value: "rusak", label: "Rusak / cacat" },
  { value: "spesifikasi", label: "Tidak sesuai spesifikasi" },
  { value: "kedaluwarsa", label: "Kedaluwarsa / tanggal pendek" },
  { value: "suhu", label: "Suhu tidak sesuai" },
  { value: "kemasan", label: "Kemasan rusak" },
  { value: "salah_item", label: "Salah item" },
  { value: "lainnya", label: "Lainnya" },
];
export const rejectReasonLabel = (v) => REJECT_REASONS.find((r) => r.value === v)?.label || v || "";

export default function GRConditionCell({ line, index, onChange }) {
  const [open, setOpen] = useState(false);
  const rejected = Number(line.qty_rejected || 0);
  const set = (key, val) => onChange(index, key, val);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" aria-label={`Kondisi barang baris ${index + 1}`}
          className={rejected > 0 ? "border-amber-500/60 text-amber-800 dark:text-amber-400" : undefined}
          data-testid={`gr-line-condition-${index}`}>
          {rejected > 0 ? <AlertTriangle /> : <CheckCircle2 className="text-emerald-700 dark:text-emerald-400" />}
          {rejected > 0 ? `${rejected} ditolak` : line.condition_note ? "Ada catatan" : "Sesuai"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] space-y-3" data-testid={`gr-line-condition-panel-${index}`}>
        <div>
          <p className="text-sm font-semibold">Kondisi barang</p>
          <p className="text-xs text-muted-foreground">
            Isi Qty Diterima dengan barang yang baik saja. Barang ditolak tidak masuk stok & tagihan, dan sisa PO tetap terbuka.
          </p>
        </div>
        <div className="grid grid-cols-[7rem_1fr] gap-2">
          <div className="space-y-1">
            <Label htmlFor={`gr-rej-qty-${index}`} className="text-xs">Qty ditolak ({line.unit})</Label>
            <Input id={`gr-rej-qty-${index}`} type="number" min="0" value={line.qty_rejected ?? 0}
              onChange={(e) => set("qty_rejected", e.target.value)}
              className="glass-input text-right tabular-nums" data-testid={`gr-line-rejected-${index}`} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Alasan{rejected > 0 ? " *" : ""}</Label>
            <SimpleSelect value={line.reject_reason || ""} onValueChange={(v) => set("reject_reason", v || "")}
              options={[{ value: "", label: "Pilih alasan" }, ...REJECT_REASONS]} ariaLabel="Alasan ditolak"
              className="glass-input w-full" testId={`gr-line-reason-${index}`} />
          </div>
        </div>
        {rejected > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums" data-testid={`gr-line-delivered-${index}`}>
            Total datang {Number(line.qty_received || 0) + rejected} {line.unit} = diterima {Number(line.qty_received || 0)} + ditolak {rejected}
          </p>
        )}
        <div className="space-y-1">
          <Label htmlFor={`gr-note-${index}`} className="text-xs">Catatan kondisi</Label>
          <Input id={`gr-note-${index}`} value={line.condition_note || ""} placeholder="mis. 3 ikat layu, suhu 9°C"
            onChange={(e) => set("condition_note", e.target.value)} className="glass-input" data-testid={`gr-line-note-${index}`} />
        </div>
        {rejected > 0 && (
          <FileDropZone compact category="gr_quality" accept="image/jpeg,image/png,image/webp"
            maxSizeMB={8} label="Foto bukti" description="JPG / PNG / WEBP — maks 8 MB"
            value={line.photo || null}
            onUploaded={(att) => { set("photo", att); set("photo_id", att?.id || null); }}
            onCleared={() => { set("photo", null); set("photo_id", null); }}
            testId={`gr-line-photo-${index}`} />
        )}
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setOpen(false)} data-testid={`gr-line-condition-done-${index}`}>Selesai</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Ringkasan kondisi baris GR yang sudah diposting (daftar GR, detail). */
export function GRLineCondition({ line }) {
  const rejected = Number(line.qty_rejected || 0);
  if (!rejected && !line.condition_note) return null;
  const backend = process.env.REACT_APP_BACKEND_URL || "";
  return (
    <span className="block text-xs">
      {rejected > 0 && (
        <span className="text-amber-800 dark:text-amber-400 font-medium">
          Ditolak {rejected} {line.unit}{line.reject_reason ? ` · ${rejectReasonLabel(line.reject_reason)}` : ""}
        </span>
      )}
      {line.condition_note && <span className="text-muted-foreground">{rejected > 0 ? " — " : ""}{line.condition_note}</span>}
      {line.photo_id && (
        <a href={`${backend}/api/uploads/${line.photo_id}`} target="_blank" rel="noreferrer"
          className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline">
          <ImageIcon className="h-3 w-3" /> foto
        </a>
      )}
    </span>
  );
}
