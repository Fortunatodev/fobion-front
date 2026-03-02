"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Crown, Calendar, User, LogOut, AlertCircle, Percent, Clock } from "lucide-react"
import {
  getCustomerToken,
  removeCustomerToken,
  isCustomerAuthenticated,
  customerApiGet,
} from "@/lib/customer-auth"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDate(iso?: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function formatStatus(status: string) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    PENDING:     { label: "Pendente",     color: "#F59E0B", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)"  },
    CONFIRMED:   { label: "Confirmado",   color: "#0066FF", bg: "rgba(0,102,255,0.08)",   border: "rgba(0,102,255,0.2)"   },
    IN_PROGRESS: { label: "Em andamento", color: "#7C3AED", bg: "rgba(124,58,237,0.08)",  border: "rgba(124,58,237,0.2)"  },
    DONE:        { label: "Concluído",    color: "#10B981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.2)"  },
    CANCELLED:   { label: "Cancelado",    color: "#EF4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.2)"   },
  }
  return map[status] ?? { label: status, color: "#71717A", bg: "rgba(113,113,122,0.08)", border: "rgba(113,113,122,0.2)" }
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CustomerProfile {
  id: string; name: string; email?: string; phone: string; picture?: string
  _count?: { schedules: number; subscriptions: number }
}

interface Schedule {
  id: string; scheduledAt: string; status: string; totalPrice: number
  notes?: string; discountApplied?: number; isSubscriber?: boolean
  scheduleServices?: Array<{ service?: { name: string } }>
}

interface Plan {
  id: string; name: string; description?: string | null
  price: number; interval: string; discountPercent: number
  cactopayPaymentLink?: string | null
  isSubscribed: boolean
  mySubscription?: {
    id: string; status: string
    startedAt?: string | null; createdAt: string
    customerPlan?: { name: string; price: number; discountPercent: number }
  } | null
}

