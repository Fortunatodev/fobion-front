"use client"

import { Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { RotateCcw, ShieldCheck, Users } from "lucide-react"
import { useUser } from "@/contexts/UserContext"
import ProFeatureGate from "@/components/shared/ProFeatureGate"
import RecallsPanel from "@/components/dashboard/RecallsPanel"
import RetencaoPanel from "@/components/dashboard/RetencaoPanel"

/**
 * Tab Pós-venda — reúne as ferramentas de recompra/retenção que antes viviam
 * dentro de Relatórios. Duas sub-abas: "Garantia & Recall" (motor de recompra)
 * e "Retenção (RFM)". Feature Pro (gate igual a Relatórios).
 */

type Tab = "garantia" | "retencao"

const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: "garantia", label: "Garantia & Recall", icon: <ShieldCheck size={15} /> },
  { value: "retencao", label: "Retenção (RFM)",    icon: <Users size={15} /> },
]

function PosVendaContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  // A URL é a fonte da verdade da sub-aba: links com ?tab=... abrem direto na aba
  // certa e o botão volta/avança do navegador funciona sem estado duplicado.
  const tab: Tab = searchParams.get("tab") === "retencao" ? "retencao" : "garantia"

  function selectTab(next: Tab) {
    router.replace(`/dashboard/pos-venda?tab=${next}`, { scroll: false })
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <RotateCcw size={20} color="#0066FF" />
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>Pós-venda</h1>
      </div>
      <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "0 0 20px" }}>
        Traga o cliente de volta: garantias a vencer e clientes que sumiram, com retorno em 1 toque no WhatsApp.
      </p>

      {/* Sub-abas */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--c-border)", marginBottom: 24 }}>
        {TABS.map((t) => {
          const active = tab === t.value
          return (
            <button
              key={t.value}
              onClick={() => selectTab(t.value)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                height: 40, padding: "0 14px",
                background: "none", border: "none",
                borderBottom: `2px solid ${active ? "#0066FF" : "transparent"}`,
                color: active ? "var(--c-text)" : "var(--c-text-3)",
                fontSize: 13, fontWeight: active ? 600 : 500,
                cursor: "pointer", fontFamily: "inherit",
                marginBottom: -1, transition: "color 0.15s, border-color 0.15s",
              }}
            >
              <span style={{ color: active ? "#0066FF" : "var(--c-text-4)", display: "flex" }}>{t.icon}</span>
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === "garantia" ? <RecallsPanel /> : <RetencaoPanel />}
    </div>
  )
}

export default function PosVendaPage() {
  const { planStatus } = useUser()

  // Gate de tier: espelha relatorios/page.tsx (trata null como não-PRO)
  if (!planStatus || planStatus.plan !== "PRO") {
    return (
      <ProFeatureGate
        featureName="Pós-venda"
        description="Motor de recompra: garantias perto de vencer e clientes a recuperar (RFM), com retorno em 1 toque no WhatsApp."
      />
    )
  }

  return (
    <Suspense fallback={null}>
      <PosVendaContent />
    </Suspense>
  )
}
