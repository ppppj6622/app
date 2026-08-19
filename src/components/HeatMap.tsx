"use client";

import { useMemo } from "react";

interface HeatMapProps {
  data: Record<string, string>;
  title?: string;
}

const STATUS_COLORS: Record<string, string> = {
  hadir: "bg-green-500",
  izin: "bg-yellow-500",
  sakit: "bg-blue-500",
  alpha: "bg-red-500",
  pending_izin: "bg-yellow-300",
  pending_sakit: "bg-blue-300",
};

const STATUS_LABELS: Record<string, string> = {
  hadir: "Hadir",
  izin: "Izin",
  sakit: "Sakit",
  alpha: "Alpha",
  pending_izin: "Pending Izin",
  pending_sakit: "Pending Sakit",
};

export default function HeatMap({ data, title = "Heat Map Kehadiran" }: HeatMapProps) {
  const weeks = useMemo(() => {
    const sortedDates = Object.keys(data).sort();
    if (sortedDates.length === 0) return [];
    const groups: string[][] = [];
    let currentWeek: string[] = [];
    sortedDates.forEach((date, idx) => {
      currentWeek.push(date);
      if (currentWeek.length === 7 || idx === sortedDates.length - 1) {
        groups.push([...currentWeek]);
        currentWeek = [];
      }
    });
    return groups;
  }, [data]);

  const getDayName = (dateStr: string) => {
    const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    return days[new Date(dateStr).getDay()];
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {weeks.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Belum ada data absensi</p>
      ) : (
        <div className="space-y-2 overflow-x-auto">
          <div className="flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((date) => (
                  <div
                    key={date}
                    className={`w-8 h-8 rounded-md ${STATUS_COLORS[data[date]] || "bg-gray-200"} hover:ring-2 hover:ring-gray-400 transition-all cursor-pointer relative group`}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                      {getDayName(date)}, {date}: {STATUS_LABELS[data[date]] || "-"}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex gap-4 text-xs text-gray-600 mt-4 flex-wrap">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded ${STATUS_COLORS[key]}`} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
