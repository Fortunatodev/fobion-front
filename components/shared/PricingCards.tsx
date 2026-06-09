"use client"

import { useEffect, useState } from "react"
import { apiGet } from "@/lib/api"
import { Check, Crown, Loader2 } from "lucide-react"

/**
 * Cartões dos 3 tiers do SaaS (Essencial/Premium/Pro), lendo /billing/tiers.
 * Cada card → botão "Assinar" que abre o checkout do Cakto (link com ?ref).
 * Tier sem link configurado cai pra "Fale com a gente". Tema-aware (var(--c-*)).
 */
interface Tier {
  id: string
  name: string
  priceCents: number
  tagline: string
  highlights: string[]
  recommended?: boolean
  comingSoon?: boolean
  checkoutUrl: string | null
}

const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export default function PricingCards({ currentTier }: { currentTier?: string | null }) {
  const [tiers, setTiers] = useState<Tier[] | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    apiGet<{ tiers: Tier[] }>("/billing/tiers")
      .then((r) => setTiers(r.tiers ?? []))
      .catch(() => setErr(true))
  }, [])

  if (err) return <p style={{ fontSize: 13, color: "var(--c-text-3)" }}>Não foi possível carregar os planos. Tente de novo.</p>
  if (!tiers) return <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><Loader2 size={20} className="animate-spin" color="var(--c-text-3)" /></div>

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 14 }}>
      {tiers.map((t) => {
        const isCurrent = !!currentTier && currentTier === t.id
        const accent = t.recommended ? "#0066FF" : "var(--c-border)"
        return (
          <div key={t.id} style={{
            position: "relative", display: "flex", flexDirection: "column",
            background: "var(--c-surface)", borderRadius: 16, padding: 20,
            border: `1.5px solid ${t.recommended ? "rgba(0,102,255,0.5)" : "var(--c-border)"}`,
            opacity: t.comingSoon ? 0.72 : 1,
          }}>
            {t.recommended && (
              <span style={{ position: "absolute", top: -10, left: 20, fontSize: 10, fontWeight: 800, color: "var(--c-on-primary)", background: "linear-gradient(135deg,#0066FF,#7C3AED)", borderRadius: 6, padding: "3px 9px", letterSpacing: "0.04em" }}>MAIS ESCOLHIDO</span>
            )}
            {t.comingSoon && (
              <span style={{ position: "absolute", top: -10, left: 20, fontSize: 10, fontWeight: 800, color: "#F59E0B", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, padding: "3px 9px", letterSpacing: "0.04em" }}>EM BREVE</span>
            )}
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>{t.name}</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "8px 0 2px" }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: "var(--c-text)", letterSpacing: "-1px" }}>{fmt(t.priceCents)}</span>
              <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>/mês</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "0 0 14px", minHeight: 32 }}>{t.tagline}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18, flex: 1 }}>
              {t.highlights.map((h, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                  <Check size={14} color={t.recommended ? "#0066FF" : "#10B981"} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 12.5, color: "var(--c-text-2)", lineHeight: 1.45 }}>{h}</span>
                </div>
              ))}
            </div>
            {t.comingSoon ? (
              <div style={{ height: 42, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#F59E0B", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
                Em breve
              </div>
            ) : isCurrent ? (
              <div style={{ height: 42, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#10B981", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}>
                <Crown size={14} /> Seu plano atual
              </div>
            ) : t.checkoutUrl ? (
              <a href={t.checkoutUrl} target="_blank" rel="noopener noreferrer" style={{
                height: 42, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, textDecoration: "none",
                color: t.recommended ? "var(--c-on-primary)" : "var(--c-text)",
                background: t.recommended ? "linear-gradient(135deg,#0066FF,#7C3AED)" : "transparent",
                border: t.recommended ? "none" : `1px solid ${accent}`,
              }}>
                Assinar {t.name}
              </a>
            ) : (
              <div style={{ height: 42, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "var(--c-text-3)", border: "1px solid var(--c-border)" }}>
                Fale com a gente
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
