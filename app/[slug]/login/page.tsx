"use client"

import { Suspense, useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { isCustomerAuthenticated } from "@/lib/customer-auth"
import ForbionLogo from "@/components/shared/ForbionLogo"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

export default function CustomerLoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", backgroundColor: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',-apple-system,sans-serif" }}>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #1F1F1F", borderTopColor: "#0066FF", animation: "sp 0.7s linear infinite" }} />
      </div>
    }>
      <CustomerLoginContent />
    </Suspense>
  )
}

function CustomerLoginContent() {
  const params       = useParams()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const slug         = params.slug as string

  const [businessName, setBusinessName] = useState("")
  const [loading,      setLoading]      = useState(false)
  const [checked,      setChecked]      = useState(false)
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null)

  // Roda EXATAMENTE UMA VEZ — dependências vazias
  useEffect(() => {
    // Se já está autenticado, manda para área do cliente
    if (isCustomerAuthenticated()) {
      router.replace(`/${slug}/cliente`)  // ← rota correta
      return
    }

    // Mensagens de erro vindas do callback
    const error = searchParams.get("error")
    if (error === "session_expired")       setErrorMsg("Sua sessão expirou. Faça login novamente.")
    if (error === "auth_failed")            setErrorMsg("Erro na autenticação. Tente novamente.")
    if (error === "customer_auth_failed")   setErrorMsg("Falha ao autenticar com o Google. Tente novamente.")
    if (error === "server_error")           setErrorMsg("Erro interno. Tente novamente em instantes.")

    setChecked(true)

    // Busca nome do negócio
    if (!slug) return
    fetch(`${API}/api/public/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.business?.name) setBusinessName(d.business.name) })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // ← DEPENDÊNCIAS VAZIAS — roda só uma vez na montagem

  function handleGoogleLogin() {
    setLoading(true)
    const redirect = searchParams.get("redirect") ?? ""
    if (redirect) localStorage.setItem("forbion_login_redirect", redirect)
    // Garante que API_URL está correto antes de redirecionar
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
    window.location.href = `${apiUrl}/api/auth/google/customer?slug=${slug}`
  }

  if (!checked) return (
    <div style={{
      minHeight: "100vh", backgroundColor: "#0A0A0A",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter',-apple-system,sans-serif",
    }}>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #1F1F1F", borderTopColor: "#0066FF", animation: "sp 0.7s linear infinite" }} />
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes cardEntrance { from{opacity:0;transform:translateY(16px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes floatOrb1 { 0%,100%{transform:translate(0,0)} 33%{transform:translate(20px,-30px)} 66%{transform:translate(-15px,20px)} }
        @keyframes floatOrb2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-25px,25px)} }
        @keyframes sp { to{transform:rotate(360deg)} }
        @keyframes btnSpin { to{transform:rotate(360deg)} }
      `}</style>

      <div style={{
        minHeight: "100vh", backgroundColor: "#0A0A0A",
        overflow: "hidden", position: "relative",
        fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
      }}>
        {/* Orbs */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,102,255,0.07) 0%, transparent 70%)", animation: "floatOrb1 12s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)", animation: "floatOrb2 15s ease-in-out infinite" }} />
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>

        {/* Card central */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
          <div style={{
            maxWidth: 400, width: "100%",
            backgroundColor: "rgba(17,17,17,0.88)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 24, padding: "40px 36px",
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
            animation: "cardEntrance 0.4s cubic-bezier(0.16,1,0.3,1)",
          }}>
            {/* Logo */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <ForbionLogo size="xl" />
            </div>

            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", textAlign: "center", letterSpacing: "-0.5px", margin: 0 }}>
              Bem-vindo!
            </h1>
            <p style={{ fontSize: 14, color: "#71717A", textAlign: "center", marginTop: 8, lineHeight: 1.5 }}>
              {businessName ? `Entrar na sua conta da loja ${businessName}` : "Entrar na sua conta"}
            </p>

            {/* Mensagem de erro */}
            {errorMsg && (
              <div style={{
                marginTop: 16, backgroundColor: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 10, padding: "10px 14px",
                fontSize: 13, color: "#EF4444", textAlign: "center",
              }}>
                {errorMsg}
              </div>
            )}

            {/* Botão Google */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{
                marginTop: 28, width: "100%", height: 48,
                borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
                backgroundColor: "rgba(255,255,255,0.05)",
                color: "#fff", fontSize: 15, fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 10, transition: "all 0.2s ease",
                fontFamily: "inherit", opacity: loading ? 0.7 : 1,
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)" } }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)" }}
            >
              {loading ? (
                <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", animation: "btnSpin 0.7s linear infinite" }} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
              )}
              {loading ? "Redirecionando..." : "Continuar com Google"}
            </button>

            <p style={{ fontSize: 12, color: "#3F3F46", textAlign: "center", marginTop: 20, lineHeight: 1.6 }}>
              Ao entrar, você concorda com os termos de uso do estabelecimento.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}