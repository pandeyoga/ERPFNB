/**
 * CMSScheduleFields — Reusable scheduling section for CMS forms.
 * Shows publish_at and unpublish_at datetime pickers + current schedule status badge.
 */
import { Calendar, Clock, X, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function toLocalInput(isoOrDate) {
  if (!isoOrDate) return "";
  try {
    const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
    if (isNaN(d.getTime())) return "";
    // Convert to local datetime-local format: YYYY-MM-DDTHH:mm
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ""; }
}

function parseToISO(localStr) {
  if (!localStr) return null;
  try {
    return new Date(localStr).toISOString();
  } catch { return null; }
}

function scheduleStatus(publishAt, unpublishAt, currentStatus) {
  const now = new Date();
  const pubDate = publishAt ? new Date(publishAt) : null;
  const unpubDate = unpublishAt ? new Date(unpublishAt) : null;

  if (pubDate && pubDate > now && currentStatus !== "published") {
    return { label: `Scheduled: ${pubDate.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`, variant: "secondary", color: "text-amber-600" };
  }
  if (unpubDate && unpubDate > now && currentStatus === "published") {
    return { label: `Expires: ${unpubDate.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`, variant: "outline", color: "text-blue-600" };
  }
  if (unpubDate && unpubDate <= now && currentStatus === "published") {
    return { label: "Will unpublish on next scheduler run", variant: "destructive", color: "" };
  }
  return null;
}

export default function CMSScheduleFields({ form, onChange, currentStatus }) {
  const status = scheduleStatus(form.publish_at, form.unpublish_at, currentStatus || form.status);

  return (
    <div className="space-y-4 rounded-lg border border-dashed border-border/60 p-4 bg-muted/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Calendar className="h-4 w-4 text-primary" />
          Jadwal Publikasi
        </div>
        {status && (
          <Badge variant={status.variant} className={`text-xs ${status.color}`}>{status.label}</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Publish At */}
        <div>
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Publish Otomatis (opsional)
          </Label>
          <div className="flex gap-1 mt-1">
            <Input
              type="datetime-local"
              value={toLocalInput(form.publish_at)}
              onChange={(e) => onChange("publish_at", parseToISO(e.target.value))}
              className="text-xs"
              data-testid="publish-at-input"
            />
            {form.publish_at && (
              <Button
                variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                onClick={() => onChange("publish_at", null)}
                title="Hapus jadwal"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Konten akan auto-publish pada tanggal ini
          </p>
        </div>

        {/* Unpublish At */}
        <div>
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Unpublish Otomatis (opsional)
          </Label>
          <div className="flex gap-1 mt-1">
            <Input
              type="datetime-local"
              value={toLocalInput(form.unpublish_at)}
              onChange={(e) => onChange("unpublish_at", parseToISO(e.target.value))}
              className="text-xs"
              data-testid="unpublish-at-input"
            />
            {form.unpublish_at && (
              <Button
                variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                onClick={() => onChange("unpublish_at", null)}
                title="Hapus jadwal"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Konten akan auto-unpublish pada tanggal ini
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Scheduler berjalan setiap menit. Jika menetapkan publish di masa depan,
          status akan tetap "Draft" sampai waktu yang ditentukan.
        </span>
      </div>
    </div>
  );
}
