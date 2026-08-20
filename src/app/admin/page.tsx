"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyQR } from "@/lib/crypto";
import { Html5Qrcode } from "html5-qrcode";
import FileExplorer from "@/components/FileExplorer";
import NotificationBell from "@/components/NotificationBell";
import {
  LogOut, Users, QrCode, CheckCircle, XCircle, Clock, AlertCircle,
  BarChart3, Settings, Bell, ScanLine, Calendar, MessageSquare,
  UserCheck, UserX, FolderOpen, ChevronDown, ChevronUp, Shield,
  Upload, Camera, CameraOff, Lock, Wifi
} from "lucide-react";

type CameraStatus = "idle" | "checking" | "scanning" | "insecure" | "unsupported" | "denied" | "notfound" | "inuse" | "error";

export default function AdminPanel() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"dashboard" | "absensi" | "requests" | "users" | "files" | "appeals">("dashboard");
  const [stats, setStats] = useState({ total_users: 0, active_users: 0, pending_users: 0, today_hadir: 0, today_izin: 0, today_sakit: 0, today_alpha: 0, pending_requests: 0 });
  const [absensiToday, setAbsensiToday] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [appeals, setAppeals] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanError, setScanError] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedKelas, setSelectedKelas] = useState("all");
  const [loading, setLoading] = useState(true);

  const qrContainerRef = useRef<HTMLDivElement>(null);
  const fileScannerRef = useRef<HTMLDivElement>(null);
  const scannerInstanceRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!user) { router.push("/login/?admin=1"); return; }
    if (user.role !== "admin") { router.push("/dashboard/"); return; }
    loadAll();
  }, [user]);

  // Scanner lifecycle: start/stop based on cameraStatus === "scanning"
  useEffect(() => {
    if (cameraStatus !== "scanning") {
      if (scannerInstanceRef.current) {
        scannerInstanceRef.current.stop().catch(() => {});
        scannerInstanceRef.current = null;
      }
      return;
    }

    let cancelled = false;
    let scanner: Html5Qrcode | null = null;

    const initScanner = async () => {
      await new Promise((r) => setTimeout(r, 300));
      if (cancelled) return;

      if (!qrContainerRef.current) {
        setCameraStatus("error");
        setScanError("QR container tidak ditemukan di DOM.");
        return;
      }

      try {
        scanner = new Html5Qrcode("admin-qr-scanner");
        scannerInstanceRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            if (cancelled) return;
            console.log("[SCAN] QR detected:", decodedText);
            try { if (scanner) await scanner.stop(); } catch (e) {}
            scannerInstanceRef.current = null;
            setCameraStatus("idle");
            await handleScan(decodedText);
          },
          () => {}
        );
        console.log("[SCAN] Camera started");
      } catch (err: any) {
        if (!cancelled) {
          console.error("[SCAN] Start error:", err);
          setCameraStatus("error");
          setScanError(err?.message || "Gagal memulai scanner QR.");
        }
      }
    };

    initScanner();

    return () => {
      cancelled = true;
      if (scanner) scanner.stop().catch(() => {});
    };
  }, [cameraStatus]);

  const loadAll = async () => {
    await db.init();
    try {
      const allUsers = await db.getAllUsers();
      const allRequests = await db.getRequests();
      const allAppeals = await db.getAppeals();
      const appSettings = await db.getSettings();

      const total_users = allUsers.length;
      const active_users = allUsers.filter((u) => u.status === "active").length;
      const pending_users = allUsers.filter((u) => u.status === "pending").length;
      const pending_requests = allRequests.filter((r) => r.status === "pending").length;

      let today_hadir = 0, today_izin = 0, today_sakit = 0, today_alpha = 0;
      for (const u of allUsers) {
        if (u.role === "admin") continue;
        const absen = await db.getAbsensi(u.id);
        const todayRec = absen.records.find((r) => r.date === selectedDate);
        if (todayRec) {
          if (todayRec.status === "hadir") today_hadir++;
          else if (todayRec.status === "izin") today_izin++;
          else if (todayRec.status === "sakit") today_sakit++;
          else if (todayRec.status === "alpha") today_alpha++;
        } else {
          today_alpha++;
        }
      }

      setStats({ total_users, active_users, pending_users, today_hadir, today_izin, today_sakit, today_alpha, pending_requests });
      setRequests(allRequests.sort((a, b) => b.created_at.localeCompare(a.created_at)));
      setUsers(allUsers.filter((u) => u.role === "user"));
      setAppeals(allAppeals.sort((a, b) => b.created_at.localeCompare(a.created_at)));
      setSettings(appSettings);

      const absensiData: any[] = [];
      for (const u of allUsers) {
        if (u.role === "admin") continue;
        if (selectedKelas !== "all" && u.kelas !== selectedKelas) continue;
        const absen = await db.getAbsensi(u.id);
        const rec = absen.records.find((r) => r.date === selectedDate);
        absensiData.push({
          user_id: u.id, username: u.username, nama_lengkap: u.nama_lengkap,
          kelas: u.kelas, sub_kelas: u.sub_kelas, status: rec?.status || "alpha", record: rec,
        });
      }
      setAbsensiToday(absensiData);
    } catch (err) {
      console.error("[ADMIN] loadAll error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ========== CAMERA PRE-CHECK ==========
  const checkAndStartCamera = async () => {
    setScanResult(null);
    setScanError("");
    setCameraStatus("checking");

    // 1. Check secure context
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setCameraStatus("insecure");
      return;
    }

    // 2. Check API support
    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus("unsupported");
      return;
    }

    // 3. Try getUserMedia explicitly (this triggers the permission popup)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      // Permission granted! Stop the test stream immediately
      stream.getTracks().forEach((track) => track.stop());
      console.log("[CAMERA] Permission granted by user");
      setCameraStatus("scanning");
    } catch (err: any) {
      console.error("[CAMERA] getUserMedia error:", err.name, err.message);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraStatus("denied");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraStatus("notfound");
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        setCameraStatus("inuse");
      } else {
        setCameraStatus("error");
        setScanError(err?.message || "Gagal mengakses kamera.");
      }
    }
  };

  const stopScan = async () => {
    if (scannerInstanceRef.current) {
      try { await scannerInstanceRef.current.stop(); } catch (e) {}
      scannerInstanceRef.current = null;
    }
    setCameraStatus("idle");
  };

  // Fallback: scan QR from uploaded image
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanResult(null);
    setScanError("");
    try {
      const tmpId = "tmp-qr-file-" + Date.now();
      const tmpDiv = document.createElement("div");
      tmpDiv.id = tmpId;
      tmpDiv.style.display = "none";
      document.body.appendChild(tmpDiv);
      const scanner = new Html5Qrcode(tmpId);
      const decodedText = await scanner.scanFile(file, true);
      await scanner.clear();
      document.body.removeChild(tmpDiv);
      await handleScan(decodedText);
    } catch (err: any) {
      setScanError("Gagal scan file QR: " + (err?.message || "Format tidak valid / QR tidak terbaca"));
    }
    e.target.value = "";
  };

  const handleScan = async (qrData: string) => {
    try {
      const result = await verifyQR(qrData, async (id) => {
        const u = await db.getUserById(id);
        return u?.qr_secret || null;
      });
      if (!result.valid) { setScanResult({ error: result.reason }); return; }
      const scannedUser = await db.getUserById(result.userId!);
      if (!scannedUser) { setScanResult({ error: "User tidak ditemukan" }); return; }
      const absensi = await db.getAbsensi(scannedUser.id);
      const already = absensi.records.find((r) => r.date === selectedDate && r.status === "hadir");
      if (already) { setScanResult({ user: scannedUser, status: "already_scanned" }); return; }
      const appSettings = await db.getSettings();
      await db.addAbsensiRecord(scannedUser.id, {
        date: selectedDate, status: "hadir", type: "qr", week: appSettings.current_week,
        scanned_at: new Date().toISOString(), scanned_by: user?.id || "admin",
      });
      await db.addNotification(scannedUser.id, "Absensi Berhasil", `Anda telah ditandai hadir pada ${selectedDate}.`, "success");
      setScanResult({ user: scannedUser, status: "success" });
      loadAll();
    } catch (err: any) {
      setScanResult({ error: err?.message || "Error verifikasi QR" });
    }
  };

  const handleRequest = async (reqId: string, action: "approve" | "reject", notes: string = "") => {
    try {
      const req = await db.getRequest(reqId);
      if (!req) return;
      const userId = req.user_id;
      if (action === "approve") {
        await db.updateRequest(reqId, { status: "approved", admin_notes: notes, handled_at: new Date().toISOString() });
        if (req.type === "new_account") {
          await db.updateUser(userId, { status: "active" });
          await db.addNotification(userId, "Akun Diterima", "Akun Anda telah disetujui oleh admin. Silakan login.", "success");
        } else if (req.type === "password_reset") {
          await db.updateUser(userId, { password_hash: req.data.new_password_hash });
          await db.addNotification(userId, "Password Diubah", "Password Anda telah diubah oleh admin. Silakan login dengan password baru.", "success");
        } else if (req.type === "username_change") {
          await db.updateUser(userId, { username: req.data.new_username });
          await db.addNotification(userId, "Username Diubah", `Username Anda telah diubah ke "${req.data.new_username}".`, "success");
        } else if (req.type === "izin") {
          const absen = await db.getAbsensi(userId);
          const rec = absen.records.find((r) => r.date === req.data.tanggal && r.status.startsWith("pending_"));
          if (rec) {
            rec.status = req.data.jenis; rec.approved_at = new Date().toISOString();
            await db.saveAbsensi(absen);
            await db.addNotification(userId, "Izin Diterima", `Pengajuan ${req.data.jenis} Anda untuk ${req.data.tanggal} telah disetujui.`, "success");
          } else {
            await db.addNotification(userId, "Izin Gagal", "Data absensi tidak ditemukan. Silakan hubungi admin.", "error");
          }
        }
      } else {
        await db.updateRequest(reqId, { status: "rejected", admin_notes: notes, handled_at: new Date().toISOString() });
        if (req.type === "izin") {
          const absen = await db.getAbsensi(userId);
          const rec = absen.records.find((r) => r.date === req.data.tanggal && r.status.startsWith("pending_"));
          if (rec) { rec.status = "alpha"; rec.rejected_at = new Date().toISOString(); await db.saveAbsensi(absen); }
          await db.addNotification(userId, "Izin Ditolak", `Pengajuan ${req.data.jenis} Anda untuk ${req.data.tanggal} DITOLAK. Alasan: ${notes}.`, "error");
        } else {
          if (req.type === "new_account") await db.updateUser(userId, { status: "rejected" });
          await db.addNotification(userId, "Request Ditolak", `Permintaan ${req.type} Anda ditolak. Alasan: ${notes}.`, "error");
        }
      }
      loadAll();
    } catch (err: any) {
      alert("Gagal memproses request: " + err.message);
    }
  };

  const handleAppeal = async (appealId: string, action: "approve" | "reject", response: string = "") => {
    try {
      await db.updateAppeal(appealId, { status: action === "approve" ? "approved" : "rejected", admin_response: response, handled_at: new Date().toISOString() });
      const allAppeals = await db.getAppeals();
      const appeal = allAppeals.find((a) => a.id === appealId);
      if (!appeal) return;
      if (action === "approve") {
        const req = await db.getRequest(appeal.request_id);
        if (req) await db.updateRequest(req.id, { status: "pending" });
        await db.addNotification(appeal.user_id, "Banding Diterima", "Banding Anda diterima. Request Anda telah di-reopen.", "success");
      } else {
        await db.addNotification(appeal.user_id, "Banding Ditolak", `Banding Anda ditolak. ${response}.`, "error");
      }
      loadAll();
    } catch (err: any) {
      alert("Gagal memproses banding: " + err.message);
    }
  };

  const toggleAutoAccept = async () => {
    if (!settings) return;
    try { await db.updateSettings({ auto_accept_new_accounts: !settings.auto_accept_new_accounts }); loadAll(); }
    catch (err: any) { alert("Gagal mengubah setting: " + err.message); }
  };

  const updateUserStatus = async (userId: string, status: string) => {
    try { await db.updateUser(userId, { status: status as any }); await db.addNotification(userId, "Status Akun", `Status akun Anda diubah menjadi ${status} oleh admin.`, "warning"); loadAll(); }
    catch (err: any) { alert("Gagal update status: " + err.message); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Camera status banner messages
  const cameraBanner = () => {
    switch (cameraStatus) {
      case "insecure":
        return (
          <div className="mt-4 p-4 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 text-sm max-w-lg text-center">
            <Lock className="w-5 h-5 inline mb-1" />
            <p className="font-semibold">Kamera Tidak Tersedia</p>
            <p className="mt-1">Browser memblokir kamera karena akses tidak aman (bukan HTTPS/localhost).</p>
            <p className="mt-2 text-xs">
              <b>Solusi:</b> Akses via <code className="bg-orange-100 px-1 rounded">http://localhost:3000</code> (satu device) atau setup HTTPS.
              <br />Atau gunakan tombol <b>"Upload Gambar QR"</b> di bawah.
            </p>
          </div>
        );
      case "unsupported":
        return (
          <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm max-w-lg text-center">
            <AlertCircle className="w-5 h-5 inline mb-1" />
            <p className="font-semibold">Browser Tidak Mendukung Kamera</p>
            <p className="mt-1">Gunakan Chrome/Firefox/Safari terbaru.</p>
          </div>
        );
      case "denied":
        return (
          <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm max-w-lg text-center">
            <AlertCircle className="w-5 h-5 inline mb-1" />
            <p className="font-semibold">Permission Kamera Ditolak</p>
            <p className="mt-1">Anda pernah menolak akses kamera. Buka pengaturan browser:</p>
            <p className="mt-2 text-xs">
              Chrome: Settings → Privacy → Site Settings → Camera → Allow this site<br />
              Safari: Settings → Safari → Camera → Allow<br />
              Atau gunakan <b>"Upload Gambar QR"</b>.
            </p>
          </div>
        );
      case "notfound":
        return (
          <div className="mt-4 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm max-w-lg text-center">
            <AlertCircle className="w-5 h-5 inline mb-1" />
            <p className="font-semibold">Kamera Tidak Ditemukan</p>
            <p className="mt-1">Pastikan device memiliki kamera dan tidak sedang dipakai aplikasi lain.</p>
          </div>
        );
      case "inuse":
        return (
          <div className="mt-4 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm max-w-lg text-center">
            <AlertCircle className="w-5 h-5 inline mb-1" />
            <p className="font-semibold">Kamera Sedang Digunakan</p>
            <p className="mt-1">Kamera sedang dipakai aplikasi lain (Zoom, Meet, dll). Tutup aplikasi tersebut lalu coba lagi.</p>
          </div>
        );
      case "error":
        return (
          <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm max-w-lg text-center">
            <AlertCircle className="w-5 h-5 inline mb-1" />
            <p className="font-semibold">Error Kamera</p>
            <p className="mt-1">{scanError || "Gagal memulai kamera."}</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> Admin Panel
          </h1>
          <div className="flex items-center gap-3">
            {user && <NotificationBell userId={user.id} />}
            <span className="text-sm text-gray-500 hidden md:inline">{user?.nama_lengkap}</span>
            <button type="button" onClick={logout} className="p-2 hover:bg-red-50 text-gray-400 hover:text-danger rounded-lg"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: "dashboard", label: "Dashboard", icon: BarChart3 },
            { id: "absensi", label: "Scan Absensi", icon: QrCode },
            { id: "requests", label: `Requests (${stats.pending_requests})`, icon: Bell },
            { id: "users", label: "Users", icon: Users },
            { id: "files", label: "Files & DB", icon: FolderOpen },
            { id: "appeals", label: "Banding", icon: MessageSquare },
          ].map((tab) => (
            <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? "bg-primary text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}>
              <tab.icon className="w-4 h-4" />{tab.label}
            </button>
          ))}
        </div>

        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card p-4"><p className="text-sm text-gray-500">Total Users</p><p className="text-2xl font-bold">{stats.total_users}</p></div>
              <div className="card p-4"><p className="text-sm text-gray-500">Active</p><p className="text-2xl font-bold text-green-600">{stats.active_users}</p></div>
              <div className="card p-4"><p className="text-sm text-gray-500">Pending</p><p className="text-2xl font-bold text-yellow-600">{stats.pending_users}</p></div>
              <div className="card p-4"><p className="text-sm text-gray-500">Pending Requests</p><p className="text-2xl font-bold text-blue-600">{stats.pending_requests}</p></div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Hari Ini ({selectedDate})</h3>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="p-3 bg-green-50 rounded-lg"><p className="text-2xl font-bold text-green-600">{stats.today_hadir}</p><p className="text-xs text-gray-500">Hadir</p></div>
                  <div className="p-3 bg-yellow-50 rounded-lg"><p className="text-2xl font-bold text-yellow-600">{stats.today_izin}</p><p className="text-xs text-gray-500">Izin</p></div>
                  <div className="p-3 bg-blue-50 rounded-lg"><p className="text-2xl font-bold text-blue-600">{stats.today_sakit}</p><p className="text-xs text-gray-500">Sakit</p></div>
                  <div className="p-3 bg-red-50 rounded-lg"><p className="text-2xl font-bold text-red-600">{stats.today_alpha}</p><p className="text-xs text-gray-500">Alpha</p></div>
                </div>
              </div>
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Auto Accept</h3>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{settings?.auto_accept_new_accounts ? "Aktif" : "Nonaktif"}</span>
                  <button type="button" onClick={toggleAutoAccept} className={`px-4 py-2 rounded-lg font-medium ${settings?.auto_accept_new_accounts ? "bg-green-500 text-white" : "bg-gray-200 text-gray-700"}`}>
                    {settings?.auto_accept_new_accounts ? "Matikan" : "Nyalakan"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "absensi" && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex flex-wrap items-end gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                  <input type="date" className="input" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); loadAll(); }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
                  <select className="select" value={selectedKelas} onChange={(e) => { setSelectedKelas(e.target.value); loadAll(); }}>
                    <option value="all">Semua</option>
                    <option value="teknik">Teknik</option>
                    <option value="nonteknik">Non-Teknik</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col items-center mb-6 space-y-4">
                {cameraStatus === "scanning" ? (
                  <div className="w-full max-w-md">
                    <div id="admin-qr-scanner" className="rounded-xl overflow-hidden border-2 border-primary min-h-[300px] flex items-center justify-center bg-black">
                      <p className="text-white text-sm">Memuat kamera...</p>
                    </div>
                    <button type="button" onClick={stopScan} className="w-full mt-2 btn-danger flex items-center justify-center gap-2">
                      <CameraOff className="w-4 h-4" />Stop Kamera
                    </button>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={checkAndStartCamera} disabled={cameraStatus === "checking"} className="btn-primary flex items-center gap-2 text-lg px-8 py-4 disabled:opacity-50">
                      {cameraStatus === "checking" ? (
                        <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Memeriksa kamera...</>
                      ) : (
                        <><Camera className="w-5 h-5" />Aktifkan Kamera & Scan QR</>
                      )}
                    </button>
                    <div className="text-center">
                      <p className="text-sm text-gray-400 mb-2">— atau —</p>
                      <label className="btn-secondary flex items-center gap-2 cursor-pointer">
                        <Upload className="w-4 h-4" />Upload Gambar QR
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileScan} />
                      </label>
                    </div>
                  </>
                )}

                {cameraBanner()}

                {scanResult && (
                  <div className={`mt-4 p-4 rounded-lg ${scanResult.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                    {scanResult.error ? `Error: ${scanResult.error}` : `✓ ${scanResult.user.nama_lengkap} (${scanResult.user.kelas}) - ${scanResult.status === "already_scanned" ? "Sudah absen" : "Berhasil"}`}
                  </div>
                )}
              </div>
            </div>
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Daftar Absensi {selectedDate}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr><th className="text-left p-3 font-medium">Nama</th><th className="text-left p-3 font-medium">Kelas</th><th className="text-left p-3 font-medium">Status</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {absensiToday.map((a) => (
                      <tr key={a.user_id} className="hover:bg-gray-50">
                        <td className="p-3">{a.nama_lengkap}</td>
                        <td className="p-3 capitalize">{a.kelas} {a.sub_kelas ? `(${a.sub_kelas})` : ""}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            a.status === "hadir" ? "bg-green-100 text-green-700" : a.status === "izin" ? "bg-yellow-100 text-yellow-700" : a.status === "sakit" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                          }`}>{a.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "requests" && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Daftar Request</h3>
            <div className="space-y-3">
              {requests.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Tidak ada request</p>
              ) : (
                requests.map((req) => (
                  <div key={req.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${req.status === "pending" ? "bg-yellow-100 text-yellow-700" : req.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{req.status}</span>
                          <span className="text-sm font-medium capitalize">{req.type}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{req.data?.nama_lengkap || req.data?.username || "User"}</p>
                        {req.type === "izin" && <p className="text-xs text-gray-500 mt-1">{req.data.jenis}: {req.data.keterangan} ({req.data.tanggal})</p>}
                        {req.type === "username_change" && <p className="text-xs text-gray-500 mt-1">New: {req.data.new_username}</p>}
                      </div>
                      {req.status === "pending" && (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleRequest(req.id, "approve")} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"><CheckCircle className="w-4 h-4" /></button>
                          <button type="button" onClick={() => { const reason = prompt("Alasan penolakan:"); if (reason) handleRequest(req.id, "reject", reason); }} className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><XCircle className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                    {req.admin_notes && <p className="text-xs text-gray-400 mt-2">Note: {req.admin_notes}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Daftar Users</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr><th className="text-left p-3 font-medium">Nama</th><th className="text-left p-3 font-medium">Username</th><th className="text-left p-3 font-medium">Kelas</th><th className="text-left p-3 font-medium">Status</th><th className="text-left p-3 font-medium">Aksi</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="p-3">{u.nama_lengkap}</td>
                      <td className="p-3">{u.username}</td>
                      <td className="p-3 capitalize">{u.kelas} {u.sub_kelas ? `(${u.sub_kelas})` : ""}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.status === "active" ? "bg-green-100 text-green-700" : u.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{u.status}</span>
                      </td>
                      <td className="p-3">
                        <select className="text-xs border border-gray-300 rounded px-2 py-1" value={u.status} onChange={(e) => updateUserStatus(u.id, e.target.value)}>
                          <option value="active">Active</option>
                          <option value="pending">Pending</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "files" && <FileExplorer />}

        {activeTab === "appeals" && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Bandingan</h3>
            {appeals.length === 0 ? (
              <p className="text-gray-400 text-center py-4">Tidak ada banding</p>
            ) : (
              <div className="space-y-2">
                {appeals.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{a.alasan}</p>
                      <p className="text-xs text-gray-500">{a.request_id}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleAppeal(a.id, "approve")} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"><CheckCircle className="w-4 h-4" /></button>
                      <button type="button" onClick={() => handleAppeal(a.id, "reject", "Ditolak admin")} className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><XCircle className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

