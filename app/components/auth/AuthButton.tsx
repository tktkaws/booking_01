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
  const [profileOpen, setProfileOpen] = useState(false);

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
          .select("id, display_name")
          .eq("id", uid)
          .maybeSingle();
        setDisplayName((prof as any)?.display_name ?? null);
      } else {
        setDisplayName(null);
      }
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setEmail(session?.user?.email ?? null);
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles_public")
          .select("id, display_name")
          .eq("id", uid)
          .maybeSingle();
        setDisplayName((prof as any)?.display_name ?? null);
      } else {
        setDisplayName(null);
      }
    });
    return () => {
      sub.subscription.unsubscribe();
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
          className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
          title={email ?? undefined}
        >
          {displayName ?? email}
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
                .select("id, display_name")
                .eq("id", userId)
                .maybeSingle();
              setDisplayName((prof as any)?.display_name ?? displayName);
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
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        ログイン
      </button>
      <AuthModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
