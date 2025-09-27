"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import bookingsRaw from "@/data/bookings.json";

type ViewType = "month" | "week" | "list";

type Booking = {
  id: string;
  title: string;
  room: string;
  department: string;
  owner: string;
  start: string;
  end: string;
  isCompanyWide: boolean;
  color: string;
  textColor: string;
  description?: string;
};

type ParsedBooking = Booking & {
  startDate: Date;
  endDate: Date;
  startDateKey: string;
  endDateKey: string;
  startMinutes: number;
  endMinutes: number;
};

type BookingsByDate = Map<string, ParsedBooking[]>;

const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];
const monthFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
});
const monthDayFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
});
const fullDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

const TIME_SLOTS = generateTimeSlots(9, 18, 15);

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<ParsedBooking | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const weekReferenceDate = selectedDate ?? focusDate;

  const viewLabel = useMemo(() => {
    if (view === "month") {
      return monthFormatter.format(focusDate);
    }
    if (view === "week") {
      const start = startOfWeek(weekReferenceDate);
      const end = addDays(start, 6);
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

  const handleOpenModal = (date?: Date) => {
    if (date) {
      const normalized = stripTime(date);
      setSelectedDate(normalized);
      setFocusDate(normalized);
    } else if (!selectedDate) {
      setSelectedDate(focusDate);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleOpenDetail = (booking: ParsedBooking) => {
    setDetailBooking(booking);
    const bookingDate = stripTime(booking.startDate);
    setSelectedDate(bookingDate);
    setFocusDate(bookingDate);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setDetailBooking(null);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
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
            {(
              [
                { key: "month", label: "月間ビュー" },
                { key: "week", label: "週間ビュー" },
                { key: "list", label: "リストビュー" },
              ] as const
            ).map(({ key, label }) => (
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
              onClick={() => handleOpenModal()}
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
            onCreateRequest={handleOpenModal}
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
        open={isModalOpen}
        onClose={handleCloseModal}
        selectedDate={(selectedDate ?? focusDate) || stripTime(new Date())}
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

type MonthViewProps = {
  focusDate: Date;
  selectedDate: Date | null;
  bookingsByDate: BookingsByDate;
  onSelectDate: (date: Date) => void;
  onCreateRequest: (date: Date) => void;
  onBookingClick: (booking: ParsedBooking) => void;
};

function MonthView({ focusDate, selectedDate, bookingsByDate, onSelectDate, onCreateRequest, onBookingClick }: MonthViewProps) {
  const handleDayClick = (date: Date) => {
    onSelectDate(date);
    onCreateRequest(date);
  };
  const handleBookingClick = (booking: ParsedBooking) => {
    onBookingClick(booking);
  };
  const handleBookingBadgeClick = (
    event: MouseEvent<HTMLDivElement>,
    booking: ParsedBooking
  ) => {
    event.stopPropagation();
    handleBookingClick(booking);
  };
  const handleBookingBadgeKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    booking: ParsedBooking
  ) => {
    if (event.key === "Enter" || event.key === " " ) {
      event.preventDefault();
      event.stopPropagation();
      handleBookingClick(booking);
    }
  };
  const start = startOfMonth(focusDate);
  const end = endOfMonth(focusDate);
  const offset = start.getDay();
  const daysInMonth = end.getDate();
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const today = stripTime(new Date());

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-600">
        {weekdayLabels.map((label) => (
          <div key={label} className="px-2 py-3">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-200 p-px">
        {Array.from({ length: totalCells }).map((_, index) => {
          const cellDate = addDays(start, index - offset);
          const isCurrentMonth = cellDate.getMonth() === focusDate.getMonth();
          const isSelected = selectedDate ? isSameDay(cellDate, selectedDate) : false;
          const isToday = isSameDay(cellDate, today);
          const dateKey = toDateKey(cellDate);
          const dailyBookings = bookingsByDate.get(dateKey) ?? [];

          return (
            <button
              key={dateKey + index}
              type="button"
              onClick={() => handleDayClick(cellDate)}
              className={cn(
                "flex h-32 flex-col gap-1 rounded-lg border border-white bg-white p-2 text-left transition shadow-sm",
                !isCurrentMonth && "bg-slate-50 text-slate-400",
                isSelected && "border-blue-500 ring-2 ring-blue-200",
                isToday && !isSelected && "border-blue-100"
              )}
            >
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>{cellDate.getDate()}</span>
                {dailyBookings.length > 0 && (
                  <span className="text-[11px] font-medium text-slate-500">
                    {dailyBookings.length}件
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {dailyBookings.slice(0, 2).map((booking) => (
                  <div
                    key={booking.id}
                    role="button"
                    tabIndex={0}
                    onClick={(event) => handleBookingBadgeClick(event, booking)}
                    onKeyDown={(event) => handleBookingBadgeKeyDown(event, booking)}
                    className="truncate rounded-md px-2 py-1 text-xs font-medium outline-none transition focus:ring-2 focus:ring-blue-200"
                    style={{
                      backgroundColor: booking.color,
                      color: booking.textColor,
                    }}
                  >
                    {booking.title}
                  </div>
                ))}
                {dailyBookings.length > 2 && (
                  <span className="text-[11px] text-slate-500">
                    +{dailyBookings.length - 2} 件
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type WeekViewProps = {
  referenceDate: Date;
  selectedDate: Date | null;
  bookingsByDate: BookingsByDate;
  onSelectDate: (date: Date) => void;
  onBookingClick: (booking: ParsedBooking) => void;
};

function WeekView({ referenceDate, selectedDate, bookingsByDate, onSelectDate, onBookingClick }: WeekViewProps) {
  const weekStart = startOfWeek(referenceDate);
  const weekDays = Array.from({ length: 7 }).map((_, index) => addDays(weekStart, index));
  const slotMinutes = 15;
  const startMinutes = 9 * 60;
  const endMinutes = 18 * 60;
  const slotCount = (endMinutes - startMinutes) / slotMinutes;
  const slotHeight = 28;
  const columnStyle = {
    gridTemplateRows: `repeat(${slotCount}, ${slotHeight}px)`,
  };
  const handleBookingBlockClick = (
    event: MouseEvent<HTMLDivElement>,
    booking: ParsedBooking
  ) => {
    event.stopPropagation();
    onBookingClick(booking);
  };
  const handleBookingBlockKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    booking: ParsedBooking
  ) => {
    if (event.key === "Enter" || event.key === " " ) {
      event.preventDefault();
      event.stopPropagation();
      onBookingClick(booking);
    }
  };

  const timeLabels = Array.from({ length: slotCount }).map((_, index) => {
    const totalMinutes = startMinutes + index * slotMinutes;
    return formatMinutes(totalMinutes);
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-[90px_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
        <div className="px-3 py-3 text-right">時間</div>
        {weekDays.map((day) => (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onSelectDate(day)}
            className={cn(
              "border-l border-slate-200 px-3 py-3 text-left transition",
              selectedDate && isSameDay(day, selectedDate)
                ? "bg-white text-blue-600"
                : "bg-slate-50 hover:bg-slate-100"
            )}
          >
            <div className="text-[11px] text-slate-500">
              {weekdayLabels[day.getDay()]}
            </div>
            <div className="text-sm font-semibold">{monthDayFormatter.format(day)}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[90px_repeat(7,minmax(0,1fr))]">
        <div className="flex flex-col text-xs text-slate-500">
          {timeLabels.map((label, index) => (
            <div
              key={label + index}
              className="flex h-[28px] items-start justify-end border-b border-slate-100 pr-2"
            >
              {index % 2 === 0 ? label : ""}
            </div>
          ))}
        </div>
        {weekDays.map((day) => {
          const dateKey = toDateKey(day);
          const dailyBookings = bookingsByDate.get(dateKey) ?? [];

          return (
            <div
              key={dateKey}
              className="relative border-l border-slate-100"
              style={{ height: slotCount * slotHeight }}
            >
              <div className="absolute inset-0 grid" style={columnStyle}>
                {timeLabels.map((_, index) => (
                  <div
                    key={`${dateKey}-slot-${index}`}
                    className={cn(
                      "border-b border-slate-100",
                      index % 4 === 0 ? "bg-slate-50/80" : "bg-white"
                    )}
                  />
                ))}
              </div>
              <div className="absolute inset-0 grid gap-1 px-1 py-1" style={columnStyle}>
                {dailyBookings.map((booking) => {
                  const range = calculateSlotRange(
                    booking,
                    startMinutes,
                    endMinutes,
                    slotMinutes
                  );
                  if (!range) {
                    return null;
                  }
                  return (
                    <div
                      key={booking.id}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => handleBookingBlockClick(event, booking)}
                      onKeyDown={(event) => handleBookingBlockKeyDown(event, booking)}
                      className="overflow-hidden rounded-md px-2 py-1 text-xs font-semibold shadow-sm outline-none transition focus:ring-2 focus:ring-white"
                      style={{
                        gridRow: `${range.start} / span ${range.span}`,
                        backgroundColor: booking.color,
                        color: booking.textColor,
                      }}
                    >
                      <div className="truncate">{booking.title}</div>
                      <div className="text-[10px] opacity-80">
                        {formatMinutes(booking.startMinutes)}〜{formatMinutes(booking.endMinutes)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ListViewProps = {
  bookings: ParsedBooking[];
  onBookingClick: (booking: ParsedBooking) => void;
};

function ListView({ bookings, onBookingClick }: ListViewProps) {
  const handleCardClick = (booking: ParsedBooking) => {
    onBookingClick(booking);
  };

  return (
    <div className="space-y-3">
      {bookings.map((booking) => (
        <article
          key={booking.id}
          role="button"
          tabIndex={0}
          onClick={() => handleCardClick(booking)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " " ) {
              event.preventDefault();
              handleCardClick(booking);
            }
          }}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              className="text-base font-semibold"
              style={{ color: booking.color }}
            >
              {booking.title}
            </h2>
            <span className="text-xs font-medium text-slate-500">
              {booking.department} / {booking.room}
            </span>
          </div>
          <div className="mt-2 text-sm text-slate-700">
            {fullDateFormatter.format(booking.startDate)} {formatMinutes(booking.startMinutes)}〜
            {formatMinutes(booking.endMinutes)}
          </div>
          <div className="mt-1 text-xs text-slate-500">担当: {booking.owner}</div>
          {booking.isCompanyWide && (
            <span className="mt-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              全社共有
            </span>
          )}
        </article>
      ))}
    </div>
  );
}

type CreateBookingModalProps = {
  open: boolean;
  onClose: () => void;
  selectedDate: Date;
  bookingsByDate: BookingsByDate;
  rooms: string[];
  departments: string[];
};

function CreateBookingModal({
  open,
  onClose,
  selectedDate,
  bookingsByDate,
  rooms,
  departments,
}: CreateBookingModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dateKey = toDateKey(selectedDate);
  const dailyBookings = useMemo(() => {
    return bookingsByDate.get(dateKey) ?? [];
  }, [bookingsByDate, dateKey]);

  const initialFormState = useMemo(() => {
    return {
      title: "",
      room: rooms[0] ?? "A-101",
      department: departments[0] ?? "所属未設定",
      date: dateKey,
      start: "09:00",
      end: "09:30",
      isCompanyWide: false,
      description: "",
    };
  }, [rooms, departments, dateKey]);

  const [formState, setFormState] = useState(initialFormState);

  useEffect(() => {
    setFormState(initialFormState);
  }, [initialFormState, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close("dismiss");
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    const handleClose = () => {
      onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleClose);
    };
  }, [onClose]);

  const handleFieldChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type, checked } = event.target;
    setFormState((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // 実際の保存処理は未実装。デバッグ用途でフォーム内容を出力する。
    console.table(formState);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="max-h-[90vh] w-[min(720px,90vw)] rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/60"
    >
      <form method="dialog" className="flex flex-col" onSubmit={handleSubmit}>
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">予約を作成</h2>
            <p className="text-xs text-slate-500">
              {fullDateFormatter.format(selectedDate)} の会議室予約を登録します
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
            aria-label="モーダルを閉じる"
          >
            閉じる
          </button>
        </header>
        <div className="grid max-h-[60vh] grid-cols-1 gap-6 overflow-y-auto px-6 py-6 sm:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-4">
            <div className="space-y-2">
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
                件名
                <input
                  required
                  name="title"
                  value={formState.title}
                  onChange={handleFieldChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="例: 9月度プロジェクト定例"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
                会議室
                <select
                  name="room"
                  value={formState.room}
                  onChange={handleFieldChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {rooms.map((room) => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
                部署
                <select
                  name="department"
                  value={formState.department}
                  onChange={handleFieldChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
                日付
                <input
                  type="date"
                  name="date"
                  value={formState.date}
                  onChange={handleFieldChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
                開始
                <select
                  name="start"
                  value={formState.start}
                  onChange={handleFieldChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={`start-${slot}`} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
                終了
                <select
                  name="end"
                  value={formState.end}
                  onChange={handleFieldChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={`end-${slot}`} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                name="isCompanyWide"
                checked={formState.isCompanyWide}
                onChange={handleFieldChange}
                className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              全社共有として表示する
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
              メモ
              <textarea
                name="description"
                value={formState.description}
                onChange={handleFieldChange}
                rows={4}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="議題や参加者を記入してください"
              />
            </label>
          </section>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">
              {monthDayFormatter.format(selectedDate)} の予約状況
            </h3>
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              {dailyBookings.length === 0 && <p>登録済みの予約はありません。</p>}
              {dailyBookings.map((booking) => (
                <div
                  key={`timeline-${booking.id}`}
                  className="flex items-start justify-between gap-2 rounded-md bg-white px-2 py-1 shadow-sm"
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold" style={{ color: booking.color }}>
                      {booking.title}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatMinutes(booking.startMinutes)}〜{formatMinutes(booking.endMinutes)} / {booking.room}
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-slate-500">
                    {booking.department}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
        <footer className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400"
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            保存する
          </button>
        </footer>
      </form>
    </dialog>
  );

}

type ReservationDetailModalProps = {
  open: boolean;
  booking: ParsedBooking | null;
  onClose: () => void;
};

function ReservationDetailModal({ open, booking, onClose }: ReservationDetailModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && booking) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close("dismiss");
    }
  }, [open, booking]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    const handleClose = () => {
      onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleClose);
    };
  }, [onClose]);

  if (!booking) {
    return null;
  }

  const scheduleLabel = `${fullDateFormatter.format(booking.startDate)} ${formatMinutes(booking.startMinutes)}〜${formatMinutes(booking.endMinutes)}`;

  const handleEdit = () => {
    console.info("edit booking", booking.id);
  };

  const handleDelete = () => {
    console.info("delete booking", booking.id);
  };

  return (
    <dialog
      ref={dialogRef}
      className="w-[min(520px,90vw)] rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/60"
    >
      <div className="flex flex-col">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{booking.title}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{booking.department}</span>
              <span aria-hidden>•</span>
              <span>{booking.room}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
            aria-label="モーダルを閉じる"
          >
            閉じる
          </button>
        </header>
        <div className="space-y-4 px-6 py-6 text-sm text-slate-700">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold text-slate-500">日時</div>
            <div className="mt-1 font-medium text-slate-800">{scheduleLabel}</div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 px-4 py-3">
              <div className="text-xs font-semibold text-slate-500">担当者</div>
              <div className="mt-1 font-medium text-slate-800">{booking.owner}</div>
            </div>
            <div className="rounded-lg border border-slate-200 px-4 py-3">
              <div className="text-xs font-semibold text-slate-500">部署</div>
              <div className="mt-1 font-medium text-slate-800">{booking.department}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-slate-500">カラー</span>
            <span
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1"
              style={{ backgroundColor: booking.color, color: booking.textColor }}
            >
              <span className="h-2 w-2 rounded-full border border-white/60 bg-white/40" />
              {booking.color}
            </span>
            {booking.isCompanyWide && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 font-semibold text-blue-700">
                全社共有
              </span>
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">メモ</div>
            <p className="mt-1 whitespace-pre-wrap rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600">
              {booking.description ? booking.description : "メモは未入力です。"}
            </p>
          </div>
        </div>
        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50"
          >
            削除
          </button>
          <button
            type="button"
            onClick={handleEdit}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            編集
          </button>
        </footer>
      </div>
    </dialog>
  );
}

function parseIso(iso: string) {
  const [datePart, timePartWithOffset] = iso.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [timePart] = timePartWithOffset.split("+");
  const [hour, minute] = timePart.split(":").map(Number);
  return {
    date: new Date(year, month - 1, day, hour, minute),
    dateKey: datePart,
    hour,
    minute,
    minutes: hour * 60 + minute,
  };
}

function parseDateOnly(iso: string) {
  const [datePart] = iso.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  return stripTime(new Date(year, month - 1, day));
}

function stripTime(date: Date) {
  const cloned = new Date(date);
  cloned.setHours(0, 0, 0, 0);
  return cloned;
}

function addDays(date: Date, amount: number) {
  const cloned = new Date(date);
  cloned.setDate(cloned.getDate() + amount);
  return stripTime(cloned);
}

function addMonths(date: Date, amount: number) {
  const cloned = new Date(date);
  cloned.setMonth(cloned.getMonth() + amount);
  return stripTime(cloned);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfWeek(date: Date) {
  const cloned = stripTime(date);
  const day = cloned.getDay();
  return addDays(cloned, -day);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor(totalMinutes % 60)
    .toString()
    .padStart(2, "0");
  return `${hours}:${minutes}`;
}

type SlotRange = {
  start: number;
  span: number;
};

function calculateSlotRange(
  booking: ParsedBooking,
  startMinutes: number,
  endMinutes: number,
  slotMinutes: number
): SlotRange | null {
  const start = Math.max(booking.startMinutes, startMinutes);
  const end = Math.min(booking.endMinutes, endMinutes);
  if (end <= start) {
    return null;
  }
  const startIndex = Math.floor((start - startMinutes) / slotMinutes) + 1;
  const endIndex = Math.ceil((end - startMinutes) / slotMinutes) + 1;
  return {
    start: startIndex,
    span: Math.max(endIndex - startIndex, 1),
  };
}

function generateTimeSlots(
  startHour: number,
  endHour: number,
  intervalMinutes: number
) {
  const slots: string[] = [];
  for (let minutes = startHour * 60; minutes <= endHour * 60; minutes += intervalMinutes) {
    slots.push(formatMinutes(minutes));
  }
  return slots;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
