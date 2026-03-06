"use client"

import Link from "next/link"
import { AlertTriangle, Crown, MessageCircle } from "lucide-react"
import type { PlanStatus } from "@/types"

/**
 * Full-page "plan expired" screen.
 * Shown when the dashboard is blocked because the plan/trial expired.
 */
export default function PlanExpired({ planStatus }: { planStatus: PlanStatus }) {
  const expiredDate = planStatus.planExpiresAt
    ? new Date(planStatus.planExpiresAt).toLocaleDateString("pt-BR")
    : null

  const planLabel = planStatus.plan === "PRO" ? "PRO" : "Basic"

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0A0A0A",
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
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 12px" }}>
          {planStatus.isTrial
            ? "Seu período de teste terminou"
            : "Seu plano expirou"}
        </h1>

        {/* Subtitle */}
        <p style={{ fontSize: 15, color: "#A1A1AA", lineHeight: 1.6, margin: "0 0 32px" }}>
          {planStatus.isTrial ? (
            <>
              Seu teste gratuito do plano <strong style={{ color: "#fff" }}>{planLabel}</strong>{" "}
              {expiredDate ? <>terminou em <strong style={{ color: "#fff" }}>{expiredDate}</strong></> : "expirou"}.
              Para continuar usando o dashboard, assine um plano.
            </>
          ) : (
            <>
              Seu plano <strong style={{ color: "#fff" }}>{planLabel}</strong>{" "}
              {expiredDate ? <>expirou em <strong style={{ color: "#fff" }}>{expiredDate}</strong></> : "expirou"}.
              Renove para continuar usando o dashboard.
            </>
          )}
        </p>

        {/* CTA buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <a
            href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20gostaria%20de%20renovar%20meu%20plano%20Forbion"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "14px 24px", borderRadius: 12,
              background: "linear-gradient(135deg,#0066FF,#7C3AED)",
              color: "#fff", fontSize: 15, fontWeight: 600,
              textDecoration: "none", transition: "opacity 0.15s",
            }}
          >
            <MessageCircle size={18} />
            Falar com suporte
          </a>

          <Link
            href="/dashboard/configuracoes?tab=plano"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "14px 24px", borderRadius: 12,
              backgroundColor: "#111113",
              border: "1px solid #1F1F1F",
              color: "#A1A1AA", fontSize: 14, fontWeight: 500,
              textDecoration: "none", transition: "all 0.15s",
            }}
          >
            <Crown size={16} />
            Ver planos
          </Link>
        </div>
      </div>
    </div>
  )
}
