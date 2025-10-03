"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  onSignedIn?: () => void;
};

export function AuthModal({ open, onClose, onSignedIn }: AuthModalProps) {
  const supabase = getSupabaseBrowserClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setPassword("");
      setMessage(null);
      setMode("login");
      setDisplayName("");
      setDepartmentId("");
      setDepartments([]);
    }
  }, [open]);

  // サインアップ時に部署一覧を取得
  useEffect(() => {
    const loadDepartments = async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id,name")
        .order("name", { ascending: true });
      if (!error && data) {
        setDepartments(data as Array<{ id: string; name: string }>);
        if (!departmentId && data.length > 0) {
          setDepartmentId(data[0].id as string);
        }
      }
    };
    if (open && mode === "signup") {
      loadDepartments();
    }
  }, [open, mode, supabase, departmentId]);

  // dialog の開閉と共通の閉じ方（Backdrop/ESC/Close）
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close("dismiss");
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleBackdropClick = (event: MouseEvent) => {
      const rect = dialog.getBoundingClientRect();
      const inDialog =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!inDialog) {
        event.preventDefault();
        onClose();
      }
    };
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    const handleClose = () => {
      onClose();
    };
    dialog.addEventListener("mousedown", handleBackdropClick);
    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("mousedown", handleBackdropClick);
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleClose);
    };
  }, [onClose]);

  const handleLogin = async () => {
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    onClose();
    onSignedIn?.();
  };

  const handleSignup = async () => {
    setLoading(true);
    setMessage(null);
    if (!displayName || !departmentId) {
      setLoading(false);
      setMessage("名前と部署を入力してください");
      return;
    }
    const { error, data } = await supabase.auth.signUp({ email, password });
    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }
    // セッションが無い場合は即ログインを試みる（Auto Confirm OFF 環境向けフォールバック）
    let userId = data.user?.id ?? null;
    let session = data.session ?? null;
    if (!session) {
      const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
      session = signInData.session ?? null;
      userId = signInData.user?.id ?? userId;
    }
    // プロファイル作成（RLS: 自分の行のみ INSERT 可のポリシーが必要）
    try {
      if (userId && session) {
        const { error: upsertError } = await supabase.from("profiles").upsert(
          {
            id: userId,
            display_name: displayName,
            department_id: departmentId,
            color_settings: "",
          },
          { onConflict: "id" }
        );
        if (upsertError) {
          console.warn("profiles upsert failed", upsertError.message);
        }
      }
    } catch (e) {
      console.warn("profiles upsert exception", e);
    }
    setLoading(false);
    if (session) {
      onClose();
      onSignedIn?.();
    } else {
      setMessage("サインアップしました。ログインしてください。");
      setMode("login");
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="fixed left-1/2 top-1/2 max-h-[80vh] w-[min(520px,90vw)] -translate-x-1/2 -translate-y-1/2 transform overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/60"
    >
      <form method="dialog" className="flex max-h-[80vh] flex-col" onSubmit={(e) => e.preventDefault()}>
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold">
            {mode === "login" ? "ログイン" : "サインアップ"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
            aria-label="モーダルを閉じる"
          >
            閉じる
          </button>
        </header>
        <div className="overflow-y-auto px-6 py-6">
          <div className="mb-3 text-sm text-slate-600">Email とパスワードのみ（確認メールは送信しません）。</div>
          <div className="space-y-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            {mode === "signup" && (
              <>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="お名前（表示名）"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
          {message && (
            <div className="mt-3 text-sm text-rose-600">{message}</div>
          )}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            disabled={loading}
            onClick={mode === "login" ? handleLogin : handleSignup}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "処理中..." : mode === "login" ? "ログイン" : "サインアップ"}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-sm text-blue-600 hover:underline"
          >
            {mode === "login" ? "サインアップに切り替え" : "ログインに切り替え"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
