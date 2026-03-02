"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Search, Crown, Plus, X,
  CheckCircle2, XCircle,
  AlertCircle,
} from "lucide-react"
import { apiGet, apiPost, apiPut } from "@/lib/api"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Subscription {
  id: string
  status: "PENDING" | "ACTIVE" | "CANCELLED" | "EXPIRED"
  startedAt: string | null
  createdAt: string
  customer: { id: string; name: string; phone: string; email: string | null }
  customerPlan: { id: string; name: string; price: number; discountPercent: number }
}

interface PlanOption  { id: string; name: string; price: number }
interface CustomerOption { id: string; name: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR")
}

function getStatusConfig(status: string) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    PENDING:   { label: "Pendente",   color: "#F59E0B", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)"  },
    ACTIVE:    { label: "Ativo",      color: "#10B981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.2)"  },
    CANCELLED: { label: "Cancelado",  color: "#EF4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.2)"   },
    EXPIRED:   { label: "Expirado",   color: "#A1A1AA", bg: "rgba(161,161,170,0.08)", border: "rgba(161,161,170,0.2)" },
  }
  return map[status] ?? map["EXPIRED"]
}

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase()
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner({ size = 14, color = "white" }: { size?: number; color?: string }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid rgba(255,255,255,0.2)`, borderTopColor: color,
      animation: "spinAs 0.7s linear infinite",
      display: "inline-block", flexShrink: 0,
    }} />
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

function SelectField({ label, value, onChange, children, required }: {
  label: string; value: string; onChange: (v: string) => void
  children: React.ReactNode; required?: boolean
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: "#A1A1AA", marginBottom: 6 }}>
        {label}{required && <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{
        height: 42, backgroundColor: "#0A0A0A", border: "1px solid #252525",
        borderRadius: 10, padding: "0 14px", fontSize: 14, color: value ? "#fff" : "#3F3F46",
        outline: "none", cursor: "pointer", fontFamily: "inherit",
        appearance: "none", WebkitAppearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
      }}>
        {children}
      </select>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssinantesPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [plans,         setPlans]         = useState<PlanOption[]>([])
  const [customers,     setCustomers]     = useState<CustomerOption[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [filterStatus,  setFilterStatus]  = useState("")
  const [searchQuery,   setSearchQuery]   = useState("")
  const [showModal,     setShowModal]     = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [formError,     setFormError]     = useState<string | null>(null)
  const [formCustomerId, setFormCustomerId] = useState("")
  const [formPlanId,     setFormPlanId]     = useState("")
  const [hoveredId,      setHoveredId]      = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = filterStatus ? `?status=${filterStatus}` : ""
      const [subsRes, plansRes, customersRes] = await Promise.all([
        apiGet<{ subscriptions: Subscription[] }>(`/customer-plans/subscriptions${params}`),
        apiGet<{ plans: PlanOption[] }>("/customer-plans"),
        apiGet<{ customers: CustomerOption[] }>("/customers"),
      ])
      setSubscriptions(subsRes.subscriptions ?? [])
      setPlans(plansRes.plans ?? [])
      setCustomers(customersRes.customers ?? [])
      setError(null)
    } catch {
      setError("Erro ao carregar assinantes.")
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleActivate(id: string) {
    setActionLoading(id)
    try {
      await apiPut(`/customer-plans/subscriptions/${id}/activate`, {})
      await fetchData()
    } catch {
      setError("Erro ao ativar assinatura.")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCancel(id: string) {
    if (!window.confirm("Cancelar esta assinatura?")) return
    setActionLoading(id)
    try {
      await apiPut(`/customer-plans/subscriptions/${id}/cancel`, {})
      await fetchData()
    } catch {
      setError("Erro ao cancelar assinatura.")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCreateSubscription() {
    if (!formCustomerId || !formPlanId) {
      setFormError("Selecione o cliente e o plano."); return
    }
    setActionLoading("create")
    try {
      await apiPost("/customer-plans/subscriptions", {
        customerId: formCustomerId,
        customerPlanId: formPlanId,
      })
      setShowModal(false); setFormCustomerId(""); setFormPlanId(""); setFormError(null)
      await fetchData()
    } catch {
      setFormError("Erro ao criar assinatura.")
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = subscriptions.filter((s) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      s.customer.name.toLowerCase().includes(q) ||
      s.customer.phone.includes(q) ||
      s.customerPlan.name.toLowerCase().includes(q)
    )
  })

  const countActive    = subscriptions.filter((s) => s.status === "ACTIVE").length
  const countPending   = subscriptions.filter((s) => s.status === "PENDING").length
  const countCancelled = subscriptions.filter((s) => s.status === "CANCELLED").length

  const selectedCustomerObj = customers.find((c) => c.id === formCustomerId)
  const selectedPlanObj     = plans.find((p) => p.id === formPlanId)

  const statusFilters = [
    { value: "",          label: "Todos"     },
    { value: "ACTIVE",    label: "Ativo"     },
    { value: "PENDING",   label: "Pendente"  },
    { value: "CANCELLED", label: "Cancelado" },
    { value: "EXPIRED",   label: "Expirado"  },
  ]

  return (
    <>
      <style>{`
        @keyframes spinAs { to { transform: rotate(360deg); } }
        @keyframes skeletonAs { 0%,100%{opacity:.4} 50%{opacity:.8} }
        @keyframes fadeAs { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUpAs {
          from{opacity:0;transform:translate(-50%,-44%)}
          to{opacity:1;transform:translate(-50%,-50%)}
        }
        select option { background: #111111; }
      `}</style>

      <div style={{
        maxWidth: 1280, margin: "0 auto",
        animation: "fadeAs 0.35s ease both",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}>

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 32,
        }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>
              Assinantes
            </h1>
            <p style={{ fontSize: 14, color: "#71717A", marginTop: 6 }}>
              {loading ? "Carregando..." : `${countActive} assinante${countActive !== 1 ? "s" : ""} ativo${countActive !== 1 ? "s" : ""}`}
            </p>
          </div>
          <NewSubBtn onClick={() => setShowModal(true)} />
        </div>

        {/* ── FILTERS ─────────────────────────────────────────────────── */}
        <div style={{
          backgroundColor: "#111111", border: "1px solid #1F1F1F",
          borderRadius: 16, padding: "14px 18px", marginBottom: 12,
          display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
        }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <Search size={14} color="#52525B" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente ou plano..."
              style={{
                width: "100%", height: 38, backgroundColor: "#0A0A0A",
                border: "1px solid #1F1F1F", borderRadius: 10,
                paddingLeft: 36, paddingRight: 14, fontSize: 13, color: "#fff",
                outline: "none", boxSizing: "border-box", fontFamily: "inherit",
              }}
              onFocus={(e)  => { e.target.style.borderColor = "rgba(0,102,255,0.4)" }}
              onBlur={(e)   => { e.target.style.borderColor = "#1F1F1F" }}
            />
          </div>

          {/* Status filters */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {statusFilters.map((f) => {
              const active = filterStatus === f.value
              const cfg = f.value ? getStatusConfig(f.value) : null
              return (
                <button key={f.value} onClick={() => setFilterStatus(f.value)} style={{
                  fontSize: 12, fontWeight: 500,
                  padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                  border: active
                    ? `1px solid ${cfg?.border ?? "rgba(0,102,255,0.3)"}`
                    : "1px solid #1F1F1F",
                  backgroundColor: active
                    ? (cfg?.bg ?? "rgba(0,102,255,0.08)")
                    : "transparent",
                  color: active ? (cfg?.color ?? "#0066FF") : "#71717A",
                  transition: "all 0.15s", fontFamily: "inherit",
                }}>
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── STATS ───────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
          <StatCard label="Total" value={subscriptions.length} color="#A1A1AA" bg="#111111" border="#1F1F1F" />
          <StatCard label="Ativos"     value={countActive}    color="#10B981" bg="rgba(16,185,129,0.06)"  border="rgba(16,185,129,0.2)" />
          <StatCard label="Pendentes"  value={countPending}   color="#F59E0B" bg="rgba(245,158,11,0.06)"  border="rgba(245,158,11,0.2)" />
          <StatCard label="Cancelados" value={countCancelled} color="#EF4444" bg="rgba(239,68,68,0.06)"   border="rgba(239,68,68,0.2)" />
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
            <button onClick={fetchData} style={{ fontSize: 12, color: "#EF4444", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
              Tentar novamente
            </button>
          </div>
        )}

        {/* ── LOADING ─────────────────────────────────────────────────── */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1,2,3,4,5].map((i) => (
              <div key={i} style={{
                height: 72, backgroundColor: "#111111", border: "1px solid #1F1F1F",
                borderRadius: 14, animation: `skeletonAs 1.5s ease ${i*0.07}s infinite`,
              }} />
            ))}
          </div>
        )}

        {/* ── EMPTY ───────────────────────────────────────────────────── */}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <Crown size={40} color="#1F1F1F" style={{ margin: "0 auto" }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginTop: 16 }}>
              {searchQuery ? "Nenhum assinante encontrado" : "Nenhuma assinatura cadastrada"}
            </p>
            {!searchQuery && (
              <button onClick={() => setShowModal(true)} style={{
                marginTop: 16, padding: "10px 20px",
                background: "linear-gradient(135deg,#7C3AED,#0066FF)",
                border: "none", borderRadius: 12, color: "white",
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>
                Criar primeira assinatura
              </button>
            )}
          </div>
        )}

        {/* ── SUBSCRIPTIONS LIST ──────────────────────────────────────── */}
        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map((sub) => {
              const hov  = hoveredId === sub.id
              const busy = actionLoading === sub.id
              const cfg  = getStatusConfig(sub.status)
              return (
                <div key={sub.id}
                  onMouseEnter={() => setHoveredId(sub.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    backgroundColor: "#111111",
                    border: `1px solid ${hov ? "#252525" : "#1F1F1F"}`,
                    borderRadius: 14, padding: "14px 20px",
                    display: "flex", alignItems: "center", gap: 16,
                    transition: "all 0.18s ease",
                    transform: hov ? "translateY(-1px)" : "translateY(0)",
                    boxShadow: hov ? "0 8px 24px rgba(0,0,0,0.25)" : "none",
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: "linear-gradient(135deg,rgba(124,58,237,0.15),rgba(0,102,255,0.15))",
                    border: "1px solid rgba(124,58,237,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700, color: "#7C3AED",
                  }}>
                    {getInitials(sub.customer.name)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                      {sub.customer.name}
                    </span>

                    <div style={{ display: "flex", gap: 10, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Crown size={11} color="#7C3AED" />
                        <span style={{ fontSize: 12, color: "#A1A1AA" }}>{sub.customerPlan.name}</span>
                      </span>
                      <span style={{ color: "#3F3F46", fontSize: 12 }}>•</span>
                      <span style={{ fontSize: 12, color: "#71717A" }}>
                        {formatCurrency(sub.customerPlan.price)}/mês
                      </span>
                      {sub.customerPlan.discountPercent > 0 && (
                        <span style={{ fontSize: 11, color: "#10B981", fontWeight: 500 }}>
                          {sub.customerPlan.discountPercent}% desc.
                        </span>
                      )}
                    </div>

                    <div style={{ marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: "#52525B" }}>
                        Desde {formatDate(sub.startedAt ?? sub.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: cfg.color, backgroundColor: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    borderRadius: 8, padding: "4px 10px", whiteSpace: "nowrap", flexShrink: 0,
                  }}>
                    {cfg.label}
                  </span>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {sub.status === "PENDING" && (
                      <>
                        <button onClick={() => handleActivate(sub.id)} disabled={busy} style={{
                          display: "flex", alignItems: "center", gap: 5,
                          height: 30, padding: "0 12px", borderRadius: 8,
                          backgroundColor: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)",
                          color: "#10B981", fontSize: 12, fontWeight: 600,
                          cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit",
                        }}>
                          {busy ? <Spinner size={12} color="#10B981" /> : <CheckCircle2 size={13} />}
                          Ativar
                        </button>
                        <button onClick={() => handleCancel(sub.id)} disabled={busy} style={{
                          width: 30, height: 30, borderRadius: 8,
                          backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
                          color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: busy ? "not-allowed" : "pointer",
                        }}>
                          <XCircle size={14} />
                        </button>
                      </>
                    )}

                    {sub.status === "ACTIVE" && (
                      <button onClick={() => handleCancel(sub.id)} disabled={busy} style={{
                        display: "flex", alignItems: "center", gap: 5,
                        height: 30, padding: "0 12px", borderRadius: 8,
                        backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)",
                        color: "#EF4444", fontSize: 12, fontWeight: 500,
                        cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit",
                      }}>
                        {busy ? <Spinner size={12} color="#EF4444" /> : null}
                        Cancelar
                      </button>
                    )}

                    {(sub.status === "CANCELLED" || sub.status === "EXPIRED") && (
                      <span style={{ fontSize: 11, color: "#3F3F46" }}>Encerrada</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── MODAL NOVA ASSINATURA ───────────────────────────────────────── */}
      {showModal && (
        <>
          <div onClick={() => { setShowModal(false); setFormError(null) }} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 100,
          }} />
          <div onClick={(e) => e.stopPropagation()} style={{
            position: "fixed", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            backgroundColor: "#111111", border: "1px solid #1F1F1F",
            borderRadius: 20, padding: 28, width: "100%", maxWidth: 420, zIndex: 101,
            boxShadow: "0 32px 64px rgba(0,0,0,0.7)",
            animation: "slideUpAs 0.3s cubic-bezier(0.16,1,0.3,1)",
            boxSizing: "border-box",
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
                Nova assinatura
              </h2>
              <button onClick={() => { setShowModal(false); setFormError(null) }} style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid #252525",
                borderRadius: 8, width: 32, height: 32, display: "flex",
                alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#71717A", flexShrink: 0,
              }}><X size={16} /></button>
            </div>

            {formError && <FormErrorBanner message={formError} />}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <SelectField label="Cliente" value={formCustomerId}
                onChange={(v) => { setFormCustomerId(v); setFormError(null) }} required>
                <option value="" disabled>Selecione um cliente</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </SelectField>

              <SelectField label="Plano" value={formPlanId}
                onChange={(v) => { setFormPlanId(v); setFormError(null) }} required>
                <option value="" disabled>Selecione um plano</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatCurrency(p.price)}/mês
                  </option>
                ))}
              </SelectField>

              {/* Preview */}
              {formCustomerId && formPlanId && selectedCustomerObj && selectedPlanObj && (
                <div style={{
                  backgroundColor: "rgba(124,58,237,0.04)",
                  border: "1px solid rgba(124,58,237,0.1)",
                  borderRadius: 10, padding: 12,
                }}>
                  <p style={{ fontSize: 13, color: "#fff", margin: 0, fontWeight: 500 }}>
                    {selectedCustomerObj.name}
                  </p>
                  <p style={{ fontSize: 12, color: "#A1A1AA", marginTop: 4 }}>
                    {selectedPlanObj.name} · {formatCurrency(selectedPlanObj.price)}/mês
                  </p>
                  <p style={{ fontSize: 11, color: "#71717A", marginTop: 6 }}>
                    A assinatura será criada com status PENDENTE
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
              <CancelBtn onClick={() => { setShowModal(false); setFormError(null) }} />
              <button onClick={handleCreateSubscription}
                disabled={actionLoading === "create"}
                style={{
                  height: 40, padding: "0 18px", borderRadius: 10,
                  fontSize: 13, fontWeight: 600,
                  cursor: actionLoading === "create" ? "not-allowed" : "pointer",
                  background: "linear-gradient(135deg,#7C3AED,#0066FF)",
                  border: "none", color: "white",
                  display: "flex", alignItems: "center", gap: 8,
                  opacity: actionLoading === "create" ? 0.7 : 1,
                  transition: "opacity 0.15s", fontFamily: "inherit",
                }}>
                {actionLoading === "create" && <Spinner size={13} />}
                {actionLoading === "create" ? "Criando..." : "Criar assinatura"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ── Atomic helpers ────────────────────────────────────────────────────────────

function NewSubBtn({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "linear-gradient(135deg,#7C3AED,#0066FF)",
        border: "none", borderRadius: 12, padding: "10px 18px",
        color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer",
        boxShadow: hov ? "0 8px 30px rgba(124,58,237,0.5)" : "0 4px 20px rgba(124,58,237,0.3)",
        transform: hov ? "scale(1.02)" : "scale(1)",
        transition: "all 0.2s", fontFamily: "inherit",
      }}>
      <Plus size={15} />Nova assinatura
    </button>
  )
}

function StatCard({ label, value, color, bg, border }: {
  label: string; value: number; color: string; bg: string; border: string
}) {
  return (
    <div style={{
      backgroundColor: bg, border: `1px solid ${border}`,
      borderRadius: 12, padding: "12px 16px",
    }}>
      <p style={{ fontSize: 22, fontWeight: 800, color, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 12, color: "#71717A", marginTop: 4 }}>{label}</p>
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