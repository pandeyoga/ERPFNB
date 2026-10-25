import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

/**
 * Tabs — SATU gaya tab untuk seluruh aplikasi (design_guidelines → tabs_unification):
 * compact pill tabs, h-8, text-[13px], tab aktif = pill-active (pill hitam brand).
 * Halaman tidak perlu (dan sebaiknya tidak) menimpa warna/tinggi tab sendiri.
 */
const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex max-w-full items-center gap-1.5 overflow-x-auto rounded-[calc(var(--radius)-2px)] bg-white/35 dark:bg-white/5 border border-border/60 p-1 text-muted-foreground",
      className
    )}
    {...props} />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[calc(var(--radius)-4px)] px-2.5 text-[13px] font-medium ring-offset-background transition-colors data-[state=inactive]:hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:pill-active [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0",
      className
    )}
    {...props} />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-3 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props} />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
