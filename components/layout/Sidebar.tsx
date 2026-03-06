"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard, Calendar, CalendarDays, Users, Wrench,
  CreditCard, UserCheck, Settings, BarChart2, LogOut,
  ChevronRight, UserCircle, Menu, X, Crown,
} from "lucide-react"
import { useUser } from "@/contexts/UserContext"
import NotificationBell from "@/components/dashboard/NotificationBell"
import ForbionLogo from "@/components/shared/ForbionLogo"

// PRO-only paths — shown with a badge on BASIC plan
const PRO_ONLY_PATHS = new Set([
  "/dashboard/planos",
  "/dashboard/assinantes",
  "/dashboard/relatorios",
])

const navSections = [
  {
    label: "VISÃO GERAL",
    items: [
      { href: "/dashboard",        label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/agenda", label: "Agenda",    icon: Calendar        },
    ],
  },
  {
    label: "GESTÃO",
    items: [
      { href: "/dashboard/agendamentos", label: "Agendamentos", icon: CalendarDays },
      { href: "/dashboard/clientes",     label: "Clientes",     icon: UserCircle   },
      { href: "/dashboard/employees",    label: "Funcionários", icon: Users        },
      { href: "/dashboard/servicos",     label: "Serviços",     icon: Wrench       },
      { href: "/dashboard/planos",       label: "Planos",       icon: CreditCard   },
      { href: "/dashboard/assinantes",   label: "Assinantes",   icon: UserCheck    },
      { href: "/dashboard/relatorios",   label: "Relatórios",   icon: BarChart2    },
    ],
  },
  {
    label: "CONFIGURAÇÕES",
    items: [
      { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
]

function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname        = usePathname()
  const router          = useRouter()
  const { user, planStatus, logout } = useUser()

  const isPro = planStatus?.plan === "PRO"

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  function handleLogout() {
    logout()
    router.push("/auth/login")
    onItemClick?.()
  }

  const initials = user?.name
    ? user.name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase()
    : "?"

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      backgroundColor: "#0A0A0A",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* Logo + Notificações */}
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #1A1A1A", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ForbionLogo size="md" as="div" style={{ flex: 1 }} />
          <NotificationBell />
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
        {navSections.map(section => (
          <div key={section.label} style={{ marginBottom: 20 }}>
            <p style={{
              fontSize: 10, fontWeight: 700, color: "#3F3F46",
              letterSpacing: "0.08em", padding: "0 10px", marginBottom: 6,
            }}>
              {section.label}
            </p>
            {section.items.map(item => {
              const active     = isActive(item.href)
              const Icon       = item.icon
              const isProOnly  = PRO_ONLY_PATHS.has(item.href) && !isPro
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onItemClick}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", borderRadius: 10,
                    backgroundColor: active ? "rgba(0,102,255,0.1)" : "transparent",
                    color: active ? "#fff" : isProOnly ? "#52525B" : "#71717A",
                    textDecoration: "none", fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    transition: "all 0.15s", marginBottom: 2,
                    opacity: isProOnly ? 0.7 : 1,
                  }}
                >
                  <Icon size={15} style={{ flexShrink: 0, color: active ? "#0066FF" : "#52525B" }} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {isProOnly && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: "#F59E0B",
                      backgroundColor: "rgba(245,158,11,0.1)",
                      border: "1px solid rgba(245,158,11,0.15)",
                      borderRadius: 4, padding: "1px 5px",
                      display: "flex", alignItems: "center", gap: 2,
                    }}>
                      <Crown size={8} /> PRO
                    </span>
                  )}
                  {active && !isProOnly && <ChevronRight size={12} color="#0066FF" />}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Plan badge */}
      {planStatus && (
        <div style={{ padding: "0 10px 8px", flexShrink: 0 }}>
          <div style={{
            padding: "8px 10px", borderRadius: 8,
            backgroundColor: isPro ? "rgba(245,158,11,0.06)" : "rgba(0,102,255,0.06)",
            border: `1px solid ${isPro ? "rgba(245,158,11,0.15)" : "rgba(0,102,255,0.15)"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              {isPro ? <Crown size={11} color="#F59E0B" /> : null}
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: isPro ? "#F59E0B" : "#0066FF",
              }}>
                {isPro ? "PRO" : "BASIC"}
                {planStatus.isTrial ? " · TRIAL" : ""}
              </span>
            </div>
            {planStatus.planExpiresAt && (
              <p style={{ fontSize: 9, color: "#52525B", margin: 0 }}>
                {planStatus.isTrial ? "Teste até " : "Válido até "}
                {new Date(planStatus.planExpiresAt).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* User footer */}
      <div style={{ padding: "12px 10px", borderTop: "1px solid #1A1A1A", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 10px", borderRadius: 10, marginBottom: 4,
        }}>
          {user?.picture ? (
            <img src={user.picture} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "linear-gradient(135deg,#7C3AED,#0066FF)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
            }}>
              {initials}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.name ?? "—"}
            </p>
            <p style={{ fontSize: 10, color: "#52525B", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.email ?? ""}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", borderRadius: 10, width: "100%",
            backgroundColor: "transparent", border: "none",
            color: "#52525B", cursor: "pointer", fontSize: 13,
            fontFamily: "inherit", transition: "all 0.15s",
          }}
        >
          <LogOut size={14} style={{ flexShrink: 0 }} />
          Sair
        </button>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const [isMobile,       setIsMobile]       = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  if (!isMobile) {
    return (
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: 220,
        borderRight: "1px solid #1A1A1A", zIndex: 40, overflowY: "auto",
      }}>
        <SidebarContent />
      </div>
    )
  }

  return (
    <>
      <style>{`@keyframes slideInLeft{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>

      {/* Topbar mobile */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 56, zIndex: 60,
        backgroundColor: "rgba(10,10,10,0.97)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid #1A1A1A",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ForbionLogo size="md" as="div" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <NotificationBell />
          <button
            onClick={() => setMobileMenuOpen(true)}
            style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", padding: 6, display: "flex", alignItems: "center" }}
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", zIndex: 50 }}
        />
      )}

      {/* Drawer */}
      {mobileMenuOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, bottom: 0, width: 260,
          zIndex: 55, borderRight: "1px solid #1A1A1A", overflowY: "auto",
          animation: "slideInLeft 0.3s cubic-bezier(0.16,1,0.3,1)",
        }}>
          <button
            onClick={() => setMobileMenuOpen(false)}
            style={{ position: "absolute", top: 16, right: 16, zIndex: 1, background: "none", border: "none", color: "#71717A", cursor: "pointer", padding: 4 }}
          >
            <X size={18} />
          </button>
          <SidebarContent onItemClick={() => setMobileMenuOpen(false)} />
        </div>
      )}
    </>
  )
}