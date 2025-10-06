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
      handleRowClick(booking);
    }
  };

  return (
    <div className="relative max-h-[calc(100vh-260px)] overflow-y-auto overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="min-w-[720px]">
        <div className="sticky top-0 z-10 grid grid-cols-[250px_1fr_150px_150px] bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <div className="px-4 py-3 text-left">日時</div>
          <div className="px-4 py-3 text-left">件名</div>
          <div className="px-4 py-3 text-left">担当</div>
          <div className="px-4 py-3 text-left">部署</div>
        </div>
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
                className="grid grid-cols-[250px_1fr_150px_150px] cursor-pointer transition hover:bg-slate-50 focus:outline-none focus-visible:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <div className="px-4 py-3 text-sm font-semibold text-slate-800">{scheduleLabel}</div>
                <div className="px-4 py-3 text-sm font-semibold text-slate-800">{booking.title}</div>
                <div className="px-4 py-3 text-sm font-semibold text-slate-800">{booking.ownerName}</div>
                <div className="px-4 py-3">
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold"
                    style={{ backgroundColor: booking.color, color: booking.textColor }}
                  >
                    {booking.departmentName}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
