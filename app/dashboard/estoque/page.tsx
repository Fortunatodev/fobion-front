"use client"

import { useCallback, useEffect, useState } from "react"
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api"
import { Package, Plus, Minus, AlertTriangle, Trash2, Pencil, ArrowDownUp, X, Eye, EyeOff, AlertCircle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import ConfirmDialog from "@/components/shared/ConfirmDialog"

/** V2-B4 — Estoque de produtos. CRUD + ajuste de entrada/saída + alerta de mínimo + KPIs. */
interface Product {
  id: string; name: string; sku: string | null
  costPrice: number; salePrice: number; stockQty: number; minStock: number
}
const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const reais = (c: number) => (c / 100).toString()

type FormState = { name: string; sku: string; cost: string; sale: string; qty: string; min: string }
const EMPTY_FORM: FormState = { name: "", sku: "", cost: "", sale: "", qty: "", min: "" }

export default function EstoquePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [hideValues, setHideValues] = useState(false) // B22 — privacidade no balcão
  const money = (c: number) => (hideValues ? "•••" : fmt(c))

  // modal de cadastro/edição
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [f, setF] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [fErr, setFErr] = useState("")

  // modal de ajuste de estoque (entrada/saída por quantidade)
  const [adjFor, setAdjFor] = useState<Product | null>(null)
  const [adjDir, setAdjDir] = useState<"in" | "out">("in")
  const [adjQty, setAdjQty] = useState("")

  // confirmação de remoção
  const [removeTarget, setRemoveTarget] = useState<Product | null>(null)
  const [removing, setRemoving] = useState(false)

  const fetchData = useCallback(() => {
    setLoading(true); setError("")
    apiGet<{ products: Product[] }>("/products").then((r) => setProducts(r.products ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro.")).finally(() => setLoading(false))
  }, [])
  useEffect(() => { fetchData() }, [fetchData])
  // B05 (ext) — ESC fecha + trava scroll do fundo quando algum modal está aberto
  useEffect(() => {
    if (!modal && !adjFor) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setModal(false); setAdjFor(null) } }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden"
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev }
  }, [modal, adjFor])

  function openCreate() { setEditingId(null); setF(EMPTY_FORM); setFErr(""); setModal(true) }
  function openEdit(p: Product) {
    setEditingId(p.id)
    setF({ name: p.name, sku: p.sku ?? "", cost: reais(p.costPrice), sale: reais(p.salePrice), qty: "", min: String(p.minStock) })
    setFErr(""); setModal(true)
  }

  async function save() {
    if (!f.name.trim()) { setFErr("Nome é obrigatório."); toast.error("Preencha o nome do produto."); return }
    setSaving(true); setFErr("")
    const payload = {
      name: f.name.trim(), sku: f.sku.trim() || null,
      costPrice: f.cost ? Math.round(Number(f.cost) * 100) : 0,
      salePrice: f.sale ? Math.round(Number(f.sale) * 100) : 0,
      minStock: f.min ? Math.round(Number(f.min)) : 0,
    }
    try {
      if (editingId) {
        await apiPut(`/products/${editingId}`, payload)
      } else {
        await apiPost("/products", { ...payload, stockQty: f.qty ? Math.round(Number(f.qty)) : 0 })
      }
      setModal(false); setF(EMPTY_FORM); setEditingId(null); fetchData()
      toast.success(editingId ? "Produto atualizado." : `"${payload.name}" cadastrado no estoque.`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar."
      setFErr(msg); toast.error(msg)
    } finally { setSaving(false) }
  }

  async function quickAdjust(id: string, delta: number) {
    setBusy(id)
    try { await apiPut(`/products/${id}/stock`, { delta }); fetchData() }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao ajustar estoque.") }
    finally { setBusy(null) }
  }

  async function doAdjust() {
    if (!adjFor) return
    const n = Math.round(Number(adjQty))
    if (!n || n <= 0) { toast.error("Informe uma quantidade maior que zero."); return }
    const delta = adjDir === "in" ? n : -n
    const target = adjFor
    setBusy(target.id)
    try {
      await apiPut(`/products/${target.id}/stock`, { delta }); setAdjFor(null); setAdjQty(""); fetchData()
      toast.success(`${adjDir === "in" ? "Entrada" : "Saída"} de ${n} em "${target.name}".`)
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao ajustar estoque.") }
    finally { setBusy(null) }
  }

  async function confirmRemove() {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await apiDelete(`/products/${removeTarget.id}`)
      fetchData()
      toast.success(`"${removeTarget.name}" removido do estoque.`)
      setRemoveTarget(null)
    } catch (e) {
      toast.error((e as Error).message || "Erro ao remover.")
    } finally {
      setRemoving(false)
    }
  }

  // estilos base
  const inp: React.CSSProperties = { width: "100%", height: 44, padding: "0 14px", background: "var(--c-input-bg)", border: "1px solid var(--c-border-2)", borderRadius: 10, color: "var(--c-text)", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }
  const ghostBtn: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 40, padding: "0 16px", borderRadius: 10, background: "transparent", border: "1px solid var(--c-border-2)", color: "var(--c-text-2)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }
  const iconBtn = (color: string, border: string): React.CSSProperties => ({ width: 32, height: 32, borderRadius: 8, background: "var(--c-surface)", border: `1px solid ${border}`, color, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 })

  // KPIs
  const totalUnits = products.reduce((s, p) => s + p.stockQty, 0)
  const stockValue = products.reduce((s, p) => s + p.costPrice * p.stockQty, 0)
  const lowCount = products.filter((p) => p.stockQty > 0 && p.stockQty <= p.minStock).length
  const zeroCount = products.filter((p) => p.stockQty === 0).length

  const KPIS = [
    { label: "Itens em estoque", value: String(totalUnits), color: "var(--c-text)", sub: `${products.length} produto${products.length !== 1 ? "s" : ""}` },
    { label: "Valor em estoque", value: money(stockValue), color: "var(--c-text)", sub: "a custo" },
    { label: "Baixo estoque", value: String(lowCount), color: lowCount > 0 ? "#F59E0B" : "var(--c-text-3)", sub: "no mínimo ou abaixo" },
    { label: "Zerados", value: String(zeroCount), color: zeroCount > 0 ? "#EF4444" : "var(--c-text-3)", sub: "sem unidades" },
  ]

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Package size={22} color="#0066FF" />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>Estoque</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setHideValues((v) => !v)} title={hideValues ? "Mostrar valores" : "Ocultar valores (balcão)"} style={{ width: 40, height: 40, borderRadius: 10, background: "transparent", border: "1px solid var(--c-border-2)", color: "var(--c-text-3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {hideValues ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 7, height: 40, padding: "0 18px", borderRadius: 10, background: "linear-gradient(135deg,#0066FF,#7C3AED)", color: "white", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <Plus size={15} /> Novo produto
          </button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "0 0 20px" }}>Ceras, shampoos, insumos — controle entrada e saída.</p>

      {/* KPIs */}
      {!loading && products.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 22 }}>
          {KPIS.map((k) => (
            <div key={k.label} style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "14px 16px" }}>
              <p style={{ fontSize: 11, color: "var(--c-text-3)", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{k.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: k.color, margin: "6px 0 2px", letterSpacing: "-0.5px" }}>{k.value}</p>
              <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: 0 }}>{k.sub}</p>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <>
          <style>{`@keyframes estSkel{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 66, background: "var(--c-elevated)", border: "1px solid var(--c-border)", borderRadius: 12, animation: `estSkel 1.5s ease ${i * 0.1}s infinite` }} />
            ))}
          </div>
        </>
      )}
      {!loading && error && (
        <div style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <AlertCircle size={14} color="#EF4444" />
          <span style={{ fontSize: 13, color: "#EF4444" }}>{error}</span>
          <button onClick={fetchData} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 8, background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <RefreshCw size={13} /> Tentar novamente
          </button>
        </div>
      )}
      {!loading && !error && products.length === 0 && (
        <div style={{ textAlign: "center", padding: "56px 0" }}>
          <Package size={40} color="var(--c-border-2)" style={{ margin: "0 auto" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--c-text)", marginTop: 14 }}>Estoque vazio</p>
          <p style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 6 }}>Cadastre seus insumos pra controlar entrada e saída.</p>
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* ordena: baixo/zerado primeiro */}
          {[...products].sort((a, b) => (a.stockQty <= a.minStock ? 0 : 1) - (b.stockQty <= b.minStock ? 0 : 1)).map((p) => {
            const low = p.stockQty <= p.minStock
            const zero = p.stockQty === 0
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--c-elevated)", border: `1px solid ${zero ? "rgba(239,68,68,0.3)" : low ? "rgba(245,158,11,0.3)" : "var(--c-border)"}`, borderRadius: 12, padding: "12px 16px", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>{p.name}</span>
                    {p.sku && <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>· {p.sku}</span>}
                    {zero
                      ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 600, color: "#EF4444", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, padding: "1px 7px" }}><AlertTriangle size={10} /> zerado</span>
                      : low && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 600, color: "#F59E0B", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 6, padding: "1px 7px" }}><AlertTriangle size={10} /> mínimo</span>}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "2px 0 0" }}>venda {money(p.salePrice)} · custo {money(p.costPrice)} · mín. {p.minStock}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <button title="Saída de 1" onClick={() => quickAdjust(p.id, -1)} disabled={busy === p.id || p.stockQty <= 0} style={{ ...iconBtn("#EF4444", "var(--c-border-2)"), opacity: p.stockQty <= 0 ? 0.4 : 1, width: 30, height: 30 }}><Minus size={14} /></button>
                  <span style={{ minWidth: 36, textAlign: "center", fontSize: 16, fontWeight: 800, color: zero ? "#EF4444" : low ? "#F59E0B" : "var(--c-text)" }}>{p.stockQty}</span>
                  <button title="Entrada de 1" onClick={() => quickAdjust(p.id, 1)} disabled={busy === p.id} style={{ ...iconBtn("#10B981", "var(--c-border-2)"), width: 30, height: 30 }}><Plus size={14} /></button>
                  <button title="Ajustar quantidade (lote)" onClick={() => { setAdjFor(p); setAdjDir("in"); setAdjQty("") }} style={iconBtn("#0066FF", "rgba(0,102,255,0.25)")}><ArrowDownUp size={14} /></button>
                  <button title="Editar produto" onClick={() => openEdit(p)} style={iconBtn("var(--c-text-2)", "var(--c-border-2)")}><Pencil size={13} /></button>
                  <button title="Remover" onClick={() => setRemoveTarget(p)} style={iconBtn("#EF4444", "rgba(239,68,68,0.2)")}><Trash2 size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CSS dos modais: remove spinner feio do number + grid de pares que colapsa no mobile */}
      <style>{`
        .est-num::-webkit-outer-spin-button,
        .est-num::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .est-num[type=number] { -moz-appearance: textfield; }
        .est-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        @media (max-width: 380px) { .est-pair { grid-template-columns: 1fr; } }
        .est-foot { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; flex-wrap: wrap; }
        .est-foot > * { min-width: 0; }
        @media (max-width: 380px) { .est-foot > * { flex: 1 1 auto; } }
      `}</style>

      {/* Modal cadastro/edição */}
      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, padding: 22, boxSizing: "border-box" }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--c-text)", margin: "0 0 16px" }}>{editingId ? "Editar produto" : "Novo produto"}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nome (ex: Cera Carnaúba)" style={inp} />
              <input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} placeholder="SKU / código (opcional)" style={inp} />
              <div className="est-pair">
                <input className="est-num" type="number" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} placeholder="Custo R$" style={inp} />
                <input className="est-num" type="number" value={f.sale} onChange={(e) => setF({ ...f, sale: e.target.value })} placeholder="Venda R$" style={inp} />
              </div>
              <div className="est-pair">
                {!editingId && <input className="est-num" type="number" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} placeholder="Qtd inicial" style={inp} />}
                <input className="est-num" type="number" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} placeholder="Estoque mínimo" style={inp} />
              </div>
              {editingId && <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: 0 }}>A quantidade em estoque é alterada pelos botões de entrada/saída na lista.</p>}
            </div>
            {fErr && <p style={{ color: "#F87171", fontSize: 12, margin: "10px 0 0" }}>{fErr}</p>}
            <div className="est-foot">
              <button onClick={() => setModal(false)} style={ghostBtn}>Cancelar</button>
              <button onClick={save} disabled={saving} style={{ height: 40, padding: "0 18px", borderRadius: 10, background: saving ? "var(--c-surface-2)" : "#0066FF", color: saving ? "var(--c-text-4)" : "white", border: "none", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{saving ? "Salvando…" : editingId ? "Salvar" : "Criar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ajuste de estoque (entrada/saída por quantidade) */}
      {adjFor && (
        <div onClick={() => setAdjFor(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, padding: 22, boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>Ajustar estoque</h2>
              <button onClick={() => setAdjFor(null)} style={{ background: "none", border: "none", color: "var(--c-text-3)", cursor: "pointer", padding: 2 }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 13, color: "var(--c-text-2)", margin: "0 0 16px" }}>{adjFor.name} · atual <strong style={{ color: "var(--c-text)" }}>{adjFor.stockQty}</strong></p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button onClick={() => setAdjDir("in")} style={{ flex: 1, height: 40, borderRadius: 10, border: `1px solid ${adjDir === "in" ? "#10B981" : "var(--c-border-2)"}`, background: adjDir === "in" ? "rgba(16,185,129,0.1)" : "transparent", color: adjDir === "in" ? "#10B981" : "var(--c-text-2)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Entrada (+)</button>
              <button onClick={() => setAdjDir("out")} style={{ flex: 1, height: 40, borderRadius: 10, border: `1px solid ${adjDir === "out" ? "#EF4444" : "var(--c-border-2)"}`, background: adjDir === "out" ? "rgba(239,68,68,0.1)" : "transparent", color: adjDir === "out" ? "#EF4444" : "var(--c-text-2)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Saída (−)</button>
            </div>
            <input className="est-num" autoFocus type="number" value={adjQty} onChange={(e) => setAdjQty(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doAdjust() }} placeholder="Quantidade" style={inp} />
            <div className="est-foot">
              <button onClick={() => setAdjFor(null)} style={ghostBtn}>Cancelar</button>
              <button onClick={doAdjust} disabled={busy === adjFor.id || !adjQty} style={{ height: 40, padding: "0 18px", borderRadius: 10, background: !adjQty ? "var(--c-surface-2)" : "#0066FF", color: !adjQty ? "var(--c-text-4)" : "white", border: "none", fontSize: 13, fontWeight: 600, cursor: !adjQty ? "not-allowed" : "pointer", fontFamily: "inherit" }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={confirmRemove}
        title="Remover produto"
        description={removeTarget ? `Remover "${removeTarget.name}" do estoque?` : ""}
        confirmLabel="Remover"
        variant="danger"
        loading={removing}
      />
    </div>
  )
}
