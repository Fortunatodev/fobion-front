"use client"

import { useEffect, useState } from "react"
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api"
import { FileText, Plus, Check, X, Trash2, ShoppingCart } from "lucide-react"

/**
 * V2-B3 — Orçamentos. Proposta → aprovação → vira venda. Ref: CERA (módulo 1ª classe).
 */
interface QuoteItem { serviceId?: string | null; name: string; price: number }
interface Quote {
  id: string; customerName: string | null; plate: string | null
  items: QuoteItem[]; totalPrice: number; notes: string | null
  status: string; validUntil: string | null; createdAt: string
}

const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const STATUS: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: "Rascunho",  color: "#71717A" },
  SENT:      { label: "Enviado",   color: "#0066FF" },
  APPROVED:  { label: "Aprovado",  color: "#10B981" },
  REJECTED:  { label: "Recusado",  color: "#EF4444" },
  CONVERTED: { label: "Vendido",   color: "#F59E0B" },
}

export default function OrcamentosPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [modal, setModal] = useState(false)

  // form
  const [fName, setFName] = useState("")
  const [fPlate, setFPlate] = useState("")
  const [fNotes, setFNotes] = useState("")
  const [fValid, setFValid] = useState("")
  const [fItems, setFItems] = useState<{ name: string; price: string }[]>([{ name: "", price: "" }])
  const [saving, setSaving] = useState(false)
  const [fErr, setFErr] = useState("")

  const fetchQuotes = () => {
    setLoading(true)
    apiGet<{ quotes: Quote[] }>("/quotes")
      .then((r) => setQuotes(r.quotes ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoading(false))
  }
  useEffect(fetchQuotes, [])

  const total = fItems.reduce((a, it) => a + (Number(it.price) > 0 ? Math.round(Number(it.price) * 100) : 0), 0)

  async function handleCreate() {
    const items = fItems.filter((it) => it.name.trim() && Number(it.price) > 0)
      .map((it) => ({ name: it.name.trim(), price: Math.round(Number(it.price) * 100) }))
    if (items.length === 0) { setFErr("Adicione ao menos um item com nome e preço."); return }
    setSaving(true); setFErr("")
    try {
      await apiPost("/quotes", {
        customerName: fName.trim() || null, plate: fPlate.trim() || null,
        items, notes: fNotes.trim() || null,
        validUntil: fValid ? new Date(fValid).toISOString() : null,
      })
      setModal(false)
      setFName(""); setFPlate(""); setFNotes(""); setFValid(""); setFItems([{ name: "", price: "" }])
      fetchQuotes()
    } catch { setFErr("Erro ao salvar.") } finally { setSaving(false) }
  }

  async function setStatus(id: string, status: string) {
    try { await apiPut(`/quotes/${id}/status`, { status }); fetchQuotes() } catch { /* noop */ }
  }
  async function remove(id: string) {
    if (!confirm("Excluir este orçamento?")) return
    try { await apiDelete(`/quotes/${id}`); fetchQuotes() } catch { /* noop */ }
  }

  const inp: React.CSSProperties = { height: 38, padding: "0 12px", background: "#0A0A0A", border: "1px solid #252525", borderRadius: 9, color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FileText size={20} color="#0066FF" />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>Orçamentos</h1>
        </div>
        <button onClick={() => setModal(true)} style={{ display: "flex", alignItems: "center", gap: 7, height: 40, padding: "0 18px", borderRadius: 10, background: "linear-gradient(135deg,#0066FF,#7C3AED)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          <Plus size={15} /> Novo orçamento
        </button>
      </div>
      <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 24px" }}>Monte propostas (ticket alto: vitrificação, PPF), aprove e converta em venda.</p>

      {loading && <p style={{ color: "#71717A", fontSize: 14 }}>Carregando…</p>}
      {error && <p style={{ color: "#F87171", fontSize: 14 }}>{error}</p>}

      {!loading && quotes.length === 0 && (
        <div style={{ textAlign: "center", padding: "56px 0" }}>
          <FileText size={40} color="#2A2A2A" style={{ margin: "0 auto" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginTop: 14 }}>Nenhum orçamento ainda</p>
          <p style={{ fontSize: 13, color: "#71717A", marginTop: 6 }}>Crie uma proposta pra um serviço de ticket alto.</p>
        </div>
      )}

      {!loading && quotes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {quotes.map((q) => {
            const st = STATUS[q.status] ?? { label: q.status, color: "#71717A" }
            return (
              <div key={q.id} style={{ background: "#0A0A0A", border: "1px solid #1F1F1F", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{q.customerName || "Cliente"}</span>
                  {q.plate && <span style={{ fontSize: 11, fontWeight: 600, color: "#A1A1AA", background: "#1A1A1A", borderRadius: 5, padding: "1px 7px" }}>{q.plate}</span>}
                  <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: `${st.color}1A`, border: `1px solid ${st.color}33`, borderRadius: 6, padding: "1px 8px" }}>{st.label}</span>
                  <span style={{ marginLeft: "auto", fontSize: 16, fontWeight: 800, color: "#fff" }}>{fmt(q.totalPrice)}</span>
                </div>
                <p style={{ fontSize: 12, color: "#71717A", margin: "6px 0 0" }}>
                  {(q.items ?? []).map((i) => i.name).join(" · ")}
                  {q.validUntil && ` · válido até ${new Date(q.validUntil).toLocaleDateString("pt-BR")}`}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {(q.status === "DRAFT" || q.status === "SENT") && (
                    <>
                      <button onClick={() => setStatus(q.id, "APPROVED")} style={{ display: "flex", alignItems: "center", gap: 5, height: 30, padding: "0 12px", borderRadius: 8, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#10B981", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Check size={13} /> Aprovar</button>
                      <button onClick={() => setStatus(q.id, "REJECTED")} style={{ display: "flex", alignItems: "center", gap: 5, height: 30, padding: "0 12px", borderRadius: 8, background: "transparent", border: "1px solid #2A2A2A", color: "#A1A1AA", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><X size={13} /> Recusar</button>
                    </>
                  )}
                  {q.status === "APPROVED" && (
                    <button onClick={() => setStatus(q.id, "CONVERTED")} style={{ display: "flex", alignItems: "center", gap: 5, height: 30, padding: "0 12px", borderRadius: 8, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", color: "#F59E0B", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><ShoppingCart size={13} /> Marcar como vendido</button>
                  )}
                  <button onClick={() => remove(q.id)} style={{ display: "flex", alignItems: "center", gap: 5, height: 30, padding: "0 10px", borderRadius: 8, background: "transparent", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginLeft: "auto" }}><Trash2 size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal criar */}
      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#111", border: "1px solid #1F1F1F", borderRadius: 16, padding: 22, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>Novo orçamento</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Cliente (opcional)" style={{ ...inp, flex: 1 }} />
              <input value={fPlate} onChange={(e) => setFPlate(e.target.value)} placeholder="Placa" style={{ ...inp, width: 110 }} />
            </div>
            <p style={{ fontSize: 12, color: "#A1A1AA", margin: "6px 0 6px" }}>Itens</p>
            {fItems.map((it, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input value={it.name} onChange={(e) => setFItems((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Serviço/item" style={{ ...inp, flex: 1 }} />
                <input type="number" value={it.price} onChange={(e) => setFItems((p) => p.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} placeholder="R$" style={{ ...inp, width: 90 }} />
                {fItems.length > 1 && <button onClick={() => setFItems((p) => p.filter((_, j) => j !== i))} style={{ ...inp, width: 38, color: "#EF4444", cursor: "pointer", border: "1px solid rgba(239,68,68,0.2)" }}>×</button>}
              </div>
            ))}
            <button onClick={() => setFItems((p) => [...p, { name: "", price: "" }])} style={{ background: "none", border: "none", color: "#0066FF", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: "2px 0", marginBottom: 10 }}>+ adicionar item</button>
            <input type="date" value={fValid} onChange={(e) => setFValid(e.target.value)} style={{ ...inp, width: "100%", marginBottom: 10 }} />
            <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder="Observações (opcional)" rows={2} style={{ ...inp, width: "100%", height: "auto", padding: "8px 12px", resize: "vertical", marginBottom: 12 }} />
            {fErr && <p style={{ color: "#F87171", fontSize: 12, margin: "0 0 10px" }}>{fErr}</p>}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Total: {fmt(total)}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setModal(false)} style={{ ...inp, padding: "0 16px", cursor: "pointer", color: "#A1A1AA" }}>Cancelar</button>
                <button onClick={handleCreate} disabled={saving} style={{ height: 38, padding: "0 18px", borderRadius: 9, background: saving ? "#1A1A1A" : "#0066FF", color: saving ? "#52525B" : "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{saving ? "Salvando…" : "Criar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
