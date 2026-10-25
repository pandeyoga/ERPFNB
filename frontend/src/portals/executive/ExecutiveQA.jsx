/** Executive Q&A — satu-satunya halaman tanya-jawab AI (keputusan IA 25 Okt, EXE-QA-03).
 *  Memakai ConversationalQA (tool-calling /api/ai/exec-qa, sesi, input suara) — komponen yang
 *  sama dengan panel ringkas di Sales Analytics. /owner/ai-assistant diarahkan ke sini. */
import { Brain } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import ConversationalQA from "@/components/shared/ConversationalQA";

export default function ExecutiveQA() {
  return (
    <div className="space-y-3 lg:space-y-4" data-testid="executive-qa-page">
      <PageHeader
        icon={Brain}
        title="Executive Q&A"
        subtitle="Tanya kondisi bisnis & keuangan group lewat teks atau suara — dijawab dalam Bahasa Indonesia dari data ERP."
        className="mb-0 md:mb-0"
      />
      {/* ConversationalQA sudah ber-surface glass-card → tidak dibungkus kartu lagi. */}
      <ConversationalQA hideHeader />
    </div>
  );
}
