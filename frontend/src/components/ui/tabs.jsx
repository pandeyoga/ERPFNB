import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * Tabs — SATU gaya tab untuk seluruh aplikasi (design_guidelines → tabs_unification):
 * compact pill tabs, h-8, text-[13px], tab aktif = pill-active (pill hitam brand).
 * Halaman tidak perlu (dan sebaiknya tidak) menimpa warna/tinggi tab sendiri.
 */
const Tabs = TabsPrimitive.Root

// variant "line" = sub-tab tingkat kedua (HubTabs): garis bawah, tanpa latar — tidak terlihat sebagai baris tab kedua
// yang setara dengan tab utama (NN/g: hindari tab bertumpuk dua baris).
const TabsVariantContext = React.createContext("pill")

/**
 * TabsList — bila tab tidak muat (hub dengan banyak tab di 1280px), daftar digulir horizontal: tombol ‹ › muat di
 * samping daftar pada sisi yang masih menyimpan tab, dan tab aktif selalu digulir ke area terlihat.
 */
const TabsList = React.forwardRef(({ className, variant = "pill", ...props }, ref) => {
  const innerRef = React.useRef(null)
  const [edges, setEdges] = React.useState({ left: false, right: false })
  const setRefs = React.useCallback((el) => {
    innerRef.current = el
    if (typeof ref === "function") ref(el)
    else if (ref) ref.current = el
  }, [ref])
  React.useEffect(() => {
    const el = innerRef.current
    if (!el) return undefined
    const update = () => setEdges({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    })
    const showActive = () => {
      const active = el.querySelector('[data-state="active"]')
      if (!active || el.scrollWidth <= el.clientWidth) return
      const a = active.offsetLeft, b = a + active.offsetWidth
      if (a < el.scrollLeft) el.scrollLeft = a - 8
      else if (b > el.scrollLeft + el.clientWidth) el.scrollLeft = b - el.clientWidth + 8
    }
    showActive()
    update()
    el.addEventListener("scroll", update, { passive: true })
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null
    ro?.observe(el)
    const mo = new MutationObserver(() => { showActive(); update() })
    mo.observe(el, { attributes: true, subtree: true, attributeFilter: ["data-state"] })
    return () => { el.removeEventListener("scroll", update); ro?.disconnect(); mo.disconnect() }
  }, [])
  const nudge = (dir) => {
    const el = innerRef.current
    if (el) el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.6), behavior: "smooth" })
  }
  // Tombol ‹ › di SAMPING daftar (bukan di atasnya): tidak menutupi tab dan tidak bentrok dengan klik tab.
  const scrollBtn = (dir) => (
    <Button type="button" size="icon-sm" variant="ghost" tabIndex={-1} className="shrink-0"
      aria-label={dir < 0 ? "Tab sebelumnya" : "Tab berikutnya"} onClick={() => nudge(dir)}
      data-testid={dir < 0 ? "tabs-scroll-left" : "tabs-scroll-right"}>
      {dir < 0 ? <ChevronLeft /> : <ChevronRight />}
    </Button>
  )
  return (
    <div className={cn("inline-flex max-w-full min-w-0 items-center gap-0.5 align-middle", /\bw-full\b/.test(className || "") && "flex w-full")}>
      {edges.left && scrollBtn(-1)}
      <TabsVariantContext.Provider value={variant}>
        <TabsPrimitive.List
          ref={setRefs}
          data-variant={variant}
          className={cn(
            variant === "line"
              ? "no-scrollbar inline-flex min-w-0 max-w-full items-center gap-1 overflow-x-auto border-b border-border text-muted-foreground"
              : "no-scrollbar inline-flex min-w-0 max-w-full items-center gap-1.5 overflow-x-auto rounded-[calc(var(--radius)-2px)] bg-white/35 dark:bg-white/5 border border-border/60 p-1 text-muted-foreground",
            className
          )}
          {...props} />
      </TabsVariantContext.Provider>
      {edges.right && scrollBtn(1)}
    </div>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext)
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap text-[13px] font-medium ring-offset-background transition-colors data-[state=inactive]:hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0",
        variant === "line"
          ? "-mb-px rounded-none border-b-2 border-transparent px-2.5 data-[state=active]:border-foreground data-[state=active]:text-foreground"
          : "rounded-[calc(var(--radius)-4px)] px-2.5 data-[state=active]:pill-active",
        className
      )}
      {...props} />
  )
})
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
