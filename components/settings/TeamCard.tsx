"use client"

import { useEffect, useState } from "react"
import { apiGet, apiPost } from "@/lib/api"

/**
 * V2-B4 — Gestão de acessos da equipe (RBAC base). Lista e cria logins de
 * funcionário/admin via /api/auth/team (só OWNER/ADMIN). Se não for manager,
 * a API responde 403 e o card se esconde.
 */
interface TeamUser { id: string; name: string; email: string; role: string }

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  OWNER:    { label: "Dono",        color: "#F59E0B" },
  ADMIN:    { label: "Admin",       color: "#7C3AED" },
  EMPLOYEE: { label: "Funcionário", color: "#0066FF" },
}

export default function TeamCard({ isMobile = false }: { isMobile?: boolean }) {
  const [users, setUsers] = useState<TeamUser[] | null>(null)
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: "", email: "", password: "", role: "EMPLOYEE" })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  const load = () => {
    apiGet<{ users: TeamUser[] }>("/auth/team")
      .then((r) => setUsers(r.users ?? []))
      .catch(() => setHidden(true)) // 403 (não-manager) → esconde
  }
  useEffect(load, [])

  if (hidden) return null

  async function create() {
    if (!f.name.trim() || !f.email.trim() || f.password.length < 8) {
      setMsg({ kind: "err", text: "Preencha nome, e-mail e senha (mín. 8)." }); return
    }
    setSaving(true); setMsg(null)
    try {
      await apiPost("/auth/team", { name: f.name.trim(), email: f.email.trim(), password: f.password, role: f.role })
      setMsg({ kind: "ok", text: "Acesso criado!" })
      setF({ name: "", email: "", password: "", role: "EMPLOYEE" })
      load()
      setTimeout(() => { setOpen(false); setMsg(null) }, 1200)
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Erro ao criar acesso." })
    } finally { setSaving(false) }
  }

  const inp: React.CSSProperties = { width: "100%", height: 40, padding: "0 12px", background: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 10, color: "var(--c-text)", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }

  return (
    <div style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 12, padding: isMobile ? "14px 14px" : "14px 16px", marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text)", margin: 0 }}>Equipe & acessos</p>
          <p style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 2 }}>Crie logins pros funcionários acessarem o sistema</p>
        </div>
        <button onClick={() => { setOpen((o) => !o); setMsg(null) }} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid var(--c-border)", background: "transparent", color: "var(--c-text-2)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
          {open ? "Fechar" : "+ Novo acesso"}
        </button>
      </div>

      {users && users.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
          {users.map((u) => {
            const r = ROLE_LABEL[u.role] ?? { label: u.role, color: "var(--c-text-3)" }
            return (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ color: "var(--c-text)", fontWeight: 500 }}>{u.name}</span>
                <span style={{ color: "var(--c-text-3)" }}>{u.email}</span>
                <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, color: r.color, background: `${r.color}1A`, border: `1px solid ${r.color}33`, borderRadius: 6, padding: "1px 8px" }}>{r.label}</span>
              </div>
            )
          })}
        </div>
      )}

      {open && (
        <div style={{ marginTop: 14 }}>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nome" style={inp} />
          <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="E-mail de acesso" style={inp} />
          <input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Senha (mín. 8)" style={inp} />
          <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} style={{ ...inp, cursor: "pointer" }}>
            <option value="EMPLOYEE">Funcionário</option>
            <option value="ADMIN">Admin (acesso total)</option>
          </select>
          {msg && <p style={{ color: msg.kind === "ok" ? "#10B981" : "#F87171", fontSize: 13, margin: "0 0 8px" }}>{msg.text}</p>}
          <button onClick={create} disabled={saving} style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "none", background: saving ? "var(--c-border)" : "#0066FF", color: saving ? "var(--c-text-4)" : "white", fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {saving ? "Criando…" : "Criar acesso"}
          </button>
        </div>
      )}
    </div>
  )
}
