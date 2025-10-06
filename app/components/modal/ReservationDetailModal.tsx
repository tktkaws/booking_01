"use client";

import { useEffect, useRef } from "react";

import { formatMinutes, fullDateFormatter } from "@/lib/calendar";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { type ParsedBooking } from "@/types/bookings";

type ReservationDetailModalProps = {
  open: boolean;
  booking: ParsedBooking | null;
  onClose: () => void;
  onEditRequest?: (booking: ParsedBooking) => void;
  userId: string | null;
  isAdmin: boolean;
};

export function ReservationDetailModal({ open, booking, onClose, onEditRequest, userId, isAdmin }: ReservationDetailModalProps) {
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
    const handleBackdropClick = (event: MouseEvent) => {
      const rect = dialog.getBoundingClientRect();
      const isInDialog =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!isInDialog) {
        event.preventDefault();
        onClose();
      }
    };
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    const handleClose = () => {
      onClose();
    };
    dialog.addEventListener("mousedown", handleBackdropClick);
    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("mousedown", handleBackdropClick);
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleClose);
    };
  }, [onClose]);

  if (!booking) {
    return null;
  }

  const scheduleLabel = `${fullDateFormatter.format(booking.startDate)} ${formatMinutes(booking.startMinutes)}〜${formatMinutes(booking.endMinutes)}`;
  const canEdit = isAdmin || (userId && booking.ownerUserId === userId);

  const handleEdit = () => {
    if (!booking) return;
    onEditRequest?.(booking);
  };

  const handleDelete = async () => {
    if (!booking) return;
    const supabase = getSupabaseBrowserClient();
    if (!confirm("この予約を削除しますか？")) return;
    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", Number(booking.id));
    if (error) {
      alert(`削除に失敗しました: ${error.message}`);
      return;
    }
    window.dispatchEvent(new CustomEvent("bookings:changed"));
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="fixed left-1/2 top-1/2 max-h-[80vh] w-[min(520px,90vw)] -translate-x-1/2 -translate-y-1/2 transform overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/60"
    >
      <div className="flex max-h-[80vh] flex-col">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{booking.title}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{booking.departmentName}</span>
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
        <div className="space-y-4 overflow-y-auto px-6 py-6 text-sm text-slate-700">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold text-slate-500">日時</div>
            <div className="mt-1 font-medium text-slate-800">{scheduleLabel}</div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 px-4 py-3">
              <div className="text-xs font-semibold text-slate-500">担当者</div>
              <div className="mt-1 font-medium text-slate-800">{booking.ownerName}</div>
            </div>
            <div className="rounded-lg border border-slate-200 px-4 py-3">
              <div className="text-xs font-semibold text-slate-500">部署</div>
              <div className="mt-1 font-medium text-slate-800">{booking.departmentName}</div>
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
          {canEdit && (
            <>
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
            </>
          )}
        </footer>
      </div>
    </dialog>
  );
}
