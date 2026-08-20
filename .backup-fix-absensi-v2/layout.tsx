import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";


export const metadata: Metadata = {
  title: "Sistem Absensi",
  description: "Sistem Absensi Kelas Teknik & Non-Teknik - 100% Offline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
