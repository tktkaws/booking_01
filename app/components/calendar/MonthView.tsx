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
