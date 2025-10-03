"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type ProfileEditModalProps = {
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
};

export function ProfileEditModal({ open, onClose, onUpdated }: ProfileEditModalProps) {
  const supabase = getSupabaseBrowserClient();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [colorSettings, setColorSettings] = useState("");
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);

  // dialog open/close handling
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
    const handleClose = () => onClose();
    dialog.addEventListener("mousedown", handleBackdropClick);
    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("mousedown", handleBackdropClick);
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleClose);
    };
  }, [onClose]);

  // Load current profile and departments when opening
  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [{ data: deps }, { data: prof } ] = await Promise.all([
        supabase.from("departments").select("id,name").order("name", { ascending: true }),
        supabase
          .from("profiles")
          .select("id, display_name, department_id, color_settings")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      if (deps) {
        const list = deps as Array<{ id: string; name: string }>;
        setDepartments(list);
        // 後続の departmentId 初期化で使用するため保持
      }
      const p = prof as any | null;
      const currentDept = p?.department_id as string | undefined;
      setDisplayName(p?.display_name ?? "");
      setColorSettings(p?.color_settings ?? "");
      // departmentId が未設定の場合は部門リストの先頭を使う
      setDepartmentId(currentDept && currentDept !== "" ? currentDept : ((deps as any)?.[0]?.id ?? ""));
    };
    if (open) {
      setMessage(null);
      setLoading(false);
      load();
    }
  }, [open, supabase]);

  const handleSave = async () => {
    if (!userId) return;
    setLoading(true);
    setMessage(null);
    if (!displayName || !departmentId) {
      setLoading(false);
      setMessage("表示名と部署を入力してください");
      return;
    }
    // 行が存在しないケースも考慮して upsert を使用
    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        display_name: displayName,
        department_id: departmentId,
        color_settings: colorSettings,
      },
      { onConflict: "id" }
    );
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    onUpdated?.();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="fixed left-1/2 top-1/2 max-h-[80vh] w-[min(520px,90vw)] -translate-x-1/2 -translate-y-1/2 transform overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/60"
    >
      <form method="dialog" className="flex max-h-[80vh] flex-col" onSubmit={(e) => e.preventDefault()}>
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold">ユーザー情報の編集</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
            aria-label="モーダルを閉じる"
          >
            閉じる
          </button>
        </header>
        <div className="space-y-3 overflow-y-auto px-6 py-6 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-slate-700">表示名</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="お名前を入力"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-slate-700">部署</span>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-slate-700">カラー設定（任意）</span>
            <input
              type="text"
              value={colorSettings}
              onChange={(e) => setColorSettings(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="#64748b など"
            />
          </label>
          {message && <div className="text-sm text-rose-600">{message}</div>}
        </div>
        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleSave}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "保存中..." : "保存する"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
