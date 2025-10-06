"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export type AdminUserRow = {
  id: string;
  display_name: string;
  department_id: string;
  department_name?: string;
  is_admin: boolean;
  deleted_at: string | null;
};

type DepartmentOption = { id: string; name: string };

type UserEditModalProps = {
  open: boolean;
  user: AdminUserRow | null;
  departments: DepartmentOption[];
  onClose: () => void;
  onSaved?: () => void;
};

export function UserEditModal({ open, user, departments, onClose, onSaved }: UserEditModalProps) {
  const supabase = getSupabaseBrowserClient();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [deletedAt, setDeletedAt] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && user) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close("dismiss");
    }
  }, [open, user]);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.display_name);
    setDepartmentId(user.department_id);
    setIsAdmin(Boolean(user.is_admin));
    setDeletedAt(user.deleted_at);
  }, [user]);

  const deptOptions = useMemo(() => departments, [departments]);

  const handleSave = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        department_id: departmentId,
        is_admin: isAdmin,
      })
      .eq("id", user.id);
    if (error) {
      alert(`保存に失敗しました: ${error.message}`);
      return;
    }
    window.dispatchEvent(new CustomEvent("users:changed"));
    onSaved?.();
    onClose();
  };

  const handleDelete = async () => {
    if (!user) return;
    if (!confirm("このユーザーを削除（ソフトデリート）しますか？")) return;
    const { error } = await supabase
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) {
      alert(`削除に失敗しました: ${error.message}`);
      return;
    }
    window.dispatchEvent(new CustomEvent("users:changed"));
    onSaved?.();
    onClose();
  };

  const handleRestore = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ deleted_at: null })
      .eq("id", user.id);
    if (error) {
      alert(`復元に失敗しました: ${error.message}`);
      return;
    }
    window.dispatchEvent(new CustomEvent("users:changed"));
    onSaved?.();
    onClose();
  };

  if (!user) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed left-1/2 top-1/2 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/60"
    >
      <div className="flex flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold">ユーザー編集</h3>
          <button
            type="button"
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
            onClick={onClose}
          >
            閉じる
          </button>
        </header>
        <div className="space-y-4 px-6 py-5">
          <label className="block text-sm font-semibold text-slate-700">
            表示名
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            部署
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {deptOptions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="size-4 rounded border-slate-300 text-blue-600"
            />
            管理者権限
          </label>
          {deletedAt && (
            <p className="text-xs text-rose-600">このユーザーは削除済みです（{new Date(deletedAt).toLocaleString()}）</p>
          )}
        </div>
        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          {deletedAt ? (
            <button
              type="button"
              onClick={handleRestore}
              className="rounded border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              復元
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDelete}
              className="rounded border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
            >
              削除
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            保存
          </button>
        </footer>
      </div>
    </dialog>
  );
}

