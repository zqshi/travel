export interface TripRequest {
  destination: string;
  start_date: string;
  end_date: string;
  travelers: number;
  budget_cny: number;
  preferences: string[];
  notes: string;
}

export interface POI {
  name: string;
  name_local?: string;
  category: string;
  address?: string;
  rating?: number;
  estimated_cost_thb?: number;
  source_url?: string;
  notes?: string;
}

export interface TransportOption {
  mode: string;
  from_location: string;
  to_location: string;
  duration_min?: number;
  estimated_cost_thb?: number;
  booking_url?: string;
  platform?: string;
}

export interface DayPlan {
  day: number;
  date: string;
  title: string;
  city: string;
  activities: POI[];
  transport: TransportOption[];
  meals: POI[];
  estimated_cost_thb: number;
}

export interface Itinerary {
  days: DayPlan[];
  total_estimated_thb: number;
  warnings: string[];
  sources: string[];
}

export interface PriceComparison {
  item_name: string;
  results: {
    platform: string;
    price_thb: number;
    price_cny: number;
    url: string;
    available: boolean;
    notes?: string;
  }[];
  recommendation: string;
}

export interface BudgetStatus {
  total_thb: number;
  total_cny: number;
  budget_cny: number;
  remaining_cny: number;
  usage_pct: number;
  status: "ok" | "warning" | "over_budget";
}

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  itinerary?: Itinerary;
};

// ─── Booking Types ───

export type BookingType = "flight" | "hotel" | "ticket" | "transport";

export type OrderStatus =
  | "pending"
  | "paying"
  | "paid"
  | "confirmed"
  | "cancelled"
  | "refunded"
  | "changed";

export interface Order {
  id: string;
  session_id: string;
  user_id: string;
  booking_type: BookingType;
  status: OrderStatus;
  item_name: string;
  item_detail: Record<string, unknown>;
  platform: string;
  price_thb: number;
  price_cny: number;
  payment_id?: string;
  booking_ref?: string;
  booked_date: string;
  travelers: number;
  contact_phone: string;
  contact_email: string;
  created_at: string;
  updated_at: string;
}

export interface BookingNotification {
  type: "notification";
  notification_type: "price_change" | "status_change" | "schedule_change" | "booking_confirmed";
  order_id: string;
  item_name?: string;
  old_status?: string;
  new_status?: string;
  old_price?: number;
  new_price?: number;
  detail?: string;
  booking_ref?: string;
  timestamp?: string;
}
