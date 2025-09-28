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
                <td className="px-4 py-3 text-xs text-slate-500">{scheduleLabel}</td>
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
