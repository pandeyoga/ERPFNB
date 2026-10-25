/**
 * UpdateBalanceModal — manual balance update or create new cash account.
 * Phase 11B.
 */
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import api, { unwrap } from "@/lib/api";
import { fmtRp } from "@/lib/format";
import { toast } from "sonner";
import { Save, X } from "lucide-react";

const TYPES = [
  { v: "bank",       l: "Bank" },
  { v: "petty_cash", l: "Petty Cash" },
  { v: "ewallet",    l: "E-Wallet" },
  { v: "other",      l: "Lainnya" },
];

export default function UpdateBalanceModal({ account, createMode = false, onClose, onSaved }) {
  const isCreate = createMode || !account;
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => ({
    code: "",
    name: account?.name || "",
    type: account?.type || "bank",
    bank_name: account?.bank_name || "",
    bank_account_no: account?.bank_account_no || "",
    current_balance: "",
    opening_balance: "0",
    notes: "",
  }));

  function updateField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setBusy(true);
    try {
      if (isCreate) {
        if (!form.name.trim()) { toast.error("Nama wajib"); return; }
        if (!form.current_balance) { toast.error("Saldo saat ini wajib diisi"); return; }
        await api.post("/finance/cash/accounts", {
          code: form.code || undefined,
          name: form.name,
          type: form.type,
          bank_name: form.bank_name || null,
          bank_account_no: form.bank_account_no || null,
          current_balance: Number(form.current_balance.toString().replace(/,/g, "")),
          opening_balance: Number((form.opening_balance || "0").toString().replace(/,/g, "")),
          notes: form.notes || null,
        });
        toast.success("Akun cash baru ditambahkan");
      } else {
        const balance = Number(form.current_balance.toString().replace(/,/g, ""));
        if (Number.isNaN(balance)) { toast.error("Saldo invalid"); return; }
        await api.post(`/finance/cash/accounts/${account.id}/balance`, {
          balance,
          source: "manual",
          notes: form.notes || null,
        });
        toast.success("Saldo diperbarui");
      }
      onSaved?.();
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal simpan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-md" data-testid="cash-modal">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? "Tambah Akun Cash" : `Update Saldo — ${account?.name}`}
          </DialogTitle>
        </DialogHeader>

        {!isCreate && (
          <div className="text-xs text-muted-foreground mb-3" data-testid="cash-modal-last-balance">
            Saldo terakhir: <span className="font-semibold tabular-nums">{fmtRp(account?.current_balance)}</span>
          </div>
        )}

        <div className="space-y-3">
          {isCreate && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="cash-code">Kode (opsional)</Label>
                  <Input id="cash-code" value={form.code} onChange={(e) => updateField("code", e.target.value)} placeholder="auto" data-testid="cash-modal-code" />
                </div>
                <div>
                  <Label htmlFor="cash-type">Tipe *</Label>
                  <Select value={form.type} onValueChange={(v) => updateField("type", v)}>
                    <SelectTrigger id="cash-type" data-testid="cash-modal-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="cash-name">Nama Akun *</Label>
                <Input id="cash-name" value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="BCA Operasional" data-testid="cash-modal-name" />
              </div>
              {form.type === "bank" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cash-bank-name">Bank</Label>
                    <Input id="cash-bank-name" value={form.bank_name} onChange={(e) => updateField("bank_name", e.target.value)} placeholder="BCA" data-testid="cash-modal-bank-name" />
                  </div>
                  <div>
                    <Label htmlFor="cash-bank-no">No. Rekening</Label>
                    <Input id="cash-bank-no" value={form.bank_account_no} onChange={(e) => updateField("bank_account_no", e.target.value)} data-testid="cash-modal-bank-account-no" />
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="cash-opening">Saldo pembukaan</Label>
                <Input id="cash-opening" value={form.opening_balance} onChange={(e) => updateField("opening_balance", e.target.value)} type="number" data-testid="cash-modal-opening-balance" />
                <p className="mt-1 text-xs text-muted-foreground">Saldo pada awal pencatatan (untuk riwayat). Kosongkan bila sama dengan 0.</p>
              </div>
            </>
          )}

          <div>
            <Label htmlFor="cash-current">{isCreate ? "Saldo saat ini *" : "Saldo baru *"}</Label>
            <Input id="cash-current" value={form.current_balance} onChange={(e) => updateField("current_balance", e.target.value)} type="number" placeholder="0" data-testid="cash-modal-current-balance" />
          </div>

          <div>
            <Label htmlFor="cash-notes">Catatan (opsional)</Label>
            <Textarea id="cash-notes" value={form.notes} onChange={(e) => updateField("notes", e.target.value)} rows={2} data-testid="cash-modal-notes" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy} data-testid="cash-modal-cancel">
            Batal
          </Button>
          <Button onClick={save} disabled={busy} data-testid="cash-modal-save">
            <Save /> {busy ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
