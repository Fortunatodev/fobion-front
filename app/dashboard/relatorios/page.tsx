"use client"

import { useState, useEffect, useCallback } from "react"
import { apiGet } from "@/lib/api"
import {
  TrendingUp, TrendingDown, Users, Calendar,
  Crown, DollarSign, CheckCircle2,
  XCircle, Clock, BarChart2, AlertCircle,
} from "lucide-react"

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  period: string
  schedulesByDay: Array<{ date: string; count: number; revenue: number }>
  totals: {
    schedules:   number
    revenue:     number
    clients:     number
    subscribers: number
    pending:     number
    done:        number
    cancelled:   number
  }
  popularServices: Array<{
    id: string; name: string; count: number; revenue: number
  }>
  schedulesByHour: Array<{ hour: number; count: number }>
  comparison: { thisMonth: number; lastMonth: number }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatComparisonPercent(current: number, previous: number) {
  if (!previous) return null
  const diff = ((current - previous) / previous) * 100
  return { value: Math.abs(diff).toFixed(1), isUp: diff >= 0 }
}

function formatShortDate(iso: string) {
  const [, month, day] = iso.split("-")
  return `${day}/${month}`
}

function buildChartBars(
  schedulesByDay: AnalyticsData["schedulesByDay"],
  period: string
) {
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30
  const result: Array<{ date: string; count: number; revenue: number }> = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split("T")[0]
    const found = schedulesByDay.find((s) => String(s.date).startsWith(dateStr))
    result.push({
      date:    dateStr,
      count:   Number(found?.count   ?? 0),
      revenue: Number(found?.revenue ?? 0),
    })
  }
  return result
}

// ─── Donut chart SVG puro ─────────────────────────────────────────────────────

