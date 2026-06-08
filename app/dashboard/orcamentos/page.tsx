"use client"

import { useEffect, useState } from "react"
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api"
import { FileText, Plus, Check, X, Trash2, ShoppingCart, Send, Search, Tag } from "lucide-react"

/**
 * V2-B3 — Orçamentos. Cliente do CRM + itens do catálogo → proposta → envia no
 * WhatsApp → aprova → vira venda. Ref: CERA (módulo de 1ª classe).
 */
interface QuoteItem { serviceId?: string | null; name: string; price: number }
interface Quote {
  id: string; customerName: string | null; plate: string | null
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

export default function OrcamentosPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [modal, setModal] = useState(false)
  const [services, setServices] = useState<ServiceItem[]>([])

  // form
  const [fName, setFName] = useState("")
  const [fPlate, setFPlate] = useState("")
  const [fPhone, setFPhone] = useState("")
  const [fCustomerId, setFCustomerId] = useState<string | null>(null)
  const [fVehicleId, setFVehicleId] = useState<string | null>(null)
  const [fNotes, setFNotes] = useState("")
  const [fValid, setFValid] = useState("")
  const [fItems, setFItems] = useState<{ serviceId?: string | null; name: string; price: string }[]>([{ name: "", price: "" }])
  const [saving, setSaving] = useState(false)
  const [fErr, setFErr] = useState("")

  // busca de cliente
  const [custQuery, setCustQuery] = useState("")
  const [custResults, setCustResults] = useState<CustomerResult[]>([])
  const [showCust, setShowCust] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)

  const fetchQuotes = () => {
    setLoading(true)
    apiGet<{ quotes: Quote[] }>("/quotes")
      .then((r) => setQuotes(r.quotes ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoading(false))
  }
  useEffect(fetchQuotes, [])
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
    setFCustomerId(c.id); setFName(c.name); setFPhone(c.phone)
    if (c.vehicles.length >= 1) { setFPlate(c.vehicles[0].plate); setFVehicleId(c.vehicles[0].id) }
    setShowCust(false); setCustQuery(""); setCustResults([])
  }
  function clearCustomer() { setFCustomerId(null); setFVehicleId(null); setFName(""); setFPlate(""); setFPhone("") }

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
    setFName(""); setFPlate(""); setFPhone(""); setFCustomerId(null); setFVehicleId(null)
    setFNotes(""); setFValid(""); setFItems([{ name: "", price: "" }]); setCustQuery(""); setCustResults([])
  }

  async function handleCreate() {
    const items = fItems.filter((it) => it.name.trim() && Number(it.price) > 0)
      .map((it) => ({ serviceId: it.serviceId ?? null, name: it.name.trim(), price: Math.round(Number(it.price) * 100) }))
    if (items.length === 0) { setFErr("Adicione ao menos um item com nome e preço."); return }
    setSaving(true); setFErr("")
    try {
      await apiPost("/quotes", {
        customerId: fCustomerId, vehicleId: fVehicleId,
        customerName: fName.trim() || null, plate: fPlate.trim() || null,
        items, notes: fNotes.trim() || null,
        validUntil: fValid ? new Date(fValid).toISOString() : null,
      })
      setModal(false); resetForm(); fetchQuotes()
    } catch { setFErr("Erro ao salvar.") } finally { setSaving(false) }
  }

  async function setStatus(id: string, status: string) {
    try { await apiPut(`/quotes/${id}/status`, { status }); fetchQuotes() } catch { /* noop */ }
  }
  function sendWhatsApp(q: Quote, markSent = false) {
    const msg = quoteMessage(q)
    window.open(`https://api.whatsapp.com/send/?text=${encodeURIComponent(msg)}`, "_blank")
    if (markSent && q.status === "DRAFT") setStatus(q.id, "SENT")
  }
  async function remove(id: string) {
    if (!confirm("Excluir este orçamento?")) return
    try { await apiDelete(`/quotes/${id}`); fetchQuotes() } catch { /* noop */ }
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
      <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "0 0 24px" }}>Monte propostas (ticket alto: vitrificação, PPF), envie no WhatsApp e converta em venda.</p>

      {loading && <p style={{ color: "var(--c-text-3)", fontSize: 14 }}>Carregando…</p>}
      {error && <p style={{ color: "#F87171", fontSize: 14 }}>{error}</p>}

      {!loading && quotes.length === 0 && (
        <div style={{ textAlign: "center", padding: "56px 0" }}>
          <FileText size={40} color="var(--c-border-2)" style={{ margin: "0 auto" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--c-text)", marginTop: 14 }}>Nenhum orçamento ainda</p>
          <p style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 6 }}>Crie uma proposta pra um serviço de ticket alto.</p>
        </div>
      )}

      {!loading && quotes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {quotes.map((q) => {
            const st = STATUS[q.status] ?? { label: q.status, color: "var(--c-text-3)" }
            const expired = isExpired(q)
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
                      <button onClick={() => sendWhatsApp(q, true)} style={pill("rgba(0,102,255,0.12)", "rgba(0,102,255,0.25)", "#0066FF")}><Send size={13} /> {q.status === "DRAFT" ? "Enviar no WhatsApp" : "Reenviar"}</button>
                      <button onClick={() => setStatus(q.id, "APPROVED")} style={pill("rgba(16,185,129,0.12)", "rgba(16,185,129,0.25)", "#10B981")}><Check size={13} /> Aprovar</button>
                      <button onClick={() => setStatus(q.id, "REJECTED")} style={ghostBtn}><X size={13} /> Recusar</button>
                    </>
                  )}
                  {q.status === "APPROVED" && (
                    <>
                      <button onClick={() => setStatus(q.id, "CONVERTED")} style={pill("rgba(245,158,11,0.12)", "rgba(245,158,11,0.25)", "#F59E0B")}><ShoppingCart size={13} /> Marcar como vendido</button>
                      <button onClick={() => sendWhatsApp(q)} style={pill("rgba(0,102,255,0.12)", "rgba(0,102,255,0.25)", "#0066FF")}><Send size={13} /> Reenviar</button>
                    </>
                  )}
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
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, padding: 22, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--c-text)", margin: "0 0 16px" }}>Novo orçamento</h2>

            {/* Cliente do CRM */}
            {fCustomerId ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", marginBottom: 10, borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <span style={{ fontSize: 13, color: "var(--c-text)" }}>👤 {fName}{fPlate ? ` · ${fPlate}` : ""}</span>
                <button onClick={clearCustomer} style={{ background: "none", border: "none", color: "var(--c-text-3)", cursor: "pointer" }}><X size={16} /></button>
              </div>
            ) : (
              <div style={{ position: "relative", marginBottom: 10 }}>
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
                <div style={{ position: "relative" }}>
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
                <button onClick={handleCreate} disabled={saving} style={{ height: 40, padding: "0 18px", borderRadius: 10, background: saving ? "var(--c-border)" : "#0066FF", color: saving ? "var(--c-text-4)" : "var(--c-text)", border: "none", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{saving ? "Salvando…" : "Criar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
