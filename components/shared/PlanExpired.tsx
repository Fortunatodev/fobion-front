"use client"

import { useState } from "react"
import { AlertTriangle, Crown, MessageCircle, ArrowRight } from "lucide-react"
import type { PlanStatus } from "@/types"
import { apiGet } from "@/lib/api"

/**
 * Full-page "plan expired" screen.
 * Shown when the dashboard is blocked because the plan/trial expired.
 *
 * CTA primário: assinar PRO via CactoPay (link global server-side).
 * CTA secundário: WhatsApp para suporte humano.
 */
export default function PlanExpired({ planStatus }: { planStatus: PlanStatus }) {
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const expiredDate = planStatus.planExpiresAt
    ? new Date(planStatus.planExpiresAt).toLocaleDateString("pt-BR")
    : null

  const planLabel = planStatus.plan === "PRO" ? "Pro" : "Essencial"

  async function handleSubscribe() {
    setRedirecting(true)
    setError(null)
    try {
      const res = await apiGet<{ paymentLink: string }>("/billing/payment-link")
      if (res?.paymentLink) {
        window.location.href = res.paymentLink
        return
      }
      setError("Não foi possível abrir o checkout.")
    } catch (err) {
      setError((err as Error).message || "Erro ao abrir checkout.")
    } finally {
      setRedirecting(false)
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "var(--c-bg)",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: 24,
    }}>
      <div style={{
        maxWidth: 480,
        width: "100%",
        textAlign: "center",
      }}>
        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px",
        }}>
          <AlertTriangle size={32} color="#EF4444" />
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--c-text)", margin: "0 0 12px" }}>
          {planStatus.isTrial
            ? "Seu período de teste terminou"
            : "Seu plano expirou"}
        </h1>

        {/* Subtitle */}
        <p style={{ fontSize: 15, color: "var(--c-text-2)", lineHeight: 1.6, margin: "0 0 32px" }}>
          {planStatus.isTrial ? (
            <>
              Seu teste gratuito do plano <strong style={{ color: "var(--c-text)" }}>{planLabel}</strong>{" "}
              {expiredDate ? <>terminou em <strong style={{ color: "var(--c-text)" }}>{expiredDate}</strong></> : "expirou"}.
              Assine para continuar gerenciando seus agendamentos.
            </>
          ) : (
            <>
              Seu plano <strong style={{ color: "var(--c-text)" }}>{planLabel}</strong>{" "}
              {expiredDate ? <>expirou em <strong style={{ color: "var(--c-text)" }}>{expiredDate}</strong></> : "expirou"}.
              Renove para voltar a usar o dashboard.
            </>
          )}
        </p>

        {/* CTA buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* PRIMARY: assinar PRO via CactoPay */}
          <button
            onClick={handleSubscribe}
            disabled={redirecting}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "14px 24px", borderRadius: 12,
              background: redirecting ? "var(--c-text-4)" : "linear-gradient(135deg,#0066FF,#7C3AED)",
              color: "var(--c-on-primary)", fontSize: 15, fontWeight: 600,
              border: "none", cursor: redirecting ? "wait" : "pointer",
              fontFamily: "inherit",
            }}
          >
            <Crown size={18} />
            {redirecting ? "Abrindo checkout..." : planStatus.isTrial ? "Assinar o Pro" : "Renovar o Pro"}
            <ArrowRight size={16} />
          </button>

          {error && (
            <p style={{ fontSize: 12, color: "#EF4444", margin: 0 }}>{error}</p>
          )}

          {/* SECONDARY: WhatsApp */}
          <a
            href="https://api.whatsapp.com/send/?phone=5547920025084&text=Ol%C3%A1%2C%20gostaria%20de%20renovar%20meu%20plano%20Forbion"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 24px", borderRadius: 12,
              backgroundColor: "var(--c-surface)",
              border: "1px solid var(--c-border)",
              color: "var(--c-text-2)", fontSize: 14, fontWeight: 500,
              textDecoration: "none", transition: "all 0.15s",
            }}
          >
            <MessageCircle size={16} />
            Precisa de ajuda? Fale no WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
