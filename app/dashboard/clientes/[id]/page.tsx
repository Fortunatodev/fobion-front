"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Phone, Mail, Car, Calendar, AlertCircle,
  Crown, CheckCircle2, CreditCard, FileText, Hash, Wallet,
  Edit3, Plus, CalendarPlus, X,
} from "lucide-react"
import { apiGet, apiPost, apiPut } from "@/lib/api"
import { formatScheduleTime, formatScheduleDate } from "@/lib/dateUtils"
import { toast } from "sonner"

// ── Types (shape exato de getCustomerController → { customer }) ─────────────────

type VehicleType = "CAR" | "MOTORCYCLE" | "TRUCK" | "SUV"
type ScheduleStatus = "REQUESTED" | "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "DONE" | "CANCELLED"
type PaymentStatus = "PENDING" | "PAID"
type PaymentMethod = "PIX" | "CREDIT_CARD" | "DEBIT_CARD" | "CASH" | "PENDING"

interface Vehicle {
  id: string
  plate: string | null
  brand: string | null
  model: string
  color: string
  type: VehicleType
}

interface ScheduleServiceEntry {
  id: string
  priceSnapshot: number
  service: {
    id: string
    name: string
    price: number
  }
}

interface Schedule {
  id: string
  scheduledAt: string
  status: ScheduleStatus
  notes: string | null
  totalPrice: number
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  isSubscriber: boolean
  discountApplied: number
  scheduleServices: ScheduleServiceEntry[]
}

interface CustomerDetail {
  id: string
  name: string
  phone: string | null
  email: string | null
  picture: string | null
  createdAt: string
  vehicles: Vehicle[]
  schedules: Schedule[]
}

// Estado do modal de ações: editar cliente, novo veículo ou editar veículo.
type ModalState =
  | { mode: "edit-customer" }
  | { mode: "add-vehicle" }
  | { mode: "edit-vehicle"; vehicle: Vehicle }

// ── Helpers ─────────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR")
}

// Data + hora do agendamento usando o MESMO critério UTC do resto do app
// (formatScheduleDate/Time tratam o horário salvo como UTC "puro"), evitando
// o desvio de fuso do browser — ex.: um agendamento das 08:00 não vira 05:00.
function formatScheduleDateTime(iso: string): string {
  const [y, m, d] = formatScheduleDate(iso).split("-")
  return `${d}/${m}/${y} ${formatScheduleTime(iso)}`
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  CAR: "Carro", MOTORCYCLE: "Moto", TRUCK: "Caminhão", SUV: "SUV",
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  PIX: "PIX", CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito", CASH: "Dinheiro", PENDING: "Pendente",
}

function getStatusConfig(status: ScheduleStatus): { label: string; color: string; bg: string; border: string } {
  const map: Record<ScheduleStatus, { label: string; color: string; bg: string; border: string }> = {
    REQUESTED:   { label: "Solicitado",   color: "#F59E0B", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.30)" },
    PENDING:     { label: "Pendente",     color: "#FBBF24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.25)" },
    CONFIRMED:   { label: "Confirmado",   color: "#3B82F6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.25)" },
    IN_PROGRESS: { label: "Em andamento", color: "#8B5CF6", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.25)" },
    DONE:        { label: "Concluído",    color: "#10B981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)" },
    CANCELLED:   { label: "Cancelado",    color: "#EF4444", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.25)"  },
  }
  return map[status]
}

