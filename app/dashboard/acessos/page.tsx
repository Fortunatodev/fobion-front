"use client"

import { useState, useEffect, useCallback } from "react"
import { ShieldCheck, Plus, X, Trash2, AlertCircle, Loader2, Crown, KeyRound, Lock, Mail } from "lucide-react"
import Link from "next/link"
import { apiGet, apiPost, apiDelete } from "@/lib/api"
import { useUser } from "@/contexts/UserContext"
import { toast } from "sonner"
import ConfirmDialog from "@/components/shared/ConfirmDialog"

type TeamRole = "OWNER" | "ADMIN" | "EMPLOYEE"

interface TeamUser {
  id:        string
  name:      string
  email:     string
  role:      TeamRole
  createdAt: string
}

interface ListTeamResponse {
  users: TeamUser[]
}

interface CreateTeamResponse {
  message: string
  user:    TeamUser
}

const ROLE_META: Record<TeamRole, { label: string; color: string }> = {
  OWNER:    { label: "Dono",        color: "#F59E0B" },
  ADMIN:    { label: "Admin",       color: "#0066FF" },
  EMPLOYEE: { label: "Funcionário", color: "#10B981" },
}

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase() || "?"
}

function AccessDenied() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 120px)" }}>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center", padding: 24 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Lock size={28} color="#EF4444" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--c-text)", margin: "0 0 8px" }}>Acesso restrito</h2>
        <p style={{ fontSize: 13, color: "var(--c-text-3)", lineHeight: 1.6, margin: "0 0 24px" }}>
          Esta área é exclusiva do dono da loja.
        </p>
        <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 20px", borderRadius: 10, backgroundColor: "transparent", border: "1px solid var(--c-border)", color: "var(--c-text-3)", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, required, type = "text", autoComplete,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  type?: string
  autoComplete?: string
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 500, color: "var(--c-text-3)", letterSpacing: "0.03em" }}>
        {label} {required && <span style={{ color: "#EF4444" }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          height: 40, padding: "0 12px", borderRadius: 10,
          border: "1px solid var(--c-border-2)", backgroundColor: "var(--c-surface-2)",
          color: "var(--c-text)", fontSize: 14, outline: "none",
          fontFamily: "inherit", boxSizing: "border-box", width: "100%",
        }}
      />
    </div>
  )
}