function DonutChart({
  done, pending, cancelled,
}: { done: number; pending: number; cancelled: number }) {
  const total = done + pending + cancelled
  const C     = 2 * Math.PI * 45          // circunferência ≈ 282.74
  const GAP   = 2                          // gap em graus entre segmentos

  const segments = [
    { label: "Concluídos", value: done,      color: "#10B981" },
    { label: "Pendentes",  value: pending,   color: "#F59E0B" },
    { label: "Cancelados", value: cancelled, color: "#EF4444" },
  ]

  let offset = 0
  const arcs = segments.map((seg) => {
    const dash      = total ? (seg.value / total) * C : 0
    const dashGap   = Math.max(0, dash - GAP)
    const startOffset = C - offset
    offset += dash
    return { ...seg, dash: dashGap, startOffset }
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ position: "relative" }}>
        <svg viewBox="0 0 120 120" width={120} height={120}>
          {/* Trilha */}
          <circle cx={60} cy={60} r={45} fill="none" stroke="#161616" strokeWidth={14} />
          {/* Segmentos */}
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx={60} cy={60} r={45}
              fill="none"
              stroke={arc.dash > 0 ? arc.color : "transparent"}
              strokeWidth={14}
              strokeDasharray={`${arc.dash} ${C}`}
              strokeDashoffset={arc.startOffset}
              strokeLinecap="round"
              style={{ transform: "rotate(-90deg)", transformOrigin: "60px 60px" }}
            />
          ))}
          {/* Centro */}
          <text x={60} y={56} textAnchor="middle" fontSize={22} fontWeight={900} fill="#fff">
            {total}
          </text>
          <text x={60} y={70} textAnchor="middle" fontSize={9} fill="#71717A">
            {total === 1 ? "agendamento" : "agendamentos"}
          </text>
        </svg>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
        {segments.map((seg) => (
          <div key={seg.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: seg.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#A1A1AA" }}>{seg.label}</span>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{seg.value}</span>
              <span style={{ fontSize: 11, color: "#52525B" }}>
                ({total ? Math.round((seg.value / total) * 100) : 0}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accent, Icon, comparison,
}: {
  label: string
  value: string | number
  sub?: string
  accent: string
  Icon: React.ElementType
  comparison?: { thisMonth: number; lastMonth: number } | null
}) {
  const [hovered, setHovered] = useState(false)
  const cmp = comparison ? formatComparisonPercent(comparison.thisMonth, comparison.lastMonth) : null

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "#111111",
        border: `1px solid ${hovered ? "#252525" : "#1F1F1F"}`,
        borderRadius: 20, padding: "20px 22px",
        position: "relative", overflow: "hidden",
        transition: "border-color 0.2s ease",
      }}
    >
      {/* Glow */}
      <div style={{
        position: "absolute", top: -20, right: -20,
        width: 80, height: 80, borderRadius: "50%",
        background: `radial-gradient(circle, ${accent}20, transparent)`,
        pointerEvents: "none",
      }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 500, color: "#71717A", letterSpacing: "0.3px" }}>{label}</p>
          <p style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-1px", marginTop: 4, lineHeight: 1 }}>
            {value}
          </p>
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          backgroundColor: `${accent}18`, border: `1px solid ${accent}25`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon size={18} color={accent} />
        </div>
      </div>

      {sub && <p style={{ fontSize: 12, color: "#52525B" }}>{sub}</p>}

      {cmp && (
        <div style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 8 }}>
          {cmp.isUp
            ? <TrendingUp size={13} color="#10B981" />
            : <TrendingDown size={13} color="#EF4444" />
          }
          <span style={{ fontSize: 12, fontWeight: 600, color: cmp.isUp ? "#10B981" : "#EF4444" }}>
            {cmp.value}% vs mês anterior
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

const PERIODS = [
  { value: "7d",  label: "7 dias"  },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
]

export default function RelatoriosPage() {
  const [data,    setData]    = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period,  setPeriod]  = useState("30d")
  const [error,   setError]   = useState<string | null>(null)

  const fetchData = useCallback(async (p: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiGet<AnalyticsData>(`/analytics/overview?period=${p}`)
      setData(res)
    } catch {
      setError("Erro ao carregar relatórios. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(period) }, [period, fetchData])

  const today   = new Date().toISOString().split("T")[0]
  const bars    = data ? buildChartBars(data.schedulesByDay, period) : []
  const maxCount = Math.max(...bars.map((b) => b.count), 1)

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes sp { to { transform:rotate(360deg); } }
        * { box-sizing:border-box; }
      `}</style>

      <div style={{
        padding: "28px 32px",
        fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
        animation: "fadeIn 0.3s ease",
      }}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 28,
          flexWrap: "wrap", gap: 12,
        }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", margin: 0 }}>
              Relatórios
            </h1>
            <p style={{ fontSize: 14, color: "#71717A", marginTop: 4 }}>
              Acompanhe o desempenho do seu negócio
            </p>
          </div>

          {/* Seletor de período */}
          <div style={{
            display: "flex", gap: 2,
            backgroundColor: "#111111", border: "1px solid #1F1F1F",
            borderRadius: 12, padding: 4,
          }}>
            {PERIODS.map((opt) => {
              const isActive = period === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  style={{
                    height: 32, padding: "0 14px", borderRadius: 8,
                    fontSize: 13, fontWeight: 500,
                    border: "none", cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.15s ease",
                    backgroundColor: isActive ? "#1A1A1A" : "transparent",
                    color:           isActive ? "#fff"    : "#71717A",
                    boxShadow:       isActive ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {error && (
          <div style={{
            backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 24,
            display: "flex", gap: 8, alignItems: "center",
          }}>
            <AlertCircle size={14} color="#EF4444" />
            <span style={{ fontSize: 13, color: "#EF4444" }}>{error}</span>
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "3px solid #1F1F1F", borderTopColor: "#0066FF",
              animation: "sp 0.7s linear infinite",
            }} />
          </div>
        )}

        {/* ── Conteúdo ──────────────────────────────────────────────────── */}
        {!loading && data && (
          <>
            {/* KPI Cards */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 12, marginBottom: 24,
            }}>
              <KpiCard
                label="Receita total"
                value={formatCurrency(data.totals.revenue)}
                accent="#10B981"
                Icon={DollarSign}
                comparison={data.comparison}
              />
              <KpiCard
                label="Agendamentos"
                value={data.totals.schedules}
                sub={`${data.totals.done} concluídos · ${data.totals.pending} pendentes`}
                accent="#0066FF"
                Icon={Calendar}
              />
              <KpiCard
                label="Clientes cadastrados"
                value={data.totals.clients}
                sub={`${data.totals.subscribers} assinante${data.totals.subscribers !== 1 ? "s" : ""}`}
                accent="#7C3AED"
                Icon={Users}
              />
              <KpiCard
                label="Taxa de conclusão"
                value={`${data.totals.schedules ? Math.round((data.totals.done / data.totals.schedules) * 100) : 0}%`}
                sub={`${data.totals.cancelled} cancelado${data.totals.cancelled !== 1 ? "s" : ""}`}
                accent="#F59E0B"
                Icon={CheckCircle2}
              />
            </div>

            {/* Gráfico de barras */}
            <div style={{
              backgroundColor: "#111111", border: "1px solid #1F1F1F",
              borderRadius: 20, padding: "22px 24px", marginBottom: 16,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>
                    Agendamentos por dia
                  </p>
                  <p style={{ fontSize: 12, color: "#71717A", marginTop: 3 }}>
                    Visão geral do período
                  </p>
                </div>
                <BarChart2 size={18} color="#0066FF" />
              </div>

              {/* SVG puro */}
              <svg
                width="100%"
                height={160}
                style={{ overflow: "visible", display: "block" }}
                preserveAspectRatio="none"
                viewBox={`0 0 ${bars.length * 10} 160`}
              >
                {/* Linhas de grade */}
                {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                  <line
                    key={frac}
                    x1={0} y1={140 - frac * 120}
                    x2={bars.length * 10} y2={140 - frac * 120}
                    stroke="#1A1A1A" strokeWidth={0.5}
                  />
                ))}

                {bars.map((bar, i) => {
                  const barW   = 10 * 0.7
                  const barH   = Math.max((bar.count / maxCount) * 120, bar.count > 0 ? 3 : 0)
                  const x      = i * 10 + 10 * 0.15
                  const y      = 140 - barH
                  const isToday = bar.date === today
                  const fill   = bar.count > 0
                    ? isToday ? "#0066FF" : "rgba(0,102,255,0.45)"
                    : "#161616"
                  return (
                    <g key={bar.date}>
                      <rect
                        x={x} y={y}
                        width={barW} height={Math.max(barH, 2)}
                        rx={2} fill={fill}
                      >
                        <title>{bar.date} — {bar.count} agendamento{bar.count !== 1 ? "s" : ""} · {formatCurrency(bar.revenue)}</title>
                      </rect>
                    </g>
                  )
                })}

                {/* Linha base */}
                <line x1={0} y1={140} x2={bars.length * 10} y2={140} stroke="#252525" strokeWidth={1} />
              </svg>

              {/* Labels de data */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                {[bars[0], bars[Math.floor(bars.length / 2)], bars[bars.length - 1]].map((b, i) =>
                  b ? (
                    <span key={i} style={{ fontSize: 10, color: "#3F3F46" }}>
                      {formatShortDate(b.date)}
                    </span>
                  ) : null
                )}
              </div>
            </div>

            {/* Grid: Serviços + Donut */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 16, marginBottom: 16,
            }}>
              {/* Serviços mais populares */}
              <div style={{
                backgroundColor: "#111111", border: "1px solid #1F1F1F",
                borderRadius: 20, padding: "22px 24px",
              }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 16, marginTop: 0 }}>
                  Serviços mais populares
                </p>

                {data.popularServices.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#52525B", textAlign: "center", padding: "16px 0" }}>
                    Nenhum dado disponível
                  </p>
                ) : (
                  data.popularServices.map((svc, i) => {
                    const maxSvcCount = data.popularServices[0]?.count || 1
                    const pct = Math.round((svc.count / maxSvcCount) * 100)
                    return (
                      <div key={svc.id} style={{ marginBottom: i < data.popularServices.length - 1 ? 16 : 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <div style={{
                              width: 22, height: 22, borderRadius: 6,
                              backgroundColor: i === 0 ? "rgba(0,102,255,0.15)" : "#161616",
                              border: `1px solid ${i === 0 ? "rgba(0,102,255,0.2)" : "#1F1F1F"}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 10, fontWeight: 700,
                              color: i === 0 ? "#0066FF" : "#52525B",
                              flexShrink: 0,
                            }}>
                              {i + 1}
                            </div>
                            <span style={{
                              fontSize: 13, fontWeight: 500, color: "#fff",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160,
                            }}>
                              {svc.name}
                            </span>
                          </div>
                          <span style={{ fontSize: 12, color: "#71717A", fontWeight: 600, flexShrink: 0 }}>
                            {svc.count}x
                          </span>
                        </div>
                        <div style={{ height: 4, borderRadius: 4, backgroundColor: "#161616" }}>
                          <div style={{
                            height: 4, borderRadius: 4,
                            width: `${pct}%`,
                            background: i === 0 ? "linear-gradient(90deg,#0066FF,#7C3AED)" : "#252525",
                            transition: "width 0.6s ease",
                          }} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Status donut */}
              <div style={{
                backgroundColor: "#111111", border: "1px solid #1F1F1F",
                borderRadius: 20, padding: "22px 24px",
              }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 16, marginTop: 0 }}>
                  Status dos agendamentos
                </p>
                <DonutChart
                  done={data.totals.done}
                  pending={data.totals.pending}
                  cancelled={data.totals.cancelled}
                />
              </div>
            </div>

            {/* Comparação mensal */}
            <div style={{
              backgroundColor: "#111111", border: "1px solid #1F1F1F",
              borderRadius: 20, padding: "22px 24px",
            }}>
              {(() => {
                const cmp = formatComparisonPercent(
                  data.comparison.thisMonth,
                  data.comparison.lastMonth
                )
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>
                          Comparação mensal
                        </p>
                        <p style={{ fontSize: 12, color: "#71717A", marginTop: 3 }}>
                          Receita de agendamentos concluídos
                        </p>
                      </div>
                      {cmp
                        ? cmp.isUp
                          ? <TrendingUp size={18} color="#10B981" />
                          : <TrendingDown size={18} color="#EF4444" />
                        : <TrendingUp size={18} color="#52525B" />
                      }
                    </div>

                    <div style={{ display: "flex", gap: 24, marginTop: 20, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <p style={{ fontSize: 12, color: "#71717A", margin: 0 }}>Mês atual</p>
                        <p style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginTop: 4, letterSpacing: "-0.5px" }}>
                          {formatCurrency(data.comparison.thisMonth)}
                        </p>
                      </div>

                      <div style={{ width: 1, backgroundColor: "#1A1A1A", alignSelf: "stretch" }} />

                      <div style={{ flex: 1, minWidth: 140 }}>
                        <p style={{ fontSize: 12, color: "#71717A", margin: 0 }}>Mês anterior</p>
                        <p style={{ fontSize: 24, fontWeight: 900, color: "#A1A1AA", marginTop: 4, letterSpacing: "-0.5px" }}>
                          {formatCurrency(data.comparison.lastMonth)}
                        </p>
                      </div>
                    </div>

                    {cmp && (
                      <div style={{
                        marginTop: 16, display: "flex", gap: 8, alignItems: "center",
                        backgroundColor: cmp.isUp ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
                        border: `1px solid ${cmp.isUp ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`,
                        borderRadius: 10, padding: "10px 14px",
                      }}>
                        {cmp.isUp
                          ? <TrendingUp size={14} color="#10B981" />
                          : <TrendingDown size={14} color="#EF4444" />
                        }
                        <span style={{ fontSize: 13, fontWeight: 600, color: cmp.isUp ? "#10B981" : "#EF4444" }}>
                          {cmp.isUp
                            ? `+${cmp.value}% a mais que o mês passado 🔥`
                            : `-${cmp.value}% a menos que o mês passado`
                          }
                        </span>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </>
        )}
      </div>
    </>
  )
}