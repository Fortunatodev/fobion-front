"use client"

import { useState, useEffect, useCallback, useMemo, useRef, Component, type ReactNode } from "react"
import {
  Calendar, Clock, Search,
  Plus, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Car,
  CreditCard, AlertCircle, X,
  Banknote, QrCode,
  User, FileText, Bike, Truck, CarFront,
  Link2,
  CalendarCheck, PlayCircle, CheckCircle,
} from "lucide-react"
import { toast } from "sonner"
import { apiGet, apiPut, apiPost } from "@/lib/api"
import { useNotificationsSSE } from "@/lib/useNotificationsSSE"
import { formatScheduleTime } from "@/lib/dateUtils"
import { useUser } from "@/contexts/UserContext"
import { buildWhatsAppLink } from "@/lib/utils"
import TabTutorial from "@/components/shared/TabTutorial"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Schedule {
  id: string
  scheduledAt: string
  status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "DONE" | "CANCELLED"
  totalPrice: number
  paymentStatus: "PENDING" | "PAID"
  paymentMethod: "PIX" | "CREDIT_CARD" | "DEBIT_CARD" | "CASH" | null
  notes: string | null
  isSubscriber: boolean
  discountApplied: number
  // Em dados reais, qualquer relação/campo opcional pode vir null/ausente
  // (placa/marca de veículo são comuns de faltar em estética; profissional é opcional).
  customer: { id: string; name: string | null; phone: string | null } | null
  vehicle: { id: string; plate: string | null; brand: string | null; model: string | null; color: string | null } | null
  scheduleServices?: Array<{ service: { id: string; name: string | null; price: number } | null } | null> | null
}

interface PublicService {
  id: string
  name: string
  price: number
  durationMinutes: number
}

interface CustomerResult {
  id: string
  name: string
  phone: string
  email?: string
  vehicles: Array<{
    id: string
    plate: string
    brand: string
    model: string
    color: string
    type: string
  }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidDate(d: Date): boolean {
  return !Number.isNaN(d.getTime())
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return isValidDate(d) ? formatScheduleTime(d) : "—"
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return isValidDate(d) ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDateHeader(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00")
  return {
    weekday: d.toLocaleDateString("pt-BR", { weekday: "long" }),
    day:     d.toLocaleDateString("pt-BR", { day: "numeric" }),
    month:   d.toLocaleDateString("pt-BR", { month: "long" }),
    year:    d.toLocaleDateString("pt-BR", { year: "numeric" }),
  }
}

function getStatusConfig(status: string) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    REQUESTED:   { label: "Solicitado",   color: "#F59E0B", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.30)"  },
    PENDING:     { label: "Pendente",     color: "#FBBF24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.25)"  },
    CONFIRMED:   { label: "Confirmado",   color: "#3B82F6", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.25)"  },
    IN_PROGRESS: { label: "Em andamento", color: "#8B5CF6", bg: "rgba(139,92,246,0.08)",  border: "rgba(139,92,246,0.25)"  },
    DONE:        { label: "Concluído",    color: "#10B981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.25)"  },
    CANCELLED:   { label: "Cancelado",    color: "#EF4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)"   },
  }
  return map[status] ?? { label: status, color: "var(--c-text-2)", bg: "rgba(161,161,170,0.08)", border: "rgba(161,161,170,0.2)" }
}

function getPaymentMethodLabel(method: string | null): string {
  const map: Record<string, string> = { PIX: "PIX", CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito", CASH: "Dinheiro" }
  return method ? (map[method] ?? "—") : "—"
}

// Getters defensivos: dados reais de agendamento podem ter campos null
// (placa/marca de veículo, profissional ausente, nome de cliente vazio).
function customerName(s: Schedule): string {
  return s.customer?.name?.trim() || "Cliente"
}
function vehicleLabel(s: Schedule): string {
  return [s.vehicle?.brand, s.vehicle?.model].filter(Boolean).join(" ") || "Veículo"
}
function serviceNamesOf(s: Schedule): string {
  return (s.scheduleServices ?? [])
    .map((ss) => ss?.service?.name)
    .filter(Boolean)
    .join(", ")
}

// Resiliência por item: isola cada card num error boundary. Um agendamento
// malformado vira um card de fallback em vez de derrubar a tela inteira.
class CardErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)",
          borderRadius: 14, padding: "14px 18px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <AlertCircle size={15} color="var(--c-text-4)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--c-text-4)" }}>
            Não foi possível exibir este agendamento.
          </span>
        </div>
      )
    }
    return this.props.children
  }
}

const STATUS_FILTERS = [
  { value: "",            label: "Todos"        },
  { value: "PENDING",     label: "Pendente"     },
  { value: "CONFIRMED",   label: "Confirmado"   },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "DONE",        label: "Concluído"    },
  { value: "CANCELLED",   label: "Cancelado"    },
]

const PAYMENT_METHODS = [
  { value: "PIX",         label: "PIX",      icon: QrCode     },
  { value: "CREDIT_CARD", label: "Crédito",  icon: CreditCard },
  { value: "DEBIT_CARD",  label: "Débito",   icon: CreditCard },
  { value: "CASH",        label: "Dinheiro", icon: Banknote   },
]

// Quantos cards renderizar de início; "Carregar mais" cresce em passos deste tamanho.
// Não altera os dados buscados nem a ordem — só limita o que vai pro DOM por vez.
const LIST_PAGE_SIZE = 30

