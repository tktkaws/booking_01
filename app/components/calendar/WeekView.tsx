"use client";

import {
  type KeyboardEvent,
  type MouseEvent,
} from "react";

import {
  addDays,
  calculateSlotRange,
  DAY_END_MINUTES,
  DAY_START_MINUTES,
  isSameDay,
  formatMinutes,
  monthDayFormatter,
  SLOT_HEIGHT_PX,
  SLOT_INTERVAL_MINUTES,
  startOfWeek,
  toDateKey,
  weekdayLabelsFull,
  WORKING_DAY_COUNT,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";
import {
  type BookingsByDate,
  type ParsedBooking,
} from "@/types/bookings";

type WeekViewProps = {
  referenceDate: Date;
  selectedDate: Date | null;
  bookingsByDate: BookingsByDate;
  onSelectDate: (date: Date) => void;
  onBookingClick: (booking: ParsedBooking) => void;
};

export function WeekView({
  referenceDate,
  selectedDate,
  bookingsByDate,
  onSelectDate,
  onBookingClick,
}: WeekViewProps) {
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
    if (event.key === "Enter" || event.key === " ") {
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
