"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/UserContext"
import { apiGet, apiPut } from "@/lib/api"
import {
  Building2, Clock, User, Shield,
  AlertCircle, CheckCircle2,
  ExternalLink, Crown, Zap, X,
  Camera, Loader2,
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
  ownerAvatarUrl: string | null
  themeColor: string | null
  hours: BusinessHour[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
const DAY_SHORT  = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
void DAY_SHORT

type TabId = "negocio" | "horarios" | "conta" | "plano"

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: "negocio",  label: "Negócio",      Icon: Building2 },
  { id: "horarios", label: "Horários",      Icon: Clock     },
  { id: "conta",    label: "Minha conta",   Icon: User      },
  { id: "plano",    label: "Plano",         Icon: Shield    },
]

const PLAN_FEATURES: { label: string; free: boolean; pro: boolean }[] = [
  { label: "Agendamentos ilimitados",         free: true,  pro: true  },
  { label: "Gestão de clientes",              free: true,  pro: true  },
  { label: "Relatórios básicos",              free: true,  pro: true  },
  { label: "Relatórios avançados",            free: false, pro: true  },
  { label: "Assinantes / planos recorrentes", free: false, pro: true  },
  { label: "Loja pública personalizada",      free: false, pro: true  },
]

const COLOR_PALETTE = [
  { label: "Azul",     value: "#0066FF" },
  { label: "Roxo",     value: "#7C3AED" },
  { label: "Vermelho", value: "#EF4444" },
  { label: "Laranja",  value: "#F97316" },
  { label: "Verde",    value: "#10B981" },
  { label: "Rosa",     value: "#EC4899" },
  { label: "Âmbar",   value: "#F59E0B" },
  { label: "Ciano",    value: "#06B6D4" },
]

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "")
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

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
    <label style={{ fontSize: 12, fontWeight: 500, color: "#A1A1AA", display: "block", marginBottom: 6 }}>
      {children}{required && <span style={{ color: "#EF4444" }}> *</span>}
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
      type={type}
      value={value}
      readOnly={readOnly}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%", height: 42, padding: "0 14px",
        backgroundColor: readOnly ? "#0D0D0D" : "#0A0A0A",
        border: `1px solid ${focused ? "rgba(0,102,255,0.4)" : "#252525"}`,
        borderRadius: 10, fontSize: 14, color: readOnly ? "#52525B" : "#fff",
        outline: "none", fontFamily: "inherit",
        transition: "border-color 0.15s",
        boxSizing: "border-box" as const,
        cursor: readOnly ? "not-allowed" : "text",
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
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        height: 40, padding: "0 22px", borderRadius: 10, border: "none",
        background: loading ? "#161616" : gradient,
        color: loading ? "#52525B" : "#fff",
        fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", gap: 8,
        fontFamily: "inherit", transition: "all 0.2s",
      }}
    >
      {loading ? <><Spinner size={13} /> {loadingLabel}</> : label}
    </button>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: "#111111", border: "1px solid #1F1F1F",
      borderRadius: 16, padding: "24px 28px",
    }}>
      {children}
    </div>
  )
}

function TabBtn({ label, Icon, active, onClick }: {
  label: string; Icon: React.ElementType; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 16px", borderRadius: 10, border: "none",
        backgroundColor: active ? "rgba(0,102,255,0.1)" : "transparent",
        color: active ? "#fff" : "#71717A",
        fontSize: 13, fontWeight: active ? 600 : 400,
        cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
      }}
    >
      <Icon size={14} />
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
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      rows={3}
      style={{
        width: "100%", padding: "10px 14px",
        backgroundColor: "#0A0A0A",
        border: `1px solid ${focused ? "rgba(0,102,255,0.4)" : "#252525"}`,
        borderRadius: 10, fontSize: 14, color: "#fff",
        outline: "none", fontFamily: "inherit", resize: "vertical",
        transition: "border-color 0.15s", boxSizing: "border-box" as const,
      }}
    />
  )
}

function ExternalLinkBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 38, padding: "0 16px", borderRadius: 10,
        border: "1px solid #252525", backgroundColor: "transparent",
        color: "#A1A1AA", fontSize: 12, fontWeight: 500,
        cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        fontFamily: "inherit",
      }}
    >
      <ExternalLink size={12} /> Abrir loja
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
      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      padding: "10px 0", borderBottom: "1px solid #161616",
    }}>
      <div style={{ width: 80, fontSize: 13, color: "#A1A1AA", flexShrink: 0 }}>
        {DAY_LABELS[hour.dayOfWeek]}
      </div>
      <div
        onClick={onToggle}
        style={{
          width: 40, height: 22, borderRadius: 100,
          backgroundColor: hour.isOpen ? "#0066FF" : "#252525",
          cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <div style={{
          position: "absolute", top: 3,
          left: hour.isOpen ? 21 : 3,
          width: 16, height: 16, borderRadius: "50%",
          backgroundColor: "#fff", transition: "left 0.2s",
        }} />
      </div>
      {hour.isOpen ? (
        <>
          <TimeInput value={hour.openTime}  onChange={onOpenChange}  />
          <span style={{ fontSize: 12, color: "#52525B" }}>até</span>
          <TimeInput value={hour.closeTime} onChange={onCloseChange} />
        </>
      ) : (
        <span style={{ fontSize: 12, color: "#3F3F46" }}>Fechado</span>
      )}
    </div>
  )
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        height: 34, padding: "0 10px", backgroundColor: "#0A0A0A",
        border: "1px solid #252525", borderRadius: 8,
        fontSize: 13, color: "#fff", outline: "none",
        fontFamily: "inherit", width: 90,
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
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function LogoutBtn({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 38, padding: "0 18px", borderRadius: 10,
        border: "1px solid rgba(239,68,68,0.2)",
        backgroundColor: hov ? "rgba(239,68,68,0.08)" : "transparent",
        color: "#EF4444", fontSize: 13, fontWeight: 500,
        cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
      }}
    >
      Sair da conta
    </button>
  )
}

function FeatureCell({ label, available, labelColor }: {
  label: string; available: boolean; labelColor: string
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #161616" }}>
      <span style={{ fontSize: 13, color: labelColor }}>{label}</span>
      {available
        ? <CheckCircle2 size={14} color="#10B981" />
        : <X size={14} color="#3F3F46" />}
    </div>
  )
}

