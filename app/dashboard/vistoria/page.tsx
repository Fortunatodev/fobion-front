"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ClipboardCheck, Search, AlertCircle, RefreshCw, ChevronRight, Car, Camera, Share2 } from "lucide-react"
import { apiGet } from "@/lib/api"
import TabTutorial from "@/components/shared/TabTutorial"
import { useUser } from "@/contexts/UserContext"
import ProFeatureGate from "@/components/shared/ProFeatureGate"

/**
 * Índice de Vistorias (feature PRO) — a vistoria é POR COMANDA (entrada/saída do veículo).
 * Esta tela lista os atendimentos numa janela recente (e os próximos) pra o dono
 * escolher um e abrir a vistoria em /dashboard/vistoria/[scheduleId].
 * (O back não tem listagem geral de vistorias; reusamos GET /schedules.)
 */

interface Schedule {
  id: string
  scheduledAt: string
  status: string
  customer: { id: string; name: string | null; phone: string | null } | null
  vehicle: { id: string; plate: string | null; brand: string | null; model: string | null; color: string | null } | null
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  REQUESTED:   { label: "Solicitado",  color: "#7C3AED" },
  PENDING:     { label: "Pendente",    color: "#F59E0B" },
  CONFIRMED:   { label: "Confirmado",  color: "#0066FF" },
  IN_PROGRESS: { label: "Em atendimento", color: "#10B981" },
  DONE:        { label: "Concluído",   color: "#6B7280" },
  CANCELLED:   { label: "Cancelado",   color: "#EF4444" },
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

/** Gate de plano: Vistoria é PRO. Essencial vê o convite de upgrade. */
export default function VistoriaIndexPage() {
  const { planStatus } = useUser()
  if (planStatus?.plan !== "PRO") {
    return (
      <ProFeatureGate
        featureName="Vistoria"
        description="Registre o estado do veículo na entrada e saída, com fotos, marcação de avarias e laudo pro cliente. Disponível no plano Pro."
      />
    )
  }
  return <VistoriaIndexInner />
}

function VistoriaIndexInner() {
  const router = useRouter()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busca, setBusca] = useState("")

  const load = useCallback(() => {
    setLoading(true)
    setError("")
    const now = new Date()
    const from = ymd(new Date(now.getTime() - 30 * 86_400_000))
    const to = ymd(new Date(now.getTime() + 14 * 86_400_000))
    apiGet<{ schedules: Schedule[] }>(`/schedules?from=${from}&to=${to}`)
      .then((r) => setSchedules(r.schedules ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar comandas."))
      .finally(() => setLoading(false))
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const filtered = q
      ? schedules.filter((s) =>
          (s.customer?.name ?? "").toLowerCase().includes(q) ||
          (s.vehicle?.plate ?? "").toLowerCase().includes(q) ||
          [s.vehicle?.brand, s.vehicle?.model].filter(Boolean).join(" ").toLowerCase().includes(q))
      : schedules
    // mais recentes primeiro
    return [...filtered].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
  }, [schedules, busca])

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <ClipboardCheck size={20} color="#0066FF" />
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>Vistorias</h1>
      </div>
      <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "0 0 20px" }}>
        A vistoria é feita por atendimento (entrada e saída do veículo). Escolha a comanda e registre fotos, avarias e a assinatura.
      </p>

      <TabTutorial
        tabKey="vistoria"
        title="Como usar a Vistoria"
        subtitle="Documente o estado do carro e evite dor de cabeça"
        steps={[
          { icon: ClipboardCheck, title: "1. Registre a entrada", text: "Antes de começar o serviço, registre o estado do carro. Fica tudo documentado, com data e hora." },
          { icon: Camera, title: "2. Fotos e avarias", text: "Tire fotos e marque arranhões e amassados no desenho do veículo. Prova do estado na chegada." },
          { icon: Share2, title: "3. Compartilhe com o cliente", text: "Gere o link da vistoria e mande pro cliente — transparência que evita discussão na entrega." },
        ]}
      />

      <div style={{ position: "relative", marginBottom: 16, maxWidth: 360 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-4)" }} />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente, placa ou modelo…"
          style={{ width: "100%", height: 40, padding: "0 12px 0 36px", background: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 10, color: "var(--c-text)", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
        />
      </div>

      {loading && (
        <>
          <style>{`@keyframes vSkel{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ height: 68, background: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 12, animation: `vSkel 1.5s ease ${i * 0.1}s infinite` }} />
            ))}
          </div>
        </>
      )}

      {!loading && error && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <AlertCircle size={14} color="#EF4444" />
          <span style={{ fontSize: 13, color: "#EF4444" }}>{error}</span>
          <button onClick={load} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 8, background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <RefreshCw size={13} /> Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && lista.length === 0 && (
        <div style={{ textAlign: "center", padding: "56px 0" }}>
          <ClipboardCheck size={40} color="var(--c-border-2)" style={{ margin: "0 auto" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--c-text)", marginTop: 14 }}>Nenhuma comanda na janela</p>
          <p style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 6 }}>
            As vistorias aparecem a partir das comandas dos últimos 30 dias e das próximas. Crie um agendamento pra começar.
          </p>
        </div>
      )}

      {!loading && !error && lista.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lista.map((s) => {
            const st = STATUS_LABEL[s.status] ?? { label: s.status, color: "var(--c-text-4)" }
            const veiculo = [s.vehicle?.brand, s.vehicle?.model].filter(Boolean).join(" ") || "Veículo"
            const data = new Date(s.scheduledAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
            return (
              <button
                key={s.id}
                onClick={() => router.push(`/dashboard/vistoria/${s.id}`)}
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", background: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "12px 14px" }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Car size={17} color="var(--c-text-3)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>{s.customer?.name ?? "Cliente"}</span>
                    {s.vehicle?.plate && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-border)", borderRadius: 5, padding: "1px 7px" }}>{s.vehicle.plate}</span>}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "2px 0 0" }}>{veiculo} · {data}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: st.color, flexShrink: 0 }}>{st.label}</span>
                <ChevronRight size={16} color="var(--c-text-4)" style={{ flexShrink: 0 }} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
