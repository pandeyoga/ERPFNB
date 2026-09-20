/** MobileSidebar — drawer navigasi terpadu (mobile/tablet). Memakai NavTree yang sama
 * dengan sidebar desktop supaya IA konsisten di semua perangkat. */
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles } from "lucide-react";
import { useNavigation } from "@/contexts/NavigationContext";
import NavTree from "./NavTree";

export default function MobileSidebar() {
  const { mobileDrawerOpen, closeMobileDrawer } = useNavigation();

  return (
    <Sheet open={mobileDrawerOpen} onOpenChange={closeMobileDrawer}>
      <SheetContent side="left" className="w-[280px] p-0" data-testid="mobile-sidebar">
        <SheetHeader className="px-4 py-4 border-b border-border">
          <SheetTitle className="text-left flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg grad-aurora flex items-center justify-center shadow-md">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold">FnB Group ERP</span>
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-72px)] px-3 py-4">
          <NavTree onNavigate={closeMobileDrawer} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
