"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getToken, removeToken, setToken } from "@/lib/auth"
import ForbionLogo from "@/components/shared/ForbionLogo"

// ── Feature flag — controlada pela env var na Vercel ─────────────────────────
const ENABLE_GOOGLE_LOGIN = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN === "true"
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #1F1F1F", borderTopColor: "#0066FF", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [loading,    setLoading] = useState(false)
  const [error,      setError]   = useState<string | null>(null)
  const [email,      setEmail]   = useState("")
  const [password,   setPassword] = useState("")
  const [showPass,   setShowPass] = useState(false)

  // Roda UMA única vez — dependências vazias obrigatório
  useEffect(() => {
    const err = searchParams.get("error")
    if (err) setError(err)

    const token = getToken()
    if (!token) return
    try {
      const payload = JSON.parse(atob(token.split(".")[1]))
      const now     = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp > now) {
        router.replace("/dashboard")
      } else {
        removeToken()
      }
    } catch {
      removeToken()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGoogleLogin = () => {
    setLoading(true)
    setError(null)
    window.location.href = `${API}/api/auth/google`
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Credenciais inválidas.")
        return
      }
      setToken(data.token)
      router.replace("/dashboard")
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  const errorMessages: Record<string, string> = {
    auth_failed:      "Erro na autenticação. Tente novamente.",
    oauth_failed:     "Erro na autenticação com Google. Tente novamente.",
    cancelled:        "Login cancelado. Tente novamente.",
    user_not_found:   "Usuário não encontrado.",
    account_disabled: "Conta desativada. Entre em contato com o suporte.",
    server_error:     "Erro interno. Tente novamente em instantes.",
  }

  const errorText = error ? (errorMessages[error] ?? error) : null

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0A0A",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Orb azul */}
      <div style={{
        position: "absolute", top: "-15%", left: "50%",
        transform: "translateX(-50%)",
        width: 700, height: 700, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,102,255,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Orb roxo */}
      <div style={{
        position: "absolute", bottom: "-10%", right: "-5%",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Grid sutil */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: [
          "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
        ].join(","),
        backgroundSize: "64px 64px",
        pointerEvents: "none",
      }} />

      {/* Card */}
      <div style={{
        position: "relative", zIndex: 1,
        width: "100%", maxWidth: 420,
        margin: "0 24px",
        background: "rgba(14,14,14,0.9)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 24,
        padding: "40px 36px",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
        animation: "cardIn 0.5s cubic-bezier(0.16,1,0.3,1)",
      }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
          <ForbionLogo size="xl" />
        </div>

        {/* Título */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", margin: 0 }}>
            Bem-vindo de volta
          </h1>
          <p style={{ fontSize: 14, color: "#71717A", marginTop: 8, lineHeight: 1.5 }}>
            Entre com sua conta para acessar o painel
          </p>
        </div>

        {/* Erro */}
        {errorText && (
          <div style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 12, padding: "12px 16px",
            fontSize: 13, color: "#EF4444",
            textAlign: "center", marginBottom: 20,
          }}>
            {errorText}
          </div>
        )}

        {/* ── Botão Google (só quando feature flag ativa) ── */}
        {ENABLE_GOOGLE_LOGIN && (
          <>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{
                width: "100%", height: 52,
                background: loading ? "#E8E8E8" : "#ffffff",
                border: "none", borderRadius: 14,
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: 12,
                fontSize: 15, fontWeight: 600, color: "#111",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 2px 16px rgba(0,0,0,0.15)",
                transition: "all 0.2s ease",
                opacity: loading ? 0.75 : 1,
                fontFamily: "inherit",
              }}
              onMouseEnter={e => {
                if (!loading) {
                  const b = e.currentTarget as HTMLButtonElement
                  b.style.transform = "translateY(-1px)"
                  b.style.boxShadow = "0 6px 24px rgba(0,0,0,0.2)"
                }
              }}
              onMouseLeave={e => {
                const b = e.currentTarget as HTMLButtonElement
                b.style.transform = "translateY(0)"
                b.style.boxShadow = "0 2px 16px rgba(0,0,0,0.15)"
              }}
            >
              {loading ? (
                <>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #ccc", borderTopColor: "#666", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
                  <span>Conectando...</span>
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Continuar com Google</span>
                </>
              )}
            </button>

            {/* Divisor */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
              <div style={{ flex: 1, height: 1, background: "#1A1A1A" }} />
              <span style={{ fontSize: 12, color: "#3F3F46", whiteSpace: "nowrap" }}>ou entre com e-mail</span>
              <div style={{ flex: 1, height: 1, background: "#1A1A1A" }} />
            </div>
          </>
        )}

        {/* ── Formulário e-mail / senha ── */}
        <form onSubmit={handleEmailLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#71717A", marginBottom: 6, fontWeight: 500 }}>
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              disabled={loading}
              style={{
                width: "100%", height: 46,
                background: "#111", border: "1px solid #27272A",
                borderRadius: 10, padding: "0 14px",
                fontSize: 14, color: "#FAFAFA",
                outline: "none", fontFamily: "inherit",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "#0066FF" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "#27272A" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#71717A", marginBottom: 6, fontWeight: 500 }}>
              Senha
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                style={{
                  width: "100%", height: 46,
                  background: "#111", border: "1px solid #27272A",
                  borderRadius: 10, padding: "0 42px 0 14px",
                  fontSize: 14, color: "#FAFAFA",
                  outline: "none", fontFamily: "inherit",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "#0066FF" }}
                onBlur={e  => { e.currentTarget.style.borderColor = "#27272A" }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{
                  position: "absolute", right: 12, top: "50%",
                  transform: "translateY(-50%)",
                  background: "none", border: "none",
                  cursor: "pointer", padding: 4,
                  color: "#52525B", fontSize: 13,
                  lineHeight: 1,
                }}
              >
                {showPass ? "ocultar" : "ver"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              width: "100%", height: 48,
              background: (loading || !email || !password) ? "#1A1A1A" : "#0066FF",
              border: "none", borderRadius: 12,
              fontSize: 15, fontWeight: 600,
              color: (loading || !email || !password) ? "#3F3F46" : "#fff",
              cursor: (loading || !email || !password) ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              marginTop: 4,
            }}
            onMouseEnter={e => {
              if (!loading && email && password) {
                e.currentTarget.style.background = "#0052CC"
              }
            }}
            onMouseLeave={e => {
              if (!loading && email && password) {
                e.currentTarget.style.background = "#0066FF"
              }
            }}
          >
            {loading ? (
              <>
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.7s linear infinite" }} />
                <span>Entrando...</span>
              </>
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        {/* Rodapé */}
        <p style={{ fontSize: 11, color: "#52525B", textAlign: "center", marginTop: 24, lineHeight: 1.5 }}>
          Ao entrar você concorda com os{" "}
          <a href="/terms" style={{ color: "#71717A", textDecoration: "underline" }}>Termos de Serviço</a>
          {" "}e{" "}
          <a href="/privacy" style={{ color: "#71717A", textDecoration: "underline" }}>Política de Privacidade</a>
        </p>
      </div>

      <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input::placeholder { color: #3F3F46; }
      `}</style>
    </div>
  )
}
