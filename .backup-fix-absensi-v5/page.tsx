"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import HeatMap from "@/components/HeatMap";
import QRDisplay from "@/components/QRDisplay";
import MateriExplorer from "@/components/MateriExplorer";
import IzinForm from "@/components/IzinForm";
import NotificationBell from "@/components/NotificationBell";
import { LogOut, User, Settings, CheckCircle, XCircle, Clock, AlertCircle, MessageSquare, Lock, Edit3, BookOpen, QrCode } from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const [data, setData] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<Record<string, string>>({});
  const [materiFiles, setMateriFiles] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<"dashboard" | "settings">("dashboard");
  const [loading, setLoading] = useState(true);
  const [requestMsg, setRequestMsg] = useState("");
  const [dbUser, setDbUser] = useState<any>(null);

  // Profile modal state
  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState({ nama_lengkap: "", username: "", newPassword: "" });
  const [profileMsg, setProfileMsg] = useState("");

  useEffect(() => {
    if (!user) { router.push("/login/"); return; }
    loadData();
  }, [user]);

  const loadData = async () => {
    await db.init();
    if (!user) return;
    try {
      await refreshUser();
      const u = await db.getUserById(user.id);
      setDbUser(u);
      setProfileData({ nama_lengkap: u?.nama_lengkap || "", username: u?.username || "", newPassword: "" });
      const absensi = await db.getAbsensi(user.id);
      const files = await db.getMateriList();
      const settings = await db.getSettings();
      const records = absensi.records;
      const stats = { total_hadir: records.filter((r) => r.status === "hadir").length, total_izin: records.filter((r) => r.status === "izin").length, total_sakit: records.filter((r) => r.status === "sakit").length, total_alpha: records.filter((r) => r.status === "alpha").length };
      const hm: Record<string, string> = {}; records.forEach((r) => { hm[r.date] = r.status; });
      setData({ stats, records: records.slice(-50), settings });
      setHeatmap(hm);
      setMateriFiles(files.map(({ blob, ...rest }) => rest));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleRequestPassword = async () => {
    if (!user) return;
    const pw = profileData.newPassword;
    if (!pw || pw.length < 6) { setRequestMsg("Password min 6 karakter"); return; }
    try {
      const newHash = await hashPassword(pw);
      await db.createRequest({ type: "password_reset", user_id: user.id, status: "pending", data: { new_password_hash: newHash, old_password_hash: dbUser?.password_hash }, admin_notes: "", handled_at: null });
      await db.addNotification(user.id, "Request Ganti Password", "Permintaan ganti password telah dikirim ke admin.", "warning");
      setRequestMsg("Request terkirim. Hubungi admin untuk approval.");
      setProfileData({ ...profileData, newPassword: "" });
    } catch (err: any) { setRequestMsg("Error: " + err.message); }
  };

  const handleRequestProfile = async () => {
    if (!user || !dbUser) return;
    try {
      if (profileData.username === dbUser.username && profileData.nama_lengkap === dbUser.nama_lengkap) { setProfileMsg("Tidak ada perubahan"); return; }
      if (profileData.username !== dbUser.username) {
        const existing = await db.getUserByUsername(profileData.username);
        if (existing) { setProfileMsg("Username sudah digunakan"); return; }
      }
      await db.createRequest({
        type: "profile_change", user_id: user.id, status: "pending",
        data: { old_nama_lengkap: dbUser.nama_lengkap, new_nama_lengkap: profileData.nama_lengkap, old_username: dbUser.username, new_username: profileData.username },
        admin_notes: "", handled_at: null,
      });
      await db.addNotification(user.id, "Request Ganti Profil", "Permintaan ubah nama/username dikirim ke admin.", "warning");
      setProfileMsg("Request terkirim. Tunggu approval admin.");
    } catch (err: any) { setProfileMsg("Error: " + err.message); }
  };

  const getDownloadUrl = async (id: string) => { const blob = await db.getMateriBlob(id); return blob ? URL.createObjectURL(blob) : null; };

  const handleLogout = async () => {
    try { await logout(); } catch (err) { console.error("Logout error:", err); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  const stats = data?.stats || { total_hadir: 0, total_izin: 0, total_sakit: 0, total_alpha: 0 };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">AbsensiKu</h1>
            <nav className="hidden md:flex gap-1">
              <button type="button" onClick={() => setActiveSection("dashboard")} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === "dashboard" ? "bg-blue-50 text-primary" : "text-gray-600 hover:bg-gray-100"}`}>Dashboard</button>
              <button type="button" onClick={() => setActiveSection("settings")} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === "settings" ? "bg-blue-50 text-primary" : "text-gray-600 hover:bg-gray-100"}`}>Pengaturan</button>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user && <NotificationBell userId={user.id} />}
            <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
              <button type="button" onClick={() => setShowProfile(true)} className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm hover:bg-primary/20 transition-colors">{user?.nama_lengkap?.charAt(0) || "U"}</button>
              <div className="hidden md:block">
                <p className="text-sm font-medium">{user?.nama_lengkap}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.kelas}</p>
              </div>
              <button type="button" onClick={handleLogout} className="p-2 hover:bg-red-50 text-gray-400 hover:text-danger rounded-lg"><LogOut className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </header>

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><User className="w-5 h-5 text-primary" />Profil Saya</h3>
            {profileMsg && <div className={`mb-4 p-2 rounded text-sm ${profileMsg.startsWith("Error") || profileMsg.startsWith("Tidak") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{profileMsg}</div>}
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700">Nama Lengkap</label><input type="text" className="input" value={profileData.nama_lengkap} onChange={(e) => setProfileData({ ...profileData, nama_lengkap: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-700">Username</label><input type="text" className="input" value={profileData.username} onChange={(e) => setProfileData({ ...profileData, username: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-700">Password Baru (Request ke Admin)</label><input type="password" className="input" value={profileData.newPassword} onChange={(e) => setProfileData({ ...profileData, newPassword: e.target.value })} placeholder="Min 6 karakter, kosongkan jika tidak diubah" /></div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={handleRequestProfile} className="btn-primary flex-1">Request Ubah Profil</button>
                {profileData.newPassword.length >= 6 && <button type="button" onClick={handleRequestPassword} className="btn-secondary">Request Ganti PW</button>}
                <button type="button" onClick={() => { setShowProfile(false); setProfileMsg(""); }} className="btn-secondary">Tutup</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeSection === "dashboard" ? (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-4 border-l-4 border-green-500"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Hadir</p><p className="text-2xl font-bold text-gray-900">{stats.total_hadir}</p></div><CheckCircle className="w-8 h-8 text-green-500 opacity-20" /></div></div>
                <div className="card p-4 border-l-4 border-yellow-500"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Izin</p><p className="text-2xl font-bold text-gray-900">{stats.total_izin}</p></div><Clock className="w-8 h-8 text-yellow-500 opacity-20" /></div></div>
                <div className="card p-4 border-l-4 border-blue-500"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Sakit</p><p className="text-2xl font-bold text-gray-900">{stats.total_sakit}</p></div><AlertCircle className="w-8 h-8 text-blue-500 opacity-20" /></div></div>
                <div className="card p-4 border-l-4 border-red-500"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Alpha</p><p className="text-2xl font-bold text-gray-900">{stats.total_alpha}</p></div><XCircle className="w-8 h-8 text-red-500 opacity-20" /></div></div>
              </div>
              <HeatMap data={heatmap} />
              <MateriExplorer files={materiFiles} getDownloadUrl={getDownloadUrl} />
            </div>
            <div className="space-y-6">
              {dbUser && <QRDisplay userId={dbUser.id} qrSecret={dbUser.qr_secret} />}
              <IzinForm userId={user!.id} onSuccess={loadData} />
              <div className="card bg-blue-50 border-blue-200"><h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4" />Kontak Admin</h4><p className="text-sm text-blue-700">Untuk bantuan, hubungi admin.</p></div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-primary" />Pengaturan Akun</h3>
              {requestMsg && <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">{requestMsg}</div>}
              <div className="space-y-6">
                <div className="border-b border-gray-100 pb-6">
                  <h4 className="font-medium mb-3 flex items-center gap-2"><Lock className="w-4 h-4 text-gray-500" />Ganti Password</h4>
                  <div className="flex gap-3"><button type="button" onClick={() => setShowProfile(true)} className="btn-primary">Buka Profil untuk Request</button></div>
                  <p className="text-xs text-gray-500 mt-2">*Perlu approval admin.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

