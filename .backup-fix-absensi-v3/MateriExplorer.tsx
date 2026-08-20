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

