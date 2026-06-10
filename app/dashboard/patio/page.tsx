"use client"

import { useEffect, useState, useCallback, type CSSProperties } from "react"
import Link from "next/link"
import { apiGet, apiPut } from "@/lib/api"
import { useUser } from "@/contexts/UserContext"
import { LayoutGrid, Clock, Car, ChevronRight, RefreshCw, ShieldCheck, AlertCircle, GripVertical } from "lucide-react"
import { toast } from "sonner"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import PromptModal from "@/components/shared/PromptModal"
import AutoAnimate from "@/components/shared/AutoAnimate"

/**
 * V2-B4 — Pátio (kanban operacional do dia). Aguardando → Em atendimento → Pronto.
 * Reusa GET /schedules?date= e PUT /schedules/:id/status. Ref: WashAI/ClickLava.
 * Drag-and-drop entre colunas (@dnd-kit) com pointer + touch; botões mantidos como fallback.
 */
interface Schedule {
  id: string; scheduledAt: string
  status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "DONE" | "CANCELLED"
  totalPrice: number
  customer?: { name: string } | null
  vehicle?: { plate: string | null; model: string | null } | null
  scheduleServices?: Array<{ service: { name: string } }>
}

type Status = Schedule["status"]
type ColumnKey = "wait" | "doing" | "done"
/** Visibilidade da Vistoria no card: ligada (Pro + habilitada) | só selo Pro (não-Pro) | oculta */
type VistoriaState = "on" | "pro" | "off"

