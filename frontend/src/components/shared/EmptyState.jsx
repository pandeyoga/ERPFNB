import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

/** EmptyState — ringkas (design_guidelines → empty_states): jelaskan kenapa kosong +
 * aksi utama, tanpa ilustrasi besar.
 *
 * Aksi: `action` (node bebas) atau `actionLabel` + `onAction` (dirender sebagai Button).
 * Test-id: `testId` / `data-testid` diteruskan ke root (default "empty-state").
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title = "Belum ada data",
  description,
  action,
  actionLabel,
  onAction,
  testId,
  "data-testid": dataTestId,
}) {
  const actionNode = action || (actionLabel && onAction ? (
    <Button onClick={onAction} data-testid={`${testId || dataTestId || "empty-state"}-action`}>{actionLabel}</Button>
  ) : null);
  return (
    <div className="flex flex-col items-center text-center py-8 px-6" data-testid={testId || dataTestId || "empty-state"}>
      <div className="h-12 w-12 rounded-[calc(var(--radius)-2px)] grad-aurora-soft flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-foreground/60" />
      </div>
      <h3 className="text-sm md:text-base font-semibold mb-1">{title}</h3>
      {description && <p className="text-xs md:text-sm text-muted-foreground max-w-sm">{description}</p>}
      {actionNode && <div className="mt-3">{actionNode}</div>}
    </div>
  );
}
