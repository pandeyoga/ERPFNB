/** VoucherRedemption/LookupComponents.jsx */
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// ── Constants ─────────────────────────────────────────────────────────────────
import { TIER_CONFIG, STATUS_CONFIG, fmtDate, fmtTime, daysUntil } from "./constants";

function CustomerChip({ customer, onClear, onSelect }) {
  const tier = TIER_CONFIG[customer.loyalty_tier] || TIER_CONFIG.bronze;
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border bg-white shadow-sm cursor-pointer hover:border-primary/40 transition-colors"
      onClick={onSelect}
      data-testid="customer-chip"
    >
      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0">
        <User className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{customer.full_name}</div>
        <div className="text-xs text-muted-foreground">{customer.phone}</div>
      </div>
      <Badge variant="outline" className={`text-xs ${tier.className}`}>
        {tier.label}
      </Badge>
      <span className="text-xs text-muted-foreground font-medium">{(customer.total_points || 0).toLocaleString()} pts</span>
      {onClear && (
        <button
          className="ml-1 text-muted-foreground hover:text-destructive text-lg leading-none"
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          data-testid="clear-customer"
        >
          ×
        </button>
      )}
    </div>
  );
}

function VoucherCard({ voucher, onSelect, selected }) {
  const days = daysUntil(voucher.expires_at);
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
        selected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-white hover:border-primary/40"
      }`}
      onClick={() => onSelect(voucher)}
      data-testid={`voucher-card-${voucher.id}`}
    >
      <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
        <Ticket className="h-4.5 w-4.5 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{voucher.reward_name}</div>
        {voucher.voucher_code && (
          <div className="text-xs font-mono text-muted-foreground">{voucher.voucher_code}</div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-medium">{(voucher.points_used || 0).toLocaleString()} pts</div>
        {days !== null && (
          <div className={`text-xs ${ days <= 7 ? "text-red-600 font-semibold" : "text-muted-foreground" }`}>
            {days <= 0 ? "Expired" : `${days}h lagi`}
          </div>
        )}
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </div>
  );
}

function StatusBanner({ data }) {
  const cfg = STATUS_CONFIG[data?.status] || STATUS_CONFIG.invalid;
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border ${cfg.bg}`}>
      <Icon className={`h-6 w-6 shrink-0 ${cfg.color}`} />
      <div>
        <div className={`font-semibold ${cfg.color}`}>{cfg.label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{data?.message}</div>
      </div>
    </div>
  );
}

function TodayLog({ items, loading, onRefresh }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" /> Log Hari Ini
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onRefresh} data-testid="refresh-log">
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            Belum ada redemption hari ini.
          </div>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.id || item.voucher_code}
                className="p-3 rounded-lg bg-muted/30 border text-xs"
                data-testid={`log-item-${item.voucher_code}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate flex-1">{item.reward_name}</span>
                  <span className="text-muted-foreground ml-2">{fmtTime(item.claimed_at)}</span>
                </div>
                <div className="text-muted-foreground mt-0.5 truncate">{item.customer_name || "-"}</div>
                {item.voucher_code && (
                  <code className="mt-0.5 font-mono text-[10px] text-muted-foreground">{item.voucher_code}</code>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export { CustomerChip, VoucherCard, StatusBanner, TodayLog };
