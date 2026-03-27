"use client"

import { useState, useEffect, useCallback } from "react"
import { useAnimatedNumber, formatAnimatedCurrency } from "@/lib/useAnimatedNumber"
import {
  BarChart2, TrendingUp, TrendingDown, Users, Calendar,
  DollarSign, CheckCircle, XCircle, AlertCircle, Crown,
  Zap, Target, Star, ArrowUpRight, ArrowDownRight,
  Activity, Repeat, ShieldCheck, Lightbulb, Clock,
  CreditCard, Banknote, QrCode,
} from "lucide-react"
import {
  ResponsiveContainer, AreaChart as RArea, Area,
  BarChart as RBar, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RTooltip,
} from "recharts"
import { apiGet } from "@/lib/api"
import { useUser } from "@/contexts/UserContext"
import ProFeatureGate from "@/components/shared/ProFeatureGate"

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = "7d" | "30d" | "90d" | "12m"

interface FaturamentoDia  { date: string; total: number; [key: string]: string | number }
interface AgendamentoDia  { day: number; label: string; count: number }
interface AgendamentoData { date: string; count: number; [key: string]: string | number }
interface StatusCount     { status: string; count: number }
interface ServicoPopular  { id: string; name: string; count: number; total: number }
interface HourCount       { hour: number; count: number }
interface HeatmapCell     { day: number; hour: number; count: number }
interface MetodoPagamento { method: string; total: number; count: number }

interface Insights {
  busiestDay:            string
  revenueGrowth:         number
  completionTrend:       number
  subscriberRatio:       number
  avgDailyBookings:      number
  cancellationRate:      number
  topServiceShare:       number
  returningCustomerRate?: number
  peakHour?:              string
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
  horarioPico?:             HourCount[]
  heatmap?:                 HeatmapCell[]
  faturamentoPorMetodo?:    MetodoPagamento[]
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

function fmtFull(iso: string): string {
  const d = new Date(iso + "T12:00:00")
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
}

function periodLabel(p: Period): string {
  return { "7d": "Ultimos 7 dias", "30d": "Ultimos 30 dias", "90d": "Ultimos 90 dias", "12m": "Ultimos 12 meses" }[p]
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:     { label: "Pendente",     color: "#F59E0B" },
  CONFIRMED:   { label: "Confirmado",   color: "#0066FF" },
  IN_PROGRESS: { label: "Em andamento", color: "#7C3AED" },
  DONE:        { label: "Concluido",    color: "#10B981" },
  CANCELLED:   { label: "Cancelado",    color: "#EF4444" },
}

const WEEK_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]
const PERIODS: { value: Period; label: string }[] = [
  { value: "7d",  label: "7 dias"   },
  { value: "30d", label: "30 dias"  },
  { value: "90d", label: "90 dias"  },
  { value: "12m", label: "12 meses" },
]
const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  PIX: <QrCode size={14} />, CREDIT_CARD: <CreditCard size={14} />,
  DEBIT_CARD: <CreditCard size={14} />, CASH: <Banknote size={14} />,
}
const PAYMENT_LABELS: Record<string, string> = {
  PIX: "PIX", CREDIT_CARD: "Credito", DEBIT_CARD: "Debito", CASH: "Dinheiro",
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      backgroundColor: "#0D0D0D",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 16,
      boxShadow: "0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)",
      transition: "border-color 0.2s, box-shadow 0.2s",
      ...style,
    }}>
      {children}
    </div>
  )
}

