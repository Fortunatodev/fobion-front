"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, Edit3, Trash2, X, Crown,
  Users, CircleDollarSign, Percent,
  AlertCircle, Link2,
} from "lucide-react"
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api"

// ── Types ─────────────────────────────────────────────────────────────────────

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
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlanosPage() {
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

  useEffect(() => { fetchPlans() }, [fetchPlans])

  function closeModal() {
    setShowModal(null); setSelectedPlan(null)
    setFormName(""); setFormDescription(""); setFormPrice("")
    setFormInterval("MONTHLY"); setFormDiscount("0"); setFormPaymentLink("")
    setFormError(null)
  }

  function openEditModal(plan: CustomerPlan) {
    setSelectedPlan(plan)
    setFormName(plan.name)
    setFormDescription(plan.description ?? "")
    setFormPrice((plan.price / 100).toFixed(2))
    setFormInterval(plan.interval)
    setFormDiscount(plan.discountPercent.toString())
    setFormPaymentLink(plan.cactopayPaymentLink ?? "")
    setShowModal("edit")
  }

  function validateForm(): boolean {
    if (!formName.trim()) { setFormError("Nome obrigatório."); return false }
    const price = parseFloat(formPrice)
    if (isNaN(price) || price <= 0) { setFormError("Preço inválido."); return false }
    const discount = parseInt(formDiscount)
    if (isNaN(discount) || discount < 0 || discount > 100) {
      setFormError("Desconto deve ser entre 0 e 100."); return false
    }
    return true
  }

  async function handleCreate() {
    if (!validateForm()) return
    setActionLoading("create")
    try {
      await apiPost("/customer-plans", {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        price: Math.round(parseFloat(formPrice) * 100),
        interval: formInterval,
        discountPercent: parseInt(formDiscount),
        cactopayPaymentLink: formPaymentLink.trim() || undefined,
      })
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
      await apiPut(`/customer-plans/${selectedPlan.id}`, {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        price: Math.round(parseFloat(formPrice) * 100),
        interval: formInterval,
        discountPercent: parseInt(formDiscount),
        cactopayPaymentLink: formPaymentLink.trim() || undefined,
      })
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
              Planos de fidelidade
            </p>
            <p style={{ fontSize: 12, color: "#71717A", marginTop: 4, lineHeight: 1.6 }}>
              Crie planos mensais ou anuais com desconto para fidelizar seus clientes.
              O link de pagamento é gerado pelo CactoPay e vinculado aqui.
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                height: 180, backgroundColor: "#111111", border: "1px solid #1F1F1F",
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {plans.map((plan) => {
              const hov = hoveredId === plan.id
              const deleting = actionLoading === plan.id
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
                        <p style={{
                          fontSize: 12, color: "#71717A", marginTop: 6,
                          maxWidth: 200, lineHeight: 1.5,
                        }}>{plan.description}</p>
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
                    {plan.discountPercent > 0 && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
                        <Percent size={12} color="#10B981" />
                        <span style={{ fontSize: 12, color: "#10B981", fontWeight: 500 }}>
                          {plan.discountPercent}% de desconto nos serviços
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Separator */}
                  <div style={{ height: 1, backgroundColor: "#1A1A1A", margin: "16px 0 14px" }} />

                  {/* Footer */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <Users size={13} color="#A1A1AA" />
                      <span style={{ fontSize: 12, color: "#71717A" }}>
                        {plan.activeSubscribersCount} assinante{plan.activeSubscribersCount !== 1 ? "s" : ""} ativo{plan.activeSubscribersCount !== 1 ? "s" : ""}
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
            borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, zIndex: 101,
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
                  <FieldLabel>Desconto nos serviços (%)</FieldLabel>
                  <div style={{ position: "relative" }}>
                    <input type="number" min={0} max={100}
                      value={formDiscount}
                      onChange={(e) => { setFormDiscount(e.target.value); setFormError(null) }}
                      placeholder="10"
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
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  <FieldLabel>Desconto aplicado</FieldLabel>
                  <div style={{
                    height: 42, backgroundColor: "#0A0A0A", border: "1px solid #1F1F1F",
                    borderRadius: 10, display: "flex", alignItems: "center", padding: "0 14px",
                  }}>
                    <span style={{ fontSize: 13, color: "#71717A" }}>
                      {parseInt(formDiscount) > 0 ? `${formDiscount}% off em cada serviço` : "Sem desconto"}
                    </span>
                  </div>
                </div>
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
                <p style={{ fontSize: 11, color: "#52525B", marginTop: 4 }}>
                  O cliente acessa este link para assinar o plano
                </p>
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