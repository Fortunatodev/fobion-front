"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { apiGet } from "@/lib/api"
import { ShieldCheck, Users, ArrowRight, CircleDollarSign } from "lucide-react"

/**
 * V2-B3 — "Ações de receita" no dashboard: surfacia o dinheiro a perseguir HOJE
 * (retornos/garantias a cobrar + clientes a recuperar + receita em risco),
 * cada um com 1 toque pra tela de ação. Some se não houver nada.
 * Lê /services/recalls e /analytics/retencao (PRO). Falha silenciosa → não mostra.
 */
const fmt = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

// Componente em escopo de módulo (não dentro do render) — usa Link pra navegação.
function ActionCard({ icon, color, title, sub, href }: { icon: React.ReactNode; color: string; title: string; sub: string; href: string }) {
  return (
    <Link
      href={href}
      style={{
        flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 12,
        background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14,
        padding: "14px 16px", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        transition: "border-color 0.15s", textDecoration: "none",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = color)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--c-border)")}
    >
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}1A`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>{title}</p>
        <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "2px 0 0" }}>{sub}</p>
      </div>
      <ArrowRight size={16} color={color} style={{ flexShrink: 0 }} />
    </Link>
  )
}

export default function RevenueActionsCard() {
  const [recalls, setRecalls] = useState<number | null>(null)
  const [recuperaveis, setRecuperaveis] = useState<number | null>(null)
  const [risco, setRisco] = useState(0)

  useEffect(() => {
    apiGet<{ recalls: unknown[] }>("/services/recalls")
      .then((r) => setRecalls(Array.isArray(r.recalls) ? r.recalls.length : 0))
      .catch(() => setRecalls(0))
    apiGet<{ recuperaveis: unknown[]; receitaEmRisco: number }>("/analytics/retencao")
      .then((r) => { setRecuperaveis(Array.isArray(r.recuperaveis) ? r.recuperaveis.length : 0); setRisco(r.receitaEmRisco ?? 0) })
      .catch(() => setRecuperaveis(0))
  }, [])

  // ainda carregando, ou nada a fazer → não polui o dashboard
  if (recalls === null || recuperaveis === null) return null
  if (recalls === 0 && recuperaveis === 0) return null

  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 10px" }}>
        <CircleDollarSign size={13} /> Ações de receita
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {recalls > 0 && (
          <ActionCard
            icon={<ShieldCheck size={19} />} color="#10B981"
            title={`${recalls} retorno${recalls !== 1 ? "s" : ""} a cobrar`}
            sub="Garantias vencendo — chame no WhatsApp"
            href="/dashboard/relatorios/recalls"
          />
        )}
        {recuperaveis > 0 && (
          <ActionCard
            icon={<Users size={19} />} color="#F59E0B"
            title={`${recuperaveis} cliente${recuperaveis !== 1 ? "s" : ""} a recuperar`}
            sub={`${fmt(risco)} de receita em risco`}
            href="/dashboard/relatorios/retencao"
          />
        )}
      </div>
    </div>
  )
}
