"use client"

import { useEffect, useState } from "react"
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api"
import { FileText, Plus, Check, X, Trash2, ShoppingCart, Send, Search, Tag, AlertCircle, RefreshCw, CheckCircle, Calendar, Download, Pencil } from "lucide-react"
import { toast } from "sonner"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import MessageTemplatePicker, { type TemplateVars } from "@/components/dashboard/MessageTemplatePicker"
import TabTutorial from "@/components/shared/TabTutorial"
import { useUser } from "@/contexts/UserContext"
import ProFeatureGate from "@/components/shared/ProFeatureGate"
import { hasProAccess } from "@/lib/plan"

/**
 * V2-B3 — Orçamentos (feature PRO). Cliente do CRM + itens do catálogo → proposta → envia
 * no WhatsApp → aprova → vira agendamento. Ref: CERA (módulo de 1ª classe).
 */

/** Gate de plano: Orçamentos é PRO. Essencial vê o convite de upgrade. */
export default function OrcamentosPage() {
  const { planStatus } = useUser()
  if (!hasProAccess(planStatus)) {
    return (
      <ProFeatureGate
        featureName="Orçamentos"
        description="Monte propostas, envie no WhatsApp e converta em agendamento com o preço acordado. Disponível no plano Pro."
      />
    )
  }
  return <OrcamentosInner />
}
interface QuoteItem { serviceId?: string | null; name: string; price: number }
interface Quote {
  id: string; customerName: string | null; plate: string | null
  customerId?: string | null; vehicleId?: string | null
  customerPhone?: string | null
  items: QuoteItem[]; totalPrice: number; notes: string | null
  status: string; validUntil: string | null; createdAt: string
}
interface CustomerResult {
  id: string; name: string; phone: string
  vehicles: Array<{ id: string; plate: string; brand: string; model: string }>
}
interface ServiceItem { id: string; name: string; price: number }

const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const STATUS: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: "Rascunho",  color: "var(--c-text-3)" },
  SENT:      { label: "Enviado",   color: "#0066FF" },
  APPROVED:  { label: "Aprovado",  color: "#10B981" },
  REJECTED:  { label: "Recusado",  color: "#EF4444" },
  CONVERTED: { label: "Vendido",   color: "#F59E0B" },
}

function quoteMessage(q: { customerName: string | null; items: { name: string; price: number }[]; totalPrice: number; validUntil: string | null; notes: string | null }) {
  const lines = [
    `*Orçamento — Forbion*`,
    q.customerName ? `Cliente: ${q.customerName}` : "",
    "",
    ...q.items.map((i) => `• ${i.name} — ${fmt(i.price)}`),
    "",
    `*Total: ${fmt(q.totalPrice)}*`,
    q.validUntil ? `Válido até ${new Date(q.validUntil).toLocaleDateString("pt-BR")}` : "",
    q.notes ? `\n${q.notes}` : "",
  ]
  return lines.filter((l) => l !== "").join("\n")
}

