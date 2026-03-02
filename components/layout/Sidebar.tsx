"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, Zap, BarChart2 } from "lucide-react"
import { useUser } from "@/contexts/UserContext"
import { navGroups } from "@/lib/navigation"
import Logo from "./Logo"

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, logout } = useUser()

  const [hoveredHref,    setHoveredHref]    = useState<string | null>(null)
  const [showLogout,     setShowLogout]     = useState(false)
  const [logoutHovered,  setLogoutHovered]  = useState(false)
  const [profileHovered, setProfileHovered] = useState(false)
  const [upgradeHovered, setUpgradeHovered] = useState(false)

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  function getInitials(name: string): string {
    return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join("")
  }

  function handleLogout() {
    logout()
    router.replace("/auth/login")
  }

  return (
    <>
      {/*
        .sidebar-desktop:
          display: none   → mobile
          display: flex   → ≥768px
      */}
      <aside
        className="sidebar-desktop"
        style={{
          position: "fixed",
          left: 0, top: 0,
          height: "100vh",
          width: 240,
          backgroundColor: "#111111",
          borderRight: "1px solid #1F1F1F",
          flexDirection: "column",
          zIndex: 40,
          overflowY: "auto",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Logo */}
        <div style={{
          height: 64, padding: "0 20px",
          borderBottom: "1px solid #1F1F1F",
          display: "flex", alignItems: "center", flexShrink: 0,
        }}>
          <Logo size="md" />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px", overflowY: "auto" }}>
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <div style={{
                  fontSize: 10, fontWeight: 600, color: "#3F3F46",
                  textTransform: "uppercase", letterSpacing: "1px",
                  paddingLeft: 12, marginBottom: 4,
                  marginTop: gi === 0 ? 4 : 20,
                }}>
                  {group.label}
                </div>
              )}
              {group.items.map((item) => {
                const active  = isActive(item.href)
                const hovered = hoveredHref === item.href
                const Icon    = item.icon
                return (
                  <div
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    onMouseEnter={() => setHoveredHref(item.href)}
                    onMouseLeave={() => setHoveredHref(null)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px", borderRadius: 10,
                      cursor: "pointer", marginBottom: 2,
                      transition: "all 0.15s ease",
                      backgroundColor: active ? "rgba(0,102,255,0.12)" : hovered ? "#1A1A1A" : "transparent",
                      border: active ? "1px solid rgba(0,102,255,0.25)" : "1px solid transparent",
                    }}
                  >
                    <Icon size={16} color={active ? "#0066FF" : hovered ? "#ffffff" : "#71717A"} />
                    <span style={{
                      fontSize: 14, fontWeight: active ? 500 : 400,
                      color: active ? "#0066FF" : hovered ? "#ffffff" : "#A1A1AA",
                      transition: "color 0.15s ease",
                    }}>
                      {item.label}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ borderTop: "1px solid #1F1F1F", padding: 12, flexShrink: 0 }}>
          {/* Upgrade card */}
          <div
            onMouseEnter={() => setUpgradeHovered(true)}
            onMouseLeave={() => setUpgradeHovered(false)}
            style={{
              background: "linear-gradient(135deg, rgba(0,102,255,0.1), rgba(124,58,237,0.1))",
              border: `1px solid ${upgradeHovered ? "rgba(0,102,255,0.35)" : "rgba(0,102,255,0.18)"}`,
              borderRadius: 12, padding: "12px 14px", marginBottom: 10,
              transition: "border-color 0.2s ease",
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Zap size={13} color="#0066FF" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#ffffff" }}>Upgrade para PRO</span>
            </div>
            <p style={{ fontSize: 11, color: "#71717A", margin: "4px 0 0" }}>
              Desbloqueie recursos avançados
            </p>
            <button
              onClick={() => router.push("/dashboard/planos")}
              style={{
                width: "100%", marginTop: 10, height: 30,
                background: "linear-gradient(135deg, #0066FF 0%, #7C3AED 100%)",
                color: "white", border: "none", borderRadius: 8,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              Ver planos →
            </button>
          </div>

          {/* Profile */}
          {user && (
            <div
              onMouseEnter={() => setProfileHovered(true)}
              onMouseLeave={() => setProfileHovered(false)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 10,
                backgroundColor: profileHovered ? "#1A1A1A" : "transparent",
                transition: "background-color 0.15s ease",
              }}
            >
              {user.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.picture} alt={user.name} width={32} height={32}
                  style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "linear-gradient(135deg, #0066FF, #7C3AED)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, color: "white", fontWeight: 600, flexShrink: 0,
                }}>
                  {getInitials(user.name)}
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#ffffff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.name}
                </p>
                <p style={{ fontSize: 11, color: "#71717A", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.email}
                </p>
              </div>

              <button
                onClick={() => setShowLogout(true)}
                onMouseEnter={() => setLogoutHovered(true)}
                onMouseLeave={() => setLogoutHovered(false)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: 4, borderRadius: 6, display: "flex", flexShrink: 0,
                  color: logoutHovered ? "#EF4444" : "#52525B",
                  transition: "color 0.15s ease",
                }}
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Confirm logout modal */}
      {showLogout && (
        <>
          <div
            onClick={() => setShowLogout(false)}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
              zIndex: 100,
            }}
          />
          <div style={{
            position: "fixed",
            top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            zIndex: 101,
            backgroundColor: "#161616",
            border: "1px solid #2A2A2A",
            borderRadius: 16, padding: "28px 32px",
            width: "min(360px, calc(100vw - 32px))",
            fontFamily: "'Inter', sans-serif",
          }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, color: "#ffffff", margin: "0 0 8px" }}>
              Sair da conta
            </h3>
            <p style={{ fontSize: 14, color: "#A1A1AA", margin: "0 0 24px" }}>
              Tem certeza que deseja sair? Você precisará fazer login novamente.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowLogout(false)}
                style={{
                  padding: "8px 16px", borderRadius: 8,
                  fontSize: 14, fontWeight: 500, cursor: "pointer",
                  background: "transparent", border: "1px solid #2A2A2A", color: "#A1A1AA",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                style={{
                  padding: "8px 16px", borderRadius: 8,
                  fontSize: 14, fontWeight: 500, cursor: "pointer",
                  background: "#EF4444", border: "none", color: "white",
                }}
              >
                Sair
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default Sidebar