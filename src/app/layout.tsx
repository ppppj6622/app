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

