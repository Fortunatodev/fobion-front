"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useUser } from "@/contexts/UserContext"
import { isAuthenticated } from "@/lib/auth"
import Sidebar from "@/components/layout/Sidebar"   // import direto, não barrel
import Header from "@/components/layout/Header"
import BillingLockScreen from "@/components/shared/BillingLockScreen"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router   = useRouter()
  const pathname = usePathname()
  const { loading, accountLock } = useUser()
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

  // ── Loading spinner ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#09090B",
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
      backgroundColor: "#0A0A0A",
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
          paddingTop: isMobile ? 56 : 0,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header: .header-mobile = flex mobile / none desktop */}
        <Header />

        {/* content-offset: pt-64px mobile / pt-0 desktop */}
        <main
          className="content-offset"
          style={{ flex: 1, overflowY: "auto" }}
        >
          <div style={{ padding: isMobile ? "16px" : "24px" }}>{children}</div>
        </main>
      </div>
    </div>
  )
}