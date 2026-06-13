"use client"

import { useCallback, useEffect, useState } from "react"
import { MessageCircle, X } from "lucide-react"
import Modal from "@/components/shared/Modal"
import { apiGet, apiPatch, apiPut } from "@/lib/api"
import { buildWaLink, hasPhone } from "@/lib/crm"
import { toast } from "sonner"

/**
 * Ficha de relacionamento (modal) — resumo das experiências do cliente + notas,
 * preferências/tags e o override de "re-chamar a cada N dias". Editável inline.
 * O detalhe completo (veículos, histórico) continua na página /clientes/[id].
 */

interface Resumo {
  visitas: number
  gastoTotal: number
  ticketMedio: number
  servicoMaisFrequente: string | null
  ultimaVisita: string | null
  proximoRetornoPrevisto: string | null
  reviews: { count: number; avg: number }
  ultimasVisitas: { id: string; date: string; total: number; servicos: (string | null)[] }[]
  notes: string | null
  preferences: string | null
  tags: string[]
  lastExperienceSummary: string | null
}

interface RecallPref { id: string; serviceId: string | null; intervalDays: number }

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—")

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--c-text-4)", letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 6px" }
const areaStyle: React.CSSProperties = { width: "100%", minHeight: 56, padding: "8px 10px", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 8, color: "var(--c-text)", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }

