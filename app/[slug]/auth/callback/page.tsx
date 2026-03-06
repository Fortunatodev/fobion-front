"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { setCustomerToken } from "@/lib/customer-auth"

export default function CustomerAuthCallback() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", backgroundColor: "#0A0A0A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "'Inter',-apple-system,sans-serif" }}>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #1F1F1F", borderTopColor: "#0066FF", animation: "sp 0.7s linear infinite" }} />
        <p style={{ fontSize: 14, color: "#52525B" }}>Autenticando...</p>
      </div>
    }>
      <CustomerAuthCallbackContent />
    </Suspense>
  )
}

function CustomerAuthCallbackContent() {
  const router = useRouter()
  const params = useParams()
  const search = useSearchParams()
  const slug   = params.slug as string

  useEffect(() => {
    const token = search.get("token")
    const error = search.get("error")

    if (error || !token) {
      router.replace(`/${slug}/login?error=auth_failed`)
      return
    }

    // setCustomerToken já dispara AUTH_CHANGE_EVENT — navbar atualiza automaticamente
    setCustomerToken(token)

    // Serviços pendentes (usuário tentou agendar sem estar logado)
    const pending = localStorage.getItem("forbion_pending_services")
    if (pending) {
      try {
        localStorage.removeItem("forbion_pending_services")
        const ids = JSON.parse(pending) as string[]
        if (Array.isArray(ids) && ids.length > 0) {
          const qs = ids.map((id) => `services=${id}`).join("&")
          router.replace(`/${slug}/agendar?${qs}`)
          return
        }
      } catch { /* ignora */ }
    }

    // Redirect personalizado (via query param ou localStorage)
    const redirect = search.get("redirect") || localStorage.getItem("forbion_login_redirect")
    if (redirect) localStorage.removeItem("forbion_login_redirect")

    if (redirect === "planos") {
      router.replace(`/${slug}/cliente?tab=planos`)
      return
    }
    if (redirect === "agendar") {
      router.replace(`/${slug}/agendar`)
      return
    }

    router.replace(`/${slug}/cliente`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: "#0A0A0A",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16,
      fontFamily: "'Inter',-apple-system,sans-serif",
    }}>
      <style>{`@keyframes sp { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        border: "3px solid #1F1F1F", borderTopColor: "#0066FF",
        animation: "sp 0.7s linear infinite",
      }} />
      <p style={{ fontSize: 14, color: "#52525B" }}>Autenticando...</p>
    </div>
  )
}