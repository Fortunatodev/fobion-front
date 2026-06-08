"use client"

import { useState } from "react"
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
    if (!canSubmit) return
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
        setMsg({ kind: "err", text: data.error || "Não foi possível alterar a senha." })
        return
      }
      setMsg({ kind: "ok", text: "Senha alterada com sucesso." })
      setCurrent(""); setNext(""); setConfirm("")
      setTimeout(() => { setOpen(false); setMsg(null) }, 1500)
    } catch {
      setMsg({ kind: "err", text: "Não foi possível conectar ao servidor." })
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 42, background: "#0A0A0A", border: "1px solid #1F1F1F",
    borderRadius: 10, padding: "0 14px", color: "#fff", fontSize: 14, fontFamily: "inherit",
    boxSizing: "border-box", marginBottom: 4,
  }

  return (
    <div style={{
      backgroundColor: "#0A0A0A", border: "1px solid #1F1F1F",
      borderRadius: 12, padding: isMobile ? "14px 14px" : "14px 16px", marginBottom: 24,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#fff", margin: 0 }}>Senha</p>
          <p style={{ fontSize: 12, color: "#71717A", marginTop: 2 }}>
            Defina ou altere sua senha de acesso
          </p>
        </div>
        <button
          onClick={() => { setOpen(o => !o); reset() }}
          style={{
            height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid #1F1F1F",
            backgroundColor: "transparent", color: "#A1A1AA", fontSize: 12, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          {open ? "Cancelar" : "Alterar"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 16 }}>
          <label style={{ display: "block", color: "#71717A", fontSize: 12, marginBottom: 6 }}>
            Senha atual <span style={{ color: "#52525B" }}>(deixe em branco se você entra com o Google)</span>
          </label>
          <input type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="••••••••" style={inputStyle} />

          <label style={{ display: "block", color: "#71717A", fontSize: 12, margin: "12px 0 6px" }}>Nova senha</label>
          <input type="password" value={next} onChange={e => setNext(e.target.value)} placeholder="••••••••" style={inputStyle} />
          {tooShort && <p style={{ color: "#F59E0B", fontSize: 12, margin: "2px 0 0" }}>Mínimo de 8 caracteres.</p>}

          <label style={{ display: "block", color: "#71717A", fontSize: 12, margin: "12px 0 6px" }}>Confirmar nova senha</label>
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
              background: canSubmit ? "#0066FF" : "#1A1A1A",
              color: canSubmit ? "#fff" : "#3F3F46",
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
