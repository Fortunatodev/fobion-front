"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useParams, usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  isCustomerAuthenticated,
  getCustomerPayload,
  removeCustomerToken,
  AUTH_CHANGE_EVENT,
} from "@/lib/customer-auth"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

const NAV_LINKS = (slug: string) => [
  { href: `/${slug}`,          label: "Início"   },
  { href: `/${slug}#servicos`, label: "Serviços" },
  { href: `/${slug}#planos`,   label: "Planos"   },
  { href: `/${slug}#horarios`, label: "Horários" },
]

export default function SlugLayout({ children }: { children: React.ReactNode }) {
  const params   = useParams()
  const router   = useRouter()
  const pathname = usePathname()
  const slug     = params.slug as string

  const [scrolled,       setScrolled]       = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isAuth,         setIsAuth]         = useState(false)
  const [payload,        setPayload]        = useState<ReturnType<typeof getCustomerPayload>>(null)
  const [businessName,   setBusinessName]   = useState("")

  // ── refreshAuth estável ────────────────────────────────────────────────────
  const refreshAuth = useCallback(() => {
    setIsAuth(isCustomerAuthenticated())
    setPayload(getCustomerPayload())
  }, [])

  // Lê estado inicial uma vez na montagem
  useEffect(() => {
    refreshAuth()
  }, [refreshAuth])

  // Escuta evento customizado (mesma aba — login/logout) e outras abas
  useEffect(() => {
    window.addEventListener(AUTH_CHANGE_EVENT, refreshAuth)
    window.addEventListener("storage",         refreshAuth)
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, refreshAuth)
      window.removeEventListener("storage",         refreshAuth)
    }
  }, [refreshAuth])

  // Atualiza quando pathname muda (cobre router.replace do callback)
  useEffect(() => {
    refreshAuth()
  }, [pathname, refreshAuth])

  // Fecha menu ao navegar
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // Scroll handler
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handler, { passive: true })
    return () => window.removeEventListener("scroll", handler)
  }, [])

  // Busca nome do negócio
  useEffect(() => {
    if (!slug) return
    fetch(`${API}/api/public/${slug}`)
      .then((r) => r.json())
      .then((d) => setBusinessName(d?.business?.name || slug))
      .catch(() => setBusinessName(slug))
  }, [slug])

  const handleLogout = useCallback(() => {
    removeCustomerToken()
    // removeCustomerToken já dispara AUTH_CHANGE_EVENT
    router.push(`/${slug}`)
  }, [router, slug])

  const links = NAV_LINKS(slug)

  const initials = payload?.name
    ? payload.name.split(" ").filter(Boolean).slice(0, 2).map((n: string) => n[0].toUpperCase()).join("")
    : "?"

  return (
    <React.Fragment>
      <style>{`
        @keyframes pulseGreen {
          0%,100% { opacity:1; transform:scale(1); box-shadow:0 0 8px rgba(16,185,129,.6); }
          50%      { opacity:.8; transform:scale(1.2); box-shadow:0 0 16px rgba(16,185,129,.8); }
        }
        @keyframes sp { to { transform:rotate(360deg); } }
        @keyframes mobileMenuIn {
          from { opacity:0; transform:translateY(-8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background:#0A0A0A; }
        ::-webkit-scrollbar-thumb { background:#2F2F2F; border-radius:3px; }
      `}</style>

      <div style={{ minHeight: "100vh", backgroundColor: "#0A0A0A", fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif" }}>

        {/* ── NAVBAR ── */}
        <nav style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
          transition: "background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
          backgroundColor: scrolled ? "rgba(10,10,10,0.95)" : "transparent",
          backdropFilter:  scrolled ? "blur(24px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(24px)" : "none",
          borderBottom:    scrolled ? "1px solid rgba(255,255,255,0.07)" : "1px solid transparent",
          boxShadow:       scrolled ? "0 1px 40px rgba(0,0,0,0.4)" : "none",
        }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", height: 64, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>

            {/* Logo */}
            <div
              onClick={() => router.push(`/${slug}`)}
              style={{ cursor: "pointer", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#0066FF,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>F</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>
                {businessName || slug}
              </span>
            </div>

            {/* Links desktop */}
            <div style={{ display: "flex", gap: 2, flex: 1, justifyContent: "center" }}>
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  style={{ height: 36, padding: "0 14px", borderRadius: 8, display: "flex", alignItems: "center", fontSize: 13, fontWeight: 500, color: "#A1A1AA", textDecoration: "none", transition: "color 0.15s ease, background 0.15s ease", whiteSpace: "nowrap" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.05)" }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#A1A1AA"; e.currentTarget.style.background = "transparent" }}
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Auth actions */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              {isAuth && payload ? (
                <>
                  <button
                    onClick={() => router.push(`/${slug}/cliente`)}
                    style={{ display: "flex", gap: 8, alignItems: "center", height: 36, padding: "0 12px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s ease", fontFamily: "inherit" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.09)" }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)" }}
                  >
                    {payload.picture ? (
                      <img src={payload.picture} alt={payload.name} width={22} height={22} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg,#0066FF,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
                        {initials}
                      </div>
                    )}
                    <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {payload.name?.split(" ")[0]}
                    </span>
                  </button>
                  <button
                    onClick={handleLogout}
                    style={{ height: 36, padding: "0 12px", borderRadius: 10, background: "transparent", border: "1px solid #1F1F1F", color: "#71717A", fontSize: 12, cursor: "pointer", transition: "all 0.15s ease", fontFamily: "inherit" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)" }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#71717A"; e.currentTarget.style.borderColor = "#1F1F1F" }}
                  >
                    Sair
                  </button>
                </>
              ) : (
                <button
                  onClick={() => router.push(`/${slug}/login`)}
                  style={{ height: 36, padding: "0 16px", borderRadius: 10, background: "linear-gradient(135deg,#0066FF,#7C3AED)", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", transition: "opacity 0.15s ease", fontFamily: "inherit" }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85" }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "1" }}
                >
                  Entrar
                </button>
              )}

              {/* Burger mobile */}
              <button
                onClick={() => setMobileMenuOpen((v) => !v)}
                style={{ display: "none", width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#A1A1AA", cursor: "pointer", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                className="slug-burger"
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{mobileMenuOpen ? "✕" : "☰"}</span>
              </button>
            </div>
          </div>
        </nav>

        {/* ── MENU MOBILE ── */}
        {mobileMenuOpen && (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 40,
              backgroundColor: "rgba(10,10,10,0.98)",
              backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
              display: "flex", flexDirection: "column",
              fontFamily: "inherit",
              animation: "mobileMenuIn 0.2s ease",
              paddingTop: 80,
            }}
          >
            <nav style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 24px" }}>
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ height: 52, display: "flex", alignItems: "center", fontSize: 16, fontWeight: 500, color: "#fff", textDecoration: "none", borderBottom: "1px solid #111111" }}
                >
                  {link.label}
                </a>
              ))}
              <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                {isAuth ? (
                  <>
                    <button
                      onClick={() => { setMobileMenuOpen(false); router.push(`/${slug}/cliente`) }}
                      style={{ height: 48, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Minha conta
                    </button>
                    <button
                      onClick={() => { setMobileMenuOpen(false); handleLogout() }}
                      style={{ height: 48, borderRadius: 12, background: "transparent", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Sair
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setMobileMenuOpen(false); router.push(`/${slug}/login`) }}
                    style={{ height: 48, borderRadius: 12, background: "linear-gradient(135deg,#0066FF,#7C3AED)", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Entrar com Google
                  </button>
                )}
              </div>
            </nav>
          </div>
        )}

        <style>{`
          @media (max-width: 767px) {
            .slug-burger { display: flex !important; }
          }
        `}</style>

        <div style={{ paddingTop: 64 }}>
          {children}
        </div>
      </div>
    </React.Fragment>
  )
}
