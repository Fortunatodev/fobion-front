"use client"

import { useState, useEffect, useCallback } from "react"
import {
  BarChart2, TrendingUp, TrendingDown, Users, Calendar,
  DollarSign, CheckCircle, XCircle, Clock, AlertCircle,
} from "lucide-react"
import { apiGet } from "@/lib/api"

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = "7d" | "30d" | "90d" | "12m"

interface FaturamentoDia {
  date:  string
  total: number
}

interface ServicoPopular {
  id:    string
  name:  string
  count: number
  total: number
}

interface AgendamentoDia {
  day:   number   // 0 = Dom … 6 = Sáb
  label: string
  count: number
}

interface StatusCount {
  status: string
  count:  number
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
  servicosMaisPopulares:    ServicoPopular[]
  agendamentosPorDia:       AgendamentoDia[]
  statusCounts:             StatusCount[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatPeriodLabel(p: Period): string {
  const map: Record<Period, string> = {
    "7d":  "Últimos 7 dias",
    "30d": "Últimos 30 dias",
    "90d": "Últimos 90 dias",
    "12m": "Últimos 12 meses",
  }
  return map[p]
}

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-")
  return `${d}/${m}`
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:     { label: "Pendente",    color: "#F59E0B", bg: "rgba(245,158,11,0.1)"  },
  CONFIRMED:   { label: "Confirmado",  color: "#0066FF", bg: "rgba(0,102,255,0.1)"   },
  IN_PROGRESS: { label: "Em andamento",color: "#7C3AED", bg: "rgba(124,58,237,0.1)"  },
  DONE:        { label: "Concluído",   color: "#10B981", bg: "rgba(16,185,129,0.1)"  },
  CANCELLED:   { label: "Cancelado",   color: "#EF4444", bg: "rgba(239,68,68,0.1)"   },
}

const WEEK_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d",  label: "7 dias"    },
  { value: "30d", label: "30 dias"   },
  { value: "90d", label: "90 dias"   },
  { value: "12m", label: "12 meses"  },
]

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      backgroundColor: "#111111", border: "1px solid #1F1F1F",
      borderRadius: 16, padding: 20,
    }}>
      <div style={{ height: 12, width: "50%", backgroundColor: "#1A1A1A", borderRadius: 6, marginBottom: 12, animation: "skR 1.4s ease infinite" }} />
      <div style={{ height: 32, width: "60%", backgroundColor: "#1A1A1A", borderRadius: 8, animation: "skR 1.4s ease 0.1s infinite" }} />
    </div>
  )
}

// ── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({
  label, value, icon, iconColor, iconBg,
}: {
  label: string; value: string | number
  icon: React.ReactNode; iconColor: string; iconBg: string
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: "#111111",
        border: `1px solid ${hov ? "#252525" : "#1F1F1F"}`,
        borderRadius: 16, padding: 20,
        transition: "all 0.2s ease",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        cursor: "default",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <p style={{ fontSize: 12, color: "#71717A", margin: 0, fontWeight: 500 }}>{label}</p>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          backgroundColor: iconBg, color: iconColor,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>
      <p style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-1px", margin: 0, lineHeight: 1 }}>
        {value}
      </p>
    </div>
  )
}

// ── BarChart ──────────────────────────────────────────────────────────────────

