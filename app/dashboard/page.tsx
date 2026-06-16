"use client"

import { useEffect, useState, useCallback } from "react"
import { useAnimatedNumber, formatAnimatedCurrency } from "@/lib/useAnimatedNumber"
import { useRouter } from "next/navigation"
import {
  AlertCircle, BarChart3, Calendar,
  CircleDollarSign, Crown, Sparkles,
  Users, Clock,
  TrendingUp, Star, UserPlus, Rocket, Heart, ChevronRight,
  Receipt, Copy, Check,
} from "lucide-react"
import { toast } from "sonner"
import { useUser } from "@/contexts/UserContext"
import { apiGet } from "@/lib/api"
import { useCrmFilaCount } from "@/lib/useCrmFilaCount"
import OnboardingChecklist from "@/components/dashboard/OnboardingChecklist"
import RevenueActionsCard from "@/components/dashboard/RevenueActionsCard"
import WelcomeModal from "@/components/dashboard/WelcomeModal"
import { formatScheduleTime, formatScheduleDate } from "@/lib/dateUtils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Schedule {
  id: string
  scheduledAt: string
  status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "DONE" | "CANCELLED"
  totalPrice: number
  paymentStatus: "PENDING" | "PAID"
  customer: { name: string }
  vehicle: { plate: string | null }
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
  return map[status] ?? { label: status, color: "var(--c-text-2)", bg: "rgba(161,161,170,0.1)" }
}

// ── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({
  title, rawValue, isCurrency, subtitle, icon,
  iconColor, iconBg, accentColor, loading, locked, onClick,
}: {
  title: string; rawValue: number; isCurrency?: boolean; subtitle: string
  icon: React.ReactNode; iconColor: string; iconBg: string
  accentColor: string; loading: boolean; locked?: boolean; onClick?: () => void
}) {
  const animated = useAnimatedNumber(loading ? 0 : rawValue, { duration: 1000 })
  const display = isCurrency ? formatAnimatedCurrency(Math.round(animated)) : String(Math.round(animated))
  const [hov, setHov] = useState(false)
  // #43 — feedback de toque no mobile (sem hover): leve press só em card clicável.
  const [pressed, setPressed] = useState(false)
  const interactive = !!onClick
  const active = hov || (pressed && interactive)
  const endPress = () => setPressed(false)

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      onPointerDown={interactive ? () => setPressed(true) : undefined}
      onPointerUp={interactive ? endPress : undefined}
      onPointerCancel={interactive ? endPress : undefined}
      onPointerLeave={interactive ? endPress : undefined}
      style={{
        backgroundColor: "var(--c-surface)",
        border: `1px solid ${active ? accentColor + "50" : "var(--c-border)"}`,
        borderRadius: 16,
        padding: 20,
        position: "relative",
        overflow: "hidden",
        transition: "all 0.2s ease",
        transform: pressed && interactive ? "scale(0.98)" : hov ? "translateY(-2px)" : "translateY(0)",
        boxShadow: active ? "0 8px 24px var(--c-shadow)" : "none",
        minWidth: 0,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-3)", margin: 0 }}>
            {title}
          </p>
          <div style={{ marginTop: 8, minHeight: 36, display: "flex", alignItems: "center" }}>
            {loading ? (
              <div className="animate-skeleton-pulse" style={{
                height: 32, width: "60%",
                backgroundColor: "var(--c-border)", borderRadius: 8,
              }} />
            ) : locked ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#F59E0B", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "5px 10px" }}>
                <Crown size={13} /> Desbloquear no Pro
              </span>
            ) : (
              <span style={{ fontSize: 24, fontWeight: 700, color: "var(--c-text)", letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums" }}>
                {display}
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
      <div style={{ marginTop: 12 }}>
        <span style={{ fontSize: 11, color: "var(--c-text-4)" }}>{subtitle}</span>
      </div>
      <div style={{
        position: "absolute", bottom: -20, right: -20,
        width: 80, height: 80, borderRadius: "50%",
        background: `${accentColor}08`, filter: "blur(20px)",
        pointerEvents: "none",
      }} />
    </div>
  )
}

// ── SummaryCardGrid (PRO — animated) ──────────────────────────────────────────

function MiniMetric({ icon, iconColor, label, rawValue, isCurrency, sub, delay }: {
  icon: React.ReactNode; iconColor: string; label: string
  rawValue: number; isCurrency?: boolean; sub?: React.ReactNode; delay?: number
}) {
  const animated = useAnimatedNumber(rawValue, { duration: 1000, delay: delay ?? 0 })
  const display = isCurrency ? formatAnimatedCurrency(Math.round(animated)) : String(Math.round(animated))

  return (
    <div style={{
      backgroundColor: "var(--c-surface-2)",
      border: "1px solid var(--c-border)",
      borderRadius: 10, padding: "10px 12px",
      transition: "border-color 0.2s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 5,
          background: `linear-gradient(135deg, ${iconColor}25, ${iconColor}10)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: iconColor,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 10, fontWeight: 500, color: "var(--c-text-3)" }}>{label}</span>
      </div>
      <p style={{ fontSize: 17, fontWeight: 700, color: "var(--c-text)", margin: 0, letterSpacing: "-0.3px", fontVariantNumeric: "tabular-nums" }}>
        {display}
      </p>
      {sub && <div style={{ marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SummaryCardGrid({ summary }: { summary: DashboardSummary }) {
  const growthColor = summary.revenueGrowth >= 0 ? "#10B981" : "#EF4444"
  // Ticket médio = faturamento ÷ atendimentos concluídos no período (insight pedido pelo dono).
  const ticketMedio = summary.appointments > 0 ? Math.round(summary.revenue / summary.appointments) : 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <MiniMetric
          icon={<CircleDollarSign size={11} />} iconColor="#10B981"
          label="Faturamento" rawValue={summary.revenue} isCurrency delay={0}
          sub={
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <TrendingUp size={10} color={growthColor} />
              <span style={{ fontSize: 10, fontWeight: 600, color: growthColor, fontVariantNumeric: "tabular-nums" }}>
                {summary.revenueGrowth >= 0 ? "+" : ""}{summary.revenueGrowth}%
              </span>
            </div>
          }
        />
        <MiniMetric
          icon={<Receipt size={11} />} iconColor="#0EA5E9"
          label="Ticket médio" rawValue={ticketMedio} isCurrency delay={100}
          sub={<span style={{ fontSize: 10, color: "var(--c-text-4)" }}>por atendimento</span>}
        />
        <MiniMetric
          icon={<Calendar size={11} />} iconColor="#3B82F6"
          label="Concluídos" rawValue={summary.appointments} delay={200}
          sub={<span style={{ fontSize: 10, color: "var(--c-text-4)" }}>agendamentos</span>}
        />
        <MiniMetric
          icon={<UserPlus size={11} />} iconColor="#F59E0B"
          label="Novos clientes" rawValue={summary.newCustomers} delay={300}
          sub={<span style={{ fontSize: 10, color: "var(--c-text-4)" }}>no período</span>}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
        <MiniMetric
          icon={<Star size={11} />} iconColor="#7C3AED"
          label="Assinantes" rawValue={summary.activeSubscribers} delay={400}
          sub={<span style={{ fontSize: 10, color: "var(--c-text-4)" }}>ativos</span>}
        />
      </div>

      {summary.topService && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          backgroundColor: "var(--c-surface-2)",
          border: "1px solid var(--c-border)",
          borderRadius: 10, padding: "8px 12px",
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Crown size={11} color="#F59E0B" />
          </div>
          <span style={{ fontSize: 11, color: "var(--c-text-2)", flex: 1 }}>
            Mais popular: <strong style={{ color: "var(--c-text)", fontWeight: 600 }}>{summary.topService.name}</strong>
            <span style={{ color: "var(--c-text-4)", fontVariantNumeric: "tabular-nums" }}> ({summary.topService.count}x)</span>
          </span>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router   = useRouter()
  const { user, planStatus } = useUser()

  const isPro = planStatus?.plan === "PRO"
  const isManager = user?.role === "OWNER" || user?.role === "ADMIN"

  const [schedulesToday,    setSchedulesToday]    = useState<Schedule[]>([])
  const [totalCustomers,    setTotalCustomers]    = useState(0)
  const [activeSubscribers, setActiveSubscribers] = useState(0)
  const [summary,           setSummary]           = useState<DashboardSummary | null>(null)
  const [summaryLoading,    setSummaryLoading]    = useState(false)
  const [payrollOwed,       setPayrollOwed]       = useState<{ totalCents: number; people: number; soonestDue: string | null } | null>(null)
  const [loading,           setLoading]           = useState(true)
  const [error,             setError]             = useState<string | null>(null)
  const [ctaHov,            setCtaHov]            = useState(false)
  const [storeSlug,         setStoreSlug]         = useState<string | null>(null)
  const [linkCopied,        setLinkCopied]        = useState(false)
  const [hovRow,            setHovRow]            = useState<string | null>(null)
  // #43 — linha "pressionada" no toque (mobile não tem hover)
  const [pressedRow,        setPressedRow]        = useState<string | null>(null)

  // O7 — coordenação Welcome ↔ Checklist + botão flutuante "Continuar configuração"
  const [reopenSignal, setReopenSignal] = useState(0)
  const crmCount = useCrmFilaCount()
  const [onbState, setOnbState] = useState<{ ready: boolean; collapsed: boolean; allDone: boolean }>({
    ready: false, collapsed: false, allDone: false,
  })
  const [fabHov, setFabHov] = useState(false)
  const handleOnbState = useCallback(
    (s: { ready: boolean; collapsed: boolean; allDone: boolean }) => setOnbState(s),
    [],
  )

  // B08 — load() reaproveitável (retry sem full reload da SPA)
  const load = useCallback(async () => {
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
  }, [isPro])
  useEffect(() => { load() }, [load])

  // ── Fetch dashboard summary (PRO only) ─────────────────────────────────────
  useEffect(() => {
    if (!isPro) return
    setSummaryLoading(true)
    apiGet<DashboardSummary>("/analytics/dashboard-summary")
      .then((data) => setSummary(data))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false))
  }, [isPro])

  // ── Folha a pagar (só dono/admin; ignora silenciosamente se sem plano) ──────
  useEffect(() => {
    if (!isManager) return
    interface PayrollLine { totalOwedNowCents: number; nextDueDate: string | null }
    interface PayrollSummaryResp { totalAPagarCents: number; funcionarios: PayrollLine[] }
    apiGet<PayrollSummaryResp>("/commissions/summary")
      .then((s) => {
        const owed = (s.funcionarios ?? []).filter((f) => f.totalOwedNowCents > 0)
        if (s.totalAPagarCents <= 0 || owed.length === 0) { setPayrollOwed(null); return }
        const soonestDue = owed
          .map((f) => f.nextDueDate)
          .filter((d): d is string => !!d)
          .sort()[0] ?? null
        setPayrollOwed({ totalCents: s.totalAPagarCents, people: owed.length, soonestDue })
      })
      .catch(() => setPayrollOwed(null))
  }, [isManager])

  // Slug da loja pública (pro atalho "copiar link"). Falha silenciosa → botão não aparece.
  useEffect(() => {
    apiGet<{ business: { slug?: string | null } | null }>("/auth/me")
      .then((r) => setStoreSlug(r.business?.slug ?? null))
      .catch(() => { /* sem business → sem link */ })
  }, [])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"
  const storeUrl = storeSlug ? `${appUrl}/${storeSlug}` : null
  const copyStoreLink = useCallback(async () => {
    if (!storeUrl) return
    try {
      await navigator.clipboard.writeText(storeUrl)
      setLinkCopied(true)
      toast.success("Link da loja copiado! Mande pros seus clientes.")
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      toast.error("Não consegui copiar. Copie da barra de endereço da sua loja.")
    }
  }, [storeUrl])

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

  // #51 — abrir o contexto direto do agendamento em vez da lista genérica.
  // Carro já em atendimento → vai pro Pátio (fila operacional, onde ele está vivo).
  // Pendente/confirmado → Agendamentos do dia certo (?date=) p/ achar e fechar a comanda.
  const openSchedule = useCallback((s: Schedule) => {
    if (s.status === "IN_PROGRESS") {
      router.push("/dashboard/patio")
      return
    }
    const date = formatScheduleDate(s.scheduledAt)
    router.push(`/dashboard/agendamentos?date=${date}`)
  }, [router])

  return (
    // paddingBottom: garante que o conteúdo final (ex.: "Ver completo" do card de
    // relatórios) não fique escondido atrás do launcher flutuante da Carla.
    <div className="animate-dash-fade-in" style={{ paddingBottom: 80 }}>

      <WelcomeModal firstName={firstName} onDone={() => setReopenSignal((n) => n + 1)} />

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
            onClick={() => load()}
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
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>
            Olá, {firstName}
          </h1>
          <p style={{ fontSize: 13, color: "var(--c-text-4)", marginTop: 4, textTransform: "capitalize" }}>
            {formatTodayDate()}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {storeUrl && (
          <button
            onClick={copyStoreLink}
            title={storeUrl}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "var(--c-surface)", border: "1px solid var(--c-border)",
              borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontFamily: "inherit",
              fontSize: 13, fontWeight: 600, color: linkCopied ? "#10B981" : "var(--c-text-2)",
              whiteSpace: "nowrap", transition: "color 0.15s",
            }}
          >
            {linkCopied ? <Check size={14} /> : <Copy size={14} />}
            {linkCopied ? "Link copiado" : "Copiar link da loja"}
          </button>
        )}
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
      </div>

      {/* ── O4/O5/O7: checklist de ativação por outcome (some quando 100% ou recolhido) ── */}
      <OnboardingChecklist reopenSignal={reopenSignal} onStateChange={handleOnbState} />

      {/* ── CRM: "pra cuidar hoje" — só aparece quando há clientes na fila ── */}
      {crmCount > 0 && (
        <button
          onClick={() => router.push("/dashboard/relacionamento")}
          style={{
            width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
            background: "linear-gradient(135deg, rgba(236,72,153,0.10), rgba(124,58,237,0.10))",
            border: "1px solid rgba(236,72,153,0.25)", borderRadius: 14, padding: "14px 16px",
          }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(236,72,153,0.16)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Heart size={20} color="#EC4899" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
              {crmCount} {crmCount === 1 ? "cliente pra cuidar hoje" : "clientes pra cuidar hoje"}
            </p>
            <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "2px 0 0" }}>
              Retornos, quem sumiu e follow-ups — chame em 1 toque no WhatsApp.
            </p>
          </div>
          <ChevronRight size={18} color="#EC4899" style={{ flexShrink: 0 }} />
        </button>
      )}

      {/* ── Metric cards (.metrics-grid) ──────────────────────────────── */}
      {/* 1 col → 2 col (640px) → 4 col (1280px) — via CSS puro no globals.css */}
      <div className="metrics-grid">
        <MetricCard
          title="Receita paga hoje" rawValue={paidRevenue} isCurrency
          subtitle="serviços confirmados como pagos"
          icon={<CircleDollarSign size={16} />}
          iconColor="#10B981" iconBg="rgba(16,185,129,0.1)"
          accentColor="#10B981" loading={loading}
        />
        <MetricCard
          title="Agendamentos hoje" rawValue={schedulesToday.length}
          subtitle="agendamentos neste dia"
          icon={<Calendar size={16} />}
          iconColor="#0066FF" iconBg="rgba(0,102,255,0.1)"
          accentColor="#0066FF" loading={loading}
        />
        <MetricCard
          title="Total de clientes" rawValue={totalCustomers}
          subtitle="clientes cadastrados"
          icon={<Users size={16} />}
          iconColor="#F59E0B" iconBg="rgba(245,158,11,0.1)"
          accentColor="#F59E0B" loading={loading}
        />
        <MetricCard
          title="Assinantes ativos" rawValue={isPro ? activeSubscribers : 0}
          subtitle={isPro ? "planos ativos agora" : "clube de assinatura — toque pra ativar"}
          icon={<Crown size={16} />}
          iconColor="#7C3AED" iconBg="rgba(124,58,237,0.1)"
          accentColor="#7C3AED" loading={loading}
          locked={!isPro}
          onClick={!isPro ? () => router.push("/dashboard/planos") : undefined}
        />
      </div>

      {/* ── Folha a pagar (dono/admin) — lembrete acionável ── */}
      {payrollOwed && (
        <button
          onClick={() => router.push("/dashboard/relatorios/repasses")}
          style={{
            width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 14, marginBottom: 16,
            padding: "16px 18px", borderRadius: 16,
            background: "linear-gradient(135deg, rgba(245,158,11,0.10), rgba(239,68,68,0.05))",
            border: "1px solid rgba(245,158,11,0.25)",
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#F59E0B", flexShrink: 0 }}>
            <CircleDollarSign size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
              {formatCurrency(payrollOwed.totalCents)} a pagar para a equipe
            </p>
            <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "3px 0 0" }}>
              {payrollOwed.people} {payrollOwed.people === 1 ? "funcionário" : "funcionários"} aguardando
              {payrollOwed.soonestDue ? ` · vencimento mais próximo em ${new Date(payrollOwed.soonestDue).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : ""}
            </p>
          </div>
          <ChevronRight size={18} color="var(--c-text-3)" style={{ flexShrink: 0 }} />
        </button>
      )}

      {/* ── V2-B3: ações de receita (retornos a cobrar + clientes a recuperar) ── */}
      <RevenueActionsCard />

      {/* ── Middle row (.middle-grid) ─────────────────────────────────── */}
      {/* 1 col → 2 col (1024px) */}
      <div className="middle-grid">

        {/* Próximos agendamentos */}
        <div style={{
          backgroundColor: "var(--c-surface)",
          border: "1px solid var(--c-border)",
          borderRadius: 16, padding: 20,
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", marginBottom: 16,
          }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)", margin: 0 }}>
                Próximos agendamentos
              </h2>
              <p style={{ fontSize: 11, color: "var(--c-text-4)", marginTop: 3 }}>
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
                  height: 60, backgroundColor: "var(--c-border)", borderRadius: 10,
                  animationDelay: `${i * 0.12}s`,
                }} />
              ))}
            </div>
          )}

          {!loading && nextSchedules.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <Calendar size={28} color="var(--c-border-2)" style={{ margin: "0 auto 10px" }} />
              <p style={{ fontSize: 13, color: "var(--c-text-4)" }}>
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
                const isPressed   = pressedRow === s.id
                return (
                  <div
                    key={s.id}
                    onMouseEnter={() => setHovRow(s.id)}
                    onMouseLeave={() => setHovRow(null)}
                    onClick={() => openSchedule(s)}
                    // #43 — feedback de toque no mobile (sem hover): leve press ao tocar.
                    onPointerDown={() => setPressedRow(s.id)}
                    onPointerUp={() => setPressedRow(null)}
                    onPointerCancel={() => setPressedRow(null)}
                    onPointerLeave={() => setPressedRow(null)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 8px", borderRadius: 10,
                      backgroundColor: isHov || isPressed ? "var(--c-surface-2)" : "transparent",
                      borderBottom: i < nextSchedules.length - 1 ? "1px solid var(--c-border)" : "none",
                      cursor: "pointer", transition: "background-color 0.12s, transform 0.1s ease",
                      transform: isPressed ? "scale(0.99)" : "scale(1)",
                    }}
                  >
                    <div style={{ width: 3, height: 36, borderRadius: 2, backgroundColor: st.color, flexShrink: 0 }} />
                    <div style={{ flexShrink: 0, minWidth: 48 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", margin: 0, fontVariantNumeric: "tabular-nums" }}>
                        {formatTime(s.scheduledAt)}
                      </p>
                      <p style={{ fontSize: 10, color: "var(--c-text-4)", margin: "1px 0 0" }}>hoje</p>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.customer.name}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {serviceName}{s.vehicle.plate ? ` · ${s.vehicle.plate}` : ""}
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
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text)", fontVariantNumeric: "tabular-nums" }}>
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
          backgroundColor: "var(--c-surface)",
          border: "1px solid var(--c-border)",
          borderRadius: 16, padding: 20,
          minHeight: 220,
        }}>
          {isPro ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)", margin: 0 }}>
                    Resumo do mês
                  </h2>
                  <p style={{ fontSize: 11, color: "var(--c-text-4)", marginTop: 3 }}>
                    Últimos 30 dias
                  </p>
                </div>
                <button
                  onClick={() => router.push("/dashboard/relatorios")}
                  style={{ fontSize: 12, color: "#0066FF", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                >
                  Ver completo →
                </button>
              </div>

              {summaryLoading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="animate-skeleton-pulse" style={{
                      height: 40, backgroundColor: "var(--c-border)", borderRadius: 8,
                      animationDelay: `${i * 0.1}s`,
                    }} />
                  ))}
                </div>
              )}

              {!summaryLoading && summary && (
                <SummaryCardGrid summary={summary} />
              )}

              {!summaryLoading && !summary && (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <BarChart3 size={28} color="var(--c-border-2)" style={{ margin: "0 auto 8px" }} />
                  <p style={{ fontSize: 12, color: "var(--c-text-4)" }}>Sem dados para o período.</p>
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
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)", margin: 0 }}>
                Relatórios disponíveis no Pro
              </h3>
              <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: 0, maxWidth: 240 }}>
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
        backgroundColor: "var(--c-surface)",
        border: "1px solid var(--c-border)",
        borderRadius: 16, padding: 20,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 16,
        }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)", margin: 0 }}>
              Agenda de hoje
            </h2>
            <p style={{ fontSize: 11, color: "var(--c-text-4)", marginTop: 3 }}>
              Todos os agendamentos do dia
            </p>
          </div>
          {!loading && (
            <span style={{
              fontSize: 11, fontWeight: 500, color: "#0066FF",
              backgroundColor: "rgba(0,102,255,0.08)",
              border: "1px solid rgba(0,102,255,0.15)",
              borderRadius: 99, padding: "3px 10px",
              fontVariantNumeric: "tabular-nums",
            }}>
              {todaySchedules.length} agendamento{todaySchedules.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-skeleton-pulse" style={{
                height: 52, backgroundColor: "var(--c-border)", borderRadius: 8,
                animationDelay: `${i * 0.1}s`,
              }} />
            ))}
          </div>
        )}

        {!loading && todaySchedules.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Calendar size={36} color="var(--c-border)" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontSize: 13, color: "var(--c-text-4)", marginBottom: 16 }}>
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
                        fontSize: 10, fontWeight: 600, color: "var(--c-text-4)",
                        textTransform: "uppercase", letterSpacing: "0.6px",
                        borderBottom: "1px solid var(--c-border)", whiteSpace: "nowrap",
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
                        onClick={() => openSchedule(s)}
                        style={{
                          cursor: "pointer", transition: "background-color 0.1s",
                          backgroundColor: idx % 2 === 0 ? "transparent" : "var(--c-surface-2)",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--c-surface-2)" }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = idx % 2 === 0 ? "transparent" : "var(--c-surface-2)" }}
                      >
                        <td style={{ padding: "11px 12px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--c-text-2)", fontVariantNumeric: "tabular-nums" }}>
                            <Clock size={11} />
                            {formatTime(s.scheduledAt)}
                          </div>
                        </td>
                        <td style={{ padding: "11px 12px", fontSize: 13, fontWeight: 500, color: "var(--c-text)" }}>
                          {s.customer.name}
                        </td>
                        <td style={{ padding: "11px 12px", fontSize: 12, color: "var(--c-text-3)", fontFamily: "monospace", fontVariantNumeric: "tabular-nums" }}>
                          {s.vehicle.plate || "—"}
                        </td>
                        <td style={{ padding: "11px 12px", fontSize: 12, color: "var(--c-text-2)" }}>
                          {serviceName}
                        </td>
                        <td style={{ padding: "11px 12px", fontSize: 13, fontWeight: 600, color: "var(--c-text)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
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
                const isPressed   = pressedRow === s.id
                return (
                  <div
                    key={s.id}
                    onClick={() => openSchedule(s)}
                    // #43 — feedback de toque no mobile
                    onPointerDown={() => setPressedRow(s.id)}
                    onPointerUp={() => setPressedRow(null)}
                    onPointerCancel={() => setPressedRow(null)}
                    onPointerLeave={() => setPressedRow(null)}
                    style={{
                      backgroundColor: "var(--c-surface-2)",
                      border: `1px solid ${isPressed ? "var(--c-border-2)" : "var(--c-border)"}`,
                      borderRadius: 12, padding: 16, cursor: "pointer",
                      transition: "transform 0.1s ease, border-color 0.1s ease",
                      transform: isPressed ? "scale(0.985)" : "scale(1)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--c-text)", fontVariantNumeric: "tabular-nums" }}>
                        <Clock size={12} color="var(--c-text-4)" />
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
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)", margin: "0 0 4px" }}>
                      {s.customer.name}
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: 0 }}>
                        {serviceName}{s.vehicle.plate ? <> · <span style={{ fontFamily: "monospace", fontVariantNumeric: "tabular-nums" }}>{s.vehicle.plate}</span></> : ""}
                      </p>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text)", fontVariantNumeric: "tabular-nums" }}>
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

      {/* ── O7: botão flutuante "Continuar configuração" ──────────────────── */}
      {/* Reabre/expande o checklist se foi recolhido e ainda faltam passos. */}
      {onbState.ready && onbState.collapsed && !onbState.allDone && (
        <button
          onClick={() => setReopenSignal((n) => n + 1)}
          onMouseEnter={() => setFabHov(true)}
          onMouseLeave={() => setFabHov(false)}
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "linear-gradient(135deg, #0066FF, #7C3AED)",
            border: "none",
            borderRadius: 999,
            padding: "11px 18px",
            color: "#FFFFFF",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: fabHov ? "0 10px 30px rgba(0,102,255,0.45)" : "0 6px 20px rgba(0,102,255,0.3)",
            transform: fabHov ? "translateY(-2px)" : "translateY(0)",
            transition: "all 0.2s ease",
          }}
        >
          <Rocket size={15} />
          Continuar configuração
        </button>
      )}
    </div>
  )
}