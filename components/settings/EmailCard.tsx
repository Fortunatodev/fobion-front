"use client"

import { useState } from "react"
import { toast } from "sonner"
import { getToken } from "@/lib/auth"
import { useUser } from "@/contexts/UserContext"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

/**
 * Troca do e-mail de LOGIN do dono. Espelha o PasswordCard.
 * Chama POST /api/auth/change-email com Bearer; exige a senha atual (o e-mail é
 * a identidade de login). Conta criada via Google (sem senha) pode trocar deixando
 * a senha em branco — o backend permite quando não há hash.
 */
export default function EmailCard({ isMobile = false }: { isMobile?: boolean }) {
  const { user } = useUser()
  const [open, setOpen]       = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [current, setCurrent] = useState("")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())
  const canSubmit = validEmail && !loading

  const reset = () => { setNewEmail(""); setCurrent(""); setMsg(null) }

  const handleSubmit = async () => {
    if (loading) return
    if (!validEmail) { toast.error("Digite um e-mail válido."); return }
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch(`${API}/api/auth/change-email`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body:    JSON.stringify({ currentPassword: current || undefined, newEmail: newEmail.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const text = data.error || "Não foi possível alterar o e-mail."
        setMsg({ kind: "err", text })
        toast.error(text)
        return
      }
      setMsg({ kind: "ok", text: "E-mail alterado! Use o novo e-mail no próximo login." })
      toast.success("E-mail alterado com sucesso.")
      setNewEmail(""); setCurrent("")
      setTimeout(() => { setOpen(false); setMsg(null) }, 2200)
    } catch (e) {
      const text = (e as Error).message || "Não foi possível conectar ao servidor."
      setMsg({ kind: "err", text })
      toast.error(text)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 42, background: "var(--c-bg)", border: "1px solid var(--c-border)",
    borderRadius: 10, padding: "0 14px", color: "var(--c-text)", fontSize: 14, fontFamily: "inherit",
    boxSizing: "border-box", marginBottom: 4,
  }

  return (
    <div style={{
      backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)",
      borderRadius: 12, padding: isMobile ? "14px 14px" : "14px 16px", marginBottom: 24,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text)", margin: 0 }}>E-mail de acesso</p>
          <p style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user?.email ? `Você entra com ${user.email}` : "E-mail usado para entrar na sua conta"}
          </p>
        </div>
        <button
          onClick={() => { setOpen(o => !o); reset() }}
          style={{
            height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid var(--c-border)",
            backgroundColor: "transparent", color: "var(--c-text-2)", fontSize: 12, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit", flexShrink: 0, marginLeft: 12,
          }}
        >
          {open ? "Cancelar" : "Alterar"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 16 }}>
          <label style={{ display: "block", color: "var(--c-text-3)", fontSize: 12, marginBottom: 6 }}>Novo e-mail</label>
          <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="novo@email.com" style={inputStyle} />
          {newEmail.length > 0 && !validEmail && <p style={{ color: "#F59E0B", fontSize: 12, margin: "2px 0 0" }}>Digite um e-mail válido.</p>}

          <label style={{ display: "block", color: "var(--c-text-3)", fontSize: 12, margin: "12px 0 6px" }}>
            Senha atual <span style={{ color: "var(--c-text-4)" }}>(deixe em branco se você entra com o Google)</span>
          </label>
          <input type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="••••••••" style={inputStyle} />

          {msg && (
            <p style={{ color: msg.kind === "ok" ? "#10B981" : "#F87171", fontSize: 13, margin: "12px 0 0" }}>{msg.text}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              marginTop: 16, height: 40, padding: "0 18px", borderRadius: 10, border: "none",
              background: canSubmit ? "#0066FF" : "var(--c-border)",
              color: canSubmit ? "var(--c-text)" : "var(--c-text-4)",
              fontSize: 14, fontWeight: 600, cursor: canSubmit ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}
          >
            {loading ? "Salvando..." : "Salvar novo e-mail"}
          </button>
        </div>
      )}
    </div>
  )
}
