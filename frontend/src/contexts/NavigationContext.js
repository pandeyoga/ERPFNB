import { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PORTALS } from "@/lib/portals";
import { useAuth } from "@/lib/auth";
import { lastPortalKey } from "@/lib/unifiedNav";

const NavigationContext = createContext(null);

export function NavigationProvider({ children }) {
  const location = useLocation();
  const { user } = useAuth();
  
  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("aurora_sidebar_collapsed");
    return saved === "true";
  });
  
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  
  // Active section tracking
  const [activeSection, setActiveSection] = useState(null);
  
  // Current portal detection from URL
  const [currentPortal, setCurrentPortal] = useState(null);
  
  // Detect current portal from location + ingat modul terakhir (IA v3: dipakai
  // HomeRedirect sebagai "Beranda" pengganti halaman Pilih Portal)
  useEffect(() => {
    const portal = PORTALS.find((p) => location.pathname.startsWith(p.path));
    setCurrentPortal(portal || null);
    if (portal && user) localStorage.setItem(lastPortalKey(user), portal.id);
  }, [location.pathname, user]);
  
  // Toggle sidebar collapsed
  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const newValue = !prev;
      localStorage.setItem("aurora_sidebar_collapsed", String(newValue));
      return newValue;
    });
  };
  
  // Open/close mobile drawer
  const openMobileDrawer = () => setMobileDrawerOpen(true);
  const closeMobileDrawer = () => setMobileDrawerOpen(false);
  
  const value = {
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebar,
    mobileDrawerOpen,
    openMobileDrawer,
    closeMobileDrawer,
    activeSection,
    setActiveSection,
    currentPortal,
  };
  
  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return context;
}
