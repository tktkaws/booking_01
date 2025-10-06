"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AuthModal } from "./AuthModal";
import { ProfileEditModal } from "./ProfileEditModal";

export function AuthButton() {
  const supabase = getSupabaseBrowserClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [depId, setDepId] = useState<string | null>(null);
  const [depName, setDepName] = useState<string | null>(null);
  const [depColor, setDepColor] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  // text color for contrast against background
  const getTextColor = (hex: string): string => {
    try {
      const h = hex.replace('#','');
      const r = parseInt(h.substring(0,2),16);
      const g = parseInt(h.substring(2,4),16);
      const b = parseInt(h.substring(4,6),16);
      const toLin = (v:number) => {
        const s = v/255;
        return s <= 0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055,2.4);
      };
      const L = 0.2126*toLin(r) + 0.7152*toLin(g) + 0.0722*toLin(b);
      return L < 0.5 ? '#ffffff' : '#1f2937';
    } catch {
      return '#1f2937';
    }
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      setEmail(session?.user?.email ?? null);
      setUserId(uid);
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles_public")
          .select("id, display_name, department_id, department_name, color_settings")
          .eq("id", uid)
          .maybeSingle();
        const p = prof as any;
        setDisplayName(p?.display_name ?? null);
        const dId = p?.department_id ?? null;
        setDepId(dId);
        setDepName(p?.department_name ?? null);
        // compute color: user override or department default
        let color: string | null = null;
        if (dId && p?.color_settings && typeof p.color_settings === 'object') {
          const override = p.color_settings[dId];
          if (override && typeof override === 'string') color = override;
        }
        if (!color && dId) {
          const { data: dep } = await supabase
            .from("departments")
            .select("default_color")
            .eq("id", dId)
            .maybeSingle();
          color = (dep as any)?.default_color ?? null;
        }
        setDepColor(color);
      } else {
        setDisplayName(null);
        setDepId(null);
        setDepName(null);
        setDepColor(null);
      }
    };
    const refresh = () => init();
    init();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setEmail(session?.user?.email ?? null);
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles_public")
          .select("id, display_name, department_id, department_name, color_settings")
          .eq("id", uid)
          .maybeSingle();
        const p = prof as any;
        setDisplayName(p?.display_name ?? null);
        const dId = p?.department_id ?? null;
        setDepId(dId);
        setDepName(p?.department_name ?? null);
        let color: string | null = null;
        if (dId && p?.color_settings && typeof p.color_settings === 'object') {
          const override = p.color_settings[dId];
          if (override && typeof override === 'string') color = override;
        }
        if (!color && dId) {
          const { data: dep } = await supabase
            .from("departments")
            .select("default_color")
            .eq("id", dId)
            .maybeSingle();
          color = (dep as any)?.default_color ?? null;
        }
        setDepColor(color);
      } else {
        setDisplayName(null);
        setDepId(null);
        setDepName(null);
        setDepColor(null);
      }
    });
    window.addEventListener('profiles:changed', refresh);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener('profiles:changed', refresh);
    };
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (email) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          title={email ?? undefined}
        >
          <span className="truncate max-w-[12rem]">{displayName ?? email}</span>
          {depName && (
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 font-semibold"
              style={{ backgroundColor: depColor ?? '#64748b', color: getTextColor(depColor ?? '#64748b') }}
            >
              {depName}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:border-slate-400"
        >
          ログアウト
        </button>
        <ProfileEditModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          onUpdated={async () => {
            if (userId) {
              const { data: prof } = await supabase
                .from("profiles_public")
                .select("id, display_name, department_id, department_name, color_settings")
                .eq("id", userId)
                .maybeSingle();
              const p = prof as any;
              setDisplayName(p?.display_name ?? displayName);
              setDepId(p?.department_id ?? null);
              setDepName(p?.department_name ?? null);
              let color: string | null = null;
              const dId = p?.department_id ?? null;
              if (dId && p?.color_settings && typeof p.color_settings === 'object') {
                const override = p.color_settings[dId];
                if (override && typeof override === 'string') color = override;
              }
              if (!color && dId) {
                const { data: dep } = await supabase
                  .from("departments")
                  .select("default_color")
                  .eq("id", dId)
                  .maybeSingle();
                color = (dep as any)?.default_color ?? null;
              }
              setDepColor(color);
            }
          }}
        />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm"
      >
        ログイン
      </button>
      <AuthModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