const VEHICLE_TYPES = ["CAR", "MOTORCYCLE", "TRUCK", "SUV"]
const VEHICLE_TYPE_LABELS: Record<string, string> = {
  CAR: "Carro", MOTORCYCLE: "Moto", TRUCK: "Caminhão", SUV: "SUV",
}
// Ícones lucide por tipo de veículo (sem emoji em UI).
const VEHICLE_TYPE_ICONS: Record<string, typeof Car> = {
  CAR: Car, MOTORCYCLE: Bike, TRUCK: Truck, SUV: CarFront,
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid ${color}30`, borderTopColor: color,
      animation: "spin 0.7s linear infinite", flexShrink: 0,
    }} />
  )
}

// ── ActionButton ──────────────────────────────────────────────────────────────

function ActionButton({ onClick, loading, color, bg, border: bc, children }: {
  onClick: () => void; loading: boolean
  color: string; bg: string; border: string; children: React.ReactNode
}) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} disabled={loading}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        height: 34, padding: "0 14px", borderRadius: 8,
        fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
        transition: "all 0.15s", display: "flex", gap: 6, alignItems: "center",
        backgroundColor: bg, border: `1px solid ${bc}`, color,
        opacity: hov ? 0.75 : 1, whiteSpace: "nowrap", flex: 1, justifyContent: "center",
        fontFamily: "inherit",
      }}
    >
      {loading ? <Spinner size={12} color={color} /> : children}
    </button>
  )
}

// ── NfseEmBreveSelo ───────────────────────────────────────────────────────
// NF-e é recurso Premium ("em breve"). Em vez de um botão desabilitado (que
// parece quebrado), mostramos só um selo discreto e informativo. O motor de
// emissão (NfseButton) fica fora até o Premium liberar.

function NfseEmBreveSelo() {
  return (
    <span
      title="Emissão de NF-e chega no plano Premium"
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 10, fontWeight: 600, color: "#A5B4FC",
        background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.25)",
        borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap",
      }}
    >
      <FileText size={11} /> NF-e em breve
    </span>
  )
}

// ── FInput ────────────────────────────────────────────────────────────────────

function FInput({ label, value, onChange, placeholder, required, type = "text", disabled, error, inputRef }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; type?: string; disabled?: boolean
  error?: string; inputRef?: React.Ref<HTMLInputElement>
}) {
  const [focused, setFocused] = useState(false)
  const borderColor = error
    ? "#EF4444"
    : focused && !disabled
      ? "rgba(0,102,255,0.4)"
      : "var(--c-border)"
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <label style={{ fontSize: 11, fontWeight: 500, color: "var(--c-text-3)", letterSpacing: "0.03em" }}>
        {label}{required && <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>}
      </label>
      <input
        ref={inputRef}
        type={type}
        value={value}
        disabled={disabled}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{
          height: 40, backgroundColor: disabled ? "var(--c-bg)" : "var(--c-elevated)",
          border: `1px solid ${borderColor}`,
          boxShadow: error ? "0 0 0 1px rgba(239,68,68,0.35)" : "none",
          borderRadius: 9, padding: "0 12px",
          fontSize: 13, color: disabled ? "var(--c-text-4)" : "var(--c-text)", outline: "none",
          transition: "border-color 0.15s, box-shadow 0.15s", fontFamily: "inherit",
          boxSizing: "border-box", width: "100%",
          cursor: disabled ? "not-allowed" : "text",
        }}
      />
      {error && (
        <span style={{ fontSize: 11, fontWeight: 500, color: "#EF4444", display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={11} style={{ flexShrink: 0 }} /> {error}
        </span>
      )}
    </div>
  )
}

// ── CustomerSearch ────────────────────────────────────────────────────────────

function CustomerSearch({ onSelect }: {
  onSelect: (c: CustomerResult) => void
}) {
  const [query,    setQuery]    = useState("")
  const [results,  setResults]  = useState<CustomerResult[]>([])
  const [loading,  setLoading]  = useState(false)
  const [open,     setOpen]     = useState(false)
  const [focused,  setFocused]  = useState(false)
  const debounce   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (query.length < 2) { setResults([]); setOpen(false); return }

    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await apiGet<{ customers: CustomerResult[] }>(`/customers?search=${encodeURIComponent(query)}&limit=6`)
        setResults(res.customers ?? [])
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query])

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <label style={{ fontSize: 11, fontWeight: 500, color: "var(--c-text-3)", letterSpacing: "0.03em", display: "block", marginBottom: 5 }}>
        Buscar cliente existente
      </label>
      <div style={{ position: "relative" }}>
        <Search size={13} style={{
          position: "absolute", left: 11, top: "50%",
          transform: "translateY(-50%)", color: "var(--c-text-4)", pointerEvents: "none",
        }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { setFocused(true); if (results.length > 0) setOpen(true) }}
          onBlur={() => setFocused(false)}
          placeholder="Nome ou telefone..."
          style={{
            width: "100%", height: 40, backgroundColor: "var(--c-elevated)",
            border: `1px solid ${focused ? "rgba(0,102,255,0.4)" : "var(--c-border)"}`,
            borderRadius: 9, paddingLeft: 32, paddingRight: loading ? 36 : 12,
            fontSize: 13, color: "var(--c-text)", outline: "none",
            transition: "border-color 0.15s", fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
        {loading && (
          <div style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)" }}>
            <Spinner size={12} color="var(--c-text-4)" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border-2)",
          borderRadius: 10, overflow: "hidden",
          zIndex: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          animation: "fadeIn 0.15s ease",
        }}>
          {results.map((c, i) => (
            <button
              key={c.id}
              onMouseDown={(e) => { e.preventDefault(); onSelect(c); setQuery(""); setOpen(false) }}
              style={{
                width: "100%", padding: "10px 12px",
                backgroundColor: "transparent", border: "none",
                borderBottom: i < results.length - 1 ? "1px solid var(--c-border)" : "none",
                cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 10,
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--c-border)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <div style={{
                width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                backgroundColor: "var(--c-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <User size={14} color="var(--c-text-4)" />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.name}
                </p>
                <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
                  {c.phone}{c.vehicles.length > 0 ? ` · ${c.vehicles.length} veículo${c.vehicles.length !== 1 ? "s" : ""}` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && !loading && query.length >= 2 && results.length === 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border-2)",
          borderRadius: 10, padding: "12px", zIndex: 200,
          textAlign: "center",
        }}>
          <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: 0 }}>Nenhum cliente encontrado</p>
        </div>
      )}
    </div>
  )
}

// ── NovoAgendamentoModal ──────────────────────────────────────────────────────

interface EmployeeOption {
  id: string
  name: string
  avatarUrl: string | null
  role?: string
}

interface SlotItem {
  time: string
  available: boolean
}

const MONTHS_PT   = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
const WEEKDAYS_PT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]

function isPastDate(dateStr: string): boolean {
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(dateStr + "T00:00:00"); d.setHours(0,0,0,0)
  return d < today
}

function NovoAgendamentoModal({
  isMobile,
  onClose,
  onSuccess,
  prefill,
}: {
  isMobile: boolean; onClose: () => void; onSuccess: () => void
  prefill?: { customerId: string; customerName: string; serviceIds: string[] } | null
}) {
  const { user } = useUser()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Business slug (needed for public endpoints)
  const [businessSlug, setBusinessSlug] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState("")

  // Services
  const [services,         setServices]         = useState<PublicService[]>([])
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [loadingServices,  setLoadingServices]  = useState(true)

  // Employees
  const [employees,        setEmployees]        = useState<EmployeeOption[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>("owner")
  const [loadingEmployees, setLoadingEmployees] = useState(false)

  // Calendar / Slots
  const [calendarMonth,  setCalendarMonth]  = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [selectedDate,   setSelectedDate]   = useState("")
  const [selectedSlot,   setSelectedSlot]   = useState("")
  const [availableSlots, setAvailableSlots] = useState<SlotItem[]>([])
  const [loadingSlots,   setLoadingSlots]   = useState(false)

  // Customer
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [customerName,  setCustomerName]  = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")

  // Vehicle
  const [existingVehicles,  setExistingVehicles]  = useState<CustomerResult["vehicles"]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [vehiclePlate, setVehiclePlate] = useState("")
  const [vehicleBrand, setVehicleBrand] = useState("")
  const [vehicleModel, setVehicleModel] = useState("")
  const [vehicleColor, setVehicleColor] = useState("")
  const [vehicleType,  setVehicleType]  = useState("CAR")

  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Erros de campos obrigatórios por chave (ex.: "customerName", "vehicleModel").
  // Some assim que o usuário corrige o campo (ver clearFieldError nos onChange).
  type FieldKey = "customerName" | "vehicleModel" | "vehicleColor"
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const nameRef  = useRef<HTMLInputElement>(null)
  const modelRef = useRef<HTMLInputElement>(null)
  const colorRef = useRef<HTMLInputElement>(null)

  function clearFieldError(key: FieldKey) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

  // ── Load business slug + services ────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoadingServices(true)
      try {
        // Fetch slug from /auth/me (includes business)
        const meRes = await apiGet<{ user: { businessId: string }; business?: { slug: string; name?: string } }>("/auth/me")
        if (meRes.business?.slug) setBusinessSlug(meRes.business.slug)
        if (meRes.business?.name) setBusinessName(meRes.business.name)

        const res = await apiGet<{ services: PublicService[] }>("/services")
        setServices(res.services ?? [])
      } catch {
        setServices([])
      } finally {
        setLoadingServices(false)
      }
    }
    load()
  }, [])

  // Pré-preenche do reagendamento (vindo do Relacionamento): serviços + cliente.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!prefill) return
    if (prefill.serviceIds.length) setSelectedServices(prefill.serviceIds)
    if (prefill.customerId && prefill.customerName) {
      apiGet<{ customers: CustomerResult[] }>(`/customers?search=${encodeURIComponent(prefill.customerName)}&limit=10`)
        .then((r) => {
          const c = (r.customers ?? []).find((x) => x.id === prefill.customerId)
          if (c) handleSelectCustomer(c)
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load employees when slug is available ──────────────────────────────────
  useEffect(() => {
    if (!businessSlug) return
    setLoadingEmployees(true)
    fetch(`${API}/api/public/${businessSlug}/employees`)
      .then(r => r.json())
      .then(d => {
        const list: EmployeeOption[] = d.employees ?? []
        setEmployees(list)
        if (list.length === 0) setSelectedEmployee("owner")
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmployees(false))
  }, [businessSlug, API])

  // ── Fetch slots ────────────────────────────────────────────────────────────
  const fetchSlots = useCallback(async (
    date: string,
    empId?: string,
    svcIds?: string[]
  ) => {
    const employee = empId  ?? selectedEmployee
    const svcs     = svcIds ?? selectedServices

    if (!businessSlug || svcs.length === 0 || !date) {
      setAvailableSlots([])
      return
    }

    setLoadingSlots(true)
    setSelectedSlot("")

    const serviceParams = svcs.map(s => `serviceIds=${encodeURIComponent(s)}`).join("&")
    const empParam =
      employee === "owner" ? "" :
      employee === "all"   ? "&employeeId=all" :
                             `&employeeId=${encodeURIComponent(employee)}`

    try {
      const res = await fetch(
        `${API}/api/public/${businessSlug}/slots?date=${date}&${serviceParams}${empParam}`
      )
      if (!res.ok) throw new Error("Erro ao buscar horários")
      const data = await res.json()
      const raw: unknown = data.slots

      if (!Array.isArray(raw)) { setAvailableSlots([]); return }

      if (raw.length === 0) {
        setAvailableSlots([])
      } else if (typeof raw[0] === "string") {
        setAvailableSlots((raw as string[]).map(t => ({ time: t, available: true })))
      } else {
        setAvailableSlots(raw as SlotItem[])
      }
    } catch {
      setAvailableSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [businessSlug, selectedEmployee, selectedServices, API])

  // Refetch when employee or services change (keeping date)
  useEffect(() => {
    if (selectedDate && selectedServices.length > 0) {
      fetchSlots(selectedDate)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployee, selectedServices])

  function handleSelectDate(dateStr: string) {
    if (isPastDate(dateStr)) return
    setSelectedDate(dateStr)
    setSelectedSlot("")
    fetchSlots(dateStr)
  }

  function handleSelectEmployee(empId: string) {
    setSelectedEmployee(empId)
    setSelectedSlot("")
    setSelectedDate("")
    setAvailableSlots([])
  }

  function toggleService(id: string) {
    setSelectedServices((p) => p.includes(id) ? p.filter((s) => s !== id) : [...p, id])
  }

  // ── Customer helpers ─────────────────────────────────────────────────────────
  function handleSelectCustomer(c: CustomerResult) {
    setSelectedCustomerId(c.id)
    setCustomerName(c.name)
    setCustomerPhone(c.phone)
    setCustomerEmail(c.email ?? "")
    setExistingVehicles(c.vehicles)
    if (c.vehicles.length === 1) {
      fillVehicle(c.vehicles[0])
      setSelectedVehicleId(c.vehicles[0].id)
    } else {
      clearVehicle()
      setSelectedVehicleId(null)
    }
  }

  function fillVehicle(v: CustomerResult["vehicles"][0]) {
    setVehiclePlate(v.plate)
    setVehicleBrand(v.brand)
    setVehicleModel(v.model)
    setVehicleColor(v.color ?? "")
    setVehicleType(v.type ?? "CAR")
  }

  function clearVehicle() {
    setVehiclePlate(""); setVehicleBrand("")
    setVehicleModel(""); setVehicleColor(""); setVehicleType("CAR")
  }

  function handleClearCustomer() {
    setSelectedCustomerId(null)
    setCustomerName(""); setCustomerPhone(""); setCustomerEmail("")
    setExistingVehicles([])
    setSelectedVehicleId(null)
    clearVehicle()
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitError(null)

    // Pré-condições de etapas anteriores (não são campos do form atual).
    if (selectedServices.length === 0) {
      setStep(1); setSubmitError("Selecione pelo menos um serviço.")
      toast.error("Selecione pelo menos um serviço.")
      return
    }
    if (!selectedDate || !selectedSlot) {
      setStep(2); setSubmitError("Selecione data e horário.")
      toast.error("Selecione data e horário.")
      return
    }

    // Validação visível dos campos obrigatórios do passo 3.
    const errs: Partial<Record<FieldKey, string>> = {}
    if (!customerName.trim()) errs.customerName = "Obrigatório"
    if (selectedVehicleId === null) {
      if (!vehicleModel.trim()) errs.vehicleModel = "Obrigatório"
      if (!vehicleColor.trim()) errs.vehicleColor = "Obrigatório"
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      // Foca/scrolla pro primeiro erro (ordem do formulário).
      const firstRef = errs.customerName ? nameRef
        : errs.vehicleModel ? modelRef
        : errs.vehicleColor ? colorRef
        : null
      firstRef?.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      firstRef?.current?.focus({ preventScroll: true })
      toast.error("Preencha os campos obrigatórios destacados.")
      return
    }

    setFieldErrors({})
    setSubmitting(true)
    try {
      const [y, m, d] = selectedDate.split("-").map(Number)
      const [hh, mm]  = selectedSlot.split(":").map(Number)
      const scheduledAt = new Date(Date.UTC(y, m - 1, d, hh, mm, 0)).toISOString()

      await apiPost("/schedules", {
        // V2-B0 (IDOR): NÃO enviar businessId no body. O backend deriva do token
        // de owner (apiPost manda Authorization: Bearer). Mandar no body permitia
        // criar agendamento em outra loja (cross-tenant).
        serviceIds: selectedServices,
        scheduledAt,
        ...(selectedEmployee !== "owner" ? { employeeId: selectedEmployee } : {}),
        ...(selectedCustomerId
          ? { customerId: selectedCustomerId }
          : { customer: {
              name: customerName.trim(),
              ...(customerPhone.trim() ? { phone: customerPhone.trim() } : {}),
              ...(customerEmail.trim() ? { email: customerEmail.trim() } : {}),
            } }
        ),
        ...(selectedVehicleId
          ? { vehicleId: selectedVehicleId }
          : { vehicle: {
              ...(vehiclePlate.trim() ? { plate: vehiclePlate.trim().toUpperCase() } : {}),
              ...(vehicleBrand.trim() ? { brand: vehicleBrand.trim() } : {}),
              model: vehicleModel.trim(),
              color: vehicleColor.trim(),
              type: vehicleType,
            } }
        ),
      })
      onSuccess()
      setStep(4)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao criar agendamento."
      if (msg.includes("reservado") || msg.includes("conflito") || msg.includes("indisponível")) {
        setSubmitError(msg)
        toast.error("Horário indisponível — escolha outro.")
        // Conflito de horário: volta pro passo de data/hora e recarrega slots.
        setSelectedSlot("")
        setStep(2)
        await fetchSlots(selectedDate)
      } else {
        setSubmitError(msg)
        toast.error(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const totalPrice = services
    .filter((s) => selectedServices.includes(s.id))
    .reduce((a, s) => a + s.price, 0)

  const isCustomerLocked = !!selectedCustomerId
  const showEmpStep = employees.length > 0

  // Calendar rendering
  const calYear  = calendarMonth.getFullYear()
  const calMon   = calendarMonth.getMonth()
  const firstDay = new Date(calYear, calMon, 1).getDay()
  const totalDays = new Date(calYear, calMon + 1, 0).getDate()
  const calCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  while (calCells.length % 7 !== 0) calCells.push(null)
  const todayISO = new Date().toISOString().split("T")[0]
  const daySize  = isMobile ? 32 : 36

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          backgroundColor: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(8px)",
          zIndex: 100, animation: "fadeIn 0.2s ease",
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed",
        top:    isMobile ? "auto" : "50%",
        bottom: isMobile ? 0 : "auto",
        left:   isMobile ? 0 : "50%",
        right:  isMobile ? 0 : "auto",
        transform: isMobile ? "none" : "translate(-50%, -50%)",
        backgroundColor: "var(--c-surface)",
        border: "1px solid var(--c-border)",
        borderRadius: isMobile ? "20px 20px 0 0" : 20,
        width: isMobile ? "100%" : 620,
        maxHeight: isMobile ? "92dvh" : "88vh",
        display: "flex", flexDirection: "column",
        zIndex: 101,
        boxShadow: "0 -8px 40px rgba(0,0,0,0.6)",
        animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
      }}>

        {isMobile && (
          <div style={{ width: 36, height: 4, backgroundColor: "var(--c-border-2)", borderRadius: 2, margin: "12px auto 0", flexShrink: 0 }} />
        )}

        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "18px 20px 14px", borderBottom: "1px solid var(--c-border)", flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
              Novo agendamento
            </h2>
            <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: "3px 0 0" }}>
              {step === 1 ? "Escolha os serviços" : step === 2 ? "Escolha data e horário" : step === 3 ? "Dados do cliente e veículo" : "Confirmado"}
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
            backgroundColor: "var(--c-border)", border: "1px solid var(--c-border-2)",
            borderRadius: 8, cursor: "pointer", color: "var(--c-text-3)", flexShrink: 0,
          }}>
            <X size={15} />
          </button>
        </div>

        {/* Steps */}
        {step !== 4 && <div style={{
          display: "flex", padding: "0 20px",
          borderBottom: "1px solid var(--c-border)", flexShrink: 0,
        }}>
          {[{ n: 1, label: "Serviços" }, { n: 2, label: "Data e Horário" }, { n: 3, label: "Cliente" }].map((s) => (
            <button
              key={s.n}
              onClick={() => s.n < step && setStep(s.n as 1 | 2 | 3)}
              style={{
                flex: 1, padding: "10px 0", background: "none",
                border: "none", cursor: s.n < step ? "pointer" : "default",
                borderBottom: `2px solid ${step === s.n ? "#0066FF" : "transparent"}`,
                color: step === s.n ? "var(--c-text)" : step > s.n ? "var(--c-text-4)" : "var(--c-text-4)",
                fontSize: 13, fontWeight: step === s.n ? 600 : 400,
                transition: "all 0.15s", fontFamily: "inherit",
              }}
            >
              {s.n}. {s.label}
            </button>
          ))}
        </div>}

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "18px 20px" }}>

          {/* ══════ STEP 1 — SERVIÇOS ══════ */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, color: "var(--c-text-4)", marginBottom: 8, letterSpacing: "0.04em" }}>
                  SERVIÇOS
                </p>
                {loadingServices ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[1, 2, 3].map((i) => (
                      <div key={i} style={{
                        height: 44, borderRadius: 9, backgroundColor: "var(--c-surface-2)",
                        animation: `skeletonPulse 1.5s ease ${i * 0.1}s infinite`,
                      }} />
                    ))}
                  </div>
                ) : services.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--c-text-4)", textAlign: "center", padding: "16px 0" }}>
                    Nenhum serviço cadastrado.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {services.map((svc) => {
                      const sel = selectedServices.includes(svc.id)
                      return (
                        <button key={svc.id} onClick={() => toggleService(svc.id)} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "10px 12px", borderRadius: 9, cursor: "pointer",
                          backgroundColor: sel ? "rgba(0,102,255,0.07)" : "var(--c-elevated)",
                          border: `1px solid ${sel ? "rgba(0,102,255,0.3)" : "var(--c-border)"}`,
                          transition: "all 0.15s", fontFamily: "inherit",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                              backgroundColor: sel ? "#0066FF" : "transparent",
                              border: sel ? "none" : "1px solid var(--c-border-2)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {sel && <CheckCircle2 size={11} color="white" />}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                              <span style={{ fontSize: 13, color: "var(--c-text)", fontWeight: sel ? 600 : 400 }}>
                                {svc.name}
                              </span>
                              <span style={{ fontSize: 11, color: "var(--c-text-4)", fontVariantNumeric: "tabular-nums" }}>
                                {svc.durationMinutes}min
                              </span>
                            </div>
                          </div>
                          <span style={{ fontSize: 13, color: "#10B981", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                            {formatCurrency(svc.price)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {selectedServices.length > 0 && (
                  <div style={{
                    marginTop: 8, padding: "8px 12px",
                    backgroundColor: "rgba(0,102,255,0.05)",
                    border: "1px solid rgba(0,102,255,0.15)",
                    borderRadius: 8, display: "flex", justifyContent: "space-between",
                  }}>
                    <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>
                      {selectedServices.length} serviço{selectedServices.length !== 1 ? "s" : ""} selecionado{selectedServices.length !== 1 ? "s" : ""}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text)", fontVariantNumeric: "tabular-nums" }}>
                      {formatCurrency(totalPrice)}
                    </span>
                  </div>
                )}
              </div>

              {submitError && (
                <div style={{ backgroundColor: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 9, padding: "10px 13px", display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertCircle size={14} color="#EF4444" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#EF4444" }}>{submitError}</span>
                </div>
              )}
            </div>
          )}

          {/* ══════ STEP 2 — DATA E HORÁRIO ══════ */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* ── Profissional ── */}
              {showEmpStep && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 500, color: "var(--c-text-4)", marginBottom: 10, letterSpacing: "0.04em" }}>
                    PROFISSIONAL
                  </p>
                  {loadingEmployees ? (
                    <div style={{ display: "flex", gap: 10 }}>
                      {[1,2,3].map(i => (
                        <div key={i} style={{ width: 82, height: 90, borderRadius: 14, backgroundColor: "var(--c-surface-2)", animation: `skeletonPulse 1.4s ease ${i*0.1}s infinite` }} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {/* Owner card */}
                      {(employees.length === 0 || employees.every(e => e.role !== "OWNER")) && (
                        <ModalEmployeeCard
                          emp={{ id: "owner", name: "Proprietário", avatarUrl: null, role: "OWNER" }}
                          selected={selectedEmployee === "owner"}
                          onSelect={() => handleSelectEmployee("owner")}
                        />
                      )}
                      {employees.map(emp => (
                        <ModalEmployeeCard
                          key={emp.id} emp={emp}
                          selected={selectedEmployee === emp.id}
                          onSelect={() => handleSelectEmployee(emp.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Calendário + Slots ── */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, color: "var(--c-text-4)", marginBottom: 10, letterSpacing: "0.04em" }}>
                  DATA E HORÁRIO
                </p>

                <div style={isMobile ? {} : {
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)",
                  gap: 16, alignItems: "start",
                }}>

                  {/* Calendar */}
                  <div style={{
                    backgroundColor: "var(--c-elevated)", border: "1px solid var(--c-border)",
                    borderRadius: 14, padding: isMobile ? 12 : 14,
                    marginBottom: isMobile ? 12 : 0,
                  }}>
                    {/* Month/year header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <button
                        onClick={() => setCalendarMonth(d => { const n = new Date(d); n.setMonth(n.getMonth()-1); return n })}
                        style={{
                          width: 28, height: 28, borderRadius: "50%", backgroundColor: "var(--c-surface-2)",
                          border: "1px solid var(--c-border-2)", color: "var(--c-text-2)",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", fontVariantNumeric: "tabular-nums" }}>
                        {MONTHS_PT[calMon]} {calYear}
                      </span>
                      <button
                        onClick={() => setCalendarMonth(d => { const n = new Date(d); n.setMonth(n.getMonth()+1); return n })}
                        style={{
                          width: 28, height: 28, borderRadius: "50%", backgroundColor: "var(--c-surface-2)",
                          border: "1px solid var(--c-border-2)", color: "var(--c-text-2)",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>

                    {/* Weekday labels */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", marginBottom: 4 }}>
                      {WEEKDAYS_PT.map(d => (
                        <div key={d} style={{ textAlign: "center", fontSize: 10, color: "var(--c-text-4)", fontWeight: 500, paddingBottom: 4 }}>
                          {d.charAt(0)}
                        </div>
                      ))}
                    </div>

                    {/* Day grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 3 }}>
                      {calCells.map((day, i) => {
                        if (!day) return <div key={i} style={{ height: daySize }} />
                        const dStr = `${calYear}-${String(calMon+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`
                        const past = isPastDate(dStr)
                        const sel  = dStr === selectedDate
                        const tod  = dStr === todayISO

                        return (
                          <button
                            key={i}
                            onClick={() => !past && handleSelectDate(dStr)}
                            disabled={past}
                            style={{
                              width: daySize, height: daySize,
                              borderRadius: "50%",
                              margin: "0 auto",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, fontWeight: sel || tod ? 600 : 400,
                              border: tod && !sel ? "1px solid #0066FF" : "none",
                              background: sel ? "#0066FF" : "transparent",
                              color: past ? "var(--c-text-4)" : sel ? "var(--c-text)" : tod ? "#0066FF" : "var(--c-text-2)",
                              cursor: past ? "not-allowed" : "pointer",
                              fontFamily: "inherit",
                              fontVariantNumeric: "tabular-nums",
                              transition: "all 0.12s",
                              flexShrink: 0,
                            }}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Slots */}
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-2)", margin: "0 0 8px" }}>
                      {selectedDate
                        ? `Horários — ${new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}`
                        : "Selecione uma data"}
                    </p>

                    {!selectedDate && (
                      <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: 0 }}>
                        Escolha um dia no calendário para ver os horários disponíveis.
                      </p>
                    )}

                    {selectedDate && loadingSlots && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(70px,1fr))", gap: 6 }}>
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} style={{
                            height: 32, borderRadius: 8, backgroundColor: "var(--c-surface-2)",
                            animation: `skeletonPulse 1.4s ease ${i*0.05}s infinite`,
                          }} />
                        ))}
                      </div>
                    )}

                    {selectedDate && !loadingSlots && availableSlots.length === 0 && (
                      <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: 0 }}>
                        Nenhum horário disponível. Tente outra data.
                      </p>
                    )}

                    {selectedDate && !loadingSlots && availableSlots.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(70px,1fr))", gap: 6 }}>
                        {availableSlots.map(slot => {
                          const sel      = slot.time === selectedSlot
                          const isPastSlot = selectedDate === new Date().toISOString().split("T")[0] && (() => {
                            const [h, m] = slot.time.split(":").map(Number)
                            const now = new Date()
                            return h * 60 + m <= now.getHours() * 60 + now.getMinutes()
                          })()
                          const disabled = !slot.available || isPastSlot
                          return (
                            <button
                              key={slot.time}
                              onClick={() => !disabled && setSelectedSlot(slot.time)}
                              disabled={disabled}
                              title={disabled ? "Horário indisponível" : undefined}
                              style={{
                                height: 32, borderRadius: 8, fontSize: 12, fontWeight: sel ? 700 : 500,
                                background:  sel     ? "#0066FF" : disabled ? "var(--c-elevated)" : "var(--c-surface-2)",
                                border:      sel     ? "1px solid #0066FF" : disabled ? "1px solid var(--c-border)" : "1px solid var(--c-border-2)",
                                color:       sel     ? "var(--c-text)"   : disabled ? "var(--c-text-4)" : "var(--c-text-2)",
                                opacity:     disabled ? 0.4     : 1,
                                cursor:      disabled ? "not-allowed" : "pointer",
                                pointerEvents: disabled ? "none" : "auto",
                                fontFamily: "inherit",
                                fontVariantNumeric: "tabular-nums",
                                transition: "all 0.15s ease",
                              }}
                            >
                              {slot.time}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {selectedDate && !loadingSlots && availableSlots.length > 0 &&
                      availableSlots.every(s => !s.available) && (
                      <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: "8px 0 0", textAlign: "center" }}>
                        Nenhum horário disponível para este profissional neste dia.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Selected slot summary */}
              {selectedDate && selectedSlot && (
                <div style={{
                  padding: "8px 12px",
                  backgroundColor: "rgba(0,102,255,0.05)",
                  border: "1px solid rgba(0,102,255,0.15)",
                  borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>
                    {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0066FF", fontVariantNumeric: "tabular-nums" }}>
                    {selectedSlot}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ══════ STEP 3 — CLIENTE ══════ */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* ── BUSCA CLIENTE ── */}
              <div style={{
                backgroundColor: "var(--c-elevated)", border: "1px solid var(--c-border)",
                borderRadius: 12, padding: "14px",
              }}>
                {isCustomerLocked ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      backgroundColor: "rgba(0,102,255,0.1)", border: "1px solid rgba(0,102,255,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <User size={16} color="#3B82F6" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {customerName}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>{customerPhone}</p>
                    </div>
                    <button onClick={handleClearCustomer} style={{
                      flexShrink: 0, width: 28, height: 28,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      backgroundColor: "var(--c-border)", border: "1px solid var(--c-border-2)",
                      borderRadius: 7, cursor: "pointer", color: "var(--c-text-3)",
                    }}>
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <CustomerSearch onSelect={handleSelectCustomer} />
                )}
              </div>

              {/* Divisor */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 1, backgroundColor: "var(--c-border)" }} />
                <span style={{ fontSize: 11, color: "var(--c-text-4)", whiteSpace: "nowrap" }}>
                  {isCustomerLocked ? "ou edite os dados abaixo" : "ou preencha manualmente"}
                </span>
                <div style={{ flex: 1, height: 1, backgroundColor: "var(--c-border)" }} />
              </div>

              {/* ── CLIENTE campos ── */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, color: "var(--c-text-4)", marginBottom: 8, letterSpacing: "0.04em" }}>
                  CLIENTE
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <FInput
                    label="Nome completo"
                    value={customerName}
                    onChange={(v) => { setCustomerName(v); clearFieldError("customerName") }}
                    placeholder="João da Silva"
                    required
                    disabled={isCustomerLocked}
                    error={fieldErrors.customerName}
                    inputRef={nameRef}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                    <FInput label="Telefone" value={customerPhone} onChange={setCustomerPhone} placeholder="(opcional)" disabled={isCustomerLocked} />
                    <FInput label="E-mail" value={customerEmail} onChange={setCustomerEmail} placeholder="(opcional)" disabled={isCustomerLocked} />
                  </div>
                </div>
              </div>

              {/* ── VEÍCULOS EXISTENTES ── */}
              {existingVehicles.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 500, color: "var(--c-text-4)", marginBottom: 8, letterSpacing: "0.04em" }}>
                    VEÍCULOS DO CLIENTE
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {existingVehicles.map((v) => {
                      const sel = selectedVehicleId === v.id
                      return (
                        <button key={v.id} onClick={() => {
                          setSelectedVehicleId(v.id)
                          fillVehicle(v)
                        }} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 12px", borderRadius: 9, cursor: "pointer",
                          backgroundColor: sel ? "rgba(0,102,255,0.07)" : "var(--c-elevated)",
                          border: `1px solid ${sel ? "rgba(0,102,255,0.3)" : "var(--c-border)"}`,
                          transition: "all 0.15s", fontFamily: "inherit",
                          textAlign: "left",
                        }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                            backgroundColor: sel ? "#0066FF" : "transparent",
                            border: sel ? "none" : "1px solid var(--c-border-2)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {sel && <CheckCircle2 size={11} color="white" />}
                          </div>
                          <Car size={13} color={sel ? "#3B82F6" : "var(--c-text-4)"} style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 13, color: "var(--c-text)", fontWeight: sel ? 600 : 400 }}>
                              {[v.brand, v.model].filter(Boolean).join(" ")}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--c-text-4)", marginLeft: 8 }}>
                              {v.plate}
                            </span>
                          </div>
                          {v.color && (
                            <span style={{ fontSize: 11, color: "var(--c-text-4)", flexShrink: 0 }}>{v.color}</span>
                          )}
                        </button>
                      )
                    })}
                    <button onClick={() => { setSelectedVehicleId(null); clearVehicle() }} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 9, cursor: "pointer",
                      backgroundColor: selectedVehicleId === null && vehiclePlate === "" ? "rgba(0,102,255,0.07)" : "var(--c-elevated)",
                      border: `1px solid ${selectedVehicleId === null && vehiclePlate === "" ? "rgba(0,102,255,0.3)" : "var(--c-border)"}`,
                      transition: "all 0.15s", fontFamily: "inherit",
                    }}>
                      <Plus size={13} color="#3B82F6" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "#3B82F6", fontWeight: 500 }}>Novo veículo</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── VEÍCULO campos ── */}
              {selectedVehicleId === null && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 500, color: "var(--c-text-4)", marginBottom: 8, letterSpacing: "0.04em" }}>
                    {existingVehicles.length > 0 ? "NOVO VEÍCULO" : "VEÍCULO"}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                      <FInput label="Placa" value={vehiclePlate} onChange={(v) => setVehiclePlate(v.toUpperCase())} placeholder="(opcional)" />
                      <FInput label="Marca" value={vehicleBrand} onChange={setVehicleBrand} placeholder="(opcional)" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                      <FInput
                        label="Modelo"
                        value={vehicleModel}
                        onChange={(v) => { setVehicleModel(v); clearFieldError("vehicleModel") }}
                        placeholder="Civic"
                        required
                        error={fieldErrors.vehicleModel}
                        inputRef={modelRef}
                      />
                      <FInput
                        label="Cor"
                        value={vehicleColor}
                        onChange={(v) => { setVehicleColor(v); clearFieldError("vehicleColor") }}
                        placeholder="Prata"
                        required
                        error={fieldErrors.vehicleColor}
                        inputRef={colorRef}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                      <label style={{ fontSize: 11, fontWeight: 500, color: "var(--c-text-3)", letterSpacing: "0.03em" }}>Tipo</label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
                        {VEHICLE_TYPES.map((t) => {
                          const Icon = VEHICLE_TYPE_ICONS[t]
                          const sel = vehicleType === t
                          return (
                            <button key={t} type="button" onClick={() => setVehicleType(t)} style={{
                              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                              gap: 4, padding: "9px 0", borderRadius: 9, cursor: "pointer", minWidth: 0,
                              backgroundColor: sel ? "rgba(0,102,255,0.10)" : "var(--c-elevated)",
                              border: `1.5px solid ${sel ? "rgba(0,102,255,0.5)" : "var(--c-border)"}`,
                              transition: "all 0.15s", fontFamily: "inherit",
                            }}>
                              <Icon size={18} color={sel ? "#3B82F6" : "var(--c-text-3)"} style={{ flexShrink: 0 }} />
                              <span style={{ fontSize: 10, fontWeight: 600, color: sel ? "#3B82F6" : "var(--c-text-3)", letterSpacing: "0.02em" }}>
                                {VEHICLE_TYPE_LABELS[t]}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Resumo */}
              <div style={{
                backgroundColor: "var(--c-elevated)", border: "1px solid var(--c-border)",
                borderRadius: 10, padding: "12px 14px",
              }}>
                <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: "0 0 8px", letterSpacing: "0.04em" }}>RESUMO</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "var(--c-text-3)", fontVariantNumeric: "tabular-nums" }}>
                      {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às {selectedSlot}
                    </span>
                    <span style={{ color: "#10B981", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(totalPrice)}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: 0 }}>
                    {services.filter((s) => selectedServices.includes(s.id)).map((s) => s.name).join(", ") || "—"}
                  </p>
                  {showEmpStep && (
                    <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: 0 }}>
                      Profissional: {selectedEmployee === "owner" ? "Proprietário" : employees.find(e => e.id === selectedEmployee)?.name ?? "—"}
                    </p>
                  )}
                </div>
              </div>

              {submitError && (
                <div style={{ backgroundColor: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 9, padding: "10px 13px", display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertCircle size={14} color="#EF4444" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#EF4444" }}>{submitError}</span>
                </div>
              )}
            </div>
          )}

          {/* ══════ STEP 4 — SUCESSO ══════ */}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "24px 0" }}>

              {/* Ícone de sucesso */}
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <CheckCircle2 size={28} color="#10B981" />
              </div>

              <div style={{ textAlign: "center" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--c-text)", margin: "0 0 4px" }}>
                  Agendamento criado
                </h3>
                <p style={{ fontSize: 13, color: "var(--c-text-4)", margin: 0 }}>
                  {selectedDate && new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} {selectedSlot && `às ${selectedSlot}`}
                </p>
              </div>

              {/* Resumo */}
              <div style={{
                width: "100%", backgroundColor: "var(--c-elevated)", border: "1px solid var(--c-border)",
                borderRadius: 10, padding: "12px 14px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--c-text-2)", fontWeight: 500 }}>{customerName || "Cliente"}</span>
                  <span style={{ color: "#10B981", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(totalPrice)}</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: "4px 0 0" }}>
                  {services.filter(s => selectedServices.includes(s.id)).map(s => s.name).join(", ")}
                </p>
                {showEmpStep && selectedEmployee && (
                  <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: "4px 0 0" }}>
                    Profissional: {selectedEmployee === "owner" ? "Proprietário" : employees.find(e => e.id === selectedEmployee)?.name ?? "—"}
                  </p>
                )}
              </div>

              {/* Botão WhatsApp */}
              {(customerPhone.trim() || customerName.trim()) && (
                <button
                  onClick={() => {
                    const phone = customerPhone.replace(/\D/g, "")
                    const svcNames = services.filter(s => selectedServices.includes(s.id)).map(s => s.name).join(", ")
                    const dateFormatted = selectedDate
                      ? new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                      : ""
                    const msg = [
                      `Olá${customerName ? ` ${customerName.split(" ")[0]}` : ""}! Seu agendamento foi confirmado:`,
                      "",
                      svcNames,
                      `${dateFormatted} às ${selectedSlot}`,
                      formatCurrency(totalPrice),
                      "",
                      `Te esperamos!${businessName ? ` — ${businessName}` : ""}`,
                    ].join("\n")

                    const url = phone
                      ? buildWhatsAppLink(`55${phone}`, msg)
                      : buildWhatsAppLink("", msg)
                    window.open(url, "_blank")
                  }}
                  style={{
                    width: "100%", height: 44, borderRadius: 10, fontSize: 13, fontWeight: 600,
                    background: "linear-gradient(135deg, #25D366, #128C7E)",
                    border: "none", color: "var(--c-on-primary)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    fontFamily: "inherit", transition: "opacity 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Enviar confirmação via WhatsApp
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 20px",
          borderTop: "1px solid var(--c-border)",
          display: "flex", gap: 8, flexShrink: 0,
          paddingBottom: isMobile ? "max(14px, env(safe-area-inset-bottom))" : 14,
        }}>
          {step === 1 ? (
            <>
              <button onClick={onClose} style={{
                flex: 1, height: 42, backgroundColor: "var(--c-surface-2)",
                border: "1px solid var(--c-border-2)", borderRadius: 10,
                color: "var(--c-text-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              }}>
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (selectedServices.length === 0) {
                    setSubmitError("Selecione pelo menos um serviço.")
                    toast.error("Selecione pelo menos um serviço.")
                    return
                  }
                  setSubmitError(null)
                  setStep(2)
                }}
                style={{
                  flex: 2, height: 42,
                  background: "linear-gradient(135deg,#0066FF,#7C3AED)",
                  border: "none", borderRadius: 10,
                  color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Continuar →
              </button>
            </>
          ) : step === 2 ? (
            <>
              <button onClick={() => setStep(1)} style={{
                flex: 1, height: 42, backgroundColor: "var(--c-surface-2)",
                border: "1px solid var(--c-border-2)", borderRadius: 10,
                color: "var(--c-text-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              }}>
                ← Voltar
              </button>
              <button
                onClick={() => {
                  if (!selectedDate || !selectedSlot) {
                    setSubmitError("Selecione data e horário.")
                    toast.error("Selecione data e horário.")
                    return
                  }
                  setSubmitError(null)
                  setStep(3)
                }}
                disabled={!selectedDate || !selectedSlot}
                style={{
                  flex: 2, height: 42,
                  background: selectedDate && selectedSlot ? "linear-gradient(135deg,#0066FF,#7C3AED)" : "var(--c-border)",
                  border: "none", borderRadius: 10,
                  color: selectedDate && selectedSlot ? "white" : "var(--c-text-4)",
                  fontSize: 13, fontWeight: 600,
                  cursor: selectedDate && selectedSlot ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                }}
              >
                Continuar →
              </button>
            </>
          ) : step === 3 ? (
            <>
              <button onClick={() => setStep(2)} style={{
                flex: 1, height: 42, backgroundColor: "var(--c-surface-2)",
                border: "1px solid var(--c-border-2)", borderRadius: 10,
                color: "var(--c-text-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              }}>
                ← Voltar
              </button>
              <button onClick={handleSubmit} disabled={submitting} style={{
                flex: 2, height: 42,
                background: "linear-gradient(135deg,#10B981,#059669)",
                border: "none", borderRadius: 10,
                color: "white", fontSize: 13, fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: "inherit",
              }}>
                {submitting ? <><Spinner size={14} color="white" /> Criando...</> : <><CheckCircle2 size={14} /> Criar agendamento</>}
              </button>
            </>
          ) : (
            <button onClick={onClose} style={{
              flex: 1, height: 42,
              background: "linear-gradient(135deg,#0066FF,#7C3AED)",
              border: "none", borderRadius: 10,
              color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit",
            }}>
              Fechar
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ── ModalEmployeeCard ────────────────────────────────────────────────────────

function ModalEmployeeCard({
  emp, selected, onSelect,
}: {
  emp: EmployeeOption; selected: boolean; onSelect: () => void
}) {
  const initials = emp.name
    .split(" ").filter(Boolean).slice(0,2).map(n => n[0].toUpperCase()).join("")

  return (
    <div
      onClick={onSelect}
      style={{
        width: 82, padding: "10px 6px",
        backgroundColor: selected ? "rgba(0,102,255,0.07)" : "var(--c-elevated)",
        border: selected ? "1px solid rgba(0,102,255,0.4)" : "1px solid var(--c-border)",
        borderRadius: 12, cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        transition: "all 0.15s", flexShrink: 0,
      }}
    >
      {emp.avatarUrl ? (
        <img
          src={emp.avatarUrl}
          alt={emp.name}
          style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover",
            border: selected ? "2px solid #0066FF" : "2px solid var(--c-border-2)",
          }}
        />
      ) : (
        <div style={{
          width: 38, height: 38, borderRadius: "50%",
          background: selected
            ? "linear-gradient(135deg, #0066FF, #0066FF99)"
            : "linear-gradient(135deg,var(--c-border-2),var(--c-border))",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700,
          color: selected ? "var(--c-text)" : "var(--c-text-4)",
        }}>
          {initials}
        </div>
      )}
      <span style={{
        fontSize: 10, fontWeight: 500, textAlign: "center", lineHeight: 1.3,
        color: selected ? "var(--c-text)" : "var(--c-text-2)",
        maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {emp.name}
      </span>
      {emp.role === "OWNER" && (
        <span style={{
          fontSize: 8, fontWeight: 600, color: "#0066FF",
          backgroundColor: "rgba(0,102,255,0.12)",
          borderRadius: 4, padding: "1px 4px", marginTop: -3,
          lineHeight: 1.5,
        }}>
          Proprietário
        </span>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AgendamentosPage() {
  const [schedules,        setSchedules]        = useState<Schedule[]>([])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState<string | null>(null)
  const [selectedDate,     setSelectedDate]     = useState(() => new Date().toISOString().split("T")[0])
  const [filterStatus,     setFilterStatus]     = useState("")
  const [searchQuery,      setSearchQuery]      = useState("")
  const [actionLoading,    setActionLoading]    = useState<string | null>(null)
  const [showCloseModal,   setShowCloseModal]   = useState(false)
  const [showNovoModal,    setShowNovoModal]    = useState(false)   // ← novo
  // Reagendamento pré-montado vindo do Relacionamento (?customerId&customerName&serviceIds)
  const [prefill, setPrefill] = useState<{ customerId: string; customerName: string; serviceIds: string[] } | null>(null)
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
  const [paymentMethod,    setPaymentMethod]    = useState("PIX")
  const [searchFocused,    setSearchFocused]    = useState(false)
  const [hovCard,          setHovCard]          = useState<string | null>(null)
  const [hovBtn,           setHovBtn]           = useState(false)
  const [isMobile,         setIsMobile]         = useState(false)
  const [visibleCount,     setVisibleCount]     = useState(LIST_PAGE_SIZE)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("date", selectedDate)
    if (filterStatus) params.set("status", filterStatus)
    try {
      const res = await apiGet<{ schedules: Schedule[] }>(`/schedules?${params}`)
      setSchedules(res.schedules ?? [])
      setError(null)
    } catch {
      setError("Erro ao carregar agendamentos.")
    } finally {
      setLoading(false)
    }
  }, [selectedDate, filterStatus])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])

  // Tempo real: casa com Calendário e Pátio — qualquer mudança de agendamento
  // re-sincroniza a lista de comandas na hora.
  useNotificationsSSE(useCallback((data: Record<string, unknown>) => {
    if (typeof data.type === "string" && data.type.startsWith("SCHEDULE")) fetchSchedules()
  }, [fetchSchedules]))

  // Deep-link de reagendamento pré-montado (vindo do Relacionamento). Lê via
  // window.location.search (não useSearchParams — evita Suspense no Next 15) e
  // limpa a URL pra não reabrir no F5.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const customerId = sp.get("customerId")
    if (!customerId) return
    setPrefill({
      customerId,
      customerName: sp.get("customerName") ?? "",
      serviceIds: (sp.get("serviceIds") ?? "").split(",").filter(Boolean),
    })
    setShowNovoModal(true)
    window.history.replaceState(null, "", window.location.pathname)
  }, [])

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleUpdateStatus = useCallback(async (id: string, status: string) => {
    setActionLoading(id)
    try {
      await apiPut(`/schedules/${id}/status`, { status })
      await fetchSchedules()
    } catch {
      setError("Erro ao atualizar status.")
    } finally {
      setActionLoading(null)
    }
  }, [fetchSchedules])

  const handleCloseSchedule = useCallback(async () => {
    if (!selectedSchedule) return
    setActionLoading(selectedSchedule.id)
    try {
      await apiPut(`/schedules/${selectedSchedule.id}/close`, { paymentMethod })
      setShowCloseModal(false)
      setSelectedSchedule(null)
      await fetchSchedules()
    } catch {
      setError("Erro ao fechar agendamento.")
    } finally {
      setActionLoading(null)
    }
  }, [selectedSchedule, paymentMethod, fetchSchedules])

  // Handlers de card extraídos para useCallback (estáveis entre renders, passados
  // a filhos dentro do .map da lista). Comportamento idêntico ao inline anterior.
  const handleOpenClose = useCallback((s: Schedule) => {
    setSelectedSchedule(s)
    setShowCloseModal(true)
  }, [])

  const handleHoverCard = useCallback((id: string | null) => {
    setHovCard(id)
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────

  // Filtro de busca: mesma lógica/ordem de antes, só memoizado para não refiltrar
  // a cada render (ex.: hover de card, abrir modal) quando schedules/query não mudam.
  const filteredSchedules = useMemo(() => schedules.filter((s) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (s.customer?.name ?? "").toLowerCase().includes(q) ||
      (s.vehicle?.plate ?? "").toLowerCase().includes(q) ||
      (s.scheduleServices ?? []).some((ss) => (ss?.service?.name ?? "").toLowerCase().includes(q))
    )
  }), [schedules, searchQuery])

  const isToday = selectedDate === new Date().toISOString().split("T")[0]

  // Métricas do topo: uma única passada sobre `schedules` em vez de 4 .filter()
  // separados. Mesmos valores que antes.
  const { pendingCount, confirmedCount, inProgressCount, totalRevenue } = useMemo(() => {
    let pending = 0, confirmed = 0, inProgress = 0, revenue = 0
    for (const s of schedules) {
      if (s.status === "PENDING") pending++
      else if (s.status === "CONFIRMED") confirmed++
      else if (s.status === "IN_PROGRESS") inProgress++
      if (s.paymentStatus === "PAID") revenue += s.totalPrice
    }
    return { pendingCount: pending, confirmedCount: confirmed, inProgressCount: inProgress, totalRevenue: revenue }
  }, [schedules])

  const dateInfo = useMemo(() => formatDateHeader(selectedDate), [selectedDate])

  // Fatia renderizada da lista (limite + "carregar mais"). NÃO altera a ordem nem
  // o conteúdo de filteredSchedules — as métricas continuam usando o total filtrado.
  const visibleSchedules = useMemo(
    () => filteredSchedules.slice(0, visibleCount),
    [filteredSchedules, visibleCount],
  )
  const hasMore = filteredSchedules.length > visibleSchedules.length

  function changeDate(days: number) {
    const d = new Date(selectedDate + "T12:00:00")
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split("T")[0])
    setVisibleCount(LIST_PAGE_SIZE) // nova lista → volta ao primeiro "lote"
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, -46%); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pageIn  {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes skeletonPulse { 0%,100% { opacity:.4; } 50% { opacity:.8; } }
      `}</style>

      <div style={{ animation: "pageIn 0.35s ease both", fontFamily: "'Inter', -apple-system, sans-serif" }}>

        {/* ── HEADER ── */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: isMobile ? "stretch" : "flex-start",
          flexDirection: isMobile ? "column" : "row",
          gap: 16, marginBottom: 20,
        }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>
              Comandas
            </h1>
            <p style={{ fontSize: 13, color: "var(--c-text-4)", margin: "4px 0 0" }}>
              Gerencie os agendamentos do seu negócio
            </p>
          </div>

          {/* ← abre modal, não navega */}
          <button
            onClick={() => setShowNovoModal(true)}
            onMouseEnter={() => setHovBtn(true)}
            onMouseLeave={() => setHovBtn(false)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: "linear-gradient(135deg, #0066FF, #7C3AED)",
              border: "none", borderRadius: 12,
              padding: isMobile ? "12px 20px" : "10px 20px",
              color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer",
              boxShadow: hovBtn ? "0 8px 28px rgba(0,102,255,0.5)" : "0 4px 20px rgba(0,102,255,0.3)",
              transform: hovBtn ? "scale(1.02)" : "scale(1)",
              transition: "all 0.2s ease", fontFamily: "inherit",
            }}
          >
            <Plus size={15} /> Novo agendamento
          </button>
        </div>

        <TabTutorial
          tabKey="agendamentos"
          title="Como funcionam os Agendamentos"
          subtitle="Do agendamento ao pagamento"
          steps={[
            {
              icon: CalendarCheck,
              title: "1. Acompanhe o dia",
              text: "Aqui ficam os agendamentos de cada dia: pendentes, confirmados, em andamento e concluídos.",
            },
            {
              icon: PlayCircle,
              title: "2. Inicie o atendimento",
              text: "Quando o carro chega, mude o status pra 'em andamento'. Ele passa a aparecer no Pátio.",
            },
            {
              icon: CheckCircle,
              title: "3. Feche a comanda",
              text: "Ao terminar, feche a comanda e registre o pagamento. Isso gera a sua receita e os repasses da equipe.",
            },
          ]}
        />

        {/* ── NAVEGAÇÃO DE DATA ── */}
        <div style={{
          backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)",
          borderRadius: 16, padding: "12px 14px", marginBottom: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <NavArrow onClick={() => changeDate(-1)} direction="left" />
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: "var(--c-text-4)", margin: 0, textTransform: "capitalize", letterSpacing: "0.05em" }}>
                {dateInfo.weekday}
              </p>
              <p style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: "var(--c-text)", margin: "2px 0 0", letterSpacing: "-0.3px", fontVariantNumeric: "tabular-nums" }}>
                {dateInfo.day} de{" "}
                <span style={{ textTransform: "capitalize" }}>{dateInfo.month}</span>{" "}
                <span style={{ color: "var(--c-text-4)", fontWeight: 500 }}>{dateInfo.year}</span>
              </p>
            </div>
            <NavArrow onClick={() => changeDate(+1)} direction="right" />
            {isToday ? (
              <span style={{
                fontSize: 11, fontWeight: 600, color: "#0066FF",
                backgroundColor: "rgba(0,102,255,0.1)", border: "1px solid rgba(0,102,255,0.2)",
                borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap",
              }}>Hoje</span>
            ) : (
              <button onClick={() => { setSelectedDate(new Date().toISOString().split("T")[0]); setVisibleCount(LIST_PAGE_SIZE) }} style={{
                fontSize: 11, fontWeight: 600, color: "#0066FF",
                backgroundColor: "rgba(0,102,255,0.08)", border: "1px solid rgba(0,102,255,0.2)",
                borderRadius: 6, padding: "3px 8px", cursor: "pointer", whiteSpace: "nowrap",
                fontFamily: "inherit",
              }}>Hoje</button>
            )}
          </div>

          <div style={{ position: "relative", marginTop: 10 }}>
            <Search size={14} style={{
              position: "absolute", left: 12, top: "50%",
              transform: "translateY(-50%)", color: "var(--c-text-4)", pointerEvents: "none",
            }} />
            <input
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(LIST_PAGE_SIZE) }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Buscar cliente, placa ou serviço..."
              style={{
                width: "100%", height: 38, backgroundColor: "var(--c-elevated)",
                border: `1px solid ${searchFocused ? "rgba(0,102,255,0.4)" : "var(--c-border-2)"}`,
                borderRadius: 10, paddingLeft: 36, paddingRight: 12,
                fontSize: 13, color: "var(--c-text)", outline: "none",
                transition: "border-color 0.15s", fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 5, marginTop: 10, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
            {STATUS_FILTERS.map((f) => {
              const active = filterStatus === f.value
              const cfg    = f.value ? getStatusConfig(f.value) : null
              return (
                <button key={f.value} onClick={() => { setFilterStatus(f.value); setVisibleCount(LIST_PAGE_SIZE) }} style={{
                  fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: 8,
                  cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0,
                  backgroundColor: active ? (cfg ? cfg.bg : "rgba(255,255,255,0.06)") : "transparent",
                  border: `1px solid ${active ? (cfg ? cfg.border : "rgba(255,255,255,0.15)") : "var(--c-border-2)"}`,
                  color: active ? (cfg ? cfg.color : "var(--c-text)") : "var(--c-text-4)",
                  fontFamily: "inherit",
                }}>
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── RESUMO ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)",
          gap: 8, marginBottom: 12,
        }}>
          {[
            { label: "Total hoje",   value: String(filteredSchedules.length), color: "var(--c-text)"    },
            { label: "Pendentes",    value: String(pendingCount),             color: "#F59E0B" },
            { label: "Confirmados",  value: String(confirmedCount),           color: "#3B82F6" },
            { label: "Em andamento", value: String(inProgressCount),          color: "#8B5CF6" },
            { label: "Faturado",     value: formatCurrency(totalRevenue),     color: "#10B981" },
          ].map((c, i) => (
            <div key={c.label} style={{
              backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)",
              borderRadius: 12, padding: "12px 14px",
              display: "flex", flexDirection: "column", gap: 4,
              gridColumn: isMobile && i === 4 ? "span 2" : undefined,
            }}>
              <span style={{ fontSize: 10, color: "var(--c-text-4)", fontWeight: 500, letterSpacing: "0.04em" }}>
                {c.label.toUpperCase()}
              </span>
              <span style={{ fontSize: isMobile ? 20 : 22, fontWeight: 800, color: c.color, letterSpacing: "-0.5px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {c.value}
              </span>
            </div>
          ))}
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div style={{
            backgroundColor: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 12, padding: "11px 16px", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <AlertCircle size={15} color="#EF4444" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#EF4444", flex: 1 }}>{error}</span>
            <button onClick={fetchSchedules} style={{
              fontSize: 12, color: "#EF4444", background: "none",
              border: "none", cursor: "pointer", textDecoration: "underline", padding: 0,
              fontFamily: "inherit",
            }}>Tentar novamente</button>
          </div>
        )}

        {/* ── SKELETON ── */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                height: isMobile ? 110 : 88, backgroundColor: "var(--c-surface)",
                border: "1px solid var(--c-border)", borderRadius: 14, padding: "14px 16px",
                animation: `skeletonPulse 1.5s ease-in-out ${i * 0.1}s infinite`,
              }}>
                <div style={{ height: 14, width: "40%", backgroundColor: "var(--c-border)", borderRadius: 6 }} />
                <div style={{ height: 12, width: "60%", backgroundColor: "var(--c-border)", borderRadius: 6, marginTop: 10 }} />
                <div style={{ height: 12, width: "30%", backgroundColor: "var(--c-border)", borderRadius: 6, marginTop: 8 }} />
              </div>
            ))}
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {!loading && filteredSchedules.length === 0 && (
          (searchQuery || filterStatus) ? (
            /* Há filtro/busca ativos: o dia pode ter agendamentos, só não batem. */
            <div style={{
              backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)",
              borderRadius: 16, padding: "48px 20px", textAlign: "center",
            }}>
              <Search size={32} color="var(--c-border-2)" style={{ margin: "0 auto 12px" }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--c-text)", margin: 0 }}>
                Nenhum agendamento com esse filtro
              </p>
              <p style={{ fontSize: 13, color: "var(--c-text-4)", marginTop: 6 }}>
                Em {dateInfo.day} de {dateInfo.month}, nada bate com a busca ou o status selecionado.
              </p>
              <button
                onClick={() => { setSearchQuery(""); setFilterStatus(""); setVisibleCount(LIST_PAGE_SIZE) }}
                style={{
                  marginTop: 16, height: 36, padding: "0 16px", borderRadius: 10,
                  background: "transparent", color: "var(--c-text-2)", fontSize: 13, fontWeight: 600,
                  border: "1px solid var(--c-border-2)", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            /* Sem filtro: realmente não há agendamento neste dia — estado que ensina. */
            <div style={{
              backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)",
              borderRadius: 16, padding: "56px 20px", textAlign: "center",
            }}>
              <div style={{
                width: 64, height: 64, backgroundColor: "var(--c-elevated)",
                border: "1px solid var(--c-border)", borderRadius: 20,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto",
              }}>
                <Calendar size={28} color="var(--c-border-2)" />
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "var(--c-text)", margin: "16px 0 0", letterSpacing: "-0.2px" }}>
                Nenhum agendamento em {dateInfo.day} de {dateInfo.month}
              </p>
              <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "8px auto 0", maxWidth: 440, lineHeight: 1.55 }}>
                Cada agendamento junta <span style={{ color: "var(--c-text-2)", fontWeight: 600 }}>cliente</span>, <span style={{ color: "var(--c-text-2)", fontWeight: 600 }}>veículo</span> e <span style={{ color: "var(--c-text-2)", fontWeight: 600 }}>serviço</span> — o modal cria os três na hora se ainda não existirem. O cliente também agenda sozinho pelo link da sua loja.
              </p>
              <button
                onClick={() => setShowNovoModal(true)}
                style={{
                  display: "inline-flex", gap: 8, alignItems: "center",
                  marginTop: 20, height: 40, padding: "0 22px",
                  background: "linear-gradient(135deg, #0066FF, #7C3AED)",
                  border: "none", borderRadius: 10,
                  color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <Plus size={15} />
                Novo agendamento
              </button>
              <p style={{
                display: "flex", gap: 6, alignItems: "center", justifyContent: "center",
                fontSize: 12, color: "var(--c-text-4)", margin: "14px 0 0",
              }}>
                <Link2 size={13} color="var(--c-text-4)" />
                O link público da loja fica em Configurações
              </p>
            </div>
          )
        )}

        {/* ── LISTA ── */}
        {!loading && filteredSchedules.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleSchedules.map((s) => {
              const st           = getStatusConfig(s.status)
              const serviceNames = serviceNamesOf(s)
              const isHov        = hovCard === s.id
              const isActing     = actionLoading === s.id

              return (
                <CardErrorBoundary key={s.id}>
                <div
                  onMouseEnter={() => handleHoverCard(s.id)}
                  onMouseLeave={() => handleHoverCard(null)}
                  style={{
                    backgroundColor: "var(--c-surface)",
                    border: `1px solid ${isHov ? "var(--c-border-2)" : "var(--c-border)"}`,
                    borderRadius: 14,
                    transition: "all 0.2s ease",
                    transform: isHov ? "translateY(-1px)" : "translateY(0)",
                    boxShadow: isHov ? "0 6px 24px rgba(0,0,0,0.35)" : "none",
                    overflow: "hidden",
                  }}
                >
                  {isMobile && <div style={{ height: 3, backgroundColor: st.color, width: "100%" }} />}

                  <div style={{ padding: isMobile ? "14px 14px 10px" : "14px 18px" }}>
                    {isMobile ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ flexShrink: 0, textAlign: "center", minWidth: 44 }}>
                            <p style={{ fontSize: 16, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums" }}>
                              {formatTime(s.scheduledAt)}
                            </p>
                            <p style={{ fontSize: 10, color: "var(--c-text-4)", margin: "1px 0 0", fontVariantNumeric: "tabular-nums" }}>
                              {formatShortDate(s.scheduledAt)}
                            </p>
                          </div>
                          <div style={{ width: 2, height: 40, borderRadius: 2, backgroundColor: st.color, flexShrink: 0, alignSelf: "center" }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>{customerName(s)}</span>
                              {s.isSubscriber && (
                                <span style={{ fontSize: 10, fontWeight: 600, color: "#A78BFA", backgroundColor: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 5, padding: "2px 6px" }}>Assinante</span>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                              <Car size={11} color="var(--c-text-4)" style={{ flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: "var(--c-text-4)" }}>
                                {vehicleLabel(s)}{s.vehicle?.plate ? <> · <span style={{ color: "var(--c-text-3)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{s.vehicle.plate}</span></> : null}
                              </span>
                            </div>
                            <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {serviceNames || "—"}
                            </p>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", backgroundColor: "var(--c-elevated)", borderRadius: 10 }}>
                          <div>
                            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--c-text)", margin: 0, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(s.totalPrice)}</p>
                            {s.discountApplied > 0 && <p style={{ fontSize: 11, color: "#10B981", margin: "1px 0 0", fontVariantNumeric: "tabular-nums" }}>-{formatCurrency(s.discountApplied)}</p>}
                            {s.paymentStatus === "PAID" ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: "#10B981", backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 5, padding: "2px 6px", marginTop: 3 }}>
                                <CheckCircle2 size={9} /> Pago · {getPaymentMethodLabel(s.paymentMethod)}
                              </span>
                            ) : s.status !== "CANCELLED" ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 5, padding: "2px 6px", marginTop: 3 }}>
                                <Clock size={9} /> Pag. pendente
                              </span>
                            ) : null}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: st.color, backgroundColor: st.bg, border: `1px solid ${st.border}`, padding: "5px 10px", borderRadius: 8, whiteSpace: "nowrap" }}>
                            {st.label}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          {s.status === "PENDING" && (<><ActionButton onClick={() => handleUpdateStatus(s.id, "CONFIRMED")} loading={isActing} color="#3B82F6" bg="rgba(59,130,246,0.08)" border="rgba(59,130,246,0.2)"><CheckCircle2 size={13} /> Confirmar</ActionButton><ActionButton onClick={() => handleUpdateStatus(s.id, "CANCELLED")} loading={isActing} color="#EF4444" bg="rgba(239,68,68,0.06)" border="rgba(239,68,68,0.15)"><XCircle size={13} /> Cancelar</ActionButton></>)}
                          {s.status === "CONFIRMED" && (<><ActionButton onClick={() => handleUpdateStatus(s.id, "IN_PROGRESS")} loading={isActing} color="#8B5CF6" bg="rgba(139,92,246,0.08)" border="rgba(139,92,246,0.2)"><Clock size={13} /> Iniciar</ActionButton><ActionButton onClick={() => handleUpdateStatus(s.id, "CANCELLED")} loading={isActing} color="#EF4444" bg="rgba(239,68,68,0.06)" border="rgba(239,68,68,0.15)"><XCircle size={13} /> Cancelar</ActionButton></>)}
                          {s.status === "IN_PROGRESS" && (<ActionButton onClick={() => handleOpenClose(s)} loading={isActing} color="#10B981" bg="rgba(16,185,129,0.08)" border="rgba(16,185,129,0.2)"><CreditCard size={13} /> Fechar comanda</ActionButton>)}
                          {s.status === "DONE" && <NfseEmBreveSelo />}
                          {s.status === "CANCELLED" && (<span style={{ fontSize: 12, color: "var(--c-text-4)" }}>Cancelado</span>)}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                        <div style={{ width: 52, flexShrink: 0, textAlign: "right" }}>
                          <p style={{ fontSize: 17, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums" }}>{formatTime(s.scheduledAt)}</p>
                          <p style={{ fontSize: 10, color: "var(--c-text-4)", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>{formatShortDate(s.scheduledAt)}</p>
                        </div>
                        <div style={{ width: 3, height: 44, borderRadius: 2, backgroundColor: st.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customerName(s)}</p>
                            {s.isSubscriber && (<span style={{ fontSize: 10, fontWeight: 600, color: "#A78BFA", backgroundColor: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 5, padding: "2px 7px", flexShrink: 0 }}>Assinante</span>)}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                            <Car size={11} color="var(--c-text-4)" style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: "var(--c-text-4)" }}>{vehicleLabel(s)}{s.vehicle?.plate ? <> · <span style={{ color: "var(--c-text-3)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{s.vehicle.plate}</span></> : null}</span>
                          </div>
                          <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{serviceNames || "—"}</p>
                        </div>
                        <div style={{ flexShrink: 0, textAlign: "right" }}>
                          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--c-text)", margin: 0, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(s.totalPrice)}</p>
                          {s.discountApplied > 0 && <p style={{ fontSize: 11, color: "#10B981", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>-{formatCurrency(s.discountApplied)}</p>}
                          {s.paymentStatus === "PAID" ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#10B981", backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 6, padding: "2px 7px", marginTop: 4 }}><CheckCircle2 size={10} /> Pago · {getPaymentMethodLabel(s.paymentMethod)}</span>
                          ) : s.status !== "CANCELLED" ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 6, padding: "2px 7px", marginTop: 4 }}><Clock size={10} /> Pagamento pendente</span>
                          ) : null}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: st.color, backgroundColor: st.bg, border: `1px solid ${st.border}`, padding: "5px 11px", borderRadius: 8, whiteSpace: "nowrap", flexShrink: 0 }}>{st.label}</span>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          {s.status === "PENDING" && (<><ActionButton onClick={() => handleUpdateStatus(s.id, "CONFIRMED")} loading={isActing} color="#3B82F6" bg="rgba(59,130,246,0.08)" border="rgba(59,130,246,0.2)"><CheckCircle2 size={13} /> Confirmar</ActionButton><ActionButton onClick={() => handleUpdateStatus(s.id, "CANCELLED")} loading={isActing} color="#EF4444" bg="rgba(239,68,68,0.06)" border="rgba(239,68,68,0.15)"><XCircle size={13} /></ActionButton></>)}
                          {s.status === "CONFIRMED" && (<><ActionButton onClick={() => handleUpdateStatus(s.id, "IN_PROGRESS")} loading={isActing} color="#8B5CF6" bg="rgba(139,92,246,0.08)" border="rgba(139,92,246,0.2)"><Clock size={13} /> Iniciar</ActionButton><ActionButton onClick={() => handleUpdateStatus(s.id, "CANCELLED")} loading={isActing} color="#EF4444" bg="rgba(239,68,68,0.06)" border="rgba(239,68,68,0.15)"><XCircle size={13} /></ActionButton></>)}
                          {s.status === "IN_PROGRESS" && (<ActionButton onClick={() => handleOpenClose(s)} loading={isActing} color="#10B981" bg="rgba(16,185,129,0.08)" border="rgba(16,185,129,0.2)"><CreditCard size={13} /> Fechar comanda</ActionButton>)}
                          {s.status === "DONE" && <NfseEmBreveSelo />}
                          {s.status === "CANCELLED" && (<span style={{ fontSize: 12, color: "var(--c-text-4)" }}>Cancelado</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                </CardErrorBoundary>
              )
            })}

            {/* ── CARREGAR MAIS ── */}
            {hasMore && (
              <button
                onClick={() => setVisibleCount((c) => c + LIST_PAGE_SIZE)}
                style={{
                  marginTop: 4, padding: "12px 20px",
                  backgroundColor: "var(--c-surface)",
                  border: "1px solid var(--c-border-2)", borderRadius: 12,
                  color: "var(--c-text-2)", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                Carregar mais ({filteredSchedules.length - visibleSchedules.length} restante{filteredSchedules.length - visibleSchedules.length !== 1 ? "s" : ""})
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL NOVO AGENDAMENTO ── */}
      {showNovoModal && (
        <NovoAgendamentoModal
          isMobile={isMobile}
          onClose={() => { setShowNovoModal(false); setPrefill(null) }}
          onSuccess={fetchSchedules}
          prefill={prefill}
        />
      )}

      {/* ── MODAL FECHAR COMANDA ── */}
      {showCloseModal && selectedSchedule && (
        <>
          <div onClick={() => setShowCloseModal(false)} style={{
            position: "fixed", inset: 0,
            backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
            zIndex: 100, animation: "fadeIn 0.2s ease",
          }} />
          <div style={{
            position: "fixed",
            top:    isMobile ? "auto" : "50%",
            bottom: isMobile ? 0 : "auto",
            left:   isMobile ? 0 : "50%",
            right:  isMobile ? 0 : "auto",
            transform: isMobile ? "none" : "translate(-50%, -50%)",
            backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)",
            borderRadius: isMobile ? "20px 20px 0 0" : 20,
            padding: 24, width: isMobile ? "100%" : "100%",
            maxWidth: isMobile ? "none" : 420,
            zIndex: 101, boxShadow: "0 -8px 40px rgba(0,0,0,0.6)",
            animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
          }}>
            {isMobile && <div style={{ width: 36, height: 4, backgroundColor: "var(--c-border-2)", borderRadius: 2, margin: "0 auto 16px" }} />}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>Fechar comanda</h2>
              <button onClick={() => setShowCloseModal(false)} style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--c-border)", border: "1px solid var(--c-border-2)", borderRadius: 8, cursor: "pointer", color: "var(--c-text-3)" }}>
                <X size={15} />
              </button>
            </div>
            <div style={{ backgroundColor: "var(--c-bg)", borderRadius: 12, padding: 14, marginBottom: 18 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)", margin: 0 }}>{customerName(selectedSchedule)}</p>
              <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "4px 0 0" }}>{serviceNamesOf(selectedSchedule) || "—"}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--c-border)" }}>
                <span style={{ fontSize: 13, color: "var(--c-text-4)" }}>Total a cobrar</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "var(--c-text)", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(selectedSchedule.totalPrice)}</span>
              </div>
              {selectedSchedule.discountApplied > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: "#10B981" }}>Desconto assinante</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#10B981", fontVariantNumeric: "tabular-nums" }}>-{formatCurrency(selectedSchedule.discountApplied)}</span>
                </div>
              )}
            </div>
            <p style={{ fontSize: 11, fontWeight: 500, color: "var(--c-text-4)", margin: "0 0 10px", letterSpacing: "0.05em" }}>FORMA DE PAGAMENTO</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {PAYMENT_METHODS.map((m) => {
                const sel = paymentMethod === m.value
                const Icon = m.icon
                return (
                  <button key={m.value} onClick={() => setPaymentMethod(m.value)} style={{
                    backgroundColor: sel ? "rgba(0,102,255,0.1)" : "var(--c-bg)",
                    border: `1px solid ${sel ? "rgba(0,102,255,0.35)" : "var(--c-border)"}`,
                    borderRadius: 10, padding: "12px 14px",
                    color: sel ? "#3B82F6" : "var(--c-text-3)",
                    fontSize: 13, fontWeight: sel ? 600 : 400, cursor: "pointer",
                    transition: "all 0.15s", display: "flex", flexDirection: "column",
                    alignItems: "flex-start", gap: 7, fontFamily: "inherit",
                  }}>
                    <Icon size={16} />{m.label}
                  </button>
                )
              })}
            </div>
            <button onClick={handleCloseSchedule} disabled={actionLoading === selectedSchedule.id} style={{
              width: "100%", height: 48, marginTop: 16,
              background: "linear-gradient(135deg, #10B981, #059669)",
              border: "none", borderRadius: 12, color: "white",
              fontSize: 14, fontWeight: 600,
              cursor: actionLoading === selectedSchedule.id ? "not-allowed" : "pointer",
              opacity: actionLoading === selectedSchedule.id ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "opacity 0.2s", marginBottom: isMobile ? 8 : 0,
              fontFamily: "inherit",
            }}>
              {actionLoading === selectedSchedule.id
                ? <><Spinner size={16} color="white" /> Processando...</>
                : <><CheckCircle2 size={16} /> Confirmar pagamento</>}
            </button>
          </div>
        </>
      )}
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NavArrow({ onClick, direction }: { onClick: () => void; direction: "left" | "right" }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 34, height: 34, borderRadius: 10, display: "flex",
        alignItems: "center", justifyContent: "center",
        backgroundColor: hov ? "var(--c-border-2)" : "var(--c-border)",
        border: "1px solid var(--c-border-2)", cursor: "pointer",
        transition: "background-color 0.15s", color: "var(--c-text-2)", flexShrink: 0,
        fontFamily: "inherit",
      }}
    >
      {direction === "left" ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
    </button>
  )
}