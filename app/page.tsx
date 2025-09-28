"use client";

import { useMemo, useState } from "react";

import { MonthView } from "@/components/calendar/MonthView";
import { WeekView } from "@/components/calendar/WeekView";
import { ListView } from "@/components/list/ListView";
import { CreateBookingModal } from "@/components/modal/CreateBookingModal";
import { ReservationDetailModal } from "@/components/modal/ReservationDetailModal";
import bookingsRaw from "@/data/bookings.json";
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
  type ParsedBooking,
  type ViewType,
} from "@/types/bookings";

const VIEW_OPTIONS: ReadonlyArray<{ key: ViewType; label: string }> = [
  { key: "month", label: "月間ビュー" },
  { key: "week", label: "週間ビュー" },
  { key: "list", label: "リストビュー" },
];

export default function Home() {
  const bookings = useMemo<ParsedBooking[]>(() => {
    return (bookingsRaw as Booking[]).map((booking) => {
      const startMeta = parseIso(booking.start);
      const endMeta = parseIso(booking.end);
      return {
        ...booking,
        startDate: startMeta.date,
        endDate: endMeta.date,
        startDateKey: startMeta.dateKey,
        endDateKey: endMeta.dateKey,
        startMinutes: startMeta.minutes,
        endMinutes: endMeta.minutes,
      };
    });
  }, []);

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

  const rooms = useMemo(() => {
    return Array.from(new Set(bookings.map((booking) => booking.room)));
  }, [bookings]);

  const departments = useMemo(() => {
    return Array.from(new Set(bookings.map((booking) => booking.department)));
  }, [bookings]);

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

  const mainClassName = cn(
    "mx-auto w-full px-6 py-10",
    view === "list" ? "max-w-6xl" : "max-w-none"
  );

  const modalDate = selectedDate ?? focusDate;

  return (
    <div className="min-h-screen bg-slate-100">
      <main className={mainClassName}>
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              会議室予約ダッシュボード
            </h1>
            <p className="text-sm text-slate-600">
              ダミーデータ20件を用いたビュー切替サンプル
            </p>
          </div>
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
        </header>

        <div className="mb-6 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
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
          <ListView bookings={sortedBookings} onBookingClick={handleOpenDetail} />
        )}
      </main>

      <CreateBookingModal
        open={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        selectedDate={modalDate}
        bookingsByDate={bookingsByDate}
        rooms={rooms}
        departments={departments}
      />
      <ReservationDetailModal
        open={isDetailOpen}
        booking={detailBooking}
        onClose={handleCloseDetail}
      />
    </div>
  );
}
