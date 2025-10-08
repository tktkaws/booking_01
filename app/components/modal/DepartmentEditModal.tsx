"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { type Department } from "@/types/bookings";
import { X } from 'lucide-react';

type DepartmentEditModalProps = {
  open: boolean;
  department: Department | null;
  onClose: () => void;
  onSaved?: () => void;
};

function normalizeHex(input: string): string | null {
  const v = input.trim().replace(/^#?/, "").toLowerCase();
  if (/^[0-9a-f]{6}$/.test(v)) return `#${v}`;
  return null;
}

export function DepartmentEditModal({ open, department, onClose, onSaved }: DepartmentEditModalProps) {
  const supabase = getSupabaseBrowserClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [colorText, setColorText] = useState("#64748b");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close("dismiss");
    }
  }, [open]);

  useEffect(() => {
    if (department) {
      setName(department.name);
      setColorText(department.default_color || "#64748b");
    } else {
      setName("");
      setColorText("#64748b");
    }
  }, [department]);

  const handleColorPicker = (v: string) => {
    // color input yields normalized #rrggbb
    setColorText(v);
  };
  const handleColorText = (v: string) => {
    // allow partial, but keep raw; validate on blur/save
    setColorText(v);
  };

  const isEdit = Boolean(department);

  const handleSave = async () => {
    const hex = normalizeHex(colorText) ?? colorText; // try normalize; color pickerは常にOK
    if (!name.trim()) {
      alert("部署名を入力してください");
      return;
    }
    if (!normalizeHex(hex)) {
      alert("カラーコードは #rrggbb 形式で入力してください");
      return;
    }
    try {
      if (isEdit) {
        const { error } = await supabase
          .from("departments")
          .update({ name: name.trim(), default_color: hex })
          .eq("id", department!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("departments")
          .insert({ name: name.trim(), default_color: hex });
        if (error) throw error;
      }
      window.dispatchEvent(new CustomEvent("departments:changed"));
      onSaved?.();
      onClose();
    } catch (e: any) {
      alert(`保存に失敗しました: ${e?.message ?? e}`);
    }
  };

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed left-1/2 top-1/2 w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-800/60"
    >
      <div className="flex flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold">{isEdit ? "部署を編集" : "部署を作成"}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white p-2 text-slate-600 hover:ring-2 hover:bg-slate-50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>
        <div className="space-y-4 px-6 py-5">
          <label className="block text-sm font-semibold text-slate-700">
            部署名
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="営業部"
            />
          </label>
          <div className="grid grid-cols-[auto_1fr] items-center gap-3">
            <label className="text-sm font-semibold text-slate-700">カラー</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={normalizeHex(colorText) ?? "#64748b"}
                onChange={(e) => handleColorPicker(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-slate-300"
                aria-label="カラーを選択"
              />
              <input
                type="text"
                value={colorText}
                onChange={(e) => handleColorText(e.target.value)}
                onBlur={(e) => {
                  const n = normalizeHex(e.target.value);
                  if (n) setColorText(n);
                }}
                placeholder="#64748b"
                className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <span className="inline-flex h-6 w-6 rounded-full border border-slate-300" style={{ backgroundColor: normalizeHex(colorText) ?? "#64748b" }} />
            </div>
          </div>
        </div>
        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:ring-2"
          >
            キャンセル
          </button>
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
