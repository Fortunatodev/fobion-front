"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { apiGet, apiPost } from "@/lib/api"
import { useUser } from "@/contexts/UserContext"
import { Camera, ArrowLeft, Lock, Trash2, Save, Loader2, Check, X, PenLine, ShieldCheck, Crown, Settings, ExternalLink, MessageCircle, LogIn, LogOut } from "lucide-react"
import { toast } from "sonner"

/**
 * V2/V3 — Vistoria de entrada E saída do veículo (diferencial nº1 no detailing:
 * proteção jurídica "vocês riscaram meu carro"). Antes/depois em DUAS abas:
 * "Entrada (check-in)" e "Saída (check-out)". Cada aba salva sua stage com fotos
 * + marcação de avarias + observações + assinatura. A saída é OPCIONAL.
 * Trava após a comanda fechar (imutável). V5: semáforo de severidade bem visível.
 * Backend: POST/GET /api/schedules/:id/inspection (upsert por scheduleId+stage).
 * Upload: /api/upload/service-image.
 */
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

type Severity = "small" | "medium" | "large" // enum do backend (rótulos PT abaixo)
type Stage = "ENTRADA" | "SAIDA"
interface DamageMark { x: number; y: number; severity: Severity; note?: string }
/** Shape do contrato: cada stage carrega seu próprio registro completo. */
interface Insp {
  id: string
  photoUrls: string[]
  damageMarks: DamageMark[]
  notes: string | null
  signature: string | null
  isLocked: boolean
  lockedAt: string | null
  signedAt: string | null
}
/** GET devolve as 2 stages + token público do relatório + dados do cliente. */
interface InspectionResponse {
  entrada: Insp | null
  saida: Insp | null
  reportToken: string | null
  customer: { name: string; phone: string } | null
}
/** POST devolve só a inspeção do stage salvo + o token (compartilhado). */
interface SaveResponse { inspection: Insp; reportToken: string | null }

/** Estado editável de UMA stage na tela. */
interface StageState {
  photoUrls: string[]
  marks: DamageMark[]
  notes: string
  signature: string | null
  locked: boolean
}
const emptyStage = (): StageState => ({ photoUrls: [], marks: [], notes: "", signature: null, locked: false })
function stageFromInsp(ins: Insp | null): StageState {
  if (!ins) return emptyStage()
  return {
    photoUrls: ins.photoUrls ?? [],
    marks: (ins.damageMarks as DamageMark[]) ?? [],
    notes: ins.notes ?? "",
    signature: ins.signature ?? null,
    locked: !!ins.isLocked,
  }
}

