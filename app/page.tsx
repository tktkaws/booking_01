"use client";

import { useMemo, useState } from "react";

import { MonthView } from "@/components/calendar/MonthView";
import { WeekView } from "@/components/calendar/WeekView";
import { ListView } from "@/components/list/ListView";
import { CreateBookingModal } from "@/components/modal/CreateBookingModal";
import { ReservationDetailModal } from "@/components/modal/ReservationDetailModal";
import { AuthButton } from "@/components/auth/AuthButton";
import bookingsRaw from "@/data/bookings.json";
import departmentsRaw from "@/data/departments.json";
import usersRaw from "@/data/users.json";
import {
  addDays,
  addMonths,
  monthDayFormatter,
  monthFormatter,
  parseDateOnly,
  parseIso,
  startOfWeek,
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

const VIEW_OPTIONS: ReadonlyArray<{ key: ViewType; label: string }> = [
  { key: "month", label: "月間ビュー" },
  { key: "week", label: "週間ビュー" },
  { key: "list", label: "リストビュー" },
];

export default function Home() {
  const departments = useMemo(() => departmentsRaw as Department[], []);
  const users = useMemo(() => usersRaw as User[], []);
  const depMap = useMemo(() => {
    const m = new Map<string, Department>();
    departments.forEach((d) => m.set(d.id, d));
    return m;
  }, [departments]);
  const userMap = useMemo(() => {
    const m = new Map<string, User>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

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

  const bookings = useMemo<ParsedBooking[]>(() => {
    return (bookingsRaw as Booking[]).map((booking) => {
      const startMeta = parseIso(booking.start);
      const endMeta = parseIso(booking.end);
      const dep = depMap.get(booking.departmentId);
      const user = userMap.get(booking.ownerUserId);
      const color = dep?.default_color ?? '#64748b';
      const textColor = getTextColor(color);
      return {
        ...booking,
        departmentName: dep?.name ?? booking.departmentId,
        ownerName: user?.display_name ?? booking.ownerUserId,
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
  }, [depMap, userMap]);

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

  // room フィールドは廃止のため未使用

  const departmentNames = useMemo(() => {
    return departments.map((d) => d.name);
  }, [departments]);

  const [view, setView] = useState<ViewType>("month");
  const [focusDate, setFocusDate] = useState<Date>(() => {
    const firstIso = (bookingsRaw as Booking[])[0]?.start;
    return firstIso ? parseDateOnly(firstIso) : stripTime(new Date());
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    const firstIso = (bookingsRaw as Booking[])[0]?.start;
    return firstIso ? parseDateOnly(firstIso) : null;
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<ParsedBooking | null>(null);

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
    return "全予約一覧";
  }, [focusDate, view, weekReferenceDate]);

  const handlePrev = () => {
    setFocusDate((current) => {
      if (view === "month") {
        return addMonths(current, -1);
      }
      return addDays(current, -7);
    });
  };

  const handleNext = () => {
    setFocusDate((current) => {
      if (view === "month") {
        return addMonths(current, 1);
      }
      return addDays(current, 7);
    });
  };

  const handleToday = () => {
    const today = stripTime(new Date());
    setFocusDate(today);
    setSelectedDate(today);
  };

  const handleSelectDate = (date: Date) => {
    const normalized = stripTime(date);
    setSelectedDate(normalized);
    setFocusDate(normalized);
  };

  const handleViewChange = (nextView: ViewType) => {
    setView(nextView);
    if (nextView === "list") {
      setSelectedDate(null);
    }
  };

  const handleOpenCreateModal = (date?: Date) => {
    if (date) {
      const normalized = stripTime(date);
      setSelectedDate(normalized);
      setFocusDate(normalized);
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

  // 共通部分は常に全幅表示にするため、main は全幅固定。
  // ヘッダーを main の外に出すため、main は下側余白のみ。
  const mainClassName = cn("w-full px-6 pb-10", "max-w-none");

  const modalDate = selectedDate ?? focusDate;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="mb-8 px-6 pt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            予約
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {VIEW_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleViewChange(key)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  view === key
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <AuthButton />
        </div>
      </header>
      <main className={mainClassName}>

        <div
          className={cn(
            "mb-6",
            view === "list" ? "mx-auto w-full max-w-[1200px]" : ""
          )}
        >
          <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
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
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-lg font-semibold text-slate-700">{viewLabel}</div>
              <button
                type="button"
                onClick={() => handleOpenCreateModal()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                予約を作成
              </button>
            </div>
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
            onBookingClick={handleOpenDetail}
          />
        )}
        {view === "list" && (
          <div className="mx-auto w-full max-w-[1200px]">
            <ListView
              bookings={sortedBookings}
              onBookingClick={handleOpenDetail}
            />
          </div>
        )}
      </main>

      <CreateBookingModal
        open={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        selectedDate={modalDate}
        bookingsByDate={bookingsByDate}
        departments={departmentNames}
      />
      <ReservationDetailModal
        open={isDetailOpen}
        booking={detailBooking}
        onClose={handleCloseDetail}
      />
    </div>
  );
}
