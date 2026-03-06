"use client"

import { Suspense, useState, useEffect, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Percent, Gift } from "lucide-react"
import type { PublicBusiness, PlanServiceRule } from "@/types"
import { isCustomerAuthenticated, getCustomerPayload, customerApiGet } from "@/lib/customer-auth"

type PublicService = PublicBusiness["services"][number]

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

const MONTHS   = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
const WEEKDAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]
const VEHICLE_TYPES = ["CAR","MOTORCYCLE","TRUCK","SUV"]
const VEHICLE_TYPE_LABELS: Record<string,string> = {
  CAR: "Carro", MOTORCYCLE: "Moto", TRUCK: "Caminhão", SUV: "SUV",
}

interface EmployeeOption {
  id:        string
  name:      string
  avatarUrl: string | null
  role?:     string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPastDate(dateStr: string): boolean {
  const today = new Date(); today.setHours(0,0,0,0)
  const d     = new Date(dateStr + "T00:00:00"); d.setHours(0,0,0,0)
  return d < today
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDuration(min: number) {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h${m}min` : `${h}h`
}

function hexToRgb(hex: string): string {
  const c = hex.replace("#","")
  return `${parseInt(c.slice(0,2),16)}, ${parseInt(c.slice(2,4),16)}, ${parseInt(c.slice(4,6),16)}`
}

/**
 * Hierarquia de desconto por serviço:
 *   1) Regra específica do serviço no plano (FREE, PERCENTAGE, FIXED)
 *   2) Desconto genérico do plano (discountPercent)
 *   3) Preço cheio
 */
function calcEffectivePrice(
  basePrice:       number,
  serviceId:       string,
  planServices:    PlanServiceRule[],
  genericDiscount: number,
): { effectivePrice: number; label: string | null } {
  const rule = planServices.find(r => r.serviceId === serviceId)

  if (rule) {
    switch (rule.discountType) {
      case "FREE":
        return {
          effectivePrice: 0,
          label: rule.maxUsages ? `Grátis (até ${rule.maxUsages}x)` : "Grátis",
        }
      case "PERCENTAGE": {
        const pct = rule.discountValue ?? 0
        const eff = Math.max(0, basePrice - Math.floor(basePrice * pct / 100))
        return {
          effectivePrice: eff,
          label: rule.maxUsages ? `${pct}% off (até ${rule.maxUsages}x)` : `${pct}% off`,
        }
      }
      case "FIXED": {
        const fix = rule.discountValue ?? 0
        const eff = Math.max(0, basePrice - fix)
        return {
          effectivePrice: eff,
          label: rule.maxUsages
            ? `${formatCurrency(fix)} off (até ${rule.maxUsages}x)`
            : `${formatCurrency(fix)} off`,
        }
      }
    }
  }

  if (genericDiscount > 0) {
    const eff = Math.max(0, basePrice - Math.floor(basePrice * genericDiscount / 100))
    return { effectivePrice: eff, label: `${genericDiscount}% off` }
  }

  return { effectivePrice: basePrice, label: null }
}

// ── FInput ────────────────────────────────────────────────────────────────────

function FInput({
  label, value, onChange, placeholder, required, type = "text", readOnly,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; type?: string; readOnly?: boolean
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 500, color: "#71717A", letterSpacing: "0.03em" }}>
        {label}{required && <span style={{ color: "#EF4444" }}> *</span>}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        style={{
          height: 40, padding: "0 12px", borderRadius: 10,
          border: "1px solid #2A2A2A", backgroundColor: readOnly ? "#0D0D0D" : "#161616",
          color: readOnly ? "#71717A" : "#fff", fontSize: 14, outline: "none",
          fontFamily: "inherit", boxSizing: "border-box", width: "100%",
          cursor: readOnly ? "not-allowed" : undefined,
        }}
      />
    </div>
  )
}

// ── Tipo do slot retornado pela API ───────────────────────────────────────────
interface SlotItem {
  time:      string   // "09:00"
  available: boolean
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AgendarPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #1F1F1F", borderTopColor: "#0066FF", animation: "sp 0.7s linear infinite" }} />
      </div>
    }>
      <AgendarContent />
    </Suspense>
  )
}

function AgendarContent() {
  const params       = useParams()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const slug         = params.slug as string

  // Business
  const [business,         setBusiness]         = useState<PublicBusiness | null>(null)
  const [selectedServices, setSelectedServices] = useState<PublicService[]>([])
  const [loading,          setLoading]          = useState(true)
  const [theme,            setTheme]            = useState("#0066FF")

  // Step: 1=data+profissional, 2=dados cliente, 3=confirmado
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Profissionais
  const [employees,        setEmployees]        = useState<EmployeeOption[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>("owner")
  const [loadingEmployees, setLoadingEmployees] = useState(false)

  // Calendário / slots
  const [calendarMonth,  setCalendarMonth]  = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [selectedDate,   setSelectedDate]   = useState("")
  const [availableSlots, setAvailableSlots] = useState<SlotItem[]>([])
  const [selectedSlot,   setSelectedSlot]   = useState("")
  const [confirmedSlot,  setConfirmedSlot]  = useState("")   // preserva o horário para a tela de confirmação
  const [loadingSlots,   setLoadingSlots]   = useState(false)

  // Dados do cliente
  const [customerName,  setCustomerName]  = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [vehiclePlate,  setVehiclePlate]  = useState("")
  const [vehicleBrand,  setVehicleBrand]  = useState("")
  const [vehicleModel,  setVehicleModel]  = useState("")
  const [vehicleColor,  setVehicleColor]  = useState("")
  const [vehicleType,   setVehicleType]   = useState("CAR")
  const [submitting,    setSubmitting]    = useState(false)
  const [submitError,   setSubmitError]   = useState<string | null>(null)
  const [isMobile,      setIsMobile]      = useState(false)
  const [isLoggedIn,    setIsLoggedIn]    = useState(false)
  const [activeSub,     setActiveSub]     = useState<{ planName: string; discountPercent: number; planServices: PlanServiceRule[] } | null>(null)

  // ── Load business ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return
    async function load() {
      try {
        const res  = await fetch(`${API}/api/public/${slug}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        const biz: PublicBusiness & { themeColor?: string } = data.business ?? data
        setBusiness(biz)
        setTheme(biz.themeColor ?? "#0066FF")
        const ids      = searchParams.getAll("services")
        const filtered = biz.services.filter((s: PublicService) => ids.includes(s.id))
        setSelectedServices(filtered.length > 0 ? filtered : biz.services)
      } catch {
        router.push(`/${slug}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  // ── Load employees ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!business) return
    setLoadingEmployees(true)
    fetch(`${API}/api/public/${business.slug}/employees`)
      .then(r => r.json())
      .then(d => {
        const list: EmployeeOption[] = d.employees ?? []
        setEmployees(list)
        if (list.length === 0) setSelectedEmployee("owner")
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmployees(false))
  }, [business])

  // ── Pre-fill customer data if logged in ───────────────────────────────────
  useEffect(() => {
    if (!isCustomerAuthenticated()) return
    const payload = getCustomerPayload()
    if (!payload) return
    setIsLoggedIn(true)
    if (payload.name) setCustomerName(payload.name)
    // email + phone + subscriber status from /customer/me
    customerApiGet<{ customer: { email?: string; phone: string; subscriptions?: Array<{ status: string; customerPlan?: { name: string; discountPercent: number; planServices?: PlanServiceRule[] } | null }> } }>("/customer/me")
      .then(({ customer }) => {
        if (customer.phone) setCustomerPhone(customer.phone)
        if (customer.email) setCustomerEmail(customer.email)
        // Check for active subscription with per-service rules
        const sub = customer.subscriptions?.find(s => s.status === "ACTIVE")
        if (sub?.customerPlan) {
          setActiveSub({
            planName: sub.customerPlan.name,
            discountPercent: sub.customerPlan.discountPercent,
            planServices: sub.customerPlan.planServices ?? [],
          })
        }
      })
      .catch(() => {})
  }, [])

  // ── fetchSlots — função estável com useCallback ───────────────────────────
  // ÚNICA definição — não duplicar abaixo
  const fetchSlots = useCallback(async (
    date:     string,
    empId?:   string,
    svcList?: typeof selectedServices
  ) => {
    const employee = empId    ?? selectedEmployee
    const svcs     = svcList  ?? selectedServices

    if (!business || svcs.length === 0 || !date) {
      setAvailableSlots([])
      return
    }

    setLoadingSlots(true)
    setSelectedSlot("")

    const serviceParams = svcs.map(s => `serviceIds=${encodeURIComponent(s.id)}`).join("&")
    const empParam =
      employee === "owner" ? "" :
      employee === "all"   ? "&employeeId=all" :
                             `&employeeId=${encodeURIComponent(employee)}`

    try {
      const res = await fetch(
        `${API}/api/public/${business.slug}/slots?date=${date}&${serviceParams}${empParam}`
      )
      if (!res.ok) throw new Error("Erro ao buscar horários")
      const data = await res.json()
      const raw: unknown = data.slots

      if (!Array.isArray(raw)) { setAvailableSlots([]); return }

      if (raw.length === 0) {
        setAvailableSlots([])
      } else if (typeof raw[0] === "string") {
        // compatibilidade com API legada (string[])
        setAvailableSlots((raw as string[]).map(t => ({ time: t, available: true })))
      } else {
        setAvailableSlots(raw as SlotItem[])
      }
    } catch {
      setAvailableSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [business, selectedEmployee, selectedServices])

  function handleSelectDate(dateStr: string) {
    if (isPastDate(dateStr)) return
    setSelectedDate(dateStr)
    setSelectedSlot("")
    fetchSlots(dateStr)
  }

  function handleSelectEmployee(empId: string) {
    setSelectedEmployee(empId)
    setSelectedSlot("")
    setSelectedDate("")      // resetar data ao trocar profissional
    setAvailableSlots([])
  }

  // Rebusca ao trocar serviços ou funcionário (mantendo data)
  useEffect(() => {
    if (selectedDate && selectedServices.length > 0) {
      fetchSlots(selectedDate)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployee, selectedServices])

  // ── isMobile detection ────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // ── handleSubmit ──────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!customerName.trim()) {
      setSubmitError("Nome é obrigatório."); return
    }
    if (!vehicleModel.trim()) {
      setSubmitError("Modelo do veículo é obrigatório."); return
    }

    setSubmitting(true)
    setSubmitError(null)

    // Construir scheduledAt como UTC puro — "08:00" → "08:00Z"
    const [year, mon, dayN] = selectedDate.split("-").map(Number)
    const [hour, min]       = selectedSlot.split(":").map(Number)
    const scheduledAt       = new Date(Date.UTC(year, mon - 1, dayN, hour, min, 0)).toISOString()

    try {
      let res: Response

      if (isLoggedIn) {
        // ── CLIENTE AUTENTICADO → usa endpoint autenticado ──────────────────
        // Garante que o customerId do JWT é usado, vinculando à assinatura.
        const authPayload = {
          serviceIds:  selectedServices.map(s => s.id),
          scheduledAt,
          employeeId:  selectedEmployee === "owner" ? undefined : selectedEmployee,
          notes:       undefined as string | undefined,
          vehicle: {
            plate: vehiclePlate.trim().toUpperCase() || "SEM-PLACA",
            brand: vehicleBrand.trim() || undefined,
            model: vehicleModel.trim(),
            color: vehicleColor.trim() || undefined,
            type:  vehicleType,
          },
        }

        // customerApiPost retorna o parsed JSON directly — precisamos adaptar
        // para tratar erros HTTP (409, etc.) do mesmo jeito que o fetch manual.
        const token = (await import("@/lib/customer-auth")).getCustomerToken()
        res = await fetch(`${API}/api/customer/schedules`, {
          method:  "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(authPayload),
        })
      } else {
        // ── CLIENTE ANÔNIMO → usa endpoint público ──────────────────────────
        const publicPayload = {
          businessId:  business!.id,
          serviceIds:  selectedServices.map(s => s.id),
          scheduledAt,
          employeeId:  selectedEmployee === "owner" ? undefined : selectedEmployee,
          customer: {
            name:  customerName.trim(),
            phone: customerPhone.trim() || undefined,
            email: customerEmail.trim() || undefined,
          },
          vehicle: {
            plate: vehiclePlate.trim().toUpperCase() || "SEM-PLACA",
            brand: vehicleBrand.trim() || undefined,
            model: vehicleModel.trim(),
            color: vehicleColor.trim() || undefined,
            type:  vehicleType,
          },
        }

        res = await fetch(`${API}/api/schedules`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(publicPayload),
        })
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))

        // Conflito de horário — recarregar slots imediatamente
        if (res.status === 409 || err.code === "SCHEDULE_CONFLICT") {
          setSubmitError("⚠️ Este horário foi reservado agora. Escolha outro horário.")
          setSelectedSlot("")
          // ← refresh imediato para o slot ocupado sumir
          await fetchSlots(selectedDate)
          return
        }

        throw new Error(err.error || err.message || "Erro ao agendar.")
      }

      // ✅ SUCESSO — salvar horário para tela de confirmação, limpar slot e recarregar
      setConfirmedSlot(selectedSlot)
      setSelectedSlot("")
      // Recarrega para o slot reservado sumir da tela
      await fetchSlots(selectedDate)
      // Avançar para tela de confirmação
      setStep(3)

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao agendar. Tente novamente."
      setSubmitError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const totalSelected = selectedServices.reduce(
    (acc, s) => ({ price: acc.price + s.price, duration: acc.duration + s.durationMinutes }),
    { price: 0, duration: 0 }
  )

  // Total com desconto por serviço (hierarquia: regra específica → genérico → cheio)
  const totalWithDiscount = activeSub
    ? selectedServices.reduce((acc, s) => {
        const { effectivePrice } = calcEffectivePrice(s.price, s.id, activeSub.planServices, activeSub.discountPercent)
        return acc + effectivePrice
      }, 0)
    : totalSelected.price
  const hasAnyDiscount = activeSub !== null && totalWithDiscount < totalSelected.price

  const themeRgb = hexToRgb(theme)

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <>
      <style>{`@keyframes spinAg{to{transform:rotate(360deg)}}`}</style>
      <div style={{ minHeight: "100vh", backgroundColor: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #1F1F1F", borderTopColor: "#0066FF", animation: "spinAg 0.7s linear infinite" }} />
      </div>
    </>
  )

  if (!business) return null

  const showEmpStep = employees.length > 0

  return (
    <>
      <style>{`
        @keyframes fadeAg  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spinAg  { to{transform:rotate(360deg)} }
        @keyframes skPulse { 0%,100%{opacity:.4} 50%{opacity:.9} }
        .ag-slot-btn:hover:not(:disabled) {
          border-color: ${theme} !important;
          color: #fff !important;
          background: rgba(${themeRgb}, 0.08) !important;
        }
        .ag-emp-card:hover { border-color: ${theme} !important; }
        .ag-day-btn:hover:not(:disabled):not(.ag-day-sel):not(.ag-day-past) {
          background: #111827 !important;
          color: #fff !important;
        }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{
        minHeight: "100vh", backgroundColor: "#0A0A0A",
        fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
      }}>

        {/* ── Top bar ── */}
        <div style={{
          position: "sticky", top: 0, zIndex: 40,
          backgroundColor: "rgba(10,10,10,0.97)", backdropFilter: "blur(12px)",
          borderBottom: "1px solid #1A1A1A",
        }}>
          <div style={{
            maxWidth: 760, margin: "0 auto", padding: "0 20px",
            height: 56, display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <button
              onClick={() => step === 1 ? router.push(`/${slug}`) : setStep(s => (s - 1) as 1|2|3)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 13, color: "#A1A1AA", fontFamily: "inherit", padding: 0,
              }}
            >
              <ChevronLeft size={16} /> Voltar
            </button>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0 }}>{business!.name}</p>
              <p style={{ fontSize: 11, color: "#52525B", margin: "2px 0 0" }}>
                {step === 1 ? "Escolha data e horário" : step === 2 ? "Seus dados" : "Confirmado!"}
              </p>
            </div>
            <div style={{ width: 60 }} />
          </div>
        </div>

        {/* Progress */}
        <div style={{ height: 2, backgroundColor: "#111" }}>
          <div style={{
            height: "100%",
            background: `linear-gradient(90deg,${theme},#7C3AED)`,
            width: step === 1 ? "33%" : step === 2 ? "66%" : "100%",
            transition: "width 0.3s ease",
          }} />
        </div>

        <div style={{ maxWidth: 760, margin: "0 auto", padding: isMobile ? "16px 14px 100px" : "24px 20px 100px" }}>

          {/* ══════ STEP 1 ══════ */}
          {step === 1 && (
            <div style={{ animation: "fadeAg 0.25s ease" }}>

              {/* Resumo dos serviços */}
              <div style={{
                backgroundColor: "#09090B", border: "1px solid #1F1F1F",
                borderRadius: 18, padding: isMobile ? "14px 16px" : "16px 20px",
                marginBottom: 16,
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#52525B", margin: "0 0 10px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Serviços selecionados
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {selectedServices.map(s => {
                    const disc = activeSub ? calcEffectivePrice(s.price, s.id, activeSub.planServices, activeSub.discountPercent) : null
                    const isFree = disc?.effectivePrice === 0
                    return (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {isFree && <Gift size={12} color="#10B981" />}
                          <span style={{ fontSize: 13, color: "#F9FAFB", fontWeight: 500 }}>{s.name}</span>
                        </div>
                        <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 12, color: "#6B7280" }}>{formatDuration(s.durationMinutes)}</span>
                          {disc && disc.effectivePrice < s.price ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                              {isFree ? (
                                <span style={{ fontSize: 13, color: "#10B981", fontWeight: 700 }}>Grátis</span>
                              ) : (
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  <span style={{ fontSize: 11, color: "#52525B", textDecoration: "line-through" }}>{formatCurrency(s.price)}</span>
                                  <span style={{ fontSize: 13, color: "#10B981", fontWeight: 700 }}>{formatCurrency(disc.effectivePrice)}</span>
                                </div>
                              )}
                              {disc.label && (
                                <span style={{ fontSize: 10, color: "#A78BFA" }}>{disc.label}</span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 13, color: theme, fontWeight: 600 }}>{formatCurrency(s.price)}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {selectedServices.length > 1 && (
                  <div style={{ borderTop: "1px solid #1F1F1F", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "#6B7280" }}>Total</span>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#6B7280" }}>{formatDuration(totalSelected.duration)}</span>
                      {hasAnyDiscount ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "#52525B", textDecoration: "line-through" }}>{formatCurrency(totalSelected.price)}</span>
                          <span style={{ fontSize: 13, color: "#10B981", fontWeight: 700 }}>{formatCurrency(totalWithDiscount)}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 13, color: theme, fontWeight: 700 }}>{formatCurrency(totalSelected.price)}</span>
                      )}
                    </div>
                  </div>
                )}
                {hasAnyDiscount && (
                  <div style={{ borderTop: "1px solid #1F1F1F", marginTop: 10, paddingTop: 10 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 8, padding: "6px 10px" }}>
                      <Percent size={12} color="#10B981" />
                      <span style={{ fontSize: 12, color: "#10B981", fontWeight: 600 }}>
                        Desconto assinante — plano {activeSub?.planName}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Profissional ── */}
              {showEmpStep && (
                <div style={{
                  backgroundColor: "#09090B", border: "1px solid #1F1F1F",
                  borderRadius: 18, padding: isMobile ? "14px 16px" : "16px 20px",
                  marginBottom: 16,
                }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#52525B", margin: "0 0 14px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Com quem você quer ser atendido?
                  </p>
                  {loadingEmployees ? (
                    <div style={{ display: "flex", gap: 10 }}>
                      {[1,2,3].map(i => (
                        <div key={i} style={{ width: 82, height: 104, borderRadius: 14, backgroundColor: "#111827", animation: `skPulse 1.4s ease ${i*0.1}s infinite` }} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {(employees.length === 0 || employees.every(e => e.role !== "OWNER")) && (
                        <EmployeeCard
                          emp={{ id: "owner", name: "Proprietário", avatarUrl: null, role: "OWNER" }}
                          selected={selectedEmployee === "owner"}
                          theme={theme} themeRgb={themeRgb}
                          onSelect={() => handleSelectEmployee("owner")}
                        />
                      )}
                      {employees.map(emp => (
                        <EmployeeCard
                          key={emp.id} emp={emp}
                          selected={selectedEmployee === emp.id}
                          theme={theme} themeRgb={themeRgb}
                          onSelect={() => handleSelectEmployee(emp.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Calendário + Slots (layout 2 colunas no desktop) ── */}
              <div style={{
                backgroundColor: "#09090B", border: "1px solid #1F1F1F",
                borderRadius: 18, padding: isMobile ? "14px 14px" : "20px 24px",
                marginBottom: 16,
              }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#F9FAFB", margin: "0 0 4px" }}>
                  Escolha a data e o horário
                </p>
                <p style={{ fontSize: 12, color: "#9CA3AF", margin: "0 0 18px" }}>
                  Selecione o dia no calendário e depois o horário disponível.
                </p>

                <div style={isMobile ? {} : {
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)",
                  gap: 24, alignItems: "start",
                }}>

                  {/* Calendário */}
                  <div style={{
                    backgroundColor: "#0B0B0F", border: "1px solid #1F2937",
                    borderRadius: 14, padding: isMobile ? 12 : 16,
                    marginBottom: isMobile ? 16 : 0,
                  }}>
                    {/* Header mês/ano */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <button
                        onClick={() => setCalendarMonth(d => { const n = new Date(d); n.setMonth(n.getMonth()-1); return n })}
                        style={{
                          width: isMobile ? 28 : 32, height: isMobile ? 28 : 32,
                          borderRadius: "50%", backgroundColor: "#111827",
                          border: "1px solid #1F2937", color: "#E5E7EB",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#F9FAFB" }}>
                        {MONTHS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                      </span>
                      <button
                        onClick={() => setCalendarMonth(d => { const n = new Date(d); n.setMonth(n.getMonth()+1); return n })}
                        style={{
                          width: isMobile ? 28 : 32, height: isMobile ? 28 : 32,
                          borderRadius: "50%", backgroundColor: "#111827",
                          border: "1px solid #1F2937", color: "#E5E7EB",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    {/* Labels dias da semana */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", marginBottom: 4 }}>
                      {WEEKDAYS.map(d => (
                        <div key={d} style={{ textAlign: "center", fontSize: 11, color: "#6B7280", fontWeight: 500, paddingBottom: 4 }}>
                          {d.charAt(0)}
                        </div>
                      ))}
                    </div>

                    {/* Grid de dias */}
                    {(() => {
                      const year  = calendarMonth.getFullYear()
                      const mon   = calendarMonth.getMonth()
                      const first = new Date(year, mon, 1).getDay()
                      const total = new Date(year, mon + 1, 0).getDate()
                      const cells: (number | null)[] = [
                        ...Array(first).fill(null),
                        ...Array.from({ length: total }, (_, i) => i + 1),
                      ]
                      while (cells.length % 7 !== 0) cells.push(null)
                      const todayISO = new Date().toISOString().split("T")[0]
                      const daySize  = isMobile ? 32 : 36

                      return (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 4 }}>
                          {cells.map((day, i) => {
                            if (!day) return <div key={i} style={{ height: daySize }} />
                            const dStr = `${year}-${String(mon+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`
                            const past = isPastDate(dStr)
                            const sel  = dStr === selectedDate
                            const tod  = dStr === todayISO

                            return (
                              <button
                                key={i}
                                onClick={() => !past && handleSelectDate(dStr)}
                                disabled={past}
                                className={`ag-day-btn${sel ? " ag-day-sel" : ""}${past ? " ag-day-past" : ""}`}
                                style={{
                                  width: daySize, height: daySize,
                                  borderRadius: "50%",
                                  margin: "0 auto",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 13, fontWeight: sel || tod ? 600 : 400,
                                  border: tod && !sel ? `1px solid ${theme}` : "none",
                                  background: sel ? theme : "transparent",
                                  color: past ? "#4B5563" : sel ? "#fff" : tod ? theme : "#D1D5DB",
                                  cursor: past ? "not-allowed" : "pointer",
                                  fontFamily: "inherit",
                                  transition: "all 0.12s",
                                  flexShrink: 0,
                                }}
                              >
                                {day}
                              </button>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Slots */}
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#E5E7EB", margin: "0 0 10px" }}>
                      {selectedDate
                        ? `Horários — ${new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}`
                        : "Selecione uma data"}
                    </p>

                    {!selectedDate && (
                      <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>
                        Escolha um dia no calendário para ver os horários disponíveis.
                      </p>
                    )}

                    {selectedDate && loadingSlots && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(80px,1fr))", gap: 8 }}>
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} style={{
                            height: 34, borderRadius: 10, backgroundColor: "#111827",
                            animation: `skPulse 1.4s ease ${i*0.05}s infinite`,
                          }} />
                        ))}
                      </div>
                    )}

                    {selectedDate && !loadingSlots && availableSlots.length === 0 && (
                      <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>
                        Nenhum horário disponível. Tente outra data.
                      </p>
                    )}

                    {selectedDate && !loadingSlots && availableSlots.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(80px,1fr))", gap: 8 }}>
                        {availableSlots.map(slot => {
                          const sel      = slot.time === selectedSlot
                          const disabled = !slot.available

                          return (
                            <button
                              key={slot.time}
                              className={disabled ? undefined : "ag-slot-btn"}
                              onClick={() => !disabled && setSelectedSlot(slot.time)}
                              disabled={disabled}
                              title={disabled ? "Horário indisponível" : undefined}
                              style={{
                                height: 34, borderRadius: 10, fontSize: 13, fontWeight: sel ? 700 : 500,
                                background:  sel     ? theme   : disabled ? "#0D0D0D" : "#020617",
                                border:      sel     ? `1px solid ${theme}` : disabled ? "1px solid #161616" : "1px solid #1F2937",
                                color:       sel     ? "#fff"  : disabled ? "#3F3F46" : "#E5E7EB",
                                opacity:     disabled ? 0.35   : 1,
                                cursor:      disabled ? "not-allowed" : "pointer",
                                pointerEvents: disabled ? "none" : "auto",
                                fontFamily: "inherit",
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
                      <p style={{ fontSize: 12, color: "#6B7280", margin: "8px 0 0", textAlign: "center" }}>
                        Nenhum horário disponível para este profissional neste dia.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Botão avançar */}
              {selectedDate && selectedSlot && (
                <button
                  onClick={() => setStep(2)}
                  style={{
                    width: "100%", height: 50, borderRadius: 14,
                    background: `linear-gradient(135deg, ${theme}, #7C3AED)`,
                    border: "none", color: "#fff", fontSize: 15, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    boxShadow: `0 4px 24px rgba(${themeRgb},0.3)`,
                    animation: "fadeAg 0.2s ease",
                  }}
                >
                  Continuar →
                </button>
              )}
            </div>
          )}

          {/* ══════ STEP 2 ══════ */}
          {step === 2 && (
            <div style={{ animation: "fadeAg 0.25s ease" }}>

              {/* Resumo do agendamento */}
              <div style={{
                backgroundColor: "#111111", border: "1px solid #1F1F1F",
                borderRadius: 16, padding: "16px 20px", marginBottom: 20,
              }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#52525B", margin: "0 0 10px", letterSpacing: "0.04em" }}>
                  SEU AGENDAMENTO
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <SummaryRow label="Serviços" value={selectedServices.map(s => s.name).join(", ")} />
                  <SummaryRow label="Data" value={new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} />
                  <SummaryRow label="Horário" value={selectedSlot} />
                  {showEmpStep && (
                    <SummaryRow
                      label="Profissional"
                      value={
                        selectedEmployee === "owner"
                          ? "Proprietário"
                          : employees.find(e => e.id === selectedEmployee)?.name ?? "—"
                      }
                    />
                  )}
                  <SummaryRow label="Valor" value={formatCurrency(totalSelected.price)} />
                  {hasAnyDiscount && (
                    <>
                      <SummaryRow label={`Desconto assinante — ${activeSub?.planName}`} value={`-${formatCurrency(totalSelected.price - totalWithDiscount)}`} />
                      <div style={{ borderTop: "1px solid #1F1F1F", marginTop: 4, paddingTop: 6, display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ fontSize: 13, color: "#10B981", fontWeight: 600 }}>Valor final</span>
                        <span style={{ fontSize: 14, color: "#10B981", fontWeight: 800 }}>
                          {formatCurrency(totalWithDiscount)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Dados cliente */}
              <div style={{
                backgroundColor: "#111111", border: "1px solid #1F1F1F",
                borderRadius: 16, padding: "16px 20px", marginBottom: 16,
              }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#52525B", margin: "0 0 14px", letterSpacing: "0.04em" }}>
                  SEUS DADOS
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <FInput label="Nome completo" value={customerName} onChange={setCustomerName} required placeholder="João Silva" />
                  <FInput label="Telefone / WhatsApp" value={customerPhone} onChange={setCustomerPhone} placeholder="(11) 99999-9999" type="tel" />
                  <FInput label={isLoggedIn ? "E-mail (da sua conta)" : "E-mail"} value={customerEmail} onChange={setCustomerEmail} placeholder="joao@email.com" type="email" readOnly={isLoggedIn} />
                </div>
              </div>

              {/* Dados veículo */}
              <div style={{
                backgroundColor: "#111111", border: "1px solid #1F1F1F",
                borderRadius: 16, padding: "16px 20px", marginBottom: 16,
              }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#52525B", margin: "0 0 14px", letterSpacing: "0.04em" }}>
                  DADOS DO VEÍCULO
                </p>

                {/* Tipo */}
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  {VEHICLE_TYPES.map(t => (
                    <button
                      key={t}
                      onClick={() => setVehicleType(t)}
                      style={{
                        height: 32, padding: "0 14px", borderRadius: 8, fontSize: 12,
                        fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                        border: vehicleType === t ? `1px solid ${theme}` : "1px solid #2A2A2A",
                        background: vehicleType === t ? `rgba(${themeRgb},0.1)` : "transparent",
                        color: vehicleType === t ? theme : "#71717A",
                      }}
                    >
                      {VEHICLE_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <FInput label="Placa (opcional)" value={vehiclePlate} onChange={v => setVehiclePlate(v.toUpperCase())} placeholder="ABC-1234" />
                    <FInput label="Cor (opcional)" value={vehicleColor} onChange={setVehicleColor} placeholder="Prata" />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <FInput label="Marca" value={vehicleBrand} onChange={setVehicleBrand} placeholder="Toyota" />
                    <FInput label="Modelo" value={vehicleModel} onChange={setVehicleModel} required placeholder="Corolla" />
                  </div>
                </div>
              </div>

              {/* Erro */}
              {submitError && (
                <div style={{
                  display: "flex", gap: 8, alignItems: "flex-start",
                  backgroundColor: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 12, padding: "12px 14px", marginBottom: 16,
                }}>
                  <AlertCircle size={15} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: "#EF4444" }}>{submitError}</span>
                </div>
              )}

              {/* Confirmar */}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  width: "100%", height: 48, borderRadius: 14,
                  background: submitting ? "#1A1A1A" : `linear-gradient(135deg, #10B981, #059669)`,
                  border: "none", color: submitting ? "#52525B" : "#fff",
                  fontSize: 15, fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {submitting ? (
                  <>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #3F3F46", borderTopColor: "#fff", animation: "spinAg 0.7s linear infinite" }} />
                    Confirmando...
                  </>
                ) : (
                  <><CheckCircle2 size={16} /> Confirmar agendamento</>
                )}
              </button>
            </div>
          )}

          {/* ══════ STEP 3 ══════ */}
          {step === 3 && (
            <div style={{ animation: "fadeAg 0.25s ease", textAlign: "center", paddingTop: 48 }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "linear-gradient(135deg,#10B981,#059669)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
                boxShadow: "0 8px 32px rgba(16,185,129,0.3)",
              }}>
                <CheckCircle2 size={34} color="#fff" />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>
                Agendamento confirmado! 🎉
              </h2>
              <p style={{ fontSize: 14, color: "#71717A", margin: "0 0 32px" }}>
                Em breve você receberá uma confirmação.
              </p>

              <div style={{
                backgroundColor: "#111111", border: "1px solid #1F1F1F",
                borderRadius: 16, padding: "16px 20px", marginBottom: 24, textAlign: "left",
              }}>
                <SummaryRow label="Serviços" value={selectedServices.map(s => s.name).join(", ")} />
                <SummaryRow label="Data" value={new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} />
                <SummaryRow label="Horário" value={confirmedSlot || selectedSlot} />
                <SummaryRow label="Valor" value={
                  hasAnyDiscount
                    ? formatCurrency(totalWithDiscount)
                    : formatCurrency(totalSelected.price)
                } />
              </div>

              <button
                onClick={() => router.push(`/${slug}`)}
                style={{
                  width: "100%", height: 48, borderRadius: 14,
                  background: `linear-gradient(135deg, ${theme}, #7C3AED)`,
                  border: "none", color: "#fff", fontSize: 15, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Voltar para a loja
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function EmployeeCard({
  emp, selected, theme, themeRgb, onSelect,
}: {
  emp: EmployeeOption; selected: boolean
  theme: string; themeRgb: string; onSelect: () => void
}) {
  const initials = emp.name
    .split(" ").filter(Boolean).slice(0,2).map(n => n[0].toUpperCase()).join("")

  return (
    <div
      className="ag-emp-card"
      onClick={onSelect}
      style={{
        width: 90, padding: "12px 8px",
        backgroundColor: selected ? `rgba(${themeRgb},0.07)` : "#161616",
        border: selected ? `1px solid ${theme}` : "1px solid #1F1F1F",
        borderRadius: 14, cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        transition: "all 0.15s", flexShrink: 0,
      }}
    >
      {/* Avatar */}
      {emp.avatarUrl ? (
        <img
          src={emp.avatarUrl}
          alt={emp.name}
          style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover",
            border: selected ? `2px solid ${theme}` : "2px solid #2A2A2A",
          }}
        />
      ) : (
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: selected
            ? `linear-gradient(135deg, ${theme}, ${theme}99)`
            : "linear-gradient(135deg,#2A2A2A,#1A1A1A)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 700,
          color: selected ? "#fff" : "#52525B",
        }}>
          {initials}
        </div>
      )}

      {/* Nome */}
      <span style={{
        fontSize: 11, fontWeight: 500, textAlign: "center", lineHeight: 1.3,
        color: selected ? "#fff" : "#A1A1AA",
        maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {emp.name}
      </span>

      {/* Badge proprietário */}
      {emp.role === "OWNER" && (
        <span style={{
          fontSize: 9, fontWeight: 600, color: theme,
          backgroundColor: `rgba(${themeRgb},0.12)`,
          borderRadius: 4, padding: "1px 5px", marginTop: -4,
          lineHeight: 1.5,
        }}>
          Proprietário
        </span>
      )}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
      <span style={{ fontSize: 13, color: "#71717A" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#fff", fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  )
}