const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}` }

interface Column {
  key: ColumnKey
  title: string
  color: string
  match: (s: Schedule) => boolean
  /** status alvo ao soltar um card NESTA coluna (mesmo p/ done) */
  dropStatus: Status
  /** próximo status do botão de avanço; null = sem botão */
  next: Status | null
  cta: string | null
}

const COLUMNS: Column[] = [
  { key: "wait",  title: "Aguardando",        color: "#F59E0B", match: (s) => s.status === "PENDING" || s.status === "CONFIRMED", dropStatus: "CONFIRMED", next: "IN_PROGRESS", cta: "Iniciar →" },
  { key: "doing", title: "Em atendimento",    color: "#0066FF", match: (s) => s.status === "IN_PROGRESS",                          dropStatus: "IN_PROGRESS", next: "DONE",      cta: "Finalizar ✓" },
  { key: "done",  title: "Pronto / Entregue", color: "#10B981", match: (s) => s.status === "DONE",                                 dropStatus: "DONE",      next: null,         cta: null },
]

const COL_OF: Record<ColumnKey, Column> = COLUMNS.reduce((acc, c) => { acc[c.key] = c; return acc }, {} as Record<ColumnKey, Column>)
/** Mapeia um schedule para a coluna a que pertence hoje (p/ saber a origem do drag) */
const columnKeyOf = (s: Schedule): ColumnKey | null => COLUMNS.find((c) => c.match(s))?.key ?? null

// ── Card (conteúdo visual, reutilizado no card real e no DragOverlay) ──────────
function CardBody({
  s, col, moving, onAdvance, vistoria, dragging,
}: {
  s: Schedule
  col: Column
  moving: string | null
  onAdvance: (id: string, next: Status) => void
  vistoria: VistoriaState
  dragging?: boolean
}) {
  return (
    <div
      style={{
        background: "var(--c-surface)",
        border: `1px solid ${dragging ? col.color + "66" : "var(--c-border)"}`,
        borderRadius: 10,
        padding: "10px 12px",
        boxShadow: dragging ? "0 12px 28px rgba(0,0,0,0.28)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Clock size={12} color="var(--c-text-3)" />
        <span style={{ fontSize: 12, color: "var(--c-text-2)", fontWeight: 600 }}>{hhmm(s.scheduledAt)}</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#10B981", fontWeight: 700 }}>{fmt(s.totalPrice)}</span>
        <GripVertical size={14} color="var(--c-text-4)" style={{ marginLeft: 2 }} aria-hidden />
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
          onClick={() => onAdvance(s.id, col.next!)}
          disabled={moving === s.id}
          // não deixa o pointer iniciar drag a partir do botão
          onPointerDown={(e) => e.stopPropagation()}
          style={{ marginTop: 8, width: "100%", height: 30, borderRadius: 8, background: `${col.color}1A`, border: `1px solid ${col.color}40`, color: col.color, fontSize: 12, fontWeight: 600, cursor: moving === s.id ? "wait" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
        >
          {moving === s.id ? "..." : <>{col.cta} <ChevronRight size={13} /></>}
        </button>
      )}
      {vistoria === "on" && (
        <Link
          href={`/dashboard/vistoria/${s.id}`}
          onPointerDown={(e) => e.stopPropagation()}
          style={{ marginTop: 6, height: 28, borderRadius: 8, background: "transparent", border: "1px solid var(--c-border)", color: "var(--c-text-3)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, textDecoration: "none" }}
        >
          <ShieldCheck size={12} /> Vistoria
        </Link>
      )}
      {vistoria === "pro" && (
        <Link
          href="/dashboard/configuracoes?tab=plano"
          onPointerDown={(e) => e.stopPropagation()}
          title="Vistoria disponível no plano Pro"
          style={{ marginTop: 6, height: 28, borderRadius: 8, background: "transparent", border: "1px dashed var(--c-border-2)", color: "var(--c-text-4)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, textDecoration: "none" }}
        >
          <ShieldCheck size={12} /> Vistoria
          <span style={{ fontSize: 9, fontWeight: 700, color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 5, padding: "1px 5px", letterSpacing: "0.5px" }}>PRO</span>
        </Link>
      )}
    </div>
  )
}

// ── Card arrastável ────────────────────────────────────────────────────────────
function DraggableCard({
  s, col, moving, onAdvance, vistoria,
}: {
  s: Schedule
  col: Column
  moving: string | null
  onAdvance: (id: string, next: Status) => void
  vistoria: VistoriaState
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: s.id,
    data: { from: col.key },
  })
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    // o card original some quando vira overlay (evita duplicata visual)
    opacity: isDragging ? 0 : 1,
    cursor: "grab",
    touchAction: "manipulation",
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardBody s={s} col={col} moving={moving} onAdvance={onAdvance} vistoria={vistoria} />
    </div>
  )
}

// ── Coluna droppable ─────────────────────────────────────────────────────────
function DroppableColumn({
  col, cards, moving, onAdvance, activeFrom, vistoria,
}: {
  col: Column
  cards: Schedule[]
  moving: string | null
  onAdvance: (id: string, next: Status) => void
  activeFrom: ColumnKey | null
  vistoria: VistoriaState
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key, data: { col: col.key } })
  // realça a coluna como alvo válido só quando há um drag de OUTRA coluna em curso
  const isTarget = activeFrom !== null && activeFrom !== col.key
  const highlight = isOver && isTarget
  return (
    <div
      ref={setNodeRef}
      style={{
        background: "var(--c-bg)",
        border: `1px solid ${highlight ? col.color : isTarget ? col.color + "55" : "var(--c-border)"}`,
        outline: highlight ? `2px solid ${col.color}55` : "none",
        outlineOffset: -1,
        borderRadius: 14,
        padding: 12,
        minHeight: 200,
        scrollSnapAlign: "start",
        transition: "border-color .15s ease, background .15s ease",
        boxSizing: "border-box",
        ...(highlight ? { background: `${col.color}0D` } : {}),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "0 4px" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text)" }}>{col.title}</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--c-text-3)", fontWeight: 600 }}>{cards.length}</span>
      </div>
      <AutoAnimate style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {cards.length === 0 && (
          <p style={{ fontSize: 12, color: highlight ? col.color : "var(--c-text-4)", textAlign: "center", padding: "20px 0", fontWeight: highlight ? 600 : 400 }}>
            {highlight ? "Solte aqui" : "—"}
          </p>
        )}
        {cards.map((s) => (
          <DraggableCard key={s.id} s={s} col={col} moving={moving} onAdvance={onAdvance} vistoria={vistoria} />
        ))}
      </AutoAnimate>
    </div>
  )
}

export default function PatioPage() {
  const { planStatus } = useUser()
  const isPro = planStatus?.plan === "PRO"
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [moving, setMoving] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  // Vistoria é feature do Pro: o dono ainda precisa habilitar em Configurações.
  // inspectionEnabled vem do business em /auth/me (mesma fonte da tela de config).
  const [inspectionEnabled, setInspectionEnabled] = useState(false)
  // B20 — capacidade do pátio (vagas/boxes) por dia; config local sem migração
  const [capacity, setCapacity] = useState(10)
  const [capModalOpen, setCapModalOpen] = useState(false)

  // sensores: pointer com distância mínima (não rouba cliques) + touch com delay
  // (segura ~180ms p/ começar a arrastar no celular, sem atrapalhar taps/scroll)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  useEffect(() => {
    const v = Number(localStorage.getItem("forbion_patio_capacity"))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (v > 0) setCapacity(v)
  }, [])
  function editCapacity() { setCapModalOpen(true) }
  function saveCapacity(value: string) {
    const n = Number(value)
    if (!(n > 0)) return
    setCapacity(n)
    localStorage.setItem("forbion_patio_capacity", String(n))
    setCapModalOpen(false)
    toast.success(`Capacidade do pátio definida: ${n} vaga${n > 1 ? "s" : ""}/dia`)
  }

  useEffect(() => {
    apiGet<{ business: { inspectionEnabled?: boolean | null } | null }>("/auth/me")
      .then((r) => setInspectionEnabled(!!r.business?.inspectionEnabled))
      .catch(() => { /* sem business → mantém desabilitado */ })
  }, [])

  const fetchData = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10)
    setLoading(true)
    setError("")
    apiGet<{ schedules: Schedule[] }>(`/schedules?date=${today}`)
      .then((r) => setSchedules(r.schedules ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoading(false))
  }, [])
  useEffect(fetchData, [fetchData])

  async function advance(id: string, next: Status) {
    setMoving(id)
    try { await apiPut(`/schedules/${id}/status`, { status: next }); fetchData() }
    catch { toast.error("Não consegui mover o carro. Tente de novo.") } finally { setMoving(null) }
  }

  // muda status via drag, otimista com rollback
  async function moveTo(id: string, target: ColumnKey) {
    const card = schedules.find((s) => s.id === id)
    if (!card) return
    const newStatus = COL_OF[target].dropStatus
    if (card.status === newStatus) return
    const prevStatus = card.status
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)))
    setMoving(id)
    try {
      await apiPut(`/schedules/${id}/status`, { status: newStatus })
      toast.success(`Movido para "${COL_OF[target].title}"`)
    } catch {
      // rollback
      setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, status: prevStatus } : s)))
      toast.error("Não consegui mover o carro. Tente de novo.")
    } finally {
      setMoving(null)
    }
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const target = over.id as ColumnKey
    if (!COL_OF[target]) return
    const from = (active.data.current?.from as ColumnKey | undefined) ?? null
    if (from === target) return
    moveTo(String(active.id), target)
  }

  const activeCard = activeId ? schedules.find((s) => s.id === activeId) ?? null : null
  const activeFrom = activeCard ? columnKeyOf(activeCard) : null
  const activeCol = activeFrom ? COL_OF[activeFrom] : null

  // Vistoria no card: Pro + habilitada → botão; não-Pro → selo "Pro"; Pro sem habilitar → oculto.
  const vistoria: VistoriaState = !isPro ? "pro" : inspectionEnabled ? "on" : "off"

  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    gap: 14,
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LayoutGrid size={22} color="#0066FF" />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>Pátio</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {(() => {
            const occupied = schedules.filter((s) => s.status !== "DONE" && s.status !== "CANCELLED").length
            const full = occupied >= capacity
            const col = full ? "#EF4444" : occupied >= capacity * 0.8 ? "#F59E0B" : "#10B981"
            return (
              <button onClick={editCapacity} title="Definir capacidade do pátio" style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", borderRadius: 9, background: `${col}14`, border: `1px solid ${col}40`, color: col, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {occupied}/{capacity} vagas{full ? " · lotado" : ""}
              </button>
            )
          })()}
          <button onClick={fetchData} style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: 9, background: "transparent", border: "1px solid var(--c-border)", color: "var(--c-text-2)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "0 0 24px" }}>Fila operacional de hoje. Arraste os carros entre as colunas, ou use os botões.</p>

      {loading && (
        <>
          <style>{`@keyframes patioSkel{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
          <div style={gridStyle}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 200, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, animation: `patioSkel 1.5s ease ${i * 0.1}s infinite` }} />
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

      {!loading && !error && schedules.length === 0 && (
        <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, padding: "56px 20px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--c-bg)", border: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Car size={24} color="var(--c-border-2)" />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--c-text)", margin: 0 }}>Nenhum carro na fila hoje</p>
          <p style={{ fontSize: 13, color: "var(--c-text-4)", margin: "6px 0 18px" }}>Crie um agendamento para começar a movimentar o pátio.</p>
          <Link href="/dashboard/agendamentos" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg, #0066FF, #7C3AED)", color: "white", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            Ir para Agendamentos <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {!loading && !error && schedules.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          {/* mobile: scroll horizontal com snap; desktop: 3 colunas via auto-fit */}
          <div
            style={{
              ...gridStyle,
              cursor: activeId ? "grabbing" : undefined,
              scrollSnapType: "x proximity",
            }}
          >
            {COLUMNS.map((col) => {
              const cards = schedules.filter(col.match).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
              return (
                <DroppableColumn
                  key={col.key}
                  col={col}
                  cards={cards}
                  moving={moving}
                  onAdvance={advance}
                  activeFrom={activeFrom}
                  vistoria={vistoria}
                />
              )
            })}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeCard && activeCol ? (
              <div style={{ cursor: "grabbing", width: "100%" }}>
                <CardBody s={activeCard} col={activeCol} moving={moving} onAdvance={advance} vistoria={vistoria} dragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <PromptModal
        open={capModalOpen}
        onClose={() => setCapModalOpen(false)}
        onSubmit={saveCapacity}
        title="Capacidade do pátio"
        description="Quantas vagas/boxes seu pátio comporta por dia? Usamos pra avisar quando lota."
        label="Vagas por dia"
        type="number"
        min={1}
        defaultValue={String(capacity)}
        confirmLabel="Salvar"
        validate={(v) => (Number(v) > 0 ? null : "Informe um número maior que zero.")}
      />
    </div>
  )
}
