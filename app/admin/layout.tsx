"use client"

import { usePathname } from "next/navigation"
import ForbionLogo from "@/components/shared/ForbionLogo"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin  = pathname === "/admin/login"

  return (
    <div style={{
      minHeight: "100vh",
      background: "#09090B",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "#FAFAFA",
    }}>
      {/* ── Header (hidden on login) ──────────────────────────────────── */}
      {!isLogin && (
        <header style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          height: 56,
          background: "rgba(9,9,11,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ForbionLogo size="md" as="div" />
            <span style={{
              fontSize: 10, fontWeight: 600, color: "#F59E0B",
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.2)",
              borderRadius: 4, padding: "1px 6px",
              letterSpacing: "0.04em",
            }}>ADMIN</span>
          </div>

          <button
            onClick={() => {
              document.cookie = "admin-token=; path=/; max-age=0"
              window.location.href = "/admin/login"
            }}
            style={{
              padding: "6px 14px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6,
              color: "#71717A",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(239,68,68,0.08)"
              e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)"
              e.currentTarget.style.color = "#EF4444"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)"
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"
              e.currentTarget.style.color = "#71717A"
            }}
          >
            Sair
          </button>
        </header>
      )}

      {children}
    </div>
  )
}
