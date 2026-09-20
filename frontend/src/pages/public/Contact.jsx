import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import PageSEO from "@/components/shared/PageSEO";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 900));
    setSubmitting(false);
    toast.success("Pesan terkirim!");
    setForm({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <div className="min-h-screen" data-testid="contact-page">
      <PageSEO
        title="Hubungi Kami — FnB Group Bandung"
        description="Hubungi FnB Group Bandung untuk reservasi, partnership, event corporate, atau pertanyaan umum. Kami siap membantu."
        path="/contact"
        keywords="kontak FnB Group, reservasi restoran Bandung, partnership F&B, event corporate Bandung"
      />
      {/* Header */}
      <div className="pt-32 pb-12 px-6 lg:px-12 border-b border-[#1C1510]/10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
          <p className="text-[#1C1510]/40 text-[10px] tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Azeret Mono', monospace" }}>Get In Touch</p>
          <h1 className="text-[#1C1510] leading-[0.88] tracking-[-0.03em]" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(52px, 7vw, 96px)", fontWeight: 600 }}>Contact Us</h1>
        </motion.div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 lg:px-12 py-16 grid lg:grid-cols-2 gap-16">
        {/* Form */}
        <motion.form onSubmit={handleSubmit} className="space-y-5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} data-testid="contact-form">
          <div className="grid sm:grid-cols-2 gap-4">
            {[{l:"Full Name",k:"name",t:"text",p:"Nama Anda",tid:"contact-form-name-input"},{l:"Email",k:"email",t:"email",p:"email@anda.com",tid:"contact-form-email-input"}].map(({l,k,t,p,tid}) => (
              <div key={k} className="space-y-1.5">
                <Label className="text-[#1C1510]/55 text-xs">{l}</Label>
                <Input type={t} value={form[k]} onChange={(e)=>setForm((f)=>({...f,[k]:e.target.value}))} placeholder={p} className="bg-white border-[#1C1510]/20 text-[#1C1510] placeholder:text-[#1C1510]/30 h-11" required data-testid={tid} />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[#1C1510]/55 text-xs">Subject</Label>
            <Input value={form.subject} onChange={(e)=>setForm((f)=>({...f,subject:e.target.value}))} placeholder="Apa yang ingin Anda sampaikan?" className="bg-white border-[#1C1510]/20 text-[#1C1510] placeholder:text-[#1C1510]/30 h-11" required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[#1C1510]/55 text-xs">Message</Label>
            <Textarea value={form.message} onChange={(e)=>setForm((f)=>({...f,message:e.target.value}))} placeholder="Tulis pesan Anda..." rows={6} className="bg-white border-[#1C1510]/20 text-[#1C1510] placeholder:text-[#1C1510]/30 resize-none" required data-testid="contact-form-message-textarea" />
          </div>
          <motion.button type="submit" disabled={submitting}
            className="flex items-center gap-2 px-7 py-3.5 bg-[#1C1510] text-white text-sm font-medium rounded-full hover:bg-[#1C1510]/85 disabled:opacity-60 transition-colors"
            whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
            data-testid="contact-form-submit-button"
          >
            {submitting ? <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Mengirim...</> : <>Send Message<Send className="h-4 w-4" /></>}
          </motion.button>
        </motion.form>

        {/* Info */}
        <motion.div className="space-y-5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}>
          {[
            { icon: Mail, label: "Email", value: "hello@fnbgroup.id", href: "mailto:hello@fnbgroup.id" },
            { icon: Phone, label: "Phone", value: "+62 21 5798 0000", href: "tel:+622157980000" },
            { icon: MapPin, label: "HQ", value: "Jl. Jend. Sudirman Kav 21, Jakarta Selatan 12920", href: "#" },
          ].map((c, i) => (
            <a key={i} href={c.href} className="flex items-start gap-4 p-5 rounded-xl border border-[#1C1510]/12 bg-white hover:border-[#1C1510]/20 hover:bg-[#F0EAE0] transition-all group block">
              <div className="h-10 w-10 rounded-xl bg-[#F0EAE0] border border-[#1C1510]/10 flex items-center justify-center flex-shrink-0">
                <c.icon className="h-4.5 w-4.5 text-[#C8A96E]" />
              </div>
              <div>
                <p className="text-[#1C1510]/40 text-[9px] tracking-wider uppercase mb-1" style={{ fontFamily: "'Azeret Mono', monospace" }}>{c.label}</p>
                <p className="text-[#1C1510]/70 text-sm group-hover:text-[#1C1510] transition-colors">{c.value}</p>
              </div>
            </a>
          ))}

          {/* Hours */}
          <div className="p-5 rounded-xl border border-[#1C1510]/12 bg-white">
            <p className="text-[#1C1510]/40 text-[9px] tracking-wider uppercase mb-4" style={{ fontFamily: "'Azeret Mono', monospace" }}>Office Hours</p>
            {[{day:"Senin – Jumat",h:"09:00 – 18:00"},{day:"Sabtu",h:"10:00 – 15:00"},{day:"Minggu",h:"Tutup"}].map((row)=>(
              <div key={row.day} className="flex justify-between py-1.5 border-b border-[#1C1510]/5 last:border-0">
                <span className="text-[#1C1510]/50 text-sm">{row.day}</span>
                <span className={`text-sm ${row.h === "Tutup" ? "text-[#1C1510]/30" : "text-[#1C1510]/70"}`}>{row.h}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