export default function AcessosPage() {
  const { user, loading: userLoading } = useUser()

  const [team,    setTeam]    = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)

  // Form "criar acesso"
  const [showForm, setShowForm] = useState(false)
  const [fName,    setFName]    = useState("")
  const [fEmail,   setFEmail]   = useState("")
  const [fPass,    setFPass]    = useState("")
  const [fRole,    setFRole]    = useState<"ADMIN" | "EMPLOYEE">("EMPLOYEE")
  const [saving,   setSaving]   = useState(false)

  // Remoção
  const [removeTarget, setRemoveTarget] = useState<TeamUser | null>(null)
  const [removing,     setRemoving]     = useState(false)

  const loadTeam = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet<ListTeamResponse>("/auth/team")
      setTeam(data.users ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar os acessos.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!userLoading && user?.role !== "EMPLOYEE") void loadTeam()
  }, [userLoading, user?.role, loadTeam])

  function resetForm() {
    setFName("")
    setFEmail("")
    setFPass("")
    setFRole("EMPLOYEE")
  }

  async function handleCreate() {
    const name  = fName.trim()
    const email = fEmail.trim()
    if (name.length < 2)        { toast.error("Informe o nome completo do acesso.");          return }
    if (!email.includes("@"))   { toast.error("Informe um e-mail válido.");                   return }
    if (fPass.length < 8)       { toast.error("A senha deve ter pelo menos 8 caracteres.");   return }

    setSaving(true)
    try {
      const res = await apiPost<CreateTeamResponse>("/auth/team", {
        name, email, password: fPass, role: fRole,
      })
      toast.success("Acesso criado com sucesso.")
      setTeam((prev) => [...prev, res.user])
      resetForm()
      setShowForm(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o acesso.")
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await apiDelete(`/auth/team/${removeTarget.id}`)
      toast.success("Acesso removido.")
      setTeam((prev) => prev.filter((t) => t.id !== removeTarget.id))
      setRemoveTarget(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover o acesso.")
    } finally {
      setRemoving(false)
    }
  }

  if (!userLoading && user?.role === "EMPLOYEE") {
    return <AccessDenied />
  }

  return (
    <>
      <style>{`
        @keyframes fadeInAc { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spinAc   { to{transform:rotate(360deg)} }
        @keyframes skelAc   { 0%,100%{opacity:.4} 50%{opacity:.8} }
      `}</style>

      <div style={{ animation: "fadeInAc 0.25s ease" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>Acessos</h1>
            <p style={{ fontSize: 13, color: "var(--c-text-4)", margin: "4px 0 0" }}>
              Crie e gerencie os logins de quem usa o sistema da sua loja
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm((v) => !v) }}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: showForm ? "transparent" : "linear-gradient(135deg, #0066FF, #7C3AED)",
              border: showForm ? "1px solid var(--c-border-2)" : "none",
              borderRadius: 12, padding: "10px 20px",
              color: showForm ? "var(--c-text-2)" : "white",
              fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {showForm ? <><X size={15} /> Cancelar</> : <><Plus size={15} /> Criar acesso</>}
          </button>
        </div>

        {/* ── Form criar acesso ── */}
        {showForm && (
          <div style={{
            backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)",
            borderRadius: 16, padding: 20, marginBottom: 24, animation: "fadeInAc 0.2s ease",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <KeyRound size={16} color="var(--c-text-3)" />
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>Novo acesso</h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 16 }}>
              <Field label="Nome"  value={fName}  onChange={setFName}  placeholder="Ex: Maria Souza"      required autoComplete="off" />
              <Field label="E-mail" value={fEmail} onChange={setFEmail} placeholder="email@exemplo.com"     required type="email" autoComplete="off" />
              <Field label="Senha provisória" value={fPass} onChange={setFPass} placeholder="Mínimo 8 caracteres" required type="password" autoComplete="new-password" />

              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 500, color: "var(--c-text-3)", letterSpacing: "0.03em" }}>
                  Papel <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <select
                  value={fRole}
                  onChange={(e) => setFRole(e.target.value === "ADMIN" ? "ADMIN" : "EMPLOYEE")}
                  style={{
                    height: 40, padding: "0 12px", borderRadius: 10,
                    border: "1px solid var(--c-border-2)", backgroundColor: "var(--c-surface-2)",
                    color: "var(--c-text)", fontSize: 14, outline: "none",
                    fontFamily: "inherit", boxSizing: "border-box", width: "100%", cursor: "pointer",
                  }}
                >
                  <option value="EMPLOYEE">Funcionário — acesso operacional</option>
                  <option value="ADMIN">Admin — acesso de gestão</option>
                </select>
              </div>
            </div>

            <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: "0 0 16px", lineHeight: 1.5, display: "flex", gap: 6, alignItems: "flex-start" }}>
              <Mail size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              Compartilhe a senha provisória com a pessoa. Ela pode trocá-la depois em Configurações.
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => { resetForm(); setShowForm(false) }}
                disabled={saving}
                style={{
                  height: 40, padding: "0 18px", borderRadius: 10, border: "1px solid var(--c-border-2)",
                  background: "transparent", color: "var(--c-text-2)", fontSize: 14, fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                style={{
                  height: 40, padding: "0 20px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #0066FF, #7C3AED)", color: "white",
                  fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1, fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 7,
                }}
              >
                {saving && <Loader2 size={14} style={{ animation: "spinAc 0.7s linear infinite" }} />}
                Criar acesso
              </button>
            </div>
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 96, backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, animation: `skelAc 1.5s ease ${i * 0.1}s infinite` }} />
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && team.length === 0 && (
          <div style={{ backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 20, padding: "64px 20px", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "var(--c-surface-2)", border: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <ShieldCheck size={26} color="var(--c-border-2)" />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--c-text)", margin: 0 }}>Nenhum acesso adicional ainda</p>
            <p style={{ fontSize: 13, color: "var(--c-text-4)", marginTop: 6 }}>Crie logins para sua equipe acessar o sistema com o próprio usuário.</p>
            <button
              onClick={() => { resetForm(); setShowForm(true) }}
              style={{ marginTop: 20, padding: "10px 22px", background: "linear-gradient(135deg, #0066FF, #7C3AED)", border: "none", borderRadius: 12, color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              Criar primeiro acesso
            </button>
          </div>
        )}

        {/* ── Lista de acessos ── */}
        {!loading && team.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {team.map((member) => {
              const meta   = ROLE_META[member.role] ?? ROLE_META.EMPLOYEE
              const isSelf = member.id === user?.id
              // Não permite remover o OWNER nem o próprio usuário logado.
              const canRemove = member.role !== "OWNER" && !isSelf
              return (
                <div
                  key={member.id}
                  style={{
                    backgroundColor: "var(--c-surface)",
                    border: "1px solid var(--c-border)",
                    borderRadius: 16, padding: 18,
                    display: "flex", alignItems: "center", gap: 14,
                  }}
                >
                  <div style={{
                    width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg, #0066FF, #7C3AED)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontWeight: 700, color: "var(--c-on-primary)",
                  }}>
                    {getInitials(member.name)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--c-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {member.name}
                      </p>
                      {isSelf && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--c-text-4)", flexShrink: 0 }}>(você)</span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {member.email}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "4px 10px",
                        color: meta.color,
                        backgroundColor: `${meta.color}1A`,
                        border: `1px solid ${meta.color}33`,
                        display: "inline-flex", alignItems: "center", gap: 5,
                        lineHeight: 1, minHeight: 22,
                      }}>
                        {member.role === "OWNER" && <Crown size={11} />}
                        {meta.label}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--c-text-4)" }}>
                        Desde {new Date(member.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>

                  {canRemove && (
                    <button
                      onClick={() => setRemoveTarget(member)}
                      title="Remover acesso"
                      aria-label={`Remover acesso de ${member.name}`}
                      style={{
                        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                        border: "1px solid rgba(239,68,68,0.2)", backgroundColor: "transparent",
                        color: "#EF4444", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Nota de rodapé ── */}
        {!loading && team.length > 0 && (
          <div style={{
            marginTop: 20, display: "flex", gap: 8, alignItems: "flex-start",
            fontSize: 12, color: "var(--c-text-4)", lineHeight: 1.5,
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>O dono do negócio não pode ser removido. Remover um acesso desativa o login imediatamente, mas preserva o histórico no sistema.</span>
          </div>
        )}
      </div>

      {/* ── Confirmação de remoção ── */}
      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => { if (!removing) setRemoveTarget(null) }}
        onConfirm={handleRemove}
        title="Remover acesso"
        description={
          removeTarget
            ? `Tem certeza que deseja remover o acesso de ${removeTarget.name} (${removeTarget.email})? Essa pessoa não conseguirá mais entrar no sistema.`
            : ""
        }
        confirmLabel="Remover acesso"
        cancelLabel="Cancelar"
        variant="danger"
        loading={removing}
      />
    </>
  )
}
