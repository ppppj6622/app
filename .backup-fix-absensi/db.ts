"use client";

import { generateId, hashPassword } from "./crypto";

const DB_NAME = "AbsensiDB";
const DB_VERSION = 1;

export interface User {
  id: string;
  username: string;
  password_hash: string;
  nama_lengkap: string;
  kelas: "teknik" | "nonteknik" | "keduanya";
  sub_kelas?: string;
  role: "user" | "admin";
  status: "pending" | "active" | "rejected" | "suspended";
  created_at: string;
  last_login: string | null;
  qr_secret: string;
  login_attempts: number;
  locked_until: string | null;
}

export interface AbsensiRecord {
  date: string;
  status: string;
  type?: string;
  jenis?: string;
  keterangan?: string;
  week: number;
  created_at: string;
  scanned_at?: string;
  scanned_by?: string;
  approved_at?: string;
  rejected_at?: string;
}

export interface AbsensiData {
  userId: string;
  records: AbsensiRecord[];
}

export interface RequestItem {
  id: string;
  type: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  data: any;
  created_at: string;
  admin_notes: string;
  handled_at: string | null;
}

export interface MateriFile {
  id: string;
  name: string;
  folder: string;
  week: number;
  size: number;
  type: string;
  blob?: Blob;
  uploadedAt: string;
}

export interface AppSettings {
  key: string;
  current_week: number;
  total_weeks: number;
  semester: string;
  auto_accept_new_accounts: boolean;
  last_absen_day: string | null;
  last_absen_kelas: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  created_at: string;
}

export interface Appeal {
  id: string;
  request_id: string;
  user_id: string;
  alasan: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  admin_response: string | null;
  handled_at: string | null;
}

export interface Session {
  token: string;
  user_id: string;
  role: string;
  created_at: string;
  expires_at: string;
}

class AppDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init();
    return this.initPromise;
  }

  private _init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        this.db = req.result;
        resolve();
      };
      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("users")) db.createObjectStore("users", { keyPath: "id" });
        if (!db.objectStoreNames.contains("absensi")) db.createObjectStore("absensi", { keyPath: "userId" });
        if (!db.objectStoreNames.contains("requests")) db.createObjectStore("requests", { keyPath: "id" });
        if (!db.objectStoreNames.contains("materi")) db.createObjectStore("materi", { keyPath: "id" });
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
        if (!db.objectStoreNames.contains("notifications")) {
          const store = db.createObjectStore("notifications", { keyPath: "id" });
          store.createIndex("user_id", "user_id", { unique: false });
        }
        if (!db.objectStoreNames.contains("appeals")) db.createObjectStore("appeals", { keyPath: "id" });
        if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions", { keyPath: "token" });
      };
    });
  }

  private store(name: string, mode: IDBTransactionMode = "readonly"): IDBObjectStore {
    if (!this.db) throw new Error("DB not initialized");
    return this.db.transaction(name, mode).objectStore(name);
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const req = this.store(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  private async getOne<T>(storeName: string, key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const req = this.store(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  private async putOne<T>(storeName: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = this.store(storeName, "readwrite").put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private async deleteOne(storeName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = this.store(storeName, "readwrite").delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ========== USERS ==========
  async getUserById(id: string): Promise<User | null> {
    return this.getOne("users", id);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const users = await this.getAll<User>("users");
    return users.find((u) => u.username === username) || null;
  }

  async createUser(data: { username: string; password: string; nama_lengkap: string; kelas: string; sub_kelas?: string }): Promise<User> {
    const id = generateId("usr");
    const user: User = {
      id,
      username: data.username,
      password_hash: await hashPassword(data.password),
      nama_lengkap: data.nama_lengkap,
      kelas: data.kelas as any,
      sub_kelas: data.sub_kelas,
      role: "user",
      status: "pending",
      created_at: new Date().toISOString(),
      last_login: null,
      qr_secret: generateId("qr"),
      login_attempts: 0,
      locked_until: null,
    };
    await this.putOne("users", user);
    await this.putOne("absensi", { userId: id, records: [] });
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    const user = await this.getUserById(id);
    if (!user) throw new Error("User not found");
    await this.putOne("users", { ...user, ...updates });
  }

  async getAllUsers(): Promise<User[]> {
    return this.getAll<User>("users");
  }

  // ========== ADMINS ==========
  async ensureDefaultAdmin(): Promise<void> {
    const users = await this.getAllUsers();
    const hasAdmin = users.some((u) => u.role === "admin");
    if (!hasAdmin) {
      const admin: User = {
        id: "admin_001",
        username: "admin",
        password_hash: await hashPassword("admin123"),
        nama_lengkap: "Administrator",
        kelas: "nonteknik",
        role: "admin",
        status: "active",
        created_at: new Date().toISOString(),
        last_login: null,
        qr_secret: generateId("qr"),
        login_attempts: 0,
        locked_until: null,
      };
      await this.putOne("users", admin);
    }
  }

  // ========== ABSENSI ==========
  async getAbsensi(userId: string): Promise<AbsensiData> {
    const data = await this.getOne<AbsensiData>("absensi", userId);
    return data || { userId, records: [] };
  }

  async addAbsensiRecord(userId: string, record: Omit<AbsensiRecord, "created_at">): Promise<void> {
    const data = await this.getAbsensi(userId);
    data.records.push({ ...record, created_at: new Date().toISOString() } as AbsensiRecord);
    await this.putOne("absensi", data);
  }

  async saveAbsensi(absen: AbsensiData): Promise<void> {
    await this.putOne("absensi", absen);
  }

  // ========== REQUESTS ==========
  async getRequests(): Promise<RequestItem[]> {
    return this.getAll("requests");
  }

  async getRequest(id: string): Promise<RequestItem | null> {
    return this.getOne("requests", id);
  }

  async createRequest(item: Omit<RequestItem, "id" | "created_at">): Promise<RequestItem> {
    const id = generateId("req");
    const req = { ...item, id, created_at: new Date().toISOString() };
    await this.putOne("requests", req);
    return req as RequestItem;
  }

  async updateRequest(id: string, updates: Partial<RequestItem>): Promise<void> {
    const req = await this.getRequest(id);
    if (!req) throw new Error("Request not found");
    await this.putOne("requests", { ...req, ...updates });
  }

  // ========== NOTIFICATIONS ==========
  async getNotifications(userId: string): Promise<Notification[]> {
    const all = await this.getAll<Notification>("notifications");
    return all.filter((n) => n.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async addNotification(userId: string, title: string, message: string, notifType: Notification["type"] = "info"): Promise<void> {
    const notif: Notification = {
      id: generateId("notif"),
      user_id: userId,
      title,
      message,
      type: notifType,
      read: false,
      created_at: new Date().toISOString(),
    };
    await this.putOne("notifications", notif);
    const userNotifs = await this.getNotifications(userId);
    if (userNotifs.length > 50) {
      for (const n of userNotifs.slice(50)) {
        await this.deleteOne("notifications", n.id);
      }
    }
  }

  async markNotificationRead(id: string): Promise<void> {
    const n = await this.getOne<Notification>("notifications", id);
    if (n) await this.putOne("notifications", { ...n, read: true });
  }

  // ========== APPEALS ==========
  async getAppeals(): Promise<Appeal[]> {
    return this.getAll("appeals");
  }

  async getUserAppeals(userId: string): Promise<Appeal[]> {
    const all = await this.getAll<Appeal>("appeals");
    return all.filter((a) => a.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async createAppeal(data: Omit<Appeal, "id">): Promise<Appeal> {
    const id = generateId("apl");
    const appeal = { ...data, id };
    await this.putOne("appeals", appeal);
    return appeal as Appeal;
  }

  async updateAppeal(id: string, updates: Partial<Appeal>): Promise<void> {
    const a = await this.getOne<Appeal>("appeals", id);
    if (!a) throw new Error("Appeal not found");
    await this.putOne("appeals", { ...a, ...updates });
  }

  // ========== SESSIONS ==========
  async createSession(userId: string, role: string): Promise<Session> {
    const token = generateId("tkn");
    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const session: Session = {
      token,
      user_id: userId,
      role,
      created_at: now.toISOString(),
      expires_at: expires.toISOString(),
    };
    await this.putOne("sessions", session);
    return session;
  }

  async getSession(token: string): Promise<Session | null> {
    const s = await this.getOne<Session>("sessions", token);
    if (!s) return null;
    if (new Date() > new Date(s.expires_at)) {
      await this.deleteOne("sessions", token);
      return null;
    }
    return s;
  }

  async deleteSession(token: string): Promise<void> {
    await this.deleteOne("sessions", token);
  }

  // ========== SETTINGS ==========
  async getSettings(): Promise<AppSettings> {
    const s = await this.getOne<AppSettings>("settings", "app");
    if (s) return s;
    const defaults: AppSettings = {
      key: "app",
      current_week: 1,
      total_weeks: 16,
      semester: "Ganjil 2026",
      auto_accept_new_accounts: false,
      last_absen_day: null,
      last_absen_kelas: null,
    };
    await this.putOne("settings", defaults);
    return defaults;
  }

  async updateSettings(updates: Partial<AppSettings>): Promise<void> {
    const s = await this.getSettings();
    await this.putOne("settings", { ...s, ...updates });
  }

  // ========== MATERI / FILE EXPLORER ==========
  async getMateriList(): Promise<MateriFile[]> {
    const all = await this.getAll<MateriFile>("materi");
    return all.sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));
  }

  async getMateriFolders(): Promise<string[]> {
    const all = await this.getMateriList();
    const folders = new Set(all.map((m) => m.folder || "Root"));
    return Array.from(folders).sort();
  }

  async addMateri(file: File, folder: string): Promise<MateriFile> {
    const id = generateId("mat");
    const weekMatch = folder.match(/week(\d+)/i);
    const week = weekMatch ? parseInt(weekMatch[1]) : 1;
    const materi: MateriFile = {
      id,
      name: file.name,
      folder: folder || "Root",
      week,
      size: file.size,
      type: file.type || "application/octet-stream",
      blob: file,
      uploadedAt: new Date().toISOString(),
    };
    await this.putOne("materi", materi);
    return materi;
  }

  async getMateriBlob(id: string): Promise<Blob | null> {
    const m = await this.getOne<MateriFile>("materi", id);
    return m?.blob || null;
  }

  async deleteMateri(id: string): Promise<void> {
    await this.deleteOne("materi", id);
  }

  async renameMateri(id: string, newName: string): Promise<void> {
    const m = await this.getOne<MateriFile>("materi", id);
    if (!m) throw new Error("File not found");
    await this.putOne("materi", { ...m, name: newName });
  }

  async moveMateri(id: string, newFolder: string): Promise<void> {
    const m = await this.getOne<MateriFile>("materi", id);
    if (!m) throw new Error("File not found");
    const weekMatch = newFolder.match(/week(\d+)/i);
    const week = weekMatch ? parseInt(weekMatch[1]) : m.week;
    await this.putOne("materi", { ...m, folder: newFolder, week });
  }

  // ========== EXPORT / IMPORT ==========
  async exportDatabase(): Promise<Record<string, any[]>> {
    const users = await this.getAllUsers();
    const absensi = await this.getAll<AbsensiData>("absensi");
    const requests = await this.getAll<RequestItem>("requests");
    const notifications = await this.getAll<Notification>("notifications");
    const appeals = await this.getAll<Appeal>("appeals");
    const settings = await this.getSettings();
    const materiMeta = (await this.getMateriList()).map(({ blob, ...rest }) => rest);
    return { users, absensi, requests, notifications, appeals, settings: [settings], materi: materiMeta };
  }

  async importDatabase(data: Record<string, any[]>): Promise<void> {
    const stores = ["users", "absensi", "requests", "notifications", "appeals", "materi"];
    for (const store of stores) {
      const all = await this.getAll<any>(store);
      for (const item of all) {
        const key = store === "absensi" ? item.userId : item.id;
        if (key) await this.deleteOne(store, key);
      }
    }
    if (data.users) for (const u of data.users) await this.putOne("users", u);
    if (data.absensi) for (const a of data.absensi) await this.putOne("absensi", a);
    if (data.requests) for (const r of data.requests) await this.putOne("requests", r);
    if (data.notifications) for (const n of data.notifications) await this.putOne("notifications", n);
    if (data.appeals) for (const a of data.appeals) await this.putOne("appeals", a);
    if (data.settings?.[0]) await this.putOne("settings", data.settings[0]);
  }

  async resetDatabase(): Promise<void> {
    const stores = ["users", "absensi", "requests", "materi", "settings", "notifications", "appeals", "sessions"];
    for (const store of stores) {
      const all = await this.getAll<any>(store);
      for (const item of all) {
        const key = store === "settings" ? item.key : store === "absensi" ? item.userId : item.id || item.token;
        if (key) await this.deleteOne(store, key);
      }
    }
    await this.ensureDefaultAdmin();
    await this.getSettings();
  }
}

export const db = new AppDB();
