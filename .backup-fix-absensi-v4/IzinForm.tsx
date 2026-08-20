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

