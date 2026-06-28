"use client"

import { useEffect, useState, useCallback, useRef, Component, type CSSProperties, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { apiGet, apiPut } from "@/lib/api"
import { promptEncaixe, encaixeUrl } from "@/lib/encaixe"
import { hasProAccess } from "@/lib/plan"
import { useUser } from "@/contexts/UserContext"
import { LayoutGrid, Clock, Car, ChevronRight, RefreshCw, ShieldCheck, AlertCircle, GripVertical, ArrowRight, CheckCircle, User, QrCode, CreditCard, Banknote } from "lucide-react"
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
import Modal from "@/components/shared/Modal"
import AutoAnimate from "@/components/shared/AutoAnimate"
import TabTutorial from "@/components/shared/TabTutorial"
import { formatScheduleTime } from "@/lib/dateUtils"
import { useNotificationsSSE } from "@/lib/useNotificationsSSE"

/**
 * V2-B4 — Pátio (kanban operacional do dia). Aguardando → Em atendimento → Pronto.
 * Reusa GET /schedules?date= e PUT /schedules/:id/status. Ref: WashAI/ClickLava.
 * Drag-and-drop entre colunas (@dnd-kit) com pointer + touch; botões mantidos como fallback.
 */
interface Schedule {
  id: string; scheduledAt: string; employeeId?: string | null
  status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "DONE" | "CANCELLED"
  totalPrice: number
  customer?: { name: string | null } | null
  vehicle?: { plate: string | null; model: string | null } | null
  scheduleServices?: Array<{ service: { name: string | null } | null } | null> | null
}
interface Employee { id: string; name: string }

type Status = Schedule["status"]
type ColumnKey = "wait" | "doing" | "done"
/** Visibilidade da Vistoria no card: ligada (Pro + habilitada) | só selo Pro (não-Pro) | oculta */
type VistoriaState = "on" | "pro" | "off"

const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
// Usa o helper central (trata agendamento como UTC) p/ ficar em sincronia com o resto.
// Mantém o fallback "—" p/ valores ausentes/inválidos, que o helper não cobre.
const hhmm = (iso: string | null | undefined) => {
  if (!iso) return "—"
  if (Number.isNaN(new Date(iso).getTime())) return "—"
  return formatScheduleTime(iso)
}

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

// Formas de pagamento (mesmo enum do back: PIX | CREDIT_CARD | DEBIT_CARD | CASH).
const PAY_METHODS: { value: string; label: string; Icon: typeof QrCode }[] = [
  { value: "PIX",         label: "PIX",      Icon: QrCode },
  { value: "CREDIT_CARD", label: "Crédito",  Icon: CreditCard },
  { value: "DEBIT_CARD",  label: "Débito",   Icon: CreditCard },
  { value: "CASH",        label: "Dinheiro", Icon: Banknote },
]

// Resiliência por item: um card malformado vira fallback em vez de derrubar o pátio.
class CardErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: "var(--c-surface)", border: "1px solid var(--c-border)",
          borderRadius: 10, padding: "10px 12px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertCircle size={13} color="var(--c-text-4)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--c-text-4)" }}>
            Não foi possível exibir este agendamento.
          </span>
        </div>
      )
    }
    return this.props.children
  }
}

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
        <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: "3px 0 0" }}>{s.scheduleServices.map((x) => x?.service?.name).filter(Boolean).join(", ")}</p>
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
  // #43 — feedback de toque no celular: leve "press" enquanto o dedo está sobre o card.
  // Convive com o drag (só aplica press quando NÃO está arrastando) e não mexe no hover.
  const [pressed, setPressed] = useState(false)
  // dnd-kit captura o ponteiro ao arrastar (o onPointerUp pode não disparar no card);
  // ao começar o drag limpamos o press p/ não "grudar" depois do drop.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isDragging) setPressed(false)
  }, [isDragging])
  const dragTransform = CSS.Translate.toString(transform)
  const pressTransform = pressed && !isDragging ? "scale(0.98)" : undefined
  const style: CSSProperties = {
    transform: [dragTransform, pressTransform].filter(Boolean).join(" ") || undefined,
    // o card original some quando vira overlay (evita duplicata visual)
    opacity: isDragging ? 0 : pressed ? 0.85 : 1,
    cursor: "grab",
    touchAction: "manipulation",
    transition: isDragging ? "none" : "transform .1s ease, opacity .1s ease",
  }
  const endPress = () => setPressed(false)
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      // capture-phase: não colide com o onPointerDown que o dnd-kit injeta via {...listeners}
      onPointerDownCapture={() => setPressed(true)}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onPointerLeave={endPress}
    >
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
          <CardErrorBoundary key={s.id}>
            <DraggableCard s={s} col={col} moving={moving} onAdvance={onAdvance} vistoria={vistoria} />
          </CardErrorBoundary>
        ))}
      </AutoAnimate>
    </div>
  )
}

