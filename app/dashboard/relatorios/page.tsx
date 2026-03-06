"use client"

import { useState, useEffect, useCallback } from "react"
import {
  BarChart2, TrendingUp, TrendingDown, Users, Calendar,
  DollarSign, CheckCircle, XCircle, AlertCircle, Crown,
  Zap, Target, Star, ArrowUpRight, ArrowDownRight,
  Activity, Repeat, ShieldCheck, Lightbulb,
} from "lucide-react"
import { apiGet } from "@/lib/api"
import { useUser } from "@/contexts/UserContext"
import ProFeatureGate from "@/components/shared/ProFeatureGate"

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = "7d" | "30d" | "90d" | "12m"

interface FaturamentoDia  { date: string; total: number }
interface AgendamentoDia  { day: number; label: string; count: number }
interface AgendamentoData { date: string; count: number }
interface StatusCount     { status: string; count: number }
interface ServicoPopular  { id: string; name: string; count: number; total: number }

interface Insights {
  busiestDay:       string
  revenueGrowth:    number
  completionTrend:  number
  subscriberRatio:  number
  avgDailyBookings: number
  cancellationRate: number
  topServiceShare:  number
}

interface RelatoryData {
  period:                   string
  faturamentoTotal:         number
  ticketMedio:              number
  totalAgendamentos:        number
  agendamentosConcluidos:   number
  agendamentosCancelados:   number
  taxaConclusao:            number
  novosClientes:            number
  faturamentoPorDia:        FaturamentoDia[]
  agendamentosPorData:      AgendamentoData[]
  servicosMaisPopulares:    ServicoPopular[]
  agendamentosPorDia:       AgendamentoDia[]
  statusCounts:             StatusCount[]
  totalCustomers:           number
  totalActiveSubscribers:   number
  insights:                 Insights
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function fmtShort(iso: string): string {
  const [, m, d] = iso.split("-")
  return `${d}/${m}`
}

function periodLabel(p: Period): string {
  return { "7d": "Últimos 7 dias", "30d": "Últimos 30 dias", "90d": "Últimos 90 dias", "12m": "Últimos 12 meses" }[p]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:     { label: "Pendente",     color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
  CONFIRMED:   { label: "Confirmado",   color: "#0066FF", bg: "rgba(0,102,255,0.1)"  },
  IN_PROGRESS: { label: "Em andamento", color: "#7C3AED", bg: "rgba(124,58,237,0.1)" },
  DONE:        { label: "Concluído",    color: "#10B981", bg: "rgba(16,185,129,0.1)" },
  CANCELLED:   { label: "Cancelado",    color: "#EF4444", bg: "rgba(239,68,68,0.1)"  },
}

const WEEK_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d",  label: "7 dias"   },
  { value: "30d", label: "30 dias"  },
  { value: "90d", label: "90 dias"  },
  { value: "12m", label: "12 meses" },
]

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBlock({ h = 120 }: { h?: number }) {
  return (
    <div style={{
      backgroundColor: "#111111", border: "1px solid #1F1F1F",
      borderRadius: 16, height: h,
      animation: "skR 1.4s ease infinite",
    }} />
  )
}

// ── Summary Card ──────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, icon, color, trend,
}: {
  label: string; value: string | number; sub?: string
  icon: React.ReactNode; color: string; trend?: number | null
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: hov ? "#141414" : "#111111",
        border: `1px solid ${hov ? "#252525" : "#1F1F1F"}`,
        borderRadius: 16, padding: "20px 18px",
        transition: "all 0.2s ease", cursor: "default",
        display: "flex", flexDirection: "column", gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          backgroundColor: `${color}15`,
          border: `1px solid ${color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color,
        }}>
          {icon}
        </div>
        {trend != null && trend !== 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 3,
            fontSize: 11, fontWeight: 600,
            color: trend > 0 ? "#10B981" : "#EF4444",
            backgroundColor: trend > 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
            borderRadius: 6, padding: "2px 6px",
          }}>
            {trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 500, color: "#71717A", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {label}
        </p>
        <p style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "4px 0 0", letterSpacing: "-0.5px" }}>
          {value}
        </p>
        {sub && (
          <p style={{ fontSize: 11, color: "#52525B", margin: "4px 0 0" }}>{sub}</p>
        )}
      </div>
    </div>
  )
}

// ── Mini Chart (bar chart with tooltips) ──────────────────────────────────────

function MiniBarChart({
  data, valueKey, color, formatValue, title, isMobile, height = 180,
}: {
  data: { date: string; [k: string]: number | string }[]
  valueKey: string; color: string
  formatValue: (v: number) => string; title: string
  isMobile: boolean; height?: number
}) {
  const [tooltip, setTooltip] = useState<{ x: number; label: string; value: string } | null>(null)
  const maxVal = Math.max(...data.map(d => d[valueKey] as number), 1)

  const step = data.length > 60 ? Math.ceil(data.length / 45) : 1
  const sampled = data.filter((_, i) => i % step === 0)

  return (
    <div style={{
      backgroundColor: "#111111", border: "1px solid #1F1F1F",
      borderRadius: 16, padding: isMobile ? "18px 14px" : 24,
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>
        {title}
      </h3>

      <div style={{ position: "relative" }}>
        {tooltip && (
          <div style={{
            position: "absolute", bottom: height + 4,
            left: Math.min(Math.max(tooltip.x - 50, 0), 200),
            backgroundColor: "#1A1A1A", border: "1px solid #2A2A2A",
            borderRadius: 8, padding: "6px 10px",
            zIndex: 10, pointerEvents: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}>
            <p style={{ fontSize: 11, color: "#71717A", margin: 0 }}>{tooltip.label}</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: "2px 0 0" }}>{tooltip.value}</p>
          </div>
        )}

        <div
          style={{
            display: "flex", alignItems: "flex-end",
            gap: sampled.length > 30 ? 1 : 2,
            height,
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          {sampled.map((d, i) => {
            const val = d[valueKey] as number
            const pct = (val / maxVal) * 100
            return (
              <div
                key={i}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const parent = e.currentTarget.parentElement?.getBoundingClientRect()
                  setTooltip({
                    x: rect.left - (parent?.left ?? 0),
                    label: fmtShort(d.date as string),
                    value: formatValue(val),
                  })
                }}
                style={{
                  flex: 1, minWidth: 2,
                  height: `${Math.max(pct, 2)}%`,
                  backgroundColor: val > 0 ? color : "#1A1A1A",
                  borderRadius: 3,
                  transition: "height 0.4s ease",
                  cursor: "crosshair",
                  opacity: tooltip && tooltip.x !== 0 ? 0.6 : 1,
                }}
              />
            )
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: 10, color: "#52525B" }}>{sampled.length > 0 ? fmtShort(sampled[0].date as string) : ""}</span>
          <span style={{ fontSize: 10, color: "#52525B" }}>{sampled.length > 0 ? fmtShort(sampled[sampled.length - 1].date as string) : ""}</span>
        </div>
      </div>
    </div>
  )
}

// ── Insight Card ──────────────────────────────────────────────────────────────

function InsightCard({
  icon, title, description, accent,
}: {
  icon: React.ReactNode; title: string; description: string; accent: string
}) {
  return (
    <div style={{
      display: "flex", gap: 12, alignItems: "flex-start",
      backgroundColor: "#111111", border: "1px solid #1F1F1F",
      borderRadius: 14, padding: "16px 14px",
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        backgroundColor: `${accent}12`,
        border: `1px solid ${accent}25`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: accent,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0 }}>{title}</p>
        <p style={{ fontSize: 12, color: "#71717A", margin: "4px 0 0", lineHeight: 1.5 }}>{description}</p>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Page ─────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export default function RelatoriosPage() {
  const { planStatus } = useUser()
  const isPro = planStatus?.plan === "PRO"

  if (!isPro) {
    return (
      <ProFeatureGate
        featureName="Painel de Saúde da Loja"
        description="Relatórios detalhados, gráficos de faturamento e agendamentos, ranking de serviços, diagnóstico inteligente do seu negócio e muito mais."
      />
    )
  }

  return <PainelDeSaude />
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Painel de Saúde ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function PainelDeSaude() {
  const [data, setData]       = useState<RelatoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState("")
  const [period, setPeriod]   = useState<Period>("30d")
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true)
    setError("")
    try {
      const res = await apiGet<RelatoryData>(`/analytics/relatorios?period=${p}`)
      setData(res)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(period) }, [period, fetchData])

  const maxSvcCnt = data ? Math.max(...data.servicosMaisPopulares.map(s => s.count), 1) : 1
  const maxAgDia  = data ? Math.max(...data.agendamentosPorDia.map(d => d.count), 1) : 1

  // ── Build diagnostic insights ──────────────────────────────────────────
  function buildInsights(d: RelatoryData) {
    const ins = d.insights
    const tips: { icon: React.ReactNode; title: string; description: string; accent: string }[] = []

    // Revenue growth
    if (ins.revenueGrowth > 0) {
      tips.push({
        icon: <TrendingUp size={16} />,
        title: `Faturamento cresceu ${ins.revenueGrowth}%`,
        description: `Comparado ao período anterior, seu faturamento subiu ${ins.revenueGrowth}%. Continue investindo no que está funcionando!`,
        accent: "#10B981",
      })
    } else if (ins.revenueGrowth < 0) {
      tips.push({
        icon: <TrendingDown size={16} />,
        title: `Faturamento caiu ${Math.abs(ins.revenueGrowth)}%`,
        description: `Seu faturamento diminuiu em relação ao período anterior. Considere promoções ou divulgação para recuperar.`,
        accent: "#EF4444",
      })
    }

    // Busiest day
    tips.push({
      icon: <Calendar size={16} />,
      title: `Dia mais movimentado: ${ins.busiestDay}`,
      description: `A maioria dos seus agendamentos acontece na ${ins.busiestDay}. Considere ajustar promoções e equipe para esse dia.`,
      accent: "#7C3AED",
    })

    // Completion rate
    if (d.taxaConclusao >= 85) {
      tips.push({
        icon: <CheckCircle size={16} />,
        title: `Excelente taxa de conclusão: ${d.taxaConclusao.toFixed(0)}%`,
        description: "Seus clientes estão comparecendo. Isso é ótimo para a reputação do negócio.",
        accent: "#10B981",
      })
    } else if (d.taxaConclusao < 70 && d.totalAgendamentos > 5) {
      tips.push({
        icon: <AlertCircle size={16} />,
        title: `Taxa de conclusão baixa: ${d.taxaConclusao.toFixed(0)}%`,
        description: "Muitos agendamentos não estão sendo concluídos. Considere enviar lembretes automáticos.",
        accent: "#F59E0B",
      })
    }

    // Cancellation rate
    if (ins.cancellationRate > 15 && d.totalAgendamentos > 5) {
      tips.push({
        icon: <XCircle size={16} />,
        title: `Cancelamentos em ${ins.cancellationRate}%`,
        description: "A taxa de cancelamento está alta. Tente políticas de confirmação antecipada e lembretes.",
        accent: "#EF4444",
      })
    }

    // Subscriber ratio
    if (ins.subscriberRatio < 10 && d.totalCustomers > 3) {
      tips.push({
        icon: <Repeat size={16} />,
        title: `Apenas ${ins.subscriberRatio}% dos clientes são assinantes`,
        description: "Assinantes geram receita recorrente previsível. Destaque seus planos de assinatura na loja.",
        accent: "#0066FF",
      })
    } else if (ins.subscriberRatio >= 30) {
      tips.push({
        icon: <ShieldCheck size={16} />,
        title: `${ins.subscriberRatio}% dos clientes são assinantes`,
        description: "Ótimo! Sua base de assinantes está sólida, garantindo receita recorrente.",
        accent: "#10B981",
      })
    }

    // Top service dominance
    if (ins.topServiceShare > 60 && d.servicosMaisPopulares.length > 1) {
      tips.push({
        icon: <Star size={16} />,
        title: `${d.servicosMaisPopulares[0].name} domina com ${ins.topServiceShare}%`,
        description: "Um serviço concentra a maioria dos agendamentos. Diversifique a oferta para reduzir risco.",
        accent: "#F59E0B",
      })
    }

    return tips
  }

  // ── RENDER ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`@keyframes skR{0%,100%{opacity:.5}50%{opacity:1}}`}</style>

      <div style={{
        maxWidth: 1200, margin: "0 auto",
        padding: isMobile ? "16px 14px" : "24px 24px 40px",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}>
        {/* ── HEADER ── */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: isMobile ? "flex-start" : "center",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? 12 : 0, marginBottom: isMobile ? 20 : 28,
          flexWrap: "wrap",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Activity size={20} color="#0066FF" />
              <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", margin: 0 }}>
                Painel de Saúde da Loja
              </h1>
            </div>
            <p style={{ fontSize: 13, color: "#71717A", marginTop: 4, marginLeft: 30 }}>
              {periodLabel(period)} · Visão completa do seu negócio
            </p>
          </div>

          {/* Period selector */}
          <div style={{
            display: "flex", gap: 4, flexWrap: "wrap",
            backgroundColor: "#111111", border: "1px solid #1F1F1F",
            borderRadius: 12, padding: 4,
          }}>
            {PERIODS.map(opt => {
              const active = period === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  style={{
                    height: 32, padding: "0 12px", borderRadius: 8,
                    fontSize: 12, fontWeight: 500, cursor: "pointer",
                    transition: "all 0.15s ease", border: "none",
                    fontFamily: "inherit",
                    backgroundColor: active ? "#0066FF" : "transparent",
                    color:           active ? "#fff"    : "#71717A",
                    boxShadow:       active ? "0 2px 8px rgba(0,102,255,0.3)" : "none",
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div style={{
            display: "flex", gap: 8, alignItems: "center",
            backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 20,
          }}>
            <AlertCircle size={14} color="#EF4444" />
            <span style={{ fontSize: 13, color: "#EF4444" }}>{error}</span>
            <button
              onClick={() => fetchData(period)}
              style={{ marginLeft: "auto", fontSize: 12, color: "#EF4444", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* ── LOADING ── */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)",
              gap: isMobile ? 10 : 16,
            }}>
              {[1,2,3,4].map(i => <SkeletonBlock key={i} h={130} />)}
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 16,
            }}>
              <SkeletonBlock h={240} />
              <SkeletonBlock h={240} />
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 16,
            }}>
              <SkeletonBlock h={300} />
              <SkeletonBlock h={300} />
            </div>
          </div>
        )}

        {/* ── CONTEÚDO ── */}
        {!loading && data && (
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 14 : 20 }}>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* SEÇÃO 1 · Resumo do Período                                */}
            {/* ════════════════════════════════════════════════════════════ */}
            <section>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: 12,
              }}>
                <Zap size={14} color="#F59E0B" />
                <h2 style={{ fontSize: 13, fontWeight: 600, color: "#A1A1AA", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Resumo do Período
                </h2>
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)",
                gap: isMobile ? 10 : 16,
              }}>
                <SummaryCard
                  label="Agendamentos"
                  value={data.totalAgendamentos}
                  sub={`${data.insights.avgDailyBookings}/dia em média`}
                  icon={<Calendar size={18} />}
                  color="#7C3AED"
                />
                <SummaryCard
                  label="Faturamento"
                  value={fmt(data.faturamentoTotal)}
                  sub={`Ticket médio: ${fmt(data.ticketMedio)}`}
                  icon={<DollarSign size={18} />}
                  color="#0066FF"
                  trend={data.insights.revenueGrowth}
                />
                <SummaryCard
                  label="Novos Clientes"
                  value={data.novosClientes}
                  sub={`${data.totalCustomers} total na base`}
                  icon={<Users size={18} />}
                  color="#10B981"
                />
                <SummaryCard
                  label="Taxa de Conclusão"
                  value={`${data.taxaConclusao.toFixed(1)}%`}
                  sub={`${data.agendamentosConcluidos} concluídos`}
                  icon={<Target size={18} />}
                  color={data.taxaConclusao >= 80 ? "#10B981" : data.taxaConclusao >= 60 ? "#F59E0B" : "#EF4444"}
                />
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* SEÇÃO 2 · Gráficos no Tempo                                */}
            {/* ════════════════════════════════════════════════════════════ */}
            <section>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: 12,
              }}>
                <BarChart2 size={14} color="#0066FF" />
                <h2 style={{ fontSize: 13, fontWeight: 600, color: "#A1A1AA", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Evolução no Tempo
                </h2>
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 16,
              }}>
                <MiniBarChart
                  data={data.agendamentosPorData as unknown as { date: string; [k: string]: number | string }[]}
                  valueKey="count"
                  color="#7C3AED"
                  formatValue={(v) => `${v} agendamento${v !== 1 ? "s" : ""}`}
                  title="Agendamentos por dia"
                  isMobile={isMobile}
                />
                <MiniBarChart
                  data={data.faturamentoPorDia as unknown as { date: string; [k: string]: number | string }[]}
                  valueKey="total"
                  color="#0066FF"
                  formatValue={(v) => fmt(v)}
                  title="Faturamento por dia"
                  isMobile={isMobile}
                />
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* SEÇÃO 3 · Serviços + Dias da Semana                        */}
            {/* ════════════════════════════════════════════════════════════ */}
            <section>
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 16,
              }}>
                {/* ── Top Serviços ── */}
                <div style={{
                  backgroundColor: "#111111", border: "1px solid #1F1F1F",
                  borderRadius: 16, padding: isMobile ? "18px 14px" : 24,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <Star size={14} color="#F59E0B" />
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>
                      Serviços que mais vendem
                    </h3>
                  </div>

                  {data.servicosMaisPopulares.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#52525B", textAlign: "center", padding: "24px 0" }}>
                      Nenhum dado disponível
                    </p>
                  ) : (
                    data.servicosMaisPopulares.map((svc, i) => {
                      const pct = Math.round((svc.count / maxSvcCnt) * 100)
                      return (
                        <div key={svc.id} style={{ marginBottom: i < data.servicosMaisPopulares.length - 1 ? 14 : 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                              <div style={{
                                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                                backgroundColor: i === 0 ? "rgba(0,102,255,0.12)" : "#161616",
                                border: `1px solid ${i === 0 ? "rgba(0,102,255,0.25)" : "#1F1F1F"}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 11, fontWeight: 700,
                                color: i === 0 ? "#0066FF" : "#52525B",
                              }}>
                                {i + 1}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {svc.name}
                                </p>
                                <p style={{ fontSize: 11, color: "#71717A", margin: "2px 0 0" }}>
                                  {svc.count} agendamento{svc.count !== 1 ? "s" : ""} · {fmt(svc.total)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div style={{ width: "100%", height: 4, backgroundColor: "#1A1A1A", borderRadius: 2 }}>
                            <div style={{
                              height: 4, borderRadius: 2,
                              background: i === 0 ? "linear-gradient(90deg,#0066FF,#7C3AED)" : "#252525",
                              width: `${pct}%`,
                              transition: "width 0.6s ease",
                            }} />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* ── Dias mais movimentados ── */}
                <div style={{
                  backgroundColor: "#111111", border: "1px solid #1F1F1F",
                  borderRadius: 16, padding: isMobile ? "18px 14px" : 24,
                  display: "flex", flexDirection: "column",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <Calendar size={14} color="#7C3AED" />
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>
                      Dias mais movimentados
                    </h3>
                  </div>

                  {data.agendamentosPorDia.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#52525B", textAlign: "center", padding: "24px 0" }}>
                      Nenhum dado disponível
                    </p>
                  ) : (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
                      {[...data.agendamentosPorDia]
                        .sort((a, b) => a.day - b.day)
                        .map(dia => {
                          const pct   = Math.round((dia.count / maxAgDia) * 100)
                          const isTop = dia.count === maxAgDia && dia.count > 0
                          return (
                            <div key={dia.day} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{
                                fontSize: 12, fontWeight: isTop ? 700 : 500,
                                color: isTop ? "#fff" : "#71717A",
                                width: 28, flexShrink: 0,
                              }}>
                                {WEEK_LABELS[dia.day] ?? dia.label}
                              </span>
                              <div style={{ flex: 1, height: 8, backgroundColor: "#1A1A1A", borderRadius: 4 }}>
                                <div style={{
                                  height: 8, borderRadius: 4,
                                  width: `${pct}%`,
                                  background: isTop ? "linear-gradient(90deg,#10B981,#0066FF)" : "#0066FF",
                                  transition: "width 0.6s ease",
                                  opacity: isTop ? 1 : 0.6,
                                }} />
                              </div>
                              <span style={{
                                fontSize: 12, fontWeight: isTop ? 700 : 500,
                                color: isTop ? "#fff" : "#A1A1AA",
                                width: 24, textAlign: "right", flexShrink: 0,
                              }}>
                                {dia.count}
                              </span>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* SEÇÃO 4 · Status + Assinantes                              */}
            {/* ════════════════════════════════════════════════════════════ */}
            <section>
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 16,
              }}>
                {/* Status breakdown */}
                <div style={{
                  backgroundColor: "#111111", border: "1px solid #1F1F1F",
                  borderRadius: 16, padding: isMobile ? "18px 14px" : 24,
                }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>
                    Distribuição por Status
                  </h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(data.statusCounts.length > 0
                      ? data.statusCounts
                      : Object.keys(STATUS_CONFIG).map(s => ({ status: s, count: 0 }))
                    ).map(sc => {
                      const cfg = STATUS_CONFIG[sc.status] ?? { label: sc.status, color: "#71717A", bg: "rgba(113,113,122,0.1)" }
                      return (
                        <div key={sc.status} style={{
                          display: "flex", gap: 10, alignItems: "center",
                          backgroundColor: "#161616", border: "1px solid #1F1F1F",
                          borderRadius: 10, padding: "10px 14px",
                          flex: isMobile ? "1 0 45%" : "0 0 auto",
                        }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: cfg.color, flexShrink: 0 }} />
                          <div>
                            <p style={{ fontSize: 10, color: "#71717A", margin: 0, fontWeight: 500, textTransform: "uppercase" }}>{cfg.label}</p>
                            <p style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: "2px 0 0" }}>{sc.count}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Assinantes card */}
                <div style={{
                  backgroundColor: "#111111", border: "1px solid #1F1F1F",
                  borderRadius: 16, padding: isMobile ? "18px 14px" : 24,
                  display: "flex", flexDirection: "column", justifyContent: "center",
                }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>
                    Base de Clientes
                  </h3>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{
                      backgroundColor: "#161616", border: "1px solid #1F1F1F",
                      borderRadius: 12, padding: 16, textAlign: "center",
                    }}>
                      <Users size={20} color="#0066FF" style={{ margin: "0 auto 8px", display: "block" }} />
                      <p style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: 0 }}>{data.totalCustomers}</p>
                      <p style={{ fontSize: 11, color: "#71717A", margin: "4px 0 0" }}>Total clientes</p>
                    </div>
                    <div style={{
                      backgroundColor: "#161616", border: "1px solid #1F1F1F",
                      borderRadius: 12, padding: 16, textAlign: "center",
                    }}>
                      <Crown size={20} color="#F59E0B" style={{ margin: "0 auto 8px", display: "block" }} />
                      <p style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: 0 }}>{data.totalActiveSubscribers}</p>
                      <p style={{ fontSize: 11, color: "#71717A", margin: "4px 0 0" }}>Assinantes ativos</p>
                    </div>
                  </div>

                  {/* Subscriber ratio bar */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: "#71717A" }}>Conversão para assinante</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: data.insights.subscriberRatio >= 20 ? "#10B981" : "#F59E0B" }}>
                        {data.insights.subscriberRatio}%
                      </span>
                    </div>
                    <div style={{ width: "100%", height: 6, backgroundColor: "#1A1A1A", borderRadius: 3 }}>
                      <div style={{
                        height: 6, borderRadius: 3,
                        width: `${Math.min(data.insights.subscriberRatio, 100)}%`,
                        background: data.insights.subscriberRatio >= 20
                          ? "linear-gradient(90deg,#10B981,#0066FF)"
                          : "linear-gradient(90deg,#F59E0B,#EF4444)",
                        transition: "width 0.6s ease",
                      }} />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* SEÇÃO 5 · Diagnóstico & Insights                           */}
            {/* ════════════════════════════════════════════════════════════ */}
            <section>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: 12,
              }}>
                <Lightbulb size={14} color="#F59E0B" />
                <h2 style={{ fontSize: 13, fontWeight: 600, color: "#A1A1AA", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Diagnóstico & Insights
                </h2>
              </div>

              {(() => {
                const tips = buildInsights(data)
                if (tips.length === 0) {
                  return (
                    <div style={{
                      backgroundColor: "#111111", border: "1px solid #1F1F1F",
                      borderRadius: 16, padding: 32, textAlign: "center",
                    }}>
                      <Lightbulb size={24} color="#1F1F1F" style={{ margin: "0 auto 8px", display: "block" }} />
                      <p style={{ fontSize: 13, color: "#52525B" }}>
                        Dados insuficientes para gerar insights. Continue usando o sistema!
                      </p>
                    </div>
                  )
                }
                return (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)",
                    gap: 12,
                  }}>
                    {tips.map((t, i) => (
                      <InsightCard key={i} {...t} />
                    ))}
                  </div>
                )
              })()}
            </section>

          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {!loading && !data && !error && (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <BarChart2 size={40} color="#1F1F1F" style={{ margin: "0 auto 12px", display: "block" }} />
            <p style={{ fontSize: 15, color: "#52525B" }}>Nenhum dado encontrado</p>
          </div>
        )}
      </div>
    </>
  )
}
