"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { MessageCircle, CalendarPlus, Check, AlertCircle, RefreshCw, Heart } from "lucide-react"
import { apiGet, apiPatch } from "@/lib/api"
import { buildWaLink, TIPO_META, type FilaItem, type FilaResponse, type FilaTipo } from "@/lib/crm"
import { toast } from "sonner"

/**
 * Aba "Pra cuidar hoje" — fila única de relacionamento (GET /crm/fila): recalls
 * vencendo, inativos/perdidos (RFM), aniversariantes, pós-serviço sem avaliação e
 * follow-ups do dia. Cada card tem ações grandes: WhatsApp 1-clique (msg
 * contextual), Agendar (deep-link) e Concluir (recall/follow-up). Pra todos os planos.
 */

const FILTROS: { value: FilaTipo | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "recall", label: "Retornos" },
  { value: "follow_up", label: "Follow-ups" },
  { value: "perdido", label: "Sumiram" },
  { value: "inativo", label: "Inativos" },
  { value: "pos_servico", label: "Avaliação" },
  { value: "aniversario", label: "Aniversário" },
]

export default function RelationshipQueue() {
  const router = useRouter()
  const [data, setData] = useState<FilaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filtro, setFiltro] = useState<FilaTipo | "todos">("todos")
  const [done, setDone] = useState<Set<string>>(new Set())

  const load = useCallback(() => {
    setLoading(true)
    setError("")
    apiGet<FilaResponse>("/crm/fila")
      .then((r) => setData(r))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar a fila."))
      .finally(() => setLoading(false))
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function concluir(item: FilaItem) {
    const key = `${item.tipo}:${item.refId}`
    try {
      if (item.tipo === "recall") await apiPatch(`/crm/recalls/${item.refId}`, { status: "DONE" })
      else if (item.tipo === "follow_up") await apiPatch(`/crm/followups/${item.refId}`, { status: "DONE" })
      setDone((prev) => new Set(prev).add(key))
      toast.success("Marcado como feito 👍")
    } catch {
      toast.error("Não consegui marcar como feito.")
    }
  }

  function agendar(item: FilaItem) {
    router.push(`/dashboard/agendamentos?customerId=${item.customerId}&customerName=${encodeURIComponent(item.nome)}`)
  }

  const itens = (data?.itens ?? []).filter((i) => filtro === "todos" || i.tipo === filtro)
  const total = data?.total ?? 0

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Heart size={20} color="#EC4899" />
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>
          {total > 0 ? `${total} ${total === 1 ? "cliente" : "clientes"} pra cuidar hoje` : "Cuidar do cliente"}
        </h2>
      </div>
      <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "0 0 18px" }}>
        Quem chamar hoje, por quê, e a mensagem pronta. Um toque no WhatsApp e pronto.
      </p>

      {/* Filtros por tipo */}
      {!loading && !error && total > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 14 }}>
          {FILTROS.map((f) => {
            const n = f.value === "todos" ? total : (data?.counts?.[f.value] ?? 0)
            if (f.value !== "todos" && n === 0) return null
            const active = filtro === f.value
            return (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                style={{
                  flexShrink: 0, height: 32, padding: "0 12px", borderRadius: 999,
                  border: `1px solid ${active ? "#0066FF" : "var(--c-border)"}`,
                  background: active ? "rgba(0,102,255,0.12)" : "var(--c-bg)",
                  color: active ? "#0066FF" : "var(--c-text-3)",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                {f.label} · {n}
              </button>
            )
          })}
        </div>
      )}

      {loading && (
        <>
          <style>{`@keyframes relSkel{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 96, backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 14, animation: `relSkel 1.5s ease ${i * 0.1}s infinite` }} />
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

      {!loading && !error && total === 0 && (
        <div style={{ textAlign: "center", padding: "56px 0" }}>
          <Heart size={40} color="var(--c-border-2)" style={{ margin: "0 auto" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--c-text)", marginTop: 14 }}>Tudo em dia por aqui! 🎉</p>
          <p style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 6, maxWidth: 420, marginInline: "auto" }}>
            Conforme você fechar comandas e configurar o {"“re-chamar em N dias”"} nos serviços,
            os clientes a cuidar vão aparecer aqui automaticamente.
          </p>
        </div>
      )}

      {!loading && !error && itens.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {itens.map((item) => {
            const meta = TIPO_META[item.tipo]
            const key = `${item.tipo}:${item.refId}`
            const isDone = done.has(key)
            const link = buildWaLink(item)
            const canConcluir = item.tipo === "recall" || item.tipo === "follow_up"
            return (
              <div
                key={key}
                style={{
                  display: "flex", gap: 12, backgroundColor: "var(--c-bg)",
                  border: "1px solid var(--c-border)", borderRadius: 14, padding: 14,
                  opacity: isDone ? 0.5 : 1,
                }}
              >
                <div style={{ width: 4, borderRadius: 2, background: meta.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text)" }}>{item.nome}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, background: `${meta.color}1f`, borderRadius: 5, padding: "2px 7px" }}>
                      {meta.label}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", margin: "0 0 2px" }}>{item.motivo}</p>
                  {item.contexto && <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: 0 }}>{item.contexto}</p>}

                  {/* Quick actions — alvos grandes (mobile-first) */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    {link ? (
                      <a
                        href={link} target="_blank" rel="noopener noreferrer"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, height: 44, padding: "0 16px", borderRadius: 11, background: "rgba(16,185,129,0.14)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981", fontSize: 14, fontWeight: 700, textDecoration: "none" }}
                      >
                        <MessageCircle size={17} /> WhatsApp
                      </a>
                    ) : (
                      <span style={{ display: "flex", alignItems: "center", height: 44, fontSize: 12, color: "var(--c-text-4)" }}>sem telefone</span>
                    )}
                    <button
                      onClick={() => agendar(item)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, height: 44, padding: "0 16px", borderRadius: 11, background: "var(--c-surface)", border: "1px solid var(--c-border)", color: "var(--c-text-2)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      <CalendarPlus size={17} /> Agendar
                    </button>
                    {canConcluir && !isDone && (
                      <button
                        onClick={() => concluir(item)}
                        title="Marcar como feito"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, height: 44, padding: "0 14px", borderRadius: 11, background: "transparent", border: "1px solid var(--c-border)", color: "var(--c-text-3)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        <Check size={17} /> Feito
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
