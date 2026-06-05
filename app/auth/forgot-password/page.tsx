"use client"

import { useState } from "react"
import Link from "next/link"
import ForbionLogo from "@/components/shared/ForbionLogo"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      // O backend SEMPRE responde 200 genérico (anti-enumeração).
      await fetch(`${API}/api/auth/forgot-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim() }),
      })
      setSent(true)
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <ForbionLogo />
        </div>

        {sent ? (
          <div style={{ background: "#111", border: "1px solid #1F1F1F", borderRadius: 16, padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
            <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>Verifique seu e-mail</h1>
            <p style={{ color: "#A1A1AA", fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" }}>
              Se existir uma conta com <strong style={{ color: "#fff" }}>{email}</strong>, enviamos um link para
              redefinir a senha. O link expira em 1 hora.
            </p>
            <Link href="/auth/login" style={{ color: "#0066FF", fontSize: 14, textDecoration: "none" }}>
              ← Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: "#111", border: "1px solid #1F1F1F", borderRadius: 16, padding: 32 }}>
            <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>Esqueceu a senha?</h1>
            <p style={{ color: "#71717A", fontSize: 14, margin: "0 0 24px" }}>
              Informe seu e-mail e enviaremos um link para criar uma nova senha.
            </p>

            <label style={{ display: "block", color: "#A1A1AA", fontSize: 13, marginBottom: 8 }}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoFocus
              style={{
                width: "100%", height: 48, background: "#0A0A0A", border: "1px solid #1F1F1F",
                borderRadius: 12, padding: "0 16px", color: "#fff", fontSize: 15, fontFamily: "inherit",
                marginBottom: 20, boxSizing: "border-box",
              }}
            />

            {error && (
              <p style={{ color: "#F87171", fontSize: 13, margin: "0 0 16px" }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              style={{
                width: "100%", height: 48,
                background: (loading || !email.trim()) ? "#1A1A1A" : "#0066FF",
                border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600,
                color: (loading || !email.trim()) ? "#3F3F46" : "#fff",
                cursor: (loading || !email.trim()) ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {loading ? "Enviando..." : "Enviar link de redefinição"}
            </button>

            <div style={{ textAlign: "center", marginTop: 16 }}>
              <Link href="/auth/login" style={{ color: "#71717A", fontSize: 13, textDecoration: "none" }}>
                ← Voltar para o login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