type TabId = "agendamentos" | "planos" | "perfil"

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ClientAreaPage() {
  const { slug }       = useParams() as { slug: string }
  const router         = useRouter()
  const searchParams   = useSearchParams()

  const [tab,          setTab]          = useState<TabId>("agendamentos")
  const [profile,      setProfile]      = useState<CustomerProfile | null>(null)
  const [schedules,    setSchedules]    = useState<Schedule[]>([])
  const [plans,        setPlans]        = useState<Plan[]>([])
  const [loading,      setLoading]      = useState(true)
  const [plansLoading, setPlansLoading] = useState(false)
  const [error,        setError]        = useState("")

  // ── Auth guard + tab inicial ─────────────────────────────────────────────
  useEffect(() => {
    if (!isCustomerAuthenticated()) {
      router.replace(`/${slug}/login`)
      return
    }
    const t = searchParams.get("tab") as TabId | null
    if (t && ["agendamentos", "planos", "perfil"].includes(t)) {
      setTab(t)
    }
  }, [slug, router, searchParams])

  // ── Fetch profile + schedules ────────────────────────────────────────────
  useEffect(() => {
    if (!isCustomerAuthenticated()) return

    setLoading(true)
    Promise.all([
      customerApiGet<{ customer: CustomerProfile }>("/customer/me"),
      customerApiGet<{ schedules: Schedule[] }>("/customer/schedules"),
    ])
      .then(([meData, schedulesData]) => {
        setProfile(meData.customer)
        setSchedules(schedulesData.schedules ?? [])
        setError("")
      })
      .catch((e: Error) => {
        if (e.message === "Sessão expirada" || e.message === "Não autenticado") {
          router.replace(`/${slug}/login?error=session_expired`)
          return
        }
        setError(e.message || "Erro ao carregar dados.")
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Fetch plans (lazy) ───────────────────────────────────────────────────
  const fetchPlans = useCallback(async () => {
    if (!isCustomerAuthenticated()) return
    setPlansLoading(true)
    try {
      const data = await customerApiGet<{ plans: Plan[] }>("/customer/plans")
      setPlans(data.plans ?? [])
    } catch (e: any) {
      if (e.message === "Sessão expirada") {
        router.replace(`/${slug}/login?error=session_expired`)
      }
    } finally {
      setPlansLoading(false)
    }
  }, [router, slug])

  useEffect(() => {
    if (tab === "planos") fetchPlans()
  }, [tab, fetchPlans])

  // ── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = () => {
    removeCustomerToken()
    // removeCustomerToken já dispara AUTH_CHANGE_EVENT — navbar atualiza
    router.push(`/${slug}`)
  }

  // ── Loading / error ──────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #1F1F1F", borderTopColor: "#0066FF", animation: "sp 0.7s linear infinite" }} />
      <p style={{ fontSize: 14, color: "#52525B" }}>Carregando sua área...</p>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <p style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Ops, algo deu errado</p>
      <p style={{ fontSize: 14, color: "#71717A" }}>{error}</p>
      <button onClick={() => window.location.reload()} style={{ height: 40, padding: "0 20px", borderRadius: 10, background: "#0066FF", color: "#fff", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit" }}>
        Tentar novamente
      </button>
    </div>
  )

  const TABS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
    { id: "agendamentos", label: "Agendamentos", icon: Calendar },
    { id: "planos",       label: "Planos",       icon: Crown    },
    { id: "perfil",       label: "Perfil",       icon: User     },
  ]

  return (
    <>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sp     { to{transform:rotate(360deg)} }
        * { box-sizing:border-box; }
      `}</style>

      <div style={{ minHeight: "100vh", backgroundColor: "#0A0A0A", color: "#fff", fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif" }}>

        {/* ── Header ── */}
        <header style={{ borderBottom: "1px solid #111111", backgroundColor: "rgba(10,10,10,0.95)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 40 }}>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#0066FF,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User size={16} color="#fff" />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1 }}>
                  {profile?.name ?? "Minha conta"}
                </p>
                <p style={{ fontSize: 11, color: "#52525B", marginTop: 2 }}>Área do cliente</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{ display: "flex", gap: 6, alignItems: "center", height: 34, padding: "0 12px", borderRadius: 8, backgroundColor: "transparent", border: "1px solid #1F1F1F", color: "#71717A", fontSize: 12, cursor: "pointer", transition: "all 0.15s ease", fontFamily: "inherit" }}
              onMouseEnter={(e) => { const b = e.currentTarget; b.style.color = "#EF4444"; b.style.borderColor = "rgba(239,68,68,0.3)" }}
              onMouseLeave={(e) => { const b = e.currentTarget; b.style.color = "#71717A"; b.style.borderColor = "#1F1F1F" }}
            >
              <LogOut size={13} />
              Sair
            </button>
          </div>
        </header>

        {/* ── Tabs ── */}
        <div style={{ borderBottom: "1px solid #111111", backgroundColor: "#0A0A0A", position: "sticky", top: 60, zIndex: 39 }}>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px", display: "flex", gap: 4 }}>
            {TABS.map((t) => {
              const isActive = tab === t.id
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{ display: "flex", gap: 6, alignItems: "center", height: 46, padding: "0 14px", border: "none", backgroundColor: "transparent", color: isActive ? "#fff" : "#52525B", fontSize: 13, fontWeight: isActive ? 600 : 400, cursor: "pointer", borderBottom: isActive ? "2px solid #0066FF" : "2px solid transparent", transition: "all 0.15s ease", fontFamily: "inherit" }}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Conteúdo ── */}
        <main style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px", animation: "fadeIn 0.25s ease" }}>

          {/* ═══ AGENDAMENTOS ═══ */}
          {tab === "agendamentos" && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>Meus agendamentos</h2>
                <p style={{ fontSize: 13, color: "#71717A", marginTop: 4 }}>Histórico completo dos seus serviços</p>
              </div>

              {schedules.length === 0 ? (
                <div style={{ textAlign: "center", padding: "56px 0" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "#111111", border: "1px solid #1F1F1F", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <Calendar size={26} color="#2A2A2A" />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>Nenhum agendamento ainda</p>
                  <p style={{ fontSize: 13, color: "#71717A", marginTop: 6 }}>Volte para a vitrine e agende seu primeiro serviço.</p>
                  <button onClick={() => router.push(`/${slug}`)} style={{ marginTop: 20, height: 40, padding: "0 20px", borderRadius: 10, background: "#0066FF", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
                    Ver serviços →
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {schedules.map((s) => {
                    const st = formatStatus(s.status)
                    const services = s.scheduleServices?.map((ss) => ss.service?.name).filter(Boolean).join(", ") || "Serviço"
                    return (
                      <div key={s.id} style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F", borderRadius: 16, padding: "18px 20px", transition: "border-color 0.15s ease" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#252525" }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1F1F1F" }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>{services}</p>
                            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                                <Clock size={11} color="#52525B" />
                                <span style={{ fontSize: 12, color: "#71717A" }}>{formatDateTime(s.scheduledAt)}</span>
                              </div>
                              {s.isSubscriber && (
                                <span style={{ fontSize: 11, color: "#7C3AED", backgroundColor: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)", padding: "2px 7px", borderRadius: 6 }}>
                                  ★ Assinante
                                </span>
                              )}
                            </div>
                            {s.notes && (
                              <p style={{ fontSize: 12, color: "#52525B", marginTop: 6, fontStyle: "italic" }}>"{s.notes}"</p>
                            )}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: st.color, backgroundColor: st.bg, border: `1px solid ${st.border}`, padding: "3px 10px", borderRadius: 8 }}>
                              {st.label}
                            </span>
                            <div style={{ textAlign: "right" }}>
                              <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{formatCurrency(s.totalPrice)}</span>
                              {s.discountApplied != null && s.discountApplied > 0 && (
                                <p style={{ fontSize: 11, color: "#10B981", margin: "2px 0 0" }}>-{formatCurrency(s.discountApplied)} desconto</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ PLANOS ═══ */}
          {tab === "planos" && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>Planos de assinatura</h2>
                <p style={{ fontSize: 13, color: "#71717A", marginTop: 4 }}>Assine e ganhe desconto em todos os serviços</p>
              </div>

              {plansLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "56px 0" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #1F1F1F", borderTopColor: "#7C3AED", animation: "sp 0.7s linear infinite" }} />
                </div>
              ) : plans.length === 0 ? (
                <div style={{ textAlign: "center", padding: "56px 0" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "#111111", border: "1px solid #1F1F1F", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <Crown size={28} color="#2A2A2A" />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>Nenhum plano disponível</p>
                  <p style={{ fontSize: 13, color: "#71717A", marginTop: 6 }}>Este estabelecimento ainda não oferece planos de assinatura.</p>
                </div>
              ) : (
                <>
                  {/* Banner plano ativo */}
                  {(() => {
                    const active = plans.find((p) => p.isSubscribed && p.mySubscription?.status === "ACTIVE")
                    if (!active) return null
                    return (
                      <div style={{ marginBottom: 16, background: "linear-gradient(135deg,rgba(124,58,237,0.08),rgba(0,102,255,0.06))", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 16, padding: "16px 20px", display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#7C3AED,#0066FF)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Crown size={18} color="#fff" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>Você é assinante {active.name}!</p>
                          <p style={{ fontSize: 13, color: "#A1A1AA", marginTop: 3 }}>{active.discountPercent}% de desconto em todos os serviços agendados.</p>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#10B981", backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", padding: "5px 10px", borderRadius: 8, flexShrink: 0 }}>
                          ✓ Ativo
                        </span>
                      </div>
                    )
                  })()}

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {plans.map((plan) => (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        onSubscribe={() => {
                          if (plan.cactopayPaymentLink) {
                            window.open(plan.cactopayPaymentLink, "_blank")
                          } else {
                            alert("O link de pagamento ainda não foi configurado pelo estabelecimento.")
                          }
                        }}
                        onCancel={() => {
                          if (window.confirm(`Deseja cancelar sua assinatura do plano ${plan.name}?`)) {
                            const msg = encodeURIComponent(`Olá, gostaria de cancelar minha assinatura do plano ${plan.name}.`)
                            window.open(`https://wa.me/?text=${msg}`, "_blank")
                          }
                        }}
                      />
                    ))}
                  </div>

                  <div style={{ marginTop: 16, backgroundColor: "#0D0D0D", border: "1px solid #161616", borderRadius: 14, padding: "14px 18px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <AlertCircle size={14} color="#52525B" style={{ flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 12, color: "#52525B", lineHeight: 1.5, margin: 0 }}>
                      Os descontos do plano são aplicados automaticamente em todo agendamento realizado enquanto sua assinatura estiver ativa.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ═══ PERFIL ═══ */}
          {tab === "perfil" && profile && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>Meu perfil</h2>
                <p style={{ fontSize: 13, color: "#71717A", marginTop: 4 }}>Suas informações cadastradas</p>
              </div>

              <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 28 }}>
                {profile.picture ? (
                  <img src={profile.picture} alt={profile.name} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "2px solid #1F1F1F" }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,#0066FF,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>
                      {profile.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: 0 }}>{profile.name}</p>
                  <p style={{ fontSize: 13, color: "#52525B", marginTop: 3 }}>
                    {(profile._count?.schedules ?? 0)} agendamento{(profile._count?.schedules ?? 0) !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Nome",     value: profile.name  },
                  { label: "Telefone", value: profile.phone },
                  ...(profile.email ? [{ label: "E-mail", value: profile.email }] : []),
                ].map((field) => (
                  <div key={field.label} style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F", borderRadius: 14, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#52525B", fontWeight: 500 }}>{field.label}</span>
                    <span style={{ fontSize: 14, color: "#fff", fontWeight: 500 }}>{field.value}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleLogout}
                style={{ marginTop: 28, width: "100%", height: 46, borderRadius: 14, backgroundColor: "transparent", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.15s ease", fontFamily: "inherit" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(239,68,68,0.05)" }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent" }}
              >
                <LogOut size={15} />
                Sair da conta
              </button>
            </div>
          )}

        </main>
      </div>
    </>
  )
}

