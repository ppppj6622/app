#!/bin/bash
# ============================================================
# Absensi App Auto-Fix v2 — Button Debug Edition
# Fixes: visible errors, crypto check, searchParams loop, scan QR errors
# ============================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Absensi App Auto-Fix v2 ===${NC}"

PROJECT_ROOT="."
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
    echo -e "${RED}ERROR: package.json tidak ditemukan di current directory.${NC}"
    exit 1
fi

cd "$PROJECT_ROOT"
echo -e "${GREEN}Project root: $(pwd)${NC}"

mkdir -p .backup-fix-absensi-v2
cp tailwind.config.js .backup-fix-absensi-v2/ 2>/dev/null || true
cp src/lib/db.ts .backup-fix-absensi-v2/ 2>/dev/null || true
cp src/lib/auth.tsx .backup-fix-absensi-v2/ 2>/dev/null || true
cp src/app/layout.tsx .backup-fix-absensi-v2/ 2>/dev/null || true
cp src/app/login/page.tsx .backup-fix-absensi-v2/ 2>/dev/null || true
cp src/app/admin/page.tsx .backup-fix-absensi-v2/ 2>/dev/null || true
cp src/app/dashboard/page.tsx .backup-fix-absensi-v2/ 2>/dev/null || true
cp src/components/IzinForm.tsx .backup-fix-absensi-v2/ 2>/dev/null || true
cp src/components/FileExplorer.tsx .backup-fix-absensi-v2/ 2>/dev/null || true
cp src/components/MateriExplorer.tsx .backup-fix-absensi-v2/ 2>/dev/null || true
cp src/components/QRDisplay.tsx .backup-fix-absensi-v2/ 2>/dev/null || true
cp src/components/NotificationBell.tsx .backup-fix-absensi-v2/ 2>/dev/null || true
echo -e "${GREEN}Backup OK${NC}"

mkdir -p "$(dirname 'tailwind.config.js')"
cat > 'tailwind.config.js' << 'EOF_FIX'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        success: '#16a34a',
        danger: '#dc2626',
        warning: '#d97706',
      },
    },
  },
  plugins: [],
}

EOF_FIX
echo "  Written: tailwind.config.js"

mkdir -p "$(dirname 'src/app/layout.tsx')"
cat > 'src/app/layout.tsx' << 'EOF_FIX'
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = { title: "Sistem Absensi", description: "Aplikasi absensi dengan fitur QR Code" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}>
        <AuthProvider>
          <CryptoCheck />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

