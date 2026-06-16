"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useUser } from "@/contexts/UserContext"
import { isAuthenticated } from "@/lib/auth"
import Sidebar from "@/components/layout/Sidebar"   // import direto, não barrel
import BillingLockScreen from "@/components/shared/BillingLockScreen"
import ForcePasswordChangeScreen from "@/components/shared/ForcePasswordChangeScreen"
import CarlaWidget from "@/components/dashboard/CarlaWidget"
import TrialCountdownBanner from "@/components/dashboard/TrialCountdownBanner"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router   = useRouter()
  const pathname = usePathname()
  const { loading, accountLock, user, loadUser } = useUser()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => {
    if (!loading && !isAuthenticated()) {
      router.replace("/auth/login")
    }
  }, [loading, router])

  // RBAC (defesa em profundidade): EMPLOYEE é operacional — só Agenda e Agendamentos.
  // O menu já esconde o resto; aqui barramos acesso por URL direta (o back também devolve 403).
  useEffect(() => {
    if (loading || user?.role !== "EMPLOYEE") return
    const allowed = ["/dashboard/agenda", "/dashboard/agendamentos"]
    const ok = allowed.some(p => pathname === p || pathname.startsWith(p + "/"))
    if (!ok) router.replace("/dashboard/agenda")
  }, [loading, user, pathname, router])

  // ── Loading spinner ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "var(--c-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="animate-spin" style={{
          width: 32, height: 32,
          borderRadius: "50%",
          border: "2.5px solid rgba(0,102,255,0.2)",
          borderTopColor: "#0066FF",
        }} />
      </div>
    )
  }

  // ── Troca de senha OBRIGATÓRIA (senha temporária do admin/reset) ─────────────
  // Bloqueia o painel até o 1º acesso definir senha própria. Prioridade sobre o
  // lock de plano: é o primeiríssimo passo do dono novo. onDone recarrega o /me
  // (a flag vira false no back) e o painel libera.
  if (user?.mustChangePassword) {
    return <ForcePasswordChangeScreen onDone={loadUser} />
  }

  // ── Account locked — show BillingLockScreen ─────────────────────────────────
  // Allow /dashboard/configuracoes through so the user can see plan info
  const isConfigPage = pathname === "/dashboard/configuracoes"

  if (accountLock && !isConfigPage) {
    return <BillingLockScreen lock={accountLock} />
  }

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      backgroundColor: "var(--c-bg)",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* Sidebar: .sidebar-desktop = none mobile / flex desktop */}
      <Sidebar />

      {/* Área principal */}
      <div
        className="main-with-sidebar"
        style={{
          flex: 1,
          marginLeft: isMobile ? 0 : 220,
          // Única barra mobile é a topbar do Sidebar (height 56); sem Header duplicado.
          paddingTop: isMobile ? 56 : 0,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <main style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ padding: isMobile ? "16px" : "24px" }}>
            <TrialCountdownBanner />
            {children}
          </div>
        </main>
      </div>
      {/* V2-B2: assistente Carla (flutuante; ativa com GROQ_API_KEY) */}
      <CarlaWidget />
    </div>
  )
}