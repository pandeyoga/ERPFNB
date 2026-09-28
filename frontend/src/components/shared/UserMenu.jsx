import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown, LogOut, User as UserIcon, Settings as SettingsIcon, KeyRound,
  LayoutGrid, CheckCircle2, Globe2, Store, Building2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import api, { unwrap } from "@/lib/api";
import { toast } from "sonner";
import ChangePasswordDialog from "@/components/shared/ChangePasswordDialog";
import ProfileDialog from "@/components/shared/ProfileDialog";
import PreferencesDialog from "@/components/shared/PreferencesDialog";

export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rememberPortal, setRememberPortal] = useState(() => {
    // IA v3: default AKTIF — Beranda = modul terakhir yang dibuka
    return localStorage.getItem("aurora_remember_last_portal") !== "false";
  });
  const [outlets, setOutlets] = useState([]);
  const [brands, setBrands] = useState([]);
  const [activeDialog, setActiveDialog] = useState(null); // 'profile' | 'password' | 'preferences' | null

  useEffect(() => {
    if (!user) return;
    api.get("/master/outlets", { params: { per_page: 100 } })
      .then((r) => setOutlets(unwrap(r) || [])).catch(() => {});
    api.get("/master/brands", { params: { per_page: 100 } })
      .then((r) => setBrands(unwrap(r) || [])).catch(() => {});
  }, [user]);

  if (!user) return null;

  const isFullAccess = (user?.permissions || []).includes("*");
  const userOutletIds = user?.outlet_ids || [];
  const userBrandIds = user?.brand_ids || [];
  const scopeOutlets = outlets.filter((o) => userOutletIds.includes(o.id));
  const scopeBrands = brands.filter((b) => userBrandIds.includes(b.id));
  const isRestricted = !isFullAccess && userOutletIds.length > 0 && userOutletIds.length < outlets.length;

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const toggleRememberPortal = () => {
    const newValue = !rememberPortal;
    setRememberPortal(newValue);
    localStorage.setItem("aurora_remember_last_portal", String(newValue));
    toast.success(
      newValue
        ? "Beranda akan membuka modul terakhir yang Anda kunjungi"
        : "Beranda akan membuka modul default Anda"
    );
  };

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 h-10 pl-2 pr-3 rounded-full glass-input hover:bg-foreground/5 transition-colors"
          data-testid="user-menu-trigger"
        >
          <div className="h-7 w-7 rounded-full grad-aurora flex items-center justify-center text-white text-xs font-bold">
            {initials(user.full_name)}
          </div>
          <span className="hidden md:block text-sm font-medium max-w-[120px] truncate">
            {user.full_name}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground hidden md:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 glass-card">
        {/* User identity */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold truncate">{user.full_name}</span>
            <span className="text-xs text-muted-foreground truncate">{user.email}</span>
          </div>
        </DropdownMenuLabel>

        {/* Scope context block */}
        <div className="px-2 pb-2">
          {isFullAccess ? (
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-2.5 py-1.5">
              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <Globe2 className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-[11px] font-semibold">Full Access</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Semua brand &amp; outlet dapat diakses
              </p>
            </div>
          ) : isRestricted ? (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5">
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <Store className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-[11px] font-semibold">Outlet Staff</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Data dibatasi untuk:
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {scopeOutlets.map((o) => (
                  <span key={o.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium">
                    {o.name}
                  </span>
                ))}
              </div>
              {scopeBrands.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {scopeBrands.map((b) => (
                    <span key={b.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium flex items-center gap-0.5">
                      <Building2 className="h-2.5 w-2.5" /> {b.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={(e) => { e.preventDefault(); setActiveDialog("profile"); }}
          data-testid="menu-profile"
        >
          <UserIcon className="h-4 w-4 mr-2" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={(e) => { e.preventDefault(); setActiveDialog("password"); }}
          data-testid="menu-change-password"
        >
          <KeyRound className="h-4 w-4 mr-2" /> Change Password
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={(e) => { e.preventDefault(); setActiveDialog("preferences"); }}
          data-testid="menu-preferences"
        >
          <SettingsIcon className="h-4 w-4 mr-2" /> Preferences
        </DropdownMenuItem>
        <DropdownMenuCheckboxItem
          checked={rememberPortal}
          onCheckedChange={toggleRememberPortal}
          className="cursor-pointer"
        >
          <CheckCircle2 className="h-4 w-4 mr-2" /> Ingat Modul Terakhir
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate("/erp")}
          className="cursor-pointer"
          data-testid="topnav-home-menu-item"
        >
          <LayoutGrid className="h-4 w-4 mr-2" /> Beranda
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-destructive focus:text-destructive"
          data-testid="logout-button"
        >
          <LogOut className="h-4 w-4 mr-2" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <ProfileDialog open={activeDialog === "profile"} onOpenChange={(v) => setActiveDialog(v ? "profile" : null)} />
    <ChangePasswordDialog open={activeDialog === "password"} onOpenChange={(v) => setActiveDialog(v ? "password" : null)} />
    <PreferencesDialog open={activeDialog === "preferences"} onOpenChange={(v) => setActiveDialog(v ? "preferences" : null)} />
    </>
  );
}
