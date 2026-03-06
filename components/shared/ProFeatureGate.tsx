"use client"

import Link from "next/link"
import { Crown, Lock, MessageCircle } from "lucide-react"

/**
 * Component shown in place of a PRO-only feature when user is on BASIC plan.
 * Use this as a wrapper around pages like Relatórios, Planos, Assinantes.
 */
export default function ProFeatureGate({
  featureName,
  description,
}: {
  featureName: string
  description?: string
}) {
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
          background: "rgba(245,158,11,0.1)",
          border: "1px solid rgba(245,158,11,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
        }}>
          <Lock size={28} color="#F59E0B" />
        </div>

        {/* Title */}
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
          Recurso PRO
        </h2>

        {/* Feature name */}
        <p style={{ fontSize: 15, color: "#A1A1AA", margin: "0 0 8px" }}>
          <strong style={{ color: "#fff" }}>{featureName}</strong> faz parte do plano{" "}
          <span style={{
            color: "#F59E0B",
            fontWeight: 600,
            background: "rgba(245,158,11,0.1)",
            borderRadius: 4,
            padding: "1px 6px",
          }}>
            <Crown size={12} style={{ display: "inline", verticalAlign: "-1px", marginRight: 3 }} />
            PRO
          </span>
        </p>

        {description && (
          <p style={{ fontSize: 13, color: "#71717A", lineHeight: 1.6, margin: "0 0 24px" }}>
            {description}
          </p>
        )}

        {!description && <div style={{ height: 16 }} />}

        {/* CTA */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <a
            href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20gostaria%20de%20conhecer%20o%20plano%20PRO%20do%20Forbion"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 20px", borderRadius: 10,
              background: "linear-gradient(135deg, #F59E0B, #D97706)",
              color: "#fff", fontSize: 14, fontWeight: 600,
              textDecoration: "none", transition: "opacity 0.15s",
            }}
          >
            <MessageCircle size={16} />
            Falar com suporte sobre o PRO
          </a>

          <Link
            href="/dashboard/configuracoes?tab=plano"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "10px 20px", borderRadius: 10,
              backgroundColor: "transparent",
              border: "1px solid #1F1F1F",
              color: "#71717A", fontSize: 13, fontWeight: 500,
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
