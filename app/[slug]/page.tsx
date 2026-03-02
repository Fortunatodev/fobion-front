"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Clock, MapPin, Phone, Mail, Crown, CheckCircle2, Percent } from "lucide-react"
import { isCustomerAuthenticated } from "@/lib/customer-auth"
import type { PublicBusiness } from "@/types"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

const DAY_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(cents / 100)
}

function formatDuration(min: number) {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${m}min` : `${h}h`
}

function isOpenNow(hours: PublicBusiness["hours"]) {
  const now  = new Date()
  const dow  = now.getDay()
  const hhmm = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`
  const today = hours.find(h => h.dayOfWeek === dow)
  if (!today || !today.isOpen) return false
  return hhmm >= today.openTime && hhmm <= today.closeTime
}

function sortHours(hours: PublicBusiness["hours"]) {
  const order = [1,2,3,4,5,6,0]
  return [...hours].sort((a,b) => order.indexOf(a.dayOfWeek) - order.indexOf(b.dayOfWeek))
}

export default function SlugPage() {
  const { slug }  = useParams() as { slug: string }
  const router    = useRouter()

  const [business,         setBusiness]         = useState<PublicBusiness | null>(null)
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState("")
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [authed,           setAuthed]           = useState(false)

  // Reativo — igual ao layout
  const checkAuth = useCallback(() => setAuthed(isCustomerAuthenticated()), [])

  useEffect(() => {
    checkAuth()
    window.addEventListener("storage", checkAuth)
    window.addEventListener("focus",   checkAuth)
    return () => {
      window.removeEventListener("storage", checkAuth)
      window.removeEventListener("focus",   checkAuth)
    }
  }, [checkAuth])

  useEffect(() => {
    if (!slug) return
    fetch(`${API}/api/public/${slug}`)
      .then(r => {
        if (!r.ok) throw new Error("Loja não encontrada")
        return r.json()
      })
      .then(d => setBusiness(d.business))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  const toggleService = useCallback((id: string) => {
    setSelectedServices(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }, [])

  const totalCents   = selectedServices.reduce((acc, id) => acc + (business?.services.find(s => s.id === id)?.price ?? 0), 0)
  const totalMinutes = selectedServices.reduce((acc, id) => acc + (business?.services.find(s => s.id === id)?.durationMinutes ?? 0), 0)

  if (loading) return (
    <div style={{ minHeight:"100vh", backgroundColor:"#0A0A0A", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16, fontFamily:"'Inter',-apple-system,sans-serif" }}>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:40, height:40, borderRadius:"50%", border:"3px solid #1F1F1F", borderTopColor:"#0066FF", animation:"sp 0.7s linear infinite" }} />
      <p style={{ fontSize:14, color:"#52525B" }}>Carregando vitrine...</p>
    </div>
  )

  if (error || !business) return (
    <div style={{ minHeight:"100vh", backgroundColor:"#0A0A0A", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16, fontFamily:"'Inter',-apple-system,sans-serif" }}>
      <p style={{ fontSize:20, fontWeight:700, color:"#fff" }}>Loja não encontrada</p>
      <p style={{ fontSize:14, color:"#71717A" }}>{error || "Verifique o endereço e tente novamente."}</p>
    </div>
  )

  const open        = isOpenNow(business.hours)
  const sortedHours = sortHours(business.hours)
  const hasPlans    = (business.plans?.length ?? 0) > 0

  return (
    <>
      <style>{`
        @keyframes pulseGreen {
          0%,100% { opacity:1; transform:scale(1); box-shadow:0 0 8px rgba(16,185,129,.6); }
          50%      { opacity:.8; transform:scale(1.2); box-shadow:0 0 16px rgba(16,185,129,.8); }
        }
        @keyframes scrollPulse {
          0%,100% { opacity:0; transform:scaleY(0); transform-origin:top; }
          50%      { opacity:1; transform:scaleY(1); }
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes floatOrb1 {
          0%,100% { transform:translate(-50%,0); }
          33%      { transform:translate(calc(-50% + 20px),-30px); }
          66%      { transform:translate(calc(-50% - 15px),20px); }
        }
        @keyframes floatOrb2 {
          0%,100% { transform:translate(0,0); }
          50%      { transform:translate(-25px,25px); }
        }
      `}</style>

      <div style={{ backgroundColor:"#0A0A0A", color:"#fff", fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif" }}>

        {/* ═══════════════════════════════════════
            HERO — FIX 3: limpo, sem contatos, centralizado
        ═══════════════════════════════════════ */}
        <section style={{ position:"relative", minHeight:"92vh", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center" }}>

          {/* Fundo */}
          <div style={{ position:"absolute", inset:0, backgroundColor:"#0A0A0A", pointerEvents:"none" }}>
            <div style={{ position:"absolute", top:"-20%", left:"50%", width:800, height:800, borderRadius:"50%", background:"radial-gradient(circle, rgba(0,102,255,0.08) 0%, transparent 70%)", animation:"floatOrb1 12s ease-in-out infinite" }} />
            <div style={{ position:"absolute", bottom:"-10%", right:"-10%", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)", animation:"floatOrb2 15s ease-in-out infinite" }} />
            <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)", backgroundSize:"60px 60px" }} />
          </div>

          {/* FIX 3 — conteúdo hero centralizado, sem contatos */}
          <div style={{
            position:"relative", zIndex:1,
            maxWidth:900, margin:"0 auto", padding:"0 24px",
            textAlign:"center",
            display:"flex", flexDirection:"column", alignItems:"center",
            gap:0,
          }}>

            {/* Badge status */}
            <div style={{ marginBottom:24, display:"inline-flex" }}>
              <div style={{ display:"flex", gap:8, alignItems:"center", backgroundColor: open ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border:`1px solid ${open ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`, borderRadius:100, padding:"6px 14px" }}>
                <div style={{ width:8, height:8, borderRadius:"50%", backgroundColor: open ? "#10B981" : "#EF4444", animation: open ? "pulseGreen 2s infinite" : "none", boxShadow: open ? "0 0 8px rgba(16,185,129,0.6)" : "none" }} />
                <span style={{ fontSize:12, fontWeight:600, color: open ? "#10B981" : "#EF4444" }}>
                  {open ? "Aberto agora" : "Fechado no momento"}
                </span>
              </div>
            </div>

            {/* FIX 3 — h1 com largura total */}
            <h1 style={{
              fontSize:"clamp(36px,7vw,72px)",
              fontWeight:900, color:"#fff",
              letterSpacing:"-2px", lineHeight:1.05,
              margin:"16px 0 20px", width:"100%",
            }}>
              {business.name}
            </h1>

            {/* FIX 3 — descrição com margin bottom limpa */}
            {business.description && (
              <p style={{
                fontSize:17,
                color:"rgba(255,255,255,0.55)",
                maxWidth:520, lineHeight:1.7,
                margin:"0 0 32px",
              }}>
                {business.description}
              </p>
            )}

            {/* FIX 3 — CTAs sem margin top quando há descrição */}
            <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
              <button
                onClick={() => document.getElementById("servicos")?.scrollIntoView({ behavior:"smooth" })}
                style={{ height:48, padding:"0 24px", borderRadius:14, backgroundColor:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", color:"#fff", fontSize:15, fontWeight:600, cursor:"pointer", backdropFilter:"blur(10px)", transition:"background 0.2s ease", fontFamily:"inherit" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,255,255,0.12)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,255,255,0.08)" }}
              >
                Ver serviços
              </button>
              <button
                onClick={() => {
                  if (authed) {
                    document.getElementById("servicos")?.scrollIntoView({ behavior:"smooth" })
                  } else {
                    router.push(`/${slug}/login`)
                  }
                }}
                style={{ height:48, padding:"0 28px", borderRadius:14, background:"linear-gradient(135deg,#0066FF,#7C3AED)", color:"#fff", fontSize:15, fontWeight:700, border:"none", cursor:"pointer", transition:"transform 0.2s ease, box-shadow 0.2s ease", boxShadow:"0 4px 24px rgba(0,102,255,0.35)", fontFamily:"inherit" }}
                onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.transform="scale(1.03)"; b.style.boxShadow="0 8px 32px rgba(0,102,255,0.5)" }}
                onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.transform="scale(1)"; b.style.boxShadow="0 4px 24px rgba(0,102,255,0.35)" }}
              >
                Agendar agora →
              </button>
            </div>

            {/* Scroll indicator */}
            <div style={{ marginTop:64, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
              <div style={{ width:1, height:40, background:"linear-gradient(#0066FF, transparent)", animation:"scrollPulse 2s ease-in-out infinite" }} />
              <span style={{ fontSize:10, color:"#3F3F46", letterSpacing:1 }}>ROLE</span>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════
            SEÇÃO 2 — SERVIÇOS
        ═══════════════════════════════════════ */}
        <section id="servicos" style={{ padding:"96px 24px", maxWidth:1100, margin:"0 auto" }}>

          <div style={{ textAlign:"center", marginBottom:48 }}>
            <div style={{ display:"inline-block", marginBottom:12 }}>
              <span style={{ fontSize:11, fontWeight:800, color:"#0066FF", letterSpacing:3, backgroundColor:"rgba(0,102,255,0.08)", border:"1px solid rgba(0,102,255,0.15)", padding:"5px 12px", borderRadius:100 }}>
                SERVIÇOS
              </span>
            </div>
            <h2 style={{ fontSize:"clamp(28px,4vw,40px)", fontWeight:900, color:"#fff", letterSpacing:"-1px", margin:"8px 0 0" }}>
              O que oferecemos
            </h2>
            <p style={{ fontSize:15, color:"#71717A", marginTop:10 }}>
              Selecione os serviços e agende com um clique
            </p>
          </div>

          {business.services.length === 0 ? (
            <div style={{ textAlign:"center", padding:"64px 0" }}>
              <p style={{ fontSize:16, color:"#52525B" }}>Nenhum serviço disponível no momento.</p>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
              {business.services.map(service => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  isSelected={selectedServices.includes(service.id)}
                  onToggle={() => toggleService(service.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════
            SEÇÃO 3 — PLANOS
        ═══════════════════════════════════════ */}
        {hasPlans && (
          <section id="planos" style={{ backgroundColor:"#0D0D0D", borderTop:"1px solid #161616" }}>
            <div style={{ padding:"96px 24px", maxWidth:1100, margin:"0 auto" }}>
              <div style={{ textAlign:"center", marginBottom:48 }}>
                <div style={{ display:"inline-block", marginBottom:12 }}>
                  <span style={{ fontSize:11, fontWeight:800, color:"#7C3AED", letterSpacing:3, backgroundColor:"rgba(124,58,237,0.08)", border:"1px solid rgba(124,58,237,0.15)", padding:"5px 12px", borderRadius:100 }}>
                    FIDELIDADE
                  </span>
                </div>
                <h2 style={{ fontSize:"clamp(28px,4vw,40px)", fontWeight:900, color:"#fff", letterSpacing:"-1px", margin:"8px 0 0" }}>
                  Vire assinante, economize sempre
                </h2>
                <p style={{ fontSize:15, color:"#71717A", marginTop:10 }}>
                  Planos mensais com desconto em todos os serviços
                </p>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:20 }}>
                {business.plans!.map(plan => (
                  <PlanCard key={plan.id} plan={plan} slug={slug} authed={authed} router={router} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════
            SEÇÃO 4 — HORÁRIOS
        ═══════════════════════════════════════ */}
        <section id="horarios" style={{ padding:"96px 24px", maxWidth:1100, margin:"0 auto" }}>
          <div style={{ display:"flex", gap:64, flexWrap:"wrap", alignItems:"flex-start" }}>

            <div style={{ flex:"1 1 280px" }}>
              <div style={{ display:"inline-block", marginBottom:12 }}>
                <span style={{ fontSize:11, fontWeight:800, color:"#52525B", letterSpacing:3, backgroundColor:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", padding:"5px 12px", borderRadius:100 }}>
                  HORÁRIOS
                </span>
              </div>
              <h2 style={{ fontSize:"clamp(24px,3vw,36px)", fontWeight:900, color:"#fff", letterSpacing:"-0.5px", margin:"8px 0 0" }}>
                Quando estamos abertos
              </h2>
              <p style={{ fontSize:15, color:"#71717A", marginTop:10, lineHeight:1.6 }}>
                Agende com antecedência e garanta seu horário.
              </p>
              {open && (
                <div style={{ marginTop:20, display:"flex", gap:10, alignItems:"center" }}>
                  <div style={{ width:10, height:10, borderRadius:"50%", backgroundColor:"#10B981", animation:"pulseGreen 2s infinite", boxShadow:"0 0 12px rgba(16,185,129,0.5)" }} />
                  <span style={{ fontSize:14, color:"#10B981", fontWeight:600 }}>Abertos agora para atendimento!</span>
                </div>
              )}
              <button
                onClick={() => document.getElementById("servicos")?.scrollIntoView({ behavior:"smooth" })}
                style={{ marginTop:24, height:46, padding:"0 20px", borderRadius:12, background:"linear-gradient(135deg,#0066FF,#7C3AED)", color:"#fff", fontSize:14, fontWeight:600, border:"none", cursor:"pointer", fontFamily:"inherit", transition:"transform 0.2s ease" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.02)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)" }}
              >
                Agendar horário →
              </button>
            </div>

            <div style={{ flex:"1 1 280px", display:"flex", flexDirection:"column", gap:8 }}>
              {sortedHours.map(h => {
                const isHoje = new Date().getDay() === h.dayOfWeek
                return (
                  <div
                    key={h.id}
                    style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px", borderRadius:14, transition:"background 0.15s ease", backgroundColor: isHoje ? "rgba(0,102,255,0.06)" : "transparent", border: isHoje ? "1px solid rgba(0,102,255,0.15)" : "1px solid #161616" }}
                  >
                    <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                      <div style={{ width:6, height:6, borderRadius:"50%", backgroundColor: h.isOpen ? "#10B981" : "#2A2A2A" }} />
                      <span style={{ fontSize:14, color: isHoje ? "#fff" : "#A1A1AA", fontWeight: isHoje ? 600 : 400 }}>
                        {DAY_LABELS[h.dayOfWeek]}
                      </span>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      {isHoje && (
                        <span style={{ fontSize:10, color:"#0066FF", fontWeight:700, backgroundColor:"rgba(0,102,255,0.1)", padding:"2px 6px", borderRadius:4 }}>
                          hoje
                        </span>
                      )}
                      <span style={{ fontSize:14, fontWeight:600, color: h.isOpen ? (isHoje ? "#0066FF" : "#71717A") : "#2A2A2A" }}>
                        {h.isOpen ? `${h.openTime} – ${h.closeTime}` : "Fechado"}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* FOOTER — contatos aqui, não no hero */}
        <footer style={{ borderTop:"1px solid #111" }}>
          <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16 }}>
            <div>
              <p style={{ fontSize:14, fontWeight:600, color:"#fff", margin:0 }}>{business.name}</p>
              <p style={{ fontSize:12, color:"#2A2A2A", marginTop:4 }}>Powered by Forbion</p>
            </div>
            <div style={{ display:"flex", gap:16, alignItems:"center", flexWrap:"wrap" }}>
              {business.phone && (
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <Phone size={13} color="#3F3F46" />
                  <a href={`tel:${business.phone}`} style={{ fontSize:13, color:"#52525B", textDecoration:"none", transition:"color 0.15s ease" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#A1A1AA" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#52525B" }}
                  >
                    {business.phone}
                  </a>
                </div>
              )}
              {business.email && (
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <Mail size={13} color="#3F3F46" />
                  <a href={`mailto:${business.email}`} style={{ fontSize:13, color:"#52525B", textDecoration:"none", transition:"color 0.15s ease" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#A1A1AA" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#52525B" }}
                  >
                    {business.email}
                  </a>
                </div>
              )}
              {business.address && (
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <MapPin size={13} color="#3F3F46" />
                  <span style={{ fontSize:13, color:"#52525B" }}>{business.address}</span>
                </div>
              )}
            </div>
          </div>
        </footer>

        {/* BARRA FLUTUANTE */}
        {selectedServices.length > 0 && (
          <FloatingBar
            count={selectedServices.length}
            totalCents={totalCents}
            totalMinutes={totalMinutes}
            onClear={() => setSelectedServices([])}
            onSchedule={() => {
              if (!authed) {
                localStorage.setItem("forbion_pending_services", JSON.stringify(selectedServices))
                router.push(`/${slug}/login?redirect=agendar`)
              } else {
                const qs = selectedServices.map(id => `services=${id}`).join("&")
                router.push(`/${slug}/agendar?${qs}`)
              }
            }}
          />
        )}
      </div>
    </>
  )
}

/* ── Sub-componentes ──────────────────────────────────────────── */

function ServiceCard({ service, isSelected, onToggle }: { service: any; isSelected: boolean; onToggle: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ overflow:"hidden", borderRadius:20, cursor:"pointer", border: isSelected ? "2px solid #0066FF" : "2px solid transparent", backgroundColor: isSelected ? "rgba(0,102,255,0.05)" : "#111111", transition:"all 0.2s cubic-bezier(0.16,1,0.3,1)", transform: hovered ? "translateY(-4px)" : "translateY(0)", boxShadow: hovered ? "0 20px 48px rgba(0,0,0,0.5)" : "none" }}
    >
      <div style={{ position:"relative", height:200, overflow:"hidden" }}>
        {service.imageUrl ? (
          <>
            <img src={service.imageUrl} alt={service.name} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, transparent 40%, #111111 100%)" }} />
          </>
        ) : (
          <div style={{ height:200, display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#111111,#161616)" }}>
            <span style={{ fontSize:56, fontWeight:900, color:"#1F1F1F" }}>{service.name.charAt(0)}</span>
          </div>
        )}
        <div style={{ position:"absolute", top:12, right:12, width:28, height:28, borderRadius:"50%", transition:"all 0.2s cubic-bezier(0.16,1,0.3,1)", backgroundColor: isSelected ? "#0066FF" : "rgba(0,0,0,0.5)", border: isSelected ? "none" : "1px solid rgba(255,255,255,0.15)", backdropFilter: isSelected ? "none" : "blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow: isSelected ? "0 0 16px rgba(0,102,255,0.5)" : "none" }}>
          {isSelected && <CheckCircle2 size={14} color="#fff" />}
        </div>
      </div>
      <div style={{ padding:"16px 20px 20px" }}>
        <p style={{ fontSize:16, fontWeight:700, color:"#fff", margin:0 }}>{service.name}</p>
        {service.description && (
          <p style={{ fontSize:13, color:"#71717A", marginTop:6, lineHeight:1.5, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
            {service.description}
          </p>
        )}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:16 }}>
          <span style={{ fontSize:20, fontWeight:900, color:"#fff" }}>
            {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(service.price/100)}
          </span>
          <div style={{ display:"flex", gap:5, alignItems:"center", backgroundColor:"#161616", border:"1px solid #1F1F1F", padding:"5px 10px", borderRadius:8 }}>
            <Clock size={12} color="#52525B" />
            <span style={{ fontSize:12, color:"#71717A" }}>
              {service.durationMinutes < 60
                ? `${service.durationMinutes}min`
                : `${Math.floor(service.durationMinutes/60)}h${service.durationMinutes%60>0?service.durationMinutes%60+"min":""}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PlanCard({ plan, slug, authed, router }: { plan: any; slug: string; authed: boolean; router: any }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position:"relative", overflow:"hidden", borderRadius:24, padding:28, background:"linear-gradient(135deg, rgba(124,58,237,0.08), rgba(0,102,255,0.08))", border: hovered ? "1px solid rgba(124,58,237,0.4)" : "1px solid rgba(124,58,237,0.2)", transition:"all 0.2s ease", transform: hovered ? "translateY(-3px)" : "translateY(0)" }}
    >
      <div style={{ position:"absolute", top:-60, right:-60, width:160, height:160, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,58,237,0.12), transparent)", pointerEvents:"none" }} />
      <div style={{ width:48, height:48, borderRadius:14, background:"linear-gradient(135deg,#7C3AED,#0066FF)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}>
        <Crown size={22} color="#fff" />
      </div>
      <h3 style={{ fontSize:20, fontWeight:800, color:"#fff", margin:0 }}>{plan.name}</h3>
      {plan.description && <p style={{ fontSize:13, color:"#71717A", marginTop:8, lineHeight:1.6 }}>{plan.description}</p>}
      <div style={{ marginTop:20, display:"flex", alignItems:"baseline", gap:4 }}>
        <span style={{ fontSize:36, fontWeight:900, color:"#fff", letterSpacing:"-1px" }}>
          {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(plan.price/100)}
        </span>
        <span style={{ fontSize:14, color:"#52525B" }}>/{plan.interval === "MONTHLY" ? "mês" : "ano"}</span>
      </div>
      {plan.discountPercent > 0 && (
        <div style={{ marginTop:10, display:"flex", gap:6, alignItems:"center", backgroundColor:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.15)", borderRadius:8, padding:"6px 10px" }}>
          <Percent size={12} color="#10B981" />
          <span style={{ fontSize:12, color:"#10B981", fontWeight:600 }}>{plan.discountPercent}% off em todos os serviços</span>
        </div>
      )}
      <button
        onClick={() => authed ? router.push(`/${slug}/minha-conta?tab=planos`) : router.push(`/${slug}/login?redirect=planos`)}
        style={{ marginTop:20, width:"100%", height:48, borderRadius:14, background:"linear-gradient(135deg,#7C3AED,#0066FF)", color:"#fff", fontSize:15, fontWeight:700, border:"none", cursor:"pointer", transition:"box-shadow 0.2s ease", boxShadow:"0 4px 20px rgba(124,58,237,0.3)", fontFamily:"inherit" }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 32px rgba(124,58,237,0.45)" }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(124,58,237,0.3)" }}
      >
        Assinar plano →
      </button>
    </div>
  )
}

function FloatingBar({ count, totalCents, totalMinutes, onClear, onSchedule }: { count: number; totalCents: number; totalMinutes: number; onClear: () => void; onSchedule: () => void }) {
  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:50, animation:"slideUp 0.3s cubic-bezier(0.16,1,0.3,1)", backgroundColor:"rgba(10,10,10,0.97)", backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)", borderTop:"1px solid rgba(255,255,255,0.08)", padding:"16px 24px" }}>
      <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center", gap:16, flexWrap:"wrap" }}>
        <div>
          <p style={{ fontSize:15, fontWeight:700, color:"#fff", margin:0 }}>
            {count} serviço{count > 1 ? "s" : ""} selecionado{count > 1 ? "s" : ""}
          </p>
          <p style={{ fontSize:13, color:"#71717A", margin:"3px 0 0" }}>
            Total: {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(totalCents/100)}
            {" · "}
            {totalMinutes < 60 ? `${totalMinutes}min` : `${Math.floor(totalMinutes/60)}h${totalMinutes%60>0?totalMinutes%60+"min":""}`}
          </p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onClear} style={{ height:40, padding:"0 14px", borderRadius:10, backgroundColor:"transparent", border:"1px solid #252525", color:"#71717A", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
            Limpar
          </button>
          <button
            onClick={onSchedule}
            style={{ height:48, padding:"0 28px", borderRadius:14, background:"linear-gradient(135deg,#0066FF,#7C3AED)", color:"#fff", fontSize:15, fontWeight:700, border:"none", cursor:"pointer", boxShadow:"0 4px 24px rgba(0,102,255,0.4)", transition:"transform 0.2s ease", fontFamily:"inherit" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.02)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)" }}
          >
            Agendar agora →
          </button>
        </div>
      </div>
    </div>
  )
}