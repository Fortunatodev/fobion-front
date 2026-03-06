"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle, BarChart3, Calendar,
  CircleDollarSign, Crown, Sparkles,
  Users, ArrowUpRight, Clock,
  TrendingUp, Star, UserPlus,
} from "lucide-react"
import { useUser } from "@/contexts/UserContext"
import { apiGet } from "@/lib/api"
import { formatScheduleTime } from "@/lib/dateUtils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Schedule {
  id: string
  scheduledAt: string
  status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "DONE" | "CANCELLED"
  totalPrice: number
  paymentStatus: "PENDING" | "PAID"
  customer: { name: string }
  vehicle: { plate: string }
  scheduleServices: Array<{ service: { name: string } }>
}
interface SchedulesResponse { schedules: Schedule[] }
interface CustomersResponse { customers: unknown[] }
interface SubsResponse      { subscriptions: unknown[] }

interface DashboardSummary {
  revenue:           number
  appointments:      number
  newCustomers:      number
  activeSubscribers: number
  topService:        { name: string; count: number } | null
  revenueGrowth:     number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
function formatTime(iso: string): string {
  return formatScheduleTime(iso)
}
function formatTodayDate(): string {
  return new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
}
function getStatusConfig(status: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    CONFIRMED:   { label: "Confirmado",   color: "#3B82F6", bg: "rgba(59,130,246,0.1)"  },
    IN_PROGRESS: { label: "Em andamento", color: "#8B5CF6", bg: "rgba(139,92,246,0.1)"  },
    PENDING:     { label: "Pendente",     color: "#F59E0B", bg: "rgba(245,158,11,0.1)"  },
    DONE:        { label: "Concluído",    color: "#10B981", bg: "rgba(16,185,129,0.1)"  },
    CANCELLED:   { label: "Cancelado",    color: "#EF4444", bg: "rgba(239,68,68,0.1)"   },
  }
  return map[status] ?? { label: status, color: "#A1A1AA", bg: "rgba(161,161,170,0.1)" }
}

// ── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({
  title, value, subtitle, icon,
  iconColor, iconBg, accentColor, loading,
}: {
  title: string; value: string; subtitle: string
  icon: React.ReactNode; iconColor: string; iconBg: string
  accentColor: string; loading: boolean
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: "#111111",
        border:    `1px solid ${hov ? accentColor + "50" : "#1F1F1F"}`,
        borderRadius: 16,
        padding: 20,
        position: "relative",
        overflow: "hidden",
        transition: "all 0.2s ease",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hov ? "0 8px 24px rgba(0,0,0,0.4)" : "none",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "#71717A", margin: 0 }}>
            {title}
          </p>
          <div style={{ marginTop: 8, minHeight: 36, display: "flex", alignItems: "center" }}>
            {loading ? (
              <div className="animate-skeleton-pulse" style={{
                height: 32, width: "60%",
                backgroundColor: "#1F1F1F", borderRadius: 8,
              }} />
            ) : (
              <span style={{ fontSize: 24, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" }}>
                {value}
              </span>
            )}
          </div>
        </div>
        <div style={{
          width: 40, height: 40,
          backgroundColor: iconBg,
          borderRadius: 12,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          border: `1px solid ${iconColor}25`,
        }}>
          <span style={{ color: iconColor, display: "flex" }}>{icon}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 12 }}>
        <ArrowUpRight size={11} color="#3F3F46" />
        <span style={{ fontSize: 11, color: "#3F3F46" }}>{subtitle}</span>
      </div>
      {/* Glow */}
      <div style={{
        position: "absolute", bottom: -20, right: -20,
        width: 80, height: 80, borderRadius: "50%",
        background: `${accentColor}08`, filter: "blur(20px)",
        pointerEvents: "none",
      }} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router   = useRouter()
  const { user, planStatus } = useUser()

  const isPro = planStatus?.plan === "PRO"

  const [schedulesToday,    setSchedulesToday]    = useState<Schedule[]>([])
  const [totalCustomers,    setTotalCustomers]    = useState(0)
  const [activeSubscribers, setActiveSubscribers] = useState(0)
  const [summary,           setSummary]           = useState<DashboardSummary | null>(null)
  const [summaryLoading,    setSummaryLoading]    = useState(false)
  const [loading,           setLoading]           = useState(true)
  const [error,             setError]             = useState<string | null>(null)
  const [ctaHov,            setCtaHov]            = useState(false)
  const [hovRow,            setHovRow]            = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const today = new Date().toISOString().split("T")[0]

        // Base calls available on any plan
        const [sRes, cRes] = await Promise.all([
          apiGet<SchedulesResponse>(`/schedules?date=${today}`),
          apiGet<CustomersResponse>("/customers"),
        ])
        setSchedulesToday(sRes.schedules ?? [])
        setTotalCustomers((cRes.customers ?? []).length)

        // Subscriptions is PRO-only — skip on BASIC to avoid 403
        if (isPro) {
          try {
            const subRes = await apiGet<SubsResponse>("/customer-plans/subscriptions?status=ACTIVE")
            setActiveSubscribers((subRes.subscriptions ?? []).length)
          } catch {
            setActiveSubscribers(0)
          }
        }
      } catch {
        setError("Erro ao carregar dados. Verifique sua conexão com o servidor.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isPro])

  // ── Fetch dashboard summary (PRO only) ─────────────────────────────────────
  useEffect(() => {
    if (!isPro) return
    setSummaryLoading(true)
    apiGet<DashboardSummary>("/analytics/dashboard-summary")
      .then((data) => setSummary(data))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false))
  }, [isPro])

  const paidRevenue = schedulesToday
    .filter((s) => s.paymentStatus === "PAID")
    .reduce((acc, s) => acc + s.totalPrice, 0)

  const nextSchedules = schedulesToday
    .filter((s) => s.status !== "DONE" && s.status !== "CANCELLED")
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
    .slice(0, 5)

  const todaySchedules = [...schedulesToday]
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))

  const firstName = user?.name?.split(" ")[0] ?? "você"

  return (
    <div className="animate-dash-fade-in">

      {/* ── Error banner ──────────────────────────────────────────────── */}
      {error && (
        <div style={{
          backgroundColor: "rgba(239,68,68,0.07)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 12, padding: "11px 16px",
          marginBottom: 24,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <AlertCircle size={15} color="#EF4444" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#EF4444", flex: 1 }}>{error}</span>
          <button
            onClick={() => window.location.reload()}
            style={{
              fontSize: 12, color: "#EF4444",
              background: "none", border: "none",
              cursor: "pointer", textDecoration: "underline", padding: 0,
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Page header ───────────────────────────────────────────────── */}
      {/* .page-header = flex wrap justify-between com gap */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.3px" }}>
            Olá, {firstName} 👋
          </h1>
          <p style={{ fontSize: 13, color: "#52525B", marginTop: 4, textTransform: "capitalize" }}>
            {formatTodayDate()}
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard/agendamentos")}
          onMouseEnter={() => setCtaHov(true)}
          onMouseLeave={() => setCtaHov(false)}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "linear-gradient(135deg, #0066FF, #7C3AED)",
            border: "none", borderRadius: 10, padding: "9px 18px",
            color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer",
            boxShadow: ctaHov ? "0 8px 28px rgba(0,102,255,0.5)" : "0 4px 16px rgba(0,102,255,0.3)",
            transform: ctaHov ? "scale(1.02)" : "scale(1)",
            transition: "all 0.2s ease", whiteSpace: "nowrap",
          }}
        >
          <Sparkles size={14} />
          Nova comanda
        </button>
      </div>

      {/* ── Metric cards (.metrics-grid) ──────────────────────────────── */}
      {/* 1 col → 2 col (640px) → 4 col (1280px) — via CSS puro no globals.css */}
      <div className="metrics-grid">
        <MetricCard
          title="Agendamentos hoje" value={schedulesToday.length.toString()}
          subtitle="agendamentos neste dia"
          icon={<Calendar size={16} />}
          iconColor="#0066FF" iconBg="rgba(0,102,255,0.1)"
          accentColor="#0066FF" loading={loading}
        />
        <MetricCard
          title="Receita paga hoje" value={formatCurrency(paidRevenue)}
          subtitle="serviços confirmados como pagos"
          icon={<CircleDollarSign size={16} />}
          iconColor="#10B981" iconBg="rgba(16,185,129,0.1)"
          accentColor="#10B981" loading={loading}
        />
        <MetricCard
          title="Total de clientes" value={totalCustomers.toString()}
          subtitle="clientes cadastrados"
          icon={<Users size={16} />}
          iconColor="#F59E0B" iconBg="rgba(245,158,11,0.1)"
          accentColor="#F59E0B" loading={loading}
        />
        <MetricCard
          title="Assinantes ativos" value={isPro ? activeSubscribers.toString() : "—"}
          subtitle={isPro ? "planos ativos agora" : "disponível no plano PRO"}
          icon={<Crown size={16} />}
          iconColor="#7C3AED" iconBg="rgba(124,58,237,0.1)"
          accentColor="#7C3AED" loading={loading}
        />
      </div>

      {/* ── Middle row (.middle-grid) ─────────────────────────────────── */}
      {/* 1 col → 2 col (1024px) */}
      <div className="middle-grid">

        {/* Próximos agendamentos */}
        <div style={{
          backgroundColor: "#111111",
          border: "1px solid #1F1F1F",
          borderRadius: 16, padding: 20,
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", marginBottom: 16,
          }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>
                Próximos agendamentos
              </h2>
              <p style={{ fontSize: 11, color: "#52525B", marginTop: 3 }}>
                Pendentes e em andamento hoje
              </p>
            </div>
            <button
              onClick={() => router.push("/dashboard/agendamentos")}
              style={{ fontSize: 12, color: "#0066FF", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Ver todos →
            </button>
          </div>

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-skeleton-pulse" style={{
                  height: 60, backgroundColor: "#1A1A1A", borderRadius: 10,
                  animationDelay: `${i * 0.12}s`,
                }} />
              ))}
            </div>
          )}

          {!loading && nextSchedules.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <Calendar size={28} color="#2A2A2A" style={{ margin: "0 auto 10px" }} />
              <p style={{ fontSize: 13, color: "#52525B" }}>
                Nenhum agendamento pendente para hoje
              </p>
            </div>
          )}

          {!loading && nextSchedules.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {nextSchedules.map((s, i) => {
                const st          = getStatusConfig(s.status)
                const serviceName = s.scheduleServices?.[0]?.service?.name ?? "Serviço"
                const isHov       = hovRow === s.id
                return (
                  <div
                    key={s.id}
                    onMouseEnter={() => setHovRow(s.id)}
                    onMouseLeave={() => setHovRow(null)}
                    onClick={() => router.push("/dashboard/agendamentos")}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 8px", borderRadius: 10,
                      backgroundColor: isHov ? "#161616" : "transparent",
                      borderBottom: i < nextSchedules.length - 1 ? "1px solid #1A1A1A" : "none",
                      cursor: "pointer", transition: "background-color 0.12s",
                    }}
                  >
                    <div style={{ width: 3, height: 36, borderRadius: 2, backgroundColor: st.color, flexShrink: 0 }} />
                    <div style={{ flexShrink: 0, minWidth: 48 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0 }}>
                        {formatTime(s.scheduledAt)}
                      </p>
                      <p style={{ fontSize: 10, color: "#52525B", margin: "1px 0 0" }}>hoje</p>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.customer.name}
                      </p>
                      <p style={{ fontSize: 11, color: "#52525B", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {serviceName} · {s.vehicle.plate}
                      </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        color: st.color, backgroundColor: st.bg,
                        border: `1px solid ${st.color}33`,
                        borderRadius: 6, padding: "2px 7px",
                      }}>
                        {st.label}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
                        {formatCurrency(s.totalPrice)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Resumo de Relatórios (PRO) / CTA Upgrade (BASIC) */}
        <div style={{
          backgroundColor: "#111111",
          border: "1px solid #1F1F1F",
          borderRadius: 16, padding: 20,
          minHeight: 220,
        }}>
          {isPro ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>
                    📊 Resumo do mês
                  </h2>
                  <p style={{ fontSize: 11, color: "#52525B", marginTop: 3 }}>
                    Últimos 30 dias
                  </p>
                </div>
                <button
                  onClick={() => router.push("/dashboard/relatorios")}
                  style={{ fontSize: 12, color: "#0066FF", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Ver completo →
                </button>
              </div>

              {summaryLoading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="animate-skeleton-pulse" style={{
                      height: 40, backgroundColor: "#1A1A1A", borderRadius: 8,
                      animationDelay: `${i * 0.1}s`,
                    }} />
                  ))}
                </div>
              )}

              {!summaryLoading && summary && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Mini metric rows */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{
                      backgroundColor: "#161616", border: "1px solid #1F1F1F",
                      borderRadius: 10, padding: "10px 12px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <CircleDollarSign size={12} color="#10B981" />
                        <span style={{ fontSize: 10, fontWeight: 500, color: "#71717A" }}>Faturamento</span>
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>
                        {formatCurrency(summary.revenue)}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 4 }}>
                        <TrendingUp size={10} color={summary.revenueGrowth >= 0 ? "#10B981" : "#EF4444"} />
                        <span style={{ fontSize: 10, color: summary.revenueGrowth >= 0 ? "#10B981" : "#EF4444" }}>
                          {summary.revenueGrowth >= 0 ? "+" : ""}{summary.revenueGrowth}%
                        </span>
                      </div>
                    </div>

                    <div style={{
                      backgroundColor: "#161616", border: "1px solid #1F1F1F",
                      borderRadius: 10, padding: "10px 12px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <Calendar size={12} color="#3B82F6" />
                        <span style={{ fontSize: 10, fontWeight: 500, color: "#71717A" }}>Concluídos</span>
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>
                        {summary.appointments}
                      </p>
                      <span style={{ fontSize: 10, color: "#52525B", marginTop: 4, display: "block" }}>agendamentos</span>
                    </div>

                    <div style={{
                      backgroundColor: "#161616", border: "1px solid #1F1F1F",
                      borderRadius: 10, padding: "10px 12px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <UserPlus size={12} color="#F59E0B" />
                        <span style={{ fontSize: 10, fontWeight: 500, color: "#71717A" }}>Novos clientes</span>
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>
                        {summary.newCustomers}
                      </p>
                      <span style={{ fontSize: 10, color: "#52525B", marginTop: 4, display: "block" }}>no período</span>
                    </div>

                    <div style={{
                      backgroundColor: "#161616", border: "1px solid #1F1F1F",
                      borderRadius: 10, padding: "10px 12px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <Star size={12} color="#7C3AED" />
                        <span style={{ fontSize: 10, fontWeight: 500, color: "#71717A" }}>Assinantes</span>
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>
                        {summary.activeSubscribers}
                      </p>
                      <span style={{ fontSize: 10, color: "#52525B", marginTop: 4, display: "block" }}>ativos</span>
                    </div>
                  </div>

                  {/* Top service */}
                  {summary.topService && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      backgroundColor: "#161616", border: "1px solid #1F1F1F",
                      borderRadius: 10, padding: "8px 12px",
                    }}>
                      <span style={{ fontSize: 12 }}>🏆</span>
                      <span style={{ fontSize: 11, color: "#A1A1AA", flex: 1 }}>
                        Serviço mais popular: <strong style={{ color: "#fff" }}>{summary.topService.name}</strong>
                        <span style={{ color: "#52525B" }}> ({summary.topService.count}x)</span>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {!summaryLoading && !summary && (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <BarChart3 size={28} color="#2A2A2A" style={{ margin: "0 auto 8px" }} />
                  <p style={{ fontSize: 12, color: "#52525B" }}>Sem dados para o período.</p>
                </div>
              )}
            </>
          ) : (
            /* BASIC plan — upgrade CTA */
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              textAlign: "center", height: "100%", minHeight: 180,
              gap: 10,
            }}>
              <div style={{
                width: 44, height: 44,
                backgroundColor: "rgba(124,58,237,0.1)",
                borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid rgba(124,58,237,0.2)",
              }}>
                <BarChart3 size={20} color="#7C3AED" />
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>
                📊 Relatórios disponíveis no PRO
              </h3>
              <p style={{ fontSize: 12, color: "#52525B", margin: 0, maxWidth: 240 }}>
                Veja faturamento, agendamentos e métricas do seu negócio em tempo real.
              </p>
              <button
                onClick={() => router.push("/dashboard/planos")}
                style={{
                  marginTop: 4,
                  padding: "8px 18px",
                  background: "linear-gradient(135deg, #7C3AED, #0066FF)",
                  border: "none", borderRadius: 10,
                  color: "white", fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <Crown size={13} />
                Fazer upgrade
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Agenda de hoje ────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: "#111111",
        border: "1px solid #1F1F1F",
        borderRadius: 16, padding: 20,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 16,
        }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>
              Agenda de hoje
            </h2>
            <p style={{ fontSize: 11, color: "#52525B", marginTop: 3 }}>
              Todos os agendamentos do dia
            </p>
          </div>
          {!loading && (
            <span style={{
              fontSize: 11, fontWeight: 500, color: "#0066FF",
              backgroundColor: "rgba(0,102,255,0.08)",
              border: "1px solid rgba(0,102,255,0.15)",
              borderRadius: 99, padding: "3px 10px",
            }}>
              {todaySchedules.length} agendamento{todaySchedules.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-skeleton-pulse" style={{
                height: 52, backgroundColor: "#1A1A1A", borderRadius: 8,
                animationDelay: `${i * 0.1}s`,
              }} />
            ))}
          </div>
        )}

        {!loading && todaySchedules.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Calendar size={36} color="#1F1F1F" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontSize: 13, color: "#52525B", marginBottom: 16 }}>
              Sem agendamentos hoje
            </p>
            <button
              onClick={() => router.push("/dashboard/agendamentos")}
              style={{
                padding: "8px 18px",
                background: "linear-gradient(135deg, #0066FF, #7C3AED)",
                border: "none", borderRadius: 10,
                color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              Criar agendamento
            </button>
          </div>
        )}

        {!loading && todaySchedules.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="table-desktop">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Horário", "Cliente", "Placa", "Serviço", "Valor", "Status"].map((h) => (
                      <th key={h} style={{
                        textAlign: "left", padding: "6px 12px 10px",
                        fontSize: 10, fontWeight: 600, color: "#3F3F46",
                        textTransform: "uppercase", letterSpacing: "0.6px",
                        borderBottom: "1px solid #1A1A1A", whiteSpace: "nowrap",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todaySchedules.map((s, idx) => {
                    const st          = getStatusConfig(s.status)
                    const serviceName = s.scheduleServices?.[0]?.service?.name ?? "—"
                    return (
                      <tr
                        key={s.id}
                        onClick={() => router.push("/dashboard/agendamentos")}
                        style={{
                          cursor: "pointer", transition: "background-color 0.1s",
                          backgroundColor: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#161616" }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}
                      >
                        <td style={{ padding: "11px 12px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#A1A1AA" }}>
                            <Clock size={11} />
                            {formatTime(s.scheduledAt)}
                          </div>
                        </td>
                        <td style={{ padding: "11px 12px", fontSize: 13, fontWeight: 500, color: "#fff" }}>
                          {s.customer.name}
                        </td>
                        <td style={{ padding: "11px 12px", fontSize: 12, color: "#71717A", fontFamily: "monospace" }}>
                          {s.vehicle.plate}
                        </td>
                        <td style={{ padding: "11px 12px", fontSize: 12, color: "#A1A1AA" }}>
                          {serviceName}
                        </td>
                        <td style={{ padding: "11px 12px", fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap" }}>
                          {formatCurrency(s.totalPrice)}
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          <span style={{
                            fontSize: 11, fontWeight: 500,
                            color: st.color, backgroundColor: st.bg,
                            border: `1px solid ${st.color}33`,
                            borderRadius: 99, padding: "3px 8px",
                            whiteSpace: "nowrap",
                          }}>
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="table-mobile-cards">
              {todaySchedules.map((s) => {
                const st          = getStatusConfig(s.status)
                const serviceName = s.scheduleServices?.[0]?.service?.name ?? "—"
                return (
                  <div
                    key={s.id}
                    onClick={() => router.push("/dashboard/agendamentos")}
                    style={{
                      backgroundColor: "#161616",
                      border: "1px solid #1F1F1F",
                      borderRadius: 12, padding: 16, cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#fff" }}>
                        <Clock size={12} color="#52525B" />
                        {formatTime(s.scheduledAt)}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        color: st.color, backgroundColor: st.bg,
                        border: `1px solid ${st.color}33`,
                        borderRadius: 6, padding: "2px 8px",
                      }}>
                        {st.label}
                      </span>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: "0 0 4px" }}>
                      {s.customer.name}
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ fontSize: 12, color: "#71717A", margin: 0 }}>
                        {serviceName} · <span style={{ fontFamily: "monospace" }}>{s.vehicle.plate}</span>
                      </p>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                        {formatCurrency(s.totalPrice)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}