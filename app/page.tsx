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

const weekdayLabelsFull = ["日", "月", "火", "水", "木", "金", "土"];
const WORKING_DAY_INDICES = [1, 2, 3, 4, 5] as const;
const WORKING_DAY_COUNT = WORKING_DAY_INDICES.length;
const SLOT_INTERVAL_MINUTES = 15;
const DAY_START_MINUTES = 9 * 60;
const DAY_END_MINUTES = 18 * 60;
const SLOT_HEIGHT_PX = 28;
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

const TIME_SLOTS = generateTimeSlots(9, 18, SLOT_INTERVAL_MINUTES);

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

  const mainClassName = cn(
    "mx-auto w-full px-6 py-10",
    view === "list" ? "max-w-6xl" : "max-w-none"
  );

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
  const monthStart = startOfMonth(focusDate);
  const monthEnd = endOfMonth(focusDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWorkWeek(monthEnd);
  const calendarDays: Date[] = [];
  for (
    let cursor = calendarStart;
    cursor <= calendarEnd;
    cursor = addDays(cursor, 1)
  ) {
    if (isWeekday(cursor)) {
      calendarDays.push(cursor);
    }
  }
  const today = stripTime(new Date());

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-5 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-600">
        {WORKING_DAY_INDICES.map((weekday) => (
          <div key={weekday} className="px-2 py-3">
            {weekdayLabelsFull[weekday]}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-px bg-slate-200 p-px">
        {calendarDays.map((cellDate, index) => {
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
  const weekDays = Array.from({ length: WORKING_DAY_COUNT }).map((_, index) =>
    addDays(weekStart, index)
  );
  const slotCount = (DAY_END_MINUTES - DAY_START_MINUTES) / SLOT_INTERVAL_MINUTES;
  const columnStyle = {
    gridTemplateRows: `repeat(${slotCount}, ${SLOT_HEIGHT_PX}px)`,
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
    const totalMinutes = DAY_START_MINUTES + index * SLOT_INTERVAL_MINUTES;
    return formatMinutes(totalMinutes);
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-[90px_repeat(5,minmax(0,1fr))] border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
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
              {weekdayLabelsFull[day.getDay()]}
            </div>
            <div className="text-sm font-semibold">{monthDayFormatter.format(day)}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[90px_repeat(5,minmax(0,1fr))]">
        <div className="flex flex-col text-xs text-slate-500">
          {timeLabels.map((label, index) => (
            <div
              key={label + index}
              className="flex items-start justify-end border-b border-slate-100 pr-2"
              style={{ height: SLOT_HEIGHT_PX }}
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
              style={{ height: slotCount * SLOT_HEIGHT_PX }}
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
                    DAY_START_MINUTES,
                    DAY_END_MINUTES,
                    SLOT_INTERVAL_MINUTES
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
  const handleRowClick = (booking: ParsedBooking) => {
    onBookingClick(booking);
  };
  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    booking: ParsedBooking
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleRowClick(booking);
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[720px] w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-3 text-left">件名</th>
            <th scope="col" className="px-4 py-3 text-left">部署 / 会議室</th>
            <th scope="col" className="px-4 py-3 text-left">日時</th>
            <th scope="col" className="px-4 py-3 text-left">担当</th>
            <th scope="col" className="px-4 py-3 text-left">属性</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-700">
          {bookings.map((booking) => {
            const scheduleLabel = `${fullDateFormatter.format(booking.startDate)} ${formatMinutes(booking.startMinutes)}〜${formatMinutes(booking.endMinutes)}`;
            return (
              <tr
                key={booking.id}
                role="button"
                tabIndex={0}
                onClick={() => handleRowClick(booking)}
                onKeyDown={(event) => handleRowKeyDown(event, booking)}
                className="cursor-pointer transition hover:bg-slate-50 focus:outline-none focus-visible:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-2.5 w-2.5 flex-none rounded-full"
                      style={{ backgroundColor: booking.color }}
                      aria-hidden
                    />
                    <span className="font-semibold" style={{ color: booking.color }}>
                      {booking.title}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {booking.department} / {booking.room}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {scheduleLabel}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{booking.owner}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {booking.isCompanyWide ? (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">
                      全社共有
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
  const startDetailsRef = useRef<HTMLDetailsElement>(null);
  const endDetailsRef = useRef<HTMLDetailsElement>(null);

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
  const formDateKey = formState.date || dateKey;
  const formDate = useMemo(() => {
    return fromDateKey(formDateKey);
  }, [formDateKey]);
  const dailyBookings = useMemo(() => {
    return bookingsByDate.get(formDateKey) ?? [];
  }, [bookingsByDate, formDateKey]);

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
    if (name === "start") {
      startDetailsRef.current?.removeAttribute("open");
    }
    if (name === "end") {
      endDetailsRef.current?.removeAttribute("open");
    }
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
      className="fixed left-1/2 top-1/2 max-h-[90vh] w-[min(720px,90vw)] -translate-x-1/2 -translate-y-1/2 transform rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/60"
    >
      <form method="dialog" className="flex flex-col" onSubmit={handleSubmit}>
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">予約を作成</h2>
            <p className="text-xs text-slate-500">
              {fullDateFormatter.format(formDate)} の会議室予約を登録します
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
            <div className="flex flex-col gap-4">
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
              <div className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                <span>開始</span>
                <details
                  ref={startDetailsRef}
                  className="group relative"
                  onToggle={(event) => {
                    if (event.currentTarget.open) {
                      endDetailsRef.current?.removeAttribute("open");
                    }
                  }}
                >
                  <summary
                    className="flex w-full list-none items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50/80 focus:outline-none focus:ring-2 focus:ring-blue-200 [&::-webkit-details-marker]:hidden"
                  >
                    <span>{formState.start}</span>
                    <span className="text-xs text-slate-500">変更</span>
                  </summary>
                  <div className="absolute left-0 top-full z-30 mt-2 hidden w-[min(360px,calc(100vw-5rem))] rounded-lg border border-slate-200 bg-white p-3 shadow-xl group-open:grid group-open:grid-cols-4 group-open:gap-2">
                    {TIME_SLOTS.map((slot) => {
                      const id = `start-${slot}`;
                      const isSelected = formState.start === slot;
                      return (
                        <label
                          key={id}
                          htmlFor={id}
                          className={cn(
                            "cursor-pointer rounded-md border px-3 py-2 text-center text-xs font-semibold transition",
                            isSelected
                              ? "border-blue-500 bg-blue-50 text-blue-700 shadow"
                              : "border-slate-300 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/80"
                          )}
                        >
                          <input
                            id={id}
                            type="radio"
                            name="start"
                            value={slot}
                            checked={isSelected}
                            onChange={handleFieldChange}
                            className="sr-only"
                          />
                          {slot}
                        </label>
                      );
                    })}
                  </div>
                </details>
              </div>
              <div className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                <span>終了</span>
                <details
                  ref={endDetailsRef}
                  className="group relative"
                  onToggle={(event) => {
                    if (event.currentTarget.open) {
                      startDetailsRef.current?.removeAttribute("open");
                    }
                  }}
                >
                  <summary
                    className="flex w-full list-none items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50/80 focus:outline-none focus:ring-2 focus:ring-blue-200 [&::-webkit-details-marker]:hidden"
                  >
                    <span>{formState.end}</span>
                    <span className="text-xs text-slate-500">変更</span>
                  </summary>
                  <div className="absolute left-0 top-full z-30 mt-2 hidden w-[min(360px,calc(100vw-5rem))] rounded-lg border border-slate-200 bg-white p-3 shadow-xl group-open:grid group-open:grid-cols-4 group-open:gap-2">
                    {TIME_SLOTS.map((slot) => {
                      const id = `end-${slot}`;
                      const isSelected = formState.end === slot;
                      return (
                        <label
                          key={id}
                          htmlFor={id}
                          className={cn(
                            "cursor-pointer rounded-md border px-3 py-2 text-center text-xs font-semibold transition",
                            isSelected
                              ? "border-blue-500 bg-blue-50 text-blue-700 shadow"
                              : "border-slate-300 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/80"
                          )}
                        >
                          <input
                            id={id}
                            type="radio"
                            name="end"
                            value={slot}
                            checked={isSelected}
                            onChange={handleFieldChange}
                            className="sr-only"
                          />
                          {slot}
                        </label>
                      );
                    })}
                  </div>
                </details>
              </div>
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
              {monthDayFormatter.format(formDate)} の予約状況
            </h3>
            <div className="space-y-2">
              {dailyBookings.length === 0 && (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  登録済みの予約はありません。
                </p>
              )}
              {dailyBookings.map((booking) => (
                <div
                  key={`modal-booking-${booking.id}`}
                  className="space-y-1 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div
                    className="truncate rounded-md px-2 py-1 text-xs font-semibold"
                    style={{ backgroundColor: booking.color, color: booking.textColor }}
                  >
                    {booking.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span>
                      {formatMinutes(booking.startMinutes)}〜{formatMinutes(booking.endMinutes)}
                    </span>
                    <span aria-hidden>•</span>
                    <span>{booking.room}</span>
                    <span aria-hidden>•</span>
                    <span>{booking.department}</span>
                  </div>
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
  const diff = (day + 6) % 7;
  return addDays(cloned, -diff);
}

function endOfWorkWeek(date: Date) {
  const cloned = stripTime(date);
  const day = cloned.getDay();
  if (day === 6) {
    return addDays(cloned, -1);
  }
  if (day === 0) {
    return addDays(cloned, -2);
  }
  return addDays(cloned, 5 - day);
}

function isWeekday(date: Date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
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

function fromDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return stripTime(new Date(year, (month ?? 1) - 1, day ?? 1));
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