function BarChartSection({ data, isMobile }: { data: FaturamentoDia[]; isMobile: boolean }) {
  const [tooltip, setTooltip] = useState<{ idx: number; x: number; y: number } | null>(null)
  const maxVal = Math.max(...data.map(d => d.total), 1)

  return (
    <div style={{
      backgroundColor: "#111111", border: "1px solid #1F1F1F",
      borderRadius: 16, padding: isMobile ? "18px 16px" : 24, marginBottom: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>Faturamento no período</p>
          <p style={{ fontSize: 12, color: "#71717A", marginTop: 3 }}>Agendamentos concluídos por dia</p>
        </div>
        <BarChart2 size={18} color="#0066FF" />
      </div>

      {data.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#52525B", fontSize: 13 }}>
          Nenhum dado disponível para o período
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Barras */}
          <div style={{
            display: "flex", alignItems: "flex-end", gap: isMobile ? 2 : 3,
            height: 160, overflowX: "auto",
          }}>
            {data.map((item, i) => {
              const pct = (item.total / maxVal) * 100
              return (
                <div
                  key={item.date}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: "0 0 auto", minWidth: isMobile ? 8 : 12 }}
                  onMouseEnter={e => setTooltip({ idx: i, x: (e.target as HTMLElement).getBoundingClientRect().left, y: (e.target as HTMLElement).getBoundingClientRect().top })}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <div
                    style={{
                      width: "100%", minHeight: pct > 0 ? 4 : 2,
                      height: `${Math.max(pct, pct > 0 ? 2 : 0.5)}%`,
                      background: pct > 0 ? "linear-gradient(180deg,#0066FF,#7C3AED)" : "#1A1A1A",
                      borderRadius: "4px 4px 0 0",
                      cursor: "pointer",
                      transition: "opacity 0.15s",
                    }}
                    title={`${formatShortDate(item.date)}: ${formatCurrency(item.total)}`}
                  />
                  {!isMobile && (
                    <span style={{ fontSize: 9, color: "#3F3F46", whiteSpace: "nowrap" }}>
                      {formatShortDate(item.date)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Labels mobile */}
          {isMobile && data.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              {[data[0], data[Math.floor(data.length / 2)], data[data.length - 1]].map((b, i) =>
                b ? <span key={i} style={{ fontSize: 10, color: "#3F3F46" }}>{formatShortDate(b.date)}</span> : null
              )}
            </div>
          )}

          {/* Tooltip */}
          {tooltip !== null && data[tooltip.idx] && (
            <div style={{
              position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
              backgroundColor: "#1A1A1A", border: "1px solid #252525", borderRadius: 8,
              padding: "6px 10px", pointerEvents: "none", zIndex: 10, whiteSpace: "nowrap",
            }}>
              <p style={{ fontSize: 11, color: "#71717A", margin: 0 }}>{formatShortDate(data[tooltip.idx].date)}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: "2px 0 0" }}>
                {formatCurrency(data[tooltip.idx].total)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const [data,     setData]     = useState<RelatoryData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [period,   setPeriod]   = useState<Period>("30d")
  const [error,    setError]    = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiGet<RelatoryData>(`/analytics/relatorios?period=${p}`)
      setData(res)
    } catch {
      setError("Erro ao carregar relatórios. Verifique a conexão com o servidor.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(period) }, [period, fetchData])

  const maxAgDia  = data ? Math.max(...data.agendamentosPorDia.map(d => d.count), 1) : 1
  const maxSvcCnt = data?.servicosMaisPopulares[0]?.count ?? 1

  return (
    <>
      <style>{`
        @keyframes skR { 0%,100%{opacity:.4} 50%{opacity:.9} }
        @keyframes fadeR { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing:border-box; }
      `}</style>

      <div style={{
        maxWidth: 1280, margin: "0 auto",
        fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
        animation: "fadeR 0.3s ease",
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
            <h1 style={{ fontSize: isMobile ? 22 : 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", margin: 0 }}>
              Relatórios
            </h1>
            <p style={{ fontSize: 13, color: "#71717A", marginTop: 4 }}>
              {formatPeriodLabel(period)} · Acompanhe o desempenho do seu negócio
            </p>
          </div>

          {/* Seletor de período */}
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

        {/* ── LOADING SKELETONS ── */}
        {loading && (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(auto-fill,minmax(200px,1fr))",
              gap: isMobile ? 10 : 16, marginBottom: isMobile ? 16 : 24,
            }}>
              {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
            </div>
            <div style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F", borderRadius: 16, height: 240, marginBottom: 16, animation: "skR 1.4s ease infinite" }} />
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 16, marginBottom: 16,
            }}>
              <div style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F", borderRadius: 16, height: 280, animation: "skR 1.4s ease 0.1s infinite" }} />
              <div style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F", borderRadius: 16, height: 280, animation: "skR 1.4s ease 0.2s infinite" }} />
            </div>
          </>
        )}

        {/* ── CONTEÚDO ── */}
        {!loading && data && (
          <>
            {/* ── SEÇÃO 1: KPI Cards ── */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(auto-fill,minmax(200px,1fr))",
              gap: isMobile ? 10 : 16,
              marginBottom: isMobile ? 16 : 24,
            }}>
              <MetricCard
                label="Faturamento Total"
                value={formatCurrency(data.faturamentoTotal)}
                icon={<DollarSign size={18} />}
                iconColor="#0066FF" iconBg="rgba(0,102,255,0.1)"
              />
              <MetricCard
                label="Ticket Médio"
                value={formatCurrency(data.ticketMedio)}
                icon={<TrendingUp size={18} />}
                iconColor="#10B981" iconBg="rgba(16,185,129,0.1)"
              />
              <MetricCard
                label="Total Agendamentos"
                value={data.totalAgendamentos}
                icon={<Calendar size={18} />}
                iconColor="#7C3AED" iconBg="rgba(124,58,237,0.1)"
              />
              <MetricCard
                label="Taxa de Conclusão"
                value={`${data.taxaConclusao.toFixed(1)}%`}
                icon={<CheckCircle size={18} />}
                iconColor="#10B981" iconBg="rgba(16,185,129,0.1)"
              />
              <MetricCard
                label="Novos Clientes"
                value={data.novosClientes}
                icon={<Users size={18} />}
                iconColor="#0066FF" iconBg="rgba(0,102,255,0.1)"
              />
              <MetricCard
                label="Cancelamentos"
                value={data.agendamentosCancelados}
                icon={<XCircle size={18} />}
                iconColor="#EF4444" iconBg="rgba(239,68,68,0.1)"
              />
            </div>

            {/* ── SEÇÃO 2: Gráfico de faturamento ── */}
            <BarChartSection data={data.faturamentoPorDia} isMobile={isMobile} />

            {/* ── SEÇÃO 3: Duas colunas ── */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 16,
              marginBottom: 16,
            }}>
              {/* COLUNA A — Serviços mais populares */}
              <div style={{
                backgroundColor: "#111111", border: "1px solid #1F1F1F",
                borderRadius: 16, padding: isMobile ? "18px 16px" : 24,
              }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>
                  Serviços mais populares
                </h3>

                {data.servicosMaisPopulares.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#52525B", textAlign: "center", padding: "24px 0" }}>
                    Nenhum dado disponível
                  </p>
                ) : (
                  data.servicosMaisPopulares.map((svc, i) => {
                    const pct = Math.round((svc.count / maxSvcCnt) * 100)
                    return (
                      <div key={svc.id} style={{ marginBottom: i < data.servicosMaisPopulares.length - 1 ? 16 : 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
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
                                {svc.count} agendamento{svc.count !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0, marginLeft: 8 }}>
                            {formatCurrency(svc.total)}
                          </span>
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

              {/* COLUNA B — Agendamentos por dia da semana */}
              <div style={{
                backgroundColor: "#111111", border: "1px solid #1F1F1F",
                borderRadius: 16, padding: isMobile ? "18px 16px" : 24,
              }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>
                  Dias mais movimentados
                </h3>

                {data.agendamentosPorDia.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#52525B", textAlign: "center", padding: "24px 0" }}>
                    Nenhum dado disponível
                  </p>
                ) : (
                  // Ordenar Dom→Sáb
                  [...data.agendamentosPorDia]
                    .sort((a, b) => a.day - b.day)
                    .map(dia => {
                      const pct    = Math.round((dia.count / maxAgDia) * 100)
                      const isTop  = dia.count === maxAgDia && dia.count > 0
                      return (
                        <div key={dia.day} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                          <span style={{ fontSize: 12, color: "#71717A", width: 28, flexShrink: 0 }}>
                            {WEEK_LABELS[dia.day] ?? dia.label}
                          </span>
                          <div style={{ flex: 1, height: 8, backgroundColor: "#1A1A1A", borderRadius: 4 }}>
                            <div style={{
                              height: 8, borderRadius: 4,
                              width: `${pct}%`,
                              background: isTop ? "#10B981" : "#0066FF",
                              transition: "width 0.6s ease",
                            }} />
                          </div>
                          <span style={{ fontSize: 12, color: "#A1A1AA", width: 22, textAlign: "right", flexShrink: 0 }}>
                            {dia.count}
                          </span>
                        </div>
                      )
                    })
                )}
              </div>
            </div>

            {/* ── SEÇÃO 4: Distribuição por status ── */}
            <div style={{
              backgroundColor: "#111111", border: "1px solid #1F1F1F",
              borderRadius: 16, padding: isMobile ? "18px 16px" : 24,
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>
                Distribuição por status
              </h3>

              <div style={{
                display: "flex", gap: isMobile ? 8 : 12, flexWrap: "wrap",
              }}>
                {(data.statusCounts.length > 0
                  ? data.statusCounts
                  : Object.keys(STATUS_CONFIG).map(s => ({ status: s, count: 0 }))
                ).map(sc => {
                  const cfg = STATUS_CONFIG[sc.status] ?? { label: sc.status, color: "#71717A", bg: "rgba(113,113,122,0.1)" }
                  return (
                    <div key={sc.status} style={{
                      display: "flex", gap: 10, alignItems: "center",
                      backgroundColor: "#161616", border: "1px solid #1F1F1F",
                      borderRadius: 10, padding: isMobile ? "8px 10px" : "8px 12px",
                      flex: isMobile ? "1 0 40%" : "0 0 auto",
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: cfg.color, flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 10, color: "#71717A", margin: 0, fontWeight: 500 }}>{cfg.label}</p>
                        <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "2px 0 0" }}>{sc.count}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ── EMPTY (sem erro e sem dados) ── */}
        {!loading && !data && !error && (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <BarChart2 size={40} color="#1F1F1F" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontSize: 15, color: "#52525B" }}>Nenhum dado encontrado</p>
          </div>
        )}
      </div>
    </>
  )
}