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
    event: KeyboardEvent<HTMLElement>,
    booking: ParsedBooking
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleRowClick(booking);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Mobile (md-) card list: no fixed header */}
      <div className="md:hidden">
        <div className="relative">
          <div className="p-2 space-y-2">
            {bookings.map((booking) => {
              const scheduleLabel = `${fullDateFormatter.format(booking.startDate)} ${formatMinutes(booking.startMinutes)}〜${formatMinutes(booking.endMinutes)}`;
              return (
                <button
                  key={booking.id}
                  tabIndex={0}
                  onClick={() => handleRowClick(booking)}
                  onKeyDown={(event) => handleRowKeyDown(event, booking)}
                  className="w-full text-left rounded-lg border border-slate-200 bg-white p-3 transition hover:bg-slate-50/80 focus-visible:bg-slate-50/80 focus-visible:outline-none"
                >
                  <div className="text-xs font-bold text-slate-800">{scheduleLabel}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold"
                      style={{ backgroundColor: booking.color, color: booking.textColor }}
                    >
                      {booking.departmentName}
                    </span>
                    <span className="text-xs font-medium text-slate-700">{booking.ownerName}</span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 line-clamp-2">{booking.title}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop (md+) table-like view with header */}
      <div className="hidden md:block overflow-x-auto">
        <div className="md:min-w-[720px]">
          <div className="grid grid-cols-[250px_150px_150px_1fr] text-xs font-semibold uppercase tracking-wide text-slate-800 border-b border-slate-200 bg-white">
            <div className="px-4 py-3 text-left">日時</div>
            <div className="px-4 py-3 text-left">部署</div>
            <div className="px-4 py-3 text-left">担当</div>
            <div className="px-4 py-3 text-left">件名</div>
          </div>
          <div className="relative max-h-[calc(100svh-260px)] lg:max-h-[calc(100vh-260px)] overflow-y-auto overflow-x-auto">
            <div className="divide-y divide-slate-200">
              {bookings.map((booking) => {
                const scheduleLabel = `${fullDateFormatter.format(booking.startDate)} ${formatMinutes(booking.startMinutes)}〜${formatMinutes(booking.endMinutes)}`;
                return (
                  <button
                    key={booking.id}
                    tabIndex={0}
                    onClick={() => handleRowClick(booking)}
                    onKeyDown={(event) => handleRowKeyDown(event, booking)}
                    className="w-full text-left grid grid-cols-[250px_150px_150px_1fr] transition hover:bg-slate-50/80 focus-visible:bg-slate-50/80 focus-visible:outline-none"
                  >
                    <span className="px-4 py-3 text-sm font-semibold text-slate-800">{scheduleLabel}</span>
                    <span className="px-4 py-3">
                      <span
                        className="inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold"
                        style={{ backgroundColor: booking.color, color: booking.textColor }}
                      >
                        {booking.departmentName}
                      </span>
                    </span>
                    <span className="px-4 py-3 text-sm font-semibold text-slate-800">{booking.ownerName}</span>
                    <span className="px-4 py-3 text-sm font-semibold text-slate-800">{booking.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
