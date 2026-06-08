"use client"

import { useEffect, useState } from "react"
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api"
import { Package, Plus, Minus, AlertTriangle, Trash2 } from "lucide-react"

/** V2-B4 — Estoque de produtos. CRUD + ajuste +/- + alerta de mínimo. */
interface Product {
  id: string; name: string; sku: string | null
  costPrice: number; salePrice: number; stockQty: number; minStock: number
}
const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export default function EstoquePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [modal, setModal] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const [f, setF] = useState({ name: "", sku: "", cost: "", sale: "", qty: "", min: "" })
  const [saving, setSaving] = useState(false); const [fErr, setFErr] = useState("")

  const fetchData = () => {
    setLoading(true)
    apiGet<{ products: Product[] }>("/products").then((r) => setProducts(r.products ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro.")).finally(() => setLoading(false))
  }
  useEffect(fetchData, [])

  async function adjust(id: string, delta: number) {
    setBusy(id)
    try { await apiPut(`/products/${id}/stock`, { delta }); fetchData() } catch { /* */ } finally { setBusy(null) }
  }
  async function remove(id: string) {
    if (!confirm("Remover produto?")) return
    try { await apiDelete(`/products/${id}`); fetchData() } catch { /* */ }
  }
  async function create() {
    if (!f.name.trim()) { setFErr("Nome é obrigatório."); return }
    setSaving(true); setFErr("")
    try {
      await apiPost("/products", {
        name: f.name.trim(), sku: f.sku.trim() || null,
        costPrice: f.cost ? Math.round(Number(f.cost) * 100) : 0,
        salePrice: f.sale ? Math.round(Number(f.sale) * 100) : 0,
        stockQty: f.qty ? Math.round(Number(f.qty)) : 0,
        minStock: f.min ? Math.round(Number(f.min)) : 0,
      })
      setModal(false); setF({ name: "", sku: "", cost: "", sale: "", qty: "", min: "" }); fetchData()
    } catch { setFErr("Erro ao salvar.") } finally { setSaving(false) }
  }

  const inp: React.CSSProperties = { height: 38, padding: "0 12px", background: "#0A0A0A", border: "1px solid #252525", borderRadius: 9, color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }
  const lowCount = products.filter((p) => p.stockQty <= p.minStock).length

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Package size={20} color="#0066FF" />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>Estoque</h1>
        </div>
        <button onClick={() => setModal(true)} style={{ display: "flex", alignItems: "center", gap: 7, height: 40, padding: "0 18px", borderRadius: 10, background: "linear-gradient(135deg,#0066FF,#7C3AED)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          <Plus size={15} /> Novo produto
        </button>
      </div>
      <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 20px" }}>
        Ceras, shampoos, insumos. {lowCount > 0 && <span style={{ color: "#F59E0B", fontWeight: 600 }}>{lowCount} no estoque mínimo ⚠️</span>}
      </p>

      {loading && <p style={{ color: "#71717A", fontSize: 14 }}>Carregando…</p>}
      {error && <p style={{ color: "#F87171", fontSize: 14 }}>{error}</p>}
      {!loading && products.length === 0 && (
        <div style={{ textAlign: "center", padding: "56px 0" }}>
          <Package size={40} color="#2A2A2A" style={{ margin: "0 auto" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginTop: 14 }}>Estoque vazio</p>
          <p style={{ fontSize: 13, color: "#71717A", marginTop: 6 }}>Cadastre seus insumos pra controlar entrada e saída.</p>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {products.map((p) => {
            const low = p.stockQty <= p.minStock
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#0A0A0A", border: `1px solid ${low ? "rgba(245,158,11,0.3)" : "#1F1F1F"}`, borderRadius: 12, padding: "12px 16px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{p.name}</span>
                    {p.sku && <span style={{ fontSize: 11, color: "#71717A" }}>· {p.sku}</span>}
                    {low && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 600, color: "#F59E0B", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 6, padding: "1px 7px" }}><AlertTriangle size={10} /> mínimo</span>}
                  </div>
                  <p style={{ fontSize: 12, color: "#71717A", margin: "2px 0 0" }}>venda {fmt(p.salePrice)} · custo {fmt(p.costPrice)} · mín. {p.minStock}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => adjust(p.id, -1)} disabled={busy === p.id || p.stockQty <= 0} style={{ width: 30, height: 30, borderRadius: 8, background: "#111", border: "1px solid #2A2A2A", color: "#EF4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus size={14} /></button>
                  <span style={{ minWidth: 36, textAlign: "center", fontSize: 16, fontWeight: 800, color: low ? "#F59E0B" : "#fff" }}>{p.stockQty}</span>
                  <button onClick={() => adjust(p.id, 1)} disabled={busy === p.id} style={{ width: 30, height: 30, borderRadius: 8, background: "#111", border: "1px solid #2A2A2A", color: "#10B981", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={14} /></button>
                  <button onClick={() => remove(p.id)} style={{ width: 30, height: 30, borderRadius: 8, background: "transparent", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 4 }}><Trash2 size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#111", border: "1px solid #1F1F1F", borderRadius: 16, padding: 22 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>Novo produto</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nome (ex: Cera Carnaúba)" style={inp} />
              <input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} placeholder="SKU / código (opcional)" style={inp} />
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} placeholder="Custo R$" style={{ ...inp, flex: 1 }} />
                <input type="number" value={f.sale} onChange={(e) => setF({ ...f, sale: e.target.value })} placeholder="Venda R$" style={{ ...inp, flex: 1 }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} placeholder="Qtd inicial" style={{ ...inp, flex: 1 }} />
                <input type="number" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} placeholder="Estoque mínimo" style={{ ...inp, flex: 1 }} />
              </div>
            </div>
            {fErr && <p style={{ color: "#F87171", fontSize: 12, margin: "10px 0 0" }}>{fErr}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setModal(false)} style={{ ...inp, padding: "0 16px", cursor: "pointer", color: "#A1A1AA" }}>Cancelar</button>
              <button onClick={create} disabled={saving} style={{ height: 38, padding: "0 18px", borderRadius: 9, background: saving ? "#1A1A1A" : "#0066FF", color: saving ? "#52525B" : "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{saving ? "Salvando…" : "Criar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
