import { useEffect, useState } from "react";
import api, { unwrap } from "@/lib/api";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import { Hash } from "lucide-react";
import { InlineHelp } from "@/components/shared/InlineHelp";

import { fetchAll } from "@/lib/api";

const RESET_LABEL = { monthly: "bulanan", yearly: "tahunan", daily: "harian", never: "tidak pernah" };

export default function NumberSeries({ embedded = false } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll("/master/number-series")
      .then(r => setItems(unwrap(r) || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-3" data-testid="number-series-page">
      {!embedded && (
        <PageHeader icon={Hash} title="Number Series" subtitle="Format penomoran dokumen otomatis per jenis dokumen." />
      )}
      <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
        Nomor dokumen dibuat otomatis mengikuti format di bawah (hanya-baca).
        <InlineHelp id="number-series-format" size="xs" placement="right" />
      </p>
      {loading ? <LoadingState rows={6} /> : (
        items.length === 0 ? <EmptyState title="Belum ada series" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" data-testid="number-series-grid">
            {items.map((s) => (
              <div key={s.id} className="glass-card p-3" data-testid={`number-series-card-${s.code}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm md:text-base font-semibold flex items-center gap-1.5">
                    <Hash className="h-4 w-4 text-aurora" /> {s.code}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-foreground/10 text-xs font-medium tabular-nums" title="Nomor urut terakhir">
                    No. terakhir: {s.current_value}
                  </span>
                </div>
                <div className="text-xs font-medium tabular-nums text-muted-foreground mt-1 truncate" title={s.format}>{s.format}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Padding {s.padding} · Reset {RESET_LABEL[s.reset] || s.reset}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
