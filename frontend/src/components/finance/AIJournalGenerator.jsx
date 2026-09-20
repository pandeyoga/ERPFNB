/** AI Journal Generator — Generate journal entry dari natural language input. */
import { useState } from "react";
import { Sparkles, ArrowRight, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRp } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AIJournalGenerator({ onGenerated }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function generate() {
    if (!input.trim()) {
      toast.error("Masukkan deskripsi transaksi");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await api.post("/ai/generate-journal-entry", {
        user_input: input,
        context: {},
      });
      const data = unwrap(res);

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setResult(data);

      if (data.warnings && data.warnings.length > 0) {
        toast.warning(`AI generated dengan ${data.warnings.length} warning(s)`);
      } else {
        toast.success("Journal entry berhasil di-generate oleh AI!");
      }
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal generate");
    } finally {
      setLoading(false);
    }
  }

  function handleUseGenerated() {
    if (result && onGenerated) {
      onGenerated(result);
      setInput("");
      setResult(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-purple-700 dark:text-purple-400" />
          <h3 className="font-semibold">AI Journal Entry Generator</h3>
        </div>

        <Label className="text-xs uppercase text-muted-foreground">
          Deskripsi Transaksi (Natural Language)
        </Label>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Contoh:&#10;- Bayar sewa gedung The Bistro bulan Mei 2026 Rp 50 juta&#10;- Terima pembayaran customer invoice #INV-001 sebesar Rp 25 juta via transfer&#10;- Beli peralatan dapur untuk outlet MDS Rp 15 juta tunai&#10;- Bayar gaji karyawan bulan April total Rp 80 juta"
          className="glass-input mt-2 min-h-[120px] font-mono text-sm"
          data-testid="ai-journal-input"
        />

        <div className="mt-3 flex gap-2">
          <Button
            onClick={generate}
            disabled={loading || !input.trim()}
            className="rounded-full gap-2 bg-gradient-to-r from-purple-700 to-pink-700 hover:from-purple-800 hover:to-pink-800"
            data-testid="ai-journal-generate"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate dengan AI
              </>
            )}
          </Button>
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          💡 <strong>Tips:</strong> Semakin detail deskripsi, semakin akurat hasil AI. Sebutkan:
          outlet/brand, jenis transaksi (bayar/terima), nominal, dan periode.
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="glass-card p-5 border-2 border-purple-500/30">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-700 dark:text-purple-400" />
                <span className="font-semibold">AI Generated Journal Entry</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Confidence: {Math.round((result.confidence || 0) * 100)}%
              </div>
            </div>
            <ConfidenceBadge confidence={result.confidence || 0} />
          </div>

          {/* Entry Info */}
          <div className="bg-foreground/5 rounded-lg p-3 mb-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Date:</span>{" "}
                <span className="font-medium">{result.entry_date || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Description:</span>{" "}
                <span className="font-medium">{result.description || "—"}</span>
              </div>
            </div>
          </div>

          {/* Lines */}
          {result.lines && result.lines.length > 0 && (
            <div className="mb-3">
              <DataTable
                rows={result.lines.map((line, idx) => ({ ...line, _idx: idx }))}
                keyField="_idx"
                stickyHeader={false}
                rowTestIdPrefix="ai-je-line"
                empty={<EmptyState title="Tidak ada baris" description="AI belum menghasilkan baris jurnal." />}
                columns={[
                  { key: "coa", label: "COA", primary: true,
                    render: (line) => (
                      <div>
                        <div className="font-mono text-xs text-muted-foreground">{line.coa_code}</div>
                        <div className="font-medium">{line.coa_name}</div>
                      </div>
                    ) },
                  { key: "dr", label: "Debit", numeric: true,
                    render: (line) => <span className="font-semibold">{line.dr > 0 ? fmtRp(line.dr) : "—"}</span> },
                  { key: "cr", label: "Kredit", numeric: true,
                    render: (line) => <span className="font-semibold">{line.cr > 0 ? fmtRp(line.cr) : "—"}</span> },
                  { key: "memo", label: "Memo",
                    render: (line) => <span className="text-xs text-muted-foreground">{line.memo || "—"}</span> },
                ]}
                footer={
                  <tr className="font-bold border-t-2 border-border/70">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtRp(result.lines.reduce((s, l) => s + (l.dr || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtRp(result.lines.reduce((s, l) => s + (l.cr || 0), 0))}
                    </td>
                    <td></td>
                  </tr>
                }
              />
            </div>
          )}

          {/* Warnings */}
          {result.warnings && result.warnings.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
                    Warnings
                  </div>
                  <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
                    {result.warnings.map((w, idx) => (
                      <li key={idx}>• {w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleUseGenerated}
              className="rounded-full gap-2 flex-1"
              data-testid="ai-journal-use"
            >
              <ArrowRight className="h-4 w-4" /> Gunakan Journal Entry Ini
            </Button>
            <Button
              onClick={() => setResult(null)}
              variant="outline"
              className="rounded-full"
            >
              Generate Ulang
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence }) {
  let color = "slate";
  let label = "Low";
  let Icon = AlertTriangle;

  if (confidence >= 0.8) {
    color = "emerald";
    label = "High";
    Icon = CheckCircle2;
  } else if (confidence >= 0.5) {
    color = "amber";
    label = "Medium";
    Icon = AlertTriangle;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        `bg-${color}-100 dark:bg-${color}-900/30 text-${color}-700 dark:text-${color}-400`
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
