"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { X } from 'lucide-react';

export type AdminUserRow = {
  id: string;
  display_name: string;
  department_id: string;
  department_name?: string;
  is_admin: boolean;
  deleted_at: string | null;
};

type DepartmentOption = { id: string; name: string; default_color?: string };

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
  const [colorsByDept, setColorsByDept] = useState<Record<string, string>>({});

  const normalizeHex = (input: string): string | null => {
    const v = input.trim().replace(/^#?/, "").toLowerCase();
    if (/^[0-9a-f]{6}$/.test(v)) return `#${v}`;
    return null;
  };

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
    // fetch current color_settings for this user
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("color_settings")
        .eq("id", user.id)
        .maybeSingle();
      const raw = (data as any)?.color_settings ?? {};
      if (raw && typeof raw === 'object') {
        setColorsByDept(raw as Record<string, string>);
      } else {
        setColorsByDept({});
      }
    })();
  }, [user]);

  // no selectedDeptId needed; show all departments at once

  const deptOptions = useMemo(() => departments, [departments]);

  const handleSave = async () => {
    if (!user) return;
    // keep only valid hex values
    const filtered: Record<string, string> = {};
    Object.entries(colorsByDept).forEach(([k, v]) => {
      const n = normalizeHex(v || "");
      if (n) filtered[k] = n;
    });
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        department_id: departmentId,
        is_admin: isAdmin,
        color_settings: filtered,
      })
      .eq("id", user.id);
    if (error) {
      alert(`保存に失敗しました: ${error.message}`);
      return;
    }
    window.dispatchEvent(new CustomEvent("profiles:changed"));
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
    window.dispatchEvent(new CustomEvent("profiles:changed"));
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
    window.dispatchEvent(new CustomEvent("profiles:changed"));
    window.dispatchEvent(new CustomEvent("users:changed"));
    onSaved?.();
    onClose();
  };

  if (!user) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed left-1/2 top-1/2 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-800/60"
    >
      <div className="flex flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold">ユーザー編集</h3>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white p-2 text-slate-600 hover:ring-2 hover:bg-slate-50"
            onClick={onClose}
          >
            <X className="size-4" aria-hidden="true" />
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
        <div className="space-y-3 border-t border-slate-200 px-6 py-5">
          <div className="text-sm font-semibold text-slate-700">部署ごとのカラー設定</div>
          <div className="space-y-4">
            {deptOptions.map((d) => {
              const val = colorsByDept[d.id] ?? "";
              const normalized = normalizeHex(val ?? "") ?? "";
              return (
                <div key={d.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="grid grid-cols-[140px_auto_auto] items-center gap-3">
                    <div className="text-sm font-semibold text-slate-700">{d.name}</div>
                    <input
                      type="color"
                      value={normalized || d.default_color || "#64748b"}
                      onChange={(e) => {
                        const v = e.target.value;
                        setColorsByDept((prev) => ({ ...prev, [d.id]: v }));
                      }}
                      className="h-9 w-12 cursor-pointer rounded border border-slate-300"
                      aria-label={`${d.name} のカラーを選択`}
                    />
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => {
                        setColorsByDept((prev) => ({ ...prev, [d.id]: e.target.value }));
                      }}
                      onBlur={(e) => {
                        const n = normalizeHex(e.target.value);
                        if (n) setColorsByDept((prev) => ({ ...prev, [d.id]: n }));
                      }}
                      placeholder={d.default_color || "#64748b"}
                      className="w-44 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span
                      className="inline-flex h-6 w-6 rounded-full border border-slate-300"
                      style={{ backgroundColor: normalized || d.default_color || "#64748b" }}
                    />
                    {d.default_color && (
                      <div className="text-xs text-slate-500">部署デフォルト: {d.default_color}</div>
                    )}
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setColorsByDept((prev) => {
                          const next = { ...prev };
                          delete next[d.id];
                          return next;
                        });
                      }}
                      className="rounded border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-white"
                    >
                      デフォルトに戻す
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
