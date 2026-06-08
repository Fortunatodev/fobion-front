"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet } from "@/lib/api"
import { ArrowLeft, AlertTriangle, Users, Crown, Repeat, UserPlus, Clock, MessageCircle } from "lucide-react"

/**
 * V2-B3 — Painel de Retenção (RFM). Referência: WashAI.
 * Segmenta clientes por recência/frequência, mostra "receita em risco" e a lista
 * de clientes a recuperar com 1 toque pro WhatsApp. Dados de /analytics/retencao.
 */

interface Recuperavel {
  customerId: string; name: string; phone: string | null
  lastVisitDays: number; visits: number; totalSpent: number; avgTicket: number; bucket: string
}
interface RetencaoData {
  totalClientesComVisita: number
  recency: { ativos: number; inativos: number; perdidos: number }
  frequency: { novos: number; recorrentes: number; vip: number }
  receitaEmRisco: number
  recuperaveis: Recuperavel[]
}

const fmt = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

function waLink(phone: string | null, name: string) {
  if (!phone) return null
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 10) return null
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`
  const msg = encodeURIComponent(`Olá, ${name.split(" ")[0]}! Sentimos sua falta aqui. Que tal agendar um cuidado pro seu carro? Temos um horário pra você. 🚗✨`)
  return `https://wa.me/${withCountry}?text=${msg}`
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={{ backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 12, color: "var(--c-text-2)", fontWeight: 500 }}>{label}</span>
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color: "var(--c-text)", margin: 0 }}>{value}</p>
    </div>
  )
}

const BUCKET_LABEL: Record<string, { label: string; color: string }> = {
  perdido: { label: "Perdido", color: "#EF4444" },
  inativo: { label: "Inativo", color: "#F59E0B" },
}

export default function RetencaoPage() {
  const router = useRouter()
  const [data, setData] = useState<RetencaoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    apiGet<RetencaoData>("/analytics/retencao")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar retenção."))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 48px" }}>
      <button onClick={() => router.push("/dashboard/relatorios")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--c-text-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 14 }}>
        <ArrowLeft size={15} /> Relatórios
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Users size={20} color="#0066FF" />
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>Retenção de clientes</h1>
      </div>
      <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "0 0 24px" }}>Quem está voltando, quem sumiu, e quanto de receita está em risco.</p>

      {loading && <p style={{ color: "var(--c-text-3)", fontSize: 14 }}>Carregando…</p>}
      {error && <p style={{ color: "#F87171", fontSize: 14 }}>{error}</p>}

      {!loading && data && (
        <>
          {/* Receita em risco — destaque */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 16, padding: "18px 22px", marginBottom: 24 }}>
            <AlertTriangle size={26} color="#EF4444" />
            <div>
              <p style={{ fontSize: 13, color: "#FCA5A5", margin: 0, fontWeight: 500 }}>Receita em risco (clientes inativos/perdidos)</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: "var(--c-text)", margin: "2px 0 0" }}>{fmt(data.receitaEmRisco)}</p>
            </div>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--c-text-3)", maxWidth: 220, textAlign: "right" }}>
              é o ticket médio somado de quem parou de vir. Reative no WhatsApp 👇
            </span>
          </div>

          {/* Buckets */}
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 12px" }}>Por recência</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
            <StatCard icon={<Clock size={16} />} label="Ativos (≤15 dias)" value={data.recency.ativos} color="#10B981" />
            <StatCard icon={<Clock size={16} />} label="Inativos (15-30 dias)" value={data.recency.inativos} color="#F59E0B" />
            <StatCard icon={<Clock size={16} />} label="Perdidos (30+ dias)" value={data.recency.perdidos} color="#EF4444" />
          </div>

          <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 12px" }}>Por frequência</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 32 }}>
            <StatCard icon={<UserPlus size={16} />} label="Novos (1 visita)" value={data.frequency.novos} color="#0066FF" />
            <StatCard icon={<Repeat size={16} />} label="Recorrentes (2-3)" value={data.frequency.recorrentes} color="#7C3AED" />
            <StatCard icon={<Crown size={16} />} label="VIP (4+ visitas)" value={data.frequency.vip} color="#F59E0B" />
          </div>

          {/* Recuperáveis */}
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text)", margin: "0 0 12px" }}>
            Clientes a recuperar <span style={{ color: "var(--c-text-3)", fontWeight: 400, fontSize: 13 }}>({data.recuperaveis.length})</span>
          </h2>
          {data.recuperaveis.length === 0 ? (
            <p style={{ color: "var(--c-text-3)", fontSize: 14 }}>Nenhum cliente inativo no momento. 🎉</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.recuperaveis.map((c) => {
                const link = waLink(c.phone, c.name)
                const b = BUCKET_LABEL[c.bucket] ?? { label: c.bucket, color: "var(--c-text-3)" }
                return (
                  <div key={c.customerId} style={{ display: "flex", alignItems: "center", gap: 12, backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "12px 16px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>{c.name}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: b.color, backgroundColor: `${b.color}1A`, border: `1px solid ${b.color}33`, borderRadius: 6, padding: "1px 7px" }}>{b.label}</span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "2px 0 0" }}>
                        Última visita há {c.lastVisitDays} dias · {c.visits} visita{c.visits !== 1 ? "s" : ""} · gastou {fmt(c.totalSpent)} · ticket médio {fmt(c.avgTicket)}
                      </p>
                    </div>
                    {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px", borderRadius: 9, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#10B981", fontSize: 12, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--c-text-4)", flexShrink: 0 }}>sem telefone</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
