/**
 * Executive — Budget Increase Requests Inbox.
 *
 * Outlets submit increase requests with reason; Executive approves/rejects.
 * Approved increase amount is added to bucket immediately.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Bell, CheckCircle, XCircle, RefreshCw, Filter, ClipboardCheck,
  AlertTriangle, MessageSquare, ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import api from "@/lib/api";
import { fmtRp } from "@/lib/format";
import {
  fetchIncreaseRequests, approveIncrease, rejectIncrease,
  BUCKET_COLORS,
} from "@/lib/outletBudgetApi";
import dayjs from "dayjs";

export default function BudgetIncreaseRequests() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState([]);
  const [outletsById, setOutletsById] = useState({});
  const [usersById, setUsersById] = useState({});
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState(null); // { kind: 'approve'|'reject', req }
  const [approvedAmount, setApprovedAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [olRes, usRes] = await Promise.all([
          api.get("/master/outlets"),
          api.get("/admin/users").catch(() => ({ data: { data: [] } })),
        ]);
        const m = {};
        for (const o of olRes.data.data || []) m[o.id] = o;
        setOutletsById(m);
        const u = {};
        const users = usRes.data?.data?.items || usRes.data?.data || [];
        for (const usr of users) u[usr.id] = usr;
        setUsersById(u);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchIncreaseRequests({ status });
      setItems(res.items || []);
    } catch (e) {
      toast.error("Gagal memuat request");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const openApprove = (req) => {
    setDecision({ kind: "approve", req });
    setApprovedAmount(String(req.requested_amount));
    setNote("");
  };
  const openReject = (req) => {
    setDecision({ kind: "reject", req });
    setNote("");
  };

  const submitDecision = async () => {
    if (!decision) return;
    setSubmitting(true);
    try {
      if (decision.kind === "approve") {
        const amt = parseFloat(approvedAmount);
        if (!amt || amt <= 0) {
          toast.error("Approved amount harus > 0");
          setSubmitting(false);
          return;
        }
        await approveIncrease(decision.req.id, { approvedAmount: amt, note });
        toast.success("Budget berhasil ditambahkan.");
      } else {
        if (!note.trim()) {
          toast.error("Alasan penolakan wajib diisi");
          setSubmitting(false);
          return;
        }
        await rejectIncrease(decision.req.id, { note });
        toast.success("Request ditolak");
      }
      setDecision(null);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal memproses");
    } finally {
      setSubmitting(false);
    }
  };

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    for (const it of items) if (c[it.status] !== undefined) c[it.status] += 1;
    return c;
  }, [items]);

  return (
    <div className="space-y-6" data-testid="budget-increase-requests">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-aurora" />
            Request Penambahan Budget
          </h2>
          <p className="text-muted-foreground text-sm">
            Outlet meminta tambahan budget operasional dengan reason; Anda yang memutuskan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => navigate("/executive/outlet-budgets")}
            className="gap-2"
          >
            Set Budget <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            <Bell className="h-4 w-4 mr-1" /> Menunggu
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">
            <CheckCircle className="h-4 w-4 mr-1" /> Disetujui
          </TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected">
            <XCircle className="h-4 w-4 mr-1" /> Ditolak
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-3">
        {loading ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Memuat…</CardContent></Card>
        ) : items.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            Tidak ada request dengan status "{status}".
          </CardContent></Card>
        ) : (
          items.map((req) => (
            <RequestCard
              key={req.id} req={req}
              outletsById={outletsById}
              usersById={usersById}
              onApprove={openApprove}
              onReject={openReject}
            />
          ))
        )}
      </div>

      {/* Decision Dialog */}
      <Dialog open={!!decision} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision?.kind === "approve" ? "Approve Request" : "Reject Request"}
            </DialogTitle>
            <DialogDescription>
              {decision?.kind === "approve"
                ? "Anda bisa menyesuaikan jumlah yang disetujui (boleh kurang dari yang diminta)."
                : "Berikan alasan penolakan yang jelas — Outlet akan menerima notifikasi."}
            </DialogDescription>
          </DialogHeader>
          {decision && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-muted/30 p-3 space-y-1">
                <div>
                  <span className="text-muted-foreground">Outlet:</span>{" "}
                  <strong>{outletsById[decision.req.outlet_id]?.name || decision.req.outlet_id.slice(0, 8)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Bucket:</span>{" "}
                  <Badge variant="outline" style={{ borderColor: decision.req.bucket === "combined" ? "#0ea5e9" : BUCKET_COLORS[decision.req.bucket] }}>
                    {decision.req.bucket === "combined" ? "GABUNGAN" : decision.req.bucket.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Diminta:</span>{" "}
                  <strong>{fmtRp(decision.req.requested_amount)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Alasan:</span>{" "}
                  <em>{decision.req.reason}</em>
                </div>
              </div>
              {decision.kind === "approve" && (
                <div>
                  <Label htmlFor="approved-amount">Approved Amount (Rp)</Label>
                  <Input
                    id="approved-amount"
                    type="number" min="0" step="100000"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                    className="mt-1"
                    data-testid="input-approved-amount"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="decision-note">
                  Catatan {decision.kind === "reject" ? "(wajib)" : "(opsional)"}
                </Label>
                <Textarea
                  id="decision-note" value={note} onChange={(e) => setNote(e.target.value)}
                  rows={3} className="mt-1"
                  placeholder={decision.kind === "approve" ? "Misal: disetujui sesuai promo…" : "Misal: budget tidak prioritas, geser ke periode depan…"}
                  data-testid="input-decision-note"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)} disabled={submitting}>Batal</Button>
            <Button
              onClick={submitDecision} disabled={submitting}
              className={decision?.kind === "approve" ? "pill-active" : ""}
              variant={decision?.kind === "approve" ? "default" : "destructive"}
              data-testid="btn-decision-submit"
            >
              {submitting ? "Memproses…" : decision?.kind === "approve" ? "Approve & Tambahkan" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequestCard({ req, outletsById, usersById, onApprove, onReject }) {
  const ol = outletsById[req.outlet_id];
  const requester = usersById[req.requested_by];
  const decider = usersById[req.decided_by];
  const isPending = req.status === "pending";
  const statusBadge = req.status === "pending"
    ? <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Menunggu</Badge>
    : req.status === "approved"
      ? <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Disetujui</Badge>
      : <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Ditolak</Badge>;
  return (
    <Card className="hover:border-aurora/40 transition-colors" data-testid={`request-${req.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="outline" style={{ borderColor: req.bucket === "combined" ? "#0ea5e9" : BUCKET_COLORS[req.bucket] }} className="font-mono">
                {req.bucket === "combined" ? "GABUNGAN" : req.bucket.toUpperCase()}
              </Badge>
              {ol?.name || req.outlet_id.slice(0, 8)}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {dayjs(req.requested_at).format("DD MMM YYYY HH:mm")}
              {requester && <> • oleh {requester.name || requester.email}</>}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold tabular-nums" style={{ color: req.bucket === "combined" ? "#0ea5e9" : BUCKET_COLORS[req.bucket] }}>
              {fmtRp(req.requested_amount)}
            </div>
            <div className="mt-1">{statusBadge}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="text-foreground">{req.reason}</div>
        </div>
        {req.related_pr_amount && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" />
            Terkait PR dengan total {fmtRp(req.related_pr_amount)}
          </div>
        )}
        {!isPending && (
          <div className="rounded-md bg-muted/30 p-2 text-xs">
            <div>
              <strong>{req.status === "approved" ? "Approved" : "Rejected"}:</strong>{" "}
              {req.decided_at && dayjs(req.decided_at).format("DD MMM YYYY HH:mm")}
              {decider && <> oleh {decider.name || decider.email}</>}
            </div>
            {req.status === "approved" && req.approved_amount != null && (
              <div>Approved amount: <strong>{fmtRp(req.approved_amount)}</strong></div>
            )}
            {req.decision_note && <div className="italic mt-1">"{req.decision_note}"</div>}
          </div>
        )}
        {isPending && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm" className="gap-1 pill-active flex-1"
              onClick={() => onApprove(req)}
              data-testid={`btn-approve-${req.id}`}
            >
              <CheckCircle className="h-4 w-4" /> Approve
            </Button>
            <Button
              size="sm" variant="destructive" className="gap-1 flex-1"
              onClick={() => onReject(req)}
              data-testid={`btn-reject-${req.id}`}
            >
              <XCircle className="h-4 w-4" /> Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
