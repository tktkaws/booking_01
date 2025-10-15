"use client";

import { type MouseEvent } from "react";

import {
  addDays,
  endOfMonth,
  endOfWorkWeek,
  isSameDay,
  isWeekday,
  formatMinutes,
  startOfMonth,
  startOfWeek,
  stripTime,
  toDateKey,
  weekdayLabelsFull,
  WORKING_DAY_INDICES,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";
import {
  type BookingsByDate,
  type ParsedBooking,
} from "@/types/bookings";

type MonthViewProps = {
  focusDate: Date;
  selectedDate: Date | null;
  bookingsByDate: BookingsByDate;
  onSelectDate: (date: Date) => void;
  onCreateRequest: (date: Date) => void;
  onBookingClick: (booking: ParsedBooking) => void;
};

export function MonthView({
  focusDate,
  selectedDate,
  bookingsByDate,
  onSelectDate,
  onCreateRequest,
  onBookingClick,
}: MonthViewProps) {
  const handleDayClick = (date: Date) => {
    onSelectDate(date);
    onCreateRequest(date);
  };

  const handleBookingClick = (booking: ParsedBooking) => {
    onBookingClick(booking);
  };

  const handleBookingBadgeClick = (
    event: MouseEvent<HTMLButtonElement>,
    booking: ParsedBooking
  ) => {
    event.stopPropagation();
    handleBookingClick(booking);
  };

  const monthStart = startOfMonth(focusDate);
  const monthEnd = endOfMonth(focusDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWorkWeek(monthEnd);
  const today = stripTime(new Date());

  const calendarDays: Date[] = [];
  for (let cursor = calendarStart; cursor <= calendarEnd; cursor = addDays(cursor, 1)) {
    if (isWeekday(cursor)) {
      calendarDays.push(cursor);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="grid grid-cols-5 text-center text-xs font-semibold text-slate-800 border-b border-slate-200">
        {WORKING_DAY_INDICES.map((weekday) => (
          <div key={weekday} className="px-2 py-3">
            {weekdayLabelsFull[weekday]}
          </div>
        ))}
      </div>
      <div className="relative max-h-[calc(100vh-260px)] overflow-y-auto overflow-x-auto">
        <div className="grid grid-cols-5 gap-px bg-slate-200 p-px">
          {calendarDays.map((cellDate, index) => {
          const isCurrentMonth = cellDate.getMonth() === focusDate.getMonth();
          const isSelected = selectedDate ? isSameDay(cellDate, selectedDate) : false;
          const isToday = isSameDay(cellDate, today);
          const dateKey = toDateKey(cellDate);
          const dailyBookings = bookingsByDate.get(dateKey) ?? [];

          return (
            <div
              key={dateKey + index}
              className={cn(
                "grid grid-rows-[2rem_1fr] min-h-32 bg-white text-left transition shadow-sm outline-none",
                !isCurrentMonth && "bg-slate-50 text-slate-800",
                isSelected && "ring-2 ring-blue-200",
                isToday && !isSelected && "border-blue-100"
              )}
            >
              {/* 全面：当日用予約作成ボタン（カレンダーセル全体に被せる） */}
              <button
                onClick={() => handleDayClick(cellDate)}
                className="row-span-full col-span-full grid justify-start w-full h-full rounded-none outline-none focus-visible:bg-slate-100/80 hover:bg-slate-100/80"             
                aria-label={`${cellDate.getDate()}日の予約を作成`}
              >
                {/* 日付ラベル（上部は空ける） */}
                <div className="text-sm font-bold m-1">
                  <span className={cn(isToday ? "bg-black text-white px-1 rounded" : undefined)}>
                    {cellDate.getDate()}
                  </span>
                </div>
              </button>

              {/* 前面：日付ラベルを避けて予約ボタンを配置 */}
              <ul className="row-start-2 col-span-full h-fit my-1 mx-1 space-y-1">
                {dailyBookings.map((booking) => (
                  <li key={booking.id}>
                    <button
                    key={booking.id}
                    onClick={(event) => handleBookingBadgeClick(event, booking)}
                    className="z-10 w-full truncate rounded-md px-2 py-1 text-xs font-medium outline-none transition focus-visible:ring-2 hover:ring-2 text-left"
                    style={{
                      backgroundColor: booking.color,
                      color: booking.textColor,
                    }}
                    title={booking.title}
                  >
                    <span className="mr-1 text-[10px] opacity-80">
                      {formatMinutes(booking.startMinutes)}
                    </span>
                    <span className="truncate align-middle">{booking.title}</span>
                  </button>

                  </li>
                  
                ))}
              </ul>
              <div className="z-10 px-1 space-y-1">
                
              </div>
            </div>
          );
          })}
        </div>
      </div>
    </div>
  );
}