// useAnimatedNumber imported from @/lib/useAnimatedNumber

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBlock({ h = 120 }: { h?: number }) {
  return <div style={{ backgroundColor: "#0D0D0D", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 16, height: h, animation: "skR 1.4s ease infinite" }} />
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const w = 90
  const h = 32
  const pad = 2
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = pad + (1 - (v - min) / range) * (h - pad * 2)
    return `${x},${y}`
  })
  const areaPoints = [...points, `${pad + w - pad * 2},${h}`, `${pad},${h}`].join(" ")

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", bottom: 12, right: 14, width: 90, height: 32, opacity: 0.12, pointerEvents: "none" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.6" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spark-${color.replace("#","")})`} />
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── Summary Card ──────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, icon, color, trend, sparkData, isCurrency, suffix,
}: {
  label: string; value: number; sub?: string
  icon: React.ReactNode; color: string; trend?: number | null
  sparkData?: number[]; isCurrency?: boolean; suffix?: string
}) {
  const animated = useAnimatedNumber(value, { duration: isCurrency ? 1200 : 800 })
  const displayValue = isCurrency ? formatAnimatedCurrency(Math.round(animated)) : `${Math.round(animated)}${suffix ?? ""}`

  return (
    <Card style={{ padding: "20px 18px", position: "relative", overflow: "hidden" }}>
      {sparkData && sparkData.length >= 2 && <Sparkline data={sparkData} color={color} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${color}20, ${color}08)`,
          border: `1px solid ${color}25`,
          display: "flex", alignItems: "center", justifyContent: "center", color,
        }}>
          {icon}
        </div>
        {trend != null && trend !== 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 3,
            fontSize: 11, fontWeight: 600, lineHeight: 1,
            color: trend > 0 ? "#10B981" : "#EF4444",
            backgroundColor: trend > 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
            borderRadius: 6, padding: "3px 7px",
          }}>
            {trend > 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p style={{ fontSize: 11, fontWeight: 500, color: "#6B7280", margin: 0, textTransform: "uppercase", letterSpacing: "0.6px" }}>
        {label}
      </p>
      <p style={{ fontSize: 28, fontWeight: 800, color: "#F9FAFB", margin: "2px 0 0", letterSpacing: "-0.5px", lineHeight: 1.1 }}>
        {displayValue}
      </p>
      {sub && <p style={{ fontSize: 11, color: "#4B5563", margin: "6px 0 0" }}>{sub}</p>}
    </Card>
  )
}

// ── Recharts custom tooltip ────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, formatValue, isCurrency }: {
  active?: boolean; payload?: Array<{ value?: number }>; label?: string
  formatValue?: (v: number) => string; isCurrency?: boolean
}) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value ?? 0
  return (
    <div style={{
      backgroundColor: "#1A1A1A", border: "1px solid #2A2A2A",
      borderRadius: 10, padding: "10px 14px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
    }}>
      <p style={{ fontSize: 11, color: "#6B7280", margin: 0 }}>{label ? fmtFull(label) : ""}</p>
      <p style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", margin: "3px 0 0" }}>
        {formatValue ? formatValue(val) : isCurrency ? fmt(val) : val}
      </p>
    </div>
  )
}

// ── Area Chart (Recharts) ─────────────────────────────────────────────────────

type ChartDatum = { date: string } & { [key: string]: string | number }

