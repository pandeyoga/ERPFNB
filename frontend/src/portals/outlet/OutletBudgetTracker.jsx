/**
 * Outlet — Budget Tracker.
 *
 * Outlet manager view: current week + month budget vs actual,
 * with per-bucket gauge, recent KDO/BDO/FDO PRs, and request-increase CTA.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Wallet, Calendar, TrendingUp, AlertCircle, Plus, Clock,
  RefreshCw, FileText, History, MessageSquare, ChevronRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtRp } from "@/lib/format";
import DataTable from "@/components/shared/DataTable";
import {
  BUCKETS, BUCKET_LABELS, BUCKET_COLORS,
  paceColor, paceBg, fetchMyCurrent, submitIncreaseRequest,
  fetchIncreaseRequests,
} from "@/lib/outletBudgetApi";
import dayjs from "dayjs";
import { useOutletScopeCtx } from "./OutletScopeContext";

export default function OutletBudgetTracker() {
  const { user } = useAuth();
  const { outletId: scopeOutletId, scopedOutlets } = useOutletScopeCtx();
  const [view, setView] = useState("monthly");
  const [data, setData] = useState(null); // { outlet_id, weekly, monthly }
  const [allOutletsData, setAllOutletsData] = useState([]); // items from my-current
  const [loading, setLoading] = useState(true);
  const [recentPRs, setRecentPRs] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [openRequest, setOpenRequest] = useState(null); // { bucket } object
  const [reqAmount, setReqAmount] = useState("");
  const [reqReason, setReqReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchMyCurrent();
      const items = res.items || [];
      setAllOutletsData(items);
      // Pick the budget data for the scope-selected outlet, fallback to first
      let target = null;
      if (scopeOutletId) {
        target = items.find(i => i.outlet_id === scopeOutletId) || null;
      }
      if (!target) target = items[0] || null;
      setData(target);
      const oid = target?.outlet_id;
      if (oid) {
        const prRes = await api.get("/procurement/prs", {
          params: { per_page: 10, outlet_id: oid },
        });
        const items2 = (prRes.data.data?.items || []).filter(
          (p) => ["kdo", "fdo", "bdo"].includes((p.source || "").toLowerCase()),
        );
        setRecentPRs(items2.slice(0, 10));
      } else {
        setRecentPRs([]);
      }
      // my pending+recent requests (filtered by outlet if scope selected)
      const reqRes = await fetchIncreaseRequests(scopeOutletId ? { outletId: scopeOutletId } : {});
      setMyRequests((reqRes.items || []).slice(0, 10));
    } catch (e) {
      toast.error("Gagal memuat budget");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [scopeOutletId]);

  const current = view === "weekly" ? data?.weekly : data?.monthly;
  const summary = current?.pace?.summary;

  const submitReq = async () => {
    if (!openRequest || !current) return;
    const amt = parseFloat(reqAmount);
    if (!amt || amt <= 0) {
      toast.error("Jumlah harus > 0");
      return;
    }
    if (reqReason.trim().length < 10) {
      toast.error("Alasan minimal 10 karakter");
      return;
    }
    setSubmitting(true);
    try {
      await submitIncreaseRequest({
        outlet_id: current.outlet_id,
        budget_id: current.id,
        bucket: openRequest.bucket,
        requested_amount: amt,
        reason: reqReason,
      });
      toast.success("Request terkirim ke Executive.");
      setOpenRequest(null);
      setReqAmount("");
      setReqReason("");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal kirim request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="outlet-budget-tracker">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-aurora" />
            Budget Saya
          </h2>
          <p className="text-muted-foreground text-sm">
            Cost control budget yang diberikan Executive. Tidak ada carryover (sisa hangus).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="weekly" data-testid="tab-weekly">Mingguan</TabsTrigger>
          <TabsTrigger value="monthly" data-testid="tab-monthly">Bulanan</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Memuat…</CardContent></Card>
      ) : !current ? (
        <NoBudgetCard view={view} />
      ) : (
        <>
          {/* Hero summary */}
          <Card className="border-aurora/30 bg-gradient-to-br from-aurora/10 to-transparent">
            <CardContent className="pt-5 pb-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                    <span>{view === "weekly" ? "Minggu Berjalan" : "Bulan Berjalan"}</span>
                    {current.budget_mode === "combined" ? (
                      <Badge variant="outline" className="border-sky-500/40 text-sky-600 dark:text-sky-400 text-[10px] px-1.5 py-0">
                        Mode Gabungan
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0">
                        Mode Per-Bucket
                      </Badge>
                    )}
                  </div>
                  <div className="text-3xl font-bold tabular-nums mt-1" data-testid="hero-total-budget">
                    {fmtRp(summary?.total_budget)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {current.period_start} → {current.period_end}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Terpakai</div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {fmtRp(summary?.total_actual)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {summary?.days_elapsed}/{summary?.days_total} hari • sisa {summary?.days_remaining} hari
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <Progress
                  value={Math.min(100, ((summary?.total_actual || 0) / Math.max(1, summary?.total_budget || 1)) * 100)}
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Bucket cards — adaptive by mode */}
          {current.budget_mode === "combined" ? (
            <CombinedBudgetCard
              pace={current.pace?.combined}
              actuals={current.actuals}
              onRequestIncrease={() => {
                setOpenRequest({ bucket: "combined" });
                setReqAmount("");
                setReqReason("");
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {BUCKETS.map((bk) => (
                <BucketCard
                  key={bk}
                  bucket={bk}
                  pace={current.pace?.[bk]}
                  onRequestIncrease={() => {
                    setOpenRequest({ bucket: bk });
                    setReqAmount("");
                    setReqReason("");
                  }}
                />
              ))}
            </div>
          )}

          {/* Recent PRs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" /> PR Terbaru
              </CardTitle>
              <CardDescription>10 purchase request KDO/FDO/BDO terakhir.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <DataTable
                rows={recentPRs.map((pr) => ({ ...pr, _total: (pr.lines || []).reduce((s, l) => s + (Number(l.qty || 0) * Number(l.unit_cost || 0)), 0) }))}
                keyField="id"
                stickyHeader={false}
                rowTestIdPrefix="obt-pr-row"
                empty={<div className="py-6 text-center text-muted-foreground text-sm">Belum ada PR.</div>}
                columns={[
                  { key: "date", label: "Tanggal", primary: true,
                    render: (pr) => <span className="text-xs">{pr.request_date || dayjs(pr.created_at).format("YYYY-MM-DD")}</span> },
                  { key: "doc_no", label: "Doc No",
                    render: (pr) => <span className="font-mono text-xs">{pr.doc_no}</span> },
                  { key: "source", label: "Source",
                    render: (pr) => (
                      <Badge variant="outline" style={{ borderColor: BUCKET_COLORS[pr.source] }}>
                        {(pr.source || "").toUpperCase()}
                      </Badge>
                    ) },
                  { key: "status", label: "Status",
                    render: (pr) => <span className="text-xs capitalize">{pr.status.replace(/_/g, " ")}</span> },
                  { key: "_total", label: "Total", numeric: true, sortable: true,
                    render: (pr) => fmtRp(pr._total) },
                ]}
              />
            </CardContent>
          </Card>

          {/* My increase requests */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Request Penambahan Saya
              </CardTitle>
              <CardDescription>Status request yang Anda kirim ke Executive.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <DataTable
                rows={myRequests}
                keyField="id"
                stickyHeader={false}
                rowTestIdPrefix="obt-req-row"
                empty={<div className="py-6 text-center text-muted-foreground text-sm">Belum ada request.</div>}
                columns={[
                  { key: "requested_at", label: "Tanggal", primary: true, sortable: true,
                    render: (r) => <span className="text-xs whitespace-nowrap">{dayjs(r.requested_at).format("DD MMM HH:mm")}</span> },
                  { key: "bucket", label: "Bucket",
                    render: (r) => (
                      <Badge variant="outline" style={{ borderColor: r.bucket === "combined" ? "#0ea5e9" : BUCKET_COLORS[r.bucket] }}>
                        {r.bucket === "combined" ? "GABUNGAN" : r.bucket.toUpperCase()}
                      </Badge>
                    ) },
                  { key: "requested_amount", label: "Diminta", numeric: true, sortable: true,
                    render: (r) => fmtRp(r.requested_amount) },
                  { key: "approved_amount", label: "Disetujui", numeric: true,
                    render: (r) => r.approved_amount != null ? fmtRp(r.approved_amount) : "—" },
                  { key: "status", label: "Status",
                    render: (r) => <span className="text-xs capitalize">{r.status}</span> },
                  { key: "reason", label: "Alasan",
                    render: (r) => <span className="text-xs max-w-[260px] truncate inline-block align-middle">{r.reason}</span> },
                ]}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Increase request dialog */}
      <Dialog open={!!openRequest} onOpenChange={(o) => !o && setOpenRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Request Penambahan Budget {openRequest?.bucket === "combined" ? "GABUNGAN" : openRequest?.bucket?.toUpperCase()}
            </DialogTitle>
            <DialogDescription>
              Executive akan meninjau request ini. Jika disetujui, budget akan langsung bertambah dan PR bisa diteruskan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="req-amount">Jumlah yang dibutuhkan (Rp)</Label>
              <Input
                id="req-amount" type="number" min="0" step="100000"
                value={reqAmount} onChange={(e) => setReqAmount(e.target.value)}
                placeholder="Misal: 5000000" className="mt-1"
                data-testid="input-req-amount"
              />
            </div>
            <div>
              <Label htmlFor="req-reason">Alasan (minimal 10 karakter)</Label>
              <Textarea
                id="req-reason" rows={3} value={reqReason}
                onChange={(e) => setReqReason(e.target.value)}
                placeholder="Misal: Promo akhir pekan menambah demand sayur dan daging 30%…"
                className="mt-1"
                data-testid="input-req-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenRequest(null)} disabled={submitting}>Batal</Button>
            <Button onClick={submitReq} disabled={submitting} className="pill-active" data-testid="btn-submit-request">
              {submitting ? "Mengirim…" : "Kirim Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CombinedBudgetCard({ pace, actuals, onRequestIncrease }) {
  const pct = pace?.pct_used || 0;
  const status = pace?.status || "green";
  return (
    <Card className={`border ${paceBg(status)}`} data-testid="bucket-card-combined">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="text-sky-600 dark:text-sky-400 font-semibold">Budget Gabungan (KDO + FDO + BDO)</span>
          <Badge variant="outline" className={paceColor(status)}>{pct.toFixed(0)}%</Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          1 pool yang dipakai bersama oleh semua jenis PR (kitchen/floor/bar).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-3xl font-bold tabular-nums text-sky-600 dark:text-sky-400">
              {fmtRp(pace?.remaining || 0)}
            </div>
            <div className="text-xs text-muted-foreground">sisa dari {fmtRp(pace?.budget || 0)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Aktual</div>
            <div className="text-lg font-semibold tabular-nums">{fmtRp(pace?.actual || 0)}</div>
            <div className="text-xs text-muted-foreground">Proyeksi: {fmtRp(pace?.projected_eop || 0)}</div>
          </div>
        </div>
        <Progress value={Math.min(100, pct)} className="h-2.5" />
        {actuals && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40 text-xs">
            <BreakdownPill label="KDO" value={actuals.kdo || 0} color={BUCKET_COLORS.kdo} />
            <BreakdownPill label="FDO" value={actuals.fdo || 0} color={BUCKET_COLORS.fdo} />
            <BreakdownPill label="BDO" value={actuals.bdo || 0} color={BUCKET_COLORS.bdo} />
          </div>
        )}
        <Button
          size="sm" variant="outline" className="w-full gap-1 mt-1"
          onClick={onRequestIncrease}
          data-testid="btn-request-increase-combined"
        >
          <Plus className="h-3.5 w-3.5" /> Request Penambahan
        </Button>
      </CardContent>
    </Card>
  );
}

function BreakdownPill({ label, value, color }) {
  return (
    <div className="flex items-center justify-between rounded-md px-2 py-1.5 bg-muted/30">
      <span className="font-mono uppercase text-[10px]" style={{ color }}>{label}</span>
      <span className="tabular-nums font-medium">{fmtRp(value)}</span>
    </div>
  );
}

function BucketCard({ bucket, pace, onRequestIncrease }) {
  const color = BUCKET_COLORS[bucket];
  const label = BUCKET_LABELS[bucket];
  const pct = pace?.pct_used || 0;
  const status = pace?.status || "green";
  return (
    <Card className={`border ${paceBg(status)}`} data-testid={`bucket-card-${bucket}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span style={{ color }} className="font-mono uppercase">{bucket}</span>
          <Badge variant="outline" className={paceColor(status)}>{pct.toFixed(0)}%</Badge>
        </CardTitle>
        <CardDescription className="text-xs">{label}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
          <div className="text-2xl font-bold tabular-nums" style={{ color }}>
            {fmtRp(pace?.remaining || 0)}
          </div>
          <div className="text-xs text-muted-foreground">sisa dari {fmtRp(pace?.budget || 0)}</div>
        </div>
        <Progress value={Math.min(100, pct)} className="h-2" />
        <div className="text-xs flex items-center justify-between text-muted-foreground">
          <span>Aktual: {fmtRp(pace?.actual || 0)}</span>
          <span>Proyeksi: {fmtRp(pace?.projected_eop || 0)}</span>
        </div>
        <Button
          size="sm" variant="outline" className="w-full gap-1 mt-1"
          onClick={onRequestIncrease}
          data-testid={`btn-request-increase-${bucket}`}
        >
          <Plus className="h-3.5 w-3.5" /> Request Penambahan
        </Button>
      </CardContent>
    </Card>
  );
}

function NoBudgetCard({ view }) {
  return (
    <Card className="border-amber-500/30 bg-amber-500/5" data-testid="no-budget-card">
      <CardContent className="py-8 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
        <div className="text-base font-semibold">
          Belum ada budget aktif untuk periode {view === "weekly" ? "minggu" : "bulan"} ini
        </div>
        <div className="text-sm text-muted-foreground max-w-md mx-auto">
          Hubungi Executive untuk menetapkan budget operasional (KDO/FDO/BDO) sebelum Anda bisa
          submit PR. PR baru akan diblokir sampai budget ditetapkan.
        </div>
      </CardContent>
    </Card>
  );
}
