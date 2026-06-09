"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import ForbionLogo from "@/components/shared/ForbionLogo"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "var(--c-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--c-border)", borderTopColor: "#0066FF", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <ResetContent />
    </Suspense>
  )
}

function ResetContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const token        = searchParams.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm]   = useState("")
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [done, setDone]         = useState(false)

  const tooShort = password.length > 0 && password.length < 8
  const mismatch = confirm.length > 0 && password !== confirm
  const canSubmit = password.length >= 8 && password === confirm && token

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      toast.error("Link inválido ou expirado. Solicite um novo.")
      return
    }
    if (password.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.")
      return
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem.")
      return
    }
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data.error || "Não foi possível redefinir a senha."
        setError(msg)
        toast.error(msg)
        return
      }
      setDone(true)
      toast.success("Senha redefinida com sucesso!")
      setTimeout(() => router.replace("/auth/login?reset=success"), 1800)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível conectar ao servidor. Tente novamente."
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 48, background: "var(--c-bg)", border: "1px solid var(--c-border)",
    borderRadius: 12, padding: "0 16px", color: "var(--c-text)", fontSize: 15, fontFamily: "inherit",
    boxSizing: "border-box",
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <ForbionLogo />
        </div>

        {done ? (
          <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h1 style={{ color: "var(--c-text)", fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>Senha redefinida!</h1>
            <p style={{ color: "var(--c-text-2)", fontSize: 14, margin: 0 }}>Redirecionando para o login...</p>
          </div>
        ) : !token ? (
          <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h1 style={{ color: "var(--c-text)", fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>Link inválido</h1>
            <p style={{ color: "var(--c-text-2)", fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" }}>
              Este link de redefinição está incompleto ou expirou. Solicite um novo.
            </p>
            <Link href="/auth/forgot-password" style={{ color: "#0066FF", fontSize: 14, textDecoration: "none" }}>
              Pedir novo link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, padding: 32 }}>
            <h1 style={{ color: "var(--c-text)", fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>Criar nova senha</h1>
            <p style={{ color: "var(--c-text-3)", fontSize: 14, margin: "0 0 24px" }}>Escolha uma senha de pelo menos 8 caracteres.</p>

            <label style={{ display: "block", color: "var(--c-text-2)", fontSize: 13, marginBottom: 8 }}>Nova senha</label>
            <div style={{ position: "relative", marginBottom: 6 }}>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{ position: "absolute", right: 14, top: 15, background: "none", border: "none", color: "var(--c-text-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
              >
                {showPass ? "ocultar" : "ver"}
              </button>
            </div>
            {tooShort && <p style={{ color: "#F59E0B", fontSize: 12, margin: "0 0 14px" }}>Mínimo de 8 caracteres.</p>}
            {!tooShort && <div style={{ height: 14 }} />}

            <label style={{ display: "block", color: "var(--c-text-2)", fontSize: 13, marginBottom: 8 }}>Confirmar senha</label>
            <input
              type={showPass ? "text" : "password"}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              style={{ ...inputStyle, marginBottom: 6 }}
            />
            {mismatch && <p style={{ color: "#F59E0B", fontSize: 12, margin: "0 0 14px" }}>As senhas não conferem.</p>}
            {!mismatch && <div style={{ height: 14 }} />}

            {error && <p style={{ color: "#F87171", fontSize: 13, margin: "0 0 16px" }}>{error}</p>}

            <button
              type="submit"
              disabled={loading || !canSubmit}
              style={{
                width: "100%", height: 48,
                background: (loading || !canSubmit) ? "var(--c-border)" : "#0066FF",
                border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600,
                color: (loading || !canSubmit) ? "var(--c-text-4)" : "var(--c-text)",
                cursor: (loading || !canSubmit) ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {loading ? "Salvando..." : "Redefinir senha"}
            </button>

            <div style={{ textAlign: "center", marginTop: 16 }}>
              <Link href="/auth/login" style={{ color: "var(--c-text-3)", fontSize: 13, textDecoration: "none" }}>← Voltar para o login</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
