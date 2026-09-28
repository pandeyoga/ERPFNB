import { useEffect, useRef, useState } from "react";
import { Outlet, NavLink, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Menu as MenuIcon, X, ExternalLink, ArrowUpRight, Zap } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV_LINKS = [
  { to: "/", label: "Home", exact: true },
  { to: "/brands", label: "Brands" },
  { to: "/menu", label: "Menu" },
  { to: "/locations", label: "Locations" },
  { to: "/about", label: "About" },
  { to: "/news", label: "News" },
  { to: "/reservation", label: "Reservasi" },
  { to: "/careers", label: "Careers" },
  { to: "/contact", label: "Contact" },
];

// ---- Custom Cursor ----
function CustomCursor() {
  const cursorX = useRef(typeof window !== "undefined" ? window.innerWidth / 2 : 0);
  const cursorY = useRef(typeof window !== "undefined" ? window.innerHeight / 2 : 0);
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef(null);

  useEffect(() => {
    const move = (e) => {
      cursorX.current = e.clientX;
      cursorY.current = e.clientY;
      setVisible(true);
    };
    const hover = () => setHovered(true);
    const unhover = () => setHovered(false);
    const addListeners = () => {
      document.querySelectorAll("a,button,[data-cursor-hover]").forEach((el) => {
        el.addEventListener("mouseenter", hover);
        el.addEventListener("mouseleave", unhover);
      });
    };
    const tick = () => {
      setPos({ x: cursorX.current, y: cursorY.current });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    window.addEventListener("mousemove", move);
    const observer = new MutationObserver(addListeners);
    observer.observe(document.body, { childList: true, subtree: true });
    addListeners();
    return () => {
      window.removeEventListener("mousemove", move);
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!visible) return null;
  return (
    <div
      className="public-cursor"
      style={{
        left: pos.x,
        top: pos.y,
        transform: `translate(-50%, -50%) scale(${hovered ? 2.2 : 1})`,
        transition: "transform 180ms cubic-bezier(0.16,1,0.3,1)",
      }}
    />
  );
}

// ---- Public Header ----
function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <motion.header
      data-testid="public-header"
      className="fixed top-0 left-0 right-0 z-50"
      animate={{
        backgroundColor: scrolled ? "rgba(248,245,240,0.96)" : "rgba(248,245,240,0)",
        borderBottomColor: scrolled ? "rgba(28,21,16,0.08)" : "rgba(28,21,16,0)",
      }}
      transition={{ duration: 0.35 }}
      style={{ backdropFilter: scrolled ? "blur(12px)" : "none", borderBottomWidth: 1, borderBottomStyle: "solid" }}
    >
      <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between h-16 lg:h-[72px]">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2" data-testid="public-header-logo">
            <span
              className={`font-semibold tracking-[0.22em] uppercase text-sm transition-colors duration-300 ${
                scrolled ? "text-[#1C1510]" : "text-white"
              }`}
              style={{ fontFamily: "'Cormorant Garamond', serif", textShadow: scrolled ? "none" : "0 1px 3px rgba(0,0,0,0.3)" }}
            >
              FNB GROUP
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-0" data-testid="public-header-nav">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.exact}
                className={({ isActive }) =>
                  `relative px-3 py-2 text-[13px] font-medium transition-colors duration-300 ${
                    scrolled 
                      ? (isActive ? "text-[#1C1510]" : "text-[#1C1510]/50 hover:text-[#1C1510]")
                      : (isActive ? "text-white font-semibold" : "text-white/80 hover:text-white")
                  }`
                }
                style={{ textShadow: scrolled ? "none" : "0 1px 2px rgba(0,0,0,0.3)" }}
                data-testid={`nav-link-${link.label.toLowerCase()}`}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Right: Loyalty CTA + hidden ERP */}
          <div className="flex items-center gap-3">
            {/* Loyalty CTA — prominent */}
            <Link
              to="/loyalty/login"
              className={`hidden lg:flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold transition-all hover:scale-[1.02] duration-300 ${
                scrolled ? "bg-[#1C1510] text-[#F8F5EF]" : "bg-white/10 backdrop-blur-sm text-white border border-white/20"
              }`}
              style={{
                boxShadow: scrolled ? "0 2px 10px rgba(28,21,16,0.15)" : "0 2px 10px rgba(0,0,0,0.1)",
              }}
              data-testid="public-header-loyalty-button"
            >
              <Zap className="h-3.5 w-3.5" style={{ color: scrolled ? "#C9A876" : "#F8F5EF" }} />
              FnB Rewards
            </Link>

            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  className={`lg:hidden flex items-center justify-center h-9 w-9 transition-colors duration-300 ${
                    scrolled ? "text-[#1C1510]/70 hover:text-[#1C1510]" : "text-white/90 hover:text-white"
                  }`}
                  style={{ textShadow: scrolled ? "none" : "0 1px 2px rgba(0,0,0,0.3)" }}
                  data-testid="public-header-mobile-menu-button"
                >
                  <MenuIcon className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] bg-[#F8F5EF] border-l border-[#1C1510]/10 p-0">
                <div className="flex flex-col h-full p-8">
                  <div className="flex items-center justify-between mb-10">
                    <span className="text-[#1C1510] font-semibold tracking-[0.22em] uppercase text-sm" style={{ fontFamily: "'Cormorant Garamond', serif" }}>FNB GROUP</span>
                    <button onClick={() => setMobileOpen(false)} className="text-[#1C1510]/50 hover:text-[#1C1510]">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <nav className="flex flex-col gap-1 flex-1">
                    {NAV_LINKS.map((link) => (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        end={link.exact}
                        className={({ isActive }) =>
                          `px-3 py-3.5 text-xl font-medium transition-colors ${
                            isActive ? "text-[#1C1510]" : "text-[#1C1510]/45 hover:text-[#1C1510]"
                          }`
                        }
                        style={{ fontFamily: "'Cormorant Garamond', serif" }}
                      >
                        {link.label}
                      </NavLink>
                    ))}
                  </nav>

                  {/* Loyalty CTA in mobile */}
                  <Link
                    to="/loyalty/login"
                    className="flex items-center gap-2 py-3.5 px-3 rounded-xl mb-3 font-semibold"
                    style={{ background: "#1C1510", color: "#F8F5EF", fontSize: "0.9rem" }}
                    data-testid="public-header-loyalty-mobile-button"
                  >
                    <Zap className="h-4 w-4" style={{ color: "#C9A876" }} />
                    FnB Rewards
                  </Link>

                  {/* ERP - very subtle */}
                  <div className="pt-4" style={{ borderTop: "1px solid rgba(28,21,16,0.07)" }}>
                    <Link
                      to="/login"
                      className="flex items-center gap-1.5 text-xs transition-colors"
                      style={{ color: "rgba(28,21,16,0.3)" }}
                      data-testid="public-header-login-erp-button"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Staff Access
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </motion.header>
  );
}