/** Monta o link wa.me a partir do telefone do cliente. Retorna null se inválido (mesmo padrão de clientes/[id]). */
function buildWhatsAppHref(phone: string | null, message: string): string | null {
  const digits = (phone || "").replace(/\D/g, "")
  if (digits.length < 10) return null
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`
}

const SEV: Record<Severity, { label: string; color: string }> = {
  small:  { label: "Leve",  color: "#10B981" }, // V5 semáforo: verde = leve
  medium: { label: "Médio", color: "#F59E0B" }, // amarelo = médio
  large:  { label: "Grave", color: "#EF4444" }, // vermelho = grave
}
const MAX_PHOTOS = 8
const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // 5MB por foto

/** Lê a mensagem/erro REAL do backend num upload via fetch (que não passa pelo interceptor do axios). */
async function readUploadError(res: Response): Promise<string> {
  try {
    const data = (await res.clone().json()) as { message?: string; error?: string } | null
    const msg = data?.message || data?.error
    if (msg) return msg
  } catch {
    // corpo não-JSON; tenta texto puro abaixo
  }
  try {
    const text = (await res.text()).trim()
    if (text) return text
  } catch {
    // ignora
  }
  return `Falha ao enviar foto (HTTP ${res.status}).`
}

const STAGES: { key: Stage; label: string; sub: string; icon: typeof LogIn }[] = [
  { key: "ENTRADA", label: "Entrada (check-in)",  sub: "Estado do carro na chegada", icon: LogIn },
  { key: "SAIDA",   label: "Saída (check-out)",   sub: "Estado na entrega (opcional)", icon: LogOut },
]

/** Motivo de bloqueio da vistoria: feature do Pro ainda não disponível/desligada. */
type Gate = "pro" | "disabled"

export default function VistoriaPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>()
  const router = useRouter()
  const { planStatus, loading: userLoading } = useUser()
  const isPro = planStatus?.plan === "PRO"

  const [loading, setLoading] = useState(true)
  const [gate, setGate] = useState<Gate | null>(null)
  const [tab, setTab] = useState<Stage>("ENTRADA")
  // Estado por stage — cada aba edita o seu.
  const [stages, setStages] = useState<Record<Stage, StageState>>({ ENTRADA: emptyStage(), SAIDA: emptyStage() })
  const [reportToken, setReportToken] = useState<string | null>(null)
  const [customer, setCustomer] = useState<{ name: string; phone: string } | null>(null)

  const [sev, setSev] = useState<Severity>("small")
  const [selMark, setSelMark] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  // #47 progresso por foto: { done, total } enquanto envia em paralelo.
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState("")

  const fileRef = useRef<HTMLInputElement>(null)
  const sigRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  // Stage atual + helpers pra atualizar só a aba ativa.
  const cur = stages[tab]
  const locked = cur.locked
  function patchStage(patch: Partial<StageState>) {
    setStages((s) => ({ ...s, [tab]: { ...s[tab], ...patch } }))
  }
  function updMarks(fn: (m: DamageMark[]) => DamageMark[]) {
    setStages((s) => ({ ...s, [tab]: { ...s[tab], marks: fn(s[tab].marks) } }))
  }

  useEffect(() => {
    // Espera o auth/plano carregar antes de decidir o gate (evita flash de "disponível no Pro").
    if (userLoading) return

    let cancelled = false
    ;(async () => {
      setLoading(true)
      // Não-Pro: a feature inteira está fora do plano — nem chega a buscar.
      if (!isPro) {
        if (!cancelled) { setGate("pro"); setLoading(false) }
        return
      }
      try {
        // Pro: confirma se a loja habilitou a vistoria nas configurações.
        const me = await apiGet<{ business: { inspectionEnabled?: boolean | null } | null }>("/auth/me")
        if (cancelled) return
        if (!me.business?.inspectionEnabled) {
          setGate("disabled"); setLoading(false); return
        }
        const r = await apiGet<InspectionResponse>(`/schedules/${scheduleId}/inspection`)
        if (cancelled) return
        setStages({ ENTRADA: stageFromInsp(r.entrada), SAIDA: stageFromInsp(r.saida) })
        setReportToken(r.reportToken ?? null)
        setCustomer(r.customer ?? null)
        setGate(null)
      } catch (e) {
        if (cancelled) return
        // O back devolve 403 quando o tier/feature não permite (FEATURE_NOT_AVAILABLE).
        // O interceptor da api achata pra Error(mensagem); detectamos pelo texto.
        const msg = e instanceof Error ? e.message.toLowerCase() : ""
        if (msg.includes("plano pro") || msg.includes("plano premium") || msg.includes("recurso")) {
          setGate(isPro ? "disabled" : "pro")
        } else {
          toast.error("Não consegui carregar a vistoria. Recarregue a página.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [scheduleId, userLoading, isPro])

  // Ao trocar de aba, a seleção de marca não faz mais sentido (índices são por stage).
  useEffect(() => { setSelMark(null); setErr(""); setSaved(false) }, [tab])

  // ── Fotos ──────────────────────────────────────────────────────────────────
  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    if (fileRef.current) fileRef.current.value = "" // libera re-seleção do mesmo arquivo
    if (!picked.length) return

    const room = MAX_PHOTOS - cur.photoUrls.length
    const files = picked.slice(0, Math.max(0, room))
    if (!files.length) { setErr(`Limite de ${MAX_PHOTOS} fotos atingido.`); return }

    // #46 valida tipo e tamanho ANTES de enviar (≤5MB, imagem).
    const invalid = files.find((f) => !f.type.startsWith("image/") || f.size > MAX_PHOTO_BYTES)
    if (invalid) {
      setErr(
        !invalid.type.startsWith("image/")
          ? `"${invalid.name}" não é uma imagem.`
          : `"${invalid.name}" passa de 5 MB — escolha uma foto menor.`,
      )
      return
    }

    setErr("")
    setUploading(true)
    setUploadProgress({ done: 0, total: files.length })
    const token = typeof window !== "undefined" ? localStorage.getItem("forbion_token") : null

    try {
      // #46 envia em paralelo (não mais em série); #47 incrementa o contador a cada foto concluída.
      const urls = await Promise.all(
        files.map(async (file) => {
          const fd = new FormData(); fd.append("file", file)
          const res = await fetch(`${API}/api/upload/service-image`, {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: fd,
          })
          if (!res.ok) throw new Error(await readUploadError(res)) // #49 mensagem REAL do backend
          const { url } = (await res.json()) as { url: string }
          setUploadProgress((p) => (p ? { ...p, done: p.done + 1 } : p))
          return url
        }),
      )
      setStages((s) => ({ ...s, [tab]: { ...s[tab], photoUrls: [...s[tab].photoUrls, ...urls] } }))
    } catch (uploadErr) {
      // #49 propaga o motivo real (status/mensagem) em vez de um erro genérico.
      setErr(uploadErr instanceof Error && uploadErr.message ? uploadErr.message : "Falha ao enviar foto.")
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  // ── Marcação de avarias ──────────────────────────────────────────────────────
  function addMark(e: React.MouseEvent<HTMLDivElement>) {
    if (locked) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = +((e.clientX - rect.left) / rect.width).toFixed(4)
    const y = +((e.clientY - rect.top) / rect.height).toFixed(4)
    setSelMark(cur.marks.length)
    updMarks((m) => [...m, { x, y, severity: sev }])
  }

  // ── Assinatura ────────────────────────────────────────────────────────────────
  // O backing store é dimensionado em CSS px × devicePixelRatio (ver resizeSigCanvas),
  // e o contexto é escalado pelo dpr — então desenhamos/medimos sempre em CSS px.
  function sigPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = sigRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  function sigStroke(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--c-text").trim() || "#fff"
    ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round"
  }
  function sigDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (locked) return
    drawing.current = true
    const ctx = sigRef.current!.getContext("2d")!; const { x, y } = sigPos(e)
    ctx.beginPath(); ctx.moveTo(x, y); sigStroke(ctx)
  }
  function sigMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || locked) return
    const ctx = sigRef.current!.getContext("2d")!; const { x, y } = sigPos(e)
    ctx.lineTo(x, y); ctx.stroke()
  }
  function sigUp() {
    if (!drawing.current) return
    drawing.current = false
    patchStage({ signature: sigRef.current!.toDataURL("image/png") })
  }
  function clearSig() {
    const c = sigRef.current; if (!c) return
    const ctx = c.getContext("2d")!
    // limpa todo o backing store ignorando o transform de dpr corrente
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.restore()
    patchStage({ signature: null })
  }

  // #48 Recalcula o backing store do canvas conforme o tamanho renderizado (CSS px × dpr),
  // redesenhando o traço atual. Sem isso, girar a tela no celular distorce a área.
  const resizeSigCanvas = useCallback((sigDataUrl: string | null) => {
    const c = sigRef.current; if (!c) return
    const rect = c.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 3) : 1
    const ctx = c.getContext("2d"); if (!ctx) return
    c.width = Math.round(rect.width * dpr)
    c.height = Math.round(rect.height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0) // desenhar/medir em CSS px
    if (sigDataUrl) {
      const img = new Image()
      img.onload = () => { ctx.drawImage(img, 0, 0, rect.width, rect.height) }
      img.src = sigDataUrl
    }
  }, [])

  // Dimensiona ao montar a aba e em resize/orientationchange, preservando o que já foi desenhado.
  useLayoutEffect(() => {
    if (loading || gate || locked) return // canvas só existe quando carregado, sem gate e destravado
    // ao (re)montar a aba, parte da assinatura já salva do stage; depois preserva o traço corrente.
    resizeSigCanvas(stages[tab].signature)
    const onResize = () => resizeSigCanvas(sigRef.current?.toDataURL("image/png") ?? null)
    window.addEventListener("resize", onResize)
    window.addEventListener("orientationchange", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
      window.removeEventListener("orientationchange", onResize)
    }
    // só re-inicializa ao trocar de aba, (des)travar ou terminar de carregar — não a cada traço salvo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, locked, loading, gate, resizeSigCanvas])

  async function save() {
    setSaving(true); setErr(""); setSaved(false)
    try {
      const res = await apiPost<SaveResponse>(`/schedules/${scheduleId}/inspection`, {
        stage: tab,
        photoUrls: cur.photoUrls,
        damageMarks: cur.marks,
        notes: cur.notes.trim() || null,
        signature: cur.signature,
      })
      // Sincroniza o stage salvo com o que voltou do back (id/lock/etc).
      if (res?.inspection) {
        setStages((s) => ({ ...s, [tab]: stageFromInsp(res.inspection) }))
      }
      // O back gera o token público no primeiro save de qualquer stage e o reusa.
      if (res?.reportToken) setReportToken(res.reportToken)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao salvar vistoria.") } finally { setSaving(false) }
  }

  if (loading) return <div style={{ padding: 40, color: "var(--c-text-3)", fontSize: 14 }}>Carregando vistoria…</div>

  // ── Gate: feature do Pro (não-Pro) ou desligada nas configurações (Pro) ──────
  if (gate) {
    const pro = gate === "pro"
    const accent = pro ? "#F59E0B" : "#0066FF"
    const accentBg = pro ? "rgba(245,158,11,0.1)" : "rgba(0,102,255,0.1)"
    const accentBorder = pro ? "rgba(245,158,11,0.2)" : "rgba(0,102,255,0.2)"
    const GateIcon = pro ? Crown : Settings
    return (
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "24px 20px 64px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: 9, background: "transparent", border: "1px solid var(--c-border)", color: "var(--c-text-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ArrowLeft size={16} /></button>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <ShieldCheck size={22} color="var(--c-text-3)" />
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>Vistoria do veículo</h1>
          </div>
        </div>

        <div style={{ maxWidth: 480, margin: "32px auto 0", textAlign: "center", padding: "0 8px" }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: accentBg, border: `1px solid ${accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
            <GateIcon size={28} color={accent} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--c-text)", margin: "0 0 8px" }}>
            {pro ? "Vistoria disponível no plano Pro" : "Vistoria desabilitada nas configurações"}
          </h2>
          <p style={{ fontSize: 13.5, color: "var(--c-text-3)", lineHeight: 1.6, margin: "0 0 22px" }}>
            {pro
              ? "Registre o estado do carro na entrada/saída com fotos e assinatura — vira prova contra disputa. Faça upgrade para o Pro para liberar este recurso."
              : "A vistoria de veículos faz parte do seu plano, mas ainda está desligada. Ative em Configurações › Negócio › Recursos para começar a usar."}
          </p>
          <Link
            href={pro ? "/dashboard/configuracoes?tab=plano" : "/dashboard/configuracoes"}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              height: 44, padding: "0 22px", borderRadius: 11,
              background: pro ? "linear-gradient(135deg,#F59E0B,#F97316)" : "linear-gradient(135deg,#0066FF,#7C3AED)",
              color: "var(--c-on-primary)", fontSize: 14, fontWeight: 700, textDecoration: "none", fontFamily: "inherit",
            }}
          >
            {pro ? <><Crown size={15} /> Fazer upgrade para o Pro</> : <><Settings size={15} /> Ir para Configurações</>}
          </Link>
        </div>
      </div>
    )
  }

  const card: React.CSSProperties = { background: "var(--c-elevated)", border: "1px solid var(--c-border)", borderRadius: 14, padding: 18 }
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 12px" }
  const isExit = tab === "SAIDA"
  const photoLabel = isExit ? "Fotos da entrega" : "Fotos da chegada"
  const counts = countsOf(cur.marks)

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "24px 20px 64px" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: 9, background: "transparent", border: "1px solid var(--c-border)", color: "var(--c-text-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ArrowLeft size={16} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <ShieldCheck size={22} color="#0066FF" />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>Vistoria do veículo</h1>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "0 0 18px" }}>Registre o estado do carro na chegada e na entrega — fotos, avarias e assinatura. Vira prova contra disputa.</p>

      {/* ── ABAS Entrada / Saída ── */}
      <div role="tablist" aria-label="Etapa da vistoria" style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {STAGES.map(({ key, label: lbl, sub, icon: Icon }) => {
          const active = tab === key
          const st = stages[key]
          const filled = st.photoUrls.length > 0 || st.marks.length > 0 || !!st.signature || st.notes.trim().length > 0
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              style={{
                flex: "1 1 220px", minWidth: 0, textAlign: "left",
                display: "flex", alignItems: "center", gap: 11,
                padding: "12px 14px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                background: active ? "var(--c-elevated)" : "transparent",
                border: `1.5px solid ${active ? "#0066FF" : "var(--c-border)"}`,
                boxShadow: active ? "0 0 0 3px rgba(0,102,255,0.12)" : "none",
                transition: "border-color .15s, box-shadow .15s",
              }}
            >
              <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: active ? "rgba(0,102,255,0.12)" : "var(--c-surface-2)", border: `1px solid ${active ? "rgba(0,102,255,0.25)" : "var(--c-border)"}` }}>
                <Icon size={17} color={active ? "#0066FF" : "var(--c-text-3)"} />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: active ? "var(--c-text)" : "var(--c-text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lbl}</span>
                  {st.locked && <Lock size={12} color="#F59E0B" style={{ flexShrink: 0 }} />}
                  {filled && !st.locked && <span title="Preenchida" style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", flexShrink: 0 }} />}
                </span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--c-text-4)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</span>
              </span>
            </button>
          )
        })}
      </div>

      {locked && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", marginBottom: 18, borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <Lock size={14} color="#F59E0B" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#F59E0B", fontWeight: 600 }}>Vistoria travada — a comanda foi fechada. Registro imutável (valor jurídico).</span>
        </div>
      )}

      {isExit && !locked && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", marginBottom: 18, borderRadius: 10, background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}>
          <LogOut size={14} color="var(--c-text-3)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: "var(--c-text-3)" }}>A vistoria de saída é opcional — preencha ao entregar o veículo para comparar antes/depois.</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* FOTOS */}
        <div style={card}>
          <p style={label}>{photoLabel} ({cur.photoUrls.length}/{MAX_PHOTOS})</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
            {cur.photoUrls.map((url, i) => (
              <div key={i} style={{ position: "relative", aspectRatio: "4/3", borderRadius: 10, overflow: "hidden", border: "1px solid var(--c-border)" }}>
                <img src={url} alt={`foto ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {!locked && <button onClick={() => patchStage({ photoUrls: cur.photoUrls.filter((_, j) => j !== i) })} style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 6, background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>}
              </div>
            ))}
            {!locked && cur.photoUrls.length < MAX_PHOTOS && (
              <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ aspectRatio: "4/3", borderRadius: 10, border: "1px dashed var(--c-border-2)", background: "var(--c-bg)", color: "var(--c-text-3)", cursor: uploading ? "wait" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, fontFamily: "inherit", textAlign: "center", padding: "0 6px" }}>
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                {/* #47 feedback de progresso por foto (paralelo: mostra quantas já concluíram) */}
                {uploading
                  ? uploadProgress && uploadProgress.total > 1
                    ? `Enviando ${uploadProgress.done}/${uploadProgress.total}…`
                    : "Enviando…"
                  : "Adicionar foto"}
              </button>
            )}
          </div>
          {locked && cur.photoUrls.length === 0 && <p style={{ fontSize: 13, color: "var(--c-text-4)", margin: 0 }}>Nenhuma foto registrada.</p>}
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
        </div>

        {/* AVARIAS */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <p style={{ ...label, margin: 0 }}>Avarias — toque no carro pra marcar</p>
            {/* V5 semáforo: contagem por gravidade sempre visível */}
            {cur.marks.length > 0 && (
              <div style={{ display: "flex", gap: 8 }}>
                {(Object.keys(SEV) as Severity[]).map((s) => {
                  const n = s === "small" ? counts.verde : s === "medium" ? counts.amarelo : counts.vermelho
                  return (
                    <span key={s} title={SEV[s].label} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: n > 0 ? SEV[s].color : "var(--c-text-4)" }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: SEV[s].color, opacity: n > 0 ? 1 : 0.4 }} />{n}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
          {!locked && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {(Object.keys(SEV) as Severity[]).map((s) => (
                <button key={s} onClick={() => setSev(s)} style={{ flex: 1, height: 36, borderRadius: 8, border: `1px solid ${sev === s ? SEV[s].color : "var(--c-border-2)"}`, background: sev === s ? `${SEV[s].color}1A` : "transparent", color: sev === s ? SEV[s].color : "var(--c-text-2)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: SEV[s].color }} />{SEV[s].label}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {/* diagrama */}
            <div onClick={addMark} style={{ position: "relative", width: 200, height: 340, flexShrink: 0, background: "var(--c-bg)", borderRadius: 16, border: "1px solid var(--c-border)", cursor: locked ? "default" : "crosshair", margin: "0 auto" }}>
              <svg viewBox="0 0 200 340" width="200" height="340" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <rect x="38" y="20" width="124" height="300" rx="48" fill="none" stroke="var(--c-border-2)" strokeWidth="2" />
                <path d="M58 70 L142 70 L128 110 L72 110 Z" fill="none" stroke="var(--c-border-2)" strokeWidth="1.5" />
                <path d="M72 230 L128 230 L142 270 L58 270 Z" fill="none" stroke="var(--c-border-2)" strokeWidth="1.5" />
                <rect x="62" y="120" width="76" height="100" rx="6" fill="none" stroke="var(--c-border-2)" strokeWidth="1" />
                <text x="100" y="174" textAnchor="middle" fill="var(--c-border-2)" fontSize="10">frente ↑</text>
              </svg>
              {cur.marks.map((m, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); setSelMark(i) }} style={{ position: "absolute", left: `${m.x * 100}%`, top: `${m.y * 100}%`, transform: "translate(-50%,-50%)", width: 19, height: 19, borderRadius: "50%", background: SEV[m.severity].color, border: selMark === i ? "2px solid var(--c-text)" : "2px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.35)", cursor: "pointer", padding: 0, fontSize: 9, fontWeight: 800, color: "#fff" }}>{i + 1}</button>
              ))}
            </div>
            {/* lista de marcas */}
            <div style={{ flex: 1, minWidth: 220 }}>
              {cur.marks.length === 0 && <p style={{ fontSize: 13, color: "var(--c-text-4)" }}>Nenhuma avaria marcada. {locked ? "" : "Escolha a gravidade e toque no diagrama."}</p>}
              {cur.marks.map((m, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", marginBottom: 6, borderRadius: 9, background: selMark === i ? "var(--c-surface-2)" : "var(--c-bg)", border: `1px solid ${selMark === i ? SEV[m.severity].color : `${SEV[m.severity].color}40`}` }}>
                  <span style={{ width: 19, height: 19, borderRadius: "50%", background: SEV[m.severity].color, color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 0 1px rgba(0,0,0,0.25)" }}>{i + 1}</span>
                  {locked ? (
                    <span style={{ fontSize: 12, color: "var(--c-text-2)", flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 700, color: SEV[m.severity].color }}>{SEV[m.severity].label}</span>{m.note ? `— ${m.note}` : ""}
                    </span>
                  ) : (
                    <>
                      <select value={m.severity} onChange={(e) => updMarks((arr) => arr.map((x, j) => j === i ? { ...x, severity: e.target.value as Severity } : x))} style={{ height: 28, background: "var(--c-bg)", border: "1px solid var(--c-border-2)", borderRadius: 7, color: "var(--c-text)", fontSize: 12, fontFamily: "inherit" }}>
                        {(Object.keys(SEV) as Severity[]).map((s) => <option key={s} value={s}>{SEV[s].label}</option>)}
                      </select>
                      <input value={m.note ?? ""} onChange={(e) => updMarks((arr) => arr.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} placeholder="nota (ex: risco porta)" style={{ flex: 1, height: 28, background: "var(--c-bg)", border: "1px solid var(--c-border-2)", borderRadius: 7, color: "var(--c-text)", fontSize: 12, padding: "0 8px", outline: "none", fontFamily: "inherit", minWidth: 80 }} />
                      <button onClick={() => { updMarks((arr) => arr.filter((_, j) => j !== i)); setSelMark(null) }} style={{ width: 28, height: 28, borderRadius: 7, background: "transparent", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Trash2 size={12} /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* OBSERVAÇÕES */}
        <div style={card}>
          <p style={label}>Observações</p>
          <textarea value={cur.notes} onChange={(e) => patchStage({ notes: e.target.value })} disabled={locked} placeholder="Nível de combustível, km, pertences no veículo, estado geral…" rows={3} style={{ width: "100%", background: "var(--c-bg)", border: "1px solid var(--c-border-2)", borderRadius: 10, color: "var(--c-text)", fontSize: 13, padding: "10px 12px", outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
        </div>

        {/* ASSINATURA */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ ...label, margin: 0, display: "flex", alignItems: "center", gap: 6 }}><PenLine size={13} /> Assinatura do cliente</p>
            {!locked && <button onClick={clearSig} style={{ background: "none", border: "none", color: "var(--c-text-3)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Limpar</button>}
          </div>
          {locked ? (
            cur.signature ? (
              <img src={cur.signature} alt="assinatura" style={{ width: "100%", maxWidth: 380, height: 120, objectFit: "contain", background: "var(--c-bg)", borderRadius: 10, border: "1px solid var(--c-border)" }} />
            ) : (
              <p style={{ fontSize: 13, color: "var(--c-text-4)", margin: 0 }}>Sem assinatura registrada.</p>
            )
          ) : (
            // key por stage: garante um canvas limpo ao trocar de aba (o canvas é imperativo).
            <canvas key={tab} ref={sigRef} width={760} height={160} onPointerDown={sigDown} onPointerMove={sigMove} onPointerUp={sigUp} onPointerLeave={sigUp} style={{ width: "100%", height: 140, background: "var(--c-bg)", borderRadius: 10, border: "1px solid var(--c-border-2)", touchAction: "none", cursor: "crosshair" }} />
          )}
        </div>

        {err && <p style={{ color: "#F87171", fontSize: 13 }}>{err}</p>}

        {/* salvar */}
        {!locked && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={save} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 7, height: 44, padding: "0 22px", borderRadius: 11, background: saved ? "#10B981" : "linear-gradient(135deg,#0066FF,#7C3AED)", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: saving ? "wait" : "pointer", fontFamily: "inherit" }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
              {saving ? "Salvando…" : saved ? "Vistoria salva" : `Salvar ${isExit ? "saída" : "entrada"}`}
            </button>
          </div>
        )}

        {/* V7: compartilhar o relatório público (só depois que existe token = vistoria salva) */}
        {reportToken && <ShareReport token={reportToken} customer={customer} />}
      </div>
    </div>
  )
}

/** Contagem por gravidade para o semáforo V5 (verde/amarelo/vermelho). */
function countsOf(marks: DamageMark[]) {
  return {
    verde: marks.filter((m) => m.severity === "small").length,
    amarelo: marks.filter((m) => m.severity === "medium").length,
    vermelho: marks.filter((m) => m.severity === "large").length,
  }
}

// ── V7: ações de compartilhamento do relatório público ──────────────────────────
function ShareReport({ token, customer }: { token: string; customer: { name: string; phone: string } | null }) {
  // URL absoluta do relatório (window só existe no client; o componente já roda em "use client").
  const reportUrl = typeof window !== "undefined" ? `${window.location.origin}/v/${token}` : `/v/${token}`
  const firstName = customer?.name?.split(" ")[0] ?? ""
  const message = `Oi${firstName ? ` ${firstName}` : ""}, segue a vistoria do seu veículo: ${reportUrl}`
  const waHref = buildWhatsAppHref(customer?.phone ?? null, message)

  return (
    <div style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)", borderRadius: 14, padding: 18 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 12px" }}>Compartilhar com o cliente</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a
          href={reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 44, padding: "0 18px", borderRadius: 11, background: "transparent", border: "1px solid var(--c-border-2)", color: "var(--c-text)", fontSize: 14, fontWeight: 600, textDecoration: "none", fontFamily: "inherit" }}
        >
          <ExternalLink size={16} /> Ver relatório
        </a>
        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 44, padding: "0 18px", borderRadius: 11, background: "#25D366", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", fontFamily: "inherit" }}
          >
            <MessageCircle size={16} /> Enviar no WhatsApp
          </a>
        ) : (
          <button
            type="button"
            disabled
            title="Cadastre o telefone do cliente para enviar pelo WhatsApp"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 44, padding: "0 18px", borderRadius: 11, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", color: "var(--c-text-4)", fontSize: 14, fontWeight: 700, cursor: "not-allowed", fontFamily: "inherit" }}
          >
            <MessageCircle size={16} /> Enviar no WhatsApp
          </button>
        )}
      </div>
      {!waHref && <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: "10px 0 0" }}>O cliente não tem telefone cadastrado — adicione um número para enviar pelo WhatsApp.</p>}
    </div>
  )
}
