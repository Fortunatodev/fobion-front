"use client"

import { useState, useEffect, useCallback, useRef, Component, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft, ChevronRight, Plus, Calendar,
  AlertCircle, User, Clock, CheckCircle2, XCircle,
  Loader2, ArrowRight, RefreshCw, Bell,
} from "lucide-react"
import { apiGet, apiPut } from "@/lib/api"
import { promptEncaixe, encaixeUrl } from "@/lib/encaixe"
import { useNotificationsSSE } from "@/lib/useNotificationsSSE"
import { formatScheduleTime, formatScheduleDate } from "@/lib/dateUtils"
import { toast } from "sonner"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import TabTutorial from "@/components/shared/TabTutorial"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Schedule {
  id:           string
  scheduledAt:  string
  employeeId?:  string | null   // lane (usado pelo encaixe ao fechar)
  status:       string
  totalPrice:   number
  notes?:       string | null
  paymentMethod: string
  // Dados reais: campos opcionais de agendamento podem chegar null/ausentes
  // (placa/marca do veículo, nome do cliente, profissional não atribuído).
  customer:     { id: string; name: string | null; phone: string | null } | null
  vehicle:      { plate: string | null; brand: string | null; model: string | null; color: string | null } | null
  scheduleServices?: ({ service: { id: string; name: string | null; durationMinutes: number | null } | null } | null)[] | null
  employee?:    { id: string; name: string | null; avatarUrl: string | null } | null
}

interface Employee {
  id:        string
  name:      string
  avatarUrl: string | null
}

interface DayData {
  date:           Date
  dateStr:        string
  isCurrentMonth: boolean
  isToday:        boolean
  isSelected:     boolean
  schedules:      Schedule[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  REQUESTED:   { label: "Solicitado",   color: "#F59E0B", icon: <Bell     size={10} /> },
  PENDING:     { label: "Pendente",     color: "#FBBF24", icon: <Clock    size={10} /> },
  CONFIRMED:   { label: "Confirmado",   color: "#3B82F6", icon: <CheckCircle2 size={10} /> },
  IN_PROGRESS: { label: "Em andamento", color: "#8B5CF6", icon: <Loader2  size={10} /> },
  DONE:        { label: "Concluído",    color: "#10B981", icon: <CheckCircle2 size={10} /> },
  CANCELLED:   { label: "Cancelado",    color: "#EF4444", icon: <XCircle  size={10} /> },
}

const PAYMENT_METHODS = [
  { value: "PIX",         label: "PIX"            },
  { value: "CASH",        label: "Dinheiro"       },
  { value: "CREDIT_CARD", label: "Cartão Crédito" },
  { value: "DEBIT_CARD",  label: "Cartão Débito"  },
]

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split("T")[0]
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^\w/, c => c.toUpperCase())
}

function formatDayHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  }).replace(/^\w/, c => c.toUpperCase())
}

// Getters defensivos — em dados reais qualquer relação pode vir null.
function customerName(s: Schedule): string {
  return s.customer?.name?.trim() || "Cliente"
}
function firstName(s: Schedule): string {
  return (s.customer?.name?.trim() || "Cliente").split(" ")[0]
}
function serviceNamesOf(s: Schedule): string {
  return (s.scheduleServices ?? [])
    .map(ss => ss?.service?.name)
    .filter(Boolean)
    .join(", ")
}
function totalDurationOf(s: Schedule): number {
  return (s.scheduleServices ?? [])
    .reduce((a, ss) => a + (ss?.service?.durationMinutes ?? 0), 0)
}
function vehicleSummary(s: Schedule): string {
  const base = [s.vehicle?.brand, s.vehicle?.model].filter(Boolean).join(" ")
  const plate = s.vehicle?.plate
  if (base && plate) return `${base} · ${plate}`
  return base || plate || "—"
}

// Resiliência por item: um card malformado vira fallback, não derruba a tela.
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
          backgroundColor: "var(--c-bg)", border: "1px solid var(--c-surface-2)",
          borderRadius: 12, padding: "12px 14px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertCircle size={13} color="var(--c-text-4)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--c-text-4)" }}>
            Não foi possível exibir este agendamento.
          </span>
        </div>
      )
    }
    return this.props.children
  }
}

function buildCalendarDays(
  month: Date, schedules: Schedule[], selectedDate: string
): DayData[] {
  const today    = todayStr()
  const year     = month.getFullYear()
  const mon      = month.getMonth()
  const firstDay = new Date(year, mon, 1).getDay()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  const lastDay = new Date(year, mon + 1, 0).getDate()
  const days: DayData[] = []

  // Dias do mês anterior
  for (let i = startOffset - 1; i >= 0; i--) {
    const d    = new Date(year, mon, -i)
    const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
    days.push({ date: d, dateStr: dStr, isCurrentMonth: false, isToday: false, isSelected: false, schedules: [] })
  }

  // Dias do mês atual
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, mon, d)
    const dStr = `${year}-${String(mon+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`
    days.push({
      date,
      dateStr:        dStr,
      isCurrentMonth: true,
      isToday:        dStr === today,
      isSelected:     dStr === selectedDate,
      // ✅ Usar formatScheduleDate para comparar em UTC, não local
      schedules:      schedules.filter(s => formatScheduleDate(s.scheduledAt) === dStr),
    })
  }

  // Completar grid até 42 células
  let nextD = 1
  while (days.length < 42) {
    const d    = new Date(year, mon + 1, nextD++)
    const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
    days.push({ date: d, dateStr: dStr, isCurrentMonth: false, isToday: false, isSelected: false, schedules: [] })
  }

  return days
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function CalSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
      {Array.from({ length: 42 }).map((_, i) => (
        <div key={i} style={{
          height: 36, borderRadius: 8, backgroundColor: "var(--c-surface)",
          animation: `skeletonPulse 1.4s ease ${(i % 7) * 0.06}s infinite`,
        }} />
      ))}
    </div>
  )
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: "var(--c-text-3)", icon: null }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 600, color: meta.color,
      backgroundColor: `${meta.color}16`,
      border: `1px solid ${meta.color}30`,
      borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap",
    }}>
      {meta.icon} {meta.label}
    </span>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--c-surface)" }}>
      <span style={{ fontSize: 13, color: "var(--c-text-3)" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--c-text-2)", fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{value}</span>
    </div>
  )
}