// ─── PlanCard ─────────────────────────────────────────────────────────────────

function PlanCard({ plan, onSubscribe, onCancel }: {
  plan: Plan
  onSubscribe: () => void
  onCancel: () => void
}) {
  const [hovered,       setHovered]       = useState(false)
  const [btnHovered,    setBtnHovered]    = useState(false)
  const [cancelHovered, setCancelHovered] = useState(false)

  const isPending = plan.mySubscription?.status === "PENDING"
  const isActive  = plan.mySubscription?.status === "ACTIVE"

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative", overflow: "hidden",
        background: plan.isSubscribed
          ? "linear-gradient(135deg,rgba(124,58,237,0.08),rgba(0,102,255,0.06))"
          : "#111111",
        border: plan.isSubscribed
          ? "1px solid rgba(124,58,237,0.25)"
          : `1px solid ${hovered ? "#252525" : "#1F1F1F"}`,
        borderRadius: 20, padding: "22px 24px",
        transition: "border-color 0.2s ease",
      }}
    >
      {plan.isSubscribed && (
        <div style={{ position: "absolute", top: -40, right: -40, width: 130, height: 130, borderRadius: "50%", background: "radial-gradient(circle,rgba(124,58,237,0.1),transparent)", pointerEvents: "none" }} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: plan.isSubscribed ? "linear-gradient(135deg,#7C3AED,#0066FF)" : "#161616", border: plan.isSubscribed ? "none" : "1px solid #252525" }}>
              <Crown size={17} color={plan.isSubscribed ? "#fff" : "#52525B"} />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>{plan.name}</p>
              <div style={{ display: "flex", gap: 4, alignItems: "baseline" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{formatCurrency(plan.price)}</span>
                <span style={{ fontSize: 12, color: "#52525B" }}>/{plan.interval === "MONTHLY" ? "mês" : "ano"}</span>
              </div>
            </div>
          </div>

          {plan.description && (
            <p style={{ fontSize: 13, color: "#71717A", lineHeight: 1.5, marginBottom: 10 }}>{plan.description}</p>
          )}

          {plan.discountPercent > 0 && (
            <div style={{ display: "inline-flex", gap: 6, alignItems: "center", backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 8, padding: "5px 10px" }}>
              <Percent size={12} color="#10B981" />
              <span style={{ fontSize: 12, color: "#10B981", fontWeight: 500 }}>
                {plan.discountPercent}% de desconto em todos os serviços
              </span>
            </div>
          )}

          {plan.isSubscribed && plan.mySubscription && (
            <p style={{ fontSize: 12, color: "#52525B", marginTop: 10 }}>
              Assinante desde {formatDate(plan.mySubscription.startedAt || plan.mySubscription.createdAt)}
            </p>
          )}
        </div>

        {/* Ação */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          {plan.isSubscribed ? (
            <>
              <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? "#10B981" : "#F59E0B", backgroundColor: isActive ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.08)", border: `1px solid ${isActive ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.2)"}`, padding: "6px 12px", borderRadius: 10, display: "block", textAlign: "center" }}>
                {isActive ? "✓ Plano ativo" : isPending ? "⏳ Aguardando pagamento" : plan.mySubscription?.status}
              </span>
              <button
                onClick={onCancel}
                onMouseEnter={() => setCancelHovered(true)}
                onMouseLeave={() => setCancelHovered(false)}
                style={{ backgroundColor: "transparent", border: `1px solid ${cancelHovered ? "rgba(239,68,68,0.3)" : "#252525"}`, color: cancelHovered ? "#EF4444" : "#52525B", fontSize: 12, padding: "6px 12px", borderRadius: 8, cursor: "pointer", transition: "all 0.15s ease", fontFamily: "inherit" }}
              >
                Cancelar plano
              </button>
            </>
          ) : (
            <>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>
                  {formatCurrency(plan.price)}
                </span>
                <span style={{ fontSize: 13, color: "#52525B", marginLeft: 3 }}>/{plan.interval === "MONTHLY" ? "mês" : "ano"}</span>
              </div>
              <button
                onClick={onSubscribe}
                onMouseEnter={() => setBtnHovered(true)}
                onMouseLeave={() => setBtnHovered(false)}
                style={{ height: 42, padding: "0 20px", borderRadius: 12, background: "linear-gradient(135deg,#7C3AED,#0066FF)", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", transition: "all 0.2s ease", transform: btnHovered ? "translateY(-1px)" : "translateY(0)", boxShadow: btnHovered ? "0 8px 24px rgba(124,58,237,0.45)" : "0 4px 16px rgba(124,58,237,0.3)", fontFamily: "inherit", whiteSpace: "nowrap" }}
              >
                Assinar agora →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}