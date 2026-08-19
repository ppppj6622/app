"use client";

const SECRET_KEY = "absensi-secret-key-2026-kelas-teknik-jangan-dibagikan";

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(derived));
  const saltArray = Array.from(salt);
  return `pbkdf2:${saltArray.map(b => b.toString(16).padStart(2, "0")).join("")}:${hashArray.map(b => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  if (!hashed.startsWith("pbkdf2:")) return false;
  const [, saltHex, hashHex] = hashed.split(":");
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(derived));
  const newHashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return newHashHex === hashHex;
}

export async function generateQRPayload(userId: string, qrSecret: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const expiry = timestamp + 300;
  const payload = `${userId}:${timestamp}:${qrSecret}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(SECRET_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const sigHex = Array.from(new Uint8Array(sig)).slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
  return {
    user_id: userId,
    timestamp,
    expiry,
    signature: sigHex,
    qr_data: `ABSEN:${userId}:${timestamp}:${sigHex}`,
  };
}

export async function verifyQR(qrData: string, getUserSecret: (id: string) => Promise<string | null>) {
  try {
    const parts = qrData.split(":");
    if (parts.length !== 4 || parts[0] !== "ABSEN") return { valid: false, reason: "Format QR tidak valid" };
    const [, userId, timestamp, signature] = parts;
    const secret = await getUserSecret(userId);
    if (!secret) return { valid: false, reason: "User tidak ditemukan" };
    const now = Math.floor(Date.now() / 1000);
    if (now > parseInt(timestamp) + 300) return { valid: false, reason: "QR sudah expired" };
    const payload = `${userId}:${timestamp}:${secret}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(SECRET_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const sigHex = Array.from(new Uint8Array(sig)).slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
    if (sigHex !== signature) return { valid: false, reason: "Signature tidak valid" };
    return { valid: true, userId };
  } catch {
    return { valid: false, reason: "Error verifikasi" };
  }
}

export function generateToken(): string {
  const arr = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function generateId(prefix: string): string {
  const arr = crypto.getRandomValues(new Uint8Array(8));
  return `${prefix}_${Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 12)}`;
}
