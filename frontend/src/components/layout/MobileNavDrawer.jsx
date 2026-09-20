import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Sparkles, LogOut, Inbox } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { visiblePortalsFor } from "@/lib/portals";
import { cn } from "@/lib/utils";

/**
 * MobileNavDrawer — slide-in portal navigation for < lg breakpoints.
 * Closes on outside click / Escape / route change.
 */
export default function MobileNavDrawer({ open, onClose }) {
  const { user, logout, can } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const portals = visiblePortalsFor(user);

  const activePortal = portals.find((p) => location.pathname.startsWith(p.path))?.id;

  // Close on route change
  useEffect(() => { onClose && onClose(); }, [location.pathname]); // eslint-disable-line

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  const showApprovals = can && can("finance.payment.approve", "procurement.po.approve", "procurement.pr.approve", "inventory.adjustment.approve", "hr.advance.approve");

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="nav-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-background/60 backdrop-blur-sm lg:hidden"
            aria-hidden="true"
          />
          <motion.aside
            key="nav-panel"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="fixed left-0 top-0 z-[61] h-full w-[82%] max-w-xs bg-background/95 backdrop-blur-xl shadow-2xl lg:hidden flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Portal Navigation"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl grad-aurora flex items-center justify-center shadow-md">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="font-bold tracking-tight leading-tight">FnB Group ERP</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">FnB Group</div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="h-9 w-9 rounded-full hover:bg-foreground/10 flex items-center justify-center transition-colors"
                aria-label="Tutup menu"
                data-testid="mobile-nav-close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User card */}
            {user && (
              <div className="mx-4 mt-4 p-3 rounded-2xl glass-card flex items-center gap-3">
                <div className="h-10 w-10 rounded-full grad-aurora flex items-center justify-center text-white font-bold shrink-0">
                  {user.full_name?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{user.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                </div>
              </div>
            )}

            {/* Portal list */}
            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Portal">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 mb-2 font-semibold">
                Portal
              </div>
              <div className="space-y-1">
                {portals.map((p) => {
                  const Icon = p.icon;
                  const isActive = activePortal === p.id;
                  return (
                    <Link
                      key={p.id}
                      to={p.path}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                        isActive
                          ? "pill-active"
                          : "text-foreground/80 hover:bg-foreground/5",
                      )}
                      data-testid={`mobile-nav-${p.id}`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{p.name}</span>
                    </Link>
                  );
                })}
              </div>

              {showApprovals && (
                <>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 mb-2 mt-5 font-semibold">
                    Tindakan
                  </div>
                  <Link
                    to="/my-approvals"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground/80 hover:bg-foreground/5"
                    data-testid="mobile-nav-approvals"
                  >
                    <Inbox className="h-4 w-4" /> My Approvals
                  </Link>
                </>
              )}
            </nav>

            {/* Footer */}
            <div className="border-t border-border/40 p-3">
              <button
                onClick={async () => { await logout(); navigate("/login", { replace: true }); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-500/10 w-full"
                data-testid="mobile-nav-logout"
              >
                <LogOut className="h-4 w-4" /> Keluar
              </button>
              <div className="mt-3 text-[10px] text-muted-foreground/60 px-3">
                FnB ERP v0.2.0 · Phase 7E
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
