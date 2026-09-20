import { Link, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/contexts/NavigationContext";
import { getPortalSections } from "@/lib/navigationSchema";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Subnav() {
  // TEMPORARILY RESTORED FOR COMPREHENSIVE AUDIT
  const { currentPortal } = useNavigation();
  const location = useLocation();
  const scrollRef = useRef(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  
  const sections = currentPortal ? getPortalSections(currentPortal.id) : [];
  
  // Find active section based on current path
  const activeSection = sections.find((section) =>
    section.items.some((item) => location.pathname === item.path)
  );
  
  // Check scroll position for fade indicators
  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftFade(scrollLeft > 0);
      setShowRightFade(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };
  
  useEffect(() => {
    checkScroll();
    const scrollEl = scrollRef.current;
    if (scrollEl) {
      scrollEl.addEventListener("scroll", checkScroll);
      window.addEventListener("resize", checkScroll);
      return () => {
        scrollEl.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
      };
    }
  }, [activeSection]);
  
  // If no current portal or no active section or section has only 1 item, don't show subnav
  if (!currentPortal || !activeSection || activeSection.items.length <= 1) {
    return null;
  }
  
  return (
    <div
      className="sticky top-[64px] lg:top-[72px] z-30 border-b border-border bg-card/80 backdrop-blur-md relative"
      data-testid="subnav"
    >
      {/* Left fade indicator */}
      {showLeftFade && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-card/80 to-transparent pointer-events-none z-10" />
      )}
      
      {/* Right fade indicator */}
      {showRightFade && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card/80 to-transparent pointer-events-none z-10" />
      )}
      
      <ScrollArea className="w-full" ref={scrollRef}>
        <div className="flex items-center gap-1 px-4 sm:px-6 h-11 min-w-max">
          {activeSection.items.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.id}
                to={item.path}
                className={cn(
                  "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                )}
                data-testid={`subnav-tab-${item.id}`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
