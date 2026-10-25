/** VoucherRedemption/index.jsx */
/**
 * VoucherRedemption.jsx — Sprint CRM-B
 * Outlet Voucher Redemption Station
 *
 * Flow: Lookup Customer → See Active Vouchers / Enter Code → Verify → Confirm Claim → Success
 * Side panel: Today’s Redemption Log (live)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  QrCode, Search, CheckCircle2, XCircle, Clock, ArrowLeft,
  User, Gift, RefreshCw, ClipboardCheck, AlertTriangle, Loader2,
  Ticket, ChevronRight, PhoneCall, Star, CalendarDays,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/shared/PageHeader";
import { toast } from "sonner";

// ── Constants ─────────────────────────────────────────────────────────────────
import { TIER_CONFIG, STATUS_CONFIG, STEP, fmtTime, daysUntil } from "./constants";
import { CustomerChip, VoucherCard, StatusBanner, TodayLog } from "./LookupComponents";

export default function VoucherRedemption() {
  // Step flow
  const [step, setStep] = useState(STEP.LOOKUP);

  // Lookup state
  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [customerVouchers, setCustomerVouchers] = useState([]);
  const [loadingCustomerVouchers, setLoadingCustomerVouchers] = useState(false);

  // Code entry state
  const [manualCode, setManualCode] = useState("");
  const codeInputRef = useRef(null);

  // Verify state
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [activeCode, setActiveCode] = useState("");

  // Claim state
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState(null);

  // Today log
  const [logItems, setLogItems] = useState([]);
  const [logLoading, setLogLoading] = useState(true);

  // ── Load today log ──────────────────────────────────────────────────────────
  const loadTodayLog = useCallback(async () => {
    setLogLoading(true);
    try {
      const res = await api.get("/outlet/vouchers/today", { params: { limit: 30 } });
      setLogItems(unwrap(res) || []);
    } catch {
      // Silently fail
    } finally {
      setLogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTodayLog();
    const interval = setInterval(loadTodayLog, 15000);
    return () => clearInterval(interval);
  }, [loadTodayLog]);

  // ── Search customers ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get("/outlet/loyalty/lookup", { params: { query: searchQ, limit: 5 } });
        setSearchResults(unwrap(res) || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQ]);

  async function selectCustomer(c) {
    setCustomer(c);
    setSearchQ("");
    setSearchResults([]);
    setLoadingCustomerVouchers(true);
    try {
      const res = await api.get(`/outlet/vouchers/customer/${c.id}`);
      setCustomerVouchers(unwrap(res) || []);
    } catch {
      setCustomerVouchers([]);
    } finally {
      setLoadingCustomerVouchers(false);
    }
  }

  // ── Verify voucher ──────────────────────────────────────────────────────────
  async function verifyCode(code) {
    const c = code.trim().toUpperCase();
    if (!c) { toast.error("Masukkan kode voucher"); return; }
    setVerifying(true);
    setActiveCode(c);
    try {
      const res = await api.get(`/outlet/vouchers/verify/${encodeURIComponent(c)}`);
      const data = unwrap(res);
      setVerifyResult(data);
      setStep(STEP.VERIFY);
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal memverifikasi voucher");
    } finally {
      setVerifying(false);
    }
  }

  // ── Claim voucher ───────────────────────────────────────────────────────────
  async function claimVoucher() {
    setClaiming(true);
    try {
      const res = await api.post("/outlet/vouchers/claim", { code: activeCode });
      const data = unwrap(res);
      setClaimResult(data);
      if (data?.success) {
        setStep(STEP.SUCCESS);
        loadTodayLog();
      } else {
        toast.error(data?.message || "Gagal klaim voucher");
      }
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal klaim voucher");
    } finally {
      setClaiming(false);
    }
  }

  // ── Reset ───────────────────────────────────────────────────────────────────
  function resetAll() {
    setStep(STEP.LOOKUP);
    setSearchQ("");
    setSearchResults([]);
    setCustomer(null);
    setCustomerVouchers([]);
    setManualCode("");
    setVerifyResult(null);
    setActiveCode("");
    setClaimResult(null);
    setTimeout(() => codeInputRef.current?.focus(), 100);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 lg:space-y-4" data-testid="voucher-redemption-station">
      <PageHeader
        icon={QrCode}
        title="Voucher Redemption"
        subtitle="Verifikasi dan klaim voucher loyalty customer."
        className="mb-0 md:mb-0"
        actions={step !== STEP.LOOKUP && step !== STEP.SUCCESS && (
          <Button
            variant="outline"
            onClick={() => setStep(STEP.LOOKUP)}
            data-testid="back-to-lookup"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali ke pencarian
          </Button>
        )}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_18rem] gap-3 lg:gap-4 items-start">
        {/* Main flow panel */}
        <div className="min-w-0 space-y-3">
          {/* Step indicator */}
          <StepIndicator step={step} />

          {/* ── STEP 0: LOOKUP ── */}
          {step === STEP.LOOKUP && (
            <div className="space-y-3">
              {/* Manual code entry */}
              <Card>
                <CardContent className="p-4">
                  <label htmlFor="voucher-code-field" className="flex items-center gap-2 mb-2 text-sm md:text-base font-semibold">
                    <Ticket className="h-4 w-4 text-primary" />
                    Masukkan Kode Voucher
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="voucher-code-field"
                      ref={codeInputRef}
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && verifyCode(manualCode)}
                      placeholder="Contoh: ABC1234567"
                      className="tracking-wider uppercase flex-1"
                      data-testid="voucher-code-input"
                      autoFocus
                    />
                    <Button
                      onClick={() => verifyCode(manualCode)}
                      disabled={!manualCode.trim() || verifying}
                      data-testid="verify-btn"
                    >
                      {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verifikasi"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* OR divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t" />
                <span className="text-xs text-muted-foreground">atau cari customer</span>
                <div className="flex-1 border-t" />
              </div>

              {/* Customer search */}
              <Card>
                <CardContent className="p-4">
                  <label htmlFor="voucher-customer-search" className="flex items-center gap-2 mb-2 text-sm md:text-base font-semibold">
                    <PhoneCall className="h-4 w-4 text-primary" />
                    Cari Customer
                  </label>

                  {customer ? (
                    <div className="space-y-3">
                      <CustomerChip
                        customer={customer}
                        onClear={() => { setCustomer(null); setCustomerVouchers([]); }}
                      />
                      {/* Customer's vouchers */}
                      {loadingCustomerVouchers ? (
                        <div className="space-y-2">
                          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-14" />)}
                        </div>
                      ) : customerVouchers.length === 0 ? (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          Customer tidak memiliki voucher aktif.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            {customerVouchers.length} voucher aktif:
                          </p>
                          {customerVouchers.map((v) => (
                            <VoucherCard
                              key={v.id}
                              voucher={v}
                              onSelect={(voucher) => verifyCode(voucher.voucher_code)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        id="voucher-customer-search"
                        value={searchQ}
                        onChange={(e) => setSearchQ(e.target.value)}
                        placeholder="Cari nama atau nomor HP…"
                        className="pl-9"
                        data-testid="customer-search-input"
                      />
                      {/* Dropdown results */}
                      {(searchResults.length > 0 || searching) && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-popover text-popover-foreground border rounded-lg shadow-lg z-20 overflow-hidden">
                          {searching ? (
                            <div className="p-3 flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" /> Mencari…
                            </div>
                          ) : (
                            searchResults.map((c) => (
                              <button
                                type="button"
                                key={c.id}
                                className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                                onClick={() => selectCustomer(c)}
                                data-testid={`search-result-${c.id}`}
                              >
                                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm">{c.full_name}</div>
                                  <div className="text-xs text-muted-foreground">{c.phone}</div>
                                </div>
                                <Badge variant="outline" className={`text-xs capitalize ${TIER_CONFIG[c.loyalty_tier]?.className}`}>
                                  {c.loyalty_tier}
                                </Badge>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── STEP 1: VERIFY ── */}
          {step === STEP.VERIFY && verifyResult && (
            <div className="space-y-3">
              {/* Status banner */}
              <StatusBanner data={verifyResult} />

              {/* Voucher detail card */}
              <Card className={`overflow-hidden border ${
                verifyResult.valid ? "border-emerald-500/40" : "border-red-500/40"
              }`}>
                <CardContent className="p-4">
                  {/* Code + QR placeholder */}
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Kode Voucher</div>
                      <div className="text-xl font-semibold tracking-widest text-primary tabular-nums">{activeCode}</div>
                    </div>
                    {/* QR visual representation */}
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center border" aria-hidden="true">
                      <QrCode className="h-7 w-7 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Reward info */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-amber-600" />
                      <span className="font-semibold text-sm">{verifyResult.reward_name || "-"}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-3 rounded-lg bg-muted/30 border">
                        <div className="text-xs text-muted-foreground">Poin Digunakan</div>
                        <div className="font-semibold mt-0.5">{(verifyResult.points_used || 0).toLocaleString()} pts</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30 border">
                        <div className="text-xs text-muted-foreground">Berlaku Hingga</div>
                        <div className={`font-semibold mt-0.5 ${
                          daysUntil(verifyResult.expiry) !== null && daysUntil(verifyResult.expiry) <= 7
                            ? "text-red-600" : ""
                        }`}>
                          {fmtDate(verifyResult.expiry) || "Tidak ada batas"}
                          {daysUntil(verifyResult.expiry) !== null && daysUntil(verifyResult.expiry) > 0 && (
                            <span className="font-normal text-xs text-muted-foreground ml-1">
                              ({daysUntil(verifyResult.expiry)}h)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Customer info */}
                    {verifyResult.customer && (
                      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                        <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1 flex items-center gap-1">
                          <User className="h-3 w-3" /> Customer
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="font-semibold text-sm">{verifyResult.customer.full_name}</div>
                            <div className="text-xs text-muted-foreground">{verifyResult.customer.phone}</div>
                          </div>
                          <Badge variant="outline" className={`text-xs capitalize ${
                            TIER_CONFIG[verifyResult.customer.loyalty_tier]?.className
                          }`}>
                            {verifyResult.customer.loyalty_tier || "bronze"}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Action buttons */}
              {verifyResult.valid ? (
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => setStep(STEP.CONFIRM)}
                  data-testid="proceed-to-confirm"
                >
                  <CheckCircle2 className="h-4 w-4" /> Lanjutkan Klaim
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  onClick={resetAll}
                  data-testid="try-another"
                >
                  Coba Kode Lain
                </Button>
              )}
            </div>
          )}

          {/* ── STEP 2: CONFIRM ── */}
          {step === STEP.CONFIRM && (
            <div className="space-y-3">
              <Card className="border border-primary/20">
                <CardContent className="p-4 space-y-4">
                  <div className="text-center">
                    <div className="h-12 w-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-2">
                      <QrCode className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-sm md:text-base font-semibold">Konfirmasi Klaim Voucher</h3>
                    <p className="text-sm text-muted-foreground mt-1">Pastikan customer menerima reward sebelum klik Klaim.</p>
                  </div>

                  <div className="rounded-lg bg-muted/40 border p-3 space-y-2">
                    <Row label="Kode Voucher" value={<span className="font-semibold tracking-wider">{activeCode}</span>} />
                    <Row label="Reward" value={verifyResult?.reward_name} />
                    <Row label="Customer" value={verifyResult?.customer?.full_name || "-"} />
                    <Row label="Berlaku Hingga" value={fmtDate(verifyResult?.expiry)} />
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      className="sm:flex-1"
                      onClick={() => setStep(STEP.VERIFY)}
                      disabled={claiming}
                      data-testid="back-to-verify"
                    >
                      Batal
                    </Button>
                    <Button
                      className="sm:flex-1"
                      onClick={claimVoucher}
                      disabled={claiming}
                      data-testid="confirm-claim-btn"
                    >
                      {claiming ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Memproses…</>
                      ) : (
                        <><CheckCircle2 className="h-4 w-4" /> Konfirmasi Klaim</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── STEP 3: SUCCESS ── */}
          {step === STEP.SUCCESS && claimResult && (
            <div className="space-y-3">
              <Card className="border border-emerald-500/40 overflow-hidden">
                <CardContent className="pt-4">
                  <div className="text-center mb-4">
                    <div className="h-12 w-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-2">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    </div>
                    <h3 className="text-base md:text-lg font-semibold text-emerald-700 dark:text-emerald-400">{claimResult.message}</h3>
                  </div>

                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 space-y-2 mb-4">
                    <Row label="Reward" value={claimResult.reward_name} />
                    <Row label="Kode Voucher" value={<span className="font-semibold tracking-wider">{claimResult.voucher_code}</span>} />
                    <Row label="Waktu Klaim" value={fmtTime(claimResult.claimed_at)} />
                    <Row
                      label="Ref. ID"
                      value={<span className="text-xs text-muted-foreground tabular-nums">{claimResult.reference_id?.slice(0, 8)}…</span>}
                    />
                  </div>

                  <Button
                    size="lg"
                    className="w-full"
                    onClick={resetAll}
                    data-testid="process-another-btn"
                  >
                    Proses Voucher Lain
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Today log sidebar */}
        <div className="min-w-0">
          <TodayLog items={logItems} loading={logLoading} onRefresh={loadTodayLog} />
        </div>
      </div>
    </div>
  );
}

// ── Step Indicator ────────────────────────────────────────────────────────────
function StepIndicator({ step }) {
  const steps = [
    { label: "Cari", icon: Search },
    { label: "Verifikasi", icon: QrCode },
    { label: "Konfirmasi", icon: ClipboardCheck },
    { label: "Sukses", icon: CheckCircle2 },
  ];
  return (
    <div className="flex items-center gap-0" aria-label="Langkah redemption">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const active = step === i;
        const done = step > i;
        return (
          <div key={i} className="flex items-center flex-1">
            <div className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
              active ? "bg-primary/10 text-primary" :
              done   ? "text-muted-foreground" :
                       "text-muted-foreground/40"
            }`}>
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded-full ${
                done ? "bg-primary" : "bg-muted"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
