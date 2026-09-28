import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
// ReactQueryDevtools disabled - locale issue in this environment
import { queryClient } from "@/lib/queryClient"; // Use our optimized config
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";
import { Suspense } from "react";
// Bug fix RC-2/RC-3 (2026-05-26): replace native lazy() with retry-aware version.
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Auth
import { AuthProvider } from "@/lib/auth";
import { useAuth } from "@/lib/auth";
import { LoyaltyAuthProvider } from "@/contexts/LoyaltyAuthContext";

// Tour
import { TourProvider } from "@/contexts/tour";

// Error Boundary (Phase 5)
import ErrorBoundary from "@/components/shared/ErrorBoundary";

// PWA Install Banner (Sprint F)
import PWAInstallBanner from "@/components/shared/PWAInstallBanner";

// ERP Pages (eagerly loaded — small, critical path)
import AppShell from "@/components/layout/AppShell";
import Login from "@/pages/Login";
import HomeRedirect from "@/pages/HomeRedirect";
import NoAccess from "@/pages/NoAccess";
import NotFound from "@/pages/NotFound";
import MyApprovals from "@/pages/MyApprovals";

// Loyalty Pages (eagerly loaded — lightweight)
import LoyaltyRegister from "@/pages/loyalty/LoyaltyRegister";
import LoyaltyLogin from "@/pages/loyalty/LoyaltyLogin";
import LoyaltyDashboard from "@/pages/loyalty/LoyaltyDashboard";
import LoyaltyCard from "@/pages/loyalty/LoyaltyCard";
import LoyaltyRewards from "@/pages/loyalty/LoyaltyRewards";
import LoyaltyHistory from "@/pages/loyalty/LoyaltyHistory";
import LoyaltyProfile from "@/pages/loyalty/LoyaltyProfile";
import RequireLoyaltyAuth from "@/components/loyalty/RequireLoyaltyAuth";

// Portals — lazy loaded for code splitting (Phase 4 performance)
// Bug fix RC-2 (2026-05-26): use lazyWithRetry — retries failed chunks 3x
// with backoff, then renders a friendly "Reload" fallback instead of
// freezing Suspense forever with a poisoned promise.
const ExecutivePortal = lazyWithRetry(() => import("@/portals/ExecutivePortal"), "ExecutivePortal");
const FinancePortal = lazyWithRetry(() => import("@/portals/FinancePortal"), "FinancePortal");
const HRPortal = lazyWithRetry(() => import("@/portals/HRPortal"), "HRPortal");
const InventoryPortal = lazyWithRetry(() => import("@/portals/InventoryPortal"), "InventoryPortal");
const OutletPortal = lazyWithRetry(() => import("@/portals/OutletPortal"), "OutletPortal");
const OwnerPortal = lazyWithRetry(() => import("@/portals/OwnerPortal"), "OwnerPortal");
const ProcurementPortal = lazyWithRetry(() => import("@/portals/ProcurementPortal"), "ProcurementPortal");
const AdminPortal = lazyWithRetry(() => import("@/portals/admin/AdminPortal"), "AdminPortal");
const ReportsPortal = lazyWithRetry(() => import("@/portals/ReportsPortal"), "ReportsPortal");

// Public Compro Pages — lazy loaded (heavy, not critical path)
const PublicLayout = lazyWithRetry(() => import("@/pages/public/PublicLayout"), "PublicLayout");
const PublicHome = lazyWithRetry(() => import("@/pages/public/PublicHome"), "PublicHome");
const Brands = lazyWithRetry(() => import("@/pages/public/Brands"), "Brands");
const BrandDetail = lazyWithRetry(() => import("@/pages/public/BrandDetail"), "BrandDetail");
const Menu = lazyWithRetry(() => import("@/pages/public/Menu"), "Menu");
const Locations = lazyWithRetry(() => import("@/pages/public/Locations"), "Locations");
const About = lazyWithRetry(() => import("@/pages/public/About"), "About");
const NewsPage = lazyWithRetry(() => import("@/pages/public/News"), "News");
const NewsDetailPage = lazyWithRetry(() => import("@/pages/public/NewsDetail"), "NewsDetail");
const Careers = lazyWithRetry(() => import("@/pages/public/Careers"), "Careers");
const Contact = lazyWithRetry(() => import("@/pages/public/Contact"), "Contact");
const Reservation = lazyWithRetry(() => import("@/pages/public/Reservation"), "Reservation");
const PublicPage = lazyWithRetry(() => import("@/pages/public/PublicPage"), "PublicPage");

