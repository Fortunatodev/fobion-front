"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, Edit3, Trash2, X, Crown,
  Users, Percent, AlertCircle, Link2,
  Package,
} from "lucide-react"
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api"
import { useUser } from "@/contexts/UserContext"
import ProFeatureGate from "@/components/shared/ProFeatureGate"

// ── Types ─────────────────────────────────────────────────────────────────────

type DiscountType = "FREE" | "PERCENTAGE" | "FIXED"

interface ServiceRule {
  serviceId: string
  discountType: DiscountType
  discountValue: number | null
  maxUsages: number | null
}

interface PlanServiceFromAPI {
  id: string
  serviceId: string
  discountType: DiscountType
  discountValue: number | null
  maxUsages: number | null
  service: { id: string; name: string; price: number }
}

interface CustomerPlan {
  id: string
  name: string
  description: string | null
  price: number
  interval: "MONTHLY" | "YEARLY"
  discountPercent: number
  cactopayPaymentLink: string | null
  isActive: boolean
  createdAt: string
  activeSubscribersCount: number
  subscriptions: unknown[]
  planServices?: PlanServiceFromAPI[]
}

interface ServiceItem { id: string; name: string; price: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function discountLabel(rule: PlanServiceFromAPI): string {
  switch (rule.discountType) {
    case "FREE": return "Grátis"
    case "PERCENTAGE": return `${rule.discountValue ?? 0}% off`
    case "FIXED": return `${formatCurrency(rule.discountValue ?? 0)} off`
    default: return ""
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner({ size = 14, color = "white" }: { size?: number; color?: string }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid rgba(255,255,255,0.2)`, borderTopColor: color,
      animation: "spinPl 0.7s linear infinite",
      display: "inline-block", flexShrink: 0,
    }} />
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 500, color: "#A1A1AA", marginBottom: 6, display: "block" }}>
      {children}{required && <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>}
    </label>
  )
}

function FieldInput({
  label, value, onChange, placeholder, required, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; type?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          height: 42, backgroundColor: "#0A0A0A",
          border: `1px solid ${focused ? "#0066FF" : "#252525"}`,
          borderRadius: 10, padding: "0 14px",
          fontSize: 14, color: "#ffffff", outline: "none",
          width: "100%", boxSizing: "border-box",
          transition: "border-color 0.15s", fontFamily: "inherit",
        }}
      />
    </div>
  )
}

function FieldTextarea({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <FieldLabel>{label}</FieldLabel>
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        rows={3}
        style={{
          backgroundColor: "#0A0A0A",
          border: `1px solid ${focused ? "#0066FF" : "#252525"}`,
          borderRadius: 10, padding: "10px 14px",
          fontSize: 14, color: "#ffffff", outline: "none",
          width: "100%", boxSizing: "border-box", resize: "vertical",
          transition: "border-color 0.15s", fontFamily: "inherit", minHeight: 72,
        }}
      />
    </div>
  )
}

function FormErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
      borderRadius: 10, padding: "10px 14px", marginBottom: 16,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <AlertCircle size={14} color="#EF4444" style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: "#EF4444" }}>{message}</span>
    </div>
  )
}

function CancelBtn({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        height: 40, padding: "0 18px", borderRadius: 10,
        fontSize: 13, fontWeight: 600, cursor: "pointer",
        background: "transparent", border: "1px solid #252525",
        color: hov ? "#ffffff" : "#A1A1AA",
        transition: "color 0.15s", fontFamily: "inherit",
      }}>Cancelar</button>
  )
}

function SubmitBtn({ loading, label, loadingLabel, onClick, gradient }: {
  loading: boolean; label: string; loadingLabel: string
  onClick: () => void; gradient: string
}) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      height: 40, padding: "0 18px", borderRadius: 10,
      fontSize: 13, fontWeight: 600,
      cursor: loading ? "not-allowed" : "pointer",
      background: gradient, border: "none", color: "white",
      display: "flex", alignItems: "center", gap: 8,
      opacity: loading ? 0.7 : 1, transition: "opacity 0.15s", fontFamily: "inherit",
    }}>
      {loading && <Spinner size={13} />}
      {loading ? loadingLabel : label}
    </button>
  )
}

// ── Service Rule Card (per-service discount config) ───────────────────────────

function ServiceRuleCard({
  service,
  rule,
  onToggle,
  onUpdate,
}: {
  service: ServiceItem
  rule: ServiceRule | null
  onToggle: (enabled: boolean) => void
  onUpdate: (updates: Partial<ServiceRule>) => void
}) {
  const enabled = rule !== null

  return (
    <div style={{
      backgroundColor: enabled ? "rgba(0,102,255,0.04)" : "#0A0A0A",
      border: `1px solid ${enabled ? "rgba(0,102,255,0.15)" : "#1F1F1F"}`,
      borderRadius: 12, padding: 14,
      transition: "all 0.2s",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => onToggle(!enabled)}
            style={{
              width: 20, height: 20, borderRadius: 6,
              border: `2px solid ${enabled ? "#0066FF" : "#3F3F46"}`,
              backgroundColor: enabled ? "#0066FF" : "transparent",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s", flexShrink: 0, padding: 0,
            }}
          >
            {enabled && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{service.name}</span>
            <span style={{ fontSize: 12, color: "#71717A", marginLeft: 8 }}>
              {formatCurrency(service.price)}
            </span>
          </div>
        </div>
        {enabled && rule && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "3px 8px",
            borderRadius: 6, color: "#10B981",
            backgroundColor: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.2)",
          }}>
            {rule.discountType === "FREE" ? "Grátis" :
             rule.discountType === "PERCENTAGE" ? `${rule.discountValue ?? 0}% off` :
             `${formatCurrency(rule.discountValue ?? 0)} off`}
          </span>
        )}
      </div>

      {/* Config row (visible when enabled) */}
      {enabled && rule && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10,
          marginTop: 12, paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}>
          {/* Discount Type */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 500, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Tipo
            </span>
            <select
              value={rule.discountType}
              onChange={(e) => onUpdate({ discountType: e.target.value as DiscountType })}
              style={{
                height: 34, backgroundColor: "#111111", border: "1px solid #252525",
                borderRadius: 8, padding: "0 8px", fontSize: 12, color: "#fff",
                outline: "none", cursor: "pointer", fontFamily: "inherit",
                appearance: "none", WebkitAppearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
              }}
            >
              <option value="FREE">100% Grátis</option>
              <option value="PERCENTAGE">Percentual (%)</option>
              <option value="FIXED">Valor fixo (R$)</option>
            </select>
          </div>

          {/* Discount Value */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 500, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {rule.discountType === "FREE" ? "Valor" : rule.discountType === "PERCENTAGE" ? "%" : "R$"}
            </span>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                min={0}
                max={rule.discountType === "PERCENTAGE" ? 100 : undefined}
                disabled={rule.discountType === "FREE"}
                value={rule.discountType === "FREE" ? "" : (rule.discountType === "FIXED" ? ((rule.discountValue ?? 0) / 100).toFixed(2) : (rule.discountValue ?? 0))}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  if (isNaN(val)) return
                  onUpdate({
                    discountValue: rule.discountType === "FIXED" ? Math.round(val * 100) : Math.round(val),
                  })
                }}
                placeholder={rule.discountType === "FREE" ? "—" : "0"}
                style={{
                  height: 34, width: "100%", backgroundColor: rule.discountType === "FREE" ? "#0A0A0A" : "#111111",
                  border: "1px solid #252525", borderRadius: 8,
                  padding: "0 8px", fontSize: 12, color: rule.discountType === "FREE" ? "#3F3F46" : "#fff",
                  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                }}
              />
            </div>
          </div>

          {/* Max Usages */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 500, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Limite
            </span>
            <input
              type="number"
              min={0}
              value={rule.maxUsages ?? ""}
              onChange={(e) => {
                const val = e.target.value === "" ? null : parseInt(e.target.value)
                onUpdate({ maxUsages: val && val > 0 ? val : null })
              }}
              placeholder="∞"
              style={{
                height: 34, width: "100%", backgroundColor: "#111111",
                border: "1px solid #252525", borderRadius: 8,
                padding: "0 8px", fontSize: 12, color: "#fff",
                outline: "none", boxSizing: "border-box", fontFamily: "inherit",
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlanosPage() {
  const { planStatus } = useUser()

  if (planStatus && planStatus.plan !== "PRO") {
    return (
      <ProFeatureGate
        featureName="Planos de assinatura"
        description="Crie planos recorrentes para seus clientes, com desconto automático nos serviços e controle de assinantes."
      />
    )
  }

  return <PlanosContent />
}

function PlanosContent() {
  const [plans,          setPlans]          = useState<CustomerPlan[]>([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [showModal,      setShowModal]      = useState<"create" | "edit" | null>(null)
  const [selectedPlan,   setSelectedPlan]   = useState<CustomerPlan | null>(null)
  const [actionLoading,  setActionLoading]  = useState<string | null>(null)
  const [formError,      setFormError]      = useState<string | null>(null)
  const [hoveredId,      setHoveredId]      = useState<string | null>(null)

  const [formName,        setFormName]        = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formPrice,       setFormPrice]       = useState("")
  const [formInterval,    setFormInterval]    = useState("MONTHLY")
  const [formDiscount,    setFormDiscount]    = useState("0")
  const [formPaymentLink, setFormPaymentLink] = useState("")
  const [services,        setServices]        = useState<ServiceItem[]>([])
  const [serviceRules,    setServiceRules]    = useState<Map<string, ServiceRule>>(new Map())

  const fetchPlans = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<{ plans: CustomerPlan[] }>("/customer-plans")
      setPlans(res.plans ?? [])
      setError(null)
    } catch {
      setError("Erro ao carregar planos.")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchServices = useCallback(async () => {
    try {
      const res = await apiGet<{ services: ServiceItem[] }>("/services")
      setServices(res.services ?? [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchPlans() }, [fetchPlans])
  useEffect(() => { fetchServices() }, [fetchServices])

  function closeModal() {
    setShowModal(null); setSelectedPlan(null)
    setFormName(""); setFormDescription(""); setFormPrice("")
    setFormInterval("MONTHLY"); setFormDiscount("0"); setFormPaymentLink("")
    setFormError(null); setServiceRules(new Map())
  }

  function openEditModal(plan: CustomerPlan) {
    setSelectedPlan(plan)
    setFormName(plan.name)
    setFormDescription(plan.description ?? "")
    setFormPrice((plan.price / 100).toFixed(2))
    setFormInterval(plan.interval)
    setFormDiscount(plan.discountPercent.toString())
    setFormPaymentLink(plan.cactopayPaymentLink ?? "")

    // Reconstroi regras por serviço
    const rules = new Map<string, ServiceRule>()
    plan.planServices?.forEach((ps) => {
      rules.set(ps.serviceId, {
        serviceId:     ps.serviceId,
        discountType:  ps.discountType,
        discountValue: ps.discountValue,
        maxUsages:     ps.maxUsages,
      })
    })
    setServiceRules(rules)
    setShowModal("edit")
  }

  function toggleService(serviceId: string, enabled: boolean) {
    setServiceRules((prev) => {
      const next = new Map(prev)
      if (enabled) {
        next.set(serviceId, {
          serviceId,
          discountType: "FREE",
          discountValue: null,
          maxUsages: null,
        })
      } else {
        next.delete(serviceId)
      }
      return next
    })
  }

  function updateServiceRule(serviceId: string, updates: Partial<ServiceRule>) {
    setServiceRules((prev) => {
      const next = new Map(prev)
      const existing = next.get(serviceId)
      if (existing) {
        next.set(serviceId, { ...existing, ...updates })
      }
      return next
    })
  }

  function validateForm(): boolean {
    if (!formName.trim()) { setFormError("Nome obrigatório."); return false }
    const price = parseFloat(formPrice)
    if (isNaN(price) || price <= 0) { setFormError("Preço inválido."); return false }
    const discount = parseInt(formDiscount)
    if (isNaN(discount) || discount < 0 || discount > 100) {
      setFormError("Desconto deve ser entre 0 e 100."); return false
    }
    // Validar regras de serviço
    for (const [, rule] of serviceRules) {
      if (rule.discountType === "PERCENTAGE" && (rule.discountValue === null || rule.discountValue < 0 || rule.discountValue > 100)) {
        setFormError("Desconto percentual deve ser entre 0 e 100."); return false
      }
      if (rule.discountType === "FIXED" && (rule.discountValue === null || rule.discountValue < 0)) {
        setFormError("Valor fixo de desconto inválido."); return false
      }
    }
    return true
  }

  function buildPayload() {
    return {
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      price: Math.round(parseFloat(formPrice) * 100),
      interval: formInterval,
      discountPercent: parseInt(formDiscount),
      cactopayPaymentLink: formPaymentLink.trim() || undefined,
      serviceRules: Array.from(serviceRules.values()),
    }
  }

  async function handleCreate() {
    if (!validateForm()) return
    setActionLoading("create")
    try {
      await apiPost("/customer-plans", buildPayload())
      closeModal(); await fetchPlans()
    } catch {
      setFormError("Erro ao criar plano.")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleEdit() {
    if (!selectedPlan || !validateForm()) return
    setActionLoading("edit")
    try {
      await apiPut(`/customer-plans/${selectedPlan.id}`, buildPayload())
      closeModal(); await fetchPlans()
    } catch {
      setFormError("Erro ao atualizar plano.")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(plan: CustomerPlan) {
    if (plan.activeSubscribersCount > 0) {
      alert(`Este plano tem ${plan.activeSubscribersCount} assinante(s) ativo(s). Cancele as assinaturas primeiro.`)
      return
    }
    if (!window.confirm(`Desativar "${plan.name}"?`)) return
    setActionLoading(plan.id)
    try {
      await apiDelete(`/customer-plans/${plan.id}`)
      await fetchPlans()
    } catch {
      setError("Erro ao remover plano.")
    } finally {
      setActionLoading(null)
    }
  }

  const activePlans = plans.filter((p) => p.isActive)

  return (
    <>
      <style>{`
        @keyframes spinPl { to { transform: rotate(360deg); } }
        @keyframes skeletonPl { 0%,100%{opacity:.4} 50%{opacity:.8} }
        @keyframes fadePl { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUpPl {
          from{opacity:0;transform:translate(-50%,-44%)}
          to{opacity:1;transform:translate(-50%,-50%)}
        }
        textarea::placeholder, input::placeholder { color: #3F3F46; }
        select option { background: #111111; }
      `}</style>

      <div style={{
        maxWidth: 1280, margin: "0 auto",
        animation: "fadePl 0.35s ease both",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}>

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 32,
        }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>
              Planos de Assinatura
            </h1>
            <p style={{ fontSize: 14, color: "#71717A", marginTop: 6 }}>
              {loading ? "Carregando..." : `${activePlans.length} plano${activePlans.length !== 1 ? "s" : ""} ativo${activePlans.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <NewBtn onClick={() => setShowModal("create")} label="Novo plano" />
        </div>

        {/* ── INFO BANNER ─────────────────────────────────────────────── */}
        <div style={{
          backgroundColor: "rgba(0,102,255,0.04)", border: "1px solid rgba(0,102,255,0.12)",
          borderRadius: 14, padding: "14px 18px", marginBottom: 24,
          display: "flex", gap: 12, alignItems: "flex-start",
        }}>
          <Crown size={16} color="#0066FF" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0 }}>
              Planos de fidelidade com regras por serviço
            </p>
            <p style={{ fontSize: 12, color: "#71717A", marginTop: 4, lineHeight: 1.6 }}>
              Configure desconto individual por serviço: grátis, percentual ou valor fixo.
              Defina limite de usos por ciclo (ex: 5 lavagens/mês).
            </p>
          </div>
        </div>

        {/* ── ERROR ───────────────────────────────────────────────────── */}
        {error && (
          <div style={{
            backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <AlertCircle size={16} color="#EF4444" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#EF4444", flex: 1 }}>{error}</span>
            <button onClick={fetchPlans} style={{ fontSize: 12, color: "#EF4444", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
              Tentar novamente
            </button>
          </div>
        )}

        {/* ── LOADING ─────────────────────────────────────────────────── */}
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                height: 220, backgroundColor: "#111111", border: "1px solid #1F1F1F",
                borderRadius: 20, animation: `skeletonPl 1.5s ease ${i * 0.1}s infinite`,
              }} />
            ))}
          </div>
        )}

        {/* ── EMPTY ───────────────────────────────────────────────────── */}
        {!loading && !error && plans.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <Crown size={40} color="#1F1F1F" style={{ margin: "0 auto" }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginTop: 16 }}>
              Nenhum plano criado ainda
            </p>
            <p style={{ fontSize: 13, color: "#71717A", marginTop: 6 }}>
              Crie planos de fidelidade para aumentar a recorrência
            </p>
            <button onClick={() => setShowModal("create")} style={{
              marginTop: 16, padding: "10px 20px",
              background: "linear-gradient(135deg,#0066FF,#7C3AED)",
              border: "none", borderRadius: 12, color: "white",
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              Criar primeiro plano
            </button>
          </div>
        )}

        {/* ── PLANS GRID ──────────────────────────────────────────────── */}
        {!loading && !error && plans.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
            {plans.map((plan) => {
              const hov = hoveredId === plan.id
              const deleting = actionLoading === plan.id
              const svcCount = plan.planServices?.length ?? 0
              return (
                <div key={plan.id}
                  onMouseEnter={() => setHoveredId(plan.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    position: "relative", overflow: "hidden",
                    backgroundColor: "#111111",
                    border: `1px solid ${hov ? "#252525" : plan.isActive ? "#1F1F1F" : "#161616"}`,
                    opacity: plan.isActive ? 1 : 0.55,
                    borderRadius: 20, padding: 24,
                    transition: "all 0.2s ease",
                    transform: hov ? "translateY(-2px)" : "translateY(0)",
                    boxShadow: hov ? "0 12px 32px rgba(0,0,0,0.3)" : "none",
                  }}
                >
                  {/* Glow */}
                  <div style={{
                    position: "absolute", top: -40, right: -40,
                    width: 120, height: 120, borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(124,58,237,0.08), transparent)",
                    pointerEvents: "none",
                  }} />

                  {/* Top */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 9,
                          background: "linear-gradient(135deg,#7C3AED,#0066FF)",
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          <Crown size={15} color="#fff" />
                        </div>
                        <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>{plan.name}</p>
                      </div>
                      {plan.description && (
                        <p style={{ fontSize: 12, color: "#71717A", marginTop: 6, lineHeight: 1.5 }}>
                          {plan.description}
                        </p>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0, marginLeft: 12 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        color: plan.isActive ? "#10B981" : "#EF4444",
                        backgroundColor: plan.isActive ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.08)",
                        border: `1px solid ${plan.isActive ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.15)"}`,
                        borderRadius: 6, padding: "3px 8px",
                      }}>
                        {plan.isActive ? "Ativo" : "Inativo"}
                      </span>
                      <span style={{
                        fontSize: 10, backgroundColor: "#161616", border: "1px solid #252525",
                        color: "#A1A1AA", borderRadius: 6, padding: "3px 8px",
                      }}>
                        {plan.interval === "MONTHLY" ? "Mensal" : "Anual"}
                      </span>
                    </div>
                  </div>

                  {/* Preço */}
                  <div style={{ marginTop: 20 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
                        {formatCurrency(plan.price)}
                      </span>
                      <span style={{ fontSize: 13, color: "#71717A" }}>
                        /{plan.interval === "MONTHLY" ? "mês" : "ano"}
                      </span>
                    </div>

                    {/* Desconto global */}
                    {plan.discountPercent > 0 && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
                        <Percent size={12} color="#10B981" />
                        <span style={{ fontSize: 12, color: "#10B981", fontWeight: 500 }}>
                          {plan.discountPercent}% de desconto geral
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Serviços incluídos */}
                  {svcCount > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                        <Package size={12} color="#A1A1AA" />
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#A1A1AA", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Serviços ({svcCount})
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {plan.planServices!.map((ps) => (
                          <div key={ps.id} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            backgroundColor: "#0A0A0A", borderRadius: 8, padding: "6px 10px",
                          }}>
                            <span style={{ fontSize: 12, color: "#D4D4D8" }}>{ps.service.name}</span>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <span style={{
                                fontSize: 10, fontWeight: 600, color: "#10B981",
                                backgroundColor: "rgba(16,185,129,0.08)",
                                borderRadius: 4, padding: "2px 6px",
                              }}>
                                {discountLabel(ps)}
                              </span>
                              {ps.maxUsages && (
                                <span style={{
                                  fontSize: 10, color: "#A1A1AA",
                                  backgroundColor: "#161616",
                                  borderRadius: 4, padding: "2px 6px",
                                }}>
                                  {ps.maxUsages}x
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Separator */}
                  <div style={{ height: 1, backgroundColor: "#1A1A1A", margin: "16px 0 14px" }} />

                  {/* Footer */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <Users size={13} color="#A1A1AA" />
                      <span style={{ fontSize: 12, color: "#71717A" }}>
                        {plan.activeSubscribersCount} assinante{plan.activeSubscribersCount !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      {plan.cactopayPaymentLink && (
                        <SmallIconBtn title="Abrir link de pagamento"
                          bg="rgba(0,102,255,0.08)" border="rgba(0,102,255,0.15)" color="#0066FF"
                          hoverBg="rgba(0,102,255,0.16)"
                          onClick={() => window.open(plan.cactopayPaymentLink!, "_blank")}>
                          <Link2 size={14} />
                        </SmallIconBtn>
                      )}
                      <SmallIconBtn title="Editar plano"
                        bg="#161616" border="#252525" color="#A1A1AA" hoverBg="#1F1F1F"
                        onClick={() => openEditModal(plan)}>
                        <Edit3 size={13} />
                      </SmallIconBtn>
                      <TrashBtn
                        loading={deleting}
                        disabled={plan.activeSubscribersCount > 0}
                        onClick={() => handleDelete(plan)}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── MODAL ──────────────────────────────────────────────────────── */}
      {showModal !== null && (
        <>
          <div onClick={closeModal} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 100,
          }} />
          <div onClick={(e) => e.stopPropagation()} style={{
            position: "fixed", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            backgroundColor: "#111111", border: "1px solid #1F1F1F",
            borderRadius: 20, padding: 28, width: "100%", maxWidth: 560, zIndex: 101,
            boxShadow: "0 32px 64px rgba(0,0,0,0.7)",
            animation: "slideUpPl 0.3s cubic-bezier(0.16,1,0.3,1)",
            boxSizing: "border-box",
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            maxHeight: "90vh", overflowY: "auto",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
                {showModal === "create" ? "Novo plano" : "Editar plano"}
              </h2>
              <button onClick={closeModal} style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid #252525",
                borderRadius: 8, width: 32, height: 32, display: "flex",
                alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#71717A", flexShrink: 0,
              }}><X size={16} /></button>
            </div>

            {formError && <FormErrorBanner message={formError} />}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <FieldInput label="Nome do plano" value={formName}
                onChange={(v) => { setFormName(v); setFormError(null) }}
                placeholder="Ex: Plano Básico, Plano Premium..." required />

              <FieldTextarea label="Descrição" value={formDescription}
                onChange={setFormDescription}
                placeholder="Descreva os benefícios..." />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FieldInput label="Preço (R$)" value={formPrice} type="number"
                  onChange={(v) => { setFormPrice(v); setFormError(null) }}
                  placeholder="89.00" required />

                <div style={{ display: "flex", flexDirection: "column" }}>
                  <FieldLabel>Cobrança</FieldLabel>
                  <SelectField value={formInterval} onChange={setFormInterval}>
                    <option value="MONTHLY">Mensal</option>
                    <option value="YEARLY">Anual</option>
                  </SelectField>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <FieldLabel>Desconto global (%)</FieldLabel>
                  <div style={{ position: "relative" }}>
                    <input type="number" min={0} max={100}
                      value={formDiscount}
                      onChange={(e) => { setFormDiscount(e.target.value); setFormError(null) }}
                      placeholder="0"
                      style={{
                        height: 42, width: "100%", backgroundColor: "#0A0A0A",
                        border: "1px solid #252525", borderRadius: 10,
                        padding: "0 32px 0 14px", fontSize: 14, color: "#fff",
                        outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                      }}
                    />
                    <span style={{
                      position: "absolute", right: 12, top: "50%",
                      transform: "translateY(-50%)", color: "#52525B", fontSize: 13,
                    }}>%</span>
                  </div>
                  <p style={{ fontSize: 10, color: "#52525B", marginTop: 4 }}>
                    Aplicado em serviços sem regra própria
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  <FieldLabel>Link CactoPay</FieldLabel>
                  <input type="url" value={formPaymentLink}
                    onChange={(e) => setFormPaymentLink(e.target.value)}
                    placeholder="https://pay.cactopay.com/..."
                    style={{
                      height: 42, backgroundColor: "#0A0A0A", border: "1px solid #252525",
                      borderRadius: 10, padding: "0 14px", fontSize: 14, color: "#fff",
                      outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>

              {/* ── Serviços com regras individuais ──────────────────────── */}
              <div style={{ marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Package size={15} color="#0066FF" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                    Serviços incluídos no plano
                  </span>
                  <span style={{ fontSize: 11, color: "#71717A" }}>
                    ({serviceRules.size} de {services.length})
                  </span>
                </div>

                <p style={{ fontSize: 11, color: "#52525B", marginBottom: 10, lineHeight: 1.5 }}>
                  Selecione os serviços e configure o tipo de desconto e limite de usos por ciclo.
                  Serviços sem regra usam o desconto global (%).
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
                  {services.length === 0 ? (
                    <div style={{ fontSize: 13, color: "#71717A", padding: 12 }}>Carregando serviços...</div>
                  ) : (
                    services.map((s) => (
                      <ServiceRuleCard
                        key={s.id}
                        service={s}
                        rule={serviceRules.get(s.id) ?? null}
                        onToggle={(enabled) => toggleService(s.id, enabled)}
                        onUpdate={(updates) => updateServiceRule(s.id, updates)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
              <CancelBtn onClick={closeModal} />
              <SubmitBtn
                loading={actionLoading === "create" || actionLoading === "edit"}
                label={showModal === "create" ? "Criar plano" : "Salvar alterações"}
                loadingLabel={showModal === "create" ? "Criando..." : "Salvando..."}
                onClick={showModal === "create" ? handleCreate : handleEdit}
                gradient="linear-gradient(135deg,#0066FF,#7C3AED)"
              />
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ── Atomic helpers ────────────────────────────────────────────────────────────

function NewBtn({ onClick, label }: { onClick: () => void; label: string }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "linear-gradient(135deg,#0066FF,#7C3AED)",
        border: "none", borderRadius: 12, padding: "10px 18px",
        color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer",
        boxShadow: hov ? "0 8px 30px rgba(0,102,255,0.5)" : "0 4px 20px rgba(0,102,255,0.3)",
        transform: hov ? "scale(1.02)" : "scale(1)",
        transition: "all 0.2s", fontFamily: "inherit",
      }}>
      <Plus size={15} />{label}
    </button>
  )
}

function SelectField({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{
      height: 42, backgroundColor: "#0A0A0A", border: "1px solid #252525",
      borderRadius: 10, padding: "0 14px", fontSize: 14, color: "#fff",
      outline: "none", cursor: "pointer", fontFamily: "inherit",
      appearance: "none", WebkitAppearance: "none",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
      backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
    }}>
      {children}
    </select>
  )
}

function SmallIconBtn({ children, title, bg, border, color, hoverBg, onClick }: {
  children: React.ReactNode; title: string
  bg: string; border: string; color: string; hoverBg: string
  onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button title={title} onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 30, height: 30, borderRadius: 8,
        backgroundColor: hov ? hoverBg : bg, border: `1px solid ${border}`, color,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "background-color 0.15s", flexShrink: 0,
      }}>
      {children}
    </button>
  )
}

function TrashBtn({ loading, disabled, onClick }: {
  loading: boolean; disabled: boolean; onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button title="Remover plano" onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 30, height: 30, borderRadius: 8,
        backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)",
        color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.3 : hov ? 1 : 0.7, transition: "opacity 0.15s", flexShrink: 0,
      }}>
      {loading
        ? <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(239,68,68,0.3)", borderTopColor: "#EF4444", animation: "spinPl 0.7s linear infinite", display: "inline-block" }} />
        : <Trash2 size={13} />
      }
    </button>
  )
}
