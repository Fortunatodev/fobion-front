"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, ArrowRight, X } from "lucide-react"
import { useUser } from "@/contexts/UserContext"

/**
 * Banner de contagem regressiva do teste grátis. Aparece no topo do dashboard
 * enquanto o negócio está em trial — cria urgência amigável pra virar assinante.
 *
 * Dispensável POR DIA: ao fechar, some até o dia seguinte (localStorage com a
 * data). Some sozinho quando o plano deixa de ser trial. Cor escala com a pressa:
 * verde tranquilo → amarelo (≤3 dias) → vermelho (último dia).
 */
// Dias restantes no FUSO LOCAL do dono (não UTC) — senão à noite no Brasil o
// banner mostra 1 dia a mais e some cedo. Compara só a parte de data local.
function daysLeft(iso: string): number {
  const t = new Date(iso)
  const n = new Date()
  const ms = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
           - new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()
  return Math.round(ms / 86_400_000)
}

// Chave do "dispensado hoje" em data LOCAL (consistente com daysLeft).
function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function TrialCountdownBanner() {
  const { user, planStatus } = useUser()
  const router = useRouter()
  const [dismissedToday, setDismissedToday] = useState(false)

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem("forbion_trial_banner_dismissed") === todayKey()) setDismissedToday(true)
    } catch { /* ignore */ }
  }, [])

  // Só o dono/admin decide assinar — funcionário não vê banner de cobrança (o CTA
  // levaria a uma tela que não é dele). Bug P2.11.
  const isManager = user?.role === "OWNER" || user?.role === "ADMIN"
  if (!isManager) return null
  if (!planStatus?.isTrial || !planStatus.planExpiresAt || planStatus.isExpired) return null
  if (dismissedToday) return null

  const dias = daysLeft(planStatus.planExpiresAt)
  if (dias < 0) return null

  const urgente = dias <= 1
  const chegando = dias <= 3
  const color = urgente ? "#EF4444" : chegando ? "#F59E0B" : "#0066FF"
  const label =
    dias === 0 ? "Seu teste grátis termina hoje" :
    dias === 1 ? "Seu teste grátis termina amanhã" :
    `Seu teste grátis termina em ${dias} dias`

  function dismiss() {
    setDismissedToday(true)
    try { localStorage.setItem("forbion_trial_banner_dismissed", todayKey()) } catch { /* ignore */ }
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, marginBottom: 18,
      padding: "12px 16px", borderRadius: 14,
      background: `linear-gradient(135deg, ${color}1A, ${color}0D)`,
      border: `1px solid ${color}40`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: `${color}26`, border: `1px solid ${color}40`,
        display: "flex", alignItems: "center", justifyContent: "center", color,
      }}>
        <Sparkles size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>{label}</p>
        <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "2px 0 0" }}>
          Assine pra não perder seus dados, agendamentos e clientes cadastrados.
        </p>
      </div>
      <button
        onClick={() => router.push("/dashboard/planos")}
        style={{
          display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: 10,
          background: `linear-gradient(135deg, ${color}, ${color}CC)`, border: "none", color: "#fff",
          fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0,
        }}
      >
        Ver planos <ArrowRight size={14} />
      </button>
      <button
        onClick={dismiss}
        title="Fechar por hoje"
        style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: "transparent", border: "1px solid var(--c-border-2)", color: "var(--c-text-4)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <X size={15} />
      </button>
    </div>
  )
}
