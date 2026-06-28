"use client"

import { Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { BellRing, Heart, MessageCircle, ShieldCheck, Users } from "lucide-react"
import RelationshipQueue from "@/components/dashboard/RelationshipQueue"
import RecallsPanel from "@/components/dashboard/RecallsPanel"
import RetencaoPanel from "@/components/dashboard/RetencaoPanel"
import TabTutorial from "@/components/shared/TabTutorial"
import { useUser } from "@/contexts/UserContext"
import ProFeatureGate from "@/components/shared/ProFeatureGate"

/**
 * Aba Pós-venda (Relacionamento) — CRM do dono: fila do dia, garantia/recall, retenção (RFM).
 * Feature PRO (decisão do dono). 3 sub-abas; a URL (?aba=) é a fonte da verdade.
 */

type Aba = "hoje" | "garantia" | "retencao"

const ABAS: { value: Aba; label: string; icon: React.ReactNode }[] = [
  { value: "hoje",     label: "Pra cuidar hoje", icon: <Heart size={15} /> },
  { value: "garantia", label: "Garantia & Recall", icon: <ShieldCheck size={15} /> },
  { value: "retencao", label: "Retenção (RFM)", icon: <Users size={15} /> },
]

function RelacionamentoContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const raw = searchParams.get("aba")
  const aba: Aba = raw === "garantia" ? "garantia" : raw === "retencao" ? "retencao" : "hoje"

  function selectAba(next: Aba) {
    router.replace(`/dashboard/relacionamento?aba=${next}`, { scroll: false })
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Heart size={20} color="#EC4899" />
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>Pós-venda</h1>
      </div>
      <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "0 0 20px" }}>
        Cuide dos seus clientes: quem chamar hoje, retornos a vencer e quem sumiu — com mensagem pronta no WhatsApp.
      </p>

      <TabTutorial
        tabKey="relacionamento"
        title="Como usar o Pós-venda"
        subtitle="Quem chamar hoje, em 1 toque"
        steps={[
          { icon: Users, title: "1. Sua fila de clientes", text: "Reunimos quem precisa de atenção hoje: retornos vencendo, clientes que sumiram e pós-serviço sem avaliação." },
          { icon: MessageCircle, title: "2. Chame no WhatsApp", text: "Cada cliente tem um botão de WhatsApp com mensagem pronta. Escolha um modelo, ajuste o texto e envie." },
          { icon: BellRing, title: "3. Marque follow-ups", text: "Precisa lembrar de falar com alguém depois? Crie um follow-up com data — a gente te lembra no dia certo." },
        ]}
      />

      {/* Sub-abas */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--c-border)", marginBottom: 24, overflowX: "auto" }}>
        {ABAS.map((t) => {
          const active = aba === t.value
          return (
            <button
              key={t.value}
              onClick={() => selectAba(t.value)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                height: 40, padding: "0 14px", whiteSpace: "nowrap",
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

      {aba === "hoje" ? <RelationshipQueue /> : aba === "garantia" ? <RecallsPanel /> : <RetencaoPanel />}
    </div>
  )
}

export default function RelacionamentoPage() {
  const { planStatus } = useUser()
  // Pós-venda é PRO. Essencial vê o convite de upgrade (e o backend /crm/* também barra).
  if (planStatus?.plan !== "PRO") {
    return (
      <ProFeatureGate
        featureName="Pós-venda"
        description="Traga o cliente de volta: fila do dia, recall de garantia e retenção (RFM). Disponível no plano Pro."
      />
    )
  }
  return (
    <Suspense fallback={null}>
      <RelacionamentoContent />
    </Suspense>
  )
}
