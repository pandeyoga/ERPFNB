import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { COMPANY_VALUES, TEAM } from "./publicContent";
import PageSEO from "@/components/shared/PageSEO";
import VideoPlayer from "@/components/shared/VideoPlayer";

function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 24 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}

export default function About() {
  return (
    <div className="min-h-screen" data-testid="about-page">
      <PageSEO
        title="About Us — FnB Group Bandung"
        description="FnB Group adalah hospitality group yang membangun ekosistem F&B terbaik di Bandung. 5 brand dari fine dining hingga coffee shop, menggabungkan kreativitas kuliner dengan standar internasional."
        path="/about"
        keywords="tentang fnbgroup group, company profile fnbgroup, restoran bandung"
        schemaType="Organization"
        path="/about"
        keywords="FnB Group about, sejarah FnB Group, F&B group Jakarta, hospitality Indonesia"
      />
      {/* Hero */}
      <div className="relative h-[55vh] min-h-[400px] overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(https://images.unsplash.com/photo-1776775451863-427f053c21df?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=2000)` }} />
        <div className="absolute inset-0" style={{ background: "rgba(28,21,16,0.5)" }} />
        <div className="relative z-10 h-full flex flex-col justify-end px-6 sm:px-10 lg:px-16 pb-14 max-w-screen-xl mx-auto">
          <p className="text-white/45 text-[10px] tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Azeret Mono', monospace" }}>About FnB Group</p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.9 }}
            className="text-white leading-[0.88] tracking-[-0.03em]" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(52px, 7vw, 96px)", fontWeight: 600 }}>
            A Passion for
            <br /><em className="italic">Hospitality</em>
          </motion.h1>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 sm:px-10 lg:px-16">
        {/* Intro */}
        <section className="py-20 lg:py-28 grid lg:grid-cols-2 gap-16">
          <Reveal>
            <p className="text-[#1C1510]/60 text-lg leading-relaxed" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.35rem" }}>
              FnB Group lahir dari sebuah keyakinan sederhana: bahwa momen kebersamaan di meja makan adalah salah satu hal paling berharga dalam hidup.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-[#1C1510]/45 text-sm leading-relaxed mt-4 lg:mt-0">
              Sejak 2018, kami telah membangun ekosistem F&B premium yang merayakan keberagaman rasa, budaya, dan pengalaman. Dari specialty coffee hingga fine dining Eropa, dari tapas Latin hingga sports bar Amerika — setiap brand kami adalah ekspresi unik dari filosofi yang sama: <em className="text-[#1C1510]/65 italic">menciptakan kehidupan yang baik melalui makanan</em>.
            </p>
          </Reveal>
        </section>

        {/* Mission / Vision */}
        <section className="py-16 border-t border-[#1C1510]/10 grid lg:grid-cols-2 gap-px bg-[#1C1510]/10">
          {[
            { tag: "Mission", title: "Creating Moments That Matter", desc: "Kami hadir untuk menciptakan pengalaman kuliner yang berkesan — setiap hidangan, setiap tegukan, setiap senyum yang kami sajikan adalah bagian dari misi kami." },
            { tag: "Vision", title: "Indonesia's Premier F&B Group", desc: "Menjadi grup F&B terdepan di Indonesia yang mendefinisikan standar baru keunggulan kuliner — dengan ekspansi berkelanjutan dan komitmen penuh pada kualitas." },
          ].map((item, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div className="p-10 bg-[#F8F5EF]">
                <p className="text-[#C8A96E] text-[9px] tracking-[0.3em] uppercase mb-4" style={{ fontFamily: "'Azeret Mono', monospace" }}>{item.tag}</p>
                <h2 className="text-[#1C1510] leading-tight tracking-[-0.02em] mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(24px, 3vw, 38px)", fontWeight: 600 }}>{item.title}</h2>
                <p className="text-[#1C1510]/50 text-sm leading-relaxed">{item.desc}</p>
              </div>
            </Reveal>
          ))}
        </section>

        {/* Values */}
        <section className="py-20 border-t border-[#1C1510]/10">
          <Reveal>
            <p className="text-[#1C1510]/40 text-[10px] tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Azeret Mono', monospace" }}>What We Stand For</p>
            <h2 className="text-[#1C1510] leading-tight tracking-[-0.025em] mb-12" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 600 }}>Our Values</h2>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#1C1510]/10">
            {COMPANY_VALUES.map((val, i) => (
              <Reveal key={i} delay={i * 0.07}>
                <motion.div className="p-8 bg-[#F8F5EF] hover:bg-[#F0EAE0] transition-colors" whileHover={{ y: -1 }}>
                  <div className="text-2xl mb-5">{val.icon}</div>
                  <h3 className="text-[#1C1510]/85 font-semibold mb-2" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.15rem" }}>{val.title}</h3>
                  <p className="text-[#1C1510]/45 text-xs leading-relaxed">{val.desc}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Timeline */}
        <section className="py-20 border-t border-[#1C1510]/10">
          <Reveal>
            <p className="text-[#1C1510]/40 text-[10px] tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Azeret Mono', monospace" }}>Journey</p>
            <h2 className="text-[#1C1510] leading-tight tracking-[-0.025em] mb-12" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 600 }}>Our Milestones</h2>
          </Reveal>
          <div className="space-y-0 max-w-2xl">
            {[
              {year:"2018",title:"The Coffeeshop Founded",desc:"Membuka outlet pertama The Coffeeshop di Sudirman, Jakarta."},
              {year:"2019",title:"The Restaurant Opens",desc:"Ekspansi ke konsep Latin-Mediterranean dengan The Restaurant SCBD."},
              {year:"2020",title:"The Bistro & Series B",desc:"The Bistro Gandaria dibuka, menandai masuknya ke segmen fine dining."},
              {year:"2021",title:"The Lounge & Bali",desc:"Peluncuran The Lounge dan ekspansi pertama ke luar Jakarta."},
              {year:"2023",title:"FnB Group ERP Launch",desc:"Implementasi sistem ERP in-house untuk operasional group."},
              {year:"2026",title:"8 Outlets Strong",desc:"FnB Group kini hadir di 8 lokasi dengan 250+ anggota tim."},
            ].map((item, i) => (
              <Reveal key={i} delay={i * 0.05}>
                <div className="flex gap-6 pb-10">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full border-2 border-[#C8A96E] bg-[#F8F5EF] flex items-center justify-center z-10 flex-shrink-0">
                      <div className="h-2 w-2 rounded-full bg-[#C8A96E]" />
                    </div>
                    {i < 5 && <div className="w-px flex-1 bg-[#1C1510]/10 mt-2" />}
                  </div>
                  <div className="pb-2">
                    <span className="text-[#C8A96E] text-[9px] tracking-[0.2em] uppercase" style={{ fontFamily: "'Azeret Mono', monospace" }}>{item.year}</span>
                    <h3 className="text-[#1C1510]/85 font-semibold mt-1 mb-1" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem" }}>{item.title}</h3>
                    <p className="text-[#1C1510]/45 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

        {/* VIDEO SECTION - NEW! */}
        <section className="py-20 border-t border-[#1C1510]/10">
          <Reveal>
            <p className="text-[#1C1510]/40 text-[10px] tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Azeret Mono', monospace" }}>Experience</p>
            <h2 className="text-[#1C1510] leading-tight tracking-[-0.025em] mb-12" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 600 }}>See Us in Action</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="max-w-4xl mx-auto">
              <VideoPlayer
                src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                poster="https://images.unsplash.com/photo-1776775451863-427f053c21df?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1200"
                title="FnB Group - Behind the Scenes"
                aspectRatio="16/9"
                muted
              />
              <p className="text-[#1C1510]/40 text-xs mt-4 text-center" style={{ fontFamily: "'Azeret Mono', monospace" }}>
                FnB Group - Creating Moments That Matter
              </p>
            </div>
          </Reveal>
        </section>

        </section>

        {/* Team */}
        <section className="py-20 border-t border-[#1C1510]/10">
          <Reveal>
            <p className="text-[#1C1510]/40 text-[10px] tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Azeret Mono', monospace" }}>Leadership</p>
            <h2 className="text-[#1C1510] leading-tight tracking-[-0.025em] mb-12" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 600 }}>Our Team</h2>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#1C1510]/10">
            {TEAM.map((member, i) => (
              <Reveal key={i} delay={i * 0.07}>
                <div className="p-8 text-center bg-[#F8F5EF] hover:bg-[#F0EAE0] transition-colors">
                  <div className="h-16 w-16 rounded-full bg-[#E8E0D5] border border-[#1C1510]/10 flex items-center justify-center mx-auto mb-4 text-xl font-semibold text-[#1C1510]/40" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                    {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <p className="text-[#1C1510]/85 text-sm font-semibold">{member.name}</p>
                  <p className="text-[#1C1510]/40 text-xs mt-1">{member.role}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
