/**
 * ComingSoonPage — placeholder konsisten untuk halaman / fitur yang
 * sudah terdaftar di sidebar tapi belum diimplementasikan FE-nya.
 *
 * Pakai dari Routes:
 *   <Route path="settings" element={
 *     <ComingSoonPage
 *       icon={Settings}
 *       title="System Settings"
 *       subtitle="Pengaturan umum sistem"
 *       eta="Q1 2026"
 *     />
 *   } />
 */
import { Sparkles, Hammer, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

import PageHeader from "./PageHeader";
import { Button } from "@/components/ui/button";

export default function ComingSoonPage({
  icon: Icon = Sparkles,
  title = "Coming Soon",
  subtitle,
  description,
  eta,
  backTo,
  backLabel = "Kembali",
  alternativeLinks = [],
}) {
  const finalDescription =
    description ||
    "Fitur ini sedang dalam tahap pengembangan dan akan segera tersedia. " +
      "Anda akan mendapatkan notifikasi ketika fitur sudah siap digunakan.";

  return (
    <div className="max-w-4xl mx-auto" data-testid="coming-soon-page">
      <PageHeader icon={Icon} title={title} subtitle={subtitle} />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card p-8 sm:p-12 text-center"
      >
        {/* Hero icon */}
        <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 grad-aurora-soft rounded-3xl blur-xl opacity-60" />
          <div className="relative h-20 w-20 rounded-2xl grad-aurora flex items-center justify-center shadow-lg">
            <Hammer className="h-10 w-10 text-white" strokeWidth={2} />
          </div>
        </div>

        <h2
          className="text-2xl sm:text-3xl font-bold tracking-tight mb-3"
          data-testid="coming-soon-title"
        >
          Fitur Sedang Dibangun
        </h2>

        <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto mb-2 leading-relaxed">
          {finalDescription}
        </p>

        {eta && (
          <div className="inline-flex items-center gap-2 mt-4 mb-2 px-3.5 py-1.5 rounded-full bg-foreground/5 border border-foreground/10 text-xs sm:text-sm">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-medium">Target rilis: {eta}</span>
          </div>
        )}

        {(backTo || alternativeLinks.length > 0) && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            {backTo && (
              <Button
                asChild
                variant="outline"
                className="rounded-full"
                data-testid="coming-soon-back-button"
              >
                <Link to={backTo}>{backLabel}</Link>
              </Button>
            )}
            {alternativeLinks.map((link) => (
              <Button
                key={link.to}
                asChild
                variant="ghost"
                className="rounded-full gap-1.5"
                data-testid={`coming-soon-alt-${link.to.replace(/\W+/g, "-")}`}
              >
                <Link to={link.to}>
                  {link.label} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Decorative subtle hint */}
      <p className="text-center text-xs text-muted-foreground mt-4">
        Butuh akses prioritas? Hubungi admin sistem.
      </p>
    </div>
  );
}
