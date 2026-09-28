import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowUpRight, MapPin, Briefcase, Loader2 } from "lucide-react";
import PageSEO from "@/components/shared/PageSEO";
import { JOBS as STATIC_JOBS } from "./publicContent";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

const DEPT_COLORS = {
  Culinary: "#E8A530",
  Beverage: "#C8A96E",
  Operations: "#7B9E87",
  Marketing: "#5B5FE3",
  Sales: "#8B5CF6",
  Finance: "#2563EB",
  IT: "#0891B2",
  HR: "#D97706",
  "F&B": "#E8A530",
  Management: "#7C3AED",
};

/** Normalise a job from API (snake_case) or static data (short keys) to a unified shape. */
function normalizeJob(j) {
  return {
    id:       j.id,
    title:    j.title,
    dept:     j.department || j.dept || "Other",
    type:     j.job_type   || j.type || "Full-time",
    brand:    j.brand      || "",
    location: j.location   || "",
    description:       j.description || "",
    requirements:      j.requirements || "",
    application_email: j.application_email || "",
  };
}

function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function Careers() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [activeDept, setActiveDept] = useState("All");

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/public/jobs?limit=200`, { signal: ctrl.signal });
        const json = await res.json();
        const raw = json?.data || [];
        if (Array.isArray(raw) && raw.length > 0) {
          setJobs(raw.map(normalizeJob));
        } else {
          // Fallback to static data
          setJobs(STATIC_JOBS.map(normalizeJob));
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          // Fallback to static
          setJobs(STATIC_JOBS.map(normalizeJob));
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, []);

  const depts = ["All", ...new Set(jobs.map((j) => j.dept))];
  const filtered = activeDept === "All" ? jobs : jobs.filter((j) => j.dept === activeDept);

  const handleApply = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Nama dan email wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/public/jobs/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: selectedJob?.id,
          name: form.name,
          email: form.email,
          phone: form.phone,
          message: form.message,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Lamaran berhasil dikirim! Tim HR kami akan menghubungi Anda.");
        setApplyOpen(false);
        setForm({ name: "", email: "", phone: "", message: "" });
      } else {
        const errMsg = json.errors?.[0]?.message || "Gagal mengirim lamaran.";
        toast.error(errMsg);
      }
    } catch {
      toast.error("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen" data-testid="careers-page">
      <PageSEO
        title="Karir di FnB Group Bandung"
        description="Bergabunglah dengan tim FnB Group Bandung. Kami mencari individu bersemangat di bidang F&B, hospitality, dan operasional restoran terbaik Bandung. Lihat lowongan terbuka."
        path="/careers"
        keywords="karir FnB Group, lowongan F&B Bandung, kerja restoran Bandung, hospitality jobs Bandung"
      />

      {/* Header */}
      <div className="pt-32 pb-12 px-6 lg:px-12 border-b border-[#1C1510]/10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
          <p className="text-[#1C1510]/40 text-[10px] tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Azeret Mono', monospace" }}>Join the Team</p>
          <h1
            className="text-[#1C1510] leading-[0.88] tracking-[-0.03em] mb-4"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(52px, 7vw, 96px)", fontWeight: 600 }}
          >
            Build Your Career
            <br /><em className="italic text-[#1C1510]/45">With Us</em>
          </h1>
          <p className="text-[#1C1510]/50 text-sm max-w-md">Bergabunglah dengan tim passionate kami yang mendedikasikan diri untuk F&B terbaik.</p>
        </motion.div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 lg:px-12 py-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#C8A96E]" />
          </div>
        ) : (
          <>
            {/* Dept filter */}
            <Reveal>
              <div className="flex flex-wrap gap-2 mb-10">
                {depts.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setActiveDept(dept)}
                    className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                      activeDept === dept
                        ? "text-white bg-[#1C1510]"
                        : "text-[#1C1510]/55 border border-[#1C1510]/15 hover:border-[#1C1510]/30 hover:text-[#1C1510]"
                    }`}
                    data-testid={`careers-filter-${dept.toLowerCase()}`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </Reveal>

            {/* Jobs list */}
            {filtered.length === 0 ? (
              <Reveal>
                <div className="text-center py-16 text-[#1C1510]/40">
                  Belum ada lowongan tersedia saat ini.
                </div>
              </Reveal>
            ) : (
              <div className="space-y-0 border border-[#1C1510]/10 rounded-2xl overflow-hidden" data-testid="careers-job-list">
                {filtered.map((job, i) => (
                  <Reveal key={job.id || i} delay={i * 0.04}>
                    <motion.div
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-[#F8F5EF] hover:bg-[#F0EAE0] border-b border-[#1C1510]/10 last:border-0 transition-colors gap-4"
                      whileHover={{ x: 1 }}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{
                            background: `${DEPT_COLORS[job.dept] || "#C8A96E"}20`,
                            border: `1px solid ${DEPT_COLORS[job.dept] || "#C8A96E"}40`,
                          }}
                        >
                          <Briefcase className="h-4 w-4" style={{ color: DEPT_COLORS[job.dept] || "#C8A96E" }} />
                        </div>
                        <div>
                          <h3
                            className="text-[#1C1510]/85 font-semibold"
                            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem" }}
                          >
                            {job.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {job.brand && <span className="text-[#1C1510]/45 text-xs">{job.brand}</span>}
                            {job.brand && job.location && <span className="text-[#1C1510]/20 text-xs">·</span>}
                            <span className="flex items-center gap-1 text-[#1C1510]/45 text-xs">
                              <MapPin className="h-3 w-3" />{job.location}
                            </span>
                            <span
                              className="text-[9px] px-2 py-0.5 rounded-full border"
                              style={{
                                color: DEPT_COLORS[job.dept] || "#C8A96E",
                                borderColor: `${DEPT_COLORS[job.dept] || "#C8A96E"}40`,
                                background: `${DEPT_COLORS[job.dept] || "#C8A96E"}15`,
                              }}
                            >
                              {job.dept}
                            </span>
                            <span className="text-[9px] px-2 py-0.5 rounded-full border border-[#1C1510]/15 text-[#1C1510]/40">
                              {job.type}
                            </span>
                          </div>
                        </div>
                      </div>
                      <motion.button
                        onClick={() => { setSelectedJob(job); setApplyOpen(true); }}
                        className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-[#1C1510] border border-[#1C1510]/20 hover:bg-[#1C1510] hover:text-white hover:border-[#1C1510] transition-colors"
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        data-testid="careers-apply-button"
                      >
                        Apply <ArrowUpRight className="h-3.5 w-3.5" />
                      </motion.button>
                    </motion.div>
                  </Reveal>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Apply Dialog */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="bg-[#F8F5EF] border border-[#1C1510]/20 text-[#1C1510] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Apply: {selectedJob?.title}
            </DialogTitle>
            <DialogDescription className="text-[#1C1510]/50 text-sm">
              {[selectedJob?.brand, selectedJob?.location].filter(Boolean).join(" · ")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleApply} className="space-y-4 mt-4">
            {[
              { l: "Full Name", k: "name",  t: "text",  p: "Nama lengkap" },
              { l: "Email",     k: "email", t: "email", p: "email@anda.com" },
              { l: "Phone",     k: "phone", t: "text",  p: "+62 8xx" },
            ].map(({ l, k, t, p }) => (
              <div key={k} className="space-y-1.5">
                <Label className="text-[#1C1510]/60 text-xs">{l}</Label>
                <Input
                  type={t}
                  value={form[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  placeholder={p}
                  className="bg-white border-[#1C1510]/20 text-[#1C1510] placeholder:text-[#1C1510]/30"
                  required={k !== "phone"}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-[#1C1510]/60 text-xs">Cover Letter</Label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="Ceritakan tentang diri Anda..."
                rows={4}
                className="bg-white border-[#1C1510]/20 text-[#1C1510] placeholder:text-[#1C1510]/30 resize-none"
              />
            </div>
            {selectedJob?.application_email && (
              <p className="text-xs text-[#1C1510]/40">
                Atau kirim CV langsung ke{" "}
                <a href={`mailto:${selectedJob.application_email}`} className="underline hover:text-[#1C1510]">
                  {selectedJob.application_email}
                </a>
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-[#1C1510] text-white text-sm font-medium rounded-full hover:bg-[#1C1510]/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              data-testid="submit-application"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mengirim...
                </>
              ) : "Submit Application"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
