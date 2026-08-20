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
import {
  LogOut, User, Settings, CheckCircle, XCircle, Clock, AlertCircle,
  MessageSquare, Lock, Edit3, BookOpen, QrCode
} from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [data, setData] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<Record<string, string>>({});
  const [materiFiles, setMateriFiles] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<"dashboard" | "settings">("dashboard");
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [requestMsg, setRequestMsg] = useState("");
  const [dbUser, setDbUser] = useState<any>(null);

  useEffect(() => {
    if (!user) { router.push("/login/"); return; }
    loadData();
  }, [user]);

  const loadData = async () => {
    await db.init();
    if (!user) return;
    try {
      const u = await db.getUserById(user.id);
      setDbUser(u);
      const absensi = await db.getAbsensi(user.id);
      const files = await db.getMateriList();
      const settings = await db.getSettings();
      const records = absensi.records;
      const stats = {
        total_hadir: records.filter((r) => r.status === "hadir").length,
        total_izin: records.filter((r) => r.status === "izin").length,
        total_sakit: records.filter((r) => r.status === "sakit").length,
        total_alpha: records.filter((r) => r.status === "alpha").length,
      };
      const hm: Record<string, string> = {};
      records.forEach((r) => { hm[r.date] = r.status; });
      setData({ stats, records: records.slice(-50), settings });
      setHeatmap(hm);
      setMateriFiles(files.map(({ blob, ...rest }) => rest));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPassword = async () => {
    if (!newPassword || newPassword.length < 6) return;
    try {
      await db.createRequest({
        type: "password_reset", user_id: user!.id, status: "pending",
        data: { new_password_hash: await hashPassword(newPassword) },
        admin_notes: "", handled_at: null,
      });
      await db.addNotification(user!.id, "Request Ganti Password", "Permintaan ganti password telah dikirim ke admin. Hubungi admin untuk persetujuan.", "warning");
      setRequestMsg("Request ganti password terkirim. Hubungi admin untuk approval.");
      setNewPassword("");
    } catch (err: any) {
      setRequestMsg("Error: " + err.message);
    }
  };

  const handleRequestUsername = async () => {
    if (!newUsername || newUsername.length < 3) return;
    try {
      const existing = await db.getUserByUsername(newUsername);
      if (existing) { setRequestMsg("Username sudah digunakan"); return; }
      await db.createRequest({
        type: "username_change", user_id: user!.id, status: "pending",
        data: { new_username: newUsername },
        admin_notes: "", handled_at: null,
      });
      await db.addNotification(user!.id, "Request Ganti Username", `Permintaan ganti username ke "${newUsername}" telah dikirim ke admin.`, "warning");
      setRequestMsg("Request ganti username terkirim. Hubungi admin untuk approval.");
      setNewUsername("");
    } catch (err: any) {
      setRequestMsg("Error: " + err.message);
    }
  };

  const getDownloadUrl = async (id: string) => {
    const blob = await db.getMateriBlob(id);
    return blob ? URL.createObjectURL(blob) : null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const stats = data?.stats || { total_hadir: 0, total_izin: 0, total_sakit: 0, total_alpha: 0 };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">AbsensiKu</h1>
            <nav className="hidden md:flex gap-1">
              <button onClick={() => setActiveSection("dashboard")} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === "dashboard" ? "bg-blue-50 text-primary" : "text-gray-600 hover:bg-gray-100"}`}>Dashboard</button>
              <button onClick={() => setActiveSection("settings")} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === "settings" ? "bg-blue-50 text-primary" : "text-gray-600 hover:bg-gray-100"}`}>Pengaturan</button>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user && <NotificationBell userId={user.id} />}
            <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">{user?.nama_lengkap?.charAt(0) || "U"}</div>
              <div className="hidden md:block">
                <p className="text-sm font-medium">{user?.nama_lengkap}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.kelas} {user?.sub_kelas ? `(${user.sub_kelas})` : ""}</p>
              </div>
              <button onClick={logout} className="p-2 hover:bg-red-50 text-gray-400 hover:text-danger rounded-lg"><LogOut className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeSection === "dashboard" ? (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-4 border-l-4 border-green-500">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm text-gray-500">Hadir</p><p className="text-2xl font-bold text-gray-900">{stats.total_hadir}</p></div>
                    <CheckCircle className="w-8 h-8 text-green-500 opacity-20" />
                  </div>
                </div>
                <div className="card p-4 border-l-4 border-yellow-500">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm text-gray-500">Izin</p><p className="text-2xl font-bold text-gray-900">{stats.total_izin}</p></div>
                    <Clock className="w-8 h-8 text-yellow-500 opacity-20" />
                  </div>
                </div>
                <div className="card p-4 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm text-gray-500">Sakit</p><p className="text-2xl font-bold text-gray-900">{stats.total_sakit}</p></div>
                    <AlertCircle className="w-8 h-8 text-blue-500 opacity-20" />
                  </div>
                </div>
                <div className="card p-4 border-l-4 border-red-500">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm text-gray-500">Alpha</p><p className="text-2xl font-bold text-gray-900">{stats.total_alpha}</p></div>
                    <XCircle className="w-8 h-8 text-red-500 opacity-20" />
                  </div>
                </div>
              </div>
              <HeatMap data={heatmap} />
              <MateriExplorer files={materiFiles} getDownloadUrl={getDownloadUrl} />
            </div>
            <div className="space-y-6">
              {dbUser && <QRDisplay userId={dbUser.id} qrSecret={dbUser.qr_secret} />}
              <IzinForm userId={user!.id} onSuccess={loadData} />
              <div className="card bg-blue-50 border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4" />Kontak Admin</h4>
                <p className="text-sm text-blue-700">Untuk request ganti password/username atau bantuan lainnya, silakan hubungi admin.</p>
              </div>
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
                  <div className="flex gap-3">
                    <input type="password" className="input flex-1" placeholder="Password baru (min 6 karakter)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    <button onClick={handleRequestPassword} className="btn-primary whitespace-nowrap">Request</button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">*Perlu approval admin. Password tidak langsung berubah.</p>
                </div>
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2"><Edit3 className="w-4 h-4 text-gray-500" />Ganti Username</h4>
                  <div className="flex gap-3">
                    <input type="text" className="input flex-1" placeholder="Username baru" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
                    <button onClick={handleRequestUsername} className="btn-primary whitespace-nowrap">Request</button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">*1 kali per request. Jika ingin ganti lagi, request ulang setelah approval.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
