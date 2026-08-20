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

