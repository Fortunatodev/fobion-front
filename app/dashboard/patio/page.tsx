"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { apiGet, apiPut } from "@/lib/api"
import { LayoutGrid, Clock, Car, ChevronRight, RefreshCw, ShieldCheck } from "lucide-react"

/**
 * V2-B4 — Pátio (kanban operacional do dia). Aguardando → Em atendimento → Pronto.
 * Reusa GET /schedules?date= e PUT /schedules/:id/status. Ref: WashAI/ClickLava.
 */
interface Schedule {
  id: string; scheduledAt: string
  status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "DONE" | "CANCELLED"
  totalPrice: number
  customer?: { name: string } | null
  vehicle?: { plate: string | null; model: string | null } | null
  scheduleServices?: Array<{ service: { name: string } }>
}

const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}` }

const COLUMNS = [
  { key: "wait",  title: "Aguardando",     color: "#F59E0B", match: (s: Schedule) => s.status === "PENDING" || s.status === "CONFIRMED", next: "IN_PROGRESS", cta: "Iniciar →" },
  { key: "doing", title: "Em atendimento", color: "#0066FF", match: (s: Schedule) => s.status === "IN_PROGRESS", next: "DONE", cta: "Finalizar ✓" },
  { key: "done",  title: "Pronto / Entregue", color: "#10B981", match: (s: Schedule) => s.status === "DONE", next: null, cta: null },
] as const

export default function PatioPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [moving, setMoving] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10)
    setLoading(true)
    apiGet<{ schedules: Schedule[] }>(`/schedules?date=${today}`)
      .then((r) => setSchedules(r.schedules ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoading(false))
  }, [])
  useEffect(fetchData, [fetchData])

  async function advance(id: string, next: string) {
    setMoving(id)
    try { await apiPut(`/schedules/${id}/status`, { status: next }); fetchData() }
    catch { /* noop */ } finally { setMoving(null) }
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LayoutGrid size={22} color="#0066FF" />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>Pátio</h1>
        </div>
        <button onClick={fetchData} style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: 9, background: "transparent", border: "1px solid var(--c-border)", color: "var(--c-text-2)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>
      <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "0 0 24px" }}>Fila operacional de hoje. Mova os carros conforme avançam.</p>

      {loading && <p style={{ color: "var(--c-text-3)", fontSize: 14 }}>Carregando…</p>}
      {error && <p style={{ color: "#F87171", fontSize: 14 }}>{error}</p>}

      {!loading && !error && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 14 }}>
          {COLUMNS.map((col) => {
            const cards = schedules.filter(col.match).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
            return (
              <div key={col.key} style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 14, padding: 12, minHeight: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "0 4px" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text)" }}>{col.title}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--c-text-3)", fontWeight: 600 }}>{cards.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {cards.length === 0 && <p style={{ fontSize: 12, color: "var(--c-text-4)", textAlign: "center", padding: "20px 0" }}>—</p>}
                  {cards.map((s) => (
                    <div key={s.id} style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Clock size={12} color="var(--c-text-3)" />
                        <span style={{ fontSize: 12, color: "var(--c-text-2)", fontWeight: 600 }}>{hhmm(s.scheduledAt)}</span>
                        <span style={{ marginLeft: "auto", fontSize: 12, color: "#10B981", fontWeight: 700 }}>{fmt(s.totalPrice)}</span>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", margin: 0 }}>{s.customer?.name ?? "Cliente"}</p>
                      <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "1px 0 0", display: "flex", alignItems: "center", gap: 5 }}>
                        <Car size={11} /> {[s.vehicle?.plate, s.vehicle?.model].filter(Boolean).join(" · ") || "veículo"}
                      </p>
                      {s.scheduleServices && s.scheduleServices.length > 0 && (
                        <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: "3px 0 0" }}>{s.scheduleServices.map((x) => x.service?.name).filter(Boolean).join(", ")}</p>
                      )}
                      {col.next && (
                        <button
                          onClick={() => advance(s.id, col.next!)}
                          disabled={moving === s.id}
                          style={{ marginTop: 8, width: "100%", height: 30, borderRadius: 8, background: `${col.color}1A`, border: `1px solid ${col.color}40`, color: col.color, fontSize: 12, fontWeight: 600, cursor: moving === s.id ? "wait" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                        >
                          {moving === s.id ? "..." : <>{col.cta} <ChevronRight size={13} /></>}
                        </button>
                      )}
                      <Link href={`/dashboard/vistoria/${s.id}`} style={{ marginTop: 6, height: 28, borderRadius: 8, background: "transparent", border: "1px solid var(--c-border)", color: "var(--c-text-3)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, textDecoration: "none" }}>
                        <ShieldCheck size={12} /> Vistoria
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