export default function PatioPage() {
  const { planStatus } = useUser()
  const isPro = hasProAccess(planStatus)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [moving, setMoving] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  // Vistoria é feature do Pro: o dono ainda precisa habilitar em Configurações.
  // inspectionEnabled vem do business em /auth/me (mesma fonte da tela de config).
  const [inspectionEnabled, setInspectionEnabled] = useState(false)
  // #36 — capacidade do pátio (vagas/boxes) por dia; fonte da verdade é o business
  // (Business.patioCapacity), salvo via PUT /auth/business. Antes era localStorage por-dispositivo.
  const [capacity, setCapacity] = useState(10)
  const [capModalOpen, setCapModalOpen] = useState(false)
  const [savingCap, setSavingCap] = useState(false)
  // Filtro por funcionário (mesma lente do Calendário): "all" | "owner" | <employeeId>.
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmp, setSelectedEmp] = useState<string>("all")
  // Finalização: ao mover pra "Pronto", pede a forma de pagamento e fecha a comanda (/close).
  const [finalizeFor, setFinalizeFor] = useState<Schedule | null>(null)
  const router = useRouter()
  const [payMethod, setPayMethod] = useState<string>("PIX")
  const [closing, setClosing] = useState(false)

  // sensores: pointer com distância mínima (não rouba cliques) + touch com delay
  // (segura ~180ms p/ começar a arrastar no celular, sem atrapalhar taps/scroll)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  function editCapacity() { setCapModalOpen(true) }
  // Salva no business (fonte da verdade): PUT /auth/business { patioCapacity }.
  async function saveCapacity(value: string) {
    const n = Number(value)
    if (!Number.isInteger(n) || n < 1) return
    setSavingCap(true)
    try {
      await apiPut("/auth/business", { patioCapacity: n })
      setCapacity(n)
      setCapModalOpen(false)
      toast.success(`Capacidade do pátio definida: ${n} vaga${n > 1 ? "s" : ""}/dia`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui salvar a capacidade. Tente de novo.")
    } finally {
      setSavingCap(false)
    }
  }

  // Lê do business (mesma fonte da tela de config): inspectionEnabled + patioCapacity (#36).
  useEffect(() => {
    apiGet<{ business: { inspectionEnabled?: boolean | null; patioCapacity?: number | null } | null }>("/auth/me")
      .then((r) => {
        setInspectionEnabled(!!r.business?.inspectionEnabled)
        // fallback de 10 se vier null/ausente
        const cap = Number(r.business?.patioCapacity)
        if (Number.isInteger(cap) && cap > 0) setCapacity(cap)
      })
      .catch(() => { /* sem business → mantém padrões */ })
  }, [])

  // Lista de funcionários pro seletor (mesma fonte do Calendário).
  useEffect(() => {
    apiGet<{ employees: Employee[] }>("/employees")
      .then((r) => setEmployees(r.employees ?? []))
      .catch(() => { /* sem equipe → seletor não aparece */ })
  }, [])

  const fetchData = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10)
    setLoading(true)
    setError("")
    const params: Record<string, string> = { date: today }
    if (selectedEmp !== "all") params.employeeId = selectedEmp
    apiGet<{ schedules: Schedule[] }>("/schedules", params)
      .then((r) => setSchedules(r.schedules ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoading(false))
  }, [selectedEmp])
  useEffect(fetchData, [fetchData])

  // Tempo real: agendamento criado/atualizado/fechado/cancelado em qualquer tela
  // re-sincroniza o Pátio na hora (casa com Calendário e Comanda).
  const sseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useNotificationsSSE(useCallback((data: Record<string, unknown>) => {
    if (typeof data.type === "string" && data.type.startsWith("SCHEDULE")) {
      if (sseTimer.current) clearTimeout(sseTimer.current)
      sseTimer.current = setTimeout(() => fetchData(), 400) // coalesce rajada
    }
  }, [fetchData]))

  // Abre o seletor de pagamento p/ finalizar a comanda (em vez de marcar DONE direto).
  function openFinalize(id: string) {
    const card = schedules.find((s) => s.id === id)
    if (!card) return
    setPayMethod("PIX")
    setFinalizeFor(card)
  }

  async function advance(id: string, next: Status) {
    // CTA "Finalizar" → não marca DONE pelo /status; abre o seletor de pagamento (→ /close).
    if (next === "DONE") { openFinalize(id); return }
    setMoving(id)
    try { await apiPut(`/schedules/${id}/status`, { status: next }); fetchData() }
    catch { toast.error("Não consegui mover o carro. Tente de novo.") } finally { setMoving(null) }
  }

  // muda status via drag, otimista com rollback
  async function moveTo(id: string, target: ColumnKey) {
    const card = schedules.find((s) => s.id === id)
    if (!card) return
    // Comanda finalizada não volta (DONE é terminal). Bloqueia reabrir pelo arrasta-e-solta.
    if (columnKeyOf(card) === "done" && target !== "done") {
      toast.error("Comanda finalizada não volta. Se fechou por engano, o dono pode estornar pela aba Agendamentos.")
      return
    }
    // Soltar em "Pronto" = finalizar → pede a forma de pagamento (fecha via /close).
    if (target === "done") { openFinalize(id); return }
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

  // Finaliza a comanda COM a forma de pagamento escolhida (canonical: /close).
  async function confirmFinalize() {
    if (!finalizeFor) return
    setClosing(true)
    try {
      await apiPut(`/schedules/${finalizeFor.id}/close`, { paymentMethod: payMethod })
      const closed = finalizeFor   // captura antes de limpar (pro encaixe)
      setFinalizeFor(null)
      fetchData()
      // Encaixe: abriu vaga — oferecer encaixar (leva pras Comandas com o modal pré-preenchido).
      promptEncaixe(closed, (slot) => router.push(encaixeUrl(slot)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui finalizar a comanda.")
    } finally {
      setClosing(false)
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

  function empBtnStyle(active: boolean): CSSProperties {
    return {
      height: 30, padding: "0 12px", borderRadius: 8, fontSize: 12,
      fontWeight: active ? 600 : 400, cursor: "pointer", fontFamily: "inherit",
      border: active ? "1px solid rgba(0,102,255,0.4)" : "1px solid var(--c-border)",
      background: active ? "rgba(0,102,255,0.1)" : "transparent",
      color: active ? "#3B82F6" : "var(--c-text-3)",
      display: "inline-flex", alignItems: "center", transition: "all 0.15s",
    }
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

      {/* ── SELETOR DE FUNCIONÁRIO (mesma lente do Calendário e da Comanda) ── */}
      {employees.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20, padding: "10px 14px", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12 }}>
          <button style={empBtnStyle(selectedEmp === "all")} onClick={() => setSelectedEmp("all")}>Todos</button>
          <button style={empBtnStyle(selectedEmp === "owner")} onClick={() => setSelectedEmp("owner")}>
            <User size={11} style={{ marginRight: 4 }} />Proprietário
          </button>
          {employees.map((e) => (
            <button key={e.id} style={empBtnStyle(selectedEmp === e.id)} onClick={() => setSelectedEmp(e.id)}>{e.name}</button>
          ))}
        </div>
      )}

      <TabTutorial
        tabKey="patio"
        title="Como usar o Pátio"
        subtitle="Os carros que estão na loja agora"
        steps={[
          { icon: Car, title: "1. Veja o que está na loja", text: "O Pátio mostra os carros em atendimento neste momento, como uma fila operacional do seu dia." },
          { icon: ArrowRight, title: "2. Mova pelo fluxo", text: "Avance cada carro pelas etapas do serviço até a entrega. Tudo atualiza em tempo real." },
          { icon: CheckCircle, title: "3. Entregue o carro", text: "Ao concluir, feche a comanda: o carro sai do pátio e a venda é registrada automaticamente." },
        ]}
      />

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
                <CardErrorBoundary>
                  <CardBody s={activeCard} col={activeCol} moving={moving} onAdvance={advance} vistoria={vistoria} dragging />
                </CardErrorBoundary>
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
        max={200}
        defaultValue={String(capacity)}
        confirmLabel="Salvar"
        loading={savingCap}
        validate={(v) => {
          const n = Number(v)
          if (!Number.isInteger(n) || n < 1 || n > 200) return "Informe um inteiro entre 1 e 200."
          return null
        }}
      />

      {/* Finalizar comanda: escolher a forma de pagamento (fecha via /close) */}
      <Modal
        open={finalizeFor !== null}
        onClose={() => { if (!closing) setFinalizeFor(null) }}
        title="Finalizar e receber"
        description={finalizeFor ? `${finalizeFor.customer?.name ?? "Cliente"} · ${fmt(finalizeFor.totalPrice)}` : ""}
      >
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", margin: "0 0 10px" }}>Como o cliente pagou?</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {PAY_METHODS.map((m) => {
              const sel = payMethod === m.value
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setPayMethod(m.value)}
                  style={{
                    display: "flex", alignItems: "center", gap: 9, height: 46, padding: "0 14px", borderRadius: 10,
                    border: `1.5px solid ${sel ? "#0066FF" : "var(--c-border-2)"}`,
                    background: sel ? "rgba(0,102,255,0.08)" : "transparent",
                    color: sel ? "#0066FF" : "var(--c-text-2)", fontSize: 14, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit", transition: "all .12s",
                  }}
                >
                  <m.Icon size={17} /> {m.label}
                </button>
              )
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button type="button" onClick={() => setFinalizeFor(null)} disabled={closing}
              style={{ height: 42, padding: "0 18px", borderRadius: 10, background: "transparent", border: "1px solid var(--c-border-2)", color: "var(--c-text-2)", fontSize: 14, fontWeight: 600, cursor: closing ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              Cancelar
            </button>
            <button type="button" onClick={confirmFinalize} disabled={closing}
              style={{ height: 42, padding: "0 22px", borderRadius: 10, background: "#10B981", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: closing ? "wait" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7 }}>
              <CheckCircle size={16} /> {closing ? "Finalizando…" : "Finalizar comanda"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
