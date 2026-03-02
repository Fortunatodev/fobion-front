"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/UserContext"
import { isAuthenticated } from "@/lib/auth"
import { Sidebar } from "@/components/layout/Sidebar"
import Header from "@/components/layout/Header"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { loading } = useUser()

  useEffect(() => {
    if (!loading && !isAuthenticated()) {
      router.replace("/auth/login")
    }
  }, [loading, router])

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#0A0A0A",
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
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          width: "100%",
        }}
      >
        {/* Header: .header-mobile = flex mobile / none desktop */}
        <Header />

        {/* content-offset: pt-64px mobile / pt-0 desktop */}
        <main
          className="content-offset"
          style={{ flex: 1, overflowY: "auto" }}
        >
          <div style={{ padding: "24px" }}>{children}</div>
        </main>
      </div>
    </div>
  )
}