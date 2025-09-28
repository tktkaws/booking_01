export type ViewType = "month" | "week" | "list";

export type Booking = {
  id: string;
  title: string;
  room: string;
  department: string;
  owner: string;
  start: string;
  end: string;
  isCompanyWide: boolean;
  color: string;
  textColor: string;
  description?: string;
};

export type ParsedBooking = Booking & {
  startDate: Date;
  endDate: Date;
  startDateKey: string;
  endDateKey: string;
  startMinutes: number;
  endMinutes: number;
};

export type BookingsByDate = Map<string, ParsedBooking[]>;
