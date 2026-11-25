/** SalesSchemaEditor — Sheet editor for sales_input_schema rule.
 * 4 builder blocks: channels (reorderable), payment methods (toggle list),
 * revenue buckets (table), validation rules (accordion).
 */
import { useRef, useState } from "react";
import { ArrowUp, ArrowDown, Plus, Trash2, Tag, CreditCard, Layers, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import RuleEditorShell from "./RuleEditorShell";

const SEVERITIES = [
  { value: "warning", label: "Peringatan" },
  { value: "error", label: "Error (blok submit)" },
];

/** Input kode inline + tombol Tambah (menggantikan window.prompt bawaan browser). */
function AddCodeInline({ placeholder, label, existing = [], onAdd, testId, inputTestId }) {
  const [code, setCode] = useState("");
  const ref = useRef(null);
  function submit() {
    const c = code.trim().toUpperCase();
    if (!c) { ref.current?.focus(); return; }
    if (existing.includes(c)) { toast.error(`Kode ${c} sudah ada`); return; }
    onAdd(c);
    setCode("");
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        ref={ref}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        placeholder={placeholder}
        aria-label={label}
        className="h-8 w-[180px]"
        data-testid={inputTestId}
      />
      <Button variant="outline" size="sm" onClick={submit} data-testid={testId}>
        <Plus /> Tambah
      </Button>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <h5 className="text-sm font-semibold flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {children}
    </h5>
  );
}

function Reorderable({ items, onChange, renderItem }) {
  function move(idx, dir) {
    const next = [...items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={it.code || i} className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/50 px-2 py-1.5">
          <div className="flex flex-col">
            <Button
              type="button" variant="ghost" size="icon-sm" className="h-5 w-6"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              title="Naikkan urutan" aria-label={`Naikkan ${it.code}`}
              data-testid={`channel-up-${it.code}`}
            >
              <ArrowUp className="!h-3 !w-3" />
            </Button>
            <Button
              type="button" variant="ghost" size="icon-sm" className="h-5 w-6"
              onClick={() => move(i, 1)}
              disabled={i === items.length - 1}
              title="Turunkan urutan" aria-label={`Turunkan ${it.code}`}
              data-testid={`channel-down-${it.code}`}
            >
              <ArrowDown className="!h-3 !w-3" />
            </Button>
          </div>
          <div className="flex-1 min-w-0">{renderItem(it, i)}</div>
          <Button
            type="button" variant="ghost" size="icon-sm"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="hover:text-destructive"
            title="Hapus" aria-label={`Hapus ${it.code}`}
            data-testid={`channel-remove-${it.code}`}
          >
            <Trash2 className="!h-3.5 !w-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

export default function SalesSchemaEditor(props) {
  return (
    <RuleEditorShell
      {...props}
      variant="sheet"
      renderBody={({ ruleData, setRuleData }) => {
        const channels = ruleData.channels || [];
        const paymentMethods = ruleData.payment_methods || [];
        const buckets = ruleData.revenue_buckets || [];
        const validations = ruleData.validation_rules || [];

        function addChannel(code) {
          setRuleData({ ...ruleData, channels: [...channels, { code, name: code, active: true }] });
        }

        function addPayment(code) {
          setRuleData({ ...ruleData, payment_methods: [...paymentMethods, { code, name: code, active: true }] });
        }

        function addBucket() {
          setRuleData({
            ...ruleData,
            revenue_buckets: [...buckets, { code: `B${buckets.length + 1}`, name: "", required: false }],
          });
        }

        function addValidation() {
          setRuleData({
            ...ruleData,
            validation_rules: [
              ...validations,
              { id: `rule_${validations.length + 1}`, label: "", severity: "warning", active: true },
            ],
          });
        }

        return (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <SectionTitle icon={Tag}>Channel Penjualan</SectionTitle>
                <AddCodeInline
                  placeholder="Kode, mis. GOFOOD"
                  label="Kode channel baru"
                  existing={channels.map((c) => c.code)}
                  onAdd={addChannel}
                  testId="sales-add-channel-btn"
                  inputTestId="sales-add-channel-input"
                />
              </div>
              {channels.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada channel. Tambahkan ‘Dine-in’ atau ‘GoFood’.</p>
              ) : (
                <Reorderable
                  items={channels}
                  onChange={(next) => setRuleData({ ...ruleData, channels: next })}
                  renderItem={(c, i) => (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium tabular-nums px-1.5 py-0.5 rounded bg-foreground/[0.05]">{c.code}</span>
                      <Input
                        value={c.name}
                        onChange={(e) => {
                          const next = [...channels];
                          next[i] = { ...c, name: e.target.value };
                          setRuleData({ ...ruleData, channels: next });
                        }}
                        className="h-8"
                        placeholder="Nama channel…"
                        aria-label={`Nama channel ${c.code}`}
                        data-testid={`channel-name-${c.code}`}
                      />
                      <Switch
                        checked={c.active !== false}
                        onCheckedChange={(v) => {
                          const next = [...channels];
                          next[i] = { ...c, active: v };
                          setRuleData({ ...ruleData, channels: next });
                        }}
                        aria-label={`Channel ${c.code} aktif`}
                        data-testid={`channel-active-${c.code}`}
                      />
                    </div>
                  )}
                />
              )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <SectionTitle icon={CreditCard}>Metode Pembayaran</SectionTitle>
                <AddCodeInline
                  placeholder="Kode, mis. QRIS"
                  label="Kode metode bayar baru"
                  existing={paymentMethods.map((p) => p.code)}
                  onAdd={addPayment}
                  testId="sales-add-payment-btn"
                  inputTestId="sales-add-payment-input"
                />
              </div>
              <div className="flex flex-wrap gap-2" data-testid="sales-payment-list">
                {paymentMethods.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Tambahkan metode bayar (Cash, QRIS, dll). Klik chip untuk aktif/nonaktifkan.</p>
                ) : paymentMethods.map((pm, i) => (
                  <button
                    key={pm.code}
                    type="button"
                    onClick={() => {
                      const next = [...paymentMethods];
                      next[i] = { ...pm, active: !pm.active };
                      setRuleData({ ...ruleData, payment_methods: next });
                    }}
                    aria-pressed={pm.active !== false}
                    title={pm.active !== false ? "Aktif — klik untuk nonaktifkan" : "Nonaktif — klik untuk aktifkan"}
                    className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-[13px] border ${pm.active !== false ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "border-border/50 bg-foreground/[0.03] text-muted-foreground"}`}
                    data-testid={`payment-toggle-${pm.code}`}
                  >
                    <span className="font-medium tabular-nums text-xs">{pm.code}</span>
                    <span>{pm.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionTitle icon={Layers}>Bucket Pendapatan</SectionTitle>
                <Button variant="outline" size="sm" onClick={addBucket} data-testid="sales-add-bucket-btn">
                  <Plus /> Tambah
                </Button>
              </div>
              {buckets.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada bucket. Contoh: Food, Beverage.</p>
              ) : (
                <div className="space-y-2">
                  {buckets.map((b, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <Input
                        className="col-span-3 h-8 text-xs"
                        aria-label={`Kode bucket ${i + 1}`}
                        value={b.code}
                        onChange={(e) => {
                          const next = [...buckets];
                          next[i] = { ...b, code: e.target.value.toUpperCase() };
                          setRuleData({ ...ruleData, revenue_buckets: next });
                        }}
                        placeholder="KODE"
                        data-testid={`bucket-code-${i}`}
                      />
                      <Input
                        className="col-span-6 h-8"
                        value={b.name}
                        onChange={(e) => {
                          const next = [...buckets];
                          next[i] = { ...b, name: e.target.value };
                          setRuleData({ ...ruleData, revenue_buckets: next });
                        }}
                        placeholder="Nama bucket…"
                        aria-label={`Nama bucket ${i + 1}`}
                        data-testid={`bucket-name-${i}`}
                      />
                      <div className="col-span-2 flex items-center gap-2">
                        <Switch
                          checked={!!b.required}
                          onCheckedChange={(v) => {
                            const next = [...buckets];
                            next[i] = { ...b, required: v };
                            setRuleData({ ...ruleData, revenue_buckets: next });
                          }}
                          aria-label={`Bucket ${i + 1} wajib`}
                          data-testid={`bucket-required-${i}`}
                        />
                        <span className="text-xs text-muted-foreground">Wajib</span>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="col-span-1"
                        title="Hapus bucket" aria-label={`Hapus bucket ${i + 1}`}
                        onClick={() => setRuleData({ ...ruleData, revenue_buckets: buckets.filter((_, j) => j !== i) })}
                        data-testid={`bucket-remove-${i}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionTitle icon={ShieldCheck}>Aturan Validasi</SectionTitle>
                <Button variant="outline" size="sm" onClick={addValidation} data-testid="sales-add-validation-btn">
                  <Plus /> Tambah
                </Button>
              </div>
              {validations.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada aturan validasi.</p>
              ) : (
                <div className="space-y-2">
                  {validations.map((v, i) => (
                    <div key={v.id || i} className="grid grid-cols-12 gap-2 items-center">
                      <Input
                        className="col-span-7 h-8"
                        value={v.label}
                        onChange={(e) => {
                          const next = [...validations];
                          next[i] = { ...v, label: e.target.value };
                          setRuleData({ ...ruleData, validation_rules: next });
                        }}
                        placeholder="Pesan validasi…"
                        aria-label={`Pesan validasi ${i + 1}`}
                        data-testid={`validation-label-${i}`}
                      />
                      <div className="col-span-3">
                        <Select
                          value={v.severity || "warning"}
                          onValueChange={(val) => {
                            const next = [...validations];
                            next[i] = { ...v, severity: val };
                            setRuleData({ ...ruleData, validation_rules: next });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs" aria-label={`Tingkat validasi ${i + 1}`} data-testid={`validation-severity-${i}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SEVERITIES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1">
                        <Switch
                          checked={v.active !== false}
                          onCheckedChange={(val) => {
                            const next = [...validations];
                            next[i] = { ...v, active: val };
                            setRuleData({ ...ruleData, validation_rules: next });
                          }}
                          aria-label={`Validasi ${i + 1} aktif`}
                          data-testid={`validation-active-${i}`}
                        />
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="col-span-1"
                        title="Hapus aturan validasi" aria-label={`Hapus aturan validasi ${i + 1}`}
                        onClick={() => setRuleData({ ...ruleData, validation_rules: validations.filter((_, j) => j !== i) })}
                        data-testid={`validation-remove-${i}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }}
      renderPreview={({ ruleData }) => {
        const channels = (ruleData.channels || []).filter((c) => c.active !== false);
        const pms = (ruleData.payment_methods || []).filter((p) => p.active !== false);
        const buckets = ruleData.revenue_buckets || [];
        return (
          <div className="text-xs space-y-2">
            <p>
              Daily Sales akan menampilkan <strong>{channels.length}</strong> channel,{" "}
              <strong>{pms.length}</strong> metode bayar, dan <strong>{buckets.length}</strong> bucket pendapatan.
            </p>
            <p className="text-muted-foreground">
              {channels.slice(0, 4).map((c) => c.name).join(", ")}
              {channels.length > 4 ? `, +${channels.length - 4} lainnya` : ""}
            </p>
          </div>
        );
      }}
    />
  );
}