// Loading fallback for Suspense (minimal, no layout shift)
function PageLoader() {
  return (
    <div className="flex h-full min-h-[40vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        <span className="text-xs text-muted-foreground animate-pulse">Memuat…</span>
      </div>
    </div>
  );
}

/** Full-page loader untuk auth state, bukan di dalam AppShell */
function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        <span className="text-xs text-muted-foreground animate-pulse">Memuat…</span>
      </div>
    </div>
  );
}

// ERP auth guard
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/**
 * Portal-level permission guard.
 * permPrefix: e.g. "admin", "finance", "outlet"
 * Wildcards: "*" gives access to everything.
 * Access is granted if user.permissions includes "*" OR any perm starting with permPrefix + "."
 * or equal to permPrefix.
 */
function RequirePortal({ permPrefix, children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  const perms = user.permissions || [];

  // Wildcard (super admin)
  if (perms.includes("*")) return children;

  // Check if user has any permission in this portal's namespace
  const hasAccess = perms.some(
    (p) => p === permPrefix || p.startsWith(permPrefix + ".")
  );

  if (!hasAccess) return <Navigate to="/no-access" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="aurora-theme">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <TourProvider>
              {/* Global top-level error boundary — catches anything that slips through */}
              <ErrorBoundary scope="Aplikasi FnB Group ERP">
                <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* ================================================
                      PUBLIC COMPRO ROUTES — No auth required
                  ================================================ */}
                  <Route
                    element={
                      <ErrorBoundary scope="Halaman Publik">
                        <PublicLayout />
                      </ErrorBoundary>
                    }
                  >
                    <Route index element={<PublicHome />} />
                    <Route path="brands" element={<Brands />} />
                    <Route path="brands/:brandId" element={<BrandDetail />} />
                    <Route path="menu" element={<Menu />} />
                    <Route path="locations" element={<Locations />} />
                    <Route path="about" element={<About />} />
                    <Route path="news" element={<NewsPage />} />
                    <Route path="news/:id" element={<NewsDetailPage />} />
                    <Route path="careers" element={<Careers />} />
                    <Route path="contact" element={<Contact />} />
                    <Route path="reservation" element={<Reservation />} />
                  </Route>

                  {/* ================================================
                      CUSTOM PAGES (Page Builder) — Sprint L
                  ================================================ */}
                  <Route path="pages/:slug" element={<PublicPage />} />

                  {/* ================================================
                      ERP AUTH ROUTE
                  ================================================ */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/no-access" element={<NoAccess />} />

                  {/* ================================================
                      LOYALTY / CRM ROUTES
                  ================================================ */}
                  <Route
                    path="/loyalty/register"
                    element={
                      <ErrorBoundary scope="Loyalty Register">
                        <LoyaltyAuthProvider><LoyaltyRegister /></LoyaltyAuthProvider>
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/loyalty/login"
                    element={
                      <ErrorBoundary scope="Loyalty Login">
                        <LoyaltyAuthProvider><LoyaltyLogin /></LoyaltyAuthProvider>
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/loyalty"
                    element={
                      <ErrorBoundary scope="Loyalty Dashboard">
                        <LoyaltyAuthProvider><RequireLoyaltyAuth><LoyaltyDashboard /></RequireLoyaltyAuth></LoyaltyAuthProvider>
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/loyalty/card"
                    element={
                      <LoyaltyAuthProvider><RequireLoyaltyAuth><LoyaltyCard /></RequireLoyaltyAuth></LoyaltyAuthProvider>
                    }
                  />
                  <Route
                    path="/loyalty/rewards"
                    element={
                      <LoyaltyAuthProvider><RequireLoyaltyAuth><LoyaltyRewards /></RequireLoyaltyAuth></LoyaltyAuthProvider>
                    }
                  />
                  <Route
                    path="/loyalty/history"
                    element={
                      <LoyaltyAuthProvider><RequireLoyaltyAuth><LoyaltyHistory /></RequireLoyaltyAuth></LoyaltyAuthProvider>
                    }
                  />
                  <Route
                    path="/loyalty/profile"
                    element={
                      <LoyaltyAuthProvider><RequireLoyaltyAuth><LoyaltyProfile /></RequireLoyaltyAuth></LoyaltyAuthProvider>
                    }
                  />

                  {/* ================================================
                      ERP PROTECTED ROUTES — each portal wrapped in its own ErrorBoundary
                  ================================================ */}
                  <Route
                    element={
                      <RequireAuth>
                        <AppShell />
                      </RequireAuth>
                    }
                  >
                    <Route path="/erp" element={<HomeRedirect />} />
                    {/* IA v3 (2026-07): halaman "Pilih Portal" dihapus — semua modul ada di
                        sidebar terpadu. Alias dipertahankan untuk bookmark lama. */}
                    <Route path="/portal-select" element={<Navigate to="/erp" replace />} />
                    <Route path="/approvals" element={<MyApprovals />} />
                    {/* Approval aliases — semua portal approval paths mengarah ke MyApprovals */}
                    <Route path="/my-approvals" element={<MyApprovals />} />
                    <Route path="/hr/approvals" element={<MyApprovals />} />
                    <Route path="/finance/approvals" element={<MyApprovals />} />
                    <Route path="/procurement/approvals" element={<MyApprovals />} />
                    <Route path="/outlet/approvals" element={<MyApprovals />} />
                    <Route path="/owner/approvals" element={<MyApprovals />} />
                    <Route path="/executive/approvals" element={<MyApprovals />} />
                    {/* NOTE: `/admin/approvals` intentionally NOT aliased here — it
                        resolves to the Approval Matrix Builder inside AdminPortal.
                        Admins reach their personal queue via `/my-approvals`. */}
                    {/* Convenience redirects for common bookmarks */}
                    <Route path="/master" element={<Navigate to="/admin/master/items" replace />} />
                    <Route path="/master/*" element={<Navigate to="/admin/master/items" replace />} />
                    <Route
                      path="/executive/*"
                      element={
                        <RequirePortal permPrefix="executive">
                          <ErrorBoundary scope="Executive Portal">
                            <Suspense fallback={<PageLoader />}>
                              <ExecutivePortal />
                            </Suspense>
                          </ErrorBoundary>
                        </RequirePortal>
                      }
                    />
                    <Route
                      path="/finance/*"
                      element={
                        <RequirePortal permPrefix="finance">
                          <ErrorBoundary scope="Finance Portal">
                            <Suspense fallback={<PageLoader />}>
                              <FinancePortal />
                            </Suspense>
                          </ErrorBoundary>
                        </RequirePortal>
                      }
                    />
                    <Route
                      path="/reports/*"
                      element={
                        <RequirePortal permPrefix="reports">
                          <ErrorBoundary scope="Reports Portal">
                            <Suspense fallback={<PageLoader />}>
                              <ReportsPortal />
                            </Suspense>
                          </ErrorBoundary>
                        </RequirePortal>
                      }
                    />
                    <Route
                      path="/hr/*"
                      element={
                        <RequirePortal permPrefix="hr">
                          <ErrorBoundary scope="HR Portal">
                            <Suspense fallback={<PageLoader />}>
                              <HRPortal />
                            </Suspense>
                          </ErrorBoundary>
                        </RequirePortal>
                      }
                    />
                    <Route
                      path="/inventory/*"
                      element={
                        <RequirePortal permPrefix="inventory">
                          <ErrorBoundary scope="Inventory Portal">
                            <Suspense fallback={<PageLoader />}>
                              <InventoryPortal />
                            </Suspense>
                          </ErrorBoundary>
                        </RequirePortal>
                      }
                    />
                    <Route
                      path="/outlet/*"
                      element={
                        <RequirePortal permPrefix="outlet">
                          <ErrorBoundary scope="Outlet Portal">
                            <Suspense fallback={<PageLoader />}>
                              <OutletPortal />
                            </Suspense>
                          </ErrorBoundary>
                        </RequirePortal>
                      }
                    />
                    <Route
                      path="/owner/*"
                      element={
                        <RequirePortal permPrefix="owner">
                          <ErrorBoundary scope="Owner Portal">
                            <Suspense fallback={<PageLoader />}>
                              <OwnerPortal />
                            </Suspense>
                          </ErrorBoundary>
                        </RequirePortal>
                      }
                    />
                    <Route
                      path="/procurement/*"
                      element={
                        <RequirePortal permPrefix="procurement">
                          <ErrorBoundary scope="Procurement Portal">
                            <Suspense fallback={<PageLoader />}>
                              <ProcurementPortal />
                            </Suspense>
                          </ErrorBoundary>
                        </RequirePortal>
                      }
                    />
                    <Route
                      path="/admin/*"
                      element={
                        <RequirePortal permPrefix="admin">
                          <ErrorBoundary scope="Admin Portal">
                            <Suspense fallback={<PageLoader />}>
                              <AdminPortal />
                            </Suspense>
                          </ErrorBoundary>
                        </RequirePortal>
                      }
                    />
                  </Route>

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
            </TourProvider>
          </AuthProvider>
        </BrowserRouter>
        <Toaster position="top-right" />
        <PWAInstallBanner />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
