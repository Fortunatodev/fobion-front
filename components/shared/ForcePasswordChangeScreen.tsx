"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ShieldCheck } from "lucide-react"
import { getToken } from "@/lib/auth"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

/**
 * Troca de senha OBRIGATÓRIA no 1º acesso (B2 — senha emitida temporária pelo
 * admin/reset). Bloqueia o painel inteiro até o dono definir uma senha própria.
 * O backend não exige a senha atual quando user.mustChangePassword=true (o JWT já
 * prova a identidade), então aqui só pedimos a nova senha + confirmação.
 * Ao concluir, recarrega o usuário (a flag vira false) e o layout libera o painel.
 */
export default function ForcePasswordChangeScreen({ onDone }: { onDone: () => void }) {
  const [next, setNext]       = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)

  const tooShort  = next.length > 0 && next.length < 8
  const mismatch  = confirm.length > 0 && next !== confirm
  const canSubmit = next.length >= 8 && next === confirm && !loading

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/auth/change-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body:    JSON.stringify({ newPassword: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Não foi possível definir a senha.")
        return
      }
      toast.success("Senha definida! Bem-vindo.")
      await onDone()
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível conectar ao servidor.")
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 46, background: "var(--c-bg)", border: "1px solid var(--c-border)",
    borderRadius: 10, padding: "0 14px", color: "var(--c-text)", fontSize: 15, fontFamily: "inherit",
    boxSizing: "border-box",
  }

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: "var(--c-bg)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <div style={{
        width: "100%", maxWidth: 420, backgroundColor: "var(--c-surface)",
        border: "1px solid var(--c-border)", borderRadius: 16, padding: 28,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center",
          justifyContent: "center", backgroundColor: "rgba(0,102,255,0.1)", marginBottom: 16,
        }}>
          <ShieldCheck size={22} color="#0066FF" />
        </div>
        <h1 style={{ fontSize: 19, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
          Defina sua senha
        </h1>
        <p style={{ fontSize: 14, color: "var(--c-text-3)", margin: "8px 0 22px", lineHeight: 1.5 }}>
          Você entrou com uma senha temporária. Por segurança, escolha uma senha sua
          antes de continuar — é rápido e só acontece uma vez.
        </p>

        <label style={{ display: "block", color: "var(--c-text-3)", fontSize: 12, marginBottom: 6 }}>Nova senha</label>
        <input
          type="password" value={next} autoFocus
          onChange={e => setNext(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSubmit() }}
          placeholder="mínimo 8 caracteres" style={inputStyle}
        />
        {tooShort && <p style={{ color: "#F59E0B", fontSize: 12, margin: "4px 0 0" }}>Mínimo de 8 caracteres.</p>}

        <label style={{ display: "block", color: "var(--c-text-3)", fontSize: 12, margin: "14px 0 6px" }}>Confirmar senha</label>
        <input
          type="password" value={confirm}
          onChange={e => setConfirm(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSubmit() }}
          placeholder="repita a nova senha" style={inputStyle}
        />
        {mismatch && <p style={{ color: "#F59E0B", fontSize: 12, margin: "4px 0 0" }}>As senhas não conferem.</p>}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            marginTop: 22, width: "100%", height: 46, borderRadius: 10, border: "none",
            background: canSubmit ? "#0066FF" : "var(--c-border)",
            color: canSubmit ? "#fff" : "var(--c-text-4)",
            fontSize: 15, fontWeight: 600, cursor: canSubmit ? "pointer" : "not-allowed",
            fontFamily: "inherit",
          }}
        >
          {loading ? "Salvando..." : "Salvar e entrar"}
        </button>
      </div>
    </div>
  )
}
