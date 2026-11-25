import { useEffect, useState } from "react";
import api, { unwrap } from "@/lib/api";
import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
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
      <PageHeader icon={Hash} title="Number Series"
        subtitle="Format penomoran dokumen otomatis per jenis dokumen (hanya-baca)."
        actions={<InlineHelp id="number-series-format" size="sm" placement="bottom-end" />} />
      {/* Data sejenis yang dibandingkan per kolom = tabel, bukan grid kartu (DESIGN_SYSTEM §10.3). */}
      <div className="glass-card overflow-hidden" data-testid="number-series-grid">
        <DataTable
          columns={[
            { key: "code", label: "Kode", primary: true, sortable: true,
              render: (s) => <span className="font-semibold">{s.code}</span> },
            { key: "format", label: "Format", render: (s) => <span className="tabular-nums text-muted-foreground">{s.format}</span> },
            { key: "current_value", label: "No. terakhir", numeric: true, sortable: true },
            { key: "padding", label: "Padding", numeric: true },
            { key: "reset", label: "Reset", render: (s) => RESET_LABEL[s.reset] || s.reset },
          ]}
          rows={items}
          keyField="code"
          loading={loading}
          rowTestIdPrefix="number-series-card"
          defaultSort={{ key: "code", dir: "asc" }}
          empty={<EmptyState title="Belum ada series" />}
        />
      </div>
    </div>
  );
}