function AreaChartComponent({
  data, valueKey, color, formatValue, title, isMobile, height = 220,
}: {
  data: ChartDatum[]
  valueKey: string; color: string
  formatValue: (v: number) => string; title: string
  isMobile: boolean; height?: number
}) {
  const step = data.length > 60 ? Math.ceil(data.length / 60) : 1
  const sampled = data.filter((_, i) => i % step === 0)

  return (
    <Card style={{ padding: isMobile ? "18px 14px" : "20px 24px" }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", margin: "0 0 16px" }}>{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <RArea data={sampled} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-area-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="date" tickFormatter={fmtShort}
            tick={{ fill: "#4B5563", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
            tickLine={false}
            interval={Math.max(Math.floor(sampled.length / (isMobile ? 4 : 6)), 0)}
          />
          <YAxis
            tickFormatter={(v: number) => formatValue(v)}
            tick={{ fill: "#4B5563", fontSize: 10 }}
            axisLine={false} tickLine={false}
            width={isMobile ? 50 : 60}
          />
          <RTooltip
            content={<ChartTooltip formatValue={formatValue} />}
            cursor={{ stroke: color, strokeOpacity: 0.2, strokeDasharray: "4 4" }}
          />
          <Area
            type="monotone"
            dataKey={valueKey}
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#grad-area-${color.slice(1)})`}
            dot={false}
            activeDot={{ r: 5, fill: color, stroke: "#0D0D0D", strokeWidth: 2 }}
            animationDuration={1200}
            animationEasing="ease-out"
          />
        </RArea>
      </ResponsiveContainer>
    </Card>
  )
}

// ── Bar Chart (Recharts) ──────────────────────────────────────────────────────

function BarChartComponent({
  data, valueKey, color, formatValue, title, isMobile, height = 220,
}: {
  data: ChartDatum[]
  valueKey: string; color: string
  formatValue: (v: number) => string; title: string
  isMobile: boolean; height?: number
}) {
  const step = data.length > 60 ? Math.ceil(data.length / 45) : 1
  const sampled = data.filter((_, i) => i % step === 0)

  return (
    <Card style={{ padding: isMobile ? "18px 14px" : "20px 24px" }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", margin: "0 0 16px" }}>{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <RBar data={sampled} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-bar-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="date" tickFormatter={fmtShort}
            tick={{ fill: "#4B5563", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
            tickLine={false}
            interval={Math.max(Math.floor(sampled.length / (isMobile ? 4 : 6)), 0)}
          />
          <YAxis
            tick={{ fill: "#4B5563", fontSize: 10 }}
            axisLine={false} tickLine={false}
            width={isMobile ? 30 : 35}
            allowDecimals={false}
          />
          <RTooltip
            content={<ChartTooltip formatValue={formatValue} />}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />
          <Bar
            dataKey={valueKey}
            fill={`url(#grad-bar-${color.slice(1)})`}
            radius={[4, 4, 0, 0]}
            animationDuration={1200}
            animationEasing="ease-out"
            maxBarSize={sampled.length < 15 ? 28 : 12}
          />
        </RBar>
      </ResponsiveContainer>
    </Card>
  )
}

// ── Donut Chart ───────────────────────────────────────────────────────────────

function DonutChart({ data, total, isMobile }: { data: StatusCount[]; total: number; isMobile: boolean }) {
  const size = 150
  const stroke = 20
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  const items = data.length > 0 ? data : Object.keys(STATUS_CONFIG).map(s => ({ status: s, count: 0 }))
  const dashLens = items.map(sc => (total > 0 ? sc.count / total : 0) * circumference)
  const offsets = dashLens.map((_, i) => -dashLens.slice(0, i).reduce((a, b) => a + b, 0))
  const slices = items.map((sc, i) => ({
    ...sc,
    ...(STATUS_CONFIG[sc.status] ?? { label: sc.status, color: "#6B7280" }),
    pct: total > 0 ? sc.count / total : 0,
    dashLen: dashLens[i],
    dashOffset: offsets[i],
  }))

  return (
    <Card style={{ padding: isMobile ? "18px 14px" : "20px 24px" }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", margin: "0 0 20px" }}>Distribuicao por Status</h3>
      <div style={{ display: "flex", gap: 28, alignItems: "center", flexDirection: isMobile ? "column" : "row" }}>
        <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
          <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={stroke} />
            {slices.map((sl, i) => sl.dashLen > 0 ? (
              <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke={sl.color} strokeWidth={stroke}
                strokeDasharray={`${sl.dashLen} ${circumference - sl.dashLen}`}
                strokeDashoffset={sl.dashOffset}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 0.8s ease, stroke-dashoffset 0.8s ease" }} />
            ) : null)}
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#F9FAFB" }}>{total}</span>
            <span style={{ fontSize: 10, color: "#4B5563", marginTop: -2 }}>total</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          {slices.map(sl => (
            <div key={sl.status} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: sl.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#9CA3AF", flex: 1 }}>{sl.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", minWidth: 24, textAlign: "right" }}>{sl.count}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

// ── Heat Map ──────────────────────────────────────────────────────────────────

function HeatMap({ data, isMobile }: { data: HeatmapCell[]; isMobile: boolean }) {
  const [tip, setTip] = useState<string | null>(null)
  const maxVal = Math.max(...data.map(d => d.count), 1)
  const hours = Array.from({ length: 15 }, (_, i) => i + 7)

  return (
    <Card style={{ padding: isMobile ? "18px 14px" : "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Clock size={14} color="#7C3AED" />
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", margin: 0 }}>Mapa de Calor</h3>
      </div>
      <p style={{ fontSize: 11, color: "#6B7280", margin: "0 0 12px", minHeight: 16 }}>
        {tip || "Passe o mouse para ver detalhes"}
      </p>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: `36px repeat(${hours.length}, 1fr)`, gap: 2, minWidth: isMobile ? 500 : "auto" }}>
          <div />
          {hours.map(h => (
            <div key={h} style={{ fontSize: 9, color: "#4B5563", textAlign: "center", paddingBottom: 2 }}>{`${h}h`}</div>
          ))}
          {[0, 1, 2, 3, 4, 5, 6].map(day => (
            <div key={day} style={{ display: "contents" }}>
              <div style={{ fontSize: 11, color: "#6B7280", display: "flex", alignItems: "center" }}>{WEEK_LABELS[day]}</div>
              {hours.map(hour => {
                const cell = data.find(d => d.day === day && d.hour === hour)
                const count = cell?.count ?? 0
                const intensity = count / maxVal
                return (
                  <div key={`${day}-${hour}`}
                    onMouseEnter={() => setTip(`${WEEK_LABELS[day]} ${hour}h — ${count} agendamento${count !== 1 ? "s" : ""}`)}
                    onMouseLeave={() => setTip(null)}
                    style={{
                      aspectRatio: "1", borderRadius: 3, cursor: "crosshair",
                      backgroundColor: count > 0 ? `rgba(0,102,255,${0.12 + intensity * 0.88})` : "rgba(255,255,255,0.02)",
                      transition: "background-color 0.2s", minHeight: 14,
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 10, justifyContent: "flex-end" }}>
        <span style={{ fontSize: 9, color: "#4B5563" }}>Menos</span>
        {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: v === 0 ? "rgba(255,255,255,0.02)" : `rgba(0,102,255,${0.12 + v * 0.88})` }} />
        ))}
        <span style={{ fontSize: 9, color: "#4B5563" }}>Mais</span>
      </div>
    </Card>
  )
}

// ── Insight Card ──────────────────────────────────────────────────────────────

function InsightCard({ icon, title, description, accent }: {
  icon: React.ReactNode; title: string; description: string; accent: string
}) {
  return (
    <Card style={{ padding: "16px 14px", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: `linear-gradient(135deg, ${accent}18, ${accent}08)`,
        border: `1px solid ${accent}20`,
        display: "flex", alignItems: "center", justifyContent: "center", color: accent,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#F9FAFB", margin: 0 }}>{title}</p>
        <p style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0", lineHeight: 1.5 }}>{description}</p>
      </div>
    </Card>
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
        featureName="Painel de Saude da Loja"
        description="Relatorios detalhados, graficos de faturamento e agendamentos, ranking de servicos, diagnostico inteligente do seu negocio e muito mais."
      />
    )
  }

  return <PainelDeSaude />
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Painel ───────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function PainelDeSaude() {
  const [data, setData]       = useState<RelatoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState("")
  const [period, setPeriod]   = useState<Period>("30d")
  const [isMobile, setIsMobile] = useState(false)
  const [fadeIn, setFadeIn]   = useState(true)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const fetchData = useCallback(async (p: Period) => {
    setFadeIn(false); setLoading(true); setError("")
    try { setData(await apiGet<RelatoryData>(`/analytics/relatorios?period=${p}`)) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Erro ao carregar dados.") }
    finally { setLoading(false); setTimeout(() => setFadeIn(true), 50) }
  }, [])

  useEffect(() => { fetchData(period) }, [period, fetchData])

  const maxSvcCnt = data ? Math.max(...data.servicosMaisPopulares.map(s => s.count), 1) : 1
  const maxAgDia  = data ? Math.max(...data.agendamentosPorDia.map(d => d.count), 1) : 1
  const spark7Ag = data?.agendamentosPorData?.slice(-7).map(d => d.count) ?? []
  const spark7Ft = data?.faturamentoPorDia?.slice(-7).map(d => d.total) ?? []

  function buildInsights(d: RelatoryData) {
    const ins = d.insights
    const tips: { icon: React.ReactNode; title: string; description: string; accent: string }[] = []

    if (ins.revenueGrowth > 0) tips.push({ icon: <TrendingUp size={16} />, title: `Faturamento cresceu ${ins.revenueGrowth}%`, description: `Comparado ao periodo anterior, seu faturamento subiu. Continue investindo no que esta funcionando.`, accent: "#10B981" })
    else if (ins.revenueGrowth < 0) tips.push({ icon: <TrendingDown size={16} />, title: `Faturamento caiu ${Math.abs(ins.revenueGrowth)}%`, description: `Seu faturamento diminuiu em relacao ao periodo anterior. Considere promocoes para recuperar.`, accent: "#EF4444" })

    tips.push({ icon: <Calendar size={16} />, title: `Dia mais movimentado: ${ins.busiestDay}`, description: `A maioria dos agendamentos acontece na ${ins.busiestDay}. Ajuste equipe e promocoes.`, accent: "#7C3AED" })

    if (ins.peakHour) tips.push({ icon: <Clock size={16} />, title: `Horario de pico: ${ins.peakHour}`, description: `O horario mais procurado. Garanta disponibilidade nesse periodo.`, accent: "#0066FF" })

    if (d.taxaConclusao >= 85) tips.push({ icon: <CheckCircle size={16} />, title: `Excelente taxa de conclusao: ${d.taxaConclusao.toFixed(0)}%`, description: "Seus clientes estao comparecendo. Otimo para a reputacao do negocio.", accent: "#10B981" })
    else if (d.taxaConclusao < 70 && d.totalAgendamentos > 5) tips.push({ icon: <AlertCircle size={16} />, title: `Taxa de conclusao baixa: ${d.taxaConclusao.toFixed(0)}%`, description: "Muitos agendamentos nao concluidos. Considere lembretes automaticos.", accent: "#F59E0B" })

    if (ins.cancellationRate > 15 && d.totalAgendamentos > 5) tips.push({ icon: <XCircle size={16} />, title: `Cancelamentos em ${ins.cancellationRate}%`, description: "Taxa de cancelamento alta. Tente confirmacao antecipada e lembretes.", accent: "#EF4444" })

    if ((ins.returningCustomerRate ?? 0) >= 40) tips.push({ icon: <Repeat size={16} />, title: `${ins.returningCustomerRate}% dos clientes retornaram`, description: "Excelente retencao! Continue oferecendo qualidade.", accent: "#10B981" })
    else if ((ins.returningCustomerRate ?? 100) < 20 && d.totalCustomers > 5) tips.push({ icon: <Repeat size={16} />, title: `Apenas ${ins.returningCustomerRate}% retornaram`, description: "Poucos clientes voltaram. Considere programas de fidelidade.", accent: "#F59E0B" })

    if (ins.subscriberRatio < 10 && d.totalCustomers > 3) tips.push({ icon: <Crown size={16} />, title: `Apenas ${ins.subscriberRatio}% sao assinantes`, description: "Assinantes geram receita recorrente. Destaque seus planos na loja.", accent: "#0066FF" })
    else if (ins.subscriberRatio >= 30) tips.push({ icon: <ShieldCheck size={16} />, title: `${ins.subscriberRatio}% sao assinantes`, description: "Base de assinantes solida. Receita recorrente garantida.", accent: "#10B981" })

    if (ins.topServiceShare > 60 && d.servicosMaisPopulares.length > 1) tips.push({ icon: <Star size={16} />, title: `${d.servicosMaisPopulares[0].name} domina com ${ins.topServiceShare}%`, description: "Concentracao em um servico. Diversifique para reduzir risco.", accent: "#F59E0B" })

    return tips
  }

  return (
    <>
      <style>{`
        @keyframes skR{0%,100%{opacity:.4}50%{opacity:.8}}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#1F1F1F;border-radius:3px}
        ::-webkit-scrollbar-thumb:hover{background:#2A2A2A}
      `}</style>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "16px 14px" : "24px 24px 48px", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0, marginBottom: isMobile ? 24 : 32 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Activity size={20} color="#0066FF" />
              <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: "#F9FAFB", letterSpacing: "-0.5px", margin: 0 }}>Painel de Saude</h1>
            </div>
            <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4, marginLeft: 30 }}>{periodLabel(period)}</p>
          </div>
          <div style={{ display: "flex", gap: 3, backgroundColor: "#0D0D0D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 3 }}>
            {PERIODS.map(opt => {
              const active = period === opt.value
              return <button key={opt.value} onClick={() => setPeriod(opt.value)} style={{ height: 32, padding: "0 14px", borderRadius: 9, fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s", border: "none", fontFamily: "inherit", backgroundColor: active ? "#0066FF" : "transparent", color: active ? "#fff" : "#6B7280", boxShadow: active ? "0 2px 8px rgba(0,102,255,0.25)" : "none" }}>{opt.label}</button>
            })}
          </div>
        </div>

        {error && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <AlertCircle size={14} color="#EF4444" />
            <span style={{ fontSize: 13, color: "#EF4444" }}>{error}</span>
            <button onClick={() => fetchData(period)} style={{ marginLeft: "auto", fontSize: 12, color: "#EF4444", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>Tentar novamente</button>
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: isMobile ? 10 : 16 }}>
              {[1,2,3,4].map(i => <SkeletonBlock key={i} h={140} />)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
              <SkeletonBlock h={260} /><SkeletonBlock h={260} />
            </div>
          </div>
        )}

        {!loading && data && (
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 24, opacity: fadeIn ? 1 : 0, transition: "opacity 0.3s ease" }}>

            {/* RESUMO */}
            <section>
              <SectionTitle icon={<Zap size={14} color="#F59E0B" />} text="Resumo do Periodo" />
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: isMobile ? 10 : 16 }}>
                <SummaryCard label="Agendamentos" value={data.totalAgendamentos} sub={`${data.insights.avgDailyBookings}/dia em media`} icon={<Calendar size={18} />} color="#7C3AED" sparkData={spark7Ag} />
                <SummaryCard label="Faturamento" value={data.faturamentoTotal} isCurrency sub={`Ticket medio: ${fmt(data.ticketMedio)}`} icon={<DollarSign size={18} />} color="#0066FF" trend={data.insights.revenueGrowth} sparkData={spark7Ft} />
                <SummaryCard label="Novos Clientes" value={data.novosClientes} sub={`${data.totalCustomers} total na base`} icon={<Users size={18} />} color="#10B981" />
                <SummaryCard label="Conclusao" value={Math.round(data.taxaConclusao)} suffix="%" sub={`${data.agendamentosConcluidos} concluidos`} icon={<Target size={18} />} color={data.taxaConclusao >= 80 ? "#10B981" : data.taxaConclusao >= 60 ? "#F59E0B" : "#EF4444"} />
              </div>
            </section>

            {/* GRAFICOS */}
            <section>
              <SectionTitle icon={<BarChart2 size={14} color="#0066FF" />} text="Evolucao no Tempo" />
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                <BarChartComponent data={data.agendamentosPorData} valueKey="count" color="#7C3AED" formatValue={(v: number) => `${v} agendamento${v !== 1 ? "s" : ""}`} title="Agendamentos por dia" isMobile={isMobile} />
                <AreaChartComponent data={data.faturamentoPorDia} valueKey="total" color="#0066FF" formatValue={(v: number) => fmt(v)} title="Faturamento por dia" isMobile={isMobile} />
              </div>
            </section>

            {/* SERVICOS + DIAS */}
            <section>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                <Card style={{ padding: isMobile ? "18px 14px" : "20px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <Star size={14} color="#F59E0B" />
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", margin: 0 }}>Servicos que mais vendem</h3>
                  </div>
                  {data.servicosMaisPopulares.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#4B5563", textAlign: "center", padding: "24px 0" }}>Nenhum dado disponivel</p>
                  ) : data.servicosMaisPopulares.map((svc, i) => {
                    const pct = Math.round((svc.count / maxSvcCnt) * 100)
                    return (
                      <div key={svc.id} style={{ marginBottom: i < data.servicosMaisPopulares.length - 1 ? 16 : 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                            <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: i === 0 ? "linear-gradient(135deg, rgba(0,102,255,0.15), rgba(124,58,237,0.1))" : "rgba(255,255,255,0.03)", border: `1px solid ${i === 0 ? "rgba(0,102,255,0.2)" : "rgba(255,255,255,0.05)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: i === 0 ? "#0066FF" : "#4B5563" }}>
                              {i + 1}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: "#F9FAFB", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{svc.name}</p>
                              <p style={{ fontSize: 11, color: "#6B7280", margin: "2px 0 0" }}>{svc.count} agendamento{svc.count !== 1 ? "s" : ""} · {fmt(svc.total)}</p>
                            </div>
                          </div>
                        </div>
                        <div style={{ width: "100%", height: 4, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 2 }}>
                          <div style={{ height: 4, borderRadius: 2, background: i === 0 ? "linear-gradient(90deg,#0066FF,#7C3AED)" : "rgba(255,255,255,0.08)", width: `${pct}%`, transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)" }} />
                        </div>
                      </div>
                    )
                  })}
                </Card>

                <Card style={{ padding: isMobile ? "18px 14px" : "20px 24px", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <Calendar size={14} color="#7C3AED" />
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", margin: 0 }}>Dias mais movimentados</h3>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
                    {[...data.agendamentosPorDia].sort((a, b) => a.day - b.day).map(dia => {
                      const pct = Math.round((dia.count / maxAgDia) * 100)
                      const isTop = dia.count === maxAgDia && dia.count > 0
                      return (
                        <div key={dia.day} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: isTop ? 700 : 500, color: isTop ? "#F9FAFB" : "#6B7280", width: 28, flexShrink: 0 }}>{WEEK_LABELS[dia.day] ?? dia.label}</span>
                          <div style={{ flex: 1, height: 8, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 4 }}>
                            <div style={{ height: 8, borderRadius: 4, width: `${Math.max(pct, 2)}%`, background: isTop ? "linear-gradient(90deg,#10B981,#0066FF)" : "rgba(0,102,255,0.5)", transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)" }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: isTop ? 700 : 500, color: isTop ? "#F9FAFB" : "#9CA3AF", width: 24, textAlign: "right", flexShrink: 0 }}>{dia.count}</span>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              </div>
            </section>

            {/* STATUS + CLIENTES */}
            <section>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                <DonutChart data={data.statusCounts} total={data.totalAgendamentos} isMobile={isMobile} />
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <Card style={{ padding: isMobile ? "18px 14px" : "20px 24px" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", margin: "0 0 14px" }}>Base de Clientes</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 14, textAlign: "center" }}>
                        <Users size={18} color="#0066FF" style={{ margin: "0 auto 6px", display: "block" }} />
                        <p style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", margin: 0 }}>{data.totalCustomers}</p>
                        <p style={{ fontSize: 10, color: "#6B7280", margin: "2px 0 0" }}>Total clientes</p>
                      </div>
                      <div style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 14, textAlign: "center" }}>
                        <Crown size={18} color="#F59E0B" style={{ margin: "0 auto 6px", display: "block" }} />
                        <p style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", margin: 0 }}>{data.totalActiveSubscribers}</p>
                        <p style={{ fontSize: 10, color: "#6B7280", margin: "2px 0 0" }}>Assinantes ativos</p>
                      </div>
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: "#6B7280" }}>Conversao para assinante</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: data.insights.subscriberRatio >= 20 ? "#10B981" : "#F59E0B" }}>{data.insights.subscriberRatio}%</span>
                      </div>
                      <div style={{ width: "100%", height: 5, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 3 }}>
                        <div style={{ height: 5, borderRadius: 3, width: `${Math.min(data.insights.subscriberRatio, 100)}%`, background: data.insights.subscriberRatio >= 20 ? "linear-gradient(90deg,#10B981,#0066FF)" : "linear-gradient(90deg,#F59E0B,#EF4444)", transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  </Card>

                  {(data.faturamentoPorMetodo?.length ?? 0) > 0 && (
                    <Card style={{ padding: isMobile ? "18px 14px" : "20px 24px" }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", margin: "0 0 14px" }}>Metodos de Pagamento</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {data.faturamentoPorMetodo!.map(m => {
                          const maxM = Math.max(...data.faturamentoPorMetodo!.map(x => x.total), 1)
                          const pct = Math.round((m.total / maxM) * 100)
                          return (
                            <div key={m.method}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9CA3AF" }}>
                                  {PAYMENT_ICONS[m.method]}<span style={{ fontSize: 12 }}>{PAYMENT_LABELS[m.method] ?? m.method}</span>
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#F9FAFB" }}>{fmt(m.total)}</span>
                              </div>
                              <div style={{ width: "100%", height: 4, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 2 }}>
                                <div style={{ height: 4, borderRadius: 2, background: "linear-gradient(90deg,#0066FF,#7C3AED)", width: `${pct}%`, transition: "width 0.6s ease" }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            </section>

            {/* HEAT MAP */}
            {(data.heatmap?.length ?? 0) > 0 && data.heatmap!.some(h => h.count > 0) && (
              <section><HeatMap data={data.heatmap!} isMobile={isMobile} /></section>
            )}

            {/* INSIGHTS */}
            <section>
              <SectionTitle icon={<Lightbulb size={14} color="#F59E0B" />} text="Diagnostico & Insights" />
              {(() => {
                const tips = buildInsights(data)
                return tips.length === 0 ? (
                  <Card style={{ padding: 32, textAlign: "center" }}>
                    <Lightbulb size={24} color="#1F1F1F" style={{ margin: "0 auto 8px", display: "block" }} />
                    <p style={{ fontSize: 13, color: "#4B5563" }}>Dados insuficientes para gerar insights.</p>
                  </Card>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap: 12 }}>
                    {tips.map((t, i) => <InsightCard key={i} {...t} />)}
                  </div>
                )
              })()}
            </section>
          </div>
        )}

        {!loading && !data && !error && (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <BarChart2 size={40} color="#1F1F1F" style={{ margin: "0 auto 12px", display: "block" }} />
            <p style={{ fontSize: 15, color: "#4B5563" }}>Nenhum dado encontrado</p>
          </div>
        )}
      </div>
    </>
  )
}

// ── Section Title ─────────────────────────────────────────────────────────────

function SectionTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      {icon}
      <h2 style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", margin: 0, textTransform: "uppercase", letterSpacing: "0.8px" }}>{text}</h2>
    </div>
  )
}
