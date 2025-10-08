"use client";

import {
  type KeyboardEvent,
  type MouseEvent,
} from "react";

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
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      handleBookingClick(booking);
    }
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
      <div className="grid grid-cols-5 text-center text-xs font-semibold text-slate-600 border-b border-slate-200">
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
            <button
              key={dateKey + index}
              type="button"
              onClick={() => handleDayClick(cellDate)}
              className={cn(
                "flex min-h-32 flex-col gap-1 bg-white p-2 text-left transition shadow-sm outline-none",
                !isCurrentMonth && "bg-slate-50 text-slate-400",
                isSelected && "border-blue-500 ring-2 ring-blue-200",
                isToday && !isSelected && "border-blue-100",
                "focus-visible:ring-2 focus-visible:ring-blue-400",
                "hover:ring-2 hover:ring-blue-400 hover:ring-offset-2 hover:ring-offset-white"
              )}
            >
              <div className="flex items-center justify-between text-sm font-bold">
                <span className={cn(isToday ? "bg-black text-white px-1 rounded" : undefined)}>{cellDate.getDate()}</span>
              </div>
              <div className="flex-1 min-h-0 flex flex-col gap-1 overflow-y-auto pr-1">
                {dailyBookings.map((booking) => (
                  <div
                    key={booking.id}
                    role="button"
                    tabIndex={0}
                    onClick={(event) => handleBookingBadgeClick(event, booking)}
                    onKeyDown={(event) => handleBookingBadgeKeyDown(event, booking)}
                    className="truncate rounded-md px-2 py-1 text-xs font-medium outline-none transition focus:ring-2 focus:ring-blue-200 hover:ring-2 hover:ring-blue-200 hover:ring-offset-2 hover:ring-offset-white"
                    style={{
                      backgroundColor: booking.color,
                      color: booking.textColor,
                    }}
                  >
                    <span className="mr-1 text-[10px] opacity-80">
                      {formatMinutes(booking.startMinutes)}
                    </span>
                    <span className="truncate">{booking.title}</span>
                  </div>
                ))}
              </div>
            </button>
          );
          })}
        </div>
      </div>
    </div>
  );
}