// ── ActionBtn ─────────────────────────────────────────────────────────────────

function ActionBtn({
  label, color, onClick, loading, outline = false, disabled = false,
}: {
  label: string; color: string; onClick: () => void
  loading: boolean; outline?: boolean; disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        flex: 1, height: 36, borderRadius: 9, fontSize: 12, fontWeight: 600,
        background: outline ? "transparent" : color,
        border: outline ? `1px solid ${color}` : "none",
        color: outline ? color : "var(--c-on-primary)",
        cursor: loading || disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
      }}
    >
      {loading ? <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} /> : label}
    </button>
  )
}

// ── DetailModal ───────────────────────────────────────────────────────────────

function DetailModal({
  schedule, onClose, onStatusChange, employees,
}: {
  schedule: Schedule
  onClose: () => void
  onStatusChange: (s: Schedule) => void
  employees: Employee[]
}) {
  const router = useRouter()
  const [updating,    setUpdating]    = useState(false)
  const [closingWith, setClosingWith] = useState("")
  const [phase,       setPhase]       = useState<"view" | "close" | "resize" | "edit_services">("view")
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [resizeStart, setResizeStart] = useState("")
  const [resizeDur,   setResizeDur]   = useState("")
  // Editar serviços da comanda aberta (catálogo + seleção)
  const [catalog,     setCatalog]     = useState<{ id: string; name: string; price: number; durationMinutes: number }[]>([])
  const [editServiceIds, setEditServiceIds] = useState<string[]>([])
  const services = serviceNamesOf(schedule) || "—"

  // B05 — ESC fecha + trava o scroll do fundo enquanto o modal está aberto.
  // Com a confirmação de cancelamento aberta, o ESC é tratado por ela (Radix);
  // não fechamos o modal de detalhe pra não fechar os dois de uma vez.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !confirmCancel) onClose() }
    document.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow }
  }, [onClose, confirmCancel])
  const totalDur = totalDurationOf(schedule)

  async function doStatus(status: string) {
    setUpdating(true)
    try {
      const res = await apiPut<{ schedule: Schedule }>(`/schedules/${schedule.id}/status`, { status })
      onStatusChange(res.schedule)
      if (schedule.status === "REQUESTED" && status === "CONFIRMED") toast.success("Solicitação aprovada.")
      else if (schedule.status === "REQUESTED" && status === "CANCELLED") toast.success("Solicitação recusada.")
    } catch { toast.error("Não consegui atualizar o status. Tente de novo.") } finally { setUpdating(false) }
  }

  async function doClose() {
    if (!closingWith) return
    setUpdating(true)
    try {
      const res = await apiPut<{ schedule: Schedule }>(`/schedules/${schedule.id}/close`, { paymentMethod: closingWith })
      onStatusChange(res.schedule)
      onClose()
      // Encaixe: abriu vaga — oferecer encaixar (leva pras Comandas com o modal pré-preenchido).
      promptEncaixe(schedule, (slot) => router.push(encaixeUrl(slot)))
    } catch { toast.error("Não consegui fechar a comanda. Tente de novo.") } finally { setUpdating(false) }
  }

  async function doResize() {
    if (!resizeStart || !resizeDur) return
    setUpdating(true)
    try {
      const d = new Date(schedule.scheduledAt)
      const [hh, mm] = resizeStart.split(":").map(Number)
      const startISO = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh, mm, 0)).toISOString()
      const res = await apiPut<{ schedule: Schedule }>(`/schedules/${schedule.id}/time`, {
        startISO, durationMinutes: Math.max(1, Math.min(1440, Math.floor(Number(resizeDur)) || 1)),
      })
      onStatusChange(res.schedule)
      onClose()
      toast.success("Horário atualizado.")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não consegui atualizar o horário.") } finally { setUpdating(false) }
  }

  // Carrega o catálogo quando entra no modo "editar serviços".
  useEffect(() => {
    if (phase !== "edit_services" || catalog.length > 0) return
    apiGet<{ services: { id: string; name: string; price: number; durationMinutes: number }[] }>("/services")
      .then((r) => setCatalog(r.services ?? []))
      .catch(() => {})
  }, [phase, catalog.length])

  async function doEditServices() {
    if (editServiceIds.length === 0) return
    setUpdating(true)
    try {
      const res = await apiPut<{ schedule: Schedule }>(`/schedules/${schedule.id}/services`, { serviceIds: editServiceIds })
      onStatusChange(res.schedule)
      setPhase("view")
      toast.success("Serviços atualizados.")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não consegui atualizar os serviços.") } finally { setUpdating(false) }
  }

  // Reatribuir profissional sem recriar (PUT /schedules/:id/employee). "" = Proprietário (null).
  async function doReassign(value: string) {
    const employeeId = value || null
    if ((schedule.employeeId ?? null) === employeeId) return
    setUpdating(true)
    try {
      const res = await apiPut<{ schedule: Schedule }>(`/schedules/${schedule.id}/employee`, { employeeId })
      onStatusChange(res.schedule)
      toast.success("Profissional atualizado.")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não consegui trocar o profissional.") } finally { setUpdating(false) }
  }
  // Só dá pra reatribuir comanda ainda aberta e se a loja tem funcionários cadastrados.
  const canReassign = employees.length > 0 && schedule.status !== "DONE" && schedule.status !== "CANCELLED"

  return (
    <div style={{
      // Enquanto a confirmação de cancelamento está aberta, recuamos o z-index
      // deste modal para baixo do ConfirmDialog (Radix usa z-50), garantindo
      // que o diálogo de confirmação fique por cima em qualquer tema.
      position: "fixed", inset: 0, zIndex: confirmCancel ? 40 : 9999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0,
        backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      }} />
      <div role="dialog" aria-modal="true" style={{
        position: "relative", zIndex: 1,
        backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)",
        borderRadius: 20, padding: 24, width: "100%", maxWidth: 420,
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
              {customerName(schedule)}
            </p>
            <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: "3px 0 0" }}>
              {/* ✅ Usar formatScheduleTime em vez de formatTime */}
              {formatScheduleTime(schedule.scheduledAt)}
            </p>
          </div>
          <StatusBadge status={schedule.status} />
        </div>

        {phase === "view" && (
          <>
            <Row label="Telefone"    value={schedule.customer?.phone ?? "—"} />
            <Row label="Serviço"     value={services} />
            <Row label="Duração"     value={`${totalDur}min`} />
            <Row label="Veículo"     value={vehicleSummary(schedule)} />
            {canReassign ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--c-border)" }}>
                <span style={{ fontSize: 13, color: "var(--c-text-3)", flexShrink: 0 }}>Profissional</span>
                <select
                  value={schedule.employeeId ?? ""}
                  disabled={updating}
                  onChange={(e) => doReassign(e.target.value)}
                  aria-label="Trocar profissional"
                  style={{ maxWidth: "62%", height: 34, padding: "0 8px", borderRadius: 9, border: "1px solid var(--c-border-2)", background: "var(--c-surface-2)", color: "var(--c-text)", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: updating ? "not-allowed" : "pointer" }}
                >
                  <option value="">Proprietário</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name ?? "Funcionário"}</option>
                  ))}
                </select>
              </div>
            ) : (
              <Row label="Profissional" value={schedule.employee?.name ?? "Proprietário"} />
            )}
            {schedule.notes && <Row label="Obs" value={schedule.notes} />}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", borderTop: "1px solid var(--c-border)", marginTop: 4 }}>
              <span style={{ fontSize: 13, color: "var(--c-text-3)" }}>Total</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text)" }}>{formatCurrency(schedule.totalPrice)}</span>
            </div>

            {schedule.status === "REQUESTED" && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginTop: 16,
                padding: "10px 12px", borderRadius: 10,
                backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
              }}>
                <Bell size={14} color="#F59E0B" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--c-text-2)" }}>
                  Solicitação da loja pública aguardando sua aprovação.
                </span>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              {schedule.status === "REQUESTED" && (
                <>
                  <ActionBtn label="Aprovar" color="#10B981" onClick={() => doStatus("CONFIRMED")} loading={updating} />
                  <ActionBtn label="Recusar" color="#EF4444" onClick={() => doStatus("CANCELLED")} loading={updating} outline />
                </>
              )}
              {/* Fluxo sequencial alinhado à aba Agendamentos:
                  PENDING → só Confirmar; CONFIRMED → só Iniciar. */}
              {schedule.status === "PENDING" && (
                <ActionBtn label="Confirmar" color="#3B82F6" onClick={() => doStatus("CONFIRMED")} loading={updating} />
              )}
              {schedule.status === "CONFIRMED" && (
                <ActionBtn label="Iniciar" color="#8B5CF6" onClick={() => doStatus("IN_PROGRESS")} loading={updating} />
              )}
              {schedule.status === "IN_PROGRESS" && (
                <ActionBtn label="Finalizar" color="#10B981" onClick={() => setPhase("close")} loading={false} />
              )}
              {(schedule.status === "PENDING" || schedule.status === "CONFIRMED" || schedule.status === "IN_PROGRESS") && (
                <ActionBtn label="Editar serviços" color="#0066FF" onClick={() => {
                  setEditServiceIds((schedule.scheduleServices ?? []).map(ss => ss?.service?.id).filter((x): x is string => !!x))
                  setPhase("edit_services")
                }} loading={false} outline />
              )}
              {(schedule.status === "PENDING" || schedule.status === "CONFIRMED" || schedule.status === "IN_PROGRESS") && (
                <ActionBtn label="Ajustar horário" color="#0066FF" onClick={() => {
                  const d = new Date(schedule.scheduledAt)
                  setResizeStart(`${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`)
                  setResizeDur(String(totalDur))
                  setPhase("resize")
                }} loading={false} outline />
              )}
              {schedule.status !== "REQUESTED" && schedule.status !== "CANCELLED" && schedule.status !== "DONE" && (
                <ActionBtn label="Cancelar" color="#EF4444" onClick={() => setConfirmCancel(true)} loading={updating} outline />
              )}
            </div>
          </>
        )}

        {phase === "close" && (
          <>
            <p style={{ fontSize: 13, color: "var(--c-text-2)", marginBottom: 12 }}>
              Selecione a forma de pagamento:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setClosingWith(m.value)}
                  style={{
                    height: 40, borderRadius: 9, fontSize: 12, fontWeight: 500,
                    background: closingWith === m.value ? "rgba(16,185,129,0.12)" : "transparent",
                    border: closingWith === m.value ? "1px solid #10B981" : "1px solid var(--c-border-2)",
                    color: closingWith === m.value ? "#10B981" : "var(--c-text-3)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <ActionBtn label="← Voltar" color="var(--c-text-4)" onClick={() => setPhase("view")} loading={false} outline />
              <ActionBtn label="Confirmar pagamento" color="#10B981" onClick={doClose} loading={updating} disabled={!closingWith} />
            </div>
          </>
        )}

        {phase === "resize" && (
          <>
            <p style={{ fontSize: 13, color: "var(--c-text-2)", marginBottom: 12 }}>
              Ajuste o início e a duração deste atendimento:
            </p>
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--c-text-3)", display: "block", marginBottom: 6 }}>Início</label>
                <input
                  type="time" value={resizeStart} onChange={(e) => setResizeStart(e.target.value)}
                  style={{ height: 40, borderRadius: 9, fontSize: 13, padding: "0 12px", background: "var(--c-bg)", border: "1px solid var(--c-border-2)", color: "var(--c-text)", fontFamily: "inherit", fontVariantNumeric: "tabular-nums" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--c-text-3)", display: "block", marginBottom: 6 }}>Duração (min)</label>
                <input
                  type="number" min={1} max={1440} value={resizeDur} onChange={(e) => setResizeDur(e.target.value)}
                  style={{ width: 110, height: 40, borderRadius: 9, fontSize: 13, padding: "0 12px", background: "var(--c-bg)", border: "1px solid var(--c-border-2)", color: "var(--c-text)", fontFamily: "inherit", fontVariantNumeric: "tabular-nums", boxSizing: "border-box" as const }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <ActionBtn label="← Voltar" color="var(--c-text-4)" onClick={() => setPhase("view")} loading={false} outline />
              <ActionBtn label="Salvar horário" color="#0066FF" onClick={doResize} loading={updating} disabled={!resizeStart || !resizeDur} />
            </div>
          </>
        )}

        {phase === "edit_services" && (
          <>
            <p style={{ fontSize: 13, color: "var(--c-text-2)", marginBottom: 12 }}>
              Adicione ou remova serviços desta comanda (o total e o tempo se ajustam):
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "46vh", overflowY: "auto", marginBottom: 14 }}>
              {catalog.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--c-text-4)" }}>Carregando serviços…</p>
              )}
              {catalog.map((svc) => {
                const sel = editServiceIds.includes(svc.id)
                return (
                  <button key={svc.id} onClick={() => setEditServiceIds(p => p.includes(svc.id) ? p.filter(x => x !== svc.id) : [...p, svc.id])} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 12px", borderRadius: 9, cursor: "pointer", textAlign: "left",
                    backgroundColor: sel ? "rgba(0,102,255,0.08)" : "var(--c-bg)",
                    border: `1px solid ${sel ? "rgba(0,102,255,0.35)" : "var(--c-border-2)"}`,
                    fontFamily: "inherit",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, backgroundColor: sel ? "#0066FF" : "transparent", border: sel ? "none" : "1px solid var(--c-border-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {sel && <CheckCircle2 size={11} color="white" />}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 13, color: "var(--c-text)", fontWeight: sel ? 600 : 400 }}>{svc.name}</span>
                        <span style={{ fontSize: 11, color: "var(--c-text-4)", fontVariantNumeric: "tabular-nums" }}>{svc.durationMinutes}min</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 13, color: "#10B981", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(svc.price)}</span>
                  </button>
                )
              })}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <ActionBtn label="← Voltar" color="var(--c-text-4)" onClick={() => setPhase("view")} loading={false} outline />
              <ActionBtn label="Salvar serviços" color="#0066FF" onClick={doEditServices} loading={updating} disabled={editServiceIds.length === 0} />
            </div>
          </>
        )}
      </div>

      {/* #35 — confirmação de cancelamento via ConfirmDialog (padrão de ações
          destrutivas do app); substitui o toque-duplo frágil no mobile. */}
      <ConfirmDialog
        open={confirmCancel}
        onClose={() => { if (!updating) setConfirmCancel(false) }}
        onConfirm={async () => { await doStatus("CANCELLED"); setConfirmCancel(false) }}
        title="Cancelar agendamento"
        description={`Cancelar o agendamento de ${customerName(schedule)}? Esta ação não pode ser desfeita.`}
        confirmLabel="Cancelar agendamento"
        cancelLabel="Voltar"
        variant="danger"
        loading={updating}
      />
    </div>
  )
}

