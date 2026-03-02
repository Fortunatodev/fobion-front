"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  ChevronLeft, ChevronRight, Car,
  CheckCircle2, AlertCircle,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublicService {
  id: string
  name: string
  description: string | null
  price: number
  durationMinutes: number
}

interface PublicBusiness {
  id: string
  name: string
  slug: string
  phone: string
  services: PublicService[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0]
}

function isPastDate(d: string): boolean {
  return d < todayStr()
}

function formatMonthYear(d: Date): string {
  const s = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Returns 42 cells (6 weeks) for a given month. */
function buildCalendarDays(month: Date) {
  const year = month.getFullYear()
  const mon  = month.getMonth()
  const firstDay = new Date(year, mon, 1)
  const start    = new Date(firstDay)
  start.setDate(start.getDate() - firstDay.getDay()) // week starts Sunday

  const cells: { dateStr: string; day: number; inMonth: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    cells.push({
      dateStr:  d.toISOString().split("T")[0],
      day:      d.getDate(),
      inMonth:  d.getMonth() === mon,
    })
  }
  return cells
}

const WEEK_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const STEPS = [
  { n: 1, label: "Horário" },
  { n: 2, label: "Seus dados" },
  { n: 3, label: "Confirmação" },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AgendarPage() {
  const params       = useParams()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const slug         = params.slug as string

  // ── Business + services ───────────────────────────────────────────────────
  const [business,         setBusiness]         = useState<PublicBusiness | null>(null)
  const [selectedServices, setSelectedServices] = useState<PublicService[]>([])
  const [loading,          setLoading]          = useState(true)

  // ── Step ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // ── Step 1 ────────────────────────────────────────────────────────────────
  const [calendarMonth,   setCalendarMonth]   = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [selectedDate,    setSelectedDate]    = useState("")
  const [selectedSlot,    setSelectedSlot]    = useState("")
  const [availableSlots,  setAvailableSlots]  = useState<string[]>([])
  const [loadingSlots,    setLoadingSlots]    = useState(false)

  // ── Step 2 ────────────────────────────────────────────────────────────────
  const [customerName,  setCustomerName]  = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [vehiclePlate,  setVehiclePlate]  = useState("")
  const [vehicleBrand,  setVehicleBrand]  = useState("")
  const [vehicleModel,  setVehicleModel]  = useState("")
  const [vehicleColor,  setVehicleColor]  = useState("")
  const [vehicleType,   setVehicleType]   = useState("CAR")

  // ── Submission ────────────────────────────────────────────────────────────
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Fetch business ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
      try {
        const res  = await fetch(`${API}/api/public/${slug}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        const biz: PublicBusiness = data.business ?? data
        setBusiness(biz)

        const ids     = searchParams.getAll("services")
        const filtered = biz.services.filter((s) => ids.includes(s.id))
        setSelectedServices(filtered.length > 0 ? filtered : biz.services)
      } catch {
        // keep loading = true so the spinner keeps showing; navigate away on error
        router.push(`/${slug}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug, searchParams, router])

  // ── Fetch slots ───────────────────────────────────────────────────────────
  const fetchSlots = useCallback(
    async (date: string) => {
      if (!business || selectedServices.length === 0) return
      setLoadingSlots(true)
      setSelectedSlot("")
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
      try {
        const res  = await fetch(
          `${API}/api/schedules/available-slots?date=${date}&serviceId=${selectedServices[0].id}&businessId=${business.id}`
        )
        const data = await res.json()
        setAvailableSlots(data.slots ?? [])
      } catch {
        setAvailableSlots([])
      } finally {
        setLoadingSlots(false)
      }
    },
    [business, selectedServices]
  )

  function handleSelectDate(dateStr: string) {
    if (isPastDate(dateStr)) return
    setSelectedDate(dateStr)
    fetchSlots(dateStr)
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!customerName.trim() || !customerPhone.trim()) {
      setSubmitError("Nome e telefone são obrigatórios."); return
    }
    if (!vehiclePlate.trim() || !vehicleBrand.trim() || !vehicleModel.trim()) {
      setSubmitError("Dados do veículo são obrigatórios."); return
    }
    setSubmitting(true)
    setSubmitError(null)
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
    try {
      const res = await fetch(`${API}/api/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId:  business!.id,
          serviceIds:  selectedServices.map((s) => s.id),
          scheduledAt: new Date(`${selectedDate}T${selectedSlot}:00`).toISOString(),
          customer: {
            name:  customerName.trim(),
            phone: customerPhone.trim(),
            email: customerEmail.trim() || undefined,
          },
          vehicle: {
            plate: vehiclePlate.trim().toUpperCase(),
            brand: vehicleBrand.trim(),
            model: vehicleModel.trim(),
            color: vehicleColor.trim() || undefined,
            type:  vehicleType,
          },
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || "Erro ao criar agendamento.")
      }
      setStep(3)
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Erro ao agendar. Tente novamente.")
    } finally {
      setSubmitting(false)
    }
  }

  const totalSelected = selectedServices.reduce(
    (acc, s) => ({ price: acc.price + s.price, duration: acc.duration + s.durationMinutes }),
    { price: 0, duration: 0 }
  )

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <style>{`@keyframes spinAg{to{transform:rotate(360deg)}}`}</style>
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center",
          justifyContent: "center", backgroundColor: "#0A0A0A",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "3px solid #1F1F1F", borderTopColor: "#0066FF",
            animation: "spinAg 0.7s linear infinite",
          }} />
        </div>
      </>
    )
  }

  const calCells = buildCalendarDays(calendarMonth)

  return (
    <>
      <style>{`
        @keyframes spinAg { to { transform: rotate(360deg); } }
        @keyframes fadeAg {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .ag2-input:focus { border-color:rgba(0,102,255,0.4) !important; outline:none; }
        .ag2-slot:hover  { background:#1F1F1F !important; }
        .ag2-day:hover:not(:disabled) { color:#fff !important; }
      `}</style>

      <div style={{
        minHeight: "100vh", backgroundColor: "#0A0A0A",
        fontFamily: "'Inter',-apple-system,sans-serif",
        animation: "fadeAg 0.35s ease both",
      }}>

        {/* ── STICKY HEADER ─────────────────────────────────────────────── */}
        <div style={{
          position: "sticky", top: 0, zIndex: 40, height: 60,
          backgroundColor: "rgba(10,10,10,0.9)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid #1A1A1A",
        }}>
          <div style={{
            maxWidth: 700, margin: "0 auto", padding: "0 24px",
            height: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <button
              onClick={() =>
                step === 1 ? router.push(`/${slug}`) : setStep((s) => (s - 1) as 1 | 2 | 3)
              }
              style={{
                background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 13, color: "#A1A1AA", fontFamily: "inherit",
              }}
            >
              <ChevronLeft size={16} /> Voltar
            </button>

            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>
                {business?.name ?? ""}
              </p>
              <p style={{ fontSize: 11, color: "#52525B", margin: 0 }}>Agendamento</p>
            </div>

            <div style={{ width: 60 }} />
          </div>
        </div>

        {/* ── STEP INDICATOR ────────────────────────────────────────────── */}
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : undefined }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, margin: "0 auto",
                    backgroundColor: step >= s.n ? "#0066FF" : "#1F1F1F",
                    color: step >= s.n ? "#fff" : "#52525B",
                    border: step < s.n ? "1px solid #252525" : "none",
                    transition: "all 0.2s",
                  }}>
                    {step > s.n ? <CheckCircle2 size={13} /> : s.n}
                  </div>
                  <p style={{
                    fontSize: 11, marginTop: 4, textAlign: "center",
                    color: step >= s.n ? "#fff" : "#52525B",
                  }}>
                    {s.label}
                  </p>
                </div>

                {i < 2 && (
                  <div style={{
                    flex: 1, height: 1, margin: "0 8px", marginBottom: 18,
                    backgroundColor: step > s.n ? "rgba(0,102,255,0.3)" : "#1F1F1F",
                    transition: "background 0.3s",
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── CONTENT ───────────────────────────────────────────────────── */}
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 24px 60px" }}>

          {/* ── STEP 1 ────────────────────────────────────────────────── */}
          {step === 1 && (
            <div>
              {/* Service summary */}
              <div style={{
                backgroundColor: "#111111", border: "1px solid #1F1F1F",
                borderRadius: 14, padding: "14px 16px", marginBottom: 20,
              }}>
                <p style={{ fontSize: 12, color: "#71717A", marginBottom: 8 }}>
                  Serviços selecionados
                </p>
                {selectedServices.map((s) => (
                  <div key={s.id} style={{
                    display: "flex", justifyContent: "space-between",
                    fontSize: 13, marginBottom: 4,
                  }}>
                    <span style={{ color: "#fff" }}>{s.name}</span>
                    <span style={{ color: "#10B981", fontWeight: 600 }}>
                      {formatCurrency(s.price)}
                    </span>
                  </div>
                ))}
                {selectedServices.length > 1 && (
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    fontSize: 13, marginTop: 8, paddingTop: 8, borderTop: "1px solid #1A1A1A",
                  }}>
                    <span style={{ color: "#A1A1AA" }}>Total</span>
                    <span style={{ color: "#fff", fontWeight: 700 }}>
                      {formatCurrency(totalSelected.price)}
                    </span>
                  </div>
                )}
              </div>

              {/* Calendar card */}
              <div style={{
                backgroundColor: "#111111", border: "1px solid #1F1F1F",
                borderRadius: 16, padding: 20, marginBottom: 16,
              }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 16 }}>
                  Escolha uma data
                </h3>

                {/* Month nav */}
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 12,
                }}>
                  <button
                    onClick={() => setCalendarMonth(
                      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                    )}
                    style={{
                      width: 30, height: 30, borderRadius: 8,
                      backgroundColor: "#161616", border: "1px solid #252525",
                      color: "#A1A1AA", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                    {formatMonthYear(calendarMonth)}
                  </span>
                  <button
                    onClick={() => setCalendarMonth(
                      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                    )}
                    style={{
                      width: 30, height: 30, borderRadius: 8,
                      backgroundColor: "#161616", border: "1px solid #252525",
                      color: "#A1A1AA", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* Week labels */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
                  {WEEK_LABELS.map((w) => (
                    <div key={w} style={{
                      textAlign: "center", fontSize: 11, fontWeight: 600,
                      color: "#3F3F46", padding: "4px 0",
                    }}>
                      {w}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                  {calCells.map((cell, i) => {
                    const past  = isPastDate(cell.dateStr)
                    const isSel = cell.dateStr === selectedDate
                    const today = cell.dateStr === todayStr()
                    return (
                      <button
                        key={i}
                        className="ag2-day"
                        disabled={past || !cell.inMonth}
                        onClick={() => handleSelectDate(cell.dateStr)}
                        style={{
                          width: "100%", aspectRatio: "1", borderRadius: 8,
                          fontSize: 13, fontFamily: "inherit",
                          cursor: past || !cell.inMonth ? "not-allowed" : "pointer",
                          opacity: !cell.inMonth ? 0.15 : past ? 0.2 : 1,
                          backgroundColor: isSel ? "#0066FF" : "transparent",
                          border: today && !isSel ? "1px solid #0066FF" : "1px solid transparent",
                          color: isSel ? "#fff" : today ? "#0066FF" : "#A1A1AA",
                          fontWeight: isSel || today ? 700 : 400,
                          transition: "all 0.15s",
                        }}
                      >
                        {cell.day}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Slots card */}
              {selectedDate && (
                <div style={{
                  backgroundColor: "#111111", border: "1px solid #1F1F1F",
                  borderRadius: 16, padding: 20, marginBottom: 20,
                }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 14 }}>
                    Escolha um horário
                  </h3>

                  {loadingSlots ? (
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      gap: 10, padding: "12px 0",
                    }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: "50%",
                        border: "2px solid #252525", borderTopColor: "#0066FF",
                        animation: "spinAg 0.7s linear infinite",
                      }} />
                      <span style={{ fontSize: 13, color: "#71717A" }}>Buscando horários...</span>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#71717A", textAlign: "center", padding: "8px 0" }}>
                      Nenhum horário disponível para este dia.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {availableSlots.map((slot) => {
                        const isSel = slot === selectedSlot
                        return (
                          <button
                            key={slot}
                            className={isSel ? undefined : "ag2-slot"}
                            onClick={() => setSelectedSlot(slot)}
                            style={{
                              height: 36, padding: "0 14px", borderRadius: 8,
                              fontSize: 13, fontWeight: 500, cursor: "pointer",
                              backgroundColor: isSel ? "#0066FF" : "#161616",
                              border: `1px solid ${isSel ? "#0066FF" : "#252525"}`,
                              color: isSel ? "#fff" : "#A1A1AA",
                              transition: "all 0.15s", fontFamily: "inherit",
                            }}
                          >
                            {slot}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Continue button */}
              <button
                onClick={() => setStep(2)}
                disabled={!selectedDate || !selectedSlot}
                style={{
                  width: "100%", height: 46,
                  background:
                    selectedDate && selectedSlot
                      ? "linear-gradient(135deg,#0066FF,#7C3AED)"
                      : "#1F1F1F",
                  border: "none", borderRadius: 12,
                  color: selectedDate && selectedSlot ? "#fff" : "#3F3F46",
                  fontSize: 14, fontWeight: 600,
                  cursor: selectedDate && selectedSlot ? "pointer" : "not-allowed",
                  transition: "all 0.2s", fontFamily: "inherit",
                }}
              >
                Continuar
              </button>
            </div>
          )}

          {/* ── STEP 2 ────────────────────────────────────────────────── */}
          {step === 2 && (
            <div>
              {/* Date summary */}
              <div style={{
                backgroundColor: "#111111", border: "1px solid #1F1F1F",
                borderRadius: 12, padding: "12px 16px", marginBottom: 20,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 13, color: "#fff" }}>
                  {selectedDate} às {selectedSlot}
                </span>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 12, color: "#0066FF", fontFamily: "inherit",
                  }}
                >
                  Alterar
                </button>
              </div>

              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
                Seus dados
              </h3>

              {/* Error banner */}
              {submitError && (
                <div style={{
                  backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 10, padding: "10px 14px", marginBottom: 16,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <AlertCircle size={14} color="#EF4444" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#EF4444" }}>{submitError}</span>
                </div>
              )}

              {/* Form fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <FInput label="Nome completo" value={customerName} onChange={setCustomerName}
                  placeholder="João da Silva" required />
                <FInput label="Telefone" value={customerPhone} onChange={setCustomerPhone}
                  placeholder="(47) 99999-0000" required />
                <FInput label="E-mail" value={customerEmail} onChange={setCustomerEmail}
                  placeholder="(opcional)" />

                {/* Vehicle separator */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0 4px" }}>
                  <Car size={14} color="#52525B" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#A1A1AA" }}>
                    Dados do veículo
                  </span>
                </div>

                <FInput label="Placa" value={vehiclePlate}
                  onChange={(v) => setVehiclePlate(v.toUpperCase())}
                  placeholder="ABC-1234" required />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FInput label="Marca" value={vehicleBrand} onChange={setVehicleBrand}
                    placeholder="Honda" required />
                  <FInput label="Modelo" value={vehicleModel} onChange={setVehicleModel}
                    placeholder="Civic" required />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FInput label="Cor" value={vehicleColor} onChange={setVehicleColor}
                    placeholder="Prata" />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#A1A1AA", marginBottom: 6 }}>
                      Tipo
                    </label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      style={{
                        height: 42, backgroundColor: "#111111", border: "1px solid #1F1F1F",
                        borderRadius: 10, padding: "0 14px", fontSize: 14, color: "#fff",
                        outline: "none", cursor: "pointer", fontFamily: "inherit",
                        appearance: "none", WebkitAppearance: "none",
                      }}
                    >
                      <option value="CAR">Carro</option>
                      <option value="MOTORCYCLE">Moto</option>
                      <option value="TRUCK">Caminhão</option>
                      <option value="SUV">SUV</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  marginTop: 20, width: "100%", height: 48,
                  background: "linear-gradient(135deg,#0066FF,#7C3AED)",
                  border: "none", borderRadius: 12, color: "white",
                  fontSize: 14, fontWeight: 600,
                  cursor: submitting ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  opacity: submitting ? 0.7 : 1, transition: "opacity 0.15s",
                  fontFamily: "inherit",
                }}
              >
                {submitting ? (
                  <>
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff",
                      animation: "spinAg 0.7s linear infinite",
                    }} />
                    Agendando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Confirmar agendamento
                  </>
                )}
              </button>
            </div>
          )}

          {/* ── STEP 3 ────────────────────────────────────────────────── */}
          {step === 3 && (
            <div style={{ textAlign: "center", paddingTop: 32 }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                backgroundColor: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto",
              }}>
                <CheckCircle2 size={32} color="#10B981" />
              </div>

              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginTop: 20 }}>
                Agendamento confirmado!
              </h2>
              <p style={{ fontSize: 14, color: "#A1A1AA", marginTop: 8 }}>
                Seu agendamento foi criado com sucesso.
              </p>

              {/* Summary card */}
              <div style={{
                backgroundColor: "#111111", border: "1px solid #1F1F1F",
                borderRadius: 16, padding: 20, marginTop: 24, textAlign: "left",
              }}>
                {[
                  { label: "Data",     value: `${selectedDate} às ${selectedSlot}` },
                  { label: "Serviços", value: selectedServices.map((s) => s.name).join(", ") },
                  { label: "Total",    value: formatCurrency(totalSelected.price) },
                ].map((row) => (
                  <div key={row.label} style={{
                    display: "flex", justifyContent: "space-between",
                    fontSize: 13, marginBottom: 12, gap: 16,
                  }}>
                    <span style={{ color: "#71717A", flexShrink: 0 }}>{row.label}</span>
                    <span style={{ color: "#fff", textAlign: "right" }}>{row.value}</span>
                  </div>
                ))}

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, alignItems: "center" }}>
                  <span style={{ color: "#71717A" }}>Status</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: "#F59E0B",
                    backgroundColor: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.2)",
                    borderRadius: 6, padding: "3px 8px",
                  }}>
                    Aguardando confirmação
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
                <button
                  onClick={() => router.push(`/${slug}`)}
                  style={{
                    width: "100%", height: 44, backgroundColor: "#161616",
                    border: "1px solid #1F1F1F", color: "#A1A1AA",
                    borderRadius: 12, cursor: "pointer", fontSize: 14,
                    fontFamily: "inherit",
                  }}
                >
                  Voltar para a loja
                </button>

                {business?.phone && (
                  <button
                    onClick={() => {
                      const phone = business.phone.replace(/\D/g, "")
                      const text  = encodeURIComponent(
                        `Olá! Acabei de agendar no ${business.name}. Aguardo confirmação!`
                      )
                      window.open(`https://wa.me/55${phone}?text=${text}`, "_blank")
                    }}
                    style={{
                      width: "100%", height: 44,
                      backgroundColor: "rgba(37,211,102,0.1)",
                      border: "1px solid rgba(37,211,102,0.2)",
                      color: "#25D366", borderRadius: 12, cursor: "pointer",
                      fontSize: 14, fontWeight: 600,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      fontFamily: "inherit",
                    }}
                  >
                    Confirmar pelo WhatsApp
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Reusable field ────────────────────────────────────────────────────────────

function FInput({
  label, value, onChange, placeholder, required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: "#A1A1AA", marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="ag2-input"
        style={{
          height: 42, backgroundColor: "#111111",
          border: "1px solid #1F1F1F", borderRadius: 10,
          padding: "0 14px", fontSize: 14, color: "#fff",
          outline: "none", width: "100%", boxSizing: "border-box",
          transition: "border-color 0.15s", fontFamily: "inherit",
        }}
      />
    </div>
  )
}