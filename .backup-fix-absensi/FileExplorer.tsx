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
