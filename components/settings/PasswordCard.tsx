"use client"

import { useState } from "react"
import { toast } from "sonner"
import { getToken } from "@/lib/auth"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

/**
 * IMP-101 — card de troca/definição de senha do dono logado.
 * Componente isolado: gerencia o próprio estado, não toca no resto da página
 * de Configurações. Chama POST /api/auth/change-password com Bearer.
 *
 * Contas criadas via Google não têm senha — o dono pode DEFINIR a primeira
 * deixando "senha atual" em branco (o backend permite quando não há hash).
 */
export default function PasswordCard({ isMobile = false }: { isMobile?: boolean }) {
  const [open, setOpen]       = useState(false)
  const [current, setCurrent] = useState("")
  const [next, setNext]       = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  const tooShort = next.length > 0 && next.length < 8
  const mismatch = confirm.length > 0 && next !== confirm
  const canSubmit = next.length >= 8 && next === confirm && !loading

  const reset = () => { setCurrent(""); setNext(""); setConfirm(""); setMsg(null) }

  const handleSubmit = async () => {
    if (loading) return
    if (next.length < 8) {
      toast.error("A nova senha precisa ter no mínimo 8 caracteres.")
      return
    }
    if (next !== confirm) {
      toast.error("As senhas não conferem. Confirme a nova senha igual.")
      return
    }
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch(`${API}/api/auth/change-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body:    JSON.stringify({ currentPassword: current || undefined, newPassword: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const text = data.error || "Não foi possível alterar a senha."
        setMsg({ kind: "err", text })
        toast.error(text)
        return
      }
      setMsg({ kind: "ok", text: "Senha alterada com sucesso." })
      toast.success("Senha alterada com sucesso.")
      setCurrent(""); setNext(""); setConfirm("")
      setTimeout(() => { setOpen(false); setMsg(null) }, 1500)
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
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text)", margin: 0 }}>Senha</p>
          <p style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 2 }}>
            Defina ou altere sua senha de acesso
          </p>
        </div>
        <button
          onClick={() => { setOpen(o => !o); reset() }}
          style={{
            height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid var(--c-border)",
            backgroundColor: "transparent", color: "var(--c-text-2)", fontSize: 12, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          {open ? "Cancelar" : "Alterar"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 16 }}>
          <label style={{ display: "block", color: "var(--c-text-3)", fontSize: 12, marginBottom: 6 }}>
            Senha atual <span style={{ color: "var(--c-text-4)" }}>(deixe em branco se você entra com o Google)</span>
          </label>
          <input type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="••••••••" style={inputStyle} />

          <label style={{ display: "block", color: "var(--c-text-3)", fontSize: 12, margin: "12px 0 6px" }}>Nova senha</label>
          <input type="password" value={next} onChange={e => setNext(e.target.value)} placeholder="••••••••" style={inputStyle} />
          {tooShort && <p style={{ color: "#F59E0B", fontSize: 12, margin: "2px 0 0" }}>Mínimo de 8 caracteres.</p>}

          <label style={{ display: "block", color: "var(--c-text-3)", fontSize: 12, margin: "12px 0 6px" }}>Confirmar nova senha</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" style={inputStyle} />
          {mismatch && <p style={{ color: "#F59E0B", fontSize: 12, margin: "2px 0 0" }}>As senhas não conferem.</p>}

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
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </div>
      )}
    </div>
  )
}
