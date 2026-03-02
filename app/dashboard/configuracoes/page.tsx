"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/UserContext"
import { apiGet, apiPut } from "@/lib/api"
import {
  Building2, Clock, User, Shield,
  Save, AlertCircle, CheckCircle2,
  ExternalLink, Crown, Zap, X,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface BusinessHour {
  id?: string
  dayOfWeek: number
  isOpen: boolean
  openTime: string
  closeTime: string
}

interface BusinessConfig {
  id: string
  name: string
  phone: string
  email: string
  address: string | null
  description: string | null
  plan: "FREE" | "PRO"
  slug: string
  hours: BusinessHour[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
const DAY_SHORT  = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

const TABS = [
  { id: "negocio",  label: "Negócio",      Icon: Building2 },
  { id: "horarios", label: "Horários",     Icon: Clock     },
  { id: "conta",    label: "Minha conta",  Icon: User      },
  { id: "plano",    label: "Plano",        Icon: Crown     },
] as const

type TabId = typeof TABS[number]["id"]

const FEATURES = [
  { label: "Agendamentos ilimitados",    free: true,  pro: true  },
  { label: "Gestão de clientes",         free: true,  pro: true  },
  { label: "Serviços ilimitados",        free: false, pro: true  },
  { label: "Planos de assinatura",       free: false, pro: true  },
  { label: "Relatórios avançados",       free: false, pro: true  },
  { label: "Suporte prioritário",        free: false, pro: true  },
  { label: "Loja pública personalizada", free: false, pro: true  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner({ size = 14, color = "white" }: { size?: number; color?: string }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid rgba(255,255,255,0.15)`, borderTopColor: color,
      animation: "spinCfg 0.7s linear infinite",
      display: "inline-block", flexShrink: 0,
    }} />
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 500, color: "#A1A1AA", marginBottom: 6, display: "block" }}>
      {children}
      {required && <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>}
    </label>
  )
}

function TextInput({
  value, onChange, placeholder, type = "text", readOnly,
}: {
  value: string; onChange?: (v: string) => void
  placeholder?: string; type?: string; readOnly?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type={type} value={value} readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        height: 44, width: "100%", backgroundColor: "#0A0A0A",
        border: `1px solid ${focused && !readOnly ? "rgba(0,102,255,0.4)" : "#1F1F1F"}`,
        borderRadius: 12, padding: "0 16px",
        fontSize: 14, color: readOnly ? "#71717A" : "#fff",
        outline: "none", boxSizing: "border-box",
        transition: "border-color 0.15s", fontFamily: "inherit",
        cursor: readOnly ? "default" : "text",
      }}
    />
  )
}

function SaveBtn({
  loading, label, loadingLabel, onClick, gradient,
}: {
  loading: boolean; label: string; loadingLabel: string
  onClick: () => void; gradient: string
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick} disabled={loading}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        height: 42, padding: "0 20px", borderRadius: 12,
        background: gradient, border: "none", color: "white",
        fontSize: 14, fontWeight: 600,
        cursor: loading ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", gap: 8,
        opacity: loading ? 0.7 : 1,
        transform: hov && !loading ? "scale(1.02)" : "scale(1)",
        transition: "all 0.15s", fontFamily: "inherit",
      }}
    >
      {loading ? <Spinner size={14} /> : <Save size={15} />}
      {loading ? loadingLabel : label}
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConfiguracoesPage() {
  const router = useRouter()
  const { user, logout } = useUser()

  const [config,      setConfig]      = useState<BusinessConfig | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [success,     setSuccess]     = useState<string | null>(null)
  const [activeTab,   setActiveTab]   = useState<TabId>("negocio")

  const [formName,        setFormName]        = useState("")
  const [formPhone,       setFormPhone]       = useState("")
  const [formEmail,       setFormEmail]       = useState("")
  const [formAddress,     setFormAddress]     = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [hours,           setHours]           = useState<BusinessHour[]>([])

  // ── Fetch ─────────────────────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<{ user: unknown; business: BusinessConfig }>("/auth/me")
      const biz = res.business
      setConfig(biz)
      setFormName(biz.name ?? "")
      setFormPhone(biz.phone ?? "")
      setFormEmail(biz.email ?? "")
      setFormAddress(biz.address ?? "")
      setFormDescription(biz.description ?? "")

      const filled: BusinessHour[] = Array.from({ length: 7 }, (_, i) => {
        const found = biz.hours?.find((h) => h.dayOfWeek === i)
        return found ?? { dayOfWeek: i, isOpen: i !== 0, openTime: "08:00", closeTime: "18:00" }
      })
      setHours(filled)
      setError(null)
    } catch {
      setError("Erro ao carregar configurações.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  function showSuccess(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 4000)
  }

  // ── Actions ───────────────────────────────────────────────────────────
  async function handleSaveNegocio() {
    if (!formName.trim() || !formPhone.trim()) {
      setError("Nome e telefone são obrigatórios."); return
    }
    setSaving(true); setError(null); setSuccess(null)
    try {
      await apiPut("/business", {
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
        description: formDescription.trim() || undefined,
      })
      showSuccess("Alterações salvas com sucesso!")
    } catch {
      setError("Erro ao salvar. Tente novamente.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveHorarios() {
    setSaving(true); setError(null); setSuccess(null)
    try {
      await apiPut("/business/hours", { hours })
      showSuccess("Horários salvos com sucesso!")
    } catch {
      setError("Erro ao salvar horários.")
    } finally {
      setSaving(false)
    }
  }

  function updateHour(dayOfWeek: number, field: keyof BusinessHour, value: unknown) {
    setHours((prev) => prev.map((h) =>
      h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h
    ))
  }

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"}/${config?.slug ?? ""}`
  const openDays  = hours.filter((h) => h.isOpen).length

  // ── Skeleton ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <style>{`@keyframes skeletonCfg{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
        <div style={{ height: 40, width: 200, borderRadius: 10, backgroundColor: "#111111", marginBottom: 8, animation: "skeletonCfg 1.5s ease infinite" }} />
        <div style={{ height: 20, width: 280, borderRadius: 8, backgroundColor: "#111111", marginBottom: 32, animation: "skeletonCfg 1.5s ease 0.1s infinite" }} />
        <div style={{ height: 48, borderRadius: 14, backgroundColor: "#111111", marginBottom: 24, animation: "skeletonCfg 1.5s ease 0.15s infinite" }} />
        <div style={{ height: 360, borderRadius: 18, backgroundColor: "#111111", animation: "skeletonCfg 1.5s ease 0.2s infinite" }} />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes spinCfg   { to { transform: rotate(360deg); } }
        @keyframes fadeInCfg { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes skeletonCfg { 0%,100%{opacity:.4} 50%{opacity:.8} }
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
        input::placeholder, textarea::placeholder { color: #3F3F46; }
        select option { background: #111111; }
      `}</style>

      <div style={{
        maxWidth: 900, margin: "0 auto",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}>

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>
            Configurações
          </h1>
          <p style={{ fontSize: 14, color: "#71717A", marginTop: 6 }}>
            Gerencie as informações do seu negócio
          </p>
        </div>

        {/* ── SUCCESS / ERROR BANNERS ─────────────────────────────────── */}
        {success && (
          <div style={{
            backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 10,
            animation: "fadeInCfg 0.3s ease",
          }}>
            <CheckCircle2 size={16} color="#10B981" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#10B981" }}>{success}</span>
          </div>
        )}
        {error && (
          <div style={{
            backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <AlertCircle size={16} color="#EF4444" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#EF4444", flex: 1 }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: 0 }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── TABS ────────────────────────────────────────────────────── */}
        <div style={{
          display: "inline-flex", gap: 2, marginBottom: 24,
          backgroundColor: "#111111", border: "1px solid #1F1F1F",
          borderRadius: 14, padding: 4,
        }}>
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id
            return (
              <TabBtn key={id} label={label} Icon={Icon} active={active}
                onClick={() => setActiveTab(id)} />
            )
          })}
        </div>

        {/* ── TAB: NEGÓCIO ────────────────────────────────────────────── */}
        {activeTab === "negocio" && (
          <SectionCard>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 20px" }}>
              Informações do negócio
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <FieldLabel required>Nome do estabelecimento</FieldLabel>
                <TextInput value={formName} onChange={setFormName}
                  placeholder="Ex: Auto Estética Premium" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <FieldLabel required>Telefone</FieldLabel>
                  <TextInput value={formPhone} onChange={setFormPhone}
                    placeholder="(47) 99999-0000" type="tel" />
                </div>
                <div>
                  <FieldLabel>E-mail</FieldLabel>
                  <TextInput value={formEmail} onChange={setFormEmail}
                    placeholder="contato@minhastetica.com" type="email" />
                </div>
              </div>

              <div>
                <FieldLabel>Endereço</FieldLabel>
                <TextInput value={formAddress} onChange={setFormAddress}
                  placeholder="Rua das Flores, 123 — Blumenau, SC" />
              </div>

              <div>
                <FieldLabel>Descrição</FieldLabel>
                <DescTextarea value={formDescription} onChange={setFormDescription}
                  placeholder="Conte um pouco sobre seu negócio..." />
              </div>

              {/* Link público */}
              <div>
                <FieldLabel>Link da sua loja</FieldLabel>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{
                    flex: 1, height: 44, backgroundColor: "#0A0A0A",
                    border: "1px solid #1F1F1F", borderRadius: 12,
                    display: "flex", alignItems: "center", padding: "0 16px", gap: 8,
                    overflow: "hidden",
                  }}>
                    <span style={{ fontSize: 13, color: "#71717A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {publicUrl}
                    </span>
                  </div>
                  <ExternalLinkBtn onClick={() => window.open(publicUrl, "_blank")} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <SaveBtn
                loading={saving} label="Salvar alterações" loadingLabel="Salvando..."
                onClick={handleSaveNegocio}
                gradient="linear-gradient(135deg,#0066FF,#7C3AED)"
              />
            </div>
          </SectionCard>
        )}

        {/* ── TAB: HORÁRIOS ────────────────────────────────────────────── */}
        {activeTab === "horarios" && (
          <SectionCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>
                  Horário de funcionamento
                </h2>
                <p style={{ fontSize: 13, color: "#71717A", marginTop: 4 }}>
                  Configure os dias e horários de atendimento
                </p>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 600, color: "#0066FF",
                backgroundColor: "rgba(0,102,255,0.08)", border: "1px solid rgba(0,102,255,0.15)",
                borderRadius: 8, padding: "5px 12px",
              }}>
                {openDays} dia{openDays !== 1 ? "s" : ""} aberto{openDays !== 1 ? "s" : ""}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {hours.map((hour) => (
                <HourRow
                  key={hour.dayOfWeek}
                  hour={hour}
                  onToggle={() => updateHour(hour.dayOfWeek, "isOpen", !hour.isOpen)}
                  onOpenChange={(v) => updateHour(hour.dayOfWeek, "openTime", v)}
                  onCloseChange={(v) => updateHour(hour.dayOfWeek, "closeTime", v)}
                />
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <SaveBtn
                loading={saving} label="Salvar horários" loadingLabel="Salvando..."
                onClick={handleSaveHorarios}
                gradient="linear-gradient(135deg,#10B981,#059669)"
              />
            </div>
          </SectionCard>
        )}

        {/* ── TAB: CONTA ──────────────────────────────────────────────── */}
        {activeTab === "conta" && (
          <SectionCard>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 20px" }}>
              Minha conta
            </h2>

            {/* Profile card */}
            <div style={{
              display: "flex", gap: 16, alignItems: "center", marginBottom: 24,
              backgroundColor: "#0A0A0A", border: "1px solid #1F1F1F",
              borderRadius: 14, padding: "16px 20px",
            }}>
              <UserAvatar name={user?.name ?? ""} picture={user?.picture} />
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>
                  {user?.name ?? "—"}
                </p>
                <p style={{ fontSize: 13, color: "#71717A", marginTop: 4 }}>
                  {user?.email ?? "—"}
                </p>
                <span style={{
                  display: "inline-block", marginTop: 8,
                  fontSize: 11, fontWeight: 600,
                  color: user?.role === "OWNER" ? "#7C3AED" : "#0066FF",
                  backgroundColor: user?.role === "OWNER" ? "rgba(124,58,237,0.1)" : "rgba(0,102,255,0.1)",
                  borderRadius: 6, padding: "3px 8px",
                }}>
                  {user?.role === "OWNER" ? "Proprietário" : "Administrador"}
                </span>
              </div>
            </div>

            {/* Auth */}
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#A1A1AA", margin: "0 0 12px" }}>
              Autenticação
            </h3>
            <div style={{
              backgroundColor: "#0A0A0A", border: "1px solid #1F1F1F",
              borderRadius: 12, padding: "14px 16px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 24,
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <GoogleIcon />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#fff", margin: 0 }}>Google</p>
                  <p style={{ fontSize: 12, color: "#71717A", marginTop: 2 }}>
                    Conectado como {user?.email}
                  </p>
                </div>
              </div>
              <span style={{ fontSize: 12, color: "#10B981", fontWeight: 500 }}>Conectado</span>
            </div>

            {/* Danger zone */}
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#EF4444", margin: "0 0 12px" }}>
              Zona de perigo
            </h3>
            <div style={{
              backgroundColor: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)",
              borderRadius: 12, padding: "16px 20px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#fff", margin: 0 }}>Sair da conta</p>
                <p style={{ fontSize: 12, color: "#71717A", marginTop: 2 }}>
                  Você precisará fazer login novamente.
                </p>
              </div>
              <LogoutBtn onClick={() => {
                if (window.confirm("Sair da conta?")) {
                  logout()
                  router.push("/auth/login")
                }
              }} />
            </div>
          </SectionCard>
        )}

        {/* ── TAB: PLANO ──────────────────────────────────────────────── */}
        {activeTab === "plano" && (
          <SectionCard>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 20px" }}>
              Seu plano
            </h2>

            {/* Current plan */}
            <div style={{
              backgroundColor: "#0A0A0A", border: "1px solid #1F1F1F",
              borderRadius: 14, padding: "20px 24px", marginBottom: 20,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              flexWrap: "wrap", gap: 12,
            }}>
              <div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Zap size={18} color={config?.plan === "PRO" ? "#F59E0B" : "#52525B"} />
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>
                    {config?.plan === "PRO" ? "Plano PRO" : "Plano FREE"}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "#71717A", marginTop: 6 }}>
                  {config?.plan === "PRO"
                    ? "Acesso completo a todos os recursos"
                    : "Recursos básicos — faça upgrade para desbloquear tudo"}
                </p>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: config?.plan === "PRO" ? "#F59E0B" : "#52525B",
                backgroundColor: config?.plan === "PRO" ? "rgba(245,158,11,0.1)" : "#161616",
                border: `1px solid ${config?.plan === "PRO" ? "rgba(245,158,11,0.2)" : "#252525"}`,
                borderRadius: 8, padding: "5px 12px",
              }}>
                {config?.plan ?? "FREE"}
              </span>
            </div>

            {/* Feature comparison */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {FEATURES.map((f) => (
                <div key={f.label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  backgroundColor: "#0A0A0A", border: "1px solid #161616",
                  borderRadius: 10, padding: "10px 16px",
                }}>
                  <span style={{ fontSize: 13, color: "#A1A1AA" }}>{f.label}</span>
                  <div style={{ display: "flex", gap: 16 }}>
                    <FeatureCell label="FREE" available={f.free} labelColor="#52525B" />
                    <FeatureCell label="PRO"  available={f.pro}  labelColor="#F59E0B" />
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            {config?.plan !== "PRO" ? (
              <UpgradeBtn onClick={() => router.push("/dashboard/upgrade")} />
            ) : (
              <div style={{
                marginTop: 20, backgroundColor: "rgba(245,158,11,0.04)",
                border: "1px solid rgba(245,158,11,0.12)",
                borderRadius: 12, padding: "14px 18px",
                display: "flex", gap: 10, alignItems: "center",
              }}>
                <CheckCircle2 size={16} color="#F59E0B" />
                <span style={{ fontSize: 13, color: "#A1A1AA" }}>
                  Você tem acesso completo ao plano PRO.
                </span>
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </>
  )
}

// ── Atomic sub-components ─────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: "#111111", border: "1px solid #1F1F1F",
      borderRadius: 18, padding: 28,
    }}>
      {children}
    </div>
  )
}

function TabBtn({
  label, Icon, active, onClick,
}: {
  label: string; Icon: React.ElementType; active: boolean; onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "8px 16px", borderRadius: 10,
        fontSize: 13, fontWeight: 500, cursor: "pointer",
        border: "none", transition: "all 0.15s", fontFamily: "inherit",
        backgroundColor: active ? "#1A1A1A" : "transparent",
        color: active ? "#fff" : hov ? "#A1A1AA" : "#71717A",
        boxShadow: active ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
      }}
    >
      <Icon size={14} color={active ? "#0066FF" : "currentColor"} />
      {label}
    </button>
  )
}

function DescTextarea({
  value, onChange, placeholder,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea
      value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      rows={3}
      style={{
        width: "100%", backgroundColor: "#0A0A0A",
        border: `1px solid ${focused ? "rgba(0,102,255,0.4)" : "#1F1F1F"}`,
        borderRadius: 12, padding: "10px 16px",
        fontSize: 14, color: "#fff", outline: "none",
        resize: "none", boxSizing: "border-box",
        transition: "border-color 0.15s", fontFamily: "inherit",
        minHeight: 88, lineHeight: 1.5,
      }}
    />
  )
}

function ExternalLinkBtn({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 44, height: 44, flexShrink: 0,
        backgroundColor: "#161616", border: "1px solid #1F1F1F",
        borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", color: hov ? "#fff" : "#A1A1AA", transition: "color 0.15s",
      }}>
      <ExternalLink size={16} />
    </button>
  )
}

function HourRow({ hour, onToggle, onOpenChange, onCloseChange }: {
  hour: BusinessHour
  onToggle: () => void
  onOpenChange: (v: string) => void
  onCloseChange: (v: string) => void
}) {
  return (
    <div style={{
      backgroundColor: hour.isOpen ? "#0A0A0A" : "transparent",
      border: `1px solid ${hour.isOpen ? "#1F1F1F" : "#161616"}`,
      borderRadius: 14, padding: "14px 18px",
      display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      transition: "all 0.2s ease",
    }}>
      {/* Toggle + day label */}
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          cursor: "pointer", width: 140, flexShrink: 0, userSelect: "none",
        }}
      >
        {/* Toggle pill */}
        <div style={{
          width: 36, height: 20, borderRadius: 10,
          backgroundColor: hour.isOpen ? "#0066FF" : "#1F1F1F",
          border: hour.isOpen ? "none" : "1px solid #252525",
          position: "relative", flexShrink: 0, transition: "background-color 0.2s",
        }}>
          <div style={{
            position: "absolute", top: 2, width: 16, height: 16,
            borderRadius: "50%", backgroundColor: "white",
            left: hour.isOpen ? 18 : 2, transition: "left 0.2s ease",
          }} />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: hour.isOpen ? "#fff" : "#52525B", margin: 0 }}>
            {DAY_LABELS[hour.dayOfWeek]}
          </p>
          <p style={{ fontSize: 11, color: "#3F3F46", margin: 0 }}>
            {DAY_SHORT[hour.dayOfWeek]}
          </p>
        </div>
      </div>

      {/* Time inputs */}
      {hour.isOpen ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
          <span style={{ fontSize: 12, color: "#71717A" }}>das</span>
          <TimeInput value={hour.openTime}  onChange={onOpenChange}  />
          <span style={{ fontSize: 12, color: "#71717A" }}>às</span>
          <TimeInput value={hour.closeTime} onChange={onCloseChange} />
        </div>
      ) : (
        <span style={{ fontSize: 13, color: "#3F3F46", fontStyle: "italic", marginLeft: "auto" }}>
          Fechado
        </span>
      )}
    </div>
  )
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type="time" value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        height: 36, backgroundColor: "#111111",
        border: `1px solid ${focused ? "rgba(0,102,255,0.4)" : "#252525"}`,
        borderRadius: 8, padding: "0 10px",
        fontSize: 13, color: "#fff", outline: "none",
        colorScheme: "dark", fontFamily: "inherit",
        transition: "border-color 0.15s",
      }}
    />
  )
}

function UserAvatar({ name, picture }: { name: string; picture?: string | null }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase()
  if (picture) {
    return (
      <img src={picture} alt={name} style={{ width: 52, height: 52, borderRadius: 14, objectFit: "cover", flexShrink: 0 }} />
    )
  }
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 14, flexShrink: 0,
      background: "linear-gradient(135deg,#7C3AED,#0066FF)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 18, fontWeight: 700, color: "#fff",
    }}>
      {initials}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function LogoutBtn({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        height: 36, padding: "0 16px", borderRadius: 8,
        backgroundColor: hov ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444",
        fontSize: 13, fontWeight: 600, cursor: "pointer",
        transition: "background-color 0.15s", fontFamily: "inherit",
        flexShrink: 0,
      }}>
      Sair
    </button>
  )
}

function FeatureCell({ label, available, labelColor }: {
  label: string; available: boolean; labelColor: string
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, width: 60 }}>
      {available
        ? <CheckCircle2 size={13} color="#10B981" />
        : <X size={13} color="#1F1F1F" />
      }
      <span style={{ fontSize: 10, color: labelColor, fontWeight: 600 }}>{label}</span>
    </div>
  )
}

function UpgradeBtn({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        marginTop: 20, width: "100%", height: 48, borderRadius: 14,
        background: "linear-gradient(135deg,#F59E0B,#EF4444)",
        border: "none", color: "white", fontSize: 15, fontWeight: 700,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        boxShadow: hov ? "0 8px 32px rgba(245,158,11,0.5)" : "0 4px 20px rgba(245,158,11,0.3)",
        transform: hov ? "scale(1.02)" : "scale(1)",
        transition: "all 0.2s", fontFamily: "inherit",
      }}>
      <Zap size={16} />
      Fazer upgrade para PRO
    </button>
  )
}