import { useNavigate } from "react-router-dom";
import { User as UserIcon, History, Gift, CreditCard, UserCog, LogOut, Home } from "lucide-react";
import { useLoyaltyAuth } from "@/contexts/LoyaltyAuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Reusable user dropdown for all loyalty pages.
 * Shows avatar initials, tier badge, and quick links.
 */
export default function LoyaltyUserDropdown() {
  const navigate = useNavigate();
  const { customer, logout } = useLoyaltyAuth();

  if (!customer) return null;

  const initials = customer.full_name
    ?.split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  const handleLogout = () => {
    logout();
    navigate("/loyalty/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 rounded-full pl-2 pr-3 gap-2 hover:bg-muted/60"
          data-testid="loyalty-user-menu-trigger"
        >
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">
            {initials}
          </div>
          <span className="text-sm font-medium hidden sm:inline">
            {customer.full_name.split(" ")[0]}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="pb-2">
          <div className="font-semibold">{customer.full_name}</div>
          <div className="text-xs text-muted-foreground font-normal">
            {customer.email}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium uppercase tracking-wide">
              {customer.loyalty_tier}
            </span>
            <span className="text-muted-foreground">
              <span className="font-bold text-foreground">
                {customer.total_points.toLocaleString()}
              </span>{" "}
              poin
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate("/loyalty")}
          data-testid="loyalty-menu-dashboard"
          className="cursor-pointer"
        >
          <Home className="h-4 w-4 mr-2" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate("/loyalty/card")}
          data-testid="loyalty-menu-card"
          className="cursor-pointer"
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Kartu Digital
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate("/loyalty/rewards")}
          data-testid="loyalty-menu-rewards"
          className="cursor-pointer"
        >
          <Gift className="h-4 w-4 mr-2" />
          Rewards
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate("/loyalty/history")}
          data-testid="loyalty-menu-history"
          className="cursor-pointer"
        >
          <History className="h-4 w-4 mr-2" />
          Riwayat
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate("/loyalty/profile")}
          data-testid="loyalty-menu-profile"
          className="cursor-pointer"
        >
          <UserCog className="h-4 w-4 mr-2" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          data-testid="loyalty-menu-logout"
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
