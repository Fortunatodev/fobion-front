/** Tipo de veículo */
export type VehicleType = "CAR" | "MOTORCYCLE" | "TRUCK" | "OTHER" | "SUV"

/** Status de um agendamento */
export type ScheduleStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "DONE"
  | "CANCELLED"

/** Método de pagamento */
export type PaymentMethod =
  | "PIX"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "CASH"
  | "PENDING"

/** Status de pagamento */
export type PaymentStatus = "PENDING" | "PAID" | "CANCELLED"

/** Intervalo de plano */
export type PlanInterval = "MONTHLY" | "YEARLY"

/** Status de assinatura */
export type SubscriptionStatus = "ACTIVE" | "CANCELLED" | "EXPIRED" | "PENDING"

/** Plano da Forbion (pago pelo dono) */
export type BusinessPlan = "FREE" | "PRO"

/** Role do usuário no sistema */
export type UserRole = "OWNER" | "ADMIN" | "EMPLOYEE"

/** Horário de funcionamento do negócio */
export interface BusinessHours {
  id: string
  businessId: string
  /** 0 = Domingo, 1 = Segunda, ..., 6 = Sábado */
  dayOfWeek: number
  isOpen: boolean
  /** Formato HH:mm */
  openTime: string
  /** Formato HH:mm */
  closeTime: string
}

/** Usuário autenticado */
export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  picture?: string
  businessId: string
  createdAt: string
  updatedAt: string
}

/** Negócio cadastrado na plataforma */
export interface Business {
  id: string
  name: string
  slug: string
  email: string
  phone: string
  cnpj?: string
  description?: string
  address?: string
  coverImage?: string
  city?: string
  state?: string
  plan: BusinessPlan
  planExpiresAt?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  hours?: BusinessHours[]
}

/** Serviço oferecido pela estética */
export interface Service {
  id: string
  businessId: string
  name: string
  description?: string
  /** Preço em centavos */
  price: number
  durationMinutes: number
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

/** Veículo de um cliente */
export interface Vehicle {
  id: string
  customerId: string
  businessId: string
  plate: string
  brand?: string
  model?: string
  color?: string
  type: VehicleType
  createdAt: string
  updatedAt?: string
}

/** Cliente da estética */
export interface Customer {
  id: string
  businessId: string
  name: string
  phone: string
  email?: string
  createdAt: string
  updatedAt?: string
  vehicles?: Vehicle[]
  _count?: {
    schedules: number
    subscriptions: number
  }
}

/** Serviço vinculado a um agendamento (snapshot de preço) */
export interface ScheduleService {
  id: string
  scheduleId: string
  serviceId: string
  /** Preço em centavos no momento do agendamento */
  priceSnapshot: number
  service?: Service
}

/** Agendamento */
export interface Schedule {
  id: string
  /** ISO datetime */
  scheduledAt: string
  status: ScheduleStatus
  /** Observações do agendamento */
  notes?: string
  /** Preço total em centavos (já com desconto) */
  totalPrice: number
  /** Método de pagamento escolhido */
  paymentMethod: PaymentMethod
  /** Status do pagamento */
  paymentStatus: PaymentStatus
  /** Data e hora em que o pagamento foi confirmado */
  paidAt?: string
  /** Data e hora em que o agendamento foi encerrado */
  closedAt?: string
  /** Indica se o agendamento é de um assinante */
  isSubscriber: boolean
  /** Desconto aplicado em centavos */
  discountApplied: number
  /** ID do veículo associado ao agendamento */
  vehicleId: string
  /** ID do cliente que fez o agendamento */
  customerId: string
  /** ID do negócio onde o agendamento foi feito */
  businessId: string
  createdAt: string
  updatedAt?: string
  customer?: Customer
  vehicle?: Vehicle
  scheduleServices?: ScheduleService[]
}

/** Plano de assinatura criado pelo dono para seus clientes */
export interface CustomerPlan {
  id: string
  businessId: string
  name: string
  description?: string
  /** Preço em centavos por ciclo */
  price: number
  interval: PlanInterval
  /** Percentual de desconto nos serviços (0-100) */
  discountPercent: number
  cactopayPaymentLink?: string
  isActive: boolean
  createdAt: string
  updatedAt?: string
  _count?: {
    subscriptions: number
  }
}

/** Assinatura de um cliente em um plano */
export interface CustomerSubscription {
  id: string
  businessId: string
  customerId: string
  customerPlanId: string
  status: SubscriptionStatus
  /** ISO datetime */
  startedAt?: string
  cancelledAt?: string
  createdAt: string
  updatedAt?: string
  customer?: Customer
  customerPlan?: CustomerPlan
}

/** Métricas do dashboard */
export interface DashboardMetrics {
  schedulesToday: number
  monthRevenue: number
  totalCustomers: number
  activeSubscribers: number
  weeklyRevenue: Array<{ day: string; value: number }>
  nextSchedules: Schedule[]
  todaySchedules: Schedule[]
}

/** Wrapper genérico de resposta da API */
export interface ApiResponse<T> {
  data: T
  message?: string
  total?: number
  page?: number
  totalPages?: number
}

/** Payload decodificado do JWT */
export interface TokenPayload {
  userId: string
  businessId: string
  role: UserRole
  iat: number
  exp: number
}

/** Dados da loja pública */
export interface PublicBusiness {
  id: string
  name: string
  slug: string
  email: string
  phone: string
  description?: string
  address?: string
  coverImage?: string
  city?: string
  state?: string
  services: Service[]
  hours: BusinessHours[]
  plans?: CustomerPlan[]
}
