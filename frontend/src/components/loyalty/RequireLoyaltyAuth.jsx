import { Navigate } from "react-router-dom";
import { useLoyaltyAuth } from "@/contexts/LoyaltyAuthContext";

export default function RequireLoyaltyAuth({ children }) {
  const { customer, loading } = useLoyaltyAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card px-6 py-4 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-sm text-muted-foreground">Memuat...</span>
        </div>
      </div>
    );
  }

  if (!customer) {
    return <Navigate to="/loyalty/login" replace />;
  }

  return children;
}