function UpgradeBtn({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", height: 46, borderRadius: 12, border: "none",
        background: "linear-gradient(135deg,#0066FF,#7C3AED)",
        color: "#fff", fontSize: 14, fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit",
        boxShadow: hov ? "0 8px 30px rgba(0,102,255,0.4)" : "0 4px 20px rgba(0,102,255,0.2)",
        transform: hov ? "scale(1.01)" : "scale(1)",
        transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}
    >
      <Zap size={15} /> Fazer upgrade para PRO
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
  const [ownerAvatarUrl,  setOwnerAvatarUrl]  = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [themeColor,      setThemeColor]      = useState("#0066FF")
  const [colorSaved,      setColorSaved]      = useState(false)
  const [hours,           setHours]           = useState<BusinessHour[]>([])

  const avatarInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
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
      setOwnerAvatarUrl(biz.ownerAvatarUrl ?? null)
      setThemeColor(biz.themeColor ?? "#0066FF")

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

  // ── Save negócio ───────────────────────────────────────────────────────────
  async function handleSaveNegocio() {
    if (!formName.trim() || !formPhone.trim()) {
      setError("Nome e telefone são obrigatórios."); return
    }
    setSaving(true); setError(null); setSuccess(null)
    try {
      await apiPut("/auth/business", {
        name:        formName.trim(),
        phone:       formPhone.trim(),
        email:       formEmail.trim() || undefined,
        address:     formAddress.trim() || undefined,
        description: formDescription.trim() || undefined,
      })
      showSuccess("Alterações salvas com sucesso!")
    } catch {
      setError("Erro ao salvar. Tente novamente.")
    } finally {
      setSaving(false)
    }
  }

  // ── Save horários ──────────────────────────────────────────────────────────
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

  // ── Upload avatar proprietário ─────────────────────────────────────────────
  async function handleOwnerAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setError("Imagem muito grande. Máximo 2MB.")
      return
    }

    setUploadingAvatar(true)
    setError(null)

    try {
      const token = typeof window !== "undefined"
        ? localStorage.getItem("forbion_token")
        : null

      const formData = new FormData()
      formData.append("file", file)

      const uploadRes = await fetch(`${API}/api/upload/service-image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      if (!uploadRes.ok) throw new Error("Falha no upload.")

      const { url } = await uploadRes.json() as { url: string }

      setOwnerAvatarUrl(url)
      await apiPut("/auth/business", { ownerAvatarUrl: url })
      showSuccess("Foto de perfil atualizada!")
    } catch {
      setError("Erro ao enviar a foto. Tente novamente.")
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ""
    }
  }

  // ── Auto-save tema de cor ──────────────────────────────────────────────────
  async function handleThemeColorChange(color: string) {
    setThemeColor(color)
    try {
      await apiPut("/auth/business", { themeColor: color })
      setColorSaved(true)
      setTimeout(() => setColorSaved(false), 2000)
    } catch {
      setError("Erro ao salvar a cor.")
    }
  }

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"}/${config?.slug ?? ""}`
  const openDays  = hours.filter((h) => h.isOpen).length
  const themeRgb  = hexToRgb(themeColor)

  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <style>{`@keyframes skelCfg{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 0 40px" }}>
          <div style={{ height: 36, width: 200, backgroundColor: "#161616", borderRadius: 10, marginBottom: 8, animation: "skelCfg 1.5s ease infinite" }} />
          <div style={{ height: 16, width: 280, backgroundColor: "#111", borderRadius: 8, marginBottom: 32, animation: "skelCfg 1.5s ease 0.1s infinite" }} />
          <div style={{ height: 300, backgroundColor: "#111111", borderRadius: 16, animation: "skelCfg 1.5s ease 0.2s infinite" }} />
        </div>
      </>
    )
  }

  return (
    <>
      <style>{`
        @keyframes spinCfg  { to { transform: rotate(360deg); } }
        @keyframes fadeInCfg { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{
        maxWidth: 900, margin: "0 auto",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        animation: "fadeInCfg 0.3s ease",
      }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>
            Configurações
          </h1>
          <p style={{ fontSize: 14, color: "#71717A", marginTop: 6 }}>
            Gerencie as informações do seu negócio
          </p>
        </div>

        {/* ── SUCCESS/ERROR BANNERS ── */}
        {success && (
          <div style={{
            backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <CheckCircle2 size={14} color="#10B981" />
            <span style={{ fontSize: 13, color: "#10B981" }}>{success}</span>
          </div>
        )}
        {error && (
          <div style={{
            backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <AlertCircle size={14} color="#EF4444" />
            <span style={{ fontSize: 13, color: "#EF4444" }}>{error}</span>
          </div>
        )}

        {/* ── TABS ── */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 24,
          backgroundColor: "#0D0D0D", border: "1px solid #1A1A1A",
          borderRadius: 12, padding: 4, width: "fit-content",
        }}>
          {TABS.map(({ id, label, Icon }) => (
            <TabBtn key={id} label={label} Icon={Icon}
              active={activeTab === id}
              onClick={() => setActiveTab(id)} />
          ))}
        </div>

        {/* ══ TAB: NEGÓCIO ══════════════════════════════════════════════════ */}
        {activeTab === "negocio" && (
          <SectionCard>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 20px" }}>
              Informações do negócio
            </h2>

            {/* URL pública */}
            <div style={{
              backgroundColor: "#0A0A0A", border: "1px solid #1F1F1F",
              borderRadius: 12, padding: "12px 16px", marginBottom: 24,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <p style={{ fontSize: 12, color: "#52525B", margin: "0 0 4px" }}>URL da sua loja pública</p>
                <p style={{ fontSize: 13, color: "#A1A1AA", margin: 0, fontFamily: "monospace" }}>{publicUrl}</p>
              </div>
              <ExternalLinkBtn onClick={() => window.open(publicUrl, "_blank")} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <FieldLabel required>Nome do estabelecimento</FieldLabel>
                <TextInput value={formName} onChange={setFormName} placeholder="Ex: Auto Estética Premium" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <FieldLabel required>Telefone</FieldLabel>
                  <TextInput value={formPhone} onChange={setFormPhone} placeholder="(47) 99999-9999" type="tel" />
                </div>
                <div>
                  <FieldLabel>E-mail</FieldLabel>
                  <TextInput value={formEmail} onChange={setFormEmail} placeholder="contato@exemplo.com" type="email" />
                </div>
              </div>
              <div>
                <FieldLabel>Endereço</FieldLabel>
                <TextInput value={formAddress} onChange={setFormAddress} placeholder="Rua, número, bairro, cidade" />
              </div>
              <div>
                <FieldLabel>Descrição</FieldLabel>
                <DescTextarea value={formDescription} onChange={setFormDescription} placeholder="Conte um pouco sobre seu negócio..." />
              </div>
            </div>

            {/* ── SEÇÃO: PERFIL DO PROPRIETÁRIO ── */}
            <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid #1A1A1A" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>
                Perfil do proprietário
              </h3>

              <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                {/* Preview avatar */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  {ownerAvatarUrl ? (
                    <img
                      src={ownerAvatarUrl}
                      alt="Avatar"
                      style={{
                        width: 80, height: 80, borderRadius: "50%",
                        objectFit: "cover", border: "2px solid #1F1F1F",
                        display: "block",
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 80, height: 80, borderRadius: "50%",
                      background: `linear-gradient(135deg, ${themeColor}, ${themeColor}99)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 28, fontWeight: 800, color: "#fff",
                    }}>
                      {(formName || config?.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Botão câmera */}
                  <label
                    htmlFor="owner-avatar-upload"
                    style={{
                      position: "absolute", bottom: 0, right: 0,
                      width: 26, height: 26, borderRadius: "50%",
                      backgroundColor: uploadingAvatar ? "#004ACC" : themeColor,
                      border: "2px solid #0A0A0A",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: uploadingAvatar ? "not-allowed" : "pointer",
                      transition: "background 0.15s",
                    }}
                  >
                    {uploadingAvatar
                      ? <Loader2 size={11} color="#fff" style={{ animation: "spinCfg 0.7s linear infinite" }} />
                      : <Camera size={12} color="#fff" />}
                  </label>

                  <input
                    ref={avatarInputRef}
                    id="owner-avatar-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: "none" }}
                    onChange={handleOwnerAvatarUpload}
                    disabled={uploadingAvatar}
                  />
                </div>

                {/* Textos */}
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>
                    Foto de perfil
                  </p>
                  <p style={{ fontSize: 12, color: "#71717A", margin: "4px 0 0" }}>
                    Aparece na sua loja para os clientes te reconhecerem.
                  </p>
                  <p style={{ fontSize: 11, color: "#3F3F46", margin: "4px 0 0" }}>
                    JPG, PNG ou WebP. Máximo 2MB.
                  </p>
                  {uploadingAvatar && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
                      <Loader2 size={12} color={themeColor} style={{ animation: "spinCfg 0.7s linear infinite" }} />
                      <span style={{ fontSize: 12, color: themeColor }}>Enviando...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── SEÇÃO: COR DA LOJA ── */}
            <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid #1A1A1A" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>
                  Cor da loja
                </h3>
                {colorSaved && (
                  <span style={{ fontSize: 11, color: "#10B981", display: "flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle2 size={11} /> Cor salva ✓
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: "#71717A", margin: "0 0 16px" }}>
                Define a cor dos botões e destaques na sua vitrine
              </p>

              {/* Paleta */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {COLOR_PALETTE.map(c => (
                  <button
                    key={c.value}
                    title={c.label}
                    onClick={() => handleThemeColorChange(c.value)}
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: c.value,
                      border: themeColor === c.value ? "3px solid #fff" : "3px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      boxShadow: themeColor === c.value ? `0 0 0 2px ${c.value}` : "none",
                      transform: themeColor === c.value ? "scale(1.15)" : "scale(1)",
                      outline: "none",
                    }}
                  />
                ))}
              </div>

              {/* Preview ao vivo */}
              <div style={{
                marginTop: 16, padding: 16, borderRadius: 14,
                backgroundColor: "#0D0D0D", border: "1px solid #1F1F1F",
              }}>
                <p style={{ fontSize: 11, color: "#52525B", margin: "0 0 10px", letterSpacing: "1px", textTransform: "uppercase" }}>
                  Preview
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {/* Botão CTA */}
                  <button style={{
                    height: 36, padding: "0 16px", borderRadius: 10,
                    backgroundColor: themeColor, color: "#fff",
                    fontSize: 13, fontWeight: 600, border: "none", cursor: "default",
                    fontFamily: "inherit",
                    boxShadow: `0 4px 16px rgba(${themeRgb}, 0.35)`,
                  }}>
                    Agendar agora →
                  </button>

                  {/* Badge aberto */}
                  <div style={{
                    display: "flex", gap: 6, alignItems: "center",
                    backgroundColor: `rgba(${themeRgb}, 0.1)`,
                    border: `1px solid rgba(${themeRgb}, 0.2)`,
                    borderRadius: 100, padding: "5px 12px",
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      backgroundColor: themeColor,
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: themeColor }}>
                      Aberto agora
                    </span>
                  </div>

                  {/* Avatar inicial */}
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: `linear-gradient(135deg, ${themeColor}, ${themeColor}99)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, color: "#fff",
                  }}>
                    {(formName || "M").charAt(0).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <SaveBtn
                loading={saving} label="Salvar alterações" loadingLabel="Salvando..."
                onClick={handleSaveNegocio}
                gradient={`linear-gradient(135deg, ${themeColor}, ${themeColor}CC)`}
              />
            </div>
          </SectionCard>
        )}

        {/* ══ TAB: HORÁRIOS ═════════════════════════════════════════════════ */}
        {activeTab === "horarios" && (
          <SectionCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>
                  Horário de funcionamento
                </h2>
                <p style={{ fontSize: 13, color: "#52525B", marginTop: 4 }}>
                  {openDays} dia{openDays !== 1 ? "s" : ""} aberto{openDays !== 1 ? "s" : ""} por semana
                </p>
              </div>
            </div>

            {hours.map(hour => (
              <HourRow
                key={hour.dayOfWeek}
                hour={hour}
                onToggle={() => updateHour(hour.dayOfWeek, "isOpen", !hour.isOpen)}
                onOpenChange={v => updateHour(hour.dayOfWeek, "openTime",  v)}
                onCloseChange={v => updateHour(hour.dayOfWeek, "closeTime", v)}
              />
            ))}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <SaveBtn
                loading={saving} label="Salvar horários" loadingLabel="Salvando..."
                onClick={handleSaveHorarios}
                gradient="linear-gradient(135deg,#0066FF,#7C3AED)"
              />
            </div>
          </SectionCard>
        )}

        {/* ══ TAB: MINHA CONTA ══════════════════════════════════════════════ */}
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
                  fontSize: 11, fontWeight: 600,
                  color: config?.plan === "PRO" ? "#F59E0B" : "#52525B",
                  backgroundColor: config?.plan === "PRO" ? "rgba(245,158,11,0.1)" : "#0D0D0D",
                  border: `1px solid ${config?.plan === "PRO" ? "rgba(245,158,11,0.2)" : "#1F1F1F"}`,
                  borderRadius: 6, padding: "2px 8px", display: "inline-block", marginTop: 6,
                }}>
                  {config?.plan === "PRO" ? "✦ PRO" : "FREE"}
                </span>
              </div>
            </div>

            {/* Google connection */}
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
              border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12,
              padding: "16px 20px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>Sair da conta</p>
                <p style={{ fontSize: 12, color: "#71717A", marginTop: 4 }}>
                  Você precisará fazer login novamente.
                </p>
              </div>
              <LogoutBtn onClick={() => { logout(); router.push("/auth/login") }} />
            </div>
          </SectionCard>
        )}

        {/* ══ TAB: PLANO ════════════════════════════════════════════════════ */}
        {activeTab === "plano" && (
          <SectionCard>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 20px" }}>
              Seu plano atual
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              {/* FREE */}
              <div style={{
                border: `1px solid ${config?.plan === "FREE" ? "rgba(0,102,255,0.3)" : "#1F1F1F"}`,
                borderRadius: 14, padding: "18px 20px",
                backgroundColor: config?.plan === "FREE" ? "rgba(0,102,255,0.04)" : "#0A0A0A",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>FREE</span>
                  {config?.plan === "FREE" && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#0066FF", backgroundColor: "rgba(0,102,255,0.1)", border: "1px solid rgba(0,102,255,0.2)", borderRadius: 6, padding: "2px 8px" }}>
                      Atual
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "8px 0 16px" }}>
                  R$ 0<span style={{ fontSize: 13, fontWeight: 400, color: "#52525B" }}>/mês</span>
                </p>
                {PLAN_FEATURES.map(f => (
                  <FeatureCell key={f.label} label={f.label} available={f.free} labelColor="#A1A1AA" />
                ))}
              </div>

              {/* PRO */}
              <div style={{
                border: `1px solid ${config?.plan === "PRO" ? "rgba(245,158,11,0.3)" : "#1F1F1F"}`,
                borderRadius: 14, padding: "18px 20px",
                backgroundColor: config?.plan === "PRO" ? "rgba(245,158,11,0.04)" : "#0A0A0A",
                position: "relative", overflow: "hidden",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", display: "flex", gap: 6, alignItems: "center" }}>
                    <Crown size={14} color="#F59E0B" /> PRO
                  </span>
                  {config?.plan === "PRO" && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 6, padding: "2px 8px" }}>
                      Atual
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "8px 0 16px" }}>
                  R$ 97<span style={{ fontSize: 13, fontWeight: 400, color: "#52525B" }}>/mês</span>
                </p>
                {PLAN_FEATURES.map(f => (
                  <FeatureCell key={f.label} label={f.label} available={f.pro} labelColor="#fff" />
                ))}
              </div>
            </div>

            {config?.plan === "FREE" && (
              <UpgradeBtn onClick={() => router.push("/dashboard/configuracoes?tab=plano")} />
            )}
          </SectionCard>
        )}
      </div>
    </>
  )
}