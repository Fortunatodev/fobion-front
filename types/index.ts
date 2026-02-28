export interface BusinessHours {
  id: string;
  businessId: string;
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  picture?: string;
  avatar?: string;
  role: "OWNER" | "ADMIN" | "EMPLOYEE";
  businessId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  address?: string;
  logo?: string;
  plan: "FREE" | "PRO";
  planExpiresAt?: string | null;
  hours?: BusinessHours[];
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  brand?: string;
  model?: string;
  color?: string;
  type?: string;
  customerId: string;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  durationMinutes?: number;
  duration?: number;
  description?: string;
  isActive?: boolean;
}

export interface ScheduleService {
  id?: string;
  scheduleId?: string;
  serviceId?: string;
  priceSnapshot?: number;
  service?: Service;
}

export interface Schedule {
  id: string;
  scheduledAt: string;
  status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "DONE" | "COMPLETED" | "CANCELLED";
  paymentStatus: "PENDING" | "PAID" | "CANCELLED";
  paymentMethod?: string;
  totalPrice: number;
  notes?: string;
  isSubscriber?: boolean;
  discountApplied?: number;
  customer?: Customer;
  vehicle?: Vehicle;
  scheduleServices?: ScheduleService[];
}

export interface CustomerPlan {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  price: number;
  interval: "MONTHLY" | "YEARLY";
  discountPercent: number;
  isActive: boolean;
}

export interface CustomerSubscription {
  id: string;
  businessId: string;
  customerId: string;
  customerPlanId: string;
  status: "ACTIVE" | "CANCELLED" | "EXPIRED" | "PENDING";
  customerPlan?: CustomerPlan;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  interval: "MONTHLY" | "YEARLY";
  features: string[];
}

export interface Subscription {
  id: string;
  status: "ACTIVE" | "CANCELLED" | "EXPIRED";
  customerId: string;
  planId: string;
  startDate: string;
  endDate?: string;
}
