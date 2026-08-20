"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { db } from "./db";

interface AuthUser {
  id: string;
  username: string;
  nama_lengkap: string;
  kelas: string;
  sub_kelas?: string;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  role: string | null;
  login: (token: string, user: AuthUser, role: string) => void;
  logout: () => void;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    db.init().then(() => {
      db.ensureDefaultAdmin().then(() => {
        const storedToken = localStorage.getItem("absensi_token");
        const storedUser = localStorage.getItem("absensi_user");
        const storedRole = localStorage.getItem("absensi_role");
        if (storedToken && storedUser && storedRole) {
          db.getSession(storedToken).then((session) => {
            if (session) {
              setToken(storedToken);
              setUser(JSON.parse(storedUser));
              setRole(storedRole);
            } else {
              localStorage.removeItem("absensi_token");
              localStorage.removeItem("absensi_user");
              localStorage.removeItem("absensi_role");
            }
            setIsLoading(false);
          });
        } else {
          setIsLoading(false);
        }
      });
    });
  }, []);

  const login = (newToken: string, newUser: AuthUser, newRole: string) => {
    localStorage.setItem("absensi_token", newToken);
    localStorage.setItem("absensi_user", JSON.stringify(newUser));
    localStorage.setItem("absensi_role", newRole);
    setToken(newToken);
    setUser(newUser);
    setRole(newRole);
  };

  const logout = () => {
    if (token) db.deleteSession(token);
    localStorage.removeItem("absensi_token");
    localStorage.removeItem("absensi_user");
    localStorage.removeItem("absensi_role");
    setToken(null);
    setUser(null);
    setRole(null);
    router.push("/");
  };

  const refreshUser = async () => {
    if (!user) return;
    const u = await db.getUserById(user.id);
    if (u) {
      const authUser: AuthUser = {
        id: u.id,
        username: u.username,
        nama_lengkap: u.nama_lengkap,
        kelas: u.kelas,
        sub_kelas: u.sub_kelas,
        role: u.role,
      };
      setUser(authUser);
      localStorage.setItem("absensi_user", JSON.stringify(authUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, role, login, logout, isLoading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

