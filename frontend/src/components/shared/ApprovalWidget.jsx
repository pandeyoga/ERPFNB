/**
 * ApprovalWidget — Compact pending approval widget for dashboards.
 * Shows count + top 3 urgent items + "Lihat Semua" button.
 */
import { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, Clock, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
import { useNavigate } from "react-router-dom";

const ENTITY_LABELS = {
  purchase_request:  "PR",
  purchase_order:    "PO",
  stock_adjustment:  "Adj",
  payment_request:   "Payment",
  employee_advance:  "Advance",
  budget:            "Budget",
  leave_request:     "Leave",
  stock_transfer:    "Transfer",
  ar_invoice:        "Invoice",
};

export default function ApprovalWidget({ approvalCenterPath = "/approvals" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/approvals/queue")
      .then(res => {
        if (res.data.success) {
          const items = res.data.data?.items || res.data.data || [];
          setData(items);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Card>
      <CardContent className="flex items-center justify-center h-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );

  const total = data?.length || 0;
  const urgent = (data || []).filter(i => i.is_overdue || (i.hours_until_deadline != null && i.hours_until_deadline < 4));
  const topItems = (data || []).slice(0, 4);

  return (
    <Card data-testid="approval-widget">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" />
            Pending Approval
            {total > 0 && (
              <Badge variant={urgent.length > 0 ? "destructive" : "default"} className="text-xs">
                {total}
              </Badge>
            )}
          </span>
          <Button variant="ghost" size="sm" className="text-xs h-7"
            onClick={() => navigate(approvalCenterPath)}
            data-testid="approval-widget-view-all">
            Lihat Semua <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {total === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <CheckCircle className="h-8 w-8 mx-auto mb-1 text-green-500" />
            Semua sudah ditangani
          </div>
        ) : (
          <div className="space-y-2">
            {topItems.map((item) => (
              <div key={`${item.entity_type}-${item.entity_id}`}
                className={`flex items-center justify-between p-2 rounded-md text-sm cursor-pointer hover:bg-muted/50 transition-colors ${
                  item.is_overdue ? "bg-red-50 dark:bg-red-950/20" : ""
                }`}
                onClick={() => navigate(approvalCenterPath)}
                data-testid={`widget-item-${item.entity_id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs px-1.5 py-0 shrink-0">
                      {ENTITY_LABELS[item.entity_type] || item.entity_type}
                    </Badge>
                    <span className="truncate font-medium">{item.title}</span>
                  </div>
                  {item.current_step_label && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Step: {item.current_step_label}
                    </div>
                  )}
                </div>
                {item.is_overdue ? (
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 ml-2" />
                ) : item.hours_until_deadline != null && item.hours_until_deadline < 4 ? (
                  <Clock className="h-4 w-4 text-amber-500 shrink-0 ml-2" />
                ) : null}
              </div>
            ))}
            {total > 4 && (
              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground"
                onClick={() => navigate(approvalCenterPath)}>
                +{total - 4} lainnya
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
