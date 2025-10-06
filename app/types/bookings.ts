export type ViewType = "month" | "week" | "list" | "users" | "departments";

export type Booking = {
  id: string;
  title: string;
  departmentId: string;
  ownerUserId: string;
  start: string;
  end: string;
  isCompanyWide: boolean;
  description?: string;
};

export type ParsedBooking = Booking & {
  departmentName: string;
  ownerName: string;
  color: string;
  textColor: string;
  startDate: Date;
  endDate: Date;
  startDateKey: string;
  endDateKey: string;
  startMinutes: number;
  endMinutes: number;
};

export type BookingsByDate = Map<string, ParsedBooking[]>;

export type Department = {
  id: string;
  name: string;
  default_color: string;
};

export type User = {
  id: string;
  department_id: string;
  display_name: string;
  role: "admin" | "member";
};