function OrcamentosInner() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [modal, setModal] = useState(false)
  const [services, setServices] = useState<ServiceItem[]>([])
  const [pickerQuote, setPickerQuote] = useState<Quote | null>(null)
  // converter orçamento → agendamento
  const [convertQuote, setConvertQuote] = useState<Quote | null>(null)
  const [convertDate, setConvertDate] = useState("")
  const [converting, setConverting] = useState(false)

  // exclusão
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // form
  const [fName, setFName] = useState("")
  const [fPlate, setFPlate] = useState("")
  const [fCustomerId, setFCustomerId] = useState<string | null>(null)
  const [fVehicleId, setFVehicleId] = useState<string | null>(null)
  const [fNotes, setFNotes] = useState("")
  const [fValid, setFValid] = useState("")
  const [fItems, setFItems] = useState<{ serviceId?: string | null; name: string; price: string }[]>([{ name: "", price: "" }])
  const [saving, setSaving] = useState(false)
  const [fErr, setFErr] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)  // null = criar; id = editar

  // busca de cliente
  const [custQuery, setCustQuery] = useState("")
  const [custResults, setCustResults] = useState<CustomerResult[]>([])
  const [showCust, setShowCust] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)

  const fetchQuotes = () => {
    setLoading(true); setError("")
    // Backend pagina (default 50, era take:200 fixo). Busca TODAS as páginas em loop e acumula
    // (limit 100, teto 50 págs = 5000) — a lista/filtro client-side seguem sobre a base completa.
    ;(async () => {
      try {
        const LIMIT = 100, MAX_PAGES = 50
        let all: Quote[] = []
        let page = 1, total = Infinity
        while (all.length < total && page <= MAX_PAGES) {
          const r = await apiGet<{ quotes: Quote[]; total?: number }>(`/quotes?page=${page}&limit=${LIMIT}`)
          const batch = r.quotes ?? []
          all = all.concat(batch)
          total = typeof r.total === "number" ? r.total : all.length
          if (batch.length < LIMIT) break
          page++
        }
        setQuotes(all)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar.")
      } finally {
        setLoading(false)
      }
    })()
  }
  useEffect(fetchQuotes, [])
  // B05 (ext) — ESC fecha + trava scroll do fundo quando o modal está aberto
  useEffect(() => {
    if (!modal) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(false) }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden"
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev }
  }, [modal])
  useEffect(() => { apiGet<{ services: ServiceItem[] }>("/services").then((r) => setServices(r.services ?? [])).catch(() => {}) }, [])

  // busca cliente (simples, on-change)
  useEffect(() => {
    if (custQuery.trim().length < 2) { setCustResults([]); return }
    let alive = true
    apiGet<{ customers: CustomerResult[] }>(`/customers?search=${encodeURIComponent(custQuery)}&limit=6`)
      .then((r) => { if (alive) setCustResults(r.customers ?? []) }).catch(() => {})
    return () => { alive = false }
  }, [custQuery])

  function pickCustomer(c: CustomerResult) {
    setFCustomerId(c.id); setFName(c.name)
    if (c.vehicles.length >= 1) { setFPlate(c.vehicles[0].plate); setFVehicleId(c.vehicles[0].id) }
    setShowCust(false); setCustQuery(""); setCustResults([])
  }
  function clearCustomer() { setFCustomerId(null); setFVehicleId(null); setFName(""); setFPlate("") }

  function addCatalogItem(s: ServiceItem) {
    setFItems((p) => {
      const empty = p.findIndex((it) => !it.name.trim() && !it.price)
      const item = { serviceId: s.id, name: s.name, price: (s.price / 100).toString() }
      if (empty >= 0) return p.map((x, j) => j === empty ? item : x)
      return [...p, item]
    })
    setShowCatalog(false)
  }

  const total = fItems.reduce((a, it) => a + (Number(it.price) > 0 ? Math.round(Number(it.price) * 100) : 0), 0)

  function resetForm() {
    setEditingId(null)
    setFName(""); setFPlate(""); setFCustomerId(null); setFVehicleId(null)
    setFNotes(""); setFValid(""); setFItems([{ name: "", price: "" }]); setCustQuery(""); setCustResults([])
  }

  // Abre o modal pré-preenchido pra EDITAR um orçamento (só DRAFT/SENT mostram o botão).
  function openEdit(q: Quote) {
    setEditingId(q.id)
    setFName(q.customerName ?? ""); setFPlate(q.plate ?? "")
    setFCustomerId(q.customerId ?? null); setFVehicleId(q.vehicleId ?? null)
    setFNotes(q.notes ?? "")
    setFValid(q.validUntil ? new Date(q.validUntil).toISOString().slice(0, 10) : "")
    setFItems((q.items ?? []).map((it) => ({ serviceId: it.serviceId ?? null, name: it.name, price: (it.price / 100).toString() })))
    setFErr(""); setCustQuery(""); setCustResults([])
    setModal(true)
  }

  async function handleCreate() {
    if (!fName.trim()) {
      setFErr("Informe o nome do cliente."); toast.error("Preencha o nome do cliente."); return
    }
    const items = fItems.filter((it) => it.name.trim() && Number(it.price) > 0)
      .map((it) => ({ serviceId: it.serviceId ?? null, name: it.name.trim(), price: Math.round(Number(it.price) * 100) }))
    if (items.length === 0) {
      setFErr("Adicione ao menos um item com nome e preço."); toast.error("Adicione ao menos um item com nome e preço."); return
    }
    setSaving(true); setFErr("")
    try {
      const payload = {
        customerId: fCustomerId, vehicleId: fVehicleId,
        customerName: fName.trim() || null, plate: fPlate.trim() || null,
        items, notes: fNotes.trim() || null,
        validUntil: fValid ? new Date(fValid).toISOString() : null,
      }
      if (editingId) await apiPut(`/quotes/${editingId}`, payload)
      else await apiPost("/quotes", payload)
      setModal(false); resetForm(); fetchQuotes()
      toast.success(editingId ? "Orçamento atualizado." : "Orçamento criado.")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar."
      setFErr(msg); toast.error(msg)
    } finally { setSaving(false) }
  }

  async function setStatus(id: string, status: string) {
    try {
      await apiPut(`/quotes/${id}/status`, { status })
      fetchQuotes()
      toast.success(`Orçamento ${(STATUS[status]?.label ?? status).toLowerCase()}.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar o status.")
    }
  }
  // Abre o seletor de mensagens já com a proposta itemizada pronta. O dono pode
  // trocar por um modelo salvo, ajustar e enviar. Ao enviar, marca como enviado.
  function openSendPicker(q: Quote) {
    setPickerQuote(q)
  }

  // Converte o orçamento aprovado em AGENDAMENTO (vira venda na agenda). É o que faz
  // a aba existir de verdade: orçamento → comanda agendada.
  async function confirmConvert() {
    if (!convertQuote || !convertDate || converting) return
    setConverting(true)
    try {
      await apiPost(`/quotes/${convertQuote.id}/convert-to-schedule`, { scheduledAt: new Date(convertDate).toISOString() })
      toast.success("Orçamento virou agendamento! Veja na Agenda/Comandas.")
      setConvertQuote(null); setConvertDate(""); fetchQuotes()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui converter.")
    } finally {
      setConverting(false)
    }
  }

  // PDF/proposta do orçamento numa via de impressão (salva como PDF pelo navegador).
  function printQuote(q: Quote) {
    const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!))
    const win = window.open("", "_blank", "width=620,height=820")
    if (!win) { toast.error("Permita pop-ups pra baixar a proposta."); return }
    const itensHtml = (q.items ?? []).map((i) => `<tr><td>${esc(i.name)}</td><td style="text-align:right">${fmt(i.price)}</td></tr>`).join("")
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Orçamento</title>
<style>body{font-family:-apple-system,'Inter',sans-serif;max-width:480px;margin:32px auto;color:#111;padding:0 20px}
h1{font-size:18px;margin:0 0 2px}.sub{color:#666;font-size:12px;margin:0 0 20px}
table{width:100%;border-collapse:collapse;font-size:14px}td{padding:9px 0;border-bottom:1px solid #eee}
.total td{font-weight:800;font-size:16px;border-top:2px solid #111;border-bottom:none;padding-top:12px}
.foot{margin-top:28px;color:#999;font-size:11px;text-align:center}
button{margin:24px auto 0;display:block;padding:10px 18px;border:none;border-radius:8px;background:#0066FF;color:#fff;font-size:14px;cursor:pointer}
@media print{button{display:none}}</style></head><body>
<h1>Orçamento</h1><p class="sub">${esc(q.customerName || "Cliente")}${q.plate ? " · " + esc(q.plate) : ""}</p>
<table>${itensHtml}<tr class="total"><td>Total</td><td style="text-align:right">${fmt(q.totalPrice)}</td></tr></table>
${q.validUntil ? `<p style="color:#666;font-size:12px;margin-top:12px">Válido até ${new Date(q.validUntil).toLocaleDateString("pt-BR")}</p>` : ""}
${q.notes ? `<p style="font-size:12px;margin-top:8px">${esc(q.notes)}</p>` : ""}
<div class="foot">Gerado pela Forbion</div>
<button onclick="window.print()">Imprimir / Salvar PDF</button>
</body></html>`)
    win.document.close()
  }

  function remove(id: string) {
    setDeleteTarget(id); setConfirmOpen(true)
  }
  async function confirmRemove() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiDelete(`/quotes/${deleteTarget}`)
      setConfirmOpen(false); setDeleteTarget(null); fetchQuotes()
      toast.success("Orçamento excluído.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir.")
    } finally { setDeleting(false) }
  }

  const inp: React.CSSProperties = { height: 40, padding: "0 12px", background: "var(--c-bg)", border: "1px solid var(--c-border-2)", borderRadius: 10, color: "var(--c-text)", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }
  const ghostBtn: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 40, padding: "0 16px", borderRadius: 10, background: "transparent", border: "1px solid var(--c-border-2)", color: "var(--c-text-2)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }
  const pill = (bg: string, bd: string, c: string): React.CSSProperties => ({ display: "flex", alignItems: "center", gap: 5, height: 32, padding: "0 12px", borderRadius: 8, background: bg, border: `1px solid ${bd}`, color: c, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" })

  const isExpired = (q: Quote) => q.validUntil && new Date(q.validUntil) < new Date() && !["APPROVED", "CONVERTED", "REJECTED"].includes(q.status)

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FileText size={22} color="#0066FF" />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>Orçamentos</h1>
        </div>
        <button onClick={() => { resetForm(); setModal(true) }} style={{ display: "flex", alignItems: "center", gap: 7, height: 40, padding: "0 18px", borderRadius: 10, background: "linear-gradient(135deg,#0066FF,#7C3AED)", color: "white", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          <Plus size={15} /> Novo orçamento
        </button>
      </div>
      <TabTutorial
        tabKey="orcamentos"
        title="Como usar os Orçamentos"
        subtitle="Proposta no WhatsApp que vira venda"
        steps={[
          { icon: FileText, title: "1. Monte a proposta", text: "Escolha o cliente e os serviços (vitrificação, PPF, polimento...). O total é somado automaticamente." },
          { icon: Send, title: "2. Envie no WhatsApp", text: "Mande a proposta pronta pro cliente. Dá pra escolher e salvar mensagens de abertura no próprio envio." },
          { icon: CheckCircle, title: "3. Aprovou? Vira venda", text: "Marque como aprovado e depois como vendido. Você acompanha o status de cada proposta enviada." },
        ]}
      />
      <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "0 0 24px" }}>Monte propostas (ticket alto: vitrificação, PPF), envie no WhatsApp e converta em venda.</p>

      {/* B19 — funil/conversão de orçamentos (métrica que a CERA exibe) */}
      {!loading && quotes.length > 0 && (() => {
        const sent = quotes.filter((q) => q.status !== "DRAFT").length
        const conv = quotes.filter((q) => q.status === "CONVERTED").length
        const appr = quotes.filter((q) => q.status === "APPROVED").length
        const rate = sent > 0 ? Math.round((conv / sent) * 100) : 0
        const KS = [
          { label: "Orçamentos", value: String(quotes.length), color: "var(--c-text)" },
          { label: "Aprovados", value: String(appr), color: "#10B981" },
          { label: "Vendidos", value: String(conv), color: "#F59E0B" },
          { label: "Conversão", value: `${rate}%`, color: "#0066FF" },
        ]
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: 10, marginBottom: 22 }}>
            {KS.map((k) => (
              <div key={k.label} style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "12px 14px" }}>
                <p style={{ fontSize: 11, color: "var(--c-text-3)", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{k.label}</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: k.color, margin: "4px 0 0" }}>{k.value}</p>
              </div>
            ))}
          </div>
        )
      })()}

      {loading && (
        <>
          <style>{`@keyframes orcSkel{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 86, background: "var(--c-elevated)", border: "1px solid var(--c-border)", borderRadius: 12, animation: `orcSkel 1.5s ease ${i * 0.1}s infinite` }} />
            ))}
          </div>
        </>
      )}
      {!loading && error && (
        <div style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <AlertCircle size={14} color="#EF4444" />
          <span style={{ fontSize: 13, color: "#EF4444" }}>{error}</span>
          <button onClick={fetchQuotes} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 8, background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <RefreshCw size={13} /> Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && quotes.length === 0 && (
        <div style={{ textAlign: "center", padding: "56px 0" }}>
          <FileText size={40} color="var(--c-border-2)" style={{ margin: "0 auto" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--c-text)", marginTop: 14 }}>Nenhum orçamento ainda</p>
          <p style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 6 }}>Crie uma proposta pra um serviço de ticket alto.</p>
        </div>
      )}

      {!loading && !error && quotes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {quotes.map((q) => {
            const st = STATUS[q.status] ?? { label: q.status, color: "var(--c-text-3)" }
            const expired = isExpired(q)
            const pastValid = !!q.validUntil && new Date(q.validUntil) < new Date()  // venceu (qualquer status)
            return (
              <div key={q.id} style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>{q.customerName || "Cliente"}</span>
                  {q.plate && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-border)", borderRadius: 5, padding: "1px 7px" }}>{q.plate}</span>}
                  <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: `${st.color}1A`, border: `1px solid ${st.color}33`, borderRadius: 6, padding: "1px 8px" }}>{st.label}</span>
                  {expired && <span style={{ fontSize: 11, fontWeight: 600, color: "#EF4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, padding: "1px 8px" }}>vencido</span>}
                  <span style={{ marginLeft: "auto", fontSize: 16, fontWeight: 800, color: "var(--c-text)" }}>{fmt(q.totalPrice)}</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "6px 0 0" }}>
                  {(q.items ?? []).map((i) => i.name).join(" · ")}
                  {q.validUntil && ` · válido até ${new Date(q.validUntil).toLocaleDateString("pt-BR")}`}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {(q.status === "DRAFT" || q.status === "SENT") && (
                    <>
                      <button onClick={() => openSendPicker(q)} style={pill("rgba(0,102,255,0.12)", "rgba(0,102,255,0.25)", "#0066FF")}><Send size={13} /> {q.status === "DRAFT" ? "Enviar no WhatsApp" : "Reenviar"}</button>
                      <button onClick={() => openEdit(q)} style={pill("transparent", "var(--c-border-2)", "var(--c-text-2)")}><Pencil size={13} /> Editar</button>
                      <button onClick={() => setStatus(q.id, "APPROVED")} disabled={!!expired} title={expired ? "Orçamento vencido — edite a validade antes de aprovar" : undefined} style={{ ...pill("rgba(16,185,129,0.12)", "rgba(16,185,129,0.25)", "#10B981"), opacity: expired ? 0.45 : 1, cursor: expired ? "not-allowed" : "pointer" }}><Check size={13} /> Aprovar</button>
                      <button onClick={() => setStatus(q.id, "REJECTED")} style={ghostBtn}><X size={13} /> Recusar</button>
                    </>
                  )}
                  {q.status === "APPROVED" && (
                    <>
                      <button onClick={() => { setConvertQuote(q); setConvertDate("") }} disabled={pastValid} title={pastValid ? "Orçamento vencido — edite a validade antes de agendar" : undefined} style={{ ...pill("rgba(124,58,237,0.12)", "rgba(124,58,237,0.3)", "#A78BFA"), opacity: pastValid ? 0.45 : 1, cursor: pastValid ? "not-allowed" : "pointer" }}><Calendar size={13} /> Agendar</button>
                      <button onClick={() => setStatus(q.id, "CONVERTED")} style={pill("rgba(245,158,11,0.12)", "rgba(245,158,11,0.25)", "#F59E0B")}><ShoppingCart size={13} /> Marcar como vendido</button>
                      <button onClick={() => openSendPicker(q)} style={pill("rgba(0,102,255,0.12)", "rgba(0,102,255,0.25)", "#0066FF")}><Send size={13} /> Reenviar</button>
                    </>
                  )}
                  <button onClick={() => printQuote(q)} title="Baixar proposta (PDF)" style={pill("transparent", "var(--c-border-2)", "var(--c-text-2)")}><Download size={13} /> PDF</button>
                  <button onClick={() => remove(q.id)} style={{ ...pill("transparent", "rgba(239,68,68,0.2)", "#EF4444"), marginLeft: "auto", padding: "0 10px" }}><Trash2 size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal criar */}
      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div onClick={(e) => { e.stopPropagation(); setShowCust(false); setShowCatalog(false) }} style={{ width: "100%", maxWidth: 480, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, padding: 22, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--c-text)", margin: "0 0 16px" }}>{editingId ? "Editar orçamento" : "Novo orçamento"}</h2>

            {/* Cliente do CRM */}
            {fCustomerId ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", marginBottom: 10, borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <span style={{ fontSize: 13, color: "var(--c-text)" }}>👤 {fName}{fPlate ? ` · ${fPlate}` : ""}</span>
                <button onClick={clearCustomer} style={{ background: "none", border: "none", color: "var(--c-text-3)", cursor: "pointer" }}><X size={16} /></button>
              </div>
            ) : (
              <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, ...inp }}>
                  <Search size={14} color="var(--c-text-4)" />
                  <input value={custQuery} onChange={(e) => { setCustQuery(e.target.value); setShowCust(true) }} onFocus={() => setShowCust(true)} placeholder="Buscar cliente cadastrado…" style={{ flex: 1, background: "transparent", border: "none", color: "var(--c-text)", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                </div>
                {showCust && custResults.length > 0 && (
                  <div style={{ position: "absolute", top: 44, left: 0, right: 0, background: "var(--c-surface-2)", border: "1px solid var(--c-border-2)", borderRadius: 10, zIndex: 10, overflow: "hidden" }}>
                    {custResults.map((c) => (
                      <button key={c.id} onClick={() => pickCustomer(c)} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "transparent", border: "none", borderBottom: "1px solid var(--c-border)", color: "var(--c-text)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                        {c.name} <span style={{ color: "var(--c-text-3)", fontSize: 11 }}>· {c.phone}{c.vehicles[0] ? ` · ${c.vehicles[0].plate}` : ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* fallback lead sem cadastro */}
            {!fCustomerId && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Ou digite o nome (lead)" style={{ ...inp, flex: 1 }} />
                <input value={fPlate} onChange={(e) => setFPlate(e.target.value)} placeholder="Placa" style={{ ...inp, width: 110 }} />
              </div>
            )}

            {/* Itens */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "6px 0" }}>
              <p style={{ fontSize: 12, color: "var(--c-text-2)", margin: 0 }}>Itens</p>
              {services.length > 0 && (
                <div onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
                  <button onClick={() => setShowCatalog((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#0066FF", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Tag size={12} /> Adicionar do catálogo</button>
                  {showCatalog && (
                    <div style={{ position: "absolute", top: 26, right: 0, width: 240, maxHeight: 220, overflowY: "auto", background: "var(--c-surface-2)", border: "1px solid var(--c-border-2)", borderRadius: 10, zIndex: 10 }}>
                      {services.map((s) => (
                        <button key={s.id} onClick={() => addCatalogItem(s)} style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "9px 12px", background: "transparent", border: "none", borderBottom: "1px solid var(--c-border)", color: "var(--c-text)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                          <span>{s.name}</span><span style={{ color: "var(--c-text-3)" }}>{fmt(s.price)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {fItems.map((it, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input value={it.name} onChange={(e) => setFItems((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value, serviceId: null } : x))} placeholder="Serviço/item" style={{ ...inp, flex: 1 }} />
                <input type="number" value={it.price} onChange={(e) => setFItems((p) => p.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} placeholder="R$" style={{ ...inp, width: 90 }} />
                {fItems.length > 1 && <button onClick={() => setFItems((p) => p.filter((_, j) => j !== i))} style={{ width: 40, height: 40, borderRadius: 10, color: "#EF4444", cursor: "pointer", border: "1px solid rgba(239,68,68,0.2)", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>}
              </div>
            ))}
            <button onClick={() => setFItems((p) => [...p, { name: "", price: "" }])} style={{ background: "none", border: "none", color: "#0066FF", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: "2px 0", marginBottom: 10 }}>+ adicionar item manual</button>
            <input type="date" value={fValid} onChange={(e) => setFValid(e.target.value)} style={{ ...inp, width: "100%", marginBottom: 10 }} />
            <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder="Observações (opcional)" rows={2} style={{ ...inp, width: "100%", height: "auto", padding: "8px 12px", resize: "vertical", marginBottom: 12 }} />
            {fErr && <p style={{ color: "#F87171", fontSize: 12, margin: "0 0 10px" }}>{fErr}</p>}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "var(--c-text)" }}>Total: {fmt(total)}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setModal(false)} style={ghostBtn}>Cancelar</button>
                <button onClick={handleCreate} disabled={saving} style={{ height: 40, padding: "0 18px", borderRadius: 10, background: saving ? "var(--c-border)" : "#0066FF", color: saving ? "var(--c-text-4)" : "white", border: "none", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{saving ? "Salvando…" : (editingId ? "Salvar" : "Criar")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: converter orçamento em agendamento (escolher data/hora) */}
      {convertQuote && (
        <div onClick={() => !converting && setConvertQuote(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 18, padding: 24, width: "min(420px, 100%)" }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--c-text)", margin: "0 0 6px" }}>Agendar este orçamento</h2>
            <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "0 0 16px" }}>
              Vira um agendamento na Agenda/Comandas pra <strong style={{ color: "var(--c-text-2)" }}>{convertQuote.customerName || "o cliente"}</strong> com os serviços do orçamento.
            </p>
            <label style={{ fontSize: 12, color: "var(--c-text-3)", display: "block", marginBottom: 6 }}>Data e hora</label>
            <input type="datetime-local" value={convertDate} onChange={(e) => setConvertDate(e.target.value)} style={{ ...inp, width: "100%", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConvertQuote(null)} disabled={converting} style={{ ...ghostBtn, flex: 1 }}>Cancelar</button>
              <button onClick={confirmConvert} disabled={!convertDate || converting} style={{ flex: 2, height: 40, borderRadius: 10, border: "none", background: !convertDate || converting ? "var(--c-border)" : "linear-gradient(135deg,#7C3AED,#0066FF)", color: !convertDate || converting ? "var(--c-text-4)" : "#fff", fontSize: 14, fontWeight: 700, cursor: !convertDate || converting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {converting ? "Agendando…" : "Criar agendamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setDeleteTarget(null) }}
        onConfirm={confirmRemove}
        title="Excluir orçamento"
        description="Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
      />

      <MessageTemplatePicker
        open={pickerQuote !== null}
        onClose={() => setPickerQuote(null)}
        context="orcamento"
        phone={pickerQuote?.customerPhone ?? null}
        initialText={pickerQuote ? quoteMessage(pickerQuote) : undefined}
        vars={pickerQuote ? {
          nomeCompleto: pickerQuote.customerName,
          primeiroNome: pickerQuote.customerName ? pickerQuote.customerName.split(" ")[0] : null,
          placa: pickerQuote.plate,
          valor: fmt(pickerQuote.totalPrice),
        } as TemplateVars : {}}
        onSend={() => { if (pickerQuote && pickerQuote.status === "DRAFT") setStatus(pickerQuote.id, "SENT") }}
      />
    </div>
  )
}