// ── Avatar do profissional (funcionário com foto/iniciais, ou dono) ───────────

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function ProfessionalAvatar({ employee }: { employee?: { name: string | null; avatarUrl: string | null } | null }) {
  const [imgOk, setImgOk] = useState(true)
  const base: React.CSSProperties = {
    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 8, fontWeight: 700, color: "#fff", objectFit: "cover",
  }
  const initials = (employee?.name ?? "")
    .split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase()
  // Iniciais como base; a foto cobre por cima e, se falhar (onError), volta pras iniciais.
  return (
    <div style={{ ...base, position: "relative", background: employee ? "linear-gradient(135deg,#0066FF,#7C3AED)" : "var(--c-border-2)" }}>
      {employee ? initials : "•"}
      {employee?.avatarUrl && imgOk && (
        <img src={employee.avatarUrl} alt={employee.name ?? ""} onError={() => setImgOk(false)} style={{ ...base, position: "absolute", inset: 0 }} />
      )}
    </div>
  )
}

// ── ScheduleCard ──────────────────────────────────────────────────────────────

function ScheduleCard({ s, onClick }: { s: Schedule; onClick: () => void }) {
  const color    = STATUS_META[s.status]?.color ?? "var(--c-text-3)"
  const services = serviceNamesOf(s)
  const isRequested = s.status === "REQUESTED"
  const [hov, setHov] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: isRequested ? "rgba(245,158,11,0.07)" : hov ? "var(--c-surface)" : "var(--c-bg)",
        borderTop: `1px solid ${isRequested ? "rgba(245,158,11,0.3)" : hov ? "var(--c-border-2)" : "var(--c-surface-2)"}`,
        borderRight: `1px solid ${isRequested ? "rgba(245,158,11,0.3)" : hov ? "var(--c-border-2)" : "var(--c-surface-2)"}`,
        borderBottom: `1px solid ${isRequested ? "rgba(245,158,11,0.3)" : hov ? "var(--c-border-2)" : "var(--c-surface-2)"}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 12, padding: "12px 14px",
        cursor: "pointer", transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {isRequested && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              fontSize: 9, fontWeight: 700, color: "#F59E0B",
              backgroundColor: "rgba(245,158,11,0.16)", border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: 5, padding: "1px 6px", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.4px",
            }}>
              <Bell size={9} /> Solicitação
            </span>
          )}
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {customerName(s)}
          </p>
          <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {services || "—"}
          </p>
          {/* Quem executa: avatar do funcionário (fallback iniciais) ou chip "Você" (dono).
              Antes mostrava só o nome em texto e nada no caso do proprietário. */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, margin: "5px 0 0" }}>
            <ProfessionalAvatar employee={s.employee} />
            <span style={{ fontSize: 10, color: "var(--c-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.employee?.name ?? "Você"}
            </span>
          </div>
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
            {formatScheduleTime(s.scheduledAt)}
          </p>
          <StatusBadge status={s.status} />
          {s.totalPrice > 0 && (
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-3)", margin: "4px 0 0", fontVariantNumeric: "tabular-nums" }}>
              {money(s.totalPrice)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── NewAgBtn ──────────────────────────────────────────────────────────────────

function NewAgBtn({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        height: 38, padding: "0 16px", borderRadius: 10,
        background: hov ? "#0052CC" : "#0066FF",
        border: "none", color: "var(--c-on-primary)", fontSize: 13, fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s",
      }}
    >
      <Plus size={14} /> Novo agendamento
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AgendaPage() {
  const router = useRouter()

  const [schedules,      setSchedules]      = useState<Schedule[]>([])
  // Vagas livres por dia (GET /schedules/capacity-summary): date → {free,total,open}.
  const [capacity,       setCapacity]       = useState<Record<string, { free: number; total: number; open: boolean }>>({})
  // Token p/ descartar resposta de capacidade fora de ordem (troca rápida de mês/filtro).
  const capReqRef = useRef(0)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [currentMonth,   setCurrentMonth]   = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [selectedDate,   setSelectedDate]   = useState(todayStr)
  const [daySchedules,   setDaySchedules]   = useState<Schedule[]>([])
  const [loadingDay,     setLoadingDay]     = useState(false)
  const [hoveredDay,     setHoveredDay]     = useState<string | null>(null)
  const [employees,      setEmployees]      = useState<Employee[]>([])
  const [selectedEmp,    setSelectedEmp]    = useState<string>("all")
  const [modalSchedule,  setModalSchedule]  = useState<Schedule | null>(null)
  const [isMobile,       setIsMobile]       = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // ── Fetch employees ───────────────────────────────────────────────────────
  useEffect(() => {
    apiGet<{ employees: Employee[] }>("/employees")
      .then(r => setEmployees(r.employees ?? []))
      .catch(() => {})
  }, [])

  // ── Fetch month ───────────────────────────────────────────────────────────
  const fetchMonth = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // Intervalo da grade visível (mês ± margem p/ os dias adjacentes pintados),
      // evita pedir a base inteira do tenant ao backend.
      const y = currentMonth.getFullYear(), m = currentMonth.getMonth()
      const fromD = new Date(y, m, 1 - 7)
      const toD   = new Date(y, m + 1, 7)
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
      const params: Record<string, string> = { from: fmt(fromD), to: fmt(toD) }
      if (selectedEmp !== "all") params.employeeId = selectedEmp
      const res = await apiGet<{ schedules: Schedule[] }>("/schedules", params)
      setSchedules(res.schedules ?? [])
      // Vagas livres por dia — best-effort, não bloqueia a agenda se falhar. Zera antes
      // (some o badge do mês/filtro anterior) e usa um token: se o usuário trocar de mês/
      // filtro antes da resposta chegar, a resposta velha é descartada (não pinta o mês errado).
      const reqId = ++capReqRef.current
      setCapacity({})
      apiGet<{ summary: { date: string; open: boolean; total: number; free: number }[] }>(
        "/schedules/capacity-summary", { from: fmt(fromD), to: fmt(toD) }, // business-wide (não filtra por funcionário)
      ).then((cap) => {
        if (reqId !== capReqRef.current) return // resposta fora de ordem → descarta
        const map: Record<string, { free: number; total: number; open: boolean }> = {}
        for (const d of cap.summary ?? []) map[d.date] = { free: d.free, total: d.total, open: d.open }
        setCapacity(map)
      }).catch(() => { /* sem capacidade → sem badge de vagas */ })
    } catch {
      setError("Erro ao carregar agenda.")
    } finally {
      setLoading(false)
    }
  }, [selectedEmp, currentMonth])

  useEffect(() => { fetchMonth() }, [fetchMonth])

  // ── Fetch day ─────────────────────────────────────────────────────────────
  const fetchDay = useCallback(async (dateStr: string) => {
    setLoadingDay(true)
    try {
      const params: Record<string, string> = { date: dateStr }
      if (selectedEmp !== "all") params.employeeId = selectedEmp
      const res = await apiGet<{ schedules: Schedule[] }>("/schedules", params)
      setDaySchedules(res.schedules ?? [])
    } catch {
      setDaySchedules([])
    } finally {
      setLoadingDay(false)
    }
  }, [selectedEmp])

  useEffect(() => { fetchDay(selectedDate) }, [selectedDate, fetchDay])

  // Tempo real: qualquer mudança de agendamento (criar/atualizar/fechar/cancelar) em
  // QUALQUER tela (Pátio/Comanda) ou por outro usuário re-sincroniza o Calendário na
  // hora — antes as 3 telas viviam dessincronizadas (faziam fetch isolado, sem SSE).
  // Debounce ~400ms: uma rajada de eventos SCHEDULE coalesce num único refetch.
  const sseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useNotificationsSSE(useCallback((data: Record<string, unknown>) => {
    if (typeof data.type === "string" && data.type.startsWith("SCHEDULE")) {
      if (sseTimer.current) clearTimeout(sseTimer.current)
      sseTimer.current = setTimeout(() => { fetchMonth(); fetchDay(selectedDate) }, 400)
    }
  }, [fetchMonth, fetchDay, selectedDate]))

  // Quando um status muda no modal, atualiza as listas
  function handleStatusChange(updated: Schedule) {
    setModalSchedule(updated)
    setDaySchedules(prev => prev.map(s => s.id === updated.id ? updated : s))
    setSchedules(prev => prev.map(s => s.id === updated.id ? updated : s))
  }

  const calDays = buildCalendarDays(currentMonth, schedules, selectedDate)

  const requestedCount = daySchedules.filter(s => s.status === "REQUESTED").length
  const confirmedCount = daySchedules.filter(s => s.status === "CONFIRMED").length

  // Resumo do dia: receita já paga + quantos agendamentos por profissional (você vs
  // cada funcionário) — o dono pediu esse "resumo embaixo" pra bater o olho.
  const daySummary = (() => {
    const realizados = daySchedules.filter(s => s.status !== "CANCELLED")
    const receitaPaga = daySchedules
      .filter(s => s.status === "DONE")  // DONE = comanda fechada/paga
      .reduce((sum, s) => sum + (s.totalPrice ?? 0), 0)
    const porProfissional = new Map<string, number>()
    for (const s of realizados) {
      const nome = s.employee?.name ?? "Você"
      porProfissional.set(nome, (porProfissional.get(nome) ?? 0) + 1)
    }
    return { receitaPaga, porProfissional: [...porProfissional.entries()], totalRealizados: realizados.length }
  })()

  function empBtnStyle(active: boolean): React.CSSProperties {
    return {
      height: 30, padding: "0 12px", borderRadius: 8, fontSize: 12,
      fontWeight: active ? 600 : 400, cursor: "pointer", fontFamily: "inherit",
      border: active ? "1px solid rgba(0,102,255,0.4)" : "1px solid var(--c-border)",
      background: active ? "rgba(0,102,255,0.1)" : "transparent",
      color: active ? "#3B82F6" : "var(--c-text-3)",
      transition: "all 0.15s",
    }
  }

  return (
    <>
      <style>{`
        @keyframes fadeAg       { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes skeletonPulse{ 0%,100%{opacity:0.4} 50%{opacity:0.9} }
        @keyframes spin         { to{transform:rotate(360deg)} }
        .ag-card:hover  { background:var(--c-surface)!important; border-color:var(--c-border-2)!important; }
        .ag-day:hover   { background:var(--c-surface-2)!important; }
        .ag-empty-create:hover { background:rgba(0,102,255,0.14)!important; }
        .day-list::-webkit-scrollbar      { width:4px; }
        .day-list::-webkit-scrollbar-thumb{ background:var(--c-border-2); border-radius:2px; }
        * { box-sizing:border-box; }
      `}</style>

      <div style={{
        maxWidth: 1280, margin: "0 auto",
        padding: isMobile ? "16px 14px" : undefined,
        fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
        animation: "fadeAg 0.3s ease",
      }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "flex-start", flexWrap: "wrap", gap: isMobile ? 12 : 16, marginBottom: 20, flexDirection: isMobile ? "column" : "row" }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>Calendário</h1>
            <p style={{ fontSize: 14, color: "var(--c-text-3)", marginTop: 6 }}>Visualize e gerencie seus agendamentos</p>
          </div>
          <NewAgBtn onClick={() => router.push("/dashboard/agendamentos")} />
        </div>

        <TabTutorial
          tabKey="agenda"
          title="Como usar a Agenda"
          subtitle="Seus horários no controle"
          steps={[
            { icon: Calendar, title: "1. Veja o seu dia", text: "A agenda mostra todos os agendamentos do dia. Toque num horário pra abrir os detalhes do atendimento." },
            { icon: Clock, title: "2. Configure seus horários", text: "Na aba Horários, defina os dias e as horas em que sua loja atende. O cliente só consegue agendar dentro disso." },
            { icon: Plus, title: "3. Agende na hora", text: "Recebeu um cliente pelo telefone? Crie o agendamento manualmente escolhendo o serviço e um horário livre." },
          ]}
        />

        {/* ── SELETOR DE FUNCIONÁRIO ── */}
        {employees.length > 0 && (
          <div ref={filterRef} style={{
            display: "flex", gap: 6, flexWrap: "wrap",
            marginBottom: 20, padding: "10px 14px",
            backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12,
          }}>
            <button style={empBtnStyle(selectedEmp === "all")}   onClick={() => setSelectedEmp("all")}>Todos</button>
            <button style={empBtnStyle(selectedEmp === "owner")} onClick={() => setSelectedEmp("owner")}>
              <User size={11} style={{ marginRight: 4 }} />Proprietário
            </button>
            {employees.map(e => (
              <button key={e.id} style={empBtnStyle(selectedEmp === e.id)} onClick={() => setSelectedEmp(e.id)}>
                {e.name}
              </button>
            ))}
          </div>
        )}

        {!loading && error && (
          <div style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <AlertCircle size={14} color="#EF4444" />
            <span style={{ fontSize: 13, color: "#EF4444" }}>{error}</span>
            <button onClick={fetchMonth} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 8, background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              <RefreshCw size={13} /> Tentar novamente
            </button>
          </div>
        )}

        {/* ── GRID: CALENDÁRIO + PAINEL DO DIA ── */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 20, alignItems: "start" }}>

          {/* ── CALENDÁRIO ── */}
          <div style={{ backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 20, overflow: "hidden" }}>

            {/* Header do mês */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 12px" }}>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()-1, 1))}
                style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "var(--c-surface-2)", border: "1px solid var(--c-border)", color: "var(--c-text-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronLeft size={16} />
              </button>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
                {formatMonthYear(currentMonth)}
              </p>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()+1, 1))}
                style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "var(--c-surface-2)", border: "1px solid var(--c-border)", color: "var(--c-text-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Cabeçalho dias da semana */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid var(--c-border)" }}>
              {WEEKDAYS.map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--c-text-4)", letterSpacing: "0.5px", padding: "10px 0" }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Grid de dias */}
            {loading ? (
              <div style={{ padding: "8px 12px 16px" }}><CalSkeleton /></div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
                {calDays.map((day, i) => {
                  const isSel  = day.dateStr === selectedDate
                  const isHov  = hoveredDay === day.dateStr

                  return (
                    <div
                      key={i}
                      className="ag-day"
                      onClick={() => day.isCurrentMonth && setSelectedDate(day.dateStr)}
                      onMouseEnter={() => day.isCurrentMonth && setHoveredDay(day.dateStr)}
                      onMouseLeave={() => setHoveredDay(null)}
                      style={{
                        minHeight: isMobile ? 48 : 72, padding: isMobile ? "6px 3px 3px" : "8px 6px 6px",
                        borderBottom: "1px solid var(--c-surface)",
                        borderRight: (i + 1) % 7 === 0 ? "none" : "1px solid var(--c-surface)",
                        backgroundColor: isSel ? "var(--c-surface-2)" : isHov ? "var(--c-surface-2)" : "transparent",
                        cursor: day.isCurrentMonth ? "pointer" : "default",
                        transition: "background 0.12s",
                      }}
                    >
                      <div style={{
                        width: 26, height: 26, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: day.isToday || isSel ? 700 : 400,
                        color: !day.isCurrentMonth ? "var(--c-border)" : day.isToday && !isSel ? "var(--c-text)" : day.isToday ? "var(--c-text)" : isSel ? "#0066FF" : "var(--c-text-2)",
                        backgroundColor: day.isToday && !isSel ? "#0066FF" : isSel ? "rgba(0,102,255,0.1)" : "transparent",
                        marginBottom: 4, flexShrink: 0,
                      }}>
                        {day.date.getDate()}
                      </div>

                      {/* Vagas livres reais do dia (GET /schedules/capacity-summary): o dono
                          bate o olho e vê quanto ainda cabe. Verde=folga, âmbar=apertado, vermelho=cheio. */}
                      {day.isCurrentMonth && (() => {
                        const cap = capacity[day.dateStr]
                        if (!cap || !cap.open || cap.total === 0) return null
                        const ratio = cap.free / cap.total
                        const cor = cap.free === 0 ? "#DC2626" : ratio <= 0.34 ? "#D97706" : "#16A34A"
                        return (
                          <div
                            title={`${cap.free} de ${cap.total} horários livres`}
                            style={{ fontSize: 9, fontWeight: 700, color: cor, lineHeight: 1.2, marginBottom: 4, whiteSpace: "nowrap" }}
                          >
                            {cap.free === 0 ? "cheio" : `${cap.free} ${cap.free === 1 ? "vaga" : "vagas"}`}
                          </div>
                        )
                      })()}

                      {day.isCurrentMonth && day.schedules.length > 0 && !isMobile && day.schedules.length <= 2 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {day.schedules.map(s => {
                            const c = STATUS_META[s.status]?.color ?? "var(--c-text-3)"
                            return (
                              <div key={s.id} style={{
                                backgroundColor: `${c}14`, border: `1px solid ${c}30`,
                                borderRadius: 4, padding: "1px 4px",
                                fontSize: 9, color: c,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>
                                {/* ✅ Usar formatScheduleTime */}
                                {formatScheduleTime(s.scheduledAt)} {firstName(s)}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {day.isCurrentMonth && day.schedules.length > 2 && !isMobile && (
                        <div style={{
                          fontSize: 9, color: "#0066FF",
                          backgroundColor: "rgba(0,102,255,0.1)",
                          border: "1px solid rgba(0,102,255,0.2)",
                          borderRadius: 4, padding: "2px 5px", display: "inline-block",
                        }}>
                          +{day.schedules.length}
                        </div>
                      )}

                      {/* Mobile: dot indicator */}
                      {day.isCurrentMonth && day.schedules.length > 0 && isMobile && (
                        <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 2 }}>
                          {day.schedules.slice(0, 3).map((s, idx) => (
                            <div key={idx} style={{
                              width: 5, height: 5, borderRadius: "50%",
                              backgroundColor: STATUS_META[s.status]?.color ?? "var(--c-text-3)",
                            }} />
                          ))}
                          {day.schedules.length > 3 && (
                            <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "var(--c-text-4)" }} />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── PAINEL DO DIA ── */}
          <div style={{ backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 20, padding: isMobile ? 16 : 20, position: isMobile ? "relative" : "sticky", top: isMobile ? undefined : 24 }}>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
                {formatDayHeader(selectedDate)}
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: 0 }}>
                  {loadingDay ? "Carregando..." : `${daySchedules.length} agendamento${daySchedules.length !== 1 ? "s" : ""}`}
                </p>
                {selectedDate === todayStr() && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#0066FF", backgroundColor: "rgba(0,102,255,0.1)", border: "1px solid rgba(0,102,255,0.2)", borderRadius: 6, padding: "2px 8px" }}>
                    Hoje
                  </span>
                )}
              </div>
              {!loadingDay && daySchedules.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {requestedCount > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Bell size={10} /> {requestedCount} solicitaç{requestedCount !== 1 ? "ões" : "ão"}
                    </span>
                  )}
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#3B82F6", backgroundColor: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 6, padding: "2px 8px" }}>
                    {confirmedCount} confirmado{confirmedCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}

              {/* Resumo do dia: receita fechada + agendamentos por profissional */}
              {!loadingDay && daySummary.totalRealizados > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--c-border)", display: "flex", flexDirection: "column", gap: 6 }}>
                  {daySummary.receitaPaga > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "var(--c-text-3)" }}>Receita fechada</span>
                      <span style={{ color: "#10B981", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{money(daySummary.receitaPaga)}</span>
                    </div>
                  )}
                  {daySummary.porProfissional.map(([nome, qtd]) => (
                    <div key={nome} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "var(--c-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</span>
                      <span style={{ color: "var(--c-text-2)", fontWeight: 600 }}>{qtd} agend.</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Skeleton day */}
            {loadingDay && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ backgroundColor: "var(--c-surface-2)", borderRadius: 12, padding: "14px 16px", animation: `skeletonPulse 1.4s ease ${i * 0.1}s infinite` }}>
                    <div style={{ height: 12, width: "60%", backgroundColor: "var(--c-border)", borderRadius: 4 }} />
                    <div style={{ height: 10, width: "40%", backgroundColor: "var(--c-border)", borderRadius: 4, marginTop: 8 }} />
                  </div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!loadingDay && daySchedules.length === 0 && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <Calendar size={36} color="var(--c-border)" style={{ display: "block", margin: "0 auto" }} />
                <p style={{ fontSize: 13, color: "var(--c-text-4)", marginTop: 12, marginBottom: 4 }}>
                  Sem agendamentos
                </p>
                <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: 0 }}>neste dia</p>
                <button
                  className="ag-empty-create"
                  onClick={() => router.push("/dashboard/agendamentos")}
                  style={{
                    marginTop: 16, width: "100%", height: 36,
                    backgroundColor: "rgba(0,102,255,0.08)",
                    border: "1px solid rgba(0,102,255,0.15)",
                    color: "#0066FF", fontSize: 12, fontWeight: 600,
                    borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                    transition: "background 0.15s",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  <Plus size={13} /> Criar agendamento
                </button>
              </div>
            )}

            {/* Lista do dia */}
            {!loadingDay && daySchedules.length > 0 && (
              <div className="day-list" style={{
                display: "flex", flexDirection: "column", gap: 8,
                maxHeight: "calc(100vh - 380px)", overflowY: "auto", paddingRight: 2,
              }}>
                {[...daySchedules]
                  .sort((a, b) => {
                    // Solicitações primeiro (precisam de ação do dono), depois por horário
                    const ra = a.status === "REQUESTED" ? 0 : 1
                    const rb = b.status === "REQUESTED" ? 0 : 1
                    if (ra !== rb) return ra - rb
                    return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
                  })
                  .map(s => (
                    <CardErrorBoundary key={s.id}>
                      <ScheduleCard s={s} onClick={() => setModalSchedule(s)} />
                    </CardErrorBoundary>
                  ))}
              </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--c-surface-2)" }}>
              <button
                onClick={() => router.push("/dashboard/agendamentos")}
                style={{
                  width: "100%", height: 34, borderRadius: 9,
                  backgroundColor: "transparent",
                  border: "1px solid var(--c-border)", color: "var(--c-text-4)",
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--c-text)"; e.currentTarget.style.borderColor = "var(--c-border-2)" }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--c-text-4)"; e.currentTarget.style.borderColor = "var(--c-border)" }}
              >
                Ver todos <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL ── */}
      {modalSchedule && (
        <CardErrorBoundary key={modalSchedule.id}>
          <DetailModal
            schedule={modalSchedule}
            onClose={() => setModalSchedule(null)}
            onStatusChange={handleStatusChange}
            employees={employees}
          />
        </CardErrorBoundary>
      )}
    </>
  )
}