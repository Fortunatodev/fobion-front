"use client"

import { useState, useEffect, useCallback, useRef } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

// ── Auth ──────────────────────────────────────────────────────────────────────

function getAdminToken(): string {
  if (typeof document === "undefined") return ""
  const match = document.cookie.match(/(?:^|;\s*)admin-token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : ""
}

// ── Types ─────────────────────────────────────────────────────────────────────

type PlanType = "FREE" | "BASIC" | "PRO"

interface BusinessItem {
  id: string
  name: string
  slug: string
  email: string
  phone: string
  plan: PlanType
  isTrial: boolean
  planExpiresAt: string | null
  isActive: boolean
  createdAt: string
  owner?: { name: string | null; email: string } | null
  _count: { customers: number; schedules: number; users: number }
}

interface CreateResult {
  message: string
  business: { id: string; name: string; slug: string; plan: string }
  access: { email: string; loginUrl: string; storeUrl: string }
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}/api/admin${path}`, {
    headers: { "x-admin-token": getAdminToken() },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Erro ${res.status}`)
  }
  return res.json()
}

async function adminPost<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API}/api/admin${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": getAdminToken() },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Erro ${res.status}`)
  }
  return res.json()
}

async function adminPatch<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API}/api/admin${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-token": getAdminToken() },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Erro ${res.status}`)
  }
  return res.json()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getPlanLabel(plan: PlanType): string {
  if (plan === "PRO") return "PRO"
  if (plan === "BASIC") return "Basic"
  return "Free"
}

function getPlanStatus(biz: BusinessItem): {
  label: string
  color: string
  bg: string
  border: string
} {
  const days = daysUntil(biz.planExpiresAt)
  const expired = days !== null && days < 0
  const warn = days !== null && days >= 0 && days <= 7

  if (!biz.isActive) return {
    label: "Inativa", color: "#EF4444",
    bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)",
  }
  if (expired) return {
    label: "Expirado", color: "#EF4444",
    bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)",
  }
  if (warn) return {
    label: `${days}d restantes`, color: "#F59E0B",
    bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)",
  }
  return {
    label: "Ativo", color: "#10B981",
    bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)",
  }
}

// ── Shared Styles ─────────────────────────────────────────────────────────────

const ANIMATIONS = `
  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

  .admin-row { transition: background 0.12s ease; }
  .admin-row:hover { background: rgba(255,255,255,0.02) !important; }
  .admin-btn { transition: all 0.15s ease; }
  .admin-btn:hover { filter: brightness(1.15); transform: translateY(-1px); }

  @media (max-width: 768px) {
    .admin-desktop-table { display: none !important; }
    .admin-mobile-cards  { display: flex !important; }
  }
  @media (min-width: 769px) {
    .admin-desktop-table { display: block !important; }
    .admin-mobile-cards  { display: none !important; }
  }
`

// ── Micro Components ──────────────────────────────────────────────────────────

function Spinner({ size = 16, color = "white" }: { size?: number; color?: string }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid rgba(255,255,255,0.1)`,
      borderTopColor: color, borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
      display: "inline-block",
    }} />
  )
}

function PlanBadge({ plan, isTrial }: { plan: PlanType; isTrial?: boolean }) {
  const colors: Record<string, { color: string; bg: string; border: string }> = {
    PRO:   { color: "#F59E0B", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)" },
    BASIC: { color: "#0066FF", bg: "rgba(0,102,255,0.08)",  border: "rgba(0,102,255,0.20)" },
    FREE:  { color: "#71717A", bg: "rgba(161,161,170,0.06)", border: "rgba(161,161,170,0.12)" },
  }
  const c = colors[plan] ?? colors.FREE

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 6,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.03em",
      color: c.color, background: c.bg,
      border: `1px solid ${c.border}`,
    }}>
      {plan === "PRO" && "✦ "}{getPlanLabel(plan)}
      {isTrial && (
        <span style={{
          fontSize: 9, fontWeight: 600, color: "#8B5CF6",
          background: "rgba(139,92,246,0.1)",
          border: "1px solid rgba(139,92,246,0.2)",
          borderRadius: 4, padding: "0 4px", marginLeft: 2,
        }}>TRIAL</span>
      )}
    </span>
  )
}

function StatusDot({ biz }: { biz: BusinessItem }) {
  const s = getPlanStatus(biz)
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 6,
      fontSize: 11, fontWeight: 600,
      color: s.color, background: s.bg,
      border: `1px solid ${s.border}`,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: s.color,
        animation: s.label.includes("restantes") ? "pulse 2s infinite" : "none",
      }} />
      {s.label}
    </span>
  )
}

function ExpiryText({ iso }: { iso: string | null }) {
  if (!iso) return <span style={{ color: "#3F3F46", fontSize: 12 }}>Sem data</span>
  const days = daysUntil(iso)!
  const expired = days < 0
  return (
    <span style={{
      fontSize: 12, fontWeight: 500,
      color: expired ? "#EF4444" : days <= 7 ? "#F59E0B" : "#A1A1AA",
    }}>
      {formatDate(iso)}
    </span>
  )
}

function MetricCard({ label, value, color, icon }: {
  label: string; value: string | number; color: string; icon: string
}) {
  return (
    <div style={{
      background: "#111113",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 14, padding: "18px 20px",
      flex: "1 1 150px", minWidth: 140,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <p style={{
          fontSize: 11, color: "#52525B", margin: 0,
          textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600,
        }}>{label}</p>
      </div>
      <p style={{ fontSize: 28, fontWeight: 800, color, margin: 0, letterSpacing: "-0.5px" }}>
        {value}
      </p>
    </div>
  )
}

// ── Business Card (Mobile) ────────────────────────────────────────────────────

function BusinessCard({ biz, onEdit, onToggle, toggling }: {
  biz: BusinessItem
  onEdit: () => void
  onToggle: () => void
  toggling: boolean
}) {
  return (
    <div style={{
      background: "#111113",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 14, padding: 18,
    }}>
      {/* Top row: name + status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: "#FAFAFA", fontSize: 15, fontWeight: 700, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {biz.name}
          </p>
          <p style={{ color: "#52525B", fontSize: 12, margin: "2px 0 0" }}>{biz.email}</p>
        </div>
        <StatusDot biz={biz} />
      </div>

      {/* Info grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 10, color: "#52525B", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Dono</p>
          <p style={{ fontSize: 13, color: "#A1A1AA", margin: "2px 0 0" }}>{biz.owner?.name ?? "—"}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, color: "#52525B", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Plano</p>
          <div style={{ marginTop: 4 }}><PlanBadge plan={biz.plan} isTrial={biz.isTrial} /></div>
        </div>
        <div>
          <p style={{ fontSize: 10, color: "#52525B", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Vence em</p>
          <div style={{ marginTop: 2 }}><ExpiryText iso={biz.planExpiresAt} /></div>
        </div>
        <div>
          <p style={{ fontSize: 10, color: "#52525B", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Slug</p>
          <code style={{ fontSize: 11, color: "#71717A", background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: 3, marginTop: 2, display: "inline-block" }}>
            {biz.slug}
          </code>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14, fontSize: 12, color: "#52525B" }}>
        <span>{biz._count.customers} clientes</span>
        <span>·</span>
        <span>{biz._count.schedules} agend.</span>
        <span>·</span>
        <span>{formatDate(biz.createdAt)}</span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onEdit} className="admin-btn" style={{
          flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: "rgba(0,102,255,0.08)", border: "1px solid rgba(0,102,255,0.2)",
          color: "#0066FF", cursor: "pointer", fontFamily: "inherit",
        }}>Editar</button>
        <button onClick={onToggle} disabled={toggling} className="admin-btn" style={{
          flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: biz.isActive ? "rgba(239,68,68,0.06)" : "rgba(16,185,129,0.06)",
          border: `1px solid ${biz.isActive ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)"}`,
          color: biz.isActive ? "#EF4444" : "#10B981",
          cursor: toggling ? "not-allowed" : "pointer",
          fontFamily: "inherit", opacity: toggling ? 0.5 : 1,
        }}>
          {toggling ? "..." : biz.isActive ? "Desativar" : "Ativar"}
        </button>
      </div>
    </div>
  )
}

// ── CreateModal ───────────────────────────────────────────────────────────────

function CreateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (r: CreateResult) => void }) {
  const [name, setName] = useState("")
  const [owner, setOwner] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [plan, setPlan] = useState<PlanType>("BASIC")
  const [expiry, setExpiry] = useState("")
  const [isTrial, setIsTrial] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", background: "#09090B",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
    color: "#FAFAFA", fontSize: 14, outline: "none", boxSizing: "border-box",
    fontFamily: "inherit",
  }
  const labelStyle: React.CSSProperties = {
    color: "#A1A1AA", fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block",
  }

  async function handleCreate() {
    if (!name.trim() || !owner.trim() || !email.trim()) {
      setError("Preencha nome da estética, nome do dono e email.")
      return
    }
    setCreating(true)
    setError("")
    try {
      const result = await adminPost<CreateResult>("/businesses/create", {
        businessName: name.trim(),
        ownerName: owner.trim(),
        ownerEmail: email.trim().toLowerCase(),
        phone: phone.trim(),
        plan,
        planExpiresAt: expiry || undefined,
      })
      onSuccess(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao criar loja.")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
      }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: "#18181B", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, padding: "28px 28px 24px", width: 500, maxWidth: "100%",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <h2 style={{ color: "#FAFAFA", fontSize: 18, fontWeight: 700, marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,102,255,0.1)", fontSize: 14,
          }}>➕</span>
          Nova Loja
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Nome da estética *</label>
            <input style={inputStyle} placeholder="Ex: BRK Estética Automotiva" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Nome do dono *</label>
            <input style={inputStyle} placeholder="Ex: João Silva" value={owner} onChange={e => setOwner(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Email do dono (Google) *</label>
            <input style={inputStyle} placeholder="Ex: joao@gmail.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Telefone</label>
            <input style={inputStyle} placeholder="(00) 00000-0000" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>

          {/* Plan section */}
          <div style={{
            background: "#111113", borderRadius: 10, padding: 16,
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <p style={{ color: "#FAFAFA", fontSize: 13, fontWeight: 600, margin: "0 0 12px" }}>Plano</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={labelStyle}>Tipo</label>
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={plan} onChange={e => setPlan(e.target.value as PlanType)}
                >
                  <option value="BASIC">Basic</option>
                  <option value="PRO">Pro</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={labelStyle}>Vencimento</label>
                <input style={inputStyle} type="date" value={expiry} onChange={e => setExpiry(e.target.value)} />
              </div>
            </div>

            {/* Trial toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setIsTrial(!isTrial)}
                style={{
                  width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                  background: isTrial ? "#8B5CF6" : "rgba(255,255,255,0.1)",
                  position: "relative", transition: "background 0.2s",
                }}
              >
                <span style={{
                  position: "absolute", top: 2,
                  left: isTrial ? 20 : 2,
                  width: 18, height: 18, borderRadius: "50%",
                  background: "#fff", transition: "left 0.2s",
                }} />
              </button>
              <span style={{ fontSize: 13, color: isTrial ? "#8B5CF6" : "#71717A", fontWeight: 500 }}>
                Trial {isTrial ? "ativo" : "desativado"}
              </span>
            </div>
            <p style={{ fontSize: 11, color: "#52525B", margin: "6px 0 0" }}>
              {isTrial
                ? "Sem data de vencimento → trial de 7 dias automático."
                : "Plano pago — defina a data de vencimento acima."}
            </p>
          </div>
        </div>

        {error && <p style={{ color: "#EF4444", fontSize: 13, marginTop: 12 }}>{error}</p>}

        <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "10px 20px", background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
            color: "#A1A1AA", fontSize: 14, cursor: "pointer", fontFamily: "inherit",
          }}>Cancelar</button>
          <button onClick={handleCreate} disabled={creating} style={{
            padding: "10px 24px", background: "#0066FF", color: "white",
            border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14,
            cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1,
            display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit",
          }}>
            {creating ? <Spinner size={14} /> : null}
            {creating ? "Criando..." : "Criar Loja"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SuccessModal ──────────────────────────────────────────────────────────────

function SuccessModal({ data, onClose }: { data: CreateResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  function buildMessage(): string {
    return [
      `Olá! Sua loja foi criada na Forbion 🎉`,
      ``,
      `🔗 Sua loja: ${data.access.storeUrl}`,
      `📲 Para acessar o dashboard:`,
      `   1. Acesse ${data.access.loginUrl}`,
      `   2. Clique em "Entrar com Google"`,
      `   3. Use o email: ${data.access.email}`,
      ``,
      `Qualquer dúvida é só chamar!`,
    ].join("\n")
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildMessage())
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
      }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: "#18181B", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, padding: "28px 28px 24px", width: 500, maxWidth: "100%",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(16,185,129,0.1)", fontSize: 18,
          }}>✅</div>
          <div>
            <h2 style={{ color: "#FAFAFA", fontSize: 17, fontWeight: 700, margin: 0 }}>Loja criada com sucesso!</h2>
            <p style={{ color: "#52525B", fontSize: 12, margin: 0 }}>{data.business.name}</p>
          </div>
        </div>

        <div style={{
          background: "#09090B", borderRadius: 10, padding: 18,
          border: "1px solid rgba(255,255,255,0.06)", marginBottom: 18,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <span style={{ color: "#52525B", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Loja</span>
              <p style={{ color: "#0066FF", fontSize: 14, margin: "2px 0 0", wordBreak: "break-all" }}>{data.access.storeUrl}</p>
            </div>
            <div>
              <span style={{ color: "#52525B", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Plano</span>
              <p style={{ margin: "4px 0 0" }}><PlanBadge plan={data.business.plan as PlanType} /></p>
            </div>
          </div>
        </div>

        <div style={{
          background: "rgba(16,185,129,0.04)", borderRadius: 10, padding: 18,
          border: "1px solid rgba(16,185,129,0.12)", marginBottom: 20,
        }}>
          <p style={{ color: "#10B981", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📲 Como acessar</p>
          <ol style={{ color: "#A1A1AA", fontSize: 13, margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
            <li>Acesse <span style={{ color: "#0066FF" }}>{data.access.loginUrl}</span></li>
            <li>Clique em &quot;Entrar com Google&quot;</li>
            <li>Use o email: <strong style={{ color: "#FAFAFA" }}>{data.access.email}</strong></li>
          </ol>
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "10px 20px", background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
            color: "#A1A1AA", fontSize: 14, cursor: "pointer", fontFamily: "inherit",
          }}>Fechar</button>
          <button onClick={handleCopy} className="admin-btn" style={{
            padding: "10px 20px",
            background: copied ? "rgba(16,185,129,0.08)" : "rgba(0,102,255,0.08)",
            color: copied ? "#10B981" : "#0066FF",
            border: `1px solid ${copied ? "rgba(16,185,129,0.25)" : "rgba(0,102,255,0.25)"}`,
            borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s",
          }}>
            {copied ? "✅ Copiado!" : "📋 Copiar mensagem"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── EditModal ─────────────────────────────────────────────────────────────────

function EditModal({ biz, onClose, onSaved }: {
  biz: BusinessItem; onClose: () => void; onSaved: (updated: BusinessItem) => void
}) {
  const [plan, setPlan] = useState<PlanType>(biz.plan === "FREE" ? "BASIC" : biz.plan)
  const [expiry, setExpiry] = useState(biz.planExpiresAt?.split("T")[0] ?? "")
  const [active, setActive] = useState(biz.isActive)
  const [isTrial, setIsTrial] = useState(biz.isTrial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", background: "#09090B",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
    color: "#FAFAFA", fontSize: 14, outline: "none", boxSizing: "border-box",
    fontFamily: "inherit",
  }
  const labelStyle: React.CSSProperties = {
    color: "#A1A1AA", fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block",
  }

  // Compute status preview
  const days = daysUntil(expiry ? expiry + "T23:59:59Z" : null)
  const isExpired = days !== null && days < 0
  const statusPreview = !expiry
    ? { text: "Sem data de vencimento", color: "#52525B" }
    : isExpired
      ? { text: `Expirado há ${Math.abs(days!)} dias`, color: "#EF4444" }
      : days! <= 7
        ? { text: `Vence em ${days} dias`, color: "#F59E0B" }
        : { text: `Ativo — vence em ${days} dias`, color: "#10B981" }

  async function handleSave() {
    setSaving(true)
    setError("")
    try {
      const result = await adminPatch<{ business: BusinessItem }>(`/businesses/${biz.id}`, {
        plan,
        planExpiresAt: expiry || null,
        isActive: active,
        isTrial,
      })
      onSaved({ ...biz, ...result.business })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
      }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: "#18181B", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, padding: "28px 28px 24px", width: 480, maxWidth: "100%",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,102,255,0.1)", fontSize: 16,
          }}>✏️</div>
          <div>
            <h2 style={{ color: "#FAFAFA", fontSize: 17, fontWeight: 700, margin: 0 }}>Editar loja</h2>
            <p style={{ color: "#52525B", fontSize: 12, margin: 0 }}>
              {biz.name} · <code style={{ fontSize: 11, color: "#3F3F46" }}>{biz.slug}</code>
            </p>
          </div>
        </div>

        {/* Current status preview */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, margin: "16px 0 20px",
          padding: "10px 14px", borderRadius: 8,
          background: `${statusPreview.color}08`,
          border: `1px solid ${statusPreview.color}20`,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: statusPreview.color,
          }} />
          <span style={{ fontSize: 13, color: statusPreview.color, fontWeight: 600 }}>
            {getPlanLabel(plan)} {isTrial ? "(Trial)" : ""} — {statusPreview.text}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Plan section */}
          <div style={{
            background: "#111113", borderRadius: 10, padding: 16,
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <p style={{ color: "#FAFAFA", fontSize: 13, fontWeight: 600, margin: "0 0 12px" }}>Plano & Validade</p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={labelStyle}>Tipo de plano</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={plan} onChange={e => setPlan(e.target.value as PlanType)}>
                  <option value="BASIC">Basic</option>
                  <option value="PRO">Pro</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={labelStyle}>Vencimento</label>
                <input style={inputStyle} type="date" value={expiry} onChange={e => setExpiry(e.target.value)} />
                {expiry && (
                  <button onClick={() => setExpiry("")} style={{
                    marginTop: 4, background: "none", border: "none",
                    color: "#71717A", fontSize: 11, cursor: "pointer", padding: 0,
                    fontFamily: "inherit",
                  }}>✕ Limpar data</button>
                )}
              </div>
            </div>

            {/* Trial toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                onClick={() => setIsTrial(!isTrial)}
                style={{
                  width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                  background: isTrial ? "#8B5CF6" : "rgba(255,255,255,0.1)",
                  position: "relative", transition: "background 0.2s",
                }}
              >
                <span style={{
                  position: "absolute", top: 2,
                  left: isTrial ? 20 : 2,
                  width: 18, height: 18, borderRadius: "50%",
                  background: "#fff", transition: "left 0.2s",
                }} />
              </button>
              <span style={{ fontSize: 13, color: isTrial ? "#8B5CF6" : "#71717A", fontWeight: 500 }}>
                {isTrial ? "Período de teste (Trial)" : "Plano pago"}
              </span>
            </div>
          </div>

          {/* Status section */}
          <div>
            <label style={labelStyle}>Status da loja</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setActive(true)} style={{
                flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                background: active ? "rgba(16,185,129,0.08)" : "transparent",
                border: `1px solid ${active ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.1)"}`,
                color: active ? "#10B981" : "#71717A",
                transition: "all 0.15s",
              }}>✅ Ativa</button>
              <button onClick={() => setActive(false)} style={{
                flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                background: !active ? "rgba(239,68,68,0.08)" : "transparent",
                border: `1px solid ${!active ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.1)"}`,
                color: !active ? "#EF4444" : "#71717A",
                transition: "all 0.15s",
              }}>🚫 Inativa</button>
            </div>
          </div>
        </div>

        {error && <p style={{ color: "#EF4444", fontSize: 13, marginTop: 12 }}>{error}</p>}

        <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "10px 20px", background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
            color: "#A1A1AA", fontSize: 14, cursor: "pointer", fontFamily: "inherit",
          }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="admin-btn" style={{
            padding: "10px 24px", background: "#0066FF", color: "white",
            border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14,
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
            display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit",
          }}>
            {saving ? <Spinner size={14} /> : null}
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  return <AdminPageContent />
}

function AdminPageContent() {
  const [businesses, setBusinesses] = useState<BusinessItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [filterPlan, setFilterPlan] = useState<"all" | PlanType>("all")
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "expired" | "trial">("all")

  // Modals
  const [showCreate, setShowCreate] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successData, setSuccessData] = useState<CreateResult | null>(null)
  const [editBiz, setEditBiz] = useState<BusinessItem | null>(null)

  // Actions loading
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)

  // Debounce
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250)
    return () => clearTimeout(id)
  }, [search])

  // Fetch
  const fetchBusinesses = useCallback(async () => {
    try {
      setLoading(true)
      const data = await adminGet<{ businesses: BusinessItem[] }>("/businesses")
      setBusinesses(data.businesses)
      setError("")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao buscar lojas.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchBusinesses() }, [fetchBusinesses])

  // Filter
  const filtered = businesses.filter(b => {
    // Text search
    if (debouncedSearch) {
      const match =
        b.name.toLowerCase().includes(debouncedSearch) ||
        b.email.toLowerCase().includes(debouncedSearch) ||
        b.slug.toLowerCase().includes(debouncedSearch) ||
        (b.owner?.name?.toLowerCase().includes(debouncedSearch)) ||
        (b.owner?.email.toLowerCase().includes(debouncedSearch))
      if (!match) return false
    }
    // Plan filter
    if (filterPlan !== "all" && b.plan !== filterPlan) return false
    // Status filter
    if (filterStatus !== "all") {
      const days = daysUntil(b.planExpiresAt)
      const expired = days !== null && days < 0
      if (filterStatus === "active" && (expired || !b.isActive)) return false
      if (filterStatus === "expired" && !expired) return false
      if (filterStatus === "trial" && !b.isTrial) return false
    }
    return true
  })

  // Quick toggle active
  async function handleToggleActive(biz: BusinessItem) {
    setTogglingId(biz.id)
    try {
      await adminPatch(`/businesses/${biz.id}`, { isActive: !biz.isActive })
      setBusinesses(prev => prev.map(b => b.id === biz.id ? { ...b, isActive: !b.isActive } : b))
    } catch {
      // silent
    } finally {
      setTogglingId(null)
    }
  }

  // Metrics
  const total = businesses.length
  const activeCount = businesses.filter(b => b.isActive && !(daysUntil(b.planExpiresAt) !== null && daysUntil(b.planExpiresAt)! < 0)).length
  const proCount = businesses.filter(b => b.plan === "PRO").length
  const trialCount = businesses.filter(b => b.isTrial).length
  const expiredCount = businesses.filter(b => {
    const d = daysUntil(b.planExpiresAt)
    return d !== null && d < 0
  }).length
  const expiringSoon = businesses.filter(b => {
    const d = daysUntil(b.planExpiresAt)
    return d !== null && d >= 0 && d <= 7
  }).length

  // Keyboard shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // ── Filter pill styles ────────────────────────────────────────────────────

  function pillStyle(active: boolean): React.CSSProperties {
    return {
      padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500,
      cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
      border: `1px solid ${active ? "rgba(0,102,255,0.3)" : "rgba(255,255,255,0.08)"}`,
      background: active ? "rgba(0,102,255,0.08)" : "transparent",
      color: active ? "#0066FF" : "#71717A",
    }
  }

  return (
    <div style={{ padding: "24px 24px 40px", maxWidth: 1320, margin: "0 auto" }}>
      <style>{ANIMATIONS}</style>

      {/* ── Title ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24, animation: "fadeUp 0.3s ease" }}>
        <h1 style={{
          fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.5px",
          background: "linear-gradient(135deg, #FAFAFA 60%, #71717A)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Painel Admin
        </h1>
        <p style={{ color: "#52525B", fontSize: 13, marginTop: 4 }}>
          Gestão de estéticas, planos e validade.
        </p>
      </div>

      {/* ── Metrics ────────────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 12, marginBottom: 24,
        animation: "fadeUp 0.3s ease 0.05s both",
      }}>
        <MetricCard label="Total"     value={total}         color="#FAFAFA"  icon="📊" />
        <MetricCard label="Ativos"    value={activeCount}   color="#10B981"  icon="✅" />
        <MetricCard label="PRO"       value={proCount}      color="#F59E0B"  icon="✦" />
        <MetricCard label="Trial"     value={trialCount}    color="#8B5CF6"  icon="🧪" />
        <MetricCard label="Expirados" value={expiredCount}  color="#EF4444"  icon="⏰" />
        {expiringSoon > 0 && (
          <MetricCard label="Expirando" value={expiringSoon} color="#F59E0B" icon="⚠️" />
        )}
      </div>

      {/* ── Actions Bar ────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 12, alignItems: "center", marginBottom: 16,
        flexWrap: "wrap", animation: "fadeUp 0.3s ease 0.1s both",
      }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 260px", minWidth: 200 }}>
          <span style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            color: "#52525B", fontSize: 14, pointerEvents: "none",
          }}>🔍</span>
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar estética, email, slug... (⌘K)"
            style={{
              width: "100%", height: 40, paddingLeft: 36, paddingRight: 14,
              background: "#111113", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, color: "#FAFAFA", fontSize: 13, outline: "none",
              fontFamily: "inherit", boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
            onFocus={e => { e.target.style.borderColor = "rgba(0,102,255,0.4)" }}
            onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.08)" }}
          />
        </div>

        <p style={{ color: "#3F3F46", fontSize: 12, margin: 0, whiteSpace: "nowrap" }}>
          {filtered.length}/{total}
        </p>

        <button
          onClick={() => setShowCreate(true)}
          className="admin-btn"
          style={{
            padding: "9px 18px", background: "#0066FF", color: "white",
            border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            fontFamily: "inherit", whiteSpace: "nowrap",
          }}
        >
          + Nova Loja
        </button>
      </div>

      {/* ── Filter Pills ──────────────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap",
        animation: "fadeUp 0.3s ease 0.12s both",
      }}>
        <button style={pillStyle(filterPlan === "all" && filterStatus === "all")} onClick={() => { setFilterPlan("all"); setFilterStatus("all") }}>
          Todos
        </button>
        <button style={pillStyle(filterStatus === "active")} onClick={() => { setFilterStatus(filterStatus === "active" ? "all" : "active"); setFilterPlan("all") }}>
          Ativos
        </button>
        <button style={pillStyle(filterStatus === "trial")} onClick={() => { setFilterStatus(filterStatus === "trial" ? "all" : "trial"); setFilterPlan("all") }}>
          Trial
        </button>
        <button style={pillStyle(filterPlan === "PRO")} onClick={() => { setFilterPlan(filterPlan === "PRO" ? "all" : "PRO"); setFilterStatus("all") }}>
          PRO
        </button>
        <button style={pillStyle(filterStatus === "expired")} onClick={() => { setFilterStatus(filterStatus === "expired" ? "all" : "expired"); setFilterPlan("all") }}>
          Expirados
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          padding: "12px 16px", background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10,
          color: "#EF4444", fontSize: 13, marginBottom: 16,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          ⚠️ {error}
          <button onClick={fetchBusinesses} style={{
            marginLeft: "auto", background: "none", border: "none",
            color: "#EF4444", fontSize: 12, cursor: "pointer", textDecoration: "underline",
            fontFamily: "inherit",
          }}>Tentar novamente</button>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Spinner size={24} color="#0066FF" />
        </div>
      )}

      {/* ── Desktop Table ──────────────────────────────────────────────── */}
      {!loading && (
        <div className="admin-desktop-table" style={{ animation: "fadeUp 0.3s ease 0.15s both" }}>
          <div style={{
            background: "#111113",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14, overflow: "hidden",
          }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Estética", "Dono", "Plano", "Status", "Vence em", "Dados", "Criada", "Ações"].map(h => (
                      <th key={h} style={{
                        padding: "12px 16px", color: "#3F3F46", fontSize: 10,
                        fontWeight: 600, textTransform: "uppercase", textAlign: "left",
                        letterSpacing: "0.06em", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 48, textAlign: "center", color: "#3F3F46", fontSize: 14 }}>
                        {debouncedSearch ? `Nenhuma loja para "${debouncedSearch}"` : "Nenhuma loja cadastrada."}
                      </td>
                    </tr>
                  ) : filtered.map(b => (
                    <tr key={b.id} className="admin-row" style={{
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                    }}>
                      <td style={{ padding: "14px 16px" }}>
                        <p style={{ color: "#FAFAFA", fontSize: 14, fontWeight: 600, margin: 0 }}>{b.name}</p>
                        <code style={{ color: "#3F3F46", fontSize: 11 }}>{b.slug}</code>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {b.owner ? (
                          <div>
                            <p style={{ color: "#A1A1AA", fontSize: 13, margin: 0 }}>{b.owner.name ?? "—"}</p>
                            <p style={{ color: "#3F3F46", fontSize: 11, margin: "1px 0 0" }}>{b.owner.email}</p>
                          </div>
                        ) : (
                          <span style={{ color: "#3F3F46", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <PlanBadge plan={b.plan} isTrial={b.isTrial} />
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <StatusDot biz={b} />
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <ExpiryText iso={b.planExpiresAt} />
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ color: "#52525B", fontSize: 12 }}>
                          {b._count.customers}c · {b._count.schedules}a · {b._count.users}u
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#3F3F46", fontSize: 12, whiteSpace: "nowrap" }}>
                        {formatDate(b.createdAt)}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => setEditBiz(b)} className="admin-btn" style={{
                            padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: "rgba(0,102,255,0.06)", border: "1px solid rgba(0,102,255,0.15)",
                            color: "#0066FF", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                          }}>Editar</button>
                          <button
                            onClick={() => handleToggleActive(b)} disabled={togglingId === b.id}
                            className="admin-btn"
                            style={{
                              padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: b.isActive ? "rgba(239,68,68,0.06)" : "rgba(16,185,129,0.06)",
                              border: `1px solid ${b.isActive ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)"}`,
                              color: b.isActive ? "#EF4444" : "#10B981",
                              cursor: togglingId === b.id ? "not-allowed" : "pointer",
                              fontFamily: "inherit", whiteSpace: "nowrap",
                              opacity: togglingId === b.id ? 0.5 : 1,
                            }}
                          >
                            {togglingId === b.id ? "..." : b.isActive ? "Desativar" : "Ativar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Cards ───────────────────────────────────────────────── */}
      {!loading && (
        <div className="admin-mobile-cards" style={{
          display: "none",
          flexDirection: "column", gap: 12,
          animation: "fadeUp 0.3s ease 0.15s both",
        }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: 48, textAlign: "center", color: "#3F3F46", fontSize: 14,
              background: "#111113", borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.06)",
            }}>
              {debouncedSearch ? `Nenhuma loja para "${debouncedSearch}"` : "Nenhuma loja cadastrada."}
            </div>
          ) : filtered.map(b => (
            <BusinessCard
              key={b.id}
              biz={b}
              onEdit={() => setEditBiz(b)}
              onToggle={() => handleToggleActive(b)}
              toggling={togglingId === b.id}
            />
          ))}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onSuccess={(result) => {
            setSuccessData(result)
            setShowCreate(false)
            setShowSuccess(true)
            fetchBusinesses()
          }}
        />
      )}

      {showSuccess && successData && (
        <SuccessModal
          data={successData}
          onClose={() => { setShowSuccess(false); setSuccessData(null) }}
        />
      )}

      {editBiz && (
        <EditModal
          biz={editBiz}
          onClose={() => setEditBiz(null)}
          onSaved={(updated) => {
            setBusinesses(prev => prev.map(b => b.id === updated.id ? { ...b, ...updated } : b))
            setEditBiz(null)
          }}
        />
      )}
    </div>
  )
}
