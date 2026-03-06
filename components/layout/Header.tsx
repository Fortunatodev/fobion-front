"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { useUser } from "@/contexts/UserContext"
import { navGroups } from "@/lib/navigation"
import ForbionLogo from "@/components/shared/ForbionLogo"

export default function Header() {
  const router      = useRouter()
  const pathname    = usePathname()
  const { user }    = useUser()
  const [open, setOpen] = useState(false)

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  function getInitials(name: string): string {
    return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join("")
  }

  return (
    <>
      {/*
        .header-mobile:
          display: flex   → mobile
          display: none   → ≥768px
      */}
      <header
        className="header-mobile glass"
        style={{
          position: "fixed",
          top: 0, left: 0, right: 0,
          height: 64,
          zIndex: 50,
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
        }}
      >
        <button
          onClick={() => setOpen(true)}
          style={{
            background: "none", border: "none",
            cursor: "pointer", padding: 8,
            borderRadius: 8, color: "#A1A1AA",
            display: "flex",
          }}
        >
          <Menu size={20} />
        </button>

        <ForbionLogo size="md" as="div" />

        {user ? (
          user.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.picture} alt={user.name} width={32} height={32}
              style={{ borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #0066FF, #7C3AED)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, color: "white", fontWeight: 600,
            }}>
              {getInitials(user.name)}
            </div>
          )
        ) : (
          <div style={{ width: 32, height: 32 }} />
        )}
      </header>

      {/* Drawer overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="animate-fade-in"
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 60,
          }}
        />
      )}

      {/* Drawer panel */}
      {open && (
        <div
          className="animate-slide-in-left"
          style={{
            position: "fixed",
            left: 0, top: 0, bottom: 0,
            width: 280, zIndex: 70,
            backgroundColor: "#111111",
            borderRight: "1px solid #1F1F1F",
            display: "flex", flexDirection: "column",
          }}
        >
          {/* Drawer header */}
          <div style={{
            height: 64, padding: "0 16px",
            borderBottom: "1px solid #1F1F1F",
            display: "flex", alignItems: "center",
            justifyContent: "space-between", flexShrink: 0,
          }}>
            <ForbionLogo size="md" as="div" />
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "none", cursor: "pointer",
                padding: 6, borderRadius: 8,
                color: "#A1A1AA", display: "flex",
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer nav */}
          <nav style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
            {navGroups.map((group, gi) => (
              <div key={gi}>
                {group.label && (
                  <div style={{
                    fontSize: 10, fontWeight: 600, color: "#3F3F46",
                    textTransform: "uppercase", letterSpacing: "1px",
                    paddingLeft: 12, marginBottom: 6,
                    marginTop: gi === 0 ? 0 : 20,
                  }}>
                    {group.label}
                  </div>
                )}
                {group.items.map((item) => {
                  const active = isActive(item.href)
                  const Icon   = item.icon
                  return (
                    <div
                      key={item.href}
                      onClick={() => { setOpen(false); router.push(item.href) }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "11px 12px", borderRadius: 10,
                        cursor: "pointer", marginBottom: 2,
                        backgroundColor: active ? "rgba(0,102,255,0.1)" : "transparent",
                        border: active ? "1px solid rgba(0,102,255,0.2)" : "1px solid transparent",
                      }}
                    >
                      <Icon size={16} color={active ? "#0066FF" : "#71717A"} />
                      <span style={{
                        fontSize: 14, fontWeight: active ? 500 : 400,
                        color: active ? "#0066FF" : "#A1A1AA",
                      }}>
                        {item.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </nav>
        </div>
      )}
    </>
  )
}