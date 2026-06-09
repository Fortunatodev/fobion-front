"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet } from "@/lib/api"
import { useUser } from "@/contexts/UserContext"
import ProFeatureGate from "@/components/shared/ProFeatureGate"
import { ArrowLeft, ShieldCheck, MessageCircle, Calendar, AlertCircle, RefreshCw } from "lucide-react"

/**
 * V2-B3 — Recalls / Garantias (motor de recompra). Lista as garantias PENDENTES
 * (geradas ao fechar comandas de serviços com warrantyDays) ordenadas por quando
 * avisar. 1 toque pro WhatsApp com mensagem de retorno. Ref: ClickLava.
 */
interface Recall {
  id: string; serviceName: string; plate: string | null
  dueDate: string; notifyDate: string; status: string
  customerName: string | null; customerPhone: string | null
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function waLink(phone: string | null, name: string | null, service: string, dueDays: number): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 10) return null
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`
  const venc = dueDays <= 0 ? "venceu" : `vence em ${dueDays} dias`
  const msg = encodeURIComponent(`Olá${name ? `, ${name.split(" ")[0]}` : ""}! A garantia do(a) ${service} do seu carro ${venc}. Que tal agendar o retorno pra manter a proteção em dia? 🚗✨`)
  return `https://wa.me/${withCountry}?text=${msg}`
}

export default function RecallsPage() {
  const router = useRouter()
  const { planStatus } = useUser()
  const [recalls, setRecalls] = useState<Recall[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(() => {
    setLoading(true)
    setError("")
    apiGet<{ recalls: Recall[] }>("/services/recalls")
      .then((r) => setRecalls(r.recalls ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar recalls."))
      .finally(() => setLoading(false))
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  // Gate de tier: espelha relatorios/page.tsx (trata null como não-PRO)
  if (!planStatus || planStatus.plan !== "PRO") {
    return (
      <ProFeatureGate
        featureName="Retornos & Garantias"
        description="Motor de recompra: serviços com garantia perto de vencer e retorno em 1 toque no WhatsApp."
      />
    )
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px 48px" }}>
      <button onClick={() => router.push("/dashboard/relatorios")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--c-text-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 14 }}>
        <ArrowLeft size={15} /> Relatórios
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <ShieldCheck size={20} color="#10B981" />
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>Retornos & Garantias</h1>
      </div>
      <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "0 0 24px" }}>Serviços com garantia perto de vencer — chame o cliente pra reagendar e fature de novo.</p>

      {loading && (
        <>
          <style>{`@keyframes recSkel{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 64, backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 12, animation: `recSkel 1.5s ease ${i * 0.1}s infinite` }} />
            ))}
          </div>
        </>
      )}
      {!loading && error && (
        <div style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <AlertCircle size={14} color="#EF4444" />
          <span style={{ fontSize: 13, color: "#EF4444" }}>{error}</span>
          <button onClick={load} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 8, background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <RefreshCw size={13} /> Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && recalls.length === 0 && (
        <div style={{ textAlign: "center", padding: "56px 0" }}>
          <Calendar size={40} color="var(--c-border-2)" style={{ margin: "0 auto" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--c-text)", marginTop: 14 }}>Nenhum retorno pendente</p>
          <p style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 6 }}>
            Defina a {"“garantia (dias)”"} nos seus serviços (ex.: vitrificação 180). Ao fechar a comanda,
            os retornos aparecem aqui automaticamente.
          </p>
        </div>
      )}

      {!loading && !error && recalls.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recalls.map((r) => {
            const d = daysUntil(r.dueDate)
            const overdue = d <= 0
            const soon = !overdue && d <= 14
            const color = overdue ? "#EF4444" : soon ? "#F59E0B" : "#10B981"
            const link = waLink(r.customerPhone, r.customerName, r.serviceName, d)
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "12px 16px" }}>
                <div style={{ width: 4, height: 36, borderRadius: 2, background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>{r.serviceName}</span>
                    {r.plate && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-2)", backgroundColor: "var(--c-border)", borderRadius: 5, padding: "1px 7px" }}>{r.plate}</span>}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "2px 0 0" }}>
                    {r.customerName ?? "Cliente"} · garantia {overdue ? `venceu há ${Math.abs(d)} dias` : `vence em ${d} dias`}
                  </p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color, flexShrink: 0 }}>
                  {overdue ? "Vencida" : soon ? "Vence em breve" : "No prazo"}
                </span>
                {link ? (
                  <a href={link} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px", borderRadius: 9, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#10B981", fontSize: 12, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
                    <MessageCircle size={14} /> Reagendar
                  </a>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--c-text-4)", flexShrink: 0 }}>sem telefone</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