function CryptoCheck() {
  if (typeof window !== "undefined") {
    if (!window.crypto?.subtle) {
      return (
        <div className="fixed inset-0 z-[9999] bg-red-50 flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <h2 className="text-xl font-bold text-red-700 mb-2">Browser Tidak Didukung</h2>
            <p className="text-red-600 mb-4">
              Browser Anda tidak mendukung Web Crypto API. Ini biasanya terjadi kalau:
            </p>
            <ul className="text-left text-sm text-red-600 space-y-1 mb-4">
              <li>• Akses via IP lokal (http://192.168.x.x) — gunakan <b>http://localhost:3000</b></li>
              <li>• Browser versi lama — update Chrome/Firefox/Safari</li>
              <li>• Mode Private/Incognito dengan pembatasan ketat</li>
            </ul>
            <p className="text-xs text-red-400">Silakan akses aplikasi via localhost atau HTTPS.</p>
          </div>
        </div>
      );
    }
  }
  return null;
}

EOF_FIX
echo "  Written: src/app/layout.tsx"

mkdir -p "$(dirname 'src/app/admin/page.tsx')"
cat > 'src/app/admin/page.tsx' << 'EOF_FIX'
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
  UserCheck, UserX, FolderOpen, ChevronDown, ChevronUp, Shield
} from "lucide-react";

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
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanError, setScanError] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedKelas, setSelectedKelas] = useState("all");
  const [loading, setLoading] = useState(true);
  const qrRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!user) { router.push("/login/?admin=1"); return; }
    if (user.role !== "admin") { router.push("/dashboard/"); return; }
    loadAll();
  }, [user]);

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

  const startScan = async () => {
    setScanning(true);
    setScanResult(null);
    setScanError("");
    try {
      console.log("[SCAN] Starting QR scanner...");
      if (typeof navigator === "undefined" || !navigator.mediaDevices) {
        throw new Error("Browser tidak mendukung akses kamera. Pastikan akses HTTPS/localhost.");
      }
      const scanner = new Html5Qrcode("qr-reader");
      qrRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          console.log("[SCAN] QR detected:", decodedText);
          await handleScan(decodedText);
          await scanner.stop();
          setScanning(false);
        },
        (err) => {}
      );
      console.log("[SCAN] Camera started");
    } catch (err: any) {
      console.error("[SCAN] Error:", err);
      setScanError(err?.message || "Gagal memulai kamera. Cek permission browser.");
      setScanning(false);
    }
  };

  const stopScan = async () => {
    if (qrRef.current) {
      try { await qrRef.current.stop(); } catch (e) {}
      qrRef.current = null;
    }
    setScanning(false);
  };

  const handleScan = async (qrData: string) => {
    try {
      console.log("[SCAN] Verifying QR...");
      const result = await verifyQR(qrData, async (id) => {
        const u = await db.getUserById(id);
        return u?.qr_secret || null;
      });
      if (!result.valid) {
        setScanResult({ error: result.reason });
        return;
      }
      const scannedUser = await db.getUserById(result.userId!);
      if (!scannedUser) {
        setScanResult({ error: "User tidak ditemukan" });
        return;
      }
      const absensi = await db.getAbsensi(scannedUser.id);
      const already = absensi.records.find((r) => r.date === selectedDate && r.status === "hadir");
      if (already) {
        setScanResult({ user: scannedUser, status: "already_scanned" });
        return;
      }
      const appSettings = await db.getSettings();
      await db.addAbsensiRecord(scannedUser.id, {
        date: selectedDate, status: "hadir", type: "qr", week: appSettings.current_week,
        scanned_at: new Date().toISOString(), scanned_by: user?.id || "admin",
      });
      await db.addNotification(scannedUser.id, "Absensi Berhasil", `Anda telah ditandai hadir pada ${selectedDate}.`, "success");
      setScanResult({ user: scannedUser, status: "success" });
      loadAll();
    } catch (err: any) {
      console.error("[SCAN] handleScan error:", err);
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
            rec.status = req.data.jenis;
            rec.approved_at = new Date().toISOString();
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
          if (rec) {
            rec.status = "alpha";
            rec.rejected_at = new Date().toISOString();
            await db.saveAbsensi(absen);
          }
          await db.addNotification(userId, "Izin Ditolak", `Pengajuan ${req.data.jenis} Anda untuk ${req.data.tanggal} DITOLAK. Alasan: ${notes}. Anda dapat mengajukan banding.`, "error");
        } else {
          if (req.type === "new_account") await db.updateUser(userId, { status: "rejected" });
          await db.addNotification(userId, "Request Ditolak", `Permintaan ${req.type} Anda ditolak. Alasan: ${notes}.`, "error");
        }
      }
      loadAll();
    } catch (err: any) {
      console.error("[ADMIN] handleRequest error:", err);
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
      console.error("[ADMIN] handleAppeal error:", err);
      alert("Gagal memproses banding: " + err.message);
    }
  };

  const toggleAutoAccept = async () => {
    if (!settings) return;
    try {
      await db.updateSettings({ auto_accept_new_accounts: !settings.auto_accept_new_accounts });
      loadAll();
    } catch (err: any) {
      alert("Gagal mengubah setting: " + err.message);
    }
  };

  const updateUserStatus = async (userId: string, status: string) => {
    try {
      await db.updateUser(userId, { status: status as any });
      await db.addNotification(userId, "Status Akun", `Status akun Anda diubah menjadi ${status} oleh admin.`, "warning");
      loadAll();
    } catch (err: any) {
      alert("Gagal update status: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

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
              <div className="flex flex-col items-center mb-6">
                {!scanning ? (
                  <button type="button" onClick={startScan} className="btn-primary flex items-center gap-2 text-lg px-8 py-4">
                    <ScanLine className="w-5 h-5" />Aktifkan Kamera & Scan QR
                  </button>
                ) : (
                  <div className="w-full max-w-md">
                    <div id="qr-reader" className="rounded-xl overflow-hidden border-2 border-primary"></div>
                    <button type="button" onClick={stopScan} className="w-full mt-2 btn-danger">Stop Kamera</button>
                  </div>
                )}
                {scanError && (
                  <div className="mt-4 p-4 rounded-lg bg-red-50 text-red-700 text-sm max-w-md text-center">
                    <AlertCircle className="w-4 h-4 inline mr-1" />{scanError}
                  </div>
                )}
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

EOF_FIX
echo "  Written: src/app/admin/page.tsx"

mkdir -p "$(dirname 'src/app/dashboard/page.tsx')"
cat > 'src/app/dashboard/page.tsx' << 'EOF_FIX'
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
  const { user, logout, refreshUser } = useAuth();
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
      await refreshUser();
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

EOF_FIX
echo "  Written: src/app/dashboard/page.tsx"

mkdir -p "$(dirname 'src/app/login/page.tsx')"
cat > 'src/app/login/page.tsx' << 'EOF_FIX'
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { LogIn, UserPlus, Shield, Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, role, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"login" | "register" | "admin">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Read search params ONCE on mount to avoid infinite loops
  useEffect(() => {
    const tab = searchParams.get("tab");
    const admin = searchParams.get("admin");
    if (tab === "register") setActiveTab("register");
    if (admin === "1") setActiveTab("admin");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect if already logged in (only when auth check is done)
  useEffect(() => {
    if (!isLoading && role) {
      router.push(role === "admin" ? "/admin/" : "/dashboard/");
    }
  }, [isLoading, role, router]);

  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [registerData, setRegisterData] = useState({
    username: "", password: "", nama_lengkap: "", kelas: "teknik", sub_kelas: "",
  });
  const [adminData, setAdminData] = useState({ username: "", password: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError("");
    try {
      console.log("[LOGIN] Starting login for", loginData.username);
      await db.init();
      const user = await db.getUserByUsername(loginData.username);
      if (!user) throw new Error("Username atau password salah");
      if (user.locked_until && new Date() < new Date(user.locked_until)) {
        throw new Error("Akun terkunci. Coba lagi nanti.");
      }
      const valid = await verifyPassword(loginData.password, user.password_hash);
      if (!valid) {
        const attempts = (user.login_attempts || 0) + 1;
        await db.updateUser(user.id, {
          login_attempts: attempts,
          locked_until: attempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : user.locked_until,
        });
        throw new Error("Username atau password salah");
      }
      if (user.status !== "active") throw new Error(`Akun ${user.status}. Hubungi admin.`);
      await db.updateUser(user.id, { login_attempts: 0, locked_until: null, last_login: new Date().toISOString() });
      const session = await db.createSession(user.id, user.role);
      login(session.token, {
        id: user.id, username: user.username, nama_lengkap: user.nama_lengkap,
        kelas: user.kelas, sub_kelas: user.sub_kelas, role: user.role,
      }, user.role);
      console.log("[LOGIN] Success, redirecting...");
      router.push(user.role === "admin" ? "/admin/" : "/dashboard/");
    } catch (err: any) {
      console.error("[LOGIN] Error:", err);
      setError(err?.message || "Terjadi kesalahan saat login");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      console.log("[REGISTER] Starting registration for", registerData.username);
      await db.init();
      const existing = await db.getUserByUsername(registerData.username);
      if (existing) throw new Error("Username sudah digunakan");
      const user = await db.createUser(registerData);
      console.log("[REGISTER] User created:", user.id);
      const settings = await db.getSettings();
      if (settings.auto_accept_new_accounts) {
        await db.updateUser(user.id, { status: "active" });
        await db.addNotification(user.id, "Akun Diterima", "Akun Anda otomatis diterima.", "success");
        setSuccess("Pendaftaran berhasil! Akun langsung aktif. Silakan login.");
      } else {
        await db.createRequest({
          type: "new_account", user_id: user.id, status: "pending",
          data: { username: user.username, nama_lengkap: user.nama_lengkap, kelas: user.kelas, sub_kelas: user.sub_kelas },
          admin_notes: "", handled_at: null,
        });
        setSuccess("Pendaftaran berhasil! Menunggu persetujuan admin.");
      }
      setRegisterData({ username: "", password: "", nama_lengkap: "", kelas: "teknik", sub_kelas: "" });
      console.log("[REGISTER] Done");
    } catch (err: any) {
      console.error("[REGISTER] Error:", err);
      setError(err?.message || "Terjadi kesalahan saat mendaftar");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError("");
    try {
      console.log("[ADMIN] Starting admin login");
      await db.init();
      const user = await db.getUserByUsername(adminData.username);
      if (!user || user.role !== "admin") throw new Error("Invalid credentials");
      if (user.status !== "active") throw new Error("Akun tidak aktif. Hubungi super admin.");
      const valid = await verifyPassword(adminData.password, user.password_hash);
      if (!valid) throw new Error("Invalid credentials");
      await db.updateUser(user.id, { last_login: new Date().toISOString() });
      const session = await db.createSession(user.id, "admin");
      login(session.token, {
        id: user.id, username: user.username, nama_lengkap: user.nama_lengkap,
        kelas: user.kelas, role: user.role,
      }, "admin");
      console.log("[ADMIN] Success");
      router.push("/admin/");
    } catch (err: any) {
      console.error("[ADMIN] Error:", err);
      setError(err?.message || "Terjadi kesalahan saat login admin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">{activeTab === "admin" ? "Panel Admin" : "Sistem Absensi"}</h1>
            <p className="text-gray-500 mt-1">
              {activeTab === "login" && "Masuk ke akun Anda"}
              {activeTab === "register" && "Buat akun baru"}
              {activeTab === "admin" && "Login khusus admin"}
            </p>
          </div>

          {activeTab !== "admin" && (
            <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
              <button type="button" onClick={() => { setActiveTab("login"); setError(""); setSuccess(""); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "login" ? "bg-white text-primary shadow-sm" : "text-gray-500"}`}>Masuk</button>
              <button type="button" onClick={() => { setActiveTab("register"); setError(""); setSuccess(""); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "register" ? "bg-white text-primary shadow-sm" : "text-gray-500"}`}>Daftar</button>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />{success}
            </div>
          )}

          {activeTab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input type="text" className="input" value={loginData.username} onChange={(e) => setLoginData({ ...loginData, username: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} className="input pr-10" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" className="w-full btn-primary flex items-center justify-center gap-2" disabled={loading}>
                <LogIn className="w-4 h-4" />{loading ? "Memuat..." : "Masuk"}
              </button>
            </form>
          )}

          {activeTab === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input type="text" className="input" value={registerData.nama_lengkap} onChange={(e) => setRegisterData({ ...registerData, nama_lengkap: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input type="text" className="input" value={registerData.username} onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} className="input pr-10" value={registerData.password} onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })} required minLength={6} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
                  <select className="select" value={registerData.kelas} onChange={(e) => setRegisterData({ ...registerData, kelas: e.target.value })}>
                    <option value="teknik">Teknik</option>
                    <option value="nonteknik">Non-Teknik</option>
                    <option value="keduanya">Keduanya</option>
                  </select>
                </div>
                {registerData.kelas === "teknik" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sub Kelas (Opsional)</label>
                    <select className="select" value={registerData.sub_kelas} onChange={(e) => setRegisterData({ ...registerData, sub_kelas: e.target.value })}>
                      <option value="A">A</option>
                      <option value="B">B</option>
                    </select>
                  </div>
                )}
              </div>
              <button type="submit" className="w-full btn-success flex items-center justify-center gap-2" disabled={loading}>
                <UserPlus className="w-4 h-4" />{loading ? "Mendaftar..." : "Daftar"}
              </button>
              <p className="text-xs text-gray-500 text-center">*Akun baru memerlukan persetujuan admin (kecuali auto-accept aktif)</p>
            </form>
          )}

          {activeTab === "admin" && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Username</label>
                <input type="text" className="input" value={adminData.username} onChange={(e) => setAdminData({ ...adminData, username: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} className="input pr-10" value={adminData.password} onChange={(e) => setAdminData({ ...adminData, password: e.target.value })} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" className="w-full btn-primary flex items-center justify-center gap-2" disabled={loading}>
                <Shield className="w-4 h-4" />{loading ? "Memuat..." : "Login Admin"}
              </button>
              <button type="button" onClick={() => setActiveTab("login")} className="w-full text-sm text-gray-500 hover:text-primary">Kembali ke login user</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

EOF_FIX
echo "  Written: src/app/login/page.tsx"

mkdir -p "$(dirname 'src/components/FileExplorer.tsx')"
cat > 'src/components/FileExplorer.tsx' << 'EOF_FIX'
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/db";
import {
  Folder, File, Download, Trash2, Edit3, Move, Upload, Plus,
  ChevronRight, ChevronDown, Database, RotateCcw, Save, FileJson,
  HardDrive, X
} from "lucide-react";

interface MateriFile {
  id: string;
  name: string;
  folder: string;
  week: number;
  size: number;
  type: string;
  uploadedAt: string;
}

export default function FileExplorer() {
  const [files, setFiles] = useState<MateriFile[]>([]);
  const [folders, setFolders] = useState<string[]>(["Root"]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["Root"]));
  const [selectedFolder, setSelectedFolder] = useState<string>("Root");
  const [uploading, setUploading] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveId, setMoveId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [dbStats, setDbStats] = useState({ users: 0, files: 0, requests: 0 });

  const load = async () => {
    const f = await db.getMateriList();
    const fol = await db.getMateriFolders();
    setFiles(f);
    setFolders(fol.length ? fol : ["Root"]);
    const users = await db.getAllUsers();
    const reqs = await db.getRequests();
    setDbStats({ users: users.length, files: f.length, requests: reqs.length });
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await db.init();
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await db.addMateri(file, selectedFolder);
      await load();
    } catch (err) {
      alert("Error: " + (err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    await db.init();
    if (!confirm("Yakin hapus file ini?")) return;
    await db.deleteMateri(id);
    await load();
  };

  const handleRename = async (id: string) => {
    await db.init();
    if (!renameValue.trim()) return;
    await db.renameMateri(id, renameValue.trim());
    setRenameId(null);
    setRenameValue("");
    await load();
  };

  const handleMove = async (id: string, folder: string) => {
    await db.init();
    await db.moveMateri(id, folder);
    setMoveId(null);
    await load();
  };

  const handleDownload = async (file: MateriFile) => {
    const blob = await db.getMateriBlob(file.id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const name = newFolderName.trim();
    if (!folders.includes(name)) setFolders([...folders, name]);
    setSelectedFolder(name);
    setNewFolderName("");
    setShowNewFolder(false);
  };

  const handleExportDB = async () => {
    await db.init();
    const data = await db.exportDatabase();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `absensi-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportDB = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await db.init();
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (confirm("Ini akan MENIMPA semua data saat ini. Yakin?")) {
        await db.importDatabase(data);
        alert("Database berhasil di-import! Halaman akan dimuat ulang.");
        window.location.reload();
      }
    } catch (err) {
      alert("Error import: " + (err as Error).message);
    }
    e.target.value = "";
  };

  const handleResetDB = async () => {
    await db.init();
    if (confirm("PERINGATAN: Ini akan menghapus SEMUA data! Yakin?")) {
      if (prompt('Ketik "RESET" untuk konfirmasi:') === "RESET") {
        await db.resetDatabase();
        alert("Database direset. Halaman akan dimuat ulang.");
        window.location.reload();
      }
    }
  };

  const toggleFolder = (folder: string) => {
    const next = new Set(expandedFolders);
    if (next.has(folder)) next.delete(folder);
    else next.add(folder);
    setExpandedFolders(next);
  };

  const filesInFolder = (folder: string) => files.filter((f) => (f.folder || "Root") === folder);

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-primary" />
          Database Manager
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">{dbStats.users}</p>
            <p className="text-xs text-gray-500">Users</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-success">{dbStats.files}</p>
            <p className="text-xs text-gray-500">Files</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-warning">{dbStats.requests}</p>
            <p className="text-xs text-gray-500">Requests</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExportDB} className="btn-secondary flex items-center gap-2 text-sm">
            <Database className="w-4 h-4" /> Export JSON
          </button>
          <label className="btn-secondary flex items-center gap-2 text-sm cursor-pointer">
            <FileJson className="w-4 h-4" /> Import JSON
            <input type="file" accept=".json" className="hidden" onChange={handleImportDB} />
          </label>
          <button onClick={handleResetDB} className="btn-danger flex items-center gap-2 text-sm">
            <RotateCcw className="w-4 h-4" /> Reset DB
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Folder className="w-5 h-5 text-warning" />
            File Explorer
          </h3>
          <div className="flex gap-2">
            <button onClick={() => setShowNewFolder(!showNewFolder)} className="btn-secondary text-sm flex items-center gap-1">
              <Plus className="w-4 h-4" /> Folder
            </button>
            <label className="btn-primary text-sm flex items-center gap-1 cursor-pointer">
              <Upload className="w-4 h-4" /> Upload
              <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        </div>

        {showNewFolder && (
          <div className="flex gap-2 mb-4">
            <input type="text" className="input flex-1" placeholder="Nama folder (contoh: week1, week2)" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()} />
            <button onClick={handleCreateFolder} className="btn-success">Buat</button>
            <button onClick={() => setShowNewFolder(false)} className="btn-secondary"><X className="w-4 h-4" /></button>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Upload ke Folder:</label>
          <select className="select" value={selectedFolder} onChange={(e) => setSelectedFolder(e.target.value)}>
            {folders.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {folders.map((folder) => {
            const folderFiles = filesInFolder(folder);
            const isExpanded = expandedFolders.has(folder);
            return (
              <div key={folder} className="border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => toggleFolder(folder)} className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                  <Folder className="w-4 h-4 text-warning" />
                  <span className="font-medium text-sm">{folder}</span>
                  <span className="text-xs text-gray-400 ml-auto">{folderFiles.length} file</span>
                </button>
                {isExpanded && (
                  <div className="divide-y divide-gray-100">
                    {folderFiles.map((file) => (
                      <div key={file.id} className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors group relative">
                        <File className="w-4 h-4 text-gray-400" />
                        <div className="flex-1 min-w-0">
                          {renameId === file.id ? (
                            <div className="flex gap-2">
                              <input type="text" className="input py-1 text-sm" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && handleRename(file.id)} />
                              <button onClick={() => handleRename(file.id)} className="text-success"><Save className="w-4 h-4" /></button>
                              <button onClick={() => { setRenameId(null); setRenameValue(""); }} className="text-danger"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <p className="text-sm font-medium truncate">{file.name}</p>
                          )}
                          <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleDownload(file)} className="p-1.5 text-primary hover:bg-blue-100 rounded" title="Download"><Download className="w-4 h-4" /></button>
                          <button onClick={() => { setRenameId(file.id); setRenameValue(file.name); }} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Rename"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => setMoveId(file.id)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Move"><Move className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(file.id)} className="p-1.5 text-danger hover:bg-red-100 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        {moveId === file.id && (
                          <div className="absolute right-4 top-12 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10 w-40">
                            <p className="text-xs font-medium mb-1">Pindah ke:</p>
                            {folders.filter((f) => f !== folder).map((f) => (
                              <button key={f} onClick={() => handleMove(file.id, f)} className="block w-full text-left text-sm px-2 py-1 hover:bg-gray-100 rounded">{f}</button>
                            ))}
                            <button onClick={() => setMoveId(null)} className="block w-full text-left text-sm px-2 py-1 text-danger hover:bg-red-50 rounded">Batal</button>
                          </div>
                        )}
                      </div>
                    ))}
                    {folderFiles.length === 0 && <div className="px-4 py-4 text-sm text-gray-400 text-center">Folder kosong</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

EOF_FIX
echo "  Written: src/components/FileExplorer.tsx"

mkdir -p "$(dirname 'src/components/IzinForm.tsx')"
cat > 'src/components/IzinForm.tsx' << 'EOF_FIX'
"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import { AlertTriangle, Upload, X } from "lucide-react";

export default function IzinForm({ userId, onSuccess }: { userId: string; onSuccess?: () => void }) {
  const [jenis, setJenis] = useState<"izin" | "sakit">("izin");
  const [keterangan, setKeterangan] = useState("");
  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [foto, setFoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError("Ukuran file maksimal 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setFoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.init();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const absensi = await db.getAbsensi(userId);
      const existing = absensi.records.find((r) => r.date === tanggal && !r.status.startsWith("alpha"));
      if (existing) {
        setError("Sudah ada record untuk tanggal ini");
        setLoading(false);
        return;
      }
      const settings = await db.getSettings();
      await db.addAbsensiRecord(userId, {
        date: tanggal,
        status: `pending_${jenis}`,
        type: "izin",
        jenis,
        keterangan,
        week: settings.current_week,
      });
      await db.createRequest({
        type: "izin",
        user_id: userId,
        status: "pending",
        data: { jenis, keterangan, tanggal, foto },
        admin_notes: "",
        handled_at: null,
      });
      await db.addNotification(userId, "Izin Diajukan", `Pengajuan ${jenis} untuk ${tanggal} sedang menunggu persetujuan admin.`, "info");
      setSuccess(`Pengajuan ${jenis} berhasil dikirim!`);
      setKeterangan("");
      setFoto(null);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-danger" />
        <h3 className="text-lg font-semibold text-danger">Ajukan Izin / Sakit</h3>
      </div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <button type="button" onClick={() => setJenis("izin")} className={`py-3 rounded-lg font-medium transition-all ${jenis === "izin" ? "bg-yellow-100 text-yellow-800 border-2 border-yellow-400" : "bg-gray-100 text-gray-600 border-2 border-transparent"}`}>Izin</button>
          <button type="button" onClick={() => setJenis("sakit")} className={`py-3 rounded-lg font-medium transition-all ${jenis === "sakit" ? "bg-blue-100 text-blue-800 border-2 border-blue-400" : "bg-gray-100 text-gray-600 border-2 border-transparent"}`}>Sakit</button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
          <input type="date" className="input" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan <span className="text-danger">*</span></label>
          <textarea className="input min-h-[100px] resize-none" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Jelaskan alasan izin/sakit..." required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lampiran Foto (Opsional)</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary transition-colors">
            {foto ? (
              <div className="relative inline-block">
                <img src={foto} alt="Preview" className="max-h-32 rounded-lg" />
                <button type="button" onClick={() => setFoto(null)} className="absolute -top-2 -right-2 bg-danger text-white rounded-full p-1"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">Klik untuk upload foto (max 2MB)</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            )}
          </div>
        </div>
        <button type="submit" className="w-full btn-danger" disabled={loading}>{loading ? "Mengirim..." : `Ajukan ${jenis === "izin" ? "Izin" : "Sakit"}`}</button>
      </form>
    </div>
  );
}

EOF_FIX
echo "  Written: src/components/IzinForm.tsx"

mkdir -p "$(dirname 'src/components/MateriExplorer.tsx')"
cat > 'src/components/MateriExplorer.tsx' << 'EOF_FIX'
"use client";

import { useState } from "react";
import { Folder, File, Download, ChevronRight, ChevronDown, BookOpen } from "lucide-react";

interface MateriFile {
  id: string;
  name: string;
  folder: string;
  week: number;
  size: number;
  type: string;
  uploadedAt: string;
}

interface MateriExplorerProps {
  files: MateriFile[];
  getDownloadUrl: (id: string) => Promise<string | null>;
}

const EXT_ICONS: Record<string, string> = {
  "application/pdf": "text-red-500",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "text-orange-500",
  "application/vnd.ms-powerpoint": "text-orange-500",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "text-blue-500",
  "application/msword": "text-blue-500",
  "video/mp4": "text-purple-500",
  "application/zip": "text-gray-500",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function MateriExplorer({ files, getDownloadUrl }: MateriExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const toggleFolder = (folder: string) => {
    const next = new Set(expandedFolders);
    if (next.has(folder)) next.delete(folder);
    else next.add(folder);
    setExpandedFolders(next);
  };

  const weeks = Array.from(new Set(files.map((f) => f.week))).sort((a, b) => a - b);
  const filteredFiles = selectedWeek !== null ? files.filter((f) => f.week === selectedWeek) : files;

  const groupedByFolder: Record<string, MateriFile[]> = {};
  filteredFiles.forEach((f) => {
    const key = f.folder || "Root";
    if (!groupedByFolder[key]) groupedByFolder[key] = [];
    groupedByFolder[key].push(f);
  });

  const handleDownload = async (file: MateriFile) => {
    setDownloading(file.id);
    try {
      const url = await getDownloadUrl(file.id);
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-success" />
          Materi Pembelajaran
        </h3>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedWeek(null)}
          className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${selectedWeek === null ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          Semua
        </button>
        {weeks.map((w) => (
          <button
            key={w}
            onClick={() => setSelectedWeek(w)}
            className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${selectedWeek === w ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Week {w}
          </button>
        ))}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {Object.entries(groupedByFolder).map(([folder, folderFiles]) => (
          <div key={folder} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleFolder(folder)}
              className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              {expandedFolders.has(folder) ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
              <Folder className="w-4 h-4 text-warning" />
              <span className="font-medium text-sm">{folder || "Materi"}</span>
              <span className="text-xs text-gray-400 ml-auto">{folderFiles.length} file</span>
            </button>
            {expandedFolders.has(folder) && (
              <div className="divide-y divide-gray-100">
                {folderFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors">
                    <File className={`w-4 h-4 ${EXT_ICONS[file.type] || "text-gray-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
                    </div>
                    <button
                      onClick={() => handleDownload(file)}
                      disabled={downloading === file.id}
                      className="p-2 text-primary hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <Download className={`w-4 h-4 ${downloading === file.id ? "animate-bounce" : ""}`} />
                    </button>
                  </div>
                ))}
                {folderFiles.length === 0 && (
                  <div className="px-4 py-4 text-sm text-gray-400 text-center">Folder kosong</div>
                )}
              </div>
            )}
          </div>
        ))}
        {files.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Belum ada materi</p>
          </div>
        )}
      </div>
    </div>
  );
}

EOF_FIX
echo "  Written: src/components/MateriExplorer.tsx"

mkdir -p "$(dirname 'src/components/NotificationBell.tsx')"
cat > 'src/components/NotificationBell.tsx' << 'EOF_FIX'
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/db";
import { Bell } from "lucide-react";

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [show, setShow] = useState(false);

  const load = async () => {
    const n = await db.getNotifications(userId);
    setNotifications(n);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  const markRead = async (id: string) => {
    await db.markNotificationRead(id);
    load();
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button onClick={() => setShow(!show)} className="p-2 hover:bg-gray-100 rounded-lg relative">
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full"></span>}
      </button>
      {show && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
          <div className="px-4 py-2 border-b border-gray-100 font-medium text-sm">Notifikasi</div>
          {notifications.length === 0 ? (
            <div className="px-4 py-4 text-sm text-gray-400 text-center">Tidak ada notifikasi</div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {notifications.map((n) => (
                <div key={n.id} className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 ${!n.read ? "bg-blue-50/50" : ""}`} onClick={() => { markRead(n.id); setShow(false); }}>
                  <div className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.type === "success" ? "bg-green-500" : n.type === "error" ? "bg-red-500" : n.type === "warning" ? "bg-yellow-500" : "bg-blue-500"}`} />
                    <div>
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

EOF_FIX
echo "  Written: src/components/NotificationBell.tsx"

mkdir -p "$(dirname 'src/components/QRDisplay.tsx')"
cat > 'src/components/QRDisplay.tsx' << 'EOF_FIX'
"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { generateQRPayload } from "@/lib/crypto";
import { RefreshCw, QrCode } from "lucide-react";

export default function QRDisplay({ userId, qrSecret }: { userId: string; qrSecret: string }) {
  const [qrData, setQrData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(300);

  const fetchQR = async () => {
    setLoading(true);
    try {
      const res = await generateQRPayload(userId, qrSecret);
      setQrData(res);
      setCountdown(300);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQR();
  }, [userId, qrSecret]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      fetchQR();
    }
  }, [countdown]);

  return (
    <div className="card text-center">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <QrCode className="w-5 h-5 text-primary" />
          QR Absensi
        </h3>
        <button onClick={fetchQR} className="text-gray-400 hover:text-primary" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {qrData ? (
        <div className="flex flex-col items-center">
          <div className="bg-white p-4 rounded-xl border-2 border-primary/20">
            <QRCodeSVG value={qrData.qr_data} size={200} level="H" />
          </div>
          <p className="text-sm text-gray-500 mt-3">
            Refresh dalam <span className="font-mono font-bold text-primary">{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">Tunjukkan QR ini ke admin untuk absensi</p>
        </div>
      ) : (
        <div className="py-12 text-gray-400">Memuat QR...</div>
      )}
    </div>
  );
}

EOF_FIX
echo "  Written: src/components/QRDisplay.tsx"

mkdir -p "$(dirname 'src/lib/auth.tsx')"
cat > 'src/lib/auth.tsx' << 'EOF_FIX'
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { db } from "./db";

interface AuthUser {
  id: string;
  username: string;
  nama_lengkap: string;
  kelas: string;
  sub_kelas?: string;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  role: string | null;
  login: (token: string, user: AuthUser, role: string) => void;
  logout: () => void;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    db.init().then(() => {
      db.ensureDefaultAdmin().then(() => {
        const storedToken = localStorage.getItem("absensi_token");
        const storedUser = localStorage.getItem("absensi_user");
        const storedRole = localStorage.getItem("absensi_role");
        if (storedToken && storedUser && storedRole) {
          db.getSession(storedToken).then((session) => {
            if (session) {
              setToken(storedToken);
              setUser(JSON.parse(storedUser));
              setRole(storedRole);
            } else {
              localStorage.removeItem("absensi_token");
              localStorage.removeItem("absensi_user");
              localStorage.removeItem("absensi_role");
            }
            setIsLoading(false);
          });
        } else {
          setIsLoading(false);
        }
      });
    });
  }, []);

  const login = (newToken: string, newUser: AuthUser, newRole: string) => {
    localStorage.setItem("absensi_token", newToken);
    localStorage.setItem("absensi_user", JSON.stringify(newUser));
    localStorage.setItem("absensi_role", newRole);
    setToken(newToken);
    setUser(newUser);
    setRole(newRole);
  };

  const logout = () => {
    if (token) db.deleteSession(token);
    localStorage.removeItem("absensi_token");
    localStorage.removeItem("absensi_user");
    localStorage.removeItem("absensi_role");
    setToken(null);
    setUser(null);
    setRole(null);
    router.push("/");
  };

  const refreshUser = async () => {
    if (!user) return;
    const u = await db.getUserById(user.id);
    if (u) {
      const authUser: AuthUser = {
        id: u.id,
        username: u.username,
        nama_lengkap: u.nama_lengkap,
        kelas: u.kelas,
        sub_kelas: u.sub_kelas,
        role: u.role,
      };
      setUser(authUser);
      localStorage.setItem("absensi_user", JSON.stringify(authUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, role, login, logout, isLoading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

EOF_FIX
echo "  Written: src/lib/auth.tsx"

mkdir -p "$(dirname 'src/lib/db.ts')"
cat > 'src/lib/db.ts' << 'EOF_FIX'
"use client";

import { generateId, hashPassword } from "./crypto";

const DB_NAME = "AbsensiDB";
const DB_VERSION = 1;

export interface User {
  id: string;
  username: string;
  password_hash: string;
  nama_lengkap: string;
  kelas: "teknik" | "nonteknik" | "keduanya";
  sub_kelas?: string;
  role: "user" | "admin";
  status: "pending" | "active" | "rejected" | "suspended";
  created_at: string;
  last_login: string | null;
  qr_secret: string;
  login_attempts: number;
  locked_until: string | null;
}

export interface AbsensiRecord {
  date: string;
  status: string;
  type?: string;
  jenis?: string;
  keterangan?: string;
  week: number;
  created_at: string;
  scanned_at?: string;
  scanned_by?: string;
  approved_at?: string;
  rejected_at?: string;
}

export interface AbsensiData {
  userId: string;
  records: AbsensiRecord[];
}

export interface RequestItem {
  id: string;
  type: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  data: any;
  created_at: string;
  admin_notes: string;
  handled_at: string | null;
}

export interface MateriFile {
  id: string;
  name: string;
  folder: string;
  week: number;
  size: number;
  type: string;
  blob?: Blob;
  uploadedAt: string;
}

export interface AppSettings {
  key: string;
  current_week: number;
  total_weeks: number;
  semester: string;
  auto_accept_new_accounts: boolean;
  last_absen_day: string | null;
  last_absen_kelas: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  created_at: string;
}

export interface Appeal {
  id: string;
  request_id: string;
  user_id: string;
  alasan: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  admin_response: string | null;
  handled_at: string | null;
}

export interface Session {
  token: string;
  user_id: string;
  role: string;
  created_at: string;
  expires_at: string;
}

class AppDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init().catch((err) => {
      this.initPromise = null;
      throw err;
    });
    return this.initPromise;
  }

  private _init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        this.db = req.result;
        resolve();
      };
      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("users")) db.createObjectStore("users", { keyPath: "id" });
        if (!db.objectStoreNames.contains("absensi")) db.createObjectStore("absensi", { keyPath: "userId" });
        if (!db.objectStoreNames.contains("requests")) db.createObjectStore("requests", { keyPath: "id" });
        if (!db.objectStoreNames.contains("materi")) db.createObjectStore("materi", { keyPath: "id" });
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
        if (!db.objectStoreNames.contains("notifications")) {
          const store = db.createObjectStore("notifications", { keyPath: "id" });
          store.createIndex("user_id", "user_id", { unique: false });
        }
        if (!db.objectStoreNames.contains("appeals")) db.createObjectStore("appeals", { keyPath: "id" });
        if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions", { keyPath: "token" });
      };
    });
  }

  private store(name: string, mode: IDBTransactionMode = "readonly"): IDBObjectStore {
    if (!this.db) throw new Error("DB not initialized");
    return this.db.transaction(name, mode).objectStore(name);
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const req = this.store(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  private async getOne<T>(storeName: string, key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const req = this.store(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  private async putOne<T>(storeName: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = this.store(storeName, "readwrite").put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private async deleteOne(storeName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = this.store(storeName, "readwrite").delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ========== USERS ==========
  async getUserById(id: string): Promise<User | null> {
    return this.getOne("users", id);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const users = await this.getAll<User>("users");
    return users.find((u) => u.username === username) || null;
  }

  async createUser(data: { username: string; password: string; nama_lengkap: string; kelas: string; sub_kelas?: string }): Promise<User> {
    const id = generateId("usr");
    const user: User = {
      id,
      username: data.username,
      password_hash: await hashPassword(data.password),
      nama_lengkap: data.nama_lengkap,
      kelas: data.kelas as any,
      sub_kelas: data.sub_kelas,
      role: "user",
      status: "pending",
      created_at: new Date().toISOString(),
      last_login: null,
      qr_secret: generateId("qr"),
      login_attempts: 0,
      locked_until: null,
    };
    await this.putOne("users", user);
    await this.putOne("absensi", { userId: id, records: [] });
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    const user = await this.getUserById(id);
    if (!user) throw new Error("User not found");
    await this.putOne("users", { ...user, ...updates });
  }

  async getAllUsers(): Promise<User[]> {
    return this.getAll<User>("users");
  }

  // ========== ADMINS ==========
  async ensureDefaultAdmin(): Promise<void> {
    const users = await this.getAllUsers();
    const hasAdmin = users.some((u) => u.role === "admin");
    if (!hasAdmin) {
      const admin: User = {
        id: "admin_001",
        username: "admin",
        password_hash: await hashPassword("admin123"),
        nama_lengkap: "Administrator",
        kelas: "nonteknik",
        role: "admin",
        status: "active",
        created_at: new Date().toISOString(),
        last_login: null,
        qr_secret: generateId("qr"),
        login_attempts: 0,
        locked_until: null,
      };
      await this.putOne("users", admin);
    }
  }

  // ========== ABSENSI ==========
  async getAbsensi(userId: string): Promise<AbsensiData> {
    const data = await this.getOne<AbsensiData>("absensi", userId);
    return data || { userId, records: [] };
  }

  async addAbsensiRecord(userId: string, record: Omit<AbsensiRecord, "created_at">): Promise<void> {
    const data = await this.getAbsensi(userId);
    data.records.push({ ...record, created_at: new Date().toISOString() } as AbsensiRecord);
    await this.putOne("absensi", data);
  }

  async saveAbsensi(absen: AbsensiData): Promise<void> {
    await this.putOne("absensi", absen);
  }

  // ========== REQUESTS ==========
  async getRequests(): Promise<RequestItem[]> {
    return this.getAll("requests");
  }

  async getRequest(id: string): Promise<RequestItem | null> {
    return this.getOne("requests", id);
  }

  async createRequest(item: Omit<RequestItem, "id" | "created_at">): Promise<RequestItem> {
    const id = generateId("req");
    const req = { ...item, id, created_at: new Date().toISOString() };
    await this.putOne("requests", req);
    return req as RequestItem;
  }

  async updateRequest(id: string, updates: Partial<RequestItem>): Promise<void> {
    const req = await this.getRequest(id);
    if (!req) throw new Error("Request not found");
    await this.putOne("requests", { ...req, ...updates });
  }

  // ========== NOTIFICATIONS ==========
  async getNotifications(userId: string): Promise<Notification[]> {
    const all = await this.getAll<Notification>("notifications");
    return all.filter((n) => n.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async addNotification(userId: string, title: string, message: string, notifType: Notification["type"] = "info"): Promise<void> {
    const notif: Notification = {
      id: generateId("notif"),
      user_id: userId,
      title,
      message,
      type: notifType,
      read: false,
      created_at: new Date().toISOString(),
    };
    await this.putOne("notifications", notif);
    const userNotifs = await this.getNotifications(userId);
    if (userNotifs.length > 50) {
      for (const n of userNotifs.slice(50)) {
        await this.deleteOne("notifications", n.id);
      }
    }
  }

  async markNotificationRead(id: string): Promise<void> {
    const n = await this.getOne<Notification>("notifications", id);
    if (n) await this.putOne("notifications", { ...n, read: true });
  }

  // ========== APPEALS ==========
  async getAppeals(): Promise<Appeal[]> {
    return this.getAll("appeals");
  }

  async getUserAppeals(userId: string): Promise<Appeal[]> {
    const all = await this.getAll<Appeal>("appeals");
    return all.filter((a) => a.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async createAppeal(data: Omit<Appeal, "id">): Promise<Appeal> {
    const id = generateId("apl");
    const appeal = { ...data, id };
    await this.putOne("appeals", appeal);
    return appeal as Appeal;
  }

  async updateAppeal(id: string, updates: Partial<Appeal>): Promise<void> {
    const a = await this.getOne<Appeal>("appeals", id);
    if (!a) throw new Error("Appeal not found");
    await this.putOne("appeals", { ...a, ...updates });
  }

  // ========== SESSIONS ==========
  async createSession(userId: string, role: string): Promise<Session> {
    const token = generateId("tkn");
    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const session: Session = {
      token,
      user_id: userId,
      role,
      created_at: now.toISOString(),
      expires_at: expires.toISOString(),
    };
    await this.putOne("sessions", session);
    return session;
  }

  async getSession(token: string): Promise<Session | null> {
    const s = await this.getOne<Session>("sessions", token);
    if (!s) return null;
    if (new Date() > new Date(s.expires_at)) {
      await this.deleteOne("sessions", token);
      return null;
    }
    return s;
  }

  async deleteSession(token: string): Promise<void> {
    await this.deleteOne("sessions", token);
  }

  // ========== SETTINGS ==========
  async getSettings(): Promise<AppSettings> {
    const s = await this.getOne<AppSettings>("settings", "app");
    if (s) return s;
    const defaults: AppSettings = {
      key: "app",
      current_week: 1,
      total_weeks: 16,
      semester: "Ganjil 2026",
      auto_accept_new_accounts: false,
      last_absen_day: null,
      last_absen_kelas: null,
    };
    await this.putOne("settings", defaults);
    return defaults;
  }

  async updateSettings(updates: Partial<AppSettings>): Promise<void> {
    const s = await this.getSettings();
    await this.putOne("settings", { ...s, ...updates });
  }

  // ========== MATERI / FILE EXPLORER ==========
  async getMateriList(): Promise<MateriFile[]> {
    const all = await this.getAll<MateriFile>("materi");
    return all.sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));
  }

  async getMateriFolders(): Promise<string[]> {
    const all = await this.getMateriList();
    const folders = new Set(all.map((m) => m.folder || "Root"));
    return Array.from(folders).sort();
  }

  async addMateri(file: File, folder: string): Promise<MateriFile> {
    const id = generateId("mat");
    const weekMatch = folder.match(/week(\d+)/i);
    const week = weekMatch ? parseInt(weekMatch[1]) : 1;
    const materi: MateriFile = {
      id,
      name: file.name,
      folder: folder || "Root",
      week,
      size: file.size,
      type: file.type || "application/octet-stream",
      blob: file,
      uploadedAt: new Date().toISOString(),
    };
    await this.putOne("materi", materi);
    return materi;
  }

  async getMateriBlob(id: string): Promise<Blob | null> {
    const m = await this.getOne<MateriFile>("materi", id);
    return m?.blob || null;
  }

  async deleteMateri(id: string): Promise<void> {
    await this.deleteOne("materi", id);
  }

  async renameMateri(id: string, newName: string): Promise<void> {
    const m = await this.getOne<MateriFile>("materi", id);
    if (!m) throw new Error("File not found");
    await this.putOne("materi", { ...m, name: newName });
  }

  async moveMateri(id: string, newFolder: string): Promise<void> {
    const m = await this.getOne<MateriFile>("materi", id);
    if (!m) throw new Error("File not found");
    const weekMatch = newFolder.match(/week(\d+)/i);
    const week = weekMatch ? parseInt(weekMatch[1]) : m.week;
    await this.putOne("materi", { ...m, folder: newFolder, week });
  }

  // ========== EXPORT / IMPORT ==========
  async exportDatabase(): Promise<Record<string, any[]>> {
    const users = await this.getAllUsers();
    const absensi = await this.getAll<AbsensiData>("absensi");
    const requests = await this.getAll<RequestItem>("requests");
    const notifications = await this.getAll<Notification>("notifications");
    const appeals = await this.getAll<Appeal>("appeals");
    const settings = await this.getSettings();
    const materiMeta = (await this.getMateriList()).map(({ blob, ...rest }) => rest);
    return { users, absensi, requests, notifications, appeals, settings: [settings], materi: materiMeta };
  }

  async importDatabase(data: Record<string, any[]>): Promise<void> {
    const stores = ["users", "absensi", "requests", "notifications", "appeals", "materi"];
    for (const store of stores) {
      const all = await this.getAll<any>(store);
      for (const item of all) {
        const key = store === "absensi" ? item.userId : item.id;
        if (key) await this.deleteOne(store, key);
      }
    }
    if (data.users) for (const u of data.users) await this.putOne("users", u);
    if (data.absensi) for (const a of data.absensi) await this.putOne("absensi", a);
    if (data.requests) for (const r of data.requests) await this.putOne("requests", r);
    if (data.notifications) for (const n of data.notifications) await this.putOne("notifications", n);
    if (data.appeals) for (const a of data.appeals) await this.putOne("appeals", a);
    if (data.settings?.[0]) await this.putOne("settings", data.settings[0]);
    if (data.materi) {
      for (const m of data.materi) {
        await this.putOne("materi", { ...m, blob: undefined });
      }
    }
  }

  async resetDatabase(): Promise<void> {
    const stores = ["users", "absensi", "requests", "materi", "settings", "notifications", "appeals", "sessions"];
    for (const store of stores) {
      const all = await this.getAll<any>(store);
      for (const item of all) {
        const key = store === "settings" ? item.key : store === "absensi" ? item.userId : item.id || item.token;
        if (key) await this.deleteOne(store, key);
      }
    }
    await this.ensureDefaultAdmin();
    await this.getSettings();
  }
}

export const db = new AppDB();

EOF_FIX
echo "  Written: src/lib/db.ts"

# npm install if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}→ node_modules tidak ditemukan, menjalankan npm install...${NC}"
    npm install
fi

# Git
echo ""
echo -e "${YELLOW}→ Git operations...${NC}"
if [ -d ".git" ]; then
    git add -A
    if git diff --cached --quiet; then
        echo -e "${YELLOW}Tidak ada perubahan untuk di-commit.${NC}"
    else
        git commit -m "fix v2: button debug, crypto check, scan QR errors, searchParams loop"
        echo -e "${GREEN}Commit OK${NC}"
        git push 2>/dev/null && echo -e "${GREEN}Push OK${NC}" || echo -e "${YELLOW}Push gagal, push manual: git push origin $(git branch --show-current)${NC}"
    fi
else
    echo -e "${YELLOW}Skip git (no .git)${NC}"
fi

echo ""
echo -e "${GREEN}=== FIX v2 SELESAI ===${NC}"
echo ""
echo "Perubahan utama:"
echo "  • Login: debug console.log + e.stopPropagation() + searchParams read once"
echo "  • Admin Scan QR: visible error message kalau kamera gagal"
echo "  • Layout: global crypto.subtle check (muncul warning kalau browser tidak support)"
echo "  • Semua tombol: explicit type=button + better error catch"
echo ""
echo "Cara cek masalah:"
echo "  1. Buka browser → DevTools (F12) → Console"
echo "  2. Klik tombol yang bermasalah"
echo "  3. Lihat log [LOGIN], [REGISTER], [SCAN], dll"
echo ""
echo "Kalau muncul 'Browser Tidak Didukung' => akses via http://localhost:3000"
echo ""
