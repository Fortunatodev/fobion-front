"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getToken, removeToken } from "@/lib/auth"
import ForbionLogo from "@/components/shared/ForbionLogo"

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
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // Roda UMA única vez — dependências vazias obrigatório
  useEffect(() => {
    // Lê erro vindo do callback
    const err = searchParams.get("error")
    if (err) setError(err)

    // Verifica token existente
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
  }, []) // ← VAZIO — nunca em loop

  const handleGoogleLogin = () => {
    setLoading(true)
    setError(null)
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
    window.location.href = `${API}/api/auth/google`
  }

  const errorMessages: Record<string, string> = {
    auth_failed:      "Erro na autenticação. Tente novamente.",
    cancelled:        "Login cancelado. Tente novamente.",
    user_not_found:   "Usuário não encontrado. Entre em contato com o suporte.",
    account_disabled: "Conta desativada. Entre em contato com o suporte.",
    server_error:     "Erro interno. Tente novamente em instantes.",
  }

  const errorText = error ? (errorMessages[error] ?? "Erro na autenticação. Tente novamente.") : null

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

      {/* Orb azul — topo centro */}
      <div style={{
        position: "absolute",
        top: "-15%", left: "50%",
        transform: "translateX(-50%)",
        width: 700, height: 700,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,102,255,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Orb roxo — bottom right */}
      <div style={{
        position: "absolute",
        bottom: "-10%", right: "-5%",
        width: 500, height: 500,
        borderRadius: "50%",
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

        {/* Logo Forbion */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "center", gap: 10, marginBottom: 32,
        }}>
          <ForbionLogo size="xl" />
        </div>

        {/* Título */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", margin: 0 }}>
            Bem-vindo de volta
          </h1>
          <p style={{ fontSize: 14, color: "#71717A", marginTop: 8, lineHeight: 1.5 }}>
            Entre com sua conta Google para acessar o painel
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

        {/* Botão Google */}
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
              <div style={{
                width: 18, height: 18, borderRadius: "50%",
                border: "2px solid #ccc", borderTopColor: "#666",
                animation: "spin 0.7s linear infinite", flexShrink: 0,
              }} />
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
          <div style={{ flex: 1, height: 1, background: "#1A1A1A" }} />
          <span style={{ fontSize: 12, color: "#2A2A2A", whiteSpace: "nowrap" }}>acesso seguro</span>
          <div style={{ flex: 1, height: 1, background: "#1A1A1A" }} />
        </div>

        {/* Features */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { icon: "📅", text: "Gerencie agendamentos em tempo real" },
            { icon: "👥", text: "Controle seus clientes e assinantes" },
            { icon: "📊", text: "Relatórios e métricas do negócio"   },
          ].map((f, i) => (
            <div key={i} style={{
              display: "flex", gap: 10, alignItems: "center",
              padding: "8px 12px", borderRadius: 10,
              background: "rgba(255,255,255,0.02)",
            }}>
              <span style={{ fontSize: 14 }}>{f.icon}</span>
              <span style={{ fontSize: 13, color: "#52525B" }}>{f.text}</span>
            </div>
          ))}
        </div>

        {/* Rodapé */}
        <p style={{ fontSize: 11, color: "#2A2A2A", textAlign: "center", marginTop: 24, lineHeight: 1.5 }}>
          Ao entrar você concorda com os{" "}
          <span style={{ color: "#3F3F46", cursor: "pointer" }}>Termos de Uso</span>
          {" "}e{" "}
          <span style={{ color: "#3F3F46", cursor: "pointer" }}>Política de Privacidade</span>
        </p>
      </div>

      <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}