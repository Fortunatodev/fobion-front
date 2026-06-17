"use client"

import { Suspense, useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser } from "@/contexts/UserContext"
import type { BusinessPlan } from "@/types"
import { apiGet, apiPut, apiDelete } from "@/lib/api"
import PasswordCard from "@/components/settings/PasswordCard"
import EmailCard from "@/components/settings/EmailCard"
import PricingCards from "@/components/shared/PricingCards"
import SlotsPreview from "@/components/dashboard/SlotsPreview"
import PublicStorePreview from "@/components/dashboard/PublicStorePreview"
import TabTutorial from "@/components/shared/TabTutorial"
import {
  Building2, Clock, User, Shield,
  AlertCircle, CheckCircle2,
  Zap, X,
  Camera, Loader2, Calendar,
  Users, ChevronRight,
  Lightbulb, Instagram, MessageCircle,
  ShieldCheck,
} from "lucide-react"

const NEGOCIO_TUTORIAL_KEY = "forbion_negocio_tutorial_ok"

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
  cnpj?: string | null
  tier?: string | null
  plan: BusinessPlan
  isTrial?: boolean
  planExpiresAt?: string | null
  slug: string
  ownerAvatarUrl: string | null
  themeColor: string | null
  slotMinutes?: number | null
  requireApproval?: boolean | null
  whatsapp?: string | null
  inspectionEnabled?: boolean | null
  hours: BusinessHour[]
}

type SlotMinutes = 5 | 10 | 15 | 20 | 30 | 60
const SLOT_OPTIONS: SlotMinutes[] = [5, 10, 15, 20, 30, 60]

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

// Formata um telefone BR (só pros labels da UI). Aceita com/sem DDI; não valida.
function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "")
  // Remove DDI 55 se presente e sobrar um número nacional (10-11 dígitos).
  const nat = d.startsWith("55") && d.length > 11 ? d.slice(2) : d
  if (nat.length === 11) return `(${nat.slice(0, 2)}) ${nat.slice(2, 7)}-${nat.slice(7)}`
  if (nat.length === 10) return `(${nat.slice(0, 2)}) ${nat.slice(2, 6)}-${nat.slice(6)}`
  return raw
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
    <label style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-2)", display: "block", marginBottom: 6 }}>
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
        backgroundColor: readOnly ? "var(--c-elevated)" : "var(--c-bg)",
        border: `1px solid ${focused ? "rgba(0,102,255,0.4)" : "var(--c-border-2)"}`,
        borderRadius: 10, fontSize: 14, color: readOnly ? "var(--c-text-4)" : "var(--c-text)",
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
        background: loading ? "var(--c-surface-2)" : gradient,
        color: loading ? "var(--c-text-4)" : "var(--c-text)",
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
      backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)",
      borderRadius: 16, padding: "24px 20px",
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
        color: active ? "var(--c-text)" : "var(--c-text-3)",
        fontSize: 13, fontWeight: active ? 600 : 400,
        cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
        whiteSpace: "nowrap", flexShrink: 0,
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
        backgroundColor: "var(--c-bg)",
        border: `1px solid ${focused ? "rgba(0,102,255,0.4)" : "var(--c-border-2)"}`,
        borderRadius: 10, fontSize: 14, color: "var(--c-text)",
        outline: "none", fontFamily: "inherit", resize: "vertical",
        transition: "border-color 0.15s", boxSizing: "border-box" as const,
      }}
    />
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
      padding: "10px 0", borderBottom: "1px solid var(--c-surface-2)",
    }}>
      <div style={{ width: 80, fontSize: 13, color: "var(--c-text-2)", flexShrink: 0 }}>
        {DAY_LABELS[hour.dayOfWeek]}
      </div>
      <div
        onClick={onToggle}
        style={{
          width: 40, height: 22, borderRadius: 100,
          backgroundColor: hour.isOpen ? "#0066FF" : "var(--c-border-2)",
          cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <div style={{
          position: "absolute", top: 3,
          left: hour.isOpen ? 21 : 3,
          width: 16, height: 16, borderRadius: "50%",
          backgroundColor: "var(--c-text)", transition: "left 0.2s",
        }} />
      </div>
      {hour.isOpen ? (
        <>
          <TimeInput value={hour.openTime}  onChange={onOpenChange}  />
          <span style={{ fontSize: 12, color: "var(--c-text-4)" }}>até</span>
          <TimeInput value={hour.closeTime} onChange={onCloseChange} />
        </>
      ) : (
        <span style={{ fontSize: 12, color: "var(--c-text-4)" }}>Fechado</span>
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
        height: 34, padding: "0 10px", backgroundColor: "var(--c-bg)",
        border: "1px solid var(--c-border-2)", borderRadius: 8,
        fontSize: 13, color: "var(--c-text)", outline: "none",
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
      fontSize: 18, fontWeight: 700, color: "var(--c-on-primary)",
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

// ── Page ──────────────────────────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 120px)" }}>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center", padding: 24 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Shield size={28} color="#EF4444" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--c-text)", margin: "0 0 8px" }}>Acesso restrito</h2>
        <p style={{ fontSize: 13, color: "var(--c-text-3)", lineHeight: 1.6, margin: 0 }}>
          As configurações da loja são exclusivas do dono.
        </p>
      </div>
    </div>
  )
}

export default function ConfiguracoesPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--c-border)", borderTopColor: "#0066FF", animation: "sp 0.7s linear infinite" }} />
      </div>
    }>
      <ConfiguracoesContent />
    </Suspense>
  )
}

function ConfiguracoesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, logout, loading: userLoading } = useUser()

  const [config,      setConfig]      = useState<BusinessConfig | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [success,     setSuccess]     = useState<string | null>(null)
  const [activeTab,   setActiveTab]   = useState<TabId>("negocio")
  const [isMobile,    setIsMobile]    = useState(false)
  // Tutorial dispensável da aba Negócio. Começa fechado pra evitar flash; o efeito
  // de mount reabre se o dono ainda não dispensou (chave em localStorage).
  const [showNegocioTutorial, setShowNegocioTutorial] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => {
    try {
      if (localStorage.getItem(NEGOCIO_TUTORIAL_KEY) !== "1") setShowNegocioTutorial(true)
    } catch {
      setShowNegocioTutorial(true)
    }
  }, [])

  function dismissNegocioTutorial() {
    setShowNegocioTutorial(false)
    try { localStorage.setItem(NEGOCIO_TUTORIAL_KEY, "1") } catch { /* ignore */ }
  }

  const [formName,        setFormName]        = useState("")
  const [formPhone,       setFormPhone]       = useState("")
  const [formEmail,       setFormEmail]       = useState("")
  const [formAddress,     setFormAddress]     = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formCnpj,        setFormCnpj]        = useState("")
  const [ownerAvatarUrl,  setOwnerAvatarUrl]  = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [themeColor,      setThemeColor]      = useState("#0066FF")
  const [colorSaved,      setColorSaved]      = useState(false)
  const [slotMinutes,     setSlotMinutes]     = useState<SlotMinutes>(30)
  const [requireApproval, setRequireApproval] = useState(false)
  const [inspectionEnabled, setInspectionEnabled] = useState(false)
  const [formWhatsapp,    setFormWhatsapp]    = useState("")
  const [waSource,        setWaSource]        = useState<"phone" | "other">("other")
  const [hours,           setHours]           = useState<BusinessHour[]>([])
  const [calendarConnected, setCalendarConnected] = useState(false)
  const [calendarLoading,   setCalendarLoading]   = useState(false)

  const avatarInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<{ user: unknown; business: BusinessConfig }>("/auth/me")
      const biz = res.business
      if (!biz) {
        setError("Negócio não encontrado.")
        setLoading(false)
        return
      }
      setConfig(biz)
      setFormName(biz.name ?? "")
      setFormPhone(biz.phone ?? "")
      setFormEmail(biz.email ?? "")
      setFormAddress(biz.address ?? "")
      setFormDescription(biz.description ?? "")
      setFormCnpj(biz.cnpj ?? "")
      setOwnerAvatarUrl(biz.ownerAvatarUrl ?? null)
      setThemeColor(biz.themeColor ?? "#0066FF")
      const slot = biz.slotMinutes ?? 30
      setSlotMinutes((SLOT_OPTIONS.includes(slot as SlotMinutes) ? slot : 30) as SlotMinutes)
      setRequireApproval(biz.requireApproval ?? false)
      setInspectionEnabled(biz.inspectionEnabled ?? false)
      // WhatsApp inteligente: se ainda não há whatsapp e existe phone cadastrado,
      // sugere o phone (modo "phone"). Se já há whatsapp, mantém o valor (modo "other").
      const bizWhatsapp = (biz.whatsapp ?? "").trim()
      const bizPhone = (biz.phone ?? "").trim()
      if (!bizWhatsapp && bizPhone) {
        setWaSource("phone")
        setFormWhatsapp(bizPhone)
      } else {
        setWaSource("other")
        setFormWhatsapp(bizWhatsapp)
      }

      const filled: BusinessHour[] = Array.from({ length: 7 }, (_, i) => {
        const found = biz.hours?.find((h) => h.dayOfWeek === i)
        return found ?? { dayOfWeek: i, isOpen: i !== 0, openTime: "08:00", closeTime: "18:00" }
      })
      // Loja nunca salvou horário → só preenche o ESTADO LOCAL com os defaults
      // (sem PUT no mount). A persistência só acontece quando o dono clica
      // "Salvar horários" (handleSaveHorarios). Os defaults já são editáveis na UI.
      setHours(filled)
      setError(null)
    } catch {
      setError("Erro ao carregar configurações.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  // ── Google Calendar status ──────────────────────────────────────────────────
  const fetchCalendarStatus = useCallback(async () => {
    try {
      const res = await apiGet<{ connected: boolean }>("/auth/google/calendar/status")
      setCalendarConnected(res.connected)
    } catch {
      // silently ignore
    }
  }, [])

  useEffect(() => { fetchCalendarStatus() }, [fetchCalendarStatus])

  // Deep-link de aba via ?tab= (ex.: CTA de upgrade da Vistoria abre direto no "Plano")
  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab && TABS.some((t) => t.id === tab)) {
      setActiveTab(tab as TabId)
    }
  }, [searchParams])

  // Handle ?calendar=success|error from OAuth callback redirect
  useEffect(() => {
    const cal = searchParams.get("calendar")
    if (cal === "success") {
      setCalendarConnected(true)
      setSuccess("Google Calendar conectado com sucesso!")
      toast.success("Google Calendar conectado com sucesso!")
      setTimeout(() => setSuccess(null), 4000)
      setActiveTab("conta")
      router.replace("/dashboard/configuracoes")
    } else if (cal === "error") {
      setError("Erro ao conectar Google Calendar. Tente novamente.")
      toast.error("Erro ao conectar Google Calendar. Tente novamente.")
      setActiveTab("conta")
      router.replace("/dashboard/configuracoes")
    }
  }, [searchParams, router])

  async function handleCalendarConnect() {
    const token = typeof window !== "undefined" ? localStorage.getItem("forbion_token") : null
    if (!token) return
    // Redirect to backend calendar connect (which needs auth). We pass token as query param
    // since the browser redirect won't have the Authorization header.
    window.location.href = `${API}/api/auth/google/calendar/connect?token=${token}`
  }

  async function handleCalendarDisconnect() {
    setCalendarLoading(true)
    try {
      await apiDelete("/auth/google/calendar/disconnect")
      setCalendarConnected(false)
      showSuccess("Google Calendar desconectado.")
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "Erro ao desconectar Google Calendar."
      setError(msg)
      toast.error(msg)
    } finally {
      setCalendarLoading(false)
    }
  }

  function showSuccess(msg: string) {
    setSuccess(msg)
    toast.success(msg)
    setTimeout(() => setSuccess(null), 4000)
  }

  // ── Save negócio ───────────────────────────────────────────────────────────
  async function handleSaveNegocio() {
    if (!formName.trim() || !formPhone.trim()) {
      const faltando = !formName.trim()
        ? (!formPhone.trim() ? "o nome e o telefone" : "o nome do estabelecimento")
        : "o telefone"
      setError("Nome e telefone são obrigatórios.")
      toast.error(`Preencha ${faltando} para salvar.`)
      return
    }
    setSaving(true); setError(null); setSuccess(null)
    try {
      await apiPut("/auth/business", {
        name:           formName.trim(),
        phone:          formPhone.trim(),
        email:          formEmail.trim() || undefined,
        address:        formAddress.trim() || undefined,
        description:    formDescription.trim() || undefined,
        cnpj:           formCnpj.trim(),
        inspectionEnabled,
      })
      showSuccess("Alterações salvas com sucesso!")
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "Erro ao salvar. Tente novamente."
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // ── Save horários ──────────────────────────────────────────────────────────
  async function handleSaveHorarios() {
    setSaving(true); setError(null); setSuccess(null)
    try {
      // Config de agenda (intervalo, aprovação, WhatsApp) mora nesta aba e persiste
      // junto com os horários. WhatsApp = dígitos do telefone cadastrado (modo "phone")
      // ou do número digitado (modo "other").
      const whatsapp = (waSource === "phone" ? formPhone : formWhatsapp).replace(/\D/g, "")
      await Promise.all([
        apiPut("/auth/business/hours", { hours }),
        apiPut("/auth/business", { slotMinutes, requireApproval, whatsapp }),
      ])
      showSuccess("Horários e agenda salvos com sucesso!")
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "Erro ao salvar horários."
      setError(msg)
      toast.error(msg)
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
      toast.error("Imagem muito grande. Escolha um arquivo de até 2MB.")
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
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "Erro ao enviar a foto. Tente novamente."
      setError(msg)
      toast.error(msg)
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
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "Erro ao salvar a cor."
      setError(msg)
      toast.error(msg)
    }
  }

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"
  const slug      = config?.slug ?? ""
  const publicUrl = `${appUrl}/${slug}`
  // Versão "bonita" do link só pra exibir (sem https:// e sem porta de dev).
  // Mantém o domínio real configurado; cai num placeholder amigável em dev local.
  const displayHost = appUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
  const displayUrl  = `${/localhost|127\.0\.0\.1/.test(displayHost) ? "app.forbion.digital" : displayHost}/${slug}`
  const openDays  = hours.filter((h) => h.isOpen).length
  const themeRgb  = hexToRgb(themeColor)
  const isPro     = config?.plan === "PRO"

  // ── Guard de role: área exclusiva do dono (espelha ownerOnly do Sidebar) ──
  if (!userLoading && user?.role === "EMPLOYEE") {
    return <AccessDenied />
  }

  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <style>{`@keyframes skelCfg{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 0 40px" }}>
          <div style={{ height: 36, width: 200, backgroundColor: "var(--c-surface-2)", borderRadius: 10, marginBottom: 8, animation: "skelCfg 1.5s ease infinite" }} />
          <div style={{ height: 16, width: 280, backgroundColor: "var(--c-surface)", borderRadius: 8, marginBottom: 32, animation: "skelCfg 1.5s ease 0.1s infinite" }} />
          <div style={{ height: 300, backgroundColor: "var(--c-surface)", borderRadius: 16, animation: "skelCfg 1.5s ease 0.2s infinite" }} />
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
        padding: isMobile ? "16px 14px 40px" : undefined,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        animation: "fadeInCfg 0.3s ease",
      }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom: isMobile ? 20 : 32 }}>
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>
            Configurações
          </h1>
          <p style={{ fontSize: 14, color: "var(--c-text-3)", marginTop: 6 }}>
            Gerencie as informações do seu negócio
          </p>
        </div>

        <TabTutorial
          tabKey="configuracoes"
          title="Como usar as Configurações"
          subtitle="Tudo da sua loja em um lugar"
          steps={[
            { icon: Building2, title: "1. Negócio", text: "Nome, telefone, logo e a cor da sua loja pública. É o que o cliente vê no seu link de agendamento." },
            { icon: Clock, title: "2. Horários e agenda", text: "Defina os dias e horas que você atende, o intervalo entre horários e se quer aprovar cada agendamento antes de confirmar." },
            { icon: User, title: "3. Minha conta", text: "Troque seu e-mail e senha de acesso, conecte o Google Agenda e saia da conta quando precisar." },
          ]}
        />

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
          backgroundColor: "var(--c-elevated)", border: "1px solid var(--c-border)",
          borderRadius: 12, padding: 4,
          width: isMobile ? "100%" : "fit-content",
          overflowX: isMobile ? "auto" : undefined,
          WebkitOverflowScrolling: "touch",
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
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--c-text)", margin: "0 0 20px" }}>
              Informações do negócio
            </h2>

            {/* ── TUTORIAL/DICA DISPENSÁVEL ── */}
            {showNegocioTutorial && (
              <div style={{
                position: "relative",
                backgroundColor: `rgba(${themeRgb},0.07)`,
                border: `1px solid rgba(${themeRgb},0.22)`,
                borderRadius: 12, padding: "14px 40px 14px 16px", marginBottom: 24,
                display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                  backgroundColor: `rgba(${themeRgb},0.14)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Lightbulb size={16} color={themeColor} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
                    Essa é a cara da sua loja
                  </p>
                  <p style={{ fontSize: 12.5, color: "var(--c-text-2)", margin: "4px 0 0", lineHeight: 1.55 }}>
                    Estas informações aparecem na sua loja pública (seu link de agendamento).
                    Capriche no nome e na descrição: é a primeira coisa que o cliente vê.
                  </p>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 9 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--c-text-3)" }}>
                      <Instagram size={13} color={themeColor} /> Coloque o link na bio do Instagram
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--c-text-3)" }}>
                      <MessageCircle size={13} color={themeColor} /> Compartilhe no WhatsApp dos clientes
                    </span>
                  </div>
                </div>
                <button
                  onClick={dismissNegocioTutorial}
                  aria-label="Dispensar dica"
                  title="Dispensar"
                  style={{
                    position: "absolute", top: 10, right: 10,
                    width: 24, height: 24, borderRadius: 7, border: "none",
                    backgroundColor: "transparent", color: "var(--c-text-4)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* ── FORMULÁRIO + PREVIEW AO VIVO ── */}
            <div style={{
              display: "grid",
              // minmax(0,1fr) (em vez de 1fr): deixa a coluna ENCOLHER abaixo do
              // min-content. Sem isso, conteúdo nowrap (ex.: a URL no preview)
              // força a coluna a ficar mais larga que a tela no mobile → corte.
              gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) 320px",
              gap: isMobile ? 24 : 28,
              alignItems: "start",
            }}>
              {/* Coluna esquerda: formulário */}
              <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <FieldLabel required>Nome do estabelecimento</FieldLabel>
                <TextInput value={formName} onChange={setFormName} placeholder="Ex: Auto Estética Premium" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
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
              <div>
                <FieldLabel>CNPJ <span style={{ color: "var(--c-text-4)", fontWeight: 400 }}>(necessário pra emitir NF-e)</span></FieldLabel>
                <TextInput value={formCnpj} onChange={setFormCnpj} placeholder="00.000.000/0000-00" />
              </div>
            </div>
              </div>

              {/* Coluna direita: preview ao vivo da loja pública */}
              <div style={{ position: isMobile ? "static" : "sticky", top: 16 }}>
                <PublicStorePreview
                  name={formName}
                  description={formDescription}
                  phone={formPhone}
                  avatarUrl={ownerAvatarUrl}
                  accent={themeColor}
                  hours={hours}
                  publicUrl={publicUrl}
                  displayUrl={displayUrl}
                />
              </div>
            </div>

            {/* ── SEÇÃO: PERFIL DO PROPRIETÁRIO ── */}
            <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid var(--c-border)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)", margin: "0 0 16px" }}>
                Perfil do proprietário
              </h3>

              <div style={{ display: "flex", gap: 20, alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row" }}>
                {/* Preview avatar */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  {ownerAvatarUrl ? (
                    <img
                      src={ownerAvatarUrl}
                      alt="Avatar"
                      style={{
                        width: 80, height: 80, borderRadius: "50%",
                        objectFit: "cover", border: "2px solid var(--c-border)",
                        display: "block",
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 80, height: 80, borderRadius: "50%",
                      background: `linear-gradient(135deg, ${themeColor}, ${themeColor}99)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 28, fontWeight: 800, color: "var(--c-on-primary)",
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
                      border: "2px solid var(--c-bg)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: uploadingAvatar ? "not-allowed" : "pointer",
                      transition: "background 0.15s",
                    }}
                  >
                    {uploadingAvatar
                      ? <Loader2 size={11} color="var(--c-text)" style={{ animation: "spinCfg 0.7s linear infinite" }} />
                      : <Camera size={12} color="var(--c-text)" />}
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
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)", margin: 0 }}>
                    Foto de perfil
                  </p>
                  <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "4px 0 0" }}>
                    Aparece na sua loja para os clientes te reconhecerem.
                  </p>
                  <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: "4px 0 0" }}>
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
            <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid var(--c-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
                  Cor da loja
                </h3>
                {colorSaved && (
                  <span style={{ fontSize: 11, color: "#10B981", display: "flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle2 size={11} /> Cor salva ✓
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "0 0 16px" }}>
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
                      border: themeColor === c.value ? "3px solid var(--c-text)" : "3px solid transparent",
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
                backgroundColor: "var(--c-elevated)", border: "1px solid var(--c-border)",
              }}>
                <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: "0 0 10px", letterSpacing: "1px", textTransform: "uppercase" }}>
                  Preview
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {/* Botão CTA */}
                  <button style={{
                    height: 36, padding: "0 16px", borderRadius: 10,
                    backgroundColor: themeColor, color: "var(--c-text)",
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
                    fontSize: 13, fontWeight: 700, color: "var(--c-on-primary)",
                  }}>
                    {(formName || "M").charAt(0).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            {/* ── SEÇÃO: VISTORIA DE VEÍCULOS (feature do Pro) ── */}
            <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid var(--c-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
                  Recursos
                </h3>
              </div>
              <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "0 0 16px" }}>
                Funcionalidades extras da sua operação
              </p>

              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16,
                padding: "14px 16px", borderRadius: 12,
                backgroundColor: inspectionEnabled && isPro ? "rgba(0,102,255,0.06)" : "var(--c-bg)",
                border: `1px solid ${inspectionEnabled && isPro ? "rgba(0,102,255,0.3)" : "var(--c-border-2)"}`,
                opacity: isPro ? 1 : 0.85,
                transition: "all 0.15s",
              }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                    backgroundColor: "rgba(0,102,255,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <ShieldCheck size={16} color="#0066FF" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>
                        Habilitar Vistoria de veículos
                      </span>
                      {!isPro && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 6, padding: "2px 7px", letterSpacing: "0.5px" }}>
                          DISPONÍVEL NO PRO
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "4px 0 0", lineHeight: 1.5 }}>
                      Registre o estado do carro na entrada/saída com fotos e assinatura — vira prova contra disputa.
                    </p>
                  </div>
                </div>
                <div
                  onClick={() => { if (isPro) setInspectionEnabled((v) => !v) }}
                  role="switch"
                  aria-checked={inspectionEnabled && isPro}
                  aria-disabled={!isPro}
                  tabIndex={isPro ? 0 : -1}
                  onKeyDown={(e) => { if (isPro && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setInspectionEnabled((v) => !v) } }}
                  style={{
                    width: 40, height: 22, borderRadius: 100, marginTop: 2,
                    backgroundColor: inspectionEnabled && isPro ? "#0066FF" : "var(--c-border-2)",
                    cursor: isPro ? "pointer" : "not-allowed",
                    position: "relative", transition: "background 0.2s", flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: "absolute", top: 3,
                    left: inspectionEnabled && isPro ? 21 : 3,
                    width: 16, height: 16, borderRadius: "50%",
                    backgroundColor: "var(--c-text)", transition: "left 0.2s",
                  }} />
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
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
                  Horário de funcionamento
                </h2>
                <p style={{ fontSize: 13, color: "var(--c-text-4)", marginTop: 4 }}>
                  {openDays} dia{openDays !== 1 ? "s" : ""} aberto{openDays !== 1 ? "s" : ""} por semana
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", marginBottom: 18, borderRadius: 10, backgroundColor: "rgba(0,102,255,0.06)", border: "1px solid rgba(0,102,255,0.15)" }}>
              <Clock size={14} color="#0066FF" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--c-text-2)", lineHeight: 1.5 }}>
                Estes horários aparecem na sua <strong style={{ color: "var(--c-text)" }}>loja pública</strong> e definem o {"“Aberto agora”"}. Clique em <strong style={{ color: "var(--c-text)" }}>Salvar horários</strong> sempre que alterar.
              </span>
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

            {/* ── SEÇÃO: AGENDA E AGENDAMENTO ── */}
            <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid var(--c-border)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)", margin: "0 0 16px" }}>
                Agenda e agendamento
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Intervalo da agenda */}
                <div>
                  <FieldLabel>Intervalo da agenda</FieldLabel>
                  <select
                    value={slotMinutes}
                    onChange={(e) => setSlotMinutes(Number(e.target.value) as SlotMinutes)}
                    style={{
                      width: "100%", height: 42, padding: "0 14px",
                      backgroundColor: "var(--c-bg)",
                      border: "1px solid var(--c-border-2)",
                      borderRadius: 10, fontSize: 14, color: "var(--c-text)",
                      outline: "none", fontFamily: "inherit",
                      boxSizing: "border-box" as const, cursor: "pointer",
                    }}
                  >
                    {SLOT_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                  <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "6px 0 0" }}>
                    De quanto em quanto tempo os horários aparecem pro cliente.
                  </p>
                  {/* Mini-calendário ao vivo da agenda do cliente — reativo ao expediente + intervalo */}
                  <SlotsPreview
                    slotMinutes={slotMinutes}
                    hours={hours}
                    accent={themeColor}
                  />
                </div>

                {/* Exigir aprovação */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)", margin: 0 }}>
                        Exigir minha aprovação
                      </p>
                      <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "4px 0 0", lineHeight: 1.5 }}>
                        Esta é sua loja pública — o cliente agenda sozinho pelo seu link. Escolha como funciona:
                      </p>
                    </div>
                    <div
                      onClick={() => setRequireApproval((v) => !v)}
                      role="switch"
                      aria-checked={requireApproval}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRequireApproval((v) => !v) } }}
                      style={{
                        width: 40, height: 22, borderRadius: 100, marginTop: 2,
                        backgroundColor: requireApproval ? themeColor : "var(--c-border-2)",
                        cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
                      }}
                    >
                      <div style={{
                        position: "absolute", top: 3,
                        left: requireApproval ? 21 : 3,
                        width: 16, height: 16, borderRadius: "50%",
                        backgroundColor: "var(--c-text)", transition: "left 0.2s",
                      }} />
                    </div>
                  </div>

                  {/* Explicação dos 2 modos — estado ativo em destaque */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                    {/* DESLIGADO: agendamento direto */}
                    <div
                      onClick={() => setRequireApproval(false)}
                      style={{
                        display: "flex", gap: 10, alignItems: "flex-start",
                        padding: "11px 14px", borderRadius: 10, cursor: "pointer",
                        backgroundColor: !requireApproval ? "rgba(16,185,129,0.08)" : "var(--c-bg)",
                        border: `1px solid ${!requireApproval ? "rgba(16,185,129,0.35)" : "var(--c-border-2)"}`,
                        transition: "all 0.15s",
                      }}
                    >
                      <Zap size={15} color={!requireApproval ? "#10B981" : "var(--c-text-4)"} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>Agendamento direto</span>
                          {!requireApproval && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#10B981", backgroundColor: "rgba(16,185,129,0.12)", borderRadius: 6, padding: "2px 7px", letterSpacing: "0.5px" }}>
                              ATIVO
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "3px 0 0", lineHeight: 1.5 }}>
                          O horário já fica confirmado na sua agenda assim que o cliente escolhe.
                        </p>
                      </div>
                    </div>

                    {/* LIGADO: você aprova antes */}
                    <div
                      onClick={() => setRequireApproval(true)}
                      style={{
                        display: "flex", gap: 10, alignItems: "flex-start",
                        padding: "11px 14px", borderRadius: 10, cursor: "pointer",
                        backgroundColor: requireApproval ? `rgba(${themeRgb},0.08)` : "var(--c-bg)",
                        border: `1px solid ${requireApproval ? `rgba(${themeRgb},0.4)` : "var(--c-border-2)"}`,
                        transition: "all 0.15s",
                      }}
                    >
                      <Shield size={15} color={requireApproval ? themeColor : "var(--c-text-4)"} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>Você aprova antes</span>
                          {requireApproval && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: themeColor, backgroundColor: `rgba(${themeRgb},0.14)`, borderRadius: 6, padding: "2px 7px", letterSpacing: "0.5px" }}>
                              ATIVO
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "3px 0 0", lineHeight: 1.5 }}>
                          O cliente sinaliza o horário desejado, entra como {"“Solicitado”"}, e só vira confirmado quando você aprovar (na aba Agendamentos).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* WhatsApp da loja — inteligente */}
                <div>
                  <FieldLabel>WhatsApp da loja</FieldLabel>
                  <div role="radiogroup" aria-label="Número de WhatsApp da loja" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* Opção 1: usar o telefone cadastrado */}
                    <div
                      role="radio"
                      aria-checked={waSource === "phone"}
                      tabIndex={0}
                      onClick={() => formPhone.trim() && setWaSource("phone")}
                      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && formPhone.trim()) { e.preventDefault(); setWaSource("phone") } }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 14px", borderRadius: 10,
                        backgroundColor: waSource === "phone" ? "rgba(0,102,255,0.08)" : "var(--c-bg)",
                        border: `1px solid ${waSource === "phone" ? "rgba(0,102,255,0.4)" : "var(--c-border-2)"}`,
                        cursor: formPhone.trim() ? "pointer" : "not-allowed",
                        opacity: formPhone.trim() ? 1 : 0.5,
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{
                        width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                        border: `2px solid ${waSource === "phone" ? "#0066FF" : "var(--c-border-2)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {waSource === "phone" && <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#0066FF" }} />}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--c-text-2)" }}>
                        Usar meu telefone cadastrado{formPhone.trim() ? ` (${formatPhone(formPhone)})` : ""}
                      </span>
                    </div>

                    {/* Opção 2: usar outro número */}
                    <div
                      role="radio"
                      aria-checked={waSource === "other"}
                      tabIndex={0}
                      onClick={() => setWaSource("other")}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setWaSource("other") } }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 14px", borderRadius: 10,
                        backgroundColor: waSource === "other" ? "rgba(0,102,255,0.08)" : "var(--c-bg)",
                        border: `1px solid ${waSource === "other" ? "rgba(0,102,255,0.4)" : "var(--c-border-2)"}`,
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      <span style={{
                        width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                        border: `2px solid ${waSource === "other" ? "#0066FF" : "var(--c-border-2)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {waSource === "other" && <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#0066FF" }} />}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--c-text-2)" }}>Usar outro número</span>
                    </div>
                  </div>

                  {/* Campo livre — só quando "outro número" */}
                  {waSource === "other" && (
                    <div style={{ marginTop: 10 }}>
                      <TextInput value={formWhatsapp} onChange={setFormWhatsapp} placeholder="55 47 99999-9999" type="tel" />
                    </div>
                  )}
                  <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "8px 0 0" }}>
                    Usado pro cliente confirmar o agendamento no seu WhatsApp.
                  </p>
                </div>
              </div>
            </div>

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
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--c-text)", margin: "0 0 20px" }}>
              Minha conta
            </h2>

            {/* Profile card */}
            <div style={{
              display: "flex", gap: 16, alignItems: isMobile ? "flex-start" : "center",
              flexDirection: isMobile ? "column" : "row",
              marginBottom: 24,
              backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)",
              borderRadius: 14, padding: isMobile ? "16px 14px" : "16px 20px",
            }}>
              <UserAvatar name={user?.name ?? ""} picture={user?.picture} />
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
                  {user?.name ?? "—"}
                </p>
                <p style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 4 }}>
                  {user?.email ?? "—"}
                </p>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: config?.plan === "PRO" ? "#F59E0B" : "#0066FF",
                  backgroundColor: config?.plan === "PRO" ? "rgba(245,158,11,0.1)" : "rgba(0,102,255,0.1)",
                  border: `1px solid ${config?.plan === "PRO" ? "rgba(245,158,11,0.2)" : "rgba(0,102,255,0.2)"}`,
                  borderRadius: 6, padding: "2px 8px", display: "inline-block", marginTop: 6,
                }}>
                  {config?.plan === "PRO"
                    ? `✦ ${config?.tier ? config.tier.charAt(0).toUpperCase() + config.tier.slice(1) : "Pro"}`
                    : "Essencial"}
                  {config?.isTrial ? " · Trial" : ""}
                </span>
              </div>
            </div>

            {/* Google connection */}
            <div style={{
              backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)",
              borderRadius: 12, padding: isMobile ? "14px 14px" : "14px 16px",
              display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center",
              flexDirection: isMobile ? "column" : "row", gap: isMobile ? 10 : 0,
              marginBottom: 24,
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <GoogleIcon />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text)", margin: 0 }}>Google</p>
                  <p style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 2 }}>
                    Conectado como {user?.email}
                  </p>
                </div>
              </div>
              <span style={{ fontSize: 12, color: "#10B981", fontWeight: 500 }}>Conectado</span>
            </div>

            {/* Google Calendar integration */}
            <div style={{
              backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)",
              borderRadius: 12, padding: isMobile ? "14px 14px" : "14px 16px",
              display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center",
              flexDirection: isMobile ? "column" : "row", gap: isMobile ? 10 : 0,
              marginBottom: 24,
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Calendar size={16} color={calendarConnected ? "#10B981" : "var(--c-text-3)"} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text)", margin: 0 }}>
                    Google Calendar
                  </p>
                  <p style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 2 }}>
                    {calendarConnected
                      ? "Agendamentos sincronizados com seu calendário"
                      : "Sincronize agendamentos com o Google Calendar"}
                  </p>
                </div>
              </div>

              {calendarConnected ? (
                <button
                  onClick={handleCalendarDisconnect}
                  disabled={calendarLoading}
                  style={{
                    height: 32, padding: "0 14px", borderRadius: 8,
                    border: "1px solid rgba(239,68,68,0.2)",
                    backgroundColor: "transparent",
                    color: "#EF4444", fontSize: 12, fontWeight: 500,
                    cursor: calendarLoading ? "not-allowed" : "pointer",
                    fontFamily: "inherit", transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {calendarLoading ? <Spinner size={11} color="#EF4444" /> : null}
                  Desconectar
                </button>
              ) : (
                <button
                  onClick={handleCalendarConnect}
                  style={{
                    height: 32, padding: "0 14px", borderRadius: 8,
                    border: "none",
                    background: "linear-gradient(135deg,#0066FF,#7C3AED)",
                    color: "var(--c-on-primary)", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <Calendar size={12} />
                  Conectar
                </button>
              )}
            </div>

            {/* Troca do e-mail de login */}
            <EmailCard isMobile={isMobile} />

            {/* IMP-101 — troca/definição de senha */}
            <PasswordCard isMobile={isMobile} />

            {/* V2-B4: gestão de acessos da equipe (RBAC) — vive na aba Acessos agora.
                Aqui só um atalho; o formulário de criar/editar logins mora em /dashboard/acessos. */}
            <div
              onClick={() => router.push("/dashboard/acessos")}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push("/dashboard/acessos") } }}
              style={{
                backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)",
                borderRadius: 12, padding: isMobile ? "14px 14px" : "14px 16px",
                marginBottom: 24, cursor: "pointer",
                display: "flex", justifyContent: "space-between",
                alignItems: isMobile ? "flex-start" : "center",
                flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0,
                transition: "border-color 0.15s",
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Users size={16} color="var(--c-text-3)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text)", margin: 0 }}>
                    Equipe &amp; acessos
                  </p>
                  <p style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 2, lineHeight: 1.5 }}>
                    Crie e gerencie os logins dos funcionários numa página dedicada.
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); router.push("/dashboard/acessos") }}
                style={{
                  height: 36, padding: "0 14px", borderRadius: 9, border: "1px solid var(--c-border-2)",
                  background: "transparent", color: "var(--c-text-2)", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
                  flexShrink: 0, whiteSpace: "nowrap",
                }}
              >
                Gerenciar acessos <ChevronRight size={14} />
              </button>
            </div>

            {/* Danger zone */}
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#EF4444", margin: "0 0 12px" }}>
              Zona de perigo
            </h3>
            <div style={{
              border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12,
              padding: isMobile ? "14px 14px" : "16px 20px",
              display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center",
              flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0,
            }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)", margin: 0 }}>Sair da conta</p>
                <p style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 4 }}>
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
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--c-text)", margin: "0 0 20px" }}>
              Seu plano atual
            </h2>

            {/* V2-B1: contador de vencimento do trial/plano (QW-06) */}
            {config?.planExpiresAt && (() => {
              const days = Math.ceil((new Date(config.planExpiresAt as string).getTime() - Date.now()) / 86400000)
              const expired = days < 0
              const urgent = expired || days <= 3
              const warn = !urgent && days <= 7
              const color = urgent ? "#EF4444" : warn ? "#F59E0B" : "#10B981"
              const label = expired
                ? `${config?.isTrial ? "Seu teste" : "Seu plano"} venceu há ${Math.abs(days)} dia${Math.abs(days) !== 1 ? "s" : ""}`
                : `${config?.isTrial ? "Seu teste grátis" : "Seu plano"} expira em ${days} dia${days !== 1 ? "s" : ""}`
              return (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  backgroundColor: `${color}14`, border: `1px solid ${color}33`,
                  borderRadius: 12, padding: "11px 16px", marginBottom: 20,
                }}>
                  <Clock size={15} color={color} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color }}>{label}</span>
                  {(urgent || warn) && config?.plan !== "PRO" && (
                    <span style={{ fontSize: 12, color: "var(--c-text-2)", marginLeft: "auto" }}>
                      Garanta o acesso fazendo o upgrade 👇
                    </span>
                  )}
                </div>
              )
            })()}

            {/* 3 tiers reais (lê /billing/tiers → checkout Cakto) */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)", margin: "0 0 14px" }}>Escolha seu plano</h3>
              {/* Tier efetivo p/ destacar o card "Seu plano atual": assinante pago tem tier setado;
                  legado/PRO sem tier cai pra "pro" (top tier vendável); trial/free (plan≠PRO) não destaca nada. */}
              <PricingCards currentTier={config?.tier ?? (config?.plan === "PRO" ? "pro" : null)} />
            </div>

          </SectionCard>
        )}
      </div>
    </>
  )
}