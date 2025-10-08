"use client";

import { type KeyboardEvent } from "react";

import { fullDateFormatter, formatMinutes } from "@/lib/calendar";
import { type ParsedBooking } from "@/types/bookings";

type ListViewProps = {
  bookings: ParsedBooking[];
  onBookingClick: (booking: ParsedBooking) => void;
};

export function ListView({ bookings, onBookingClick }: ListViewProps) {
  const handleRowClick = (booking: ParsedBooking) => {
    onBookingClick(booking);
  };

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    booking: ParsedBooking
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleRowClick(booking);focus-visible
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[250px_150px_150px_1fr] text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200 bg-white">
          <div className="px-4 py-3 text-left">日時</div>
          <div className="px-4 py-3 text-left">部署</div>
          <div className="px-4 py-3 text-left">担当</div>
          <div className="px-4 py-3 text-left">件名</div>
        </div>
        <div className="relative max-h-[calc(100vh-260px)] overflow-y-auto">
          <div className="divide-y divide-slate-200">
          {bookings.map((booking) => {
            const scheduleLabel = `${fullDateFormatter.format(booking.startDate)} ${formatMinutes(booking.startMinutes)}〜${formatMinutes(booking.endMinutes)}`;
            return (
              <div
                key={booking.id}
                role="button"
                tabIndex={0}
                onClick={() => handleRowClick(booking)}
                onKeyDown={(event) => handleRowKeyDown(event, booking)}
                className="grid grid-cols-[250px_150px_150px_1fr] cursor-pointer transition hover:bg-slate-50"
              >
                <div className="px-4 py-3 text-sm font-semibold text-slate-800">{scheduleLabel}</div>
                <div className="px-4 py-3">
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold"
                    style={{ backgroundColor: booking.color, color: booking.textColor }}
                  >
                    {booking.departmentName}
                  </span>
                </div>
                <div className="px-4 py-3 text-sm font-semibold text-slate-800">{booking.ownerName}</div>
                <div className="px-4 py-3 text-sm font-semibold text-slate-800">{booking.title}</div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
