"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  formatMinutes,
  fromDateKey,
  fullDateFormatter,
  monthDayFormatter,
  TIME_SLOTS,
  toDateKey,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { type BookingsByDate } from "@/types/bookings";

type CreateBookingModalProps = {
  open: boolean;
  onClose: () => void;
  selectedDate: Date;
  bookingsByDate: BookingsByDate;
  departments: string[];
};

export function CreateBookingModal({
  open,
  onClose,
  selectedDate,
  bookingsByDate,
  departments,
}: CreateBookingModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const startDetailsRef = useRef<HTMLDetailsElement>(null);
  const endDetailsRef = useRef<HTMLDetailsElement>(null);

  const dateKey = toDateKey(selectedDate);

  const initialFormState = useMemo(() => {
    return {
      title: "",
      department: departments[0] ?? "所属未設定",
      date: dateKey,
      start: "09:00",
      end: "09:30",
      isCompanyWide: false,
      description: "",
    };
  }, [departments, dateKey]);

  const [formState, setFormState] = useState(initialFormState);

  const formDateKey = formState.date || dateKey;
  const formDate = useMemo(() => fromDateKey(formDateKey), [formDateKey]);
  const dailyBookings = useMemo(() => {
    return bookingsByDate.get(formDateKey) ?? [];
  }, [bookingsByDate, formDateKey]);

  useEffect(() => {
    setFormState(initialFormState);
  }, [initialFormState, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close("dismiss");
    }
  }, [open]);

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

  const handleFieldChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type, checked } = event.target;
    setFormState((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (name === "start") {
      startDetailsRef.current?.removeAttribute("open");
    }
    if (name === "end") {
      endDetailsRef.current?.removeAttribute("open");
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.table(formState);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="fixed left-1/2 top-1/2 max-h-[90vh] w-[min(720px,90vw)] -translate-x-1/2 -translate-y-1/2 transform rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/60"
    >
      <form method="dialog" className="flex flex-col" onSubmit={handleSubmit}>
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">予約を作成</h2>
            <p className="text-xs text-slate-500">
              {fullDateFormatter.format(formDate)} の会議室予約を登録します
            </p>
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
        <div className="grid max-h-[60vh] grid-cols-1 gap-6 overflow-y-auto px-6 py-6 sm:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-4">
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
                日付
                <input
                  type="date"
                  name="date"
                  value={formState.date}
                  onChange={handleFieldChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>
              <div className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                <span>開始</span>
                <details
                  ref={startDetailsRef}
                  className="group relative"
                  onToggle={(event) => {
                    if (event.currentTarget.open) {
                      endDetailsRef.current?.removeAttribute("open");
                    }
                  }}
                >
                  <summary className="flex w-full list-none items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50/80 focus:outline-none focus:ring-2 focus:ring-blue-200 [&::-webkit-details-marker]:hidden">
                    <span>{formState.start}</span>
                    <span className="text-xs text-slate-500">変更</span>
                  </summary>
                  <div className="absolute left-0 top-full z-30 mt-2 hidden w-[min(360px,calc(100vw-5rem))] rounded-lg border border-slate-200 bg-white p-3 shadow-xl group-open:grid group-open:grid-cols-4 group-open:gap-2">
                    {TIME_SLOTS.map((slot) => {
                      const id = `start-${slot}`;
                      const isSelected = formState.start === slot;
                      return (
                        <label
                          key={id}
                          htmlFor={id}
                          className={cn(
                            "cursor-pointer rounded-md border px-3 py-2 text-center text-xs font-semibold transition",
                            isSelected
                              ? "border-blue-500 bg-blue-50 text-blue-700 shadow"
                              : "border-slate-300 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/80"
                          )}
                        >
                          <input
                            id={id}
                            type="radio"
                            name="start"
                            value={slot}
                            checked={isSelected}
                            onChange={handleFieldChange}
                            className="sr-only"
                          />
                          {slot}
                        </label>
                      );
                    })}
                  </div>
                </details>
              </div>
              <div className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                <span>終了</span>
                <details
                  ref={endDetailsRef}
                  className="group relative"
                  onToggle={(event) => {
                    if (event.currentTarget.open) {
                      startDetailsRef.current?.removeAttribute("open");
                    }
                  }}
                >
                  <summary className="flex w-full list-none items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50/80 focus:outline-none focus:ring-2 focus:ring-blue-200 [&::-webkit-details-marker]:hidden">
                    <span>{formState.end}</span>
                    <span className="text-xs text-slate-500">変更</span>
                  </summary>
                  <div className="absolute left-0 top-full z-30 mt-2 hidden w-[min(360px,calc(100vw-5rem))] rounded-lg border border-slate-200 bg-white p-3 shadow-xl group-open:grid group-open:grid-cols-4 group-open:gap-2">
                    {TIME_SLOTS.map((slot) => {
                      const id = `end-${slot}`;
                      const isSelected = formState.end === slot;
                      return (
                        <label
                          key={id}
                          htmlFor={id}
                          className={cn(
                            "cursor-pointer rounded-md border px-3 py-2 text-center text-xs font-semibold transition",
                            isSelected
                              ? "border-blue-500 bg-blue-50 text-blue-700 shadow"
                              : "border-slate-300 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/80"
                          )}
                        >
                          <input
                            id={id}
                            type="radio"
                            name="end"
                            value={slot}
                            checked={isSelected}
                            onChange={handleFieldChange}
                            className="sr-only"
                          />
                          {slot}
                        </label>
                      );
                    })}
                  </div>
                </details>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                name="isCompanyWide"
                checked={formState.isCompanyWide}
                onChange={handleFieldChange}
                className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              全社共有として表示する
            </label>
            <div className="space-y-2">
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
                件名
                <input
                  required
                  name="title"
                  value={formState.title}
                  onChange={handleFieldChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="例: 9月度プロジェクト定例"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
              メモ
              <textarea
                name="description"
                value={formState.description}
                onChange={handleFieldChange}
                rows={4}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="議題や参加者を記入してください"
              />
            </label>
          </section>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">
              {monthDayFormatter.format(formDate)} の予約状況
            </h3>
            <div className="space-y-2">
              {dailyBookings.length === 0 && (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  登録済みの予約はありません。
                </p>
              )}
              {dailyBookings.map((booking) => (
                <div
                  key={`modal-booking-${booking.id}`}
                  className="space-y-1 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div
                    className="truncate rounded-md px-2 py-1 text-xs font-semibold"
                    style={{ backgroundColor: booking.color, color: booking.textColor }}
                  >
                    {booking.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span>
                      {formatMinutes(booking.startMinutes)}〜{formatMinutes(booking.endMinutes)}
                    </span>
                    <span aria-hidden>•</span>
                    <span>{booking.departmentName}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        <footer className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400"
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            保存する
          </button>
        </footer>
      </form>
    </dialog>
  );
}