// Monta o link wa.me a partir do telefone do cliente. Retorna null se inválido.
function buildWhatsAppHref(phone: string | null): string | null {
  const digits = (phone || "").replace(/\D/g, "")
  if (digits.length < 10) return null
  return `https://wa.me/${digits.startsWith("55") ? digits : "55" + digits}`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClienteDetalhePage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Modal de ações (editar cliente / adicionar ou editar veículo).
  // `vehicle` é o veículo em edição quando o modo é "edit-vehicle".
  const [modal, setModal] = useState<ModalState | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const fetchCustomer = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<{ customer: CustomerDetail }>(`/customers/${id}`)
      setCustomer(res.customer)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar o cliente."
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchCustomer() }, [fetchCustomer])

  // Leva pro fluxo de novo agendamento já indicando o cliente atual via query.
  // (A tela de agendamentos pode consumir o param para pré-selecionar; se não
  // consumir ainda, o atendente apenas busca o cliente — sem endpoint novo.)
  const goToNewSchedule = useCallback(() => {
    if (!customer) return
    const params = new URLSearchParams({ customerId: customer.id })
    if (customer.name) params.set("customerName", customer.name)
    router.push(`/dashboard/agendamentos?${params.toString()}`)
  }, [customer, router])

  // ── Derived ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!customer) return { total: 0, done: 0, revenue: 0, isSubscriber: false }
    const done = customer.schedules.filter((s) => s.status === "DONE")
    return {
      total: customer.schedules.length,
      done:  done.length,
      // Receita real = soma das comandas pagas
      revenue: customer.schedules
        .filter((s) => s.paymentStatus === "PAID")
        .reduce((acc, s) => acc + s.totalPrice, 0),
      // Assinante se qualquer agendamento foi marcado como de assinante
      isSubscriber: customer.schedules.some((s) => s.isSubscriber),
    }
  }, [customer])

  const whatsappHref = buildWhatsAppHref(customer?.phone ?? null)

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <style>{`@keyframes cdSpin { to { transform: rotate(360deg); } }`}</style>
        <div
          style={{
            width: 34, height: 34, borderRadius: "50%",
            border: "3px solid var(--c-border)", borderTopColor: "#0066FF",
            animation: "cdSpin 0.7s linear infinite",
          }}
        />
      </div>
    )
  }

  // ── Error / 404 ────────────────────────────────────────────────────────────────

  if (error || !customer) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <AlertCircle size={26} color="#EF4444" />
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
          Cliente não encontrado
        </h1>
        <p style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 8 }}>
          {error ?? "O cliente que você procura não existe ou foi removido."}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24 }}>
          <button
            onClick={() => router.push("/dashboard/clientes")}
            style={{
              height: 40, padding: "0 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: "pointer", background: "transparent", border: "1px solid var(--c-border-2)",
              color: "var(--c-text-2)", fontFamily: "inherit",
            }}
          >
            Voltar para clientes
          </button>
          <button
            onClick={fetchCustomer}
            style={{
              height: 40, padding: "0 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: "pointer", background: "linear-gradient(135deg, #0066FF, #7C3AED)",
              border: "none", color: "white", fontFamily: "inherit",
            }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes cdFade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes cdSpin { to { transform: rotate(360deg); } }
      `}</style>

      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: isMobile ? "16px 14px" : "24px 20px",
          animation: "cdFade 0.35s ease both",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* ── BACK ──────────────────────────────────────────────────────────── */}
        <button
          onClick={() => router.push("/dashboard/clientes")}
          style={{
            display: "flex", alignItems: "center", gap: 6, background: "transparent",
            border: "none", color: "var(--c-text-3)", fontSize: 13, cursor: "pointer",
            marginBottom: 18, padding: 0, fontFamily: "inherit",
          }}
        >
          <ArrowLeft size={14} /> Voltar
        </button>

        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: isMobile ? "flex-start" : "center",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 16 : 18,
            backgroundColor: "var(--c-surface)",
            border: "1px solid var(--c-border)",
            borderRadius: 18,
            padding: isMobile ? "18px" : "22px 24px",
            marginBottom: 20,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 64, height: 64, borderRadius: 18, flexShrink: 0,
              background: "linear-gradient(135deg, rgba(0,102,255,0.18), rgba(124,58,237,0.18))",
              border: "1px solid rgba(0,102,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 700, color: "#0066FF", userSelect: "none",
              overflow: "hidden",
            }}
          >
            {customer.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={customer.picture} alt={customer.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              getInitials(customer.name)
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.02em" }}>
                {customer.name}
              </h1>
              {stats.isSubscriber && (
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700,
                    color: "#F59E0B", background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.3)",
                    borderRadius: 99, padding: "3px 9px",
                  }}
                >
                  <Crown size={12} /> Assinante
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Phone size={13} color="var(--c-text-4)" />
                <span style={{ fontSize: 13, color: "var(--c-text-2)", fontVariantNumeric: "tabular-nums" }}>
                  {customer.phone || "Sem telefone"}
                </span>
              </span>
              {customer.email && (
                <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <Mail size={13} color="var(--c-text-4)" />
                  <span style={{ fontSize: 13, color: "var(--c-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>
                    {customer.email}
                  </span>
                </span>
              )}
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Calendar size={13} color="var(--c-text-4)" />
                <span style={{ fontSize: 13, color: "var(--c-text-4)", fontVariantNumeric: "tabular-nums" }}>
                  Cliente desde {formatDate(customer.createdAt)}
                </span>
              </span>
            </div>
          </div>

          {/* Ações */}
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              alignItems: "stretch",
              gap: 8,
              flexShrink: 0,
              width: isMobile ? "100%" : undefined,
            }}
          >
            <button
              type="button"
              onClick={() => setModal({ mode: "edit-customer" })}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                height: 42, padding: "0 16px", borderRadius: 12, cursor: "pointer",
                background: "var(--c-surface-2)", border: "1px solid var(--c-border-2)",
                color: "var(--c-text-2)", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                width: isMobile ? "100%" : undefined,
              }}
            >
              <Edit3 size={15} /> Editar cliente
            </button>

            <button
              type="button"
              onClick={goToNewSchedule}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                height: 42, padding: "0 16px", borderRadius: 12, cursor: "pointer",
                background: "linear-gradient(135deg, #0066FF, #7C3AED)", border: "none",
                color: "white", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                width: isMobile ? "100%" : undefined,
              }}
            >
              <CalendarPlus size={15} /> Novo agendamento
            </button>

            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  height: 42, padding: "0 16px", borderRadius: 12,
                  background: "linear-gradient(135deg, #10B981, #059669)", color: "white",
                  fontSize: 13, fontWeight: 600, textDecoration: "none",
                  width: isMobile ? "100%" : undefined,
                }}
              >
                <Phone size={15} /> WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* ── STATS ─────────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
            gap: 10,
            marginBottom: 24,
          }}
        >
          <StatCard icon={<Calendar size={15} />} label="Agendamentos" value={String(stats.total)} color="#0066FF" />
          <StatCard icon={<CheckCircle2 size={15} />} label="Concluídos" value={String(stats.done)} color="#10B981" />
          <StatCard icon={<Wallet size={15} />} label="Receita (pago)" value={formatCurrency(stats.revenue)} color="#7C3AED" />
          <StatCard icon={<Car size={15} />} label="Veículos" value={String(customer.vehicles.length)} color="#F59E0B" />
        </div>

        {/* ── COLUNAS ───────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "320px 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* ── VEÍCULOS ────────────────────────────────────────────────────── */}
          <section>
            <SectionTitle
              icon={<Car size={15} />}
              title="Veículos"
              count={customer.vehicles.length}
              action={
                <button
                  type="button"
                  onClick={() => setModal({ mode: "add-vehicle" })}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5, height: 30,
                    padding: "0 12px", borderRadius: 9, cursor: "pointer",
                    background: "rgba(0,102,255,0.08)", border: "1px solid rgba(0,102,255,0.2)",
                    color: "#0066FF", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                  }}
                >
                  <Plus size={13} /> Veículo
                </button>
              }
            />
            {customer.vehicles.length === 0 ? (
              <EmptyBox icon={<Car size={26} />} text="Nenhum veículo cadastrado." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {customer.vehicles.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      backgroundColor: "var(--c-surface)",
                      border: "1px solid var(--c-border)",
                      borderRadius: 14,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                        backgroundColor: "var(--c-surface-2)", border: "1px solid var(--c-border)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <Car size={17} color="var(--c-text-3)" />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)", fontVariantNumeric: "tabular-nums" }}>
                          {v.plate || "Sem placa"}
                        </span>
                        <span
                          style={{
                            fontSize: 10, fontWeight: 600, color: "var(--c-text-3)",
                            backgroundColor: "var(--c-surface-2)", border: "1px solid var(--c-border)",
                            borderRadius: 6, padding: "1px 6px",
                          }}
                        >
                          {VEHICLE_TYPE_LABELS[v.type]}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "3px 0 0" }}>
                        {[v.brand, v.model].filter(Boolean).join(" ")}{v.color ? ` · ${v.color}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      title="Editar veículo"
                      onClick={() => setModal({ mode: "edit-vehicle", vehicle: v })}
                      style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "var(--c-surface-2)", border: "1px solid var(--c-border-2)",
                        color: "var(--c-text-3)", cursor: "pointer",
                      }}
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── HISTÓRICO DE AGENDAMENTOS ───────────────────────────────────── */}
          <section>
            <SectionTitle icon={<Calendar size={15} />} title="Histórico de agendamentos" count={customer.schedules.length} />
            {customer.schedules.length === 0 ? (
              <EmptyBox icon={<Calendar size={26} />} text="Nenhum agendamento registrado para este cliente." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {customer.schedules.map((s) => {
                  const st = getStatusConfig(s.status)
                  return (
                    <div
                      key={s.id}
                      style={{
                        backgroundColor: "var(--c-surface)",
                        border: "1px solid var(--c-border)",
                        borderRadius: 14,
                        padding: "14px 16px",
                      }}
                    >
                      {/* Linha 1: data + status */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <Calendar size={13} color="var(--c-text-4)" />
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", fontVariantNumeric: "tabular-nums" }}>
                            {formatScheduleDateTime(s.scheduledAt)}
                          </span>
                        </span>
                        <span
                          style={{
                            fontSize: 11, fontWeight: 700, color: st.color,
                            backgroundColor: st.bg, border: `1px solid ${st.border}`,
                            borderRadius: 99, padding: "3px 10px",
                          }}
                        >
                          {st.label}
                        </span>
                      </div>

                      {/* Linha 2: serviços */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                        {s.scheduleServices.length === 0 ? (
                          <span style={{ fontSize: 12, color: "var(--c-text-4)" }}>Sem serviços vinculados</span>
                        ) : (
                          s.scheduleServices.map((ss) => (
                            <span
                              key={ss.id}
                              style={{
                                fontSize: 11, fontWeight: 500, color: "var(--c-text-2)",
                                backgroundColor: "var(--c-surface-2)", border: "1px solid var(--c-border)",
                                borderRadius: 6, padding: "3px 8px",
                                display: "inline-flex", alignItems: "center", gap: 5,
                              }}
                            >
                              <FileText size={10} color="var(--c-text-4)" />
                              {ss.service.name}
                            </span>
                          ))
                        )}
                      </div>

                      {/* Linha 3: pagamento + valor */}
                      <div
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          gap: 10, flexWrap: "wrap", marginTop: 12,
                          paddingTop: 12, borderTop: "1px solid var(--c-border)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <CreditCard size={12} color="var(--c-text-4)" />
                            <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>
                              {PAYMENT_METHOD_LABELS[s.paymentMethod]}
                            </span>
                          </span>
                          <span
                            style={{
                              fontSize: 11, fontWeight: 600,
                              color: s.paymentStatus === "PAID" ? "#10B981" : "#FBBF24",
                              display: "inline-flex", alignItems: "center", gap: 4,
                            }}
                          >
                            {s.paymentStatus === "PAID" ? <CheckCircle2 size={12} /> : <Hash size={12} />}
                            {s.paymentStatus === "PAID" ? "Pago" : "A receber"}
                          </span>
                          {s.isSubscriber && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#F59E0B", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Crown size={11} /> Assinante
                            </span>
                          )}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {s.discountApplied > 0 && (
                            <span style={{ fontSize: 11, color: "var(--c-text-4)", marginRight: 8 }}>
                              −{formatCurrency(s.discountApplied)}
                            </span>
                          )}
                          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--c-text)", fontVariantNumeric: "tabular-nums" }}>
                            {formatCurrency(s.totalPrice)}
                          </span>
                        </div>
                      </div>

                      {/* Notas */}
                      {s.notes && (
                        <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "10px 0 0", lineHeight: 1.5 }}>
                          {s.notes}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── MODAL DE AÇÕES ──────────────────────────────────────────────────── */}
      {modal && (
        <CustomerActionsModal
          modal={modal}
          customer={customer}
          isMobile={isMobile}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchCustomer() }}
        />
      )}
    </>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div
      style={{
        backgroundColor: "var(--c-surface)",
        border: "1px solid var(--c-border)",
        borderRadius: 14,
        padding: "14px 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, color }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          {label}
        </span>
      </div>
      <p style={{ fontSize: 20, fontWeight: 800, color: "var(--c-text)", margin: "8px 0 0", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
        {value}
      </p>
    </div>
  )
}

function SectionTitle({ icon, title, count, action }: { icon: React.ReactNode; title: string; count: number; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <span style={{ color: "var(--c-text-3)", display: "flex" }}>{icon}</span>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)", margin: 0, letterSpacing: "-0.01em" }}>
        {title}
      </h2>
      <span
        style={{
          fontSize: 11, fontWeight: 600, color: "var(--c-text-3)",
          backgroundColor: "var(--c-surface-2)", border: "1px solid var(--c-border)",
          borderRadius: 99, padding: "1px 8px", fontVariantNumeric: "tabular-nums",
        }}
      >
        {count}
      </span>
      {action && <div style={{ marginLeft: "auto" }}>{action}</div>}
    </div>
  )
}

function EmptyBox({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div
      style={{
        padding: "32px 20px",
        border: "1px dashed var(--c-border)",
        borderRadius: 14,
        textAlign: "center",
        color: "var(--c-text-4)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>{icon}</div>
      <p style={{ fontSize: 13, color: "var(--c-text-2)", margin: 0 }}>{text}</p>
    </div>
  )
}

// ── Modal de ações ──────────────────────────────────────────────────────────────
// Reaproveita os MESMOS endpoints da lista de clientes:
//   editar cliente  → PUT  /customers/:id
//   novo veículo    → POST /customers/:id/vehicles
//   editar veículo  → PUT  /vehicles/:vehicleId
// Nenhum endpoint novo é criado aqui.

function ModalField({
  label, value, onChange, placeholder, required, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; type?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-2)", marginBottom: 6 }}>
        {label}{required && <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          height: 42, backgroundColor: "var(--c-bg)",
          border: `1px solid ${focused ? "#0066FF" : "var(--c-border-2)"}`,
          borderRadius: 10, padding: "0 14px",
          fontSize: 14, color: "var(--c-text)",
          outline: "none", width: "100%", boxSizing: "border-box",
          transition: "border-color 0.15s ease", fontFamily: "inherit",
        }}
      />
    </div>
  )
}

function CustomerActionsModal({
  modal, customer, isMobile, onClose, onSaved,
}: {
  modal: ModalState
  customer: CustomerDetail
  isMobile: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const isVehicle = modal.mode !== "edit-customer"
  const editingVehicle = modal.mode === "edit-vehicle" ? modal.vehicle : null

  // Form — cliente
  const [name,  setName]  = useState(modal.mode === "edit-customer" ? customer.name : "")
  const [phone, setPhone] = useState(modal.mode === "edit-customer" ? (customer.phone ?? "") : "")
  const [email, setEmail] = useState(modal.mode === "edit-customer" ? (customer.email ?? "") : "")

  // Form — veículo
  const [plate, setPlate] = useState(editingVehicle?.plate ?? "")
  const [brand, setBrand] = useState(editingVehicle?.brand ?? "")
  const [model, setModel] = useState(editingVehicle?.model ?? "")
  const [color, setColor] = useState(editingVehicle?.color ?? "")
  const [type,  setType]  = useState<VehicleType>(editingVehicle?.type ?? "CAR")

  const [submitting, setSubmitting] = useState(false)
  const [formError,  setFormError]  = useState<string | null>(null)

  const title =
    modal.mode === "edit-customer" ? "Editar cliente"
    : modal.mode === "add-vehicle" ? "Adicionar veículo"
    : "Editar veículo"

  async function handleSubmit() {
    setFormError(null)

    if (modal.mode === "edit-customer") {
      if (!name.trim()) { setFormError("Nome é obrigatório."); toast.error("Preencha o nome do cliente"); return }
      setSubmitting(true)
      try {
        await apiPut(`/customers/${customer.id}`, {
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        })
        toast.success("Cliente atualizado")
        onSaved()
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao atualizar cliente."
        setFormError(msg); toast.error(msg)
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Veículo (novo ou edição)
    const missing =
      !plate.trim() ? "a placa" :
      !brand.trim() ? "a marca" :
      !model.trim() ? "o modelo" :
      !color.trim() ? "a cor" : null
    if (missing) {
      setFormError("Preencha todos os campos do veículo.")
      toast.error(`Preencha ${missing} do veículo`)
      return
    }
    setSubmitting(true)
    const payload = {
      plate: plate.trim().toUpperCase(),
      brand: brand.trim(),
      model: model.trim(),
      color: color.trim(),
      type,
    }
    try {
      if (modal.mode === "edit-vehicle") {
        await apiPut(`/vehicles/${modal.vehicle.id}`, payload)
        toast.success("Veículo atualizado")
      } else {
        await apiPost(`/customers/${customer.id}/vehicles`, payload)
        toast.success("Veículo adicionado")
      }
      onSaved()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar veículo."
      setFormError(msg); toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 100,
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)",
          borderRadius: isMobile ? 16 : 20, padding: isMobile ? 20 : 28,
          width: isMobile ? "calc(100% - 32px)" : "100%", maxWidth: 440,
          maxHeight: "90vh", overflowY: "auto", zIndex: 101,
          boxShadow: "0 32px 64px rgba(0,0,0,0.7)", boxSizing: "border-box",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>{title}</h2>
            {isVehicle && (
              <p style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 4 }}>
                para {customer.name}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "var(--c-surface-2)", border: "1px solid var(--c-border-2)",
              borderRadius: 8, width: 32, height: 32, display: "flex",
              alignItems: "center", justifyContent: "center", cursor: "pointer",
              color: "var(--c-text-3)", flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Erro */}
        {formError && (
          <div
            style={{
              backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 10, padding: "10px 14px", marginBottom: 16,
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <AlertCircle size={14} color="#EF4444" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#EF4444" }}>{formError}</span>
          </div>
        )}

        {/* Campos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {modal.mode === "edit-customer" ? (
            <>
              <ModalField label="Nome completo" value={name} onChange={setName} placeholder="João da Silva" required />
              <ModalField label="Telefone" value={phone} onChange={setPhone} placeholder="(47) 99999-0000" />
              <ModalField label="E-mail" value={email} onChange={setEmail} placeholder="cliente@email.com (opcional)" />
            </>
          ) : (
            <>
              <ModalField label="Placa" value={plate} onChange={(v) => setPlate(v.toUpperCase())} placeholder="ABC-1234" required />
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <ModalField label="Marca" value={brand} onChange={setBrand} placeholder="Honda" required />
                <ModalField label="Modelo" value={model} onChange={setModel} placeholder="Civic" required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <ModalField label="Cor" value={color} onChange={setColor} placeholder="Prata" required />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-2)", marginBottom: 6 }}>Tipo</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as VehicleType)}
                    style={{
                      height: 42, backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border-2)",
                      borderRadius: 10, padding: "0 14px", fontSize: 14, color: "var(--c-text)",
                      outline: "none", cursor: "pointer", fontFamily: "inherit",
                      appearance: "none", WebkitAppearance: "none",
                      backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                      backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
                    }}
                  >
                    <option value="CAR">Carro</option>
                    <option value="MOTORCYCLE">Moto</option>
                    <option value="TRUCK">Caminhão</option>
                    <option value="SUV">SUV</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 40, padding: "0 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: "pointer", background: "transparent", border: "1px solid var(--c-border-2)",
              color: "var(--c-text-2)", fontFamily: "inherit",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              height: 40, padding: "0 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
              background: isVehicle ? "linear-gradient(135deg, #10B981, #059669)" : "linear-gradient(135deg, #0066FF, #7C3AED)",
              border: "none", color: "white", display: "flex", alignItems: "center", gap: 8,
              opacity: submitting ? 0.7 : 1, transition: "opacity 0.15s ease", fontFamily: "inherit",
            }}
          >
            {submitting && (
              <span
                style={{
                  width: 14, height: 14, borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white",
                  animation: "cdSpin 0.7s linear infinite", display: "inline-block", flexShrink: 0,
                }}
              />
            )}
            {submitting
              ? "Salvando..."
              : modal.mode === "add-vehicle" ? "Adicionar veículo" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </>
  )
}
