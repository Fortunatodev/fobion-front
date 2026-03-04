"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Clock, MapPin, Phone, Mail, Crown, CheckCircle2, Percent } from "lucide-react"
import { isCustomerAuthenticated } from "@/lib/customer-auth"
import type { PublicBusiness } from "@/types"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

const DAY_LABELS: Record<number, string> = {
  0: "Domingo", 1: "Segunda-feira", 2: "Terça-feira",
  3: "Quarta-feira", 4: "Quinta-feira", 5: "Sexta-feira", 6: "Sábado",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "")
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
}

function formatDuration(min: number) {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${m}min` : `${h}h`
}

function isOpenNow(hours: PublicBusiness["hours"]) {
  const now   = new Date()
  const dow   = now.getDay()
  const hhmm  = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  const today = hours.find(h => h.dayOfWeek === dow)
  if (!today || !today.isOpen) return false
  return hhmm >= today.openTime && hhmm <= today.closeTime
}

function sortHours(hours: PublicBusiness["hours"]) {
  const order = [1, 2, 3, 4, 5, 6, 0]
  return [...hours].sort((a, b) => order.indexOf(a.dayOfWeek) - order.indexOf(b.dayOfWeek))
}

// ── Extended type ─────────────────────────────────────────────────────────────

type BusinessWithTheme = PublicBusiness & {
  ownerAvatarUrl?: string | null
  themeColor?:     string | null
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SlugPage() {
  const { slug } = useParams() as { slug: string }
  const router   = useRouter()

  const [business,         setBusiness]         = useState<BusinessWithTheme | null>(null)
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState("")
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [authed,           setAuthed]           = useState(false)
  const [isMobile,         setIsMobile]         = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

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
    <div style={{ minHeight: "100vh", backgroundColor: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #1F1F1F", borderTopColor: "#0066FF", animation: "sp 0.7s linear infinite" }} />
      <p style={{ fontSize: 14, color: "#52525B" }}>Carregando vitrine...</p>
    </div>
  )

  if (error || !business) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <p style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>Loja não encontrada</p>
      <p style={{ fontSize: 14, color: "#71717A" }}>{error || "Verifique o endereço e tente novamente."}</p>
    </div>
  )

  const open           = isOpenNow(business.hours)
  const sortedHours    = sortHours(business.hours)
  const hasPlans       = (business.plans?.length ?? 0) > 0
  const ownerAvatarUrl = business.ownerAvatarUrl

  // ── TEMA ──────────────────────────────────────────────────────────────────
  const theme    = business.themeColor ?? "#0066FF"
  const themeRgb = hexToRgb(theme)

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
          33%     { transform:translate(calc(-50% + 20px),-30px); }
          66%     { transform:translate(calc(-50% - 15px),20px); }
        }
        @keyframes floatOrb2 {
          0%,100% { transform:translate(0,0); }
          50%     { transform:translate(-25px,25px); }
        }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ backgroundColor: "#0A0A0A", color: "#fff", fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif" }}>

        {/* ── HERO ── */}
        <section style={{ position: "relative", minHeight: "92vh", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>

          <div style={{ position: "absolute", inset: 0, backgroundColor: "#0A0A0A", pointerEvents: "none" }}>
            <div style={{ position: "absolute", top: "-20%", left: "50%", width: isMobile ? 400 : 800, height: isMobile ? 400 : 800, borderRadius: "50%", background: `radial-gradient(circle, rgba(${themeRgb},0.08) 0%, transparent 70%)`, animation: "floatOrb1 12s ease-in-out infinite" }} />
            <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: isMobile ? 260 : 500, height: isMobile ? 260 : 500, borderRadius: "50%", background: `radial-gradient(circle, rgba(${themeRgb},0.05) 0%, transparent 70%)`, animation: "floatOrb2 15s ease-in-out infinite" }} />
            <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
          </div>

          <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: isMobile ? "100px 20px 60px" : "0 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>

            {/* Badge status */}
            <div style={{ marginBottom: 24, display: "inline-flex" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", backgroundColor: open ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${open ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`, borderRadius: 100, padding: "6px 14px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: open ? "#10B981" : "#EF4444", animation: open ? "pulseGreen 2s infinite" : "none" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: open ? "#10B981" : "#EF4444" }}>
                  {open ? "Aberto agora" : "Fechado no momento"}
                </span>
              </div>
            </div>

            {/* Avatar */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <div style={{ position: "relative" }}>
                {ownerAvatarUrl ? (
                  <img src={ownerAvatarUrl} alt={business.name} style={{ width: isMobile ? 72 : 88, height: isMobile ? 72 : 88, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", display: "block" }} />
                ) : (
                  <div style={{ width: isMobile ? 72 : 88, height: isMobile ? 72 : 88, borderRadius: "50%", background: `linear-gradient(135deg, ${theme}, ${theme}99)`, border: "3px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 26 : 32, fontWeight: 800, color: "#fff" }}>
                    {business.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {open && (
                  <div style={{ position: "absolute", bottom: 2, right: 2, width: 18, height: 18, borderRadius: "50%", backgroundColor: "#10B981", border: "2px solid #0A0A0A" }} />
                )}
              </div>
            </div>

            <h1 style={{ fontSize: "clamp(28px, 8vw, 72px)", fontWeight: 900, color: "#fff", letterSpacing: "-2px", lineHeight: 1.05, margin: "16px 0 20px", width: "100%" }}>
              {business.name}
            </h1>

            {business.description && (
              <p style={{ fontSize: isMobile ? 14 : 17, color: "rgba(255,255,255,0.55)", maxWidth: 520, lineHeight: 1.7, margin: "0 0 32px" }}>
                {business.description}
              </p>
            )}

            {/* Info badges */}
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 8 : 16, justifyContent: "center", alignItems: "center", marginBottom: 28, flexWrap: "wrap" }}>
              {business.phone   && <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#71717A" }}><Phone size={12} /> {business.phone}</span>}
              {business.email   && <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#71717A" }}><Mail size={12} /> {business.email}</span>}
              {business.address && <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#71717A" }}><MapPin size={12} /> {business.address}</span>}
            </div>

            {/* CTAs */}
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10, justifyContent: "center", alignItems: "center", width: isMobile ? "100%" : "auto" }}>
              <button
                onClick={() => document.getElementById("servicos")?.scrollIntoView({ behavior: "smooth" })}
                style={{ width: isMobile ? "100%" : "auto", height: 48, padding: "0 24px", borderRadius: 14, backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Ver serviços
              </button>
              <button
                onClick={() => authed ? document.getElementById("servicos")?.scrollIntoView({ behavior: "smooth" }) : router.push(`/${slug}/login`)}
                style={{ width: isMobile ? "100%" : "auto", height: 48, padding: "0 28px", borderRadius: 14, background: theme, color: "#fff", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", boxShadow: `0 4px 24px rgba(${themeRgb}, 0.35)`, fontFamily: "inherit" }}
              >
                Agendar agora →
              </button>
            </div>

            {!isMobile && (
              <div style={{ marginTop: 64, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ width: 1, height: 40, background: `linear-gradient(${theme}, transparent)`, animation: "scrollPulse 2s ease-in-out infinite" }} />
                <span style={{ fontSize: 10, color: "#3F3F46", letterSpacing: 1 }}>ROLE</span>
              </div>
            )}
          </div>
        </section>

        {/* ── SERVIÇOS ── */}
        <section id="servicos" style={{ padding: isMobile ? "64px 16px" : "96px 24px", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: isMobile ? 32 : 48 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: theme, letterSpacing: 3, backgroundColor: `rgba(${themeRgb},0.08)`, border: `1px solid rgba(${themeRgb},0.15)`, padding: "5px 12px", borderRadius: 100 }}>
              SERVIÇOS
            </span>
            <h2 style={{ fontSize: "clamp(24px,4vw,40px)", fontWeight: 900, color: "#fff", letterSpacing: "-1px", margin: "12px 0 0" }}>O que oferecemos</h2>
            <p style={{ fontSize: isMobile ? 13 : 15, color: "#71717A", marginTop: 10 }}>Selecione os serviços e agende com um clique</p>
          </div>

          {business.services.length === 0 ? (
            <p style={{ textAlign: "center", fontSize: 16, color: "#52525B", padding: "64px 0" }}>Nenhum serviço disponível no momento.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: isMobile ? 12 : 16 }}>
              {business.services.map(service => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  isSelected={selectedServices.includes(service.id)}
                  onToggle={() => toggleService(service.id)}
                  theme={theme}
                  themeRgb={themeRgb}
                  isMobile={isMobile}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── PLANOS ── */}
        {hasPlans && (
          <section id="planos" style={{ backgroundColor: "#0D0D0D", borderTop: "1px solid #161616" }}>
            <div style={{ padding: isMobile ? "64px 16px" : "96px 24px", maxWidth: 1100, margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: isMobile ? 32 : 48 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#7C3AED", letterSpacing: 3, backgroundColor: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)", padding: "5px 12px", borderRadius: 100 }}>
                  FIDELIDADE
                </span>
                <h2 style={{ fontSize: "clamp(24px,4vw,40px)", fontWeight: 900, color: "#fff", letterSpacing: "-1px", margin: "12px 0 0" }}>Vire assinante, economize sempre</h2>
                <p style={{ fontSize: isMobile ? 13 : 15, color: "#71717A", marginTop: 10 }}>Planos mensais com desconto em todos os serviços</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
                {business.plans!.map(plan => (
                  <PlanCard key={plan.id} plan={plan} slug={slug} authed={authed} router={router} theme={theme} themeRgb={themeRgb} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── HORÁRIOS ── */}
        <section id="horarios" style={{ padding: isMobile ? "64px 16px" : "96px 24px", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: isMobile ? 32 : 64, flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 280px" }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#52525B", letterSpacing: 3, backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "5px 12px", borderRadius: 100 }}>
                HORÁRIOS
              </span>
              <h2 style={{ fontSize: "clamp(22px,3vw,36px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.5px", margin: "12px 0 0" }}>Quando estamos abertos</h2>
              <p style={{ fontSize: isMobile ? 13 : 15, color: "#71717A", marginTop: 10, lineHeight: 1.6 }}>Agende com antecedência e garanta seu horário.</p>
              {open && (
                <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#10B981", animation: "pulseGreen 2s infinite" }} />
                  <span style={{ fontSize: 14, color: "#10B981", fontWeight: 600 }}>Abertos agora para atendimento!</span>
                </div>
              )}
              <button
                onClick={() => document.getElementById("servicos")?.scrollIntoView({ behavior: "smooth" })}
                style={{ marginTop: 24, height: 46, padding: "0 20px", borderRadius: 12, background: `linear-gradient(135deg, ${theme}, ${theme}CC)`, color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", boxShadow: `0 4px 16px rgba(${themeRgb}, 0.3)` }}
              >
                Agendar horário →
              </button>
            </div>

            <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 8 }}>
              {sortedHours.map(h => {
                const isHoje = new Date().getDay() === h.dayOfWeek
                return (
                  // ✅ key={h.dayOfWeek} — dayOfWeek é único (0–6), não precisa de .id
                  <div
                    key={h.dayOfWeek}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: isMobile ? "10px 14px" : "14px 18px", borderRadius: 14, backgroundColor: isHoje ? `rgba(${themeRgb},0.06)` : "transparent", border: isHoje ? `1px solid rgba(${themeRgb},0.2)` : "1px solid #161616" }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: h.isOpen ? "#10B981" : "#2A2A2A" }} />
                      <span style={{ fontSize: isMobile ? 13 : 14, color: isHoje ? "#fff" : "#A1A1AA", fontWeight: isHoje ? 600 : 400 }}>
                        {DAY_LABELS[h.dayOfWeek]}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {isHoje && (
                        <span style={{ fontSize: 10, color: theme, fontWeight: 700, backgroundColor: `rgba(${themeRgb},0.1)`, padding: "2px 6px", borderRadius: 4 }}>
                          hoje
                        </span>
                      )}
                      <span style={{ fontSize: isMobile ? 12 : 14, fontWeight: 600, color: h.isOpen ? (isHoje ? theme : "#71717A") : "#2A2A2A" }}>
                        {h.isOpen ? `${h.openTime} – ${h.closeTime}` : "Fechado"}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: "1px solid #111" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "24px 16px" : "32px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>{business.name}</p>
              <p style={{ fontSize: 12, color: "#2A2A2A", marginTop: 4 }}>Powered by Forbion</p>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              {business.phone   && <a href={`tel:${business.phone}`}    style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: "#52525B", textDecoration: "none" }}><Phone size={13} color="#3F3F46" />{business.phone}</a>}
              {business.email   && <a href={`mailto:${business.email}`} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: "#52525B", textDecoration: "none" }}><Mail size={13} color="#3F3F46" />{business.email}</a>}
              {business.address && <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: "#52525B" }}><MapPin size={13} color="#3F3F46" />{business.address}</span>}
            </div>
          </div>
        </footer>
      </div>

      {/* ── BARRA FLUTUANTE ── */}
      {selectedServices.length > 0 && (
        <FloatingBar
          count={selectedServices.length}
          totalCents={totalCents}
          totalMinutes={totalMinutes}
          theme={theme}
          themeRgb={themeRgb}
          isMobile={isMobile}
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
    </>
  )
}

/* ── Sub-componentes ─────────────────────────────────────────────────────────── */

function ServiceCard({
  service, isSelected, onToggle, theme, themeRgb, isMobile,
}: {
  service: any; isSelected: boolean; onToggle: () => void
  theme: string; themeRgb: string; isMobile: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ overflow: "hidden", borderRadius: 20, cursor: "pointer", border: isSelected ? `2px solid ${theme}` : "2px solid transparent", backgroundColor: isSelected ? `rgba(${themeRgb},0.05)` : "#111111", transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)", transform: hovered ? "translateY(-4px)" : "translateY(0)", boxShadow: isSelected ? `0 8px 32px rgba(${themeRgb},0.2)` : hovered ? "0 20px 48px rgba(0,0,0,0.5)" : "none" }}
    >
      <div style={{ position: "relative", height: isMobile ? 160 : 200, overflow: "hidden" }}>
        {service.imageUrl ? (
          <>
            <img src={service.imageUrl} alt={service.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, #111111 100%)" }} />
          </>
        ) : (
          <div style={{ height: isMobile ? 160 : 200, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#111111,#161616)" }}>
            <span style={{ fontSize: 56, fontWeight: 900, color: "#1F1F1F" }}>{service.name.charAt(0)}</span>
          </div>
        )}
        <div style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: "50%", backgroundColor: isSelected ? theme : "rgba(0,0,0,0.5)", border: isSelected ? "none" : "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isSelected ? `0 0 16px rgba(${themeRgb},0.5)` : "none" }}>
          {isSelected && <CheckCircle2 size={14} color="#fff" />}
        </div>
      </div>
      <div style={{ padding: isMobile ? "12px 14px 16px" : "16px 20px 20px" }}>
        <p style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: "#fff", margin: 0 }}>{service.name}</p>
        {service.description && (
          <p style={{ fontSize: 13, color: "#71717A", marginTop: 6, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {service.description}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <span style={{ fontSize: isMobile ? 17 : 20, fontWeight: 900, color: "#fff" }}>
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(service.price / 100)}
          </span>
          <div style={{ display: "flex", gap: 5, alignItems: "center", backgroundColor: "#161616", border: "1px solid #1F1F1F", padding: "5px 10px", borderRadius: 8 }}>
            <Clock size={12} color="#52525B" />
            <span style={{ fontSize: 12, color: "#71717A" }}>{formatDuration(service.durationMinutes)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PlanCard({
  plan, slug, authed, router, theme, themeRgb,
}: {
  plan: any; slug: string; authed: boolean; router: any
  theme: string; themeRgb: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: "relative", overflow: "hidden", borderRadius: 24, padding: 28, background: `linear-gradient(135deg, rgba(${themeRgb},0.06), rgba(${themeRgb},0.03))`, border: hovered ? `1px solid rgba(${themeRgb},0.4)` : `1px solid rgba(${themeRgb},0.2)`, transition: "all 0.2s ease", transform: hovered ? "translateY(-3px)" : "translateY(0)" }}
    >
      <div style={{ position: "absolute", top: -60, right: -60, width: 160, height: 160, borderRadius: "50%", background: `radial-gradient(circle, rgba(${themeRgb},0.12), transparent)`, pointerEvents: "none" }} />
      <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${theme}, ${theme}99)`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <Crown size={22} color="#fff" />
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>{plan.name}</h3>
      {plan.description && <p style={{ fontSize: 13, color: "#71717A", marginTop: 8, lineHeight: 1.6 }}>{plan.description}</p>}
      <div style={{ marginTop: 20, display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: "-1px" }}>
          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(plan.price / 100)}
        </span>
        <span style={{ fontSize: 14, color: "#52525B" }}>/{plan.interval === "MONTHLY" ? "mês" : "ano"}</span>
      </div>
      {plan.discountPercent > 0 && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, alignItems: "center", backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 8, padding: "6px 10px" }}>
          <Percent size={12} color="#10B981" />
          <span style={{ fontSize: 12, color: "#10B981", fontWeight: 600 }}>{plan.discountPercent}% off em todos os serviços</span>
        </div>
      )}
      <button
        onClick={() => authed ? router.push(`/${slug}/minha-conta?tab=planos`) : router.push(`/${slug}/login?redirect=planos`)}
        style={{ marginTop: 20, width: "100%", height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${theme}, ${theme}CC)`, color: "#fff", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit", boxShadow: `0 4px 20px rgba(${themeRgb},0.3)` }}
      >
        Assinar plano →
      </button>
    </div>
  )
}

function FloatingBar({
  count, totalCents, totalMinutes, theme, themeRgb, isMobile, onClear, onSchedule,
}: {
  count: number; totalCents: number; totalMinutes: number
  theme: string; themeRgb: string; isMobile: boolean
  onClear: () => void; onSchedule: () => void
}) {
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)", backgroundColor: "rgba(10,10,10,0.97)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderTop: "1px solid rgba(255,255,255,0.08)", padding: isMobile ? "12px 16px" : "16px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 10 : 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: isMobile ? 13 : 15, fontWeight: 700, color: "#fff", margin: 0 }}>
              {count} serviço{count > 1 ? "s" : ""} selecionado{count > 1 ? "s" : ""}
            </p>
            <p style={{ fontSize: 13, color: "#71717A", margin: "3px 0 0" }}>
              Total: {formatCurrency(totalCents)} · {formatDuration(totalMinutes)}
            </p>
          </div>
          {isMobile && (
            <button onClick={onClear} style={{ background: "none", border: "none", color: "#52525B", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
              Limpar
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexDirection: isMobile ? "column" : "row" }}>
          {!isMobile && (
            <button onClick={onClear} style={{ height: 40, padding: "0 14px", borderRadius: 10, backgroundColor: "transparent", border: "1px solid #252525", color: "#71717A", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Limpar
            </button>
          )}
          <button
            onClick={onSchedule}
            style={{ width: isMobile ? "100%" : "auto", height: 48, padding: "0 28px", borderRadius: 14, background: theme, color: "#fff", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", boxShadow: `0 4px 24px rgba(${themeRgb}, 0.4)`, fontFamily: "inherit" }}
          >
            Agendar agora →
          </button>
        </div>
      </div>
    </div>
  )
}