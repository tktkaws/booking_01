"use client";

import { useEffect, useRef } from "react";

import { formatMinutes, fullDateFormatter } from "@/lib/calendar";
import { type ParsedBooking } from "@/types/bookings";

type ReservationDetailModalProps = {
  open: boolean;
  booking: ParsedBooking | null;
  onClose: () => void;
};

export function ReservationDetailModal({ open, booking, onClose }: ReservationDetailModalProps) {
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
