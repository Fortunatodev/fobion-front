"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft, ChevronRight, Plus,
  Calendar, Car, AlertCircle,
} from "lucide-react"
import { apiGet } from "@/lib/api"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Schedule {
  id:          string
  scheduledAt: string
  status:      string
  totalPrice:  number
  customer:    { name: string }
  vehicle:     { plate: string; brand: string; model: string }
  scheduleServices: { service: { name: string } }[]
  employee?:   { id: string; name: string; avatarUrl: string | null } | null
}

interface DayData {
  date:           Date
  dateStr:        string
  isCurrentMonth: boolean
  isToday:        boolean
  isSelected:     boolean
  schedules:      Schedule[]
}

interface Employee {
  id:        string
  name:      string
  avatarUrl: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split("T")[0]
}

function getStatusColor(status: string): string {
  switch (status) {
    case "PENDING":     return "#F59E0B"
    case "CONFIRMED":   return "#3B82F6"
    case "IN_PROGRESS": return "#8B5CF6"
    case "DONE":        return "#10B981"
    case "CANCELLED":   return "#EF4444"
    default:            return "#71717A"
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":     return "Pendente"
    case "CONFIRMED":   return "Confirmado"
    case "IN_PROGRESS": return "Em andamento"
    case "DONE":        return "Concluído"
    case "CANCELLED":   return "Cancelado"
    default:            return status
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
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
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
    .replace(/^\w/, c => c.toUpperCase())
}

function buildCalendarDays(month: Date, schedules: Schedule[], selectedDate: string): DayData[] {
  const today    = todayStr()
  const year     = month.getFullYear()
  const mon      = month.getMonth()
  const firstDay = new Date(year, mon, 1).getDay()
  const lastDay  = new Date(year, mon + 1, 0).getDate()

  const days: DayData[] = []

  // dias do mês anterior
  for (let i = firstDay - 1; i >= 0; i--) {
    const d    = new Date(year, mon, -i)
    const dStr = d.toISOString().split("T")[0]
    days.push({ date: d, dateStr: dStr, isCurrentMonth: false, isToday: false, isSelected: false, schedules: [] })
  }

  // dias do mês atual
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, mon, d)
    const dStr = date.toISOString().split("T")[0]
    days.push({
      date,
      dateStr:        dStr,
      isCurrentMonth: true,
      isToday:        dStr === today,
      isSelected:     dStr === selectedDate,
      schedules:      schedules.filter(s => s.scheduledAt.startsWith(dStr)),
    })
  }

  // completar grid 42 células
  while (days.length < 42) {
    const d    = new Date(year, mon + 1, days.length - firstDay - lastDay + 1)
    const dStr = d.toISOString().split("T")[0]
    days.push({ date: d, dateStr: dStr, isCurrentMonth: false, isToday: false, isSelected: false, schedules: [] })
  }

  return days
}

// ── Calendar grid skeleton ────────────────────────────────────────────────────

function CalendarGridSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
      {Array.from({ length: 42 }).map((_, i) => (
        <div key={i} style={{
          minHeight: 80, padding: 8,
          borderRight: "1px solid #1A1A1A",
          borderBottom: "1px solid #1A1A1A",
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            backgroundColor: i % 11 === 0 ? "#1F1F1F" : "#161616",
            animation: `skeletonPulse 1.5s ease ${(i % 7) * 0.07}s infinite`,
            marginBottom: 6,
          }} />
          {(i === 3 || i === 8 || i === 15 || i === 22 || i === 30) && (
            <div style={{
              height: 14, borderRadius: 4,
              backgroundColor: "#161616",
              animation: `skeletonPulse 1.5s ease ${(i % 7) * 0.07}s infinite`,
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AgendaPage() {
  const router = useRouter()

  const [schedules,        setSchedules]        = useState<Schedule[]>([])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState<string | null>(null)
  const [currentMonth,     setCurrentMonth]     = useState(() => {
    const d = new Date(); d.setDate(1); return d
  })
  const [selectedDate,     setSelectedDate]     = useState(todayStr)
  const [daySchedules,     setDaySchedules]     = useState<Schedule[]>([])
  const [loadingDay,       setLoadingDay]       = useState(false)
  const [hoveredDay,       setHoveredDay]       = useState<string | null>(null)

  // ── Funcionários ──────────────────────────────────────────────────────────
  const [employees,         setEmployees]         = useState<Employee[]>([])
  const [selectedEmployee,  setSelectedEmployee]  = useState<string>("all")

  // ── Fetch employees ───────────────────────────────────────────────────────
  useEffect(() => {
    apiGet<{ employees: Employee[] }>("/employees")
      .then(res => setEmployees(res.employees ?? []))
      .catch(() => setEmployees([]))
  }, [])

  // ── Fetch month schedules ─────────────────────────────────────────────────
  const fetchMonthSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedEmployee !== "all") params.set("employeeId", selectedEmployee)
      const query = params.toString() ? `?${params}` : ""
      const res = await apiGet<{ schedules: Schedule[] }>(`/schedules${query}`)
      setSchedules(res.schedules ?? [])
      setError(null)
    } catch {
      setError("Erro ao carregar agenda.")
    } finally {
      setLoading(false)
    }
  }, [selectedEmployee])

  useEffect(() => { fetchMonthSchedules() }, [fetchMonthSchedules, currentMonth])

  // ── Fetch day schedules ───────────────────────────────────────────────────
  const fetchDaySchedules = useCallback(async (dateStr: string) => {
    setLoadingDay(true)
    try {
      const params = new URLSearchParams({ date: dateStr })
      if (selectedEmployee !== "all") params.set("employeeId", selectedEmployee)
      const res = await apiGet<{ schedules: Schedule[] }>(`/schedules?${params}`)
      setDaySchedules(res.schedules ?? [])
    } catch {
      setDaySchedules([])
    } finally {
      setLoadingDay(false)
    }
  }, [selectedEmployee])

  useEffect(() => { fetchDaySchedules(selectedDate) }, [selectedDate, fetchDaySchedules])

  function handleSelectDay(dateStr: string) {
    setSelectedDate(dateStr)
  }

  function prevMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }
  function nextMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const calDays   = buildCalendarDays(currentMonth, schedules, selectedDate)
  const WEEKDAYS  = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

  // ── Estilos de botão do seletor ───────────────────────────────────────────
  function empBtnStyle(active: boolean): React.CSSProperties {
    return {
      height: 34, padding: "0 14px", borderRadius: 10,
      fontSize: 13, fontWeight: 500, cursor: "pointer",
      transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6,
      backgroundColor: active ? "#0066FF" : "transparent",
      border: `1px solid ${active ? "transparent" : "#1F1F1F"}`,
      color: active ? "#fff" : "#71717A",
      fontFamily: "inherit", flexShrink: 0,
    }
  }

  return (
    <>
      <style>{`
        @keyframes fadeAg {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes skeletonPulse {
          0%,100% { opacity: 0.4; }
          50%     { opacity: 0.9; }
        }
        .day-list::-webkit-scrollbar { width: 4px; }
        .day-list::-webkit-scrollbar-track { background: transparent; }
        .day-list::-webkit-scrollbar-thumb { background: #252525; border-radius: 4px; }
        .ag-nav-btn:hover { background: #1F1F1F !important; color: #fff !important; }
        .ag-day:hover { background: rgba(255,255,255,0.02) !important; }
        .ag-new-btn:hover { background: rgba(0,102,255,0.1) !important; }
        .ag-schedule-card:hover { background: #111111 !important; border-color: #252525 !important; }
        .ag-empty-create:hover { background: rgba(0,102,255,0.1) !important; }
        .ag-emp-btn:hover { opacity: 0.8; }
      `}</style>

      <div style={{
        maxWidth: 1280, margin: "0 auto",
        animation: "fadeAg 0.35s ease both",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}>

        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 0,
        }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>
              Agenda
            </h1>
            <p style={{ fontSize: 14, color: "#71717A", marginTop: 6 }}>
              Visualize e gerencie seus agendamentos
            </p>
          </div>
          <NewAgBtn onClick={() => router.push("/dashboard/agendamentos")} />
        </div>

        {/* ── SELETOR DE FUNCIONÁRIO ──────────────────────────────────── */}
        <div style={{
          display: "flex", gap: 8, flexWrap: "wrap",
          marginTop: 16, marginBottom: 8,
        }}>
          {/* Todos */}
          <button
            className="ag-emp-btn"
            onClick={() => setSelectedEmployee("all")}
            style={empBtnStyle(selectedEmployee === "all")}
          >
            Todos
          </button>

          {/* Proprietário */}
          <button
            className="ag-emp-btn"
            onClick={() => setSelectedEmployee("owner")}
            style={empBtnStyle(selectedEmployee === "owner")}
          >
            Proprietário
          </button>

          {/* Funcionários */}
          {employees.map(emp => {
            const active = selectedEmployee === emp.id
            return (
              <button
                key={emp.id}
                className="ag-emp-btn"
                onClick={() => setSelectedEmployee(emp.id)}
                style={empBtnStyle(active)}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, #0066FF, #7C3AED)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: "#fff",
                }}>
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <span>{emp.name}</span>
              </button>
            )
          })}
        </div>

        {/* ── ERROR ──────────────────────────────────────────────────── */}
        {error && !loading && (
          <div style={{
            backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <AlertCircle size={14} color="#EF4444" />
            <span style={{ fontSize: 13, color: "#EF4444" }}>{error}</span>
          </div>
        )}

        {/* ── GRID LAYOUT ────────────────────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 20, marginTop: 16,
          alignItems: "start",
        }}>

          {/* ── CALENDAR ───────────────────────────────────────────── */}
          <div style={{
            backgroundColor: "#111111", border: "1px solid #1F1F1F",
            borderRadius: 20, overflow: "hidden",
          }}>
            {/* Header — sempre visível */}
            <div style={{
              padding: "20px 24px", borderBottom: "1px solid #1F1F1F",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <button className="ag-nav-btn" onClick={prevMonth} disabled={loading} style={{
                width: 34, height: 34, borderRadius: 10,
                backgroundColor: "#161616", border: "1px solid #1F1F1F",
                color: "#A1A1AA", cursor: loading ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}>
                <ChevronLeft size={16} />
              </button>

              <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "-0.3px", margin: 0 }}>
                {formatMonthYear(currentMonth)}
              </p>

              <button className="ag-nav-btn" onClick={nextMonth} disabled={loading} style={{
                width: 34, height: 34, borderRadius: 10,
                backgroundColor: "#161616", border: "1px solid #1F1F1F",
                color: "#A1A1AA", cursor: loading ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}>
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Weekday headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid #1A1A1A" }}>
              {WEEKDAYS.map((d) => (
                <div key={d} style={{
                  textAlign: "center", fontSize: 11, fontWeight: 600,
                  color: "#3F3F46", letterSpacing: "0.5px", padding: "10px 0",
                }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Grid — skeleton ou real */}
            {loading ? <CalendarGridSkeleton /> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {calDays.map((day, idx) => {
                  const hov = hoveredDay === day.dateStr && !day.isSelected
                  return (
                    <div
                      key={idx}
                      className="ag-day"
                      onClick={() => handleSelectDay(day.dateStr)}
                      onMouseEnter={() => setHoveredDay(day.dateStr)}
                      onMouseLeave={() => setHoveredDay(null)}
                      style={{
                        minHeight: 80, padding: 8, cursor: "pointer",
                        borderRight: "1px solid #1A1A1A",
                        borderBottom: "1px solid #1A1A1A",
                        transition: "background 0.15s", position: "relative",
                        backgroundColor: day.isSelected
                          ? "rgba(0,102,255,0.08)"
                          : day.isToday
                            ? "rgba(0,102,255,0.03)"
                            : hov
                              ? "rgba(255,255,255,0.02)"
                              : "transparent",
                      }}
                    >
                      <div style={{
                        width: 26, height: 26, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13,
                        fontWeight: day.isToday || day.isSelected ? 700 : 400,
                        color: day.isSelected
                          ? "#0066FF"
                          : day.isToday
                            ? "#fff"
                            : day.isCurrentMonth
                              ? "#A1A1AA"
                              : "#2A2A2A",
                        backgroundColor: day.isToday && !day.isSelected ? "#0066FF" : "transparent",
                        marginBottom: 4, flexShrink: 0,
                      }}>
                        {day.date.getDate()}
                      </div>

                      {/* Mini cards ≤2 */}
                      {day.isCurrentMonth && day.schedules.length > 0 && day.schedules.length <= 2 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
                          {day.schedules.map((s) => {
                            const c = getStatusColor(s.status)
                            return (
                              <div key={s.id} style={{
                                backgroundColor: `${c}14`, border: `1px solid ${c}33`,
                                borderRadius: 4, padding: "2px 5px",
                                fontSize: 9, color: c,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>
                                {formatTime(s.scheduledAt)} {s.customer.name.split(" ")[0]}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Badge "+N" quando >2 */}
                      {day.isCurrentMonth && day.schedules.length > 2 && (
                        <div style={{ marginTop: 2 }}>
                          <div style={{
                            fontSize: 9, color: "#0066FF",
                            backgroundColor: "rgba(0,102,255,0.1)",
                            border: "1px solid rgba(0,102,255,0.2)",
                            borderRadius: 4, padding: "2px 5px",
                            display: "inline-block",
                          }}>
                            +{day.schedules.length}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── DAY DETAIL ────────────────────────────────────────────── */}
          <div style={{
            backgroundColor: "#111111", border: "1px solid #1F1F1F",
            borderRadius: 20, padding: 20, position: "sticky", top: 24,
          }}>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>
                {formatDayHeader(selectedDate)}
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <p style={{ fontSize: 12, color: "#71717A", margin: 0 }}>
                  {loadingDay
                    ? "Carregando..."
                    : `${daySchedules.length} agendamento${daySchedules.length !== 1 ? "s" : ""}`}
                </p>
                {selectedDate === todayStr() && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: "#0066FF",
                    backgroundColor: "rgba(0,102,255,0.1)",
                    border: "1px solid rgba(0,102,255,0.2)",
                    borderRadius: 6, padding: "3px 8px",
                  }}>
                    Hoje
                  </span>
                )}
              </div>
            </div>

            <div style={{ height: 1, backgroundColor: "#1A1A1A", marginBottom: 16 }} />

            {/* Loading skeletons */}
            {loadingDay && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[0, 0.1, 0.2].map((delay, i) => (
                  <div key={i} style={{
                    backgroundColor: "#0A0A0A", border: "1px solid #161616",
                    borderLeft: "3px solid #1F1F1F",
                    borderRadius: 12, padding: "12px 14px",
                    animation: `skeletonPulse 1.5s ease ${delay}s infinite`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ width: 52, height: 16, borderRadius: 4, backgroundColor: "#1F1F1F" }} />
                        <div style={{ width: 80, height: 11, borderRadius: 4, backgroundColor: "#1A1A1A", marginTop: 6 }} />
                      </div>
                      <div style={{ width: 60, height: 18, borderRadius: 5, backgroundColor: "#1F1F1F" }} />
                    </div>
                    <div style={{ width: "60%", height: 10, borderRadius: 3, backgroundColor: "#161616", marginTop: 10 }} />
                    <div style={{ width: "80%", height: 10, borderRadius: 3, backgroundColor: "#161616", marginTop: 6 }} />
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                      <div style={{ width: 52, height: 14, borderRadius: 4, backgroundColor: "#1F1F1F" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loadingDay && daySchedules.length === 0 && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <Calendar size={32} color="#1F1F1F" style={{ margin: "0 auto" }} />
                <p style={{ fontSize: 13, color: "#52525B", marginTop: 10, marginBottom: 4 }}>
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
                    borderRadius: 10, cursor: "pointer", transition: "background 0.15s",
                    fontFamily: "inherit",
                  }}
                >
                  Criar agendamento
                </button>
              </div>
            )}

            {/* Schedule list */}
            {!loadingDay && daySchedules.length > 0 && (
              <div className="day-list" style={{
                display: "flex", flexDirection: "column", gap: 8,
                maxHeight: "calc(100vh - 320px)", overflowY: "auto", paddingRight: 4,
              }}>
                {daySchedules.map((s) => {
                  const color    = getStatusColor(s.status)
                  const services = s.scheduleServices.map((ss) => ss.service.name).join(", ")
                  return (
                    <div
                      key={s.id}
                      className="ag-schedule-card"
                      onClick={() => router.push("/dashboard/agendamentos")}
                      style={{
                        backgroundColor: "#0A0A0A",
                        border: "1px solid #161616",
                        borderLeft: `3px solid ${color}`,
                        borderRadius: 12, padding: "12px 14px",
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>
                            {formatTime(s.scheduledAt)}
                          </p>
                          <p style={{ fontSize: 12, color: "#A1A1AA", marginTop: 2 }}>
                            {s.customer.name}
                          </p>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 600, flexShrink: 0, color,
                          backgroundColor: `${color}14`,
                          border: `1px solid ${color}33`,
                          borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap",
                        }}>
                          {getStatusLabel(s.status)}
                        </span>
                      </div>

                      {services && (
                        <p style={{ fontSize: 11, color: "#52525B", margin: "6px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {services}
                        </p>
                      )}

                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                        <Car size={10} color="#3F3F46" />
                        <span style={{ fontSize: 11, color: "#3F3F46" }}>
                          {[s.vehicle.brand, s.vehicle.model].filter(Boolean).join(" ") || "Veículo"} · {s.vehicle.plate}
                        </span>
                      </div>

                      {/* ── Badge do responsável ── */}
                      <p style={{ fontSize: 11, color: "#52525B", margin: "2px 0 0" }}>
                        Com: {s.employee?.name ?? "Proprietário"}
                      </p>

                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#A1A1AA" }}>
                          {formatCurrency(s.totalPrice)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #161616" }}>
              <button
                className="ag-new-btn"
                onClick={() => router.push("/dashboard/agendamentos")}
                style={{
                  width: "100%", height: 36,
                  backgroundColor: "rgba(0,102,255,0.06)",
                  border: "1px solid rgba(0,102,255,0.12)",
                  color: "#0066FF", fontSize: 12, fontWeight: 600,
                  borderRadius: 10, cursor: "pointer", transition: "background 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontFamily: "inherit",
                }}
              >
                <Plus size={13} />
                Novo agendamento
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Atomic helpers ────────────────────────────────────────────────────────────

function NewAgBtn({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "linear-gradient(135deg,#0066FF,#7C3AED)",
        border: "none", borderRadius: 12, padding: "10px 18px",
        color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer",
        boxShadow: hov ? "0 8px 30px rgba(0,102,255,0.5)" : "0 4px 20px rgba(0,102,255,0.3)",
        transform: hov ? "scale(1.02)" : "scale(1)",
        transition: "all 0.2s", fontFamily: "inherit",
      }}
    >
      <Plus size={15} /> Novo agendamento
    </button>
  )
}