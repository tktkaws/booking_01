"use client";

import { useEffect, useMemo, useState } from "react";

import { MonthView } from "@/components/calendar/MonthView";
import { WeekView } from "@/components/calendar/WeekView";
import { ListView } from "@/components/list/ListView";
import { CreateBookingModal } from "@/components/modal/CreateBookingModal";
import { ReservationDetailModal } from "@/components/modal/ReservationDetailModal";
import { UsersList, type AdminUserRow } from "@/components/list/UsersList";
import { DepartmentsList } from "@/components/list/DepartmentsList";
import { DepartmentEditModal } from "@/components/modal/DepartmentEditModal";
import { UserEditModal } from "@/components/modal/UserEditModal";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AuthButton } from "@/components/auth/AuthButton";
// Supabase から profiles/departments を取得して表示用に利用
import {
  addDays,
  addMonths,
  monthDayFormatter,
  monthFormatter,
  parseDateOnly,
  parseIso,
  startOfWeek,
  toDateKey,
  stripTime,
  WORKING_DAY_COUNT,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";
import {
  type Booking,
  type BookingsByDate,
  type Department,
  type ParsedBooking,
  type User,
  type ViewType,
} from "@/types/bookings";

const BASE_VIEW_OPTIONS: ReadonlyArray<{ key: ViewType; label: string }> = [
  { key: "month", label: "月" },
  { key: "week", label: "週" },
  { key: "list", label: "リスト" },
];

export default function Home() {
  const [depMap, setDepMap] = useState<Map<string, Department>>(new Map());
  const [profileMap, setProfileMap] = useState<Map<string, { display_name: string; department_id: string; department_name?: string; color_settings?: Record<string, string> }>>(new Map());
  const [departmentNames, setDepartmentNames] = useState<string[]>([]);

  const getTextColor = (hex: string): string => {
    const h = hex.replace('#','');
    const r = parseInt(h.substring(0,2),16);
    const g = parseInt(h.substring(2,4),16);
    const b = parseInt(h.substring(4,6),16);
    // relative luminance
    const srgb = [r,g,b].map(v => {
      const s = v/255;
      return s <= 0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055,2.4);
    });
    const L = 0.2126*srgb[0] + 0.7152*srgb[1] + 0.0722*srgb[2];
    return L < 0.5 ? '#ffffff' : '#1f2937';
  };

  const [rawBookings, setRawBookings] = useState<Booking[]>([]);
  const [isAuthed, setIsAuthed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editTarget, setEditTarget] = useState<ParsedBooking | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userEditing, setUserEditing] = useState<AdminUserRow | null>(null);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [deptEditing, setDeptEditing] = useState<Department | null>(null);

  // Supabase から予約を取得
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    // 認証状態を監視
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setIsAuthed(!!data.session);
      setUserId(uid);
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", uid)
          .maybeSingle();
        setIsAdmin(Boolean((prof as any)?.is_admin));
      } else {
        setIsAdmin(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const uid = session?.user?.id ?? null;
      setIsAuthed(!!session);
      setUserId(uid);
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", uid)
          .maybeSingle();
        setIsAdmin(Boolean((prof as any)?.is_admin));
      } else {
        setIsAdmin(false);
      }
    });

    const toLocalIsoHM = (iso: string) => {
      const d = new Date(iso);
      const y = d.getFullYear();
      const m = `${d.getMonth() + 1}`.padStart(2, "0");
      const da = `${d.getDate()}`.padStart(2, "0");
      const hh = `${d.getHours()}`.padStart(2, "0");
      const mm = `${d.getMinutes()}`.padStart(2, "0");
      return `${y}-${m}-${da}T${hh}:${mm}+00:00`;
    };
    const loadBookings = () => {
      supabase
        .from("bookings")
        .select("id, title, description, start_at, end_at, created_by")
        .order("start_at", { ascending: true })
        .then(({ data, error }) => {
          if (error) {
            console.warn("failed to fetch bookings", error.message);
            return;
          }
          const converted: Booking[] = (data ?? []).map((row: any) => ({
            id: String(row.id),
            title: row.title,
            departmentId: "", // 部署は未使用/不明のため空（色はデフォルト）
            ownerUserId: row.created_by ?? "",
            start: toLocalIsoHM(row.start_at),
            end: toLocalIsoHM(row.end_at),
            isCompanyWide: false,
            description: row.description ?? "",
          }));
          setRawBookings(converted);
        });
    };
    loadBookings();
    const onChanged = () => loadBookings();
    window.addEventListener("bookings:changed", onChanged);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("bookings:changed", onChanged);
    };
  }, []);

  const bookings = useMemo<ParsedBooking[]>(() => {
    return rawBookings.map((booking) => {
      const startMeta = parseIso(booking.start);
      const endMeta = parseIso(booking.end);
      const profile = profileMap.get(booking.ownerUserId);
      const departmentId = profile?.department_id ?? booking.departmentId;
      const dep = departmentId ? depMap.get(departmentId) : undefined;
      const userColor = profile?.color_settings?.[departmentId ?? ""];
      const color = userColor ?? (dep?.default_color ?? '#64748b');
      const textColor = getTextColor(color);
      return {
        ...booking,
        departmentId: departmentId ?? "",
        departmentName: profile?.department_name ?? dep?.name ?? (departmentId ?? ""),
        ownerName: profile?.display_name ?? booking.ownerUserId,
        color,
        textColor,
        startDate: startMeta.date,
        endDate: endMeta.date,
        startDateKey: startMeta.dateKey,
        endDateKey: endMeta.dateKey,
        startMinutes: startMeta.minutes,
        endMinutes: endMeta.minutes,
      } as ParsedBooking;
    });
  }, [depMap, profileMap, rawBookings]);

  const bookingsByDate = useMemo<BookingsByDate>(() => {
    const map = new Map<string, ParsedBooking[]>();
    bookings.forEach((booking) => {
      const list = map.get(booking.startDateKey);
      if (list) {
        list.push(booking);
      } else {
        map.set(booking.startDateKey, [booking]);
      }
    });
    map.forEach((items) => items.sort((a, b) => a.startMinutes - b.startMinutes));
    return map;
  }, [bookings]);

  const sortedBookings = useMemo(() => {
    return [...bookings].sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime()
    );
  }, [bookings]);

  // Supabase から profiles_public / departments を取得
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    // 部署
    const loadDepartments = () => {
      supabase
        .from("departments")
        .select("id,name,default_color")
        .order("name", { ascending: true })
        .then(({ data, error }) => {
          if (error) {
            console.warn("failed to fetch departments", error.message);
            return;
          }
          const m = new Map<string, Department>();
          const names: string[] = [];
          (data ?? []).forEach((d: any) => {
            m.set(String(d.id), { id: String(d.id), name: d.name, default_color: d.default_color });
            names.push(d.name as string);
          });
          setDepMap(m);
          setDepartmentNames(names);
        });
    };
    loadDepartments();
    const onDepsChanged = () => loadDepartments();
    window.addEventListener("departments:changed", onDepsChanged);
    // プロファイル（公開ビュー推奨）
    const loadProfiles = () => {
      supabase
        .from("profiles_public")
        .select("id, display_name, department_id, department_name, color_settings")
        .then(({ data, error }) => {
          if (error) {
            console.warn("failed to fetch profiles_public", error.message);
            return;
          }
          const m = new Map<string, { display_name: string; department_id: string; department_name?: string; color_settings?: Record<string, string> }>();
          (data ?? []).forEach((row: any) => {
            m.set(String(row.id), {
              display_name: row.display_name,
              department_id: row.department_id ?? "",
              department_name: row.department_name ?? undefined,
              color_settings: row.color_settings ?? undefined,
            });
          });
          setProfileMap(m);
        });
    };
    loadProfiles();
    const onProfilesChanged = () => loadProfiles();
    window.addEventListener("profiles:changed", onProfilesChanged);
    // 管理者がユーザー情報を変更した場合にも再読込
    window.addEventListener("users:changed", onProfilesChanged);
    return () => {
      window.removeEventListener("departments:changed", onDepsChanged);
      window.removeEventListener("profiles:changed", onProfilesChanged);
      window.removeEventListener("users:changed", onProfilesChanged);
    };
  }, []);

  // 管理者: ユーザー一覧取得
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!isAdmin) return;
    const loadUsers = () => {
      supabase
        .from("profiles")
        .select("id, display_name, department_id, is_admin, deleted_at")
        .order("display_name", { ascending: true })
        .then(({ data, error }) => {
          if (error) return;
          const rows: AdminUserRow[] = (data ?? []).map((r: any) => ({
            id: String(r.id),
            display_name: r.display_name,
            department_id: String(r.department_id),
            department_name: depMap.get(String(r.department_id))?.name,
            is_admin: Boolean(r.is_admin),
            deleted_at: r.deleted_at,
          }));
          setUsers(rows);
        });
    };
    loadUsers();
    const onChanged = () => loadUsers();
    window.addEventListener("users:changed", onChanged);
    return () => window.removeEventListener("users:changed", onChanged);
  }, [depMap, isAdmin]);

  const VIEW_STORAGE_KEY = "booking_view";
  const [view, setView] = useState<ViewType>("month");

  // マウント時にハッシュ or 保存値からビューを復元
  useEffect(() => {
    try {
      const hash = window.location.hash.replace('#', '');
      if (hash === "month" || hash === "week" || hash === "list") {
        setView(hash as ViewType);
        if (hash === "list") setSelectedDate(null);
        return;
      }
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === "month" || stored === "week" || stored === "list") {
        setView(stored as ViewType);
        if (stored === "list") setSelectedDate(null);
      }
    } catch {}
  }, []);

  // ビュー変更を保存
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {}
  }, [view]);

  // ハッシュ変更を監視してビューを同期
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === "month" || hash === "week" || hash === "list") {
        setView(hash as ViewType);
        if (hash === "list") setSelectedDate(null);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [focusDate, setFocusDate] = useState<Date>(() => stripTime(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<ParsedBooking | null>(null);
  // List view filter (start/end). Default: start=today, end=unset (all future)
  const [listFilterFrom, setListFilterFrom] = useState<Date>(() => stripTime(new Date()));
  const [listFilterTo, setListFilterTo] = useState<Date | null>(null);
  const [createInitialStart, setCreateInitialStart] = useState<string | null>(null);

  const weekReferenceDate = selectedDate ?? focusDate;

  const viewLabel = useMemo(() => {
    if (view === "month") {
      return monthFormatter.format(focusDate);
    }
    if (view === "week") {
      const start = startOfWeek(weekReferenceDate);
      const end = addDays(start, WORKING_DAY_COUNT - 1);
      return `${monthDayFormatter.format(start)}〜${monthDayFormatter.format(end)}`;
    }
    if (view === "list") return "全予約一覧";
    if (view === "users") return "ユーザー一覧";
    return "";
  }, [focusDate, view, weekReferenceDate]);

  const handlePrev = () => {
    if (view === "month") {
      setFocusDate(addMonths(focusDate, -1));
    } else {
      const next = addDays(focusDate, -7);
      setFocusDate(next);
      setSelectedDate(next);
    }
  };

  const handleNext = () => {
    if (view === "month") {
      setFocusDate(addMonths(focusDate, 1));
    } else {
      const next = addDays(focusDate, 7);
      setFocusDate(next);
      setSelectedDate(next);
    }
  };

  const handleToday = () => {
    const today = stripTime(new Date());
    setFocusDate(today);
    setSelectedDate(today);
    setListFilterFrom(today);
    setListFilterTo(null);
  };

  const handleSelectDate = (date: Date) => {
    const normalized = stripTime(date);
    setSelectedDate(normalized);
    setFocusDate(normalized);
  };

  const handleViewChange = (nextView: ViewType) => {
    try {
      if (window.location.hash !== `#${nextView}`) {
        window.location.hash = `#${nextView}`;
      }
    } catch {}
    setView(nextView);
    if (nextView === "list") setSelectedDate(null);
  };

  const handleOpenCreateModal = (date?: Date) => {
    if (date) {
      const normalized = stripTime(date);
      setSelectedDate(normalized);
      setFocusDate(normalized);
      // If time info is provided, remember initial start hh:mm
      const hh = date.getHours();
      const mm = date.getMinutes();
      if (hh !== 0 || mm !== 0) {
        setCreateInitialStart(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
      }
    } else if (!selectedDate) {
      setSelectedDate(focusDate);
    }
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  const handleOpenDetail = (booking: ParsedBooking) => {
    const bookingDate = stripTime(booking.startDate);
    setSelectedDate(bookingDate);
    setFocusDate(bookingDate);
    setDetailBooking(booking);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setDetailBooking(null);
  };

  const handleEditRequest = (booking: ParsedBooking) => {
    const bookingDate = stripTime(booking.startDate);
    setSelectedDate(bookingDate);
    setFocusDate(bookingDate);
    setEditTarget(booking);
    setIsDetailOpen(false);
    setIsCreateModalOpen(true);
  };

  // 共通部分は常に全幅表示にするため、main は全幅固定。
  // ヘッダーを main の外に出すため、main は下側余白のみ。
  const mainClassName = cn("w-full px-6 pb-10", "max-w-none");

  const modalDate = selectedDate ?? focusDate;

  // List view: filtered bookings from selected from-date
  const filteredListBookings = useMemo(() => {
    const upper = listFilterTo ? addDays(listFilterTo, 1) : null; // inclusive end
    return sortedBookings.filter((b) => {
      const afterStart = b.startDate >= listFilterFrom;
      const beforeEnd = upper ? b.startDate < upper : true;
      return afterStart && beforeEnd;
    });
  }, [sortedBookings, listFilterFrom, listFilterTo]);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="mb-8 px-6 pt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <h1 className="text-2xl font-semibold text-slate-900">📅</h1>
          <div className="flex flex-wrap gap-2">
            {(
              isAdmin
                ? [...BASE_VIEW_OPTIONS, { key: "users" as ViewType, label: "ユーザー" }, { key: "departments" as ViewType, label: "部署" }]
                : BASE_VIEW_OPTIONS
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleViewChange(key)}
                className={cn(
                  "rounded border px-4 py-2 text-sm font-medium transition-colors",
                  view === key
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center"><AuthButton /></div>
      </header>
      <main className={mainClassName}>

        <div
          className={cn(
            "mb-6",
            view === "list" ? "mx-auto w-full max-w-[1200px]" : ""
          )}
        >
          <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
            {view !== "list" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:border-slate-400"
                >
                  前へ
                </button>
                <button
                  type="button"
                  onClick={handleToday}
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:border-slate-400"
                >
                  今日
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:border-slate-400"
                >
                  次へ
                </button>
              </div>
            )}
              
              {view === "list" && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-1">
                    <span className="text-xs text-slate-500">開始</span>
                    <input
                      type="date"
                      value={toDateKey(listFilterFrom)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) setListFilterFrom(parseDateOnly(`${v}T00:00:00+00:00`));
                      }}
                      className="rounded border border-slate-300 bg-white px-3 py-2"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="text-xs text-slate-500">終了</span>
                    <input
                      type="date"
                      value={listFilterTo ? toDateKey(listFilterTo) : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) setListFilterTo(parseDateOnly(`${v}T00:00:00+00:00`));
                        else setListFilterTo(null);
                      }}
                      className="rounded border border-slate-300 bg-white px-3 py-2"
                    />
                  </label>
                </div>
              )}
              {isAuthed && (
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal()}
                  className="ml-auto rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                >
                  予約を作成
                </button>
              )}
          </div>
        </div>
        {view === "month" && (
          <MonthView
            focusDate={focusDate}
            selectedDate={selectedDate}
            bookingsByDate={bookingsByDate}
            onSelectDate={handleSelectDate}
            onCreateRequest={handleOpenCreateModal}
            onBookingClick={handleOpenDetail}
          />
        )}
        {view === "week" && (
          <WeekView
            referenceDate={weekReferenceDate}
            selectedDate={selectedDate}
            bookingsByDate={bookingsByDate}
            onSelectDate={handleSelectDate}
            onCreateRequest={handleOpenCreateModal}
            onBookingClick={handleOpenDetail}
          />
        )}
        {view === "list" && (
          <div className="mx-auto w-full max-w-[1200px] overflow-hidden">
            <ListView bookings={filteredListBookings} onBookingClick={handleOpenDetail} />
          </div>
        )}
        {view === "users" && isAdmin && (
          <div className="mx-auto w-full max-w-[1200px]">
            <UsersList
              users={users}
              onUserClick={(u) => {
                setUserEditing(u);
                setUserModalOpen(true);
              }}
            />
          </div>
        )}
        {view === "departments" && isAdmin && (
          <div className="mx-auto w-full max-w-[1200px]">
            <DepartmentsList
              departments={Array.from(depMap.values()).sort((a,b)=>a.name.localeCompare(b.name))}
              onCreate={() => {
                setDeptEditing(null);
                setDeptModalOpen(true);
              }}
              onEdit={(d) => {
                setDeptEditing(d);
                setDeptModalOpen(true);
              }}
            />
          </div>
        )}
      </main>

      <CreateBookingModal
        open={isCreateModalOpen}
        onClose={() => {
          setEditTarget(null);
          handleCloseCreateModal();
          setCreateInitialStart(null);
        }}
        selectedDate={modalDate}
        bookingsByDate={bookingsByDate}
        departments={departmentNames}
        mode={editTarget ? "edit" : "create"}
        initialBooking={editTarget}
        initialStartHHMM={createInitialStart ?? undefined}
        onSaved={() => {
          // no-op; reload is triggered via bookings:changed event listener
        }}
      />
      <ReservationDetailModal
        open={isDetailOpen}
        booking={detailBooking}
        onClose={handleCloseDetail}
        userId={userId}
        isAdmin={isAdmin}
        onEditRequest={handleEditRequest}
      />

      <UserEditModal
        open={userModalOpen}
        user={userEditing}
        departments={Array.from(depMap.values()).map((d) => ({ id: d.id, name: d.name, default_color: d.default_color }))}
        onClose={() => {
          setUserModalOpen(false);
          setUserEditing(null);
        }}
        onSaved={() => {
          /* users:changed リスナーで再取得 */
        }}
      />

      <DepartmentEditModal
        open={deptModalOpen}
        department={deptEditing}
        onClose={() => {
          setDeptModalOpen(false);
          setDeptEditing(null);
        }}
        onSaved={() => {
          /* departments:changed リスナーで再取得 */
        }}
      />
    </div>
  );
}
