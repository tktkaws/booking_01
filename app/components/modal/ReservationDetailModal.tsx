"use client";

import { useEffect, useRef } from "react";
import { X } from 'lucide-react';

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

export function ReservationDetailModal({
  open,
  booking,
  onClose,
  onEditRequest,
  userId,
  isAdmin,
}: ReservationDetailModalProps) {
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

  const scheduleLabel = `${fullDateFormatter.format(
    booking.startDate
  )} ${formatMinutes(booking.startMinutes)}〜${formatMinutes(
    booking.endMinutes
  )}`;
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
      className="fixed left-1/2 top-1/2 max-h-[80vh] w-[min(520px,90vw)] -translate-x-1/2 -translate-y-1/2 transform overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-800/60"
    >
      <div className="flex max-h-[80vh] flex-col">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">予約詳細</h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded p-2 text-slate-600 hover:ring-2 hover:bg-slate-50"
            aria-label="モーダルを閉じる"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>
        <div className="overflow-y-auto px-6 py-6 text-sm text-slate-700">
          <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-3">
            <dt className="px-4 text-sm font-semibold text-slate-700">日時</dt>
            <dd className="px-4 font-medium text-slate-800">{scheduleLabel}</dd>

            <dt className="px-4 text-sm font-semibold text-slate-700">部署</dt>
            <dd className="px-4">
              <span
                className="inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold"
                style={{ backgroundColor: booking.color, color: booking.textColor }}
              >
                {booking.departmentName}
              </span>
            </dd>

            <dt className="px-4 text-sm font-semibold text-slate-700">担当者</dt>
            <dd className="px-4 font-medium text-slate-800">{booking.ownerName}</dd>

            <dt className="px-4 text-sm font-semibold text-slate-700">タイトル</dt>
            <dd className="px-4 font-medium text-slate-800">{booking.title}</dd>

            {booking.description && (
              <>
                <dt className="px-4 text-sm font-semibold text-slate-700">メモ</dt>
                <dd className="px-4 whitespace-pre-wrap font-medium text-slate-800">{booking.description}</dd>
              </>
            )}
          </dl>
        </div>
        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 min-h-[56px]">
          {canEdit ? (
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
                className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm"
              >
                編集
              </button>
            </>
          ) : (
            // 権限がない場合もフッターの高さを維持
            <div aria-hidden className="h-0" />
          )}
        </footer>
      </div>
    </dialog>
  );
}
