/** Item Price History — view & manage historical pricing untuk Market List. */
import { useEffect, useState } from "react";
import { Plus, TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";

export default function ItemPriceHistory({ itemId, currentPrice, unit }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    price: "",
    effective_from: todayJakartaISO(),
    notes: "",
  });

  useEffect(() => {
    if (itemId) {
      loadHistory();
    }
  }, [itemId]);

  async function loadHistory() {
    setLoading(true);
    try {
      const res = await api.get(`/inventory/items/${itemId}/pricing`);
      setHistory(unwrap(res) || []);
    } catch (e) {
      toast.error("Gagal load price history");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPrice() {
    if (!form.price || parseFloat(form.price) <= 0) {
      toast.error("Price harus > 0");
      return;
    }

    if (!form.effective_from) {
      toast.error("Effective date wajib diisi");
      return;
    }

    setSaving(true);
    try {
      await api.post(`/inventory/items/${itemId}/pricing`, {
        unit: unit || "pcs",
        price: parseFloat(form.price),
        effective_from: form.effective_from,
        notes: form.notes,
      });

      toast.success("Price berhasil ditambahkan");
      setShowAddModal(false);
      setForm({ price: "", effective_from: todayJakartaISO(), notes: "" });
      loadHistory();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal add price");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Price History</h3>
          <div className="text-sm text-muted-foreground mt-0.5">
            Current Price: <span className="font-semibold">{fmtRp(currentPrice || 0)}</span>
          </div>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="rounded-full gap-2"
          size="sm"
          data-testid="add-price-btn"
        >
          <Plus className="h-4 w-4" /> Add New Price
        </Button>
      </div>

      {loading && <LoadingState rows={3} />}

      {!loading && history.length === 0 && (
        <EmptyState
          icon={Calendar}
          title="Belum ada price history"
          description="Klik 'Add New Price' untuk menambahkan harga baru dengan effective date."
        />
      )}

      {!loading && history.length > 0 && (
        <div className="glass-card overflow-hidden">
          <DataTable
            rows={history.map((item, idx) => ({ ...item, _key: item.id || idx }))}
            keyField="_key"
            rowTestIdPrefix="price-row"
            rowClassName={(item) => item.is_active ? "bg-emerald-50 dark:bg-emerald-900/10" : ""}
            columns={[
              { key: "effective_from", label: "Effective From", primary: true,
                render: (item) => <span className="font-medium">{fmtDate(item.effective_from)}</span> },
              { key: "effective_to", label: "Effective To",
                render: (item) => <span className="text-muted-foreground">{item.effective_to ? fmtDate(item.effective_to) : "—"}</span> },
              { key: "price", label: "Price", numeric: true, sortable: true,
                render: (item) => <span className="font-semibold">{fmtRp(item.price)}</span> },
              { key: "previous_price", label: "Previous Price", numeric: true,
                render: (item) => <span className="text-muted-foreground">{item.previous_price ? fmtRp(item.previous_price) : "—"}</span> },
              { key: "variance", label: "Variance", numeric: true,
                render: (item) => (item.variance !== null && item.variance !== undefined)
                  ? <VarianceBadge variance={item.variance} />
                  : <span className="text-muted-foreground">—</span> },
              { key: "status", label: "Status",
                render: (item) => item.is_active ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    Closed
                  </span>
                ) },
              { key: "notes", label: "Notes",
                render: (item) => <span className="text-xs text-muted-foreground max-w-[200px] truncate inline-block align-top">{item.notes || "—"}</span> },
            ]}
          />
        </div>
      )}

      {/* Add Price Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Price</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Price (Rp) *</Label>
              <Input
                type="number"
                min="0"
                step="100"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="50000"
                className="glass-input mt-1"
                data-testid="price-input"
              />
            </div>

            <div>
              <Label className="text-xs uppercase text-muted-foreground">Effective From *</Label>
              <Input
                type="date"
                value={form.effective_from}
                onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
                className="glass-input mt-1"
                data-testid="effective-date-input"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Harga akan berlaku mulai tanggal ini
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase text-muted-foreground">Notes (optional)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="mis: Kenaikan harga dari supplier, penyesuaian inflasi, dll"
                className="glass-input mt-1 min-h-[60px]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleAddPrice}
                disabled={saving}
                className="flex-1 rounded-full"
                data-testid="save-price-btn"
              >
                {saving ? "Saving..." : "Save Price"}
              </Button>
              <Button
                onClick={() => setShowAddModal(false)}
                variant="outline"
                className="rounded-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VarianceBadge({ variance }) {
  const value = parseFloat(variance);
  
  if (Math.abs(value) < 0.01) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
        <Minus className="h-3 w-3" />
        0%
      </span>
    );
  }

  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
        <TrendingUp className="h-3 w-3" />
        +{value.toFixed(1)}%
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
      <TrendingDown className="h-3 w-3" />
      {value.toFixed(1)}%
    </span>
  );
}
