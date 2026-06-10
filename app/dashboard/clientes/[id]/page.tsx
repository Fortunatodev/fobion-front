"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Phone, Mail, Car, Calendar, AlertCircle,
  Crown, CheckCircle2, CreditCard, FileText, Hash, Wallet,
} from "lucide-react"
import { apiGet } from "@/lib/api"
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

// ── Helpers ─────────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR")
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
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

          {/* WhatsApp */}
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                height: 42, padding: "0 18px", borderRadius: 12, flexShrink: 0,
                background: "linear-gradient(135deg, #10B981, #059669)", color: "white",
                fontSize: 13, fontWeight: 600, textDecoration: "none",
                width: isMobile ? "100%" : undefined,
              }}
            >
              <Phone size={15} /> Falar no WhatsApp
            </a>
          )}
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
            <SectionTitle icon={<Car size={15} />} title="Veículos" count={customer.vehicles.length} />
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
                            {formatDateTime(s.scheduledAt)}
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

function SectionTitle({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
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
