"use client";

import { cn } from "@/lib/utils";

export type AdminUserRow = {
  id: string;
  display_name: string;
  department_id: string;
  department_name?: string;
  is_admin: boolean;
  deleted_at: string | null;
};

type UsersListProps = {
  users: AdminUserRow[];
  onUserClick: (user: AdminUserRow) => void;
};

export function UsersList({ users, onUserClick }: UsersListProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-lg font-semibold text-slate-800">ユーザー一覧</h2>
        <div className="text-xs text-slate-500">{users.length} 件</div>
      </div>
      <div className="grid grid-cols-1 divide-y divide-slate-200">
        {users.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => onUserClick(u)}
            className={cn(
              "flex items-center justify-between gap-3 px-3 py-3 text-left transition",
              "hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            )}
            aria-label={`${u.display_name} を編集`}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">
                {u.display_name}
                {u.is_admin && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">管理者</span>
                )}
                {u.deleted_at && (
                  <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">削除済み</span>
                )}
              </div>
              <div className="truncate text-xs text-slate-500">
                {u.department_name ?? u.department_id}
              </div>
            </div>
            <div className="text-xs text-slate-400">編集</div>
          </button>
        ))}
      </div>
    </div>
  );
}

