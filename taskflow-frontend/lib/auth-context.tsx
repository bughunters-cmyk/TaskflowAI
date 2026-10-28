"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { createClient } from "@/lib/supabase";
import { User, Session } from "@supabase/supabase-js";
import { apiFetch } from "@/lib/api";

interface Firm {
  id: string;
  name: string;
  slug: string;
  invite_code: string | null;
  role: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  firms: Firm[];
  currentFirm: Firm | null;
  setCurrentFirm: (firm: Firm | null) => void;
  refreshFirms: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [firmsLoaded, setFirmsLoaded] = useState(false);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [currentFirm, setCurrentFirmState] = useState<Firm | null>(null);

  const supabase = createClient();

  const refreshFirms = async () => {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch("/api/firms", {}, session.access_token);
      const list: Firm[] = (data.firms || []).map((m: any) => ({
        id: m.firm.id,
        name: m.firm.name,
        slug: m.firm.slug,
        invite_code: m.firm.invite_code ?? null,
        role: m.role,
      }));
      setFirms(list);

      // Restore last selected firm from localStorage
      const savedId = localStorage.getItem("taskflow_current_firm");
      if (savedId) {
        const found = list.find((f) => f.id === savedId);
        if (found) {
          setCurrentFirmState(found);
          return;
        }
      }
      if (list.length > 0) {
        setCurrentFirmState(list[0]);
        localStorage.setItem("taskflow_current_firm", list[0].id);
      } else {
        setCurrentFirmState(null);
      }
    } catch (e) {
      console.error("Failed to load firms", e);
    }
  };

  const setCurrentFirm = (firm: Firm | null) => {
    setCurrentFirmState(firm);
    if (firm) {
      localStorage.setItem("taskflow_current_firm", firm.id);
    } else {
      localStorage.removeItem("taskflow_current_firm");
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setSessionLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setSessionLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.access_token) {
      refreshFirms().finally(() => setFirmsLoaded(true));
    } else {
      setFirms([]);
      setCurrentFirmState(null);
      setFirmsLoaded(false);
    }
  }, [session?.access_token]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setCurrentFirm(null);
    localStorage.removeItem("taskflow_current_firm");
  };

  // "loading" stays true until the session is known AND (if signed in) the
  // firm list has been fetched, so the onboarding screen never flashes.
  const loading = sessionLoading || (!!session && !firmsLoaded);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        firms,
        currentFirm,
        setCurrentFirm,
        refreshFirms,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
