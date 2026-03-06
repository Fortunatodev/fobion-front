"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft, ChevronRight, Plus, Calendar,
  AlertCircle, User, Clock, CheckCircle2, XCircle,
  Loader2, ArrowRight,
} from "lucide-react"
import { apiGet, apiPut } from "@/lib/api"
import { formatScheduleTime, formatScheduleDate } from "@/lib/dateUtils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Schedule {
  id:           string
  scheduledAt:  string
  status:       string
  totalPrice:   number
  notes?:       string | null
  paymentMethod: string
  customer:     { id: string; name: string; phone: string }
  vehicle:      { plate: string; brand: string; model: string; color: string }
  scheduleServices: { service: { name: string; durationMinutes: number } }[]
  employee?:    { id: string; name: string; avatarUrl: string | null } | null
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
  PENDING:     { label: "Pendente",     color: "#F59E0B", icon: <Clock    size={10} /> },
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
          height: 36, borderRadius: 8, backgroundColor: "#111",
          animation: `skeletonPulse 1.4s ease ${(i % 7) * 0.06}s infinite`,
        }} />
      ))}
    </div>
  )
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: "#71717A", icon: null }
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
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid #111" }}>
      <span style={{ fontSize: 13, color: "#71717A" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#E5E7EB", fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{value}</span>
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
        color: outline ? color : "#fff",
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
  schedule, onClose, onStatusChange,
}: {
  schedule: Schedule
  onClose: () => void
  onStatusChange: (s: Schedule) => void
}) {
  const [updating,    setUpdating]    = useState(false)
  const [closingWith, setClosingWith] = useState("")
  const [phase,       setPhase]       = useState<"view" | "close">("view")
  const services = schedule.scheduleServices.map(ss => ss.service.name).join(", ")
  const totalDur = schedule.scheduleServices.reduce((a, ss) => a + ss.service.durationMinutes, 0)

  async function doStatus(status: string) {
    setUpdating(true)
    try {
      const res = await apiPut<{ schedule: Schedule }>(`/schedules/${schedule.id}/status`, { status })
      onStatusChange(res.schedule)
    } catch { /* silently */ } finally { setUpdating(false) }
  }

  async function doClose() {
    if (!closingWith) return
    setUpdating(true)
    try {
      const res = await apiPut<{ schedule: Schedule }>(`/schedules/${schedule.id}/close`, { paymentMethod: closingWith })
      onStatusChange(res.schedule)
      onClose()
    } catch { /* silently */ } finally { setUpdating(false) }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0,
        backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      }} />
      <div style={{
        position: "relative", zIndex: 1,
        backgroundColor: "#111", border: "1px solid #1F1F1F",
        borderRadius: 20, padding: 24, width: "100%", maxWidth: 420,
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>
              {schedule.customer.name}
            </p>
            <p style={{ fontSize: 12, color: "#52525B", margin: "3px 0 0" }}>
              {/* ✅ Usar formatScheduleTime em vez de formatTime */}
              {formatScheduleTime(schedule.scheduledAt)}
            </p>
          </div>
          <StatusBadge status={schedule.status} />
        </div>

        {phase === "view" && (
          <>
            <Row label="Telefone"    value={schedule.customer.phone} />
            <Row label="Serviço"     value={services} />
            <Row label="Duração"     value={`${totalDur}min`} />
            <Row label="Veículo"     value={`${schedule.vehicle.brand} ${schedule.vehicle.model} · ${schedule.vehicle.plate}`} />
            <Row label="Profissional" value={schedule.employee?.name ?? "Proprietário"} />
            {schedule.notes && <Row label="Obs" value={schedule.notes} />}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", borderTop: "1px solid #1A1A1A", marginTop: 4 }}>
              <span style={{ fontSize: 13, color: "#71717A" }}>Total</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{formatCurrency(schedule.totalPrice)}</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              {schedule.status === "PENDING" && (
                <ActionBtn label="Confirmar" color="#3B82F6" onClick={() => doStatus("CONFIRMED")} loading={updating} />
              )}
              {(schedule.status === "PENDING" || schedule.status === "CONFIRMED") && (
                <ActionBtn label="Iniciar" color="#8B5CF6" onClick={() => doStatus("IN_PROGRESS")} loading={updating} />
              )}
              {schedule.status === "IN_PROGRESS" && (
                <ActionBtn label="Finalizar" color="#10B981" onClick={() => setPhase("close")} loading={false} />
              )}
              {schedule.status !== "CANCELLED" && schedule.status !== "DONE" && (
                <ActionBtn label="Cancelar" color="#EF4444" onClick={() => doStatus("CANCELLED")} loading={updating} outline />
              )}
            </div>
          </>
        )}

        {phase === "close" && (
          <>
            <p style={{ fontSize: 13, color: "#E5E7EB", marginBottom: 12 }}>
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
                    border: closingWith === m.value ? "1px solid #10B981" : "1px solid #252525",
                    color: closingWith === m.value ? "#10B981" : "#71717A",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <ActionBtn label="← Voltar" color="#52525B" onClick={() => setPhase("view")} loading={false} outline />
              <ActionBtn label="Confirmar pagamento" color="#10B981" onClick={doClose} loading={updating} disabled={!closingWith} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── ScheduleCard ──────────────────────────────────────────────────────────────

function ScheduleCard({ s, onClick }: { s: Schedule; onClick: () => void }) {
  const color    = STATUS_META[s.status]?.color ?? "#71717A"
  const services = s.scheduleServices.map(ss => ss.service.name).join(", ")
  const [hov, setHov] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: hov ? "#121212" : "#0A0A0A",
        borderTop: `1px solid ${hov ? "#222" : "#161616"}`,
        borderRight: `1px solid ${hov ? "#222" : "#161616"}`,
        borderBottom: `1px solid ${hov ? "#222" : "#161616"}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 12, padding: "12px 14px",
        cursor: "pointer", transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {s.customer.name}
          </p>
          <p style={{ fontSize: 11, color: "#52525B", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {services}
          </p>
          {s.employee && (
            <p style={{ fontSize: 10, color: "#3F3F46", margin: "2px 0 0" }}>
              {s.employee.name}
            </p>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>
            {/* ✅ Usar formatScheduleTime */}
            {formatScheduleTime(s.scheduledAt)}
          </p>
          <StatusBadge status={s.status} />
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
        border: "none", color: "#fff", fontSize: 13, fontWeight: 600,
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
      const params: Record<string, string> = {}
      if (selectedEmp !== "all")   params.employeeId = selectedEmp
      if (selectedEmp === "owner") params.employeeId = "owner"
      const res = await apiGet<{ schedules: Schedule[] }>("/schedules", params)
      setSchedules(res.schedules ?? [])
    } catch {
      setError("Erro ao carregar agenda.")
    } finally {
      setLoading(false)
    }
  }, [selectedEmp])

  useEffect(() => { fetchMonth() }, [fetchMonth, currentMonth])

  // ── Fetch day ─────────────────────────────────────────────────────────────
  const fetchDay = useCallback(async (dateStr: string) => {
    setLoadingDay(true)
    try {
      const params: Record<string, string> = { date: dateStr }
      if (selectedEmp !== "all")   params.employeeId = selectedEmp
      if (selectedEmp === "owner") params.employeeId = "owner"
      const res = await apiGet<{ schedules: Schedule[] }>("/schedules", params)
      setDaySchedules(res.schedules ?? [])
    } catch {
      setDaySchedules([])
    } finally {
      setLoadingDay(false)
    }
  }, [selectedEmp])

  useEffect(() => { fetchDay(selectedDate) }, [selectedDate, fetchDay])

  // Quando um status muda no modal, atualiza as listas
  function handleStatusChange(updated: Schedule) {
    setModalSchedule(updated)
    setDaySchedules(prev => prev.map(s => s.id === updated.id ? updated : s))
    setSchedules(prev => prev.map(s => s.id === updated.id ? updated : s))
  }

  const calDays = buildCalendarDays(currentMonth, schedules, selectedDate)

  function empBtnStyle(active: boolean): React.CSSProperties {
    return {
      height: 30, padding: "0 12px", borderRadius: 8, fontSize: 12,
      fontWeight: active ? 600 : 400, cursor: "pointer", fontFamily: "inherit",
      border: active ? "1px solid rgba(0,102,255,0.4)" : "1px solid #1F1F1F",
      background: active ? "rgba(0,102,255,0.1)" : "transparent",
      color: active ? "#3B82F6" : "#71717A",
      transition: "all 0.15s",
    }
  }

  return (
    <>
      <style>{`
        @keyframes fadeAg       { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes skeletonPulse{ 0%,100%{opacity:0.4} 50%{opacity:0.9} }
        @keyframes spin         { to{transform:rotate(360deg)} }
        .ag-card:hover  { background:#121212!important; border-color:#222!important; }
        .ag-day:hover   { background:#161616!important; }
        .ag-empty-create:hover { background:rgba(0,102,255,0.14)!important; }
        .day-list::-webkit-scrollbar      { width:4px; }
        .day-list::-webkit-scrollbar-thumb{ background:#252525; border-radius:2px; }
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
            <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>Agenda</h1>
            <p style={{ fontSize: 14, color: "#71717A", marginTop: 6 }}>Visualize e gerencie seus agendamentos</p>
          </div>
          <NewAgBtn onClick={() => router.push("/dashboard/agendamentos")} />
        </div>

        {/* ── SELETOR DE FUNCIONÁRIO ── */}
        {employees.length > 0 && (
          <div ref={filterRef} style={{
            display: "flex", gap: 6, flexWrap: "wrap",
            marginBottom: 20, padding: "10px 14px",
            backgroundColor: "#111", border: "1px solid #1F1F1F", borderRadius: 12,
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

        {error && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", backgroundColor: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
            <AlertCircle size={14} color="#EF4444" />
            <span style={{ fontSize: 13, color: "#EF4444" }}>{error}</span>
          </div>
        )}

        {/* ── GRID: CALENDÁRIO + PAINEL DO DIA ── */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 20, alignItems: "start" }}>

          {/* ── CALENDÁRIO ── */}
          <div style={{ backgroundColor: "#111", border: "1px solid #1F1F1F", borderRadius: 20, overflow: "hidden" }}>

            {/* Header do mês */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 12px" }}>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()-1, 1))}
                style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#161616", border: "1px solid #1F1F1F", color: "#A1A1AA", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronLeft size={16} />
              </button>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>
                {formatMonthYear(currentMonth)}
              </p>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()+1, 1))}
                style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#161616", border: "1px solid #1F1F1F", color: "#A1A1AA", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Cabeçalho dias da semana */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid #1A1A1A" }}>
              {WEEKDAYS.map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#3F3F46", letterSpacing: "0.5px", padding: "10px 0" }}>
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
                        borderBottom: "1px solid #111",
                        borderRight: (i + 1) % 7 === 0 ? "none" : "1px solid #111",
                        backgroundColor: isSel ? "#161616" : isHov ? "#131313" : "transparent",
                        cursor: day.isCurrentMonth ? "pointer" : "default",
                        transition: "background 0.12s",
                      }}
                    >
                      <div style={{
                        width: 26, height: 26, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: day.isToday || isSel ? 700 : 400,
                        color: !day.isCurrentMonth ? "#1F1F1F" : day.isToday && !isSel ? "#fff" : day.isToday ? "#fff" : isSel ? "#0066FF" : "#A1A1AA",
                        backgroundColor: day.isToday && !isSel ? "#0066FF" : isSel ? "rgba(0,102,255,0.1)" : "transparent",
                        marginBottom: 4, flexShrink: 0,
                      }}>
                        {day.date.getDate()}
                      </div>

                      {day.isCurrentMonth && day.schedules.length > 0 && !isMobile && day.schedules.length <= 2 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {day.schedules.map(s => {
                            const c = STATUS_META[s.status]?.color ?? "#71717A"
                            return (
                              <div key={s.id} style={{
                                backgroundColor: `${c}14`, border: `1px solid ${c}30`,
                                borderRadius: 4, padding: "1px 4px",
                                fontSize: 9, color: c,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>
                                {/* ✅ Usar formatScheduleTime */}
                                {formatScheduleTime(s.scheduledAt)} {s.customer.name.split(" ")[0]}
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
                              backgroundColor: STATUS_META[s.status]?.color ?? "#71717A",
                            }} />
                          ))}
                          {day.schedules.length > 3 && (
                            <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#52525B" }} />
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
          <div style={{ backgroundColor: "#111", border: "1px solid #1F1F1F", borderRadius: 20, padding: isMobile ? 16 : 20, position: isMobile ? "relative" : "sticky", top: isMobile ? undefined : 24 }}>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>
                {formatDayHeader(selectedDate)}
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <p style={{ fontSize: 12, color: "#71717A", margin: 0 }}>
                  {loadingDay ? "Carregando..." : `${daySchedules.length} agendamento${daySchedules.length !== 1 ? "s" : ""}`}
                </p>
                {selectedDate === todayStr() && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#0066FF", backgroundColor: "rgba(0,102,255,0.1)", border: "1px solid rgba(0,102,255,0.2)", borderRadius: 6, padding: "2px 8px" }}>
                    Hoje
                  </span>
                )}
              </div>
            </div>

            {/* Skeleton day */}
            {loadingDay && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ backgroundColor: "#161616", borderRadius: 12, padding: "14px 16px", animation: `skeletonPulse 1.4s ease ${i * 0.1}s infinite` }}>
                    <div style={{ height: 12, width: "60%", backgroundColor: "#1F1F1F", borderRadius: 4 }} />
                    <div style={{ height: 10, width: "40%", backgroundColor: "#1A1A1A", borderRadius: 4, marginTop: 8 }} />
                  </div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!loadingDay && daySchedules.length === 0 && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <Calendar size={36} color="#1F1F1F" style={{ display: "block", margin: "0 auto" }} />
                <p style={{ fontSize: 13, color: "#52525B", marginTop: 12, marginBottom: 4 }}>
                  Sem agendamentos
                </p>
                <p style={{ fontSize: 12, color: "#3F3F46", margin: 0 }}>neste dia</p>
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
                  .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                  .map(s => (
                    <ScheduleCard key={s.id} s={s} onClick={() => setModalSchedule(s)} />
                  ))}
              </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #161616" }}>
              <button
                onClick={() => router.push("/dashboard/agendamentos")}
                style={{
                  width: "100%", height: 34, borderRadius: 9,
                  backgroundColor: "transparent",
                  border: "1px solid #1F1F1F", color: "#52525B",
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#2A2A2A" }}
                onMouseLeave={e => { e.currentTarget.style.color = "#52525B"; e.currentTarget.style.borderColor = "#1F1F1F" }}
              >
                Ver todos <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL ── */}
      {modalSchedule && (
        <DetailModal
          schedule={modalSchedule}
          onClose={() => setModalSchedule(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </>
  )
}