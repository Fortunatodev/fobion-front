"use client"

import Link from "next/link"
import { useState } from "react"
import { Crown, Lock, ArrowRight } from "lucide-react"
import { apiGet } from "@/lib/api"

/**
 * Component shown in place of a Pro-only feature when the user is on the BASIC plan.
 * Use this as a wrapper around pages like Relatórios, Planos, Assinantes, Pós-venda.
 *
 * O tier vendável hoje é o **Pro**. O CTA primário abre o checkout do Pro
 * (mesmo link usado nas telas de billing: /billing/payment-link). Se o link não
 * carregar, cai pra aba de plano em Configurações.
 */
export default function ProFeatureGate({
  featureName,
  description,
}: {
  featureName: string
  description?: string
}) {
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setError((err as Error).message || "Erro ao abrir o checkout.")
    } finally {
      setRedirecting(false)
    }
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "calc(100vh - 120px)",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <div style={{
        maxWidth: 440,
        width: "100%",
        textAlign: "center",
        padding: 24,
      }}>
        {/* Icon */}
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "rgba(0,102,255,0.1)",
          border: "1px solid rgba(0,102,255,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
        }}>
          <Lock size={28} color="#0066FF" />
        </div>

        {/* Title */}
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--c-text)", margin: "0 0 8px" }}>
          Recurso do plano Pro
        </h2>

        {/* Feature name */}
        <p style={{ fontSize: 15, color: "var(--c-text-2)", margin: "0 0 8px" }}>
          <strong style={{ color: "var(--c-text)" }}>{featureName}</strong> faz parte do plano{" "}
          <span style={{
            color: "#0066FF",
            fontWeight: 600,
            background: "rgba(0,102,255,0.1)",
            borderRadius: 4,
            padding: "1px 6px",
          }}>
            <Crown size={12} style={{ display: "inline", verticalAlign: "-1px", marginRight: 3 }} />
            PRO
          </span>
        </p>

        {description && (
          <p style={{ fontSize: 13, color: "var(--c-text-3)", lineHeight: 1.6, margin: "0 0 24px" }}>
            {description}
          </p>
        )}

        {!description && <div style={{ height: 16 }} />}

        {/* CTA */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={handleSubscribe}
            disabled={redirecting}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 20px", borderRadius: 10,
              background: redirecting ? "var(--c-text-4)" : "linear-gradient(135deg, #0066FF, #7C3AED)",
              color: "var(--c-on-primary)", fontSize: 14, fontWeight: 600,
              border: "none", cursor: redirecting ? "wait" : "pointer",
              fontFamily: "inherit", transition: "opacity 0.15s",
            }}
          >
            <Crown size={16} />
            {redirecting ? "Abrindo checkout..." : "Assinar o Pro"}
            <ArrowRight size={15} />
          </button>

          {error && (
            <p style={{ fontSize: 12, color: "#EF4444", margin: 0 }}>{error}</p>
          )}

          <Link
            href="/dashboard/configuracoes?tab=plano"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "10px 20px", borderRadius: 10,
              backgroundColor: "transparent",
              border: "1px solid var(--c-border)",
              color: "var(--c-text-3)", fontSize: 13, fontWeight: 500,
              textDecoration: "none", transition: "all 0.15s",
            }}
          >
            <Crown size={14} />
            Ver comparação de planos
          </Link>
        </div>
      </div>
    </div>
  )
}
