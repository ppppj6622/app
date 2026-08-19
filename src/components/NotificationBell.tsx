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
                <div key={n.id} className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 ${!n.read ? "bg-blue-50/50" : ""}`} onClick={() => markRead(n.id)}>
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
