"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react"
import type { PublicBusiness } from "@/types"

type PublicService = PublicBusiness["services"][number]

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
const WEEKDAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]
const VEHICLE_TYPES = ["CAR","MOTORCYCLE","TRUCK","SUV"]
const VEHICLE_TYPE_LABELS: Record<string,string> = { CAR:"Carro", MOTORCYCLE:"Moto", TRUCK:"Caminhão", SUV:"SUV" }

function isPastDate(dateStr: string): boolean {
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(dateStr + "T00:00:00"); d.setHours(0,0,0,0)
  return d < today
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDuration(min: number) {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h${m}min` : `${h}h`
}

interface EmployeeOption {
  id:        string
  name:      string
  avatarUrl: string | null
}

// ── Calendário ────────────────────────────────────────────────────────────────

function Calendar({
  month, selectedDate, onSelect, onPrev, onNext,
}: {
  month: Date; selectedDate: string
  onSelect: (d: string) => void; onPrev: () => void; onNext: () => void
}) {
  const year  = month.getFullYear()
  const mon   = month.getMonth()
  const first = new Date(year, mon, 1).getDay()
  const days  = new Date(year, mon + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({length: days}, (_,i) => i+1)]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
        <button onClick={onPrev} style={{ background:"none", border:"none", cursor:"pointer", color:"#A1A1AA", padding:4 }}><ChevronLeft size={16}/></button>
        <span style={{ fontSize:14, fontWeight:600, color:"#fff" }}>{MONTHS[mon]} {year}</span>
        <button onClick={onNext} style={{ background:"none", border:"none", cursor:"pointer", color:"#A1A1AA", padding:4 }}><ChevronRight size={16}/></button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:6 }}>
        {WEEKDAYS.map(d => <div key={d} style={{ textAlign:"center", fontSize:10, color:"#52525B", fontWeight:600, padding:"4px 0" }}>{d}</div>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = `${year}-${String(mon+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`
          const past    = isPastDate(dateStr)
          const sel     = dateStr === selectedDate
          return (
            <button
              key={i}
              onClick={() => !past && onSelect(dateStr)}
              disabled={past}
              style={{
                height:36, borderRadius:8, fontSize:13, fontWeight: sel ? 700 : 400,
                border: sel ? "none" : "1px solid transparent",
                background: sel ? "linear-gradient(135deg,#0066FF,#7C3AED)" : "none",
                color: past ? "#2A2A2A" : sel ? "#fff" : "#A1A1AA",
                cursor: past ? "not-allowed" : "pointer",
                fontFamily:"inherit",
              }}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── FInput ────────────────────────────────────────────────────────────────────

function FInput({ label, value, onChange, placeholder, required, type="text" }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; type?: string
}) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
      <label style={{ fontSize:11, fontWeight:500, color:"#71717A", letterSpacing:"0.03em" }}>
        {label}{required && <span style={{ color:"#EF4444" }}> *</span>}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ height:40, padding:"0 12px", borderRadius:10, border:"1px solid #2A2A2A", backgroundColor:"#161616", color:"#fff", fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box", width:"100%" }}
      />
    </div>
  )
}

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

  // ── Funcionários ──────────────────────────────────────────────────────────
  const [employees,        setEmployees]        = useState<EmployeeOption[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>("owner")
  const [loadingEmployees, setLoadingEmployees] = useState(false)

  // ── Step 1 ────────────────────────────────────────────────────────────────
  const [calendarMonth,  setCalendarMonth]  = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [selectedDate,   setSelectedDate]   = useState("")
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [selectedSlot,   setSelectedSlot]   = useState("")
  const [loadingSlots,   setLoadingSlots]   = useState(false)

  // ── Step 2 ────────────────────────────────────────────────────────────────
  const [customerName,  setCustomerName]  = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [vehiclePlate,  setVehiclePlate]  = useState("")
  const [vehicleBrand,  setVehicleBrand]  = useState("")
  const [vehicleModel,  setVehicleModel]  = useState("")
  const [vehicleColor,  setVehicleColor]  = useState("")
  const [vehicleType,   setVehicleType]   = useState("CAR")
  const [submitting,    setSubmitting]    = useState(false)
  const [submitError,   setSubmitError]   = useState<string | null>(null)

  // ── Load business ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return
    async function load() {
      try {
        const res  = await fetch(`${API}/api/public/${slug}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        const biz: PublicBusiness = data.business ?? data
        setBusiness(biz)
        const ids      = searchParams.getAll("services")
        const filtered = biz.services.filter((s: PublicService) => ids.includes(s.id))
        setSelectedServices(filtered.length > 0 ? filtered : biz.services)
      } catch {
        router.push(`/${slug}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  // ── Load employees ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!business) return
    setLoadingEmployees(true)
    fetch(`${API}/api/public/${business.slug}/employees`)
      .then(r => r.json())
      .then(d => {
        const list: EmployeeOption[] = d.employees ?? []
        setEmployees(list)
        if (list.length <= 1) setSelectedEmployee("owner")
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmployees(false))
  }, [business])

  const showEmployeeStep = employees.length > 1

  // ── fetchSlots ────────────────────────────────────────────────────────────
  const fetchSlots = useCallback(
    async (date: string) => {
      if (!business || selectedServices.length === 0) {
        setAvailableSlots([]); return
      }
      setLoadingSlots(true)
      setSelectedSlot("")
      const serviceParams = selectedServices.map(s => `serviceIds=${encodeURIComponent(s.id)}`).join("&")
      const empParam      = selectedEmployee && selectedEmployee !== "owner"
        ? `&employeeId=${encodeURIComponent(selectedEmployee)}`
        : ""
      try {
        const res  = await fetch(`${API}/api/schedules/available-slots?date=${date}&businessId=${business.id}&${serviceParams}${empParam}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        setAvailableSlots(data.slots ?? [])
      } catch {
        setAvailableSlots([])
      } finally {
        setLoadingSlots(false)
      }
    },
    [business, selectedServices, selectedEmployee]
  )

  function handleSelectDate(dateStr: string) {
    if (isPastDate(dateStr)) return
    setSelectedDate(dateStr)
    fetchSlots(dateStr)
  }

  // Re-busca slots quando funcionário ou serviços mudam
  useEffect(() => {
    if (selectedDate && selectedServices.length > 0) fetchSlots(selectedDate)
  }, [selectedEmployee, selectedDate, selectedServices, fetchSlots])

  // ── handleSubmit ──────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!customerName.trim() || !customerPhone.trim()) {
      setSubmitError("Nome e telefone são obrigatórios."); return
    }
    if (!vehiclePlate.trim() || !vehicleBrand.trim() || !vehicleModel.trim()) {
      setSubmitError("Dados do veículo são obrigatórios."); return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`${API}/api/schedules`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId:  business!.id,
          serviceIds:  selectedServices.map(s => s.id),
          scheduledAt: new Date(`${selectedDate}T${selectedSlot}:00`).toISOString(),
          employeeId:  selectedEmployee,
          customer: { name: customerName.trim(), phone: customerPhone.trim(), email: customerEmail.trim() || undefined },
          vehicle:  { plate: vehiclePlate.trim().toUpperCase(), brand: vehicleBrand.trim(), model: vehicleModel.trim(), color: vehicleColor.trim() || undefined, type: vehicleType },
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        if (res.status === 409 || err.code === "SCHEDULE_CONFLICT") {
          setSubmitError("⚠️ Este horário foi reservado agora. Escolha outro horário.")
          setSelectedSlot("")
          await fetchSlots(selectedDate)
          setStep(1)
          return
        }
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
  if (loading) return (
    <>
      <style>{`@keyframes spinAg{to{transform:rotate(360deg)}}`}</style>
      <div style={{ minHeight:"100vh", backgroundColor:"#0A0A0A", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:32, height:32, borderRadius:"50%", border:"3px solid #1F1F1F", borderTopColor:"#0066FF", animation:"spinAg 0.7s linear infinite" }} />
      </div>
    </>
  )

  if (!business) return null

  return (
    <>
      <style>{`
        @keyframes fadeAg  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spinAg  { to{transform:rotate(360deg)} }
        .ag2-slot:hover { background:rgba(255,255,255,0.04)!important; border-color:#3F3F46!important; }
        * { box-sizing:border-box; }
      `}</style>

      <div style={{ minHeight:"100vh", backgroundColor:"#0A0A0A", fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif" }}>

        {/* ── Top bar ── */}
        <div style={{ position:"sticky", top:0, zIndex:40, backgroundColor:"rgba(10,10,10,0.95)", backdropFilter:"blur(12px)", borderBottom:"1px solid #1A1A1A" }}>
          <div style={{ maxWidth:700, margin:"0 auto", padding:"0 24px", height:56, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <button
              onClick={() => step === 1 ? router.push(`/${slug}`) : setStep(s => (s - 1) as 1 | 2 | 3)}
              style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontSize:13, color:"#A1A1AA", fontFamily:"inherit" }}
            >
              <ChevronLeft size={16}/> Voltar
            </button>
            <div style={{ textAlign:"center" }}>
              <p style={{ fontSize:13, fontWeight:600, color:"#fff", margin:0 }}>{business.name}</p>
              <p style={{ fontSize:11, color:"#52525B", margin:"2px 0 0" }}>
                {step === 1 ? "Escolha data e horário" : step === 2 ? "Seus dados" : "Confirmado!"}
              </p>
            </div>
            <div style={{ width:60 }} />
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div style={{ height:2, backgroundColor:"#111" }}>
          <div style={{ height:"100%", background:"linear-gradient(90deg,#0066FF,#7C3AED)", width:`${step === 1 ? 33 : step === 2 ? 66 : 100}%`, transition:"width 0.3s ease" }} />
        </div>

        <div style={{ maxWidth:700, margin:"0 auto", padding:"24px 24px 80px" }}>

          {/* ═══════ STEP 1 — Data e horário ═══════ */}
          {step === 1 && (
            <div style={{ animation:"fadeAg 0.25s ease" }}>

              {/* Resumo dos serviços */}
              <div style={{ backgroundColor:"#111111", border:"1px solid #1F1F1F", borderRadius:16, padding:"16px 20px", marginBottom:20 }}>
                <p style={{ fontSize:11, fontWeight:600, color:"#52525B", margin:"0 0 10px", letterSpacing:"0.04em" }}>SERVIÇOS SELECIONADOS</p>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {selectedServices.map(s => (
                    <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:13, color:"#fff", fontWeight:500 }}>{s.name}</span>
                      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                        <span style={{ fontSize:12, color:"#52525B" }}>{formatDuration(s.durationMinutes)}</span>
                        <span style={{ fontSize:13, color:"#A1A1AA" }}>{formatCurrency(s.price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {selectedServices.length > 1 && (
                  <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #1F1F1F", display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:12, color:"#52525B" }}>Total: {formatDuration(totalSelected.duration)}</span>
                    <span style={{ fontSize:13, fontWeight:600, color:"#fff" }}>{formatCurrency(totalSelected.price)}</span>
                  </div>
                )}
              </div>

              {/* ── Etapa "Com quem?" ── */}
              {showEmployeeStep && !loadingEmployees && (
                <div style={{ backgroundColor:"#111111", border:"1px solid #1F1F1F", borderRadius:16, padding:20, marginBottom:20 }}>
                  <p style={{ fontSize:11, fontWeight:600, color:"#52525B", margin:"0 0 12px", letterSpacing:"0.04em" }}>COM QUEM?</p>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
                    {employees.map(emp => {
                      const sel = emp.id === selectedEmployee
                      return (
                        <button
                          key={emp.id}
                          onClick={() => setSelectedEmployee(emp.id)}
                          style={{
                            display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
                            borderRadius:12, cursor:"pointer",
                            backgroundColor: sel ? "rgba(0,102,255,0.06)" : "#0D0D0D",
                            border: `1px solid ${sel ? "rgba(0,102,255,0.35)" : "#1F1F1F"}`,
                            fontFamily:"inherit",
                          }}
                        >
                          <div style={{ width:36, height:36, borderRadius:"50%", flexShrink:0, background:"linear-gradient(135deg,#0066FF,#7C3AED)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff" }}>
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize:13, fontWeight: sel ? 600 : 400, color: sel ? "#fff" : "#A1A1AA" }}>{emp.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Calendário */}
              <div style={{ backgroundColor:"#111111", border:"1px solid #1F1F1F", borderRadius:16, padding:20, marginBottom:20 }}>
                <p style={{ fontSize:11, fontWeight:600, color:"#52525B", margin:"0 0 16px", letterSpacing:"0.04em" }}>ESCOLHA A DATA</p>
                <Calendar
                  month={calendarMonth}
                  selectedDate={selectedDate}
                  onSelect={handleSelectDate}
                  onPrev={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  onNext={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                />
              </div>

              {/* Horários */}
              {selectedDate && (
                <div style={{ backgroundColor:"#111111", border:"1px solid #1F1F1F", borderRadius:16, padding:20, marginBottom:20 }}>
                  <p style={{ fontSize:11, fontWeight:600, color:"#52525B", margin:"0 0 14px", letterSpacing:"0.04em" }}>HORÁRIOS DISPONÍVEIS</p>
                  {loadingSlots ? (
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:14, height:14, borderRadius:"50%", border:"2px solid #2A2A2A", borderTopColor:"#0066FF", animation:"spinAg 0.7s linear infinite" }} />
                      <span style={{ fontSize:13, color:"#71717A" }}>Buscando horários...</span>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <p style={{ fontSize:13, color:"#71717A", textAlign:"center", padding:"8px 0" }}>Nenhum horário disponível para este dia.</p>
                  ) : (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                      {availableSlots.map(slot => {
                        const isSel = slot === selectedSlot
                        return (
                          <button
                            key={slot}
                            className={isSel ? undefined : "ag2-slot"}
                            onClick={() => setSelectedSlot(slot)}
                            style={{
                              height:36, padding:"0 14px", borderRadius:8,
                              fontSize:13, fontWeight:500, cursor:"pointer",
                              background: isSel ? "linear-gradient(135deg,#0066FF,#7C3AED)" : "transparent",
                              border: isSel ? "none" : "1px solid #2A2A2A",
                              color: isSel ? "#fff" : "#A1A1AA",
                              fontFamily:"inherit", transition:"all 0.15s",
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

              {/* CTA Step 1 */}
              <button
                onClick={() => setStep(2)}
                disabled={!selectedDate || !selectedSlot}
                style={{
                  width:"100%", height:52, borderRadius:14, border:"none",
                  background: selectedDate && selectedSlot ? "linear-gradient(135deg,#0066FF,#7C3AED)" : "#161616",
                  color: selectedDate && selectedSlot ? "#fff" : "#3F3F46",
                  fontSize:15, fontWeight:700, cursor: selectedDate && selectedSlot ? "pointer" : "not-allowed",
                  fontFamily:"inherit", transition:"all 0.2s",
                }}
              >
                Continuar →
              </button>
            </div>
          )}

          {/* ═══════ STEP 2 — Dados do cliente ═══════ */}
          {step === 2 && (
            <div style={{ animation:"fadeAg 0.25s ease" }}>
              <div style={{ backgroundColor:"#111111", border:"1px solid #1F1F1F", borderRadius:16, padding:20, marginBottom:16 }}>
                <p style={{ fontSize:11, fontWeight:600, color:"#52525B", margin:"0 0 14px", letterSpacing:"0.04em" }}>SEU AGENDAMENTO</p>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:13, color:"#71717A" }}>Serviços</span>
                    <span style={{ fontSize:13, color:"#fff", fontWeight:500 }}>{selectedServices.map(s=>s.name).join(", ")}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:13, color:"#71717A" }}>Data</span>
                    <span style={{ fontSize:13, color:"#fff", fontWeight:500 }}>{new Date(selectedDate+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"})}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:13, color:"#71717A" }}>Horário</span>
                    <span style={{ fontSize:13, color:"#fff", fontWeight:500 }}>{selectedSlot}</span>
                  </div>
                  {showEmployeeStep && (
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontSize:13, color:"#71717A" }}>Profissional</span>
                      <span style={{ fontSize:13, color:"#fff", fontWeight:500 }}>
                        {employees.find(e => e.id === selectedEmployee)?.name ?? "Proprietário"}
                      </span>
                    </div>
                  )}
                  <div style={{ display:"flex", justifyContent:"space-between", borderTop:"1px solid #1F1F1F", paddingTop:8, marginTop:2 }}>
                    <span style={{ fontSize:13, color:"#71717A" }}>Total</span>
                    <span style={{ fontSize:14, fontWeight:700, color:"#fff" }}>{formatCurrency(totalSelected.price)}</span>
                  </div>
                </div>
              </div>

              {/* Dados pessoais */}
              <div style={{ backgroundColor:"#111111", border:"1px solid #1F1F1F", borderRadius:16, padding:20, marginBottom:16 }}>
                <p style={{ fontSize:11, fontWeight:600, color:"#52525B", margin:"0 0 14px", letterSpacing:"0.04em" }}>SEUS DADOS</p>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <FInput label="Nome completo" value={customerName} onChange={setCustomerName} placeholder="Ex: Maria Silva" required />
                  <FInput label="Telefone / WhatsApp" value={customerPhone} onChange={setCustomerPhone} placeholder="(47) 99999-9999" required type="tel" />
                  <FInput label="E-mail (opcional)" value={customerEmail} onChange={setCustomerEmail} placeholder="maria@email.com" type="email" />
                </div>
              </div>

              {/* Dados do veículo */}
              <div style={{ backgroundColor:"#111111", border:"1px solid #1F1F1F", borderRadius:16, padding:20, marginBottom:16 }}>
                <p style={{ fontSize:11, fontWeight:600, color:"#52525B", margin:"0 0 14px", letterSpacing:"0.04em" }}>DADOS DO VEÍCULO</p>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <FInput label="Placa" value={vehiclePlate} onChange={setVehiclePlate} placeholder="ABC-1234" required />
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <FInput label="Marca" value={vehicleBrand} onChange={setVehicleBrand} placeholder="Ex: Toyota" required />
                    <FInput label="Modelo" value={vehicleModel} onChange={setVehicleModel} placeholder="Ex: Corolla" required />
                  </div>
                  <FInput label="Cor (opcional)" value={vehicleColor} onChange={setVehicleColor} placeholder="Ex: Prata" />
                  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    <label style={{ fontSize:11, fontWeight:500, color:"#71717A" }}>Tipo</label>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {VEHICLE_TYPES.map(t => (
                        <button key={t} onClick={() => setVehicleType(t)} style={{ height:34, padding:"0 14px", borderRadius:8, fontSize:12, fontWeight: vehicleType === t ? 600 : 400, border:"1px solid", borderColor: vehicleType === t ? "rgba(0,102,255,0.4)" : "#2A2A2A", backgroundColor: vehicleType === t ? "rgba(0,102,255,0.08)" : "transparent", color: vehicleType === t ? "#fff" : "#71717A", cursor:"pointer", fontFamily:"inherit" }}>
                          {VEHICLE_TYPE_LABELS[t]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {submitError && (
                <div style={{ backgroundColor:"rgba(239,68,68,0.07)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:12, padding:"11px 16px", marginBottom:16, fontSize:13, color:"#EF4444" }}>
                  {submitError}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ width:"100%", height:52, borderRadius:14, border:"none", background: submitting ? "#161616" : "linear-gradient(135deg,#0066FF,#7C3AED)", color: submitting ? "#3F3F46" : "#fff", fontSize:15, fontWeight:700, cursor: submitting ? "not-allowed" : "pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}
              >
                {submitting ? (
                  <><div style={{ width:16, height:16, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.2)", borderTopColor:"#fff", animation:"spinAg 0.7s linear infinite" }} /> Agendando...</>
                ) : "Confirmar agendamento →"}
              </button>
            </div>
          )}

          {/* ═══════ STEP 3 — Confirmação ═══════ */}
          {step === 3 && (
            <div style={{ animation:"fadeAg 0.25s ease", textAlign:"center", paddingTop:40 }}>
              <div style={{ width:80, height:80, borderRadius:"50%", background:"linear-gradient(135deg,#0066FF,#7C3AED)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 24px" }}>
                <CheckCircle2 size={40} color="#fff" />
              </div>
              <h1 style={{ fontSize:28, fontWeight:800, color:"#fff", margin:"0 0 10px", letterSpacing:"-0.5px" }}>Agendamento confirmado!</h1>
              <p style={{ fontSize:15, color:"#71717A", margin:"0 0 32px", lineHeight:1.6 }}>
                Entraremos em contato para confirmar. Até lá!
              </p>
              <div style={{ backgroundColor:"#111111", border:"1px solid #1F1F1F", borderRadius:16, padding:24, marginBottom:24, textAlign:"left" }}>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:13, color:"#71717A" }}>Serviço</span>
                    <span style={{ fontSize:13, color:"#fff", fontWeight:500 }}>{selectedServices.map(s=>s.name).join(", ")}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:13, color:"#71717A" }}>Data e horário</span>
                    <span style={{ fontSize:13, color:"#fff", fontWeight:500 }}>{new Date(selectedDate+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"long"})} às {selectedSlot}</span>
                  </div>
                  {showEmployeeStep && (
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontSize:13, color:"#71717A" }}>Profissional</span>
                      <span style={{ fontSize:13, color:"#fff", fontWeight:500 }}>
                        {employees.find(e => e.id === selectedEmployee)?.name ?? "Proprietário"}
                      </span>
                    </div>
                  )}
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:13, color:"#71717A" }}>Total</span>
                    <span style={{ fontSize:14, fontWeight:700, color:"#fff" }}>{formatCurrency(totalSelected.price)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => router.push(`/${slug}`)}
                style={{ width:"100%", height:48, borderRadius:12, border:"1px solid #2A2A2A", backgroundColor:"transparent", color:"#A1A1AA", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}
              >
                Voltar para a loja
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}