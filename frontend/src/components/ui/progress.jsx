import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
      className
    )}
    {...props}>
    {/* Lebar (bukan translateX) — indikator yang digeser keluar tidak selalu ter-clip di
        dalam kartu glass (backdrop-filter) sehingga tampil sebagai garis di luar kartu. */}
    <ProgressPrimitive.Indicator
      className="h-full bg-primary transition-[width]"
      style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
