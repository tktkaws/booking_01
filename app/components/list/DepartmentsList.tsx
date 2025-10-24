"use client";

import { type Department } from "@/types/bookings";

type DepartmentsListProps = {
  departments: Department[];
  onCreate: () => void;
  onEdit: (dept: Department) => void;
};

export function DepartmentsList({ departments, onCreate, onEdit }: DepartmentsListProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">部署一覧</h2>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-md bg-blue-600 px-3 h-9 grid items-center text-sm font-semibold text-white hover:bg-blue-700"
        >
          新規作成
        </button>
      </div>
      <div className="grid grid-cols-1 divide-y divide-slate-200">
        {departments.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onEdit(d)}
            className="flex items-center justify-between gap-3 px-3 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-4 w-4 rounded-full border border-slate-300" style={{ backgroundColor: d.default_color }} />
              <span className="text-sm font-medium text-slate-800">{d.name}</span>
            </div>
            <span className="text-xs text-slate-800">編集</span>
          </button>
        ))}
        {departments.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-slate-800">部署がありません</div>
        )}
      </div>
    </div>
  );
}

