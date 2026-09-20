import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Lock, Eye, EyeOff, LogOut } from "lucide-react";
import { useLoyaltyAuth } from "@/contexts/LoyaltyAuthContext";
import LoyaltyUserDropdown from "@/components/loyalty/LoyaltyUserDropdown";
import { toast } from "sonner";
import axios from "axios";

const API_URL = process.env.REACT_APP_BACKEND_URL || "";

function LabelInput({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium tracking-wide uppercase" style={{ color: "rgba(240,234,224,0.45)" }}>{label}</label>
      {children}
    </div>
  );
}

export default function LoyaltyProfile() {
  const { customer, token, logout, refreshCustomer } = useLoyaltyAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [error, setError] = useState("");
  const [pwError, setPwError] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);

  const [profileData, setProfileData] = useState({
    full_name: customer?.full_name || "",
    phone: customer?.phone || "",
    date_of_birth: customer?.date_of_birth || "",
    gender: customer?.gender || "",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "", newPassword: "", confirmPassword: "",
  });

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "#0D0B07";
    return () => { document.body.style.background = prev; };
  }, []);

  const handleProfileChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
    setError("");
  };
  const handlePwChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
    setPwError("");
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await axios.put(`${API_URL}/api/loyalty/me`, profileData, { headers: { Authorization: `Bearer ${token}` } });
      await refreshCustomer();
      toast.success("Profile berhasil diupdate!");
    } catch (err) {
      const msg = err.response?.data?.detail || "Gagal update profile";
      setError(msg);
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError("");
    if (!passwordData.currentPassword) { setPwError("Password saat ini wajib"); return; }
    if (passwordData.newPassword !== passwordData.confirmPassword) { setPwError("Password baru tidak cocok"); return; }
    if (passwordData.newPassword.length < 8) { setPwError("Password minimal 8 karakter"); return; }
    if (passwordData.newPassword === passwordData.currentPassword) { setPwError("Password baru tidak boleh sama"); return; }
    setPwLoading(true);
    try {
      await axios.post(`${API_URL}/api/loyalty/me/change-password`, { current_password: passwordData.currentPassword, new_password: passwordData.newPassword }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success("Password berhasil diubah!");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.errors?.[0]?.message || "Gagal mengubah password";
      setPwError(msg);
      toast.error(msg);
    } finally { setPwLoading(false); }
  };

  const handleLogout = () => { logout(); navigate("/loyalty/login"); };

  if (!customer) return null;

  return (
    <div className="loyalty-theme min-h-screen" style={{ background: "#0D0B07", color: "#F0EAE0" }}>
      {/* Header */}
      <header className="sticky top-0 z-50" style={{ background: "rgba(13,11,7,0.9)", borderBottom: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(14px)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/loyalty" className="flex items-center gap-2 text-sm hover:opacity-70" style={{ color: "#C9A876" }} data-testid="loyalty-profile-back">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
            <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
            <span className="text-sm font-medium" style={{ color: "rgba(240,234,224,0.7)" }}>Profile</span>
          </div>
          <LoyaltyUserDropdown />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="font-['Cormorant_Garamond'] text-3xl font-semibold" style={{ color: "#F0EAE0" }}>Profile Saya</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(240,234,224,0.4)" }}>Kelola informasi dan keamanan akun Anda</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-5"
        >
          {/* Profile info */}
          <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <h3 className="font-semibold mb-5" style={{ color: "#F0EAE0" }}>Informasi Profile</h3>

            {error && (
              <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: "rgba(224,107,90,0.12)", border: "1px solid rgba(224,107,90,0.2)", color: "#E88A7A" }}>{error}</div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <LabelInput label="Nama Lengkap">
                <input name="full_name" value={profileData.full_name} onChange={handleProfileChange} className="loyalty-input w-full h-10 px-4 text-sm" />
              </LabelInput>
              <LabelInput label="Email">
                <input value={customer.email} disabled className="w-full h-10 px-4 text-sm rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(240,234,224,0.4)" }} />
                <p className="text-xs" style={{ color: "rgba(240,234,224,0.3)" }}>Email tidak dapat diubah</p>
              </LabelInput>
              <LabelInput label="No. Telepon">
                <input name="phone" type="tel" value={profileData.phone} onChange={handleProfileChange} placeholder="+628..." className="loyalty-input w-full h-10 px-4 text-sm" />
              </LabelInput>
              <LabelInput label="Tanggal Lahir">
                <input name="date_of_birth" type="date" value={profileData.date_of_birth} onChange={handleProfileChange} className="loyalty-input w-full h-10 px-4 text-sm" />
              </LabelInput>
              <button type="submit" disabled={loading} className="loyalty-btn-gold w-full h-10 text-sm flex items-center justify-center gap-2 mt-2" data-testid="loyalty-profile-save-button">
                {loading ? "Menyimpan..." : (<><Save className="h-4 w-4" /> Simpan Perubahan</>)}
              </button>
            </form>
          </div>

          {/* Security */}
          <div className="space-y-4">
            <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <h3 className="font-semibold mb-5" style={{ color: "#F0EAE0" }}>Keamanan Akun</h3>

              {pwError && (
                <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: "rgba(224,107,90,0.12)", border: "1px solid rgba(224,107,90,0.2)", color: "#E88A7A" }} data-testid="password-error-alert">{pwError}</div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                {[
                  { name: "currentPassword", label: "Password Saat Ini", show: showCur, setShow: setShowCur, testid: "password-current-input" },
                  { name: "newPassword", label: "Password Baru", show: showNew, setShow: setShowNew, testid: "password-new-input", placeholder: "Minimal 8 karakter" },
                  { name: "confirmPassword", label: "Konfirmasi Password", show: showConf, setShow: setShowConf, testid: "password-confirm-input", placeholder: "Ketik ulang" },
                ].map(({ name, label, show, setShow, testid, placeholder }) => (
                  <LabelInput key={name} label={label}>
                    <div className="relative">
                      <input
                        name={name}
                        type={show ? "text" : "password"}
                        value={passwordData[name]}
                        onChange={handlePwChange}
                        placeholder={placeholder || "••••••••"}
                        className="loyalty-input w-full h-10 px-4 pr-10 text-sm"
                        data-testid={testid}
                      />
                      <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(240,234,224,0.35)" }}>
                        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </LabelInput>
                ))}
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="w-full h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(240,234,224,0.7)" }}
                  data-testid="password-submit-button"
                >
                  {pwLoading ? "Memproses..." : (<><Lock className="h-4 w-4" /> Ganti Password</>)}
                </button>
              </form>
            </div>

            {/* Logout */}
            <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <button
                onClick={handleLogout}
                className="w-full h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:opacity-80"
                style={{ background: "rgba(224,107,90,0.12)", border: "1px solid rgba(224,107,90,0.2)", color: "#E88A7A" }}
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
