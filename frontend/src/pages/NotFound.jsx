import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

/** 404 — halaman mandiri (di luar AppShell). Pengguna yang sudah login diarahkan
 *  kembali ke beranda ERP (/erp), pengunjung publik ke situs utama (/). */
export default function NotFound() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const homePath = user ? "/erp" : "/";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative z-1 bg-background" data-testid="not-found-page">
      <div className="glass-card p-6 w-full max-w-md text-center">
        <div className="h-12 w-12 mx-auto rounded-[calc(var(--radius)-2px)] grad-aurora flex items-center justify-center mb-3">
          <SearchX className="h-6 w-6 text-white" />
        </div>
        <p className="text-sm font-semibold tabular-nums text-muted-foreground tracking-[0.08em]">404</p>
        <h1 className="text-xl md:text-2xl font-semibold leading-tight mt-1">Halaman tidak ditemukan</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          URL yang Anda tuju tidak ada atau sudah dipindahkan.
        </p>
        <div className="mt-4 flex flex-col-reverse sm:flex-row items-center justify-center gap-2">
          <Button variant="outline" onClick={() => navigate(-1)} data-testid="not-found-back">
            <ArrowLeft /> Halaman sebelumnya
          </Button>
          <Button asChild data-testid="not-found-home">
            <Link to={homePath}>
              <Home /> Kembali ke beranda
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