// ---- Public Footer ----
function PublicFooter() {
  return (
    <footer className="bg-[#1C1510] text-white">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 pb-12 border-b border-white/10">
          <div>
            <p className="text-white font-semibold tracking-[0.22em] uppercase text-base mb-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>FNB GROUP</p>
            <p className="text-white/40 text-xs leading-relaxed mb-6 max-w-xs">Grup F&B premium dengan 4 brand unggulan dan 8 outlet di seluruh Indonesia.</p>
            {/* Loyalty link in footer */}
            <Link
              to="/loyalty/login"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-opacity hover:opacity-80"
              style={{ background: "rgba(201,168,118,0.12)", border: "1px solid rgba(201,168,118,0.2)", color: "#C9A876" }}
            >
              <Zap className="h-3 w-3" />
              FnB Rewards
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-8 lg:col-span-2">
            <div>
              <p className="text-white/50 text-[10px] tracking-[0.2em] uppercase mb-4" style={{ fontFamily: "'Azeret Mono', monospace" }}>Our Brands</p>
              <ul className="space-y-2">
                {["The Coffeeshop", "The Restaurant", "The Bistro", "The Lounge"].map((b) => (
                  <li key={b}><Link to="/brands" className="text-white/45 text-sm hover:text-white transition-colors">{b}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-white/50 text-[10px] tracking-[0.2em] uppercase mb-4" style={{ fontFamily: "'Azeret Mono', monospace" }}>Company</p>
              <ul className="space-y-2">
                {[{l:"About",to:"/about"},{l:"News",to:"/news"},{l:"Reservasi",to:"/reservation"},{l:"Careers",to:"/careers"},{l:"Contact",to:"/contact"}].map(({l,to}) => (
                  <li key={to}><Link to={to} className="text-white/45 text-sm hover:text-white transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8">
          <p className="text-white/25 text-xs">&copy; {new Date().getFullYear()} FnB Group. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <a href="#" className="text-white/25 text-xs hover:text-white/50 transition-colors">Privacy</a>
            <a href="#" className="text-white/25 text-xs hover:text-white/50 transition-colors">Terms</a>
            {/* ERP staff access - hidden in footer */}
            <Link to="/login" className="text-white/15 text-xs hover:text-white/35 transition-colors" data-testid="footer-staff-access">
              Staff
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="public-site" style={{ background: "#F8F5EF", color: "#1C1510", cursor: "none" }}>
      <CustomCursor />
      <PublicHeader />
      {/* Fix 2026-05-27: Removed AnimatePresence + motion.main wrapper to avoid
         framer-motion v11 stuck-at-exit-state bug. Same fix as AppShell.jsx. */}
      <main>
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
