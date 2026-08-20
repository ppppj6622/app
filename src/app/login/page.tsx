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

  useEffect(() => {
    if (searchParams.get("tab") === "register") setActiveTab("register");
    if (searchParams.get("admin") === "1") setActiveTab("admin");
  }, [searchParams]);

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
    setLoading(true);
    setError("");
    try {
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
      router.push(user.role === "admin" ? "/admin/" : "/dashboard/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await db.init();
      const existing = await db.getUserByUsername(registerData.username);
      if (existing) throw new Error("Username sudah digunakan");
      const user = await db.createUser(registerData);
      const settings = await db.getSettings();
      if (settings.auto_accept_new_accounts) {
        await db.updateUser(user.id, { status: "active" });
        await db.addNotification(user.id, "Akun Diterima", "Akun Anda otomatis diterima.", "success");
        setSuccess("Pendaftaran berhasil! Akun langsung aktif.");
      } else {
        await db.createRequest({
          type: "new_account", user_id: user.id, status: "pending",
          data: { username: user.username, nama_lengkap: user.nama_lengkap, kelas: user.kelas, sub_kelas: user.sub_kelas },
          admin_notes: "", handled_at: null,
        });
        setSuccess("Pendaftaran berhasil! Menunggu persetujuan admin.");
      }
      setRegisterData({ username: "", password: "", nama_lengkap: "", kelas: "teknik", sub_kelas: "" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
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
      router.push("/admin/");
    } catch (err: any) {
      setError(err.message);
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
              <button onClick={() => { setActiveTab("login"); setError(""); setSuccess(""); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "login" ? "bg-white text-primary shadow-sm" : "text-gray-500"}`}>Masuk</button>
              <button onClick={() => { setActiveTab("register"); setError(""); setSuccess(""); }}
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

