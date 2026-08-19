"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Calendar, Shield, BookOpen, QrCode } from "lucide-react";

export default function Home() {
  const { user, role, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (role === "admin") router.push("/admin/");
      else if (role === "user") router.push("/dashboard/");
    }
  }, [isLoading, role, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Sistem Absensi</h1>
          <p className="text-xl text-gray-600 mb-8">Kelas Teknik & Non-Teknik - 100% Offline</p>
          <div className="flex justify-center gap-4">
            <button onClick={() => router.push("/login/")} className="btn-primary text-lg px-8 py-3">Masuk</button>
            <button onClick={() => router.push("/login/?tab=register")} className="btn-secondary text-lg px-8 py-3">Buat Akun</button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="card text-center">
            <QrCode className="w-12 h-12 mx-auto text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Absensi QR</h3>
            <p className="text-gray-600">Scan QR code untuk absensi cepat dan aman</p>
          </div>
          <div className="card text-center">
            <BookOpen className="w-12 h-12 mx-auto text-success mb-4" />
            <h3 className="text-xl font-semibold mb-2">Materi Pembelajaran</h3>
            <p className="text-gray-600">Akses materi mingguan yang terorganisir</p>
          </div>
          <div className="card text-center">
            <Shield className="w-12 h-12 mx-auto text-warning mb-4" />
            <h3 className="text-xl font-semibold mb-2">Izin & Sakit</h3>
            <p className="text-gray-600">Ajukan izin dengan keterangan lengkap</p>
          </div>
        </div>

        <div className="card">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            Jadwal Kelas
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border-l-4 border-primary pl-4">
              <h3 className="text-lg font-semibold text-primary">Kelas Teknik</h3>
              <p className="text-gray-600 mt-1">Rabu & Kamis</p>
              <p className="text-sm text-gray-500 mt-1">Murid cukup hadir salah satu hari</p>
              <p className="text-sm text-gray-500">Dibagi 2 sub-kelas: A & B</p>
            </div>
            <div className="border-l-4 border-success pl-4">
              <h3 className="text-lg font-semibold text-success">Kelas Non-Teknik</h3>
              <p className="text-gray-600 mt-1">Selasa</p>
              <p className="text-sm text-gray-500 mt-1">1 hari per minggu</p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button onClick={() => router.push("/login/?admin=1")} className="text-sm text-gray-500 hover:text-primary transition-colors">
            Panel Admin
          </button>
        </div>
      </div>
    </div>
  );
}