export default function RelationshipModal({
  open, onClose, customerId, customerName, phone,
}: {
  open: boolean
  onClose: () => void
  customerId: string | null
  customerName: string
  phone: string | null
}) {
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState("")
  const [preferences, setPreferences] = useState("")
  const [summary, setSummary] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [overrideDays, setOverrideDays] = useState("")

  const load = useCallback(() => {
    if (!customerId) return
    setLoading(true)
    Promise.all([
      apiGet<{ resumo: Resumo }>(`/crm/cliente/${customerId}/resumo`),
      apiGet<{ prefs: RecallPref[] }>(`/crm/cliente/${customerId}/recall-prefs`).catch(() => ({ prefs: [] })),
    ])
      .then(([r, p]) => {
        const rz = r.resumo
        setResumo(rz)
        setNotes(rz.notes ?? "")
        setPreferences(rz.preferences ?? "")
        setSummary(rz.lastExperienceSummary ?? "")
        setTags(rz.tags ?? [])
        const global = (p.prefs ?? []).find((x) => x.serviceId === null)
        setOverrideDays(global ? String(global.intervalDays) : "")
      })
      .catch(() => toast.error("Não consegui carregar a ficha."))
      .finally(() => setLoading(false))
  }, [customerId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (open && customerId) load() }, [open, customerId, load])

  function addTag() {
    const t = tagInput.trim()
    if (!t || tags.includes(t) || tags.length >= 20) { setTagInput(""); return }
    setTags((prev) => [...prev, t])
    setTagInput("")
  }

  async function salvar() {
    if (!customerId) return
    setSaving(true)
    try {
      await apiPatch(`/customers/${customerId}/crm`, {
        notes: notes.trim() || null,
        preferences: preferences.trim() || null,
        lastExperienceSummary: summary.trim() || null,
        tags,
      })
      // override global de re-chamada (serviceId null) — grava quando preenchido.
      // Limpar o campo não remove o override aqui (MVP); usar a página de detalhe pra isso.
      const days = parseInt(overrideDays, 10)
      if (overrideDays.trim() && Number.isFinite(days) && days > 0) {
        await apiPut(`/crm/cliente/${customerId}/recall-prefs`, { serviceId: null, intervalDays: days })
      }
      toast.success("Ficha salva 👍")
      onClose()
    } catch {
      toast.error("Não consegui salvar a ficha.")
    } finally {
      setSaving(false)
    }
  }

  const waLink = buildWaLink({ tipo: "follow_up", nome: customerName, phone })
  const temFone = hasPhone(phone)

  return (
    <Modal open={open} onClose={onClose} size="lg" title={`Relacionamento · ${customerName}`} description="Resumo, anotações e quando re-chamar este cliente.">
      {loading || !resumo ? (
        <p style={{ fontSize: 13, color: "var(--c-text-3)" }}>Carregando ficha…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Resumo das experiências */}
          <div>
            <p style={labelStyle}>Últimas experiências</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Stat label="Visitas" value={String(resumo.visitas)} />
              <Stat label="Gasto total" value={brl(resumo.gastoTotal)} />
              <Stat label="Ticket médio" value={brl(resumo.ticketMedio)} />
              <Stat label="Serviço favorito" value={resumo.servicoMaisFrequente ?? "—"} />
              <Stat label="Última visita" value={dia(resumo.ultimaVisita)} />
              <Stat label="Próximo retorno" value={dia(resumo.proximoRetornoPrevisto)} />
            </div>
            {resumo.reviews.count > 0 && (
              <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "8px 0 0" }}>
                ★ {resumo.reviews.avg.toFixed(1)} · {resumo.reviews.count} avaliação(ões)
              </p>
            )}
          </div>

          {/* Tags / preferências */}
          <div>
            <p style={labelStyle}>O que o cliente prefere</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {tags.map((t) => (
                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#0066FF", background: "rgba(0,102,255,0.1)", border: "1px solid rgba(0,102,255,0.2)", borderRadius: 999, padding: "3px 9px" }}>
                  {t}
                  <button onClick={() => setTags((p) => p.filter((x) => x !== t))} style={{ background: "none", border: "none", cursor: "pointer", color: "#0066FF", display: "flex", padding: 0 }}><X size={11} /></button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
                placeholder="+ tag (VIP, exigente…)"
                style={{ height: 28, padding: "0 10px", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 999, color: "var(--c-text)", fontSize: 12, outline: "none", fontFamily: "inherit", width: 150 }}
              />
            </div>
            <textarea value={preferences} onChange={(e) => setPreferences(e.target.value)} placeholder="Ex.: gosta de cheiro suave, prefere sábado de manhã, não usar pretinho…" style={areaStyle} />
          </div>

          {/* Notas */}
          <div>
            <p style={labelStyle}>Anotações (o que aconteceu)</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anote o que rolou no atendimento, combinados, observações…" style={areaStyle} />
          </div>

          {/* Resumo qualitativo */}
          <div>
            <p style={labelStyle}>Resumo do cliente</p>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Em uma frase: quem é esse cliente, o que ele valoriza…" style={{ ...areaStyle, minHeight: 44 }} />
          </div>

          {/* Override de re-chamada */}
          <div>
            <p style={labelStyle}>Re-chamar este cliente a cada</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <input type="number" min={0} max={3650} value={overrideDays} onChange={(e) => setOverrideDays(e.target.value)} placeholder="—" style={{ width: 80, height: 36, padding: "0 10px", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 8, color: "var(--c-text)", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
              <span style={{ fontSize: 13, color: "var(--c-text-3)" }}>dias (vazio = usa o padrão do serviço)</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--c-border)", marginTop: 20, paddingTop: 20, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}>
        <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 7, height: 40, padding: "0 16px", borderRadius: 10, background: "rgba(16,185,129,0.14)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
          <MessageCircle size={16} /> {temFone ? "WhatsApp" : "Abrir WhatsApp"}
        </a>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} disabled={saving} style={{ height: 40, padding: "0 16px", borderRadius: 10, background: "transparent", border: "1px solid var(--c-border)", color: "var(--c-text-2)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Fechar</button>
          <button onClick={salvar} disabled={saving || loading} style={{ height: 40, padding: "0 18px", borderRadius: 10, background: "#0066FF", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1, fontFamily: "inherit" }}>{saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </Modal>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 8, padding: "8px 10px" }}>
      <p style={{ fontSize: 10, color: "var(--c-text-4)", margin: 0 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</p>
    </div>
  )
}
