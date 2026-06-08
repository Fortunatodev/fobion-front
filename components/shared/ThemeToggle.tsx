"use client"

import { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"

/**
 * Toggle de tema claro/escuro. Lê/escreve data-theme no <html> e persiste em
 * localStorage (forbion_theme). O anti-flash no root layout aplica antes da pintura.
 */
type Theme = "dark" | "light"

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as Theme) || "dark"
    // sincroniza o ícone com o tema já aplicado pelo anti-flash (leitura única no mount)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(current)
  }, [])

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark"
    setTheme(next)
    if (next === "light") document.documentElement.setAttribute("data-theme", "light")
    else document.documentElement.removeAttribute("data-theme")
    try { localStorage.setItem("forbion_theme", next) } catch { /* ignore */ }
  }

  const Icon = theme === "dark" ? Sun : Moon
  const labelText = theme === "dark" ? "Tema claro" : "Tema escuro"

  if (compact) {
    return (
      <button onClick={toggle} aria-label={labelText} title={labelText}
        style={{ width: 36, height: 36, borderRadius: 9, background: "transparent", border: "1px solid var(--c-border)", color: "var(--c-text-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} />
      </button>
    )
  }

  return (
    <button onClick={toggle} aria-label={labelText}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, width: "100%", backgroundColor: "transparent", border: "none", color: "var(--c-text-3)", cursor: "pointer", fontSize: 13, fontFamily: "inherit", transition: "all 0.15s" }}>
      <Icon size={14} style={{ flexShrink: 0 }} />
      {labelText}
    </button>
  )
}
