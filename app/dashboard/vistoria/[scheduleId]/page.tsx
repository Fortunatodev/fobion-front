"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiGet, apiPost } from "@/lib/api"
import { Camera, ArrowLeft, Lock, Trash2, Save, Loader2, Check, X, PenLine, ShieldCheck } from "lucide-react"

/**
 * V2 — Vistoria de entrada do veículo (diferencial nº1 no detailing: proteção
 * jurídica "vocês riscaram meu carro"). Fotos + marcação de avarias no diagrama
 * + observações + assinatura do cliente. Trava após a comanda fechar (imutável).
 * Backend: POST/GET /api/schedules/:id/inspection. Upload: /api/upload/service-image.
 */
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

type Severity = "small" | "medium" | "large" // enum do backend (rótulos PT abaixo)
interface DamageMark { x: number; y: number; severity: Severity; note?: string }
interface Inspection { photoUrls: string[]; damageMarks: DamageMark[]; notes: string | null; signature: string | null; isLocked: boolean }

const SEV: Record<Severity, { label: string; color: string }> = {
  small:  { label: "Leve",  color: "#F59E0B" },
  medium: { label: "Médio", color: "#F97316" },
  large:  { label: "Grave", color: "#EF4444" },
}
const MAX_PHOTOS = 8

export default function VistoriaPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [marks, setMarks] = useState<DamageMark[]>([])
  const [notes, setNotes] = useState("")
  const [signature, setSignature] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)

  const [sev, setSev] = useState<Severity>("small")
  const [selMark, setSelMark] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState("")

  const fileRef = useRef<HTMLInputElement>(null)
  const sigRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  useEffect(() => {
    apiGet<{ inspection: Inspection | null }>(`/schedules/${scheduleId}/inspection`)
      .then((r) => {
        const ins = r.inspection
        if (ins) {
          setPhotoUrls(ins.photoUrls ?? [])
          setMarks((ins.damageMarks as DamageMark[]) ?? [])
          setNotes(ins.notes ?? "")
          setSignature(ins.signature ?? null)
          setLocked(!!ins.isLocked)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [scheduleId])

  // ── Fotos ──────────────────────────────────────────────────────────────────
  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true); setErr("")
    const token = typeof window !== "undefined" ? localStorage.getItem("forbion_token") : null
    try {
      for (const file of files.slice(0, MAX_PHOTOS - photoUrls.length)) {
        const fd = new FormData(); fd.append("file", file)
        const res = await fetch(`${API}/api/upload/service-image`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd })
        if (!res.ok) throw new Error()
        const { url } = (await res.json()) as { url: string }
        setPhotoUrls((p) => [...p, url])
      }
    } catch { setErr("Falha ao enviar foto.") } finally { setUploading(false); if (fileRef.current) fileRef.current.value = "" }
  }

  // ── Marcação de avarias ──────────────────────────────────────────────────────
  function addMark(e: React.MouseEvent<HTMLDivElement>) {
    if (locked) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = +((e.clientX - rect.left) / rect.width).toFixed(4)
    const y = +((e.clientY - rect.top) / rect.height).toFixed(4)
    setMarks((m) => [...m, { x, y, severity: sev }])
    setSelMark(marks.length)
  }

  // ── Assinatura ────────────────────────────────────────────────────────────────
  function sigPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = sigRef.current!; const r = c.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }
  }
  function sigDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (locked) return
    drawing.current = true
    const ctx = sigRef.current!.getContext("2d")!; const { x, y } = sigPos(e)
    ctx.beginPath(); ctx.moveTo(x, y); ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--c-text").trim() || "#fff"; ctx.lineWidth = 2; ctx.lineCap = "round"
  }
  function sigMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || locked) return
    const ctx = sigRef.current!.getContext("2d")!; const { x, y } = sigPos(e)
    ctx.lineTo(x, y); ctx.stroke()
  }
  function sigUp() {
    if (!drawing.current) return
    drawing.current = false
    setSignature(sigRef.current!.toDataURL("image/png"))
  }
  function clearSig() {
    const c = sigRef.current; if (!c) return
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setSignature(null)
  }

  async function save() {
    setSaving(true); setErr(""); setSaved(false)
    try {
      await apiPost(`/schedules/${scheduleId}/inspection`, { photoUrls, damageMarks: marks, notes: notes.trim() || null, signature })
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao salvar vistoria.") } finally { setSaving(false) }
  }

  if (loading) return <div style={{ padding: 40, color: "var(--c-text-3)", fontSize: 14 }}>Carregando vistoria…</div>

  const card: React.CSSProperties = { background: "var(--c-elevated)", border: "1px solid var(--c-border)", borderRadius: 14, padding: 18 }
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 12px" }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "24px 20px 64px" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: 9, background: "transparent", border: "1px solid var(--c-border)", color: "var(--c-text-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ArrowLeft size={16} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <ShieldCheck size={22} color="#0066FF" />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>Vistoria de entrada</h1>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "0 0 20px" }}>Registre o estado do carro na chegada — fotos, avarias e assinatura. Vira prova contra disputa.</p>

      {locked && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", marginBottom: 18, borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <Lock size={14} color="#F59E0B" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#F59E0B", fontWeight: 600 }}>Vistoria travada — a comanda foi fechada. Registro imutável (valor jurídico).</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* FOTOS */}
        <div style={card}>
          <p style={label}>Fotos da chegada ({photoUrls.length}/{MAX_PHOTOS})</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
            {photoUrls.map((url, i) => (
              <div key={i} style={{ position: "relative", aspectRatio: "4/3", borderRadius: 10, overflow: "hidden", border: "1px solid var(--c-border)" }}>
                <img src={url} alt={`foto ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {!locked && <button onClick={() => setPhotoUrls((p) => p.filter((_, j) => j !== i))} style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 6, background: "rgba(0,0,0,0.7)", border: "none", color: "var(--c-text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>}
              </div>
            ))}
            {!locked && photoUrls.length < MAX_PHOTOS && (
              <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ aspectRatio: "4/3", borderRadius: 10, border: "1px dashed var(--c-border-2)", background: "var(--c-bg)", color: "var(--c-text-3)", cursor: uploading ? "wait" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, fontFamily: "inherit" }}>
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                {uploading ? "Enviando…" : "Adicionar foto"}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
        </div>

        {/* AVARIAS */}
        <div style={card}>
          <p style={label}>Avarias — toque no carro pra marcar</p>
          {!locked && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {(Object.keys(SEV) as Severity[]).map((s) => (
                <button key={s} onClick={() => setSev(s)} style={{ flex: 1, height: 34, borderRadius: 8, border: `1px solid ${sev === s ? SEV[s].color : "var(--c-border-2)"}`, background: sev === s ? `${SEV[s].color}1A` : "transparent", color: sev === s ? SEV[s].color : "var(--c-text-2)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{SEV[s].label}</button>
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
              {marks.map((m, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); setSelMark(i) }} style={{ position: "absolute", left: `${m.x * 100}%`, top: `${m.y * 100}%`, transform: "translate(-50%,-50%)", width: 18, height: 18, borderRadius: "50%", background: SEV[m.severity].color, border: selMark === i ? "2px solid var(--c-text)" : "2px solid rgba(0,0,0,0.5)", cursor: "pointer", padding: 0, fontSize: 9, fontWeight: 800, color: "#000" }}>{i + 1}</button>
              ))}
            </div>
            {/* lista de marcas */}
            <div style={{ flex: 1, minWidth: 220 }}>
              {marks.length === 0 && <p style={{ fontSize: 13, color: "var(--c-text-4)" }}>Nenhuma avaria marcada. {locked ? "" : "Escolha a gravidade e toque no diagrama."}</p>}
              {marks.map((m, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", marginBottom: 6, borderRadius: 9, background: selMark === i ? "var(--c-surface-2)" : "var(--c-bg)", border: `1px solid ${selMark === i ? SEV[m.severity].color : "var(--c-border)"}` }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: SEV[m.severity].color, color: "#000", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                  {locked ? (
                    <span style={{ fontSize: 12, color: "var(--c-text-2)", flex: 1 }}>{SEV[m.severity].label}{m.note ? ` — ${m.note}` : ""}</span>
                  ) : (
                    <>
                      <select value={m.severity} onChange={(e) => setMarks((arr) => arr.map((x, j) => j === i ? { ...x, severity: e.target.value as Severity } : x))} style={{ height: 28, background: "var(--c-bg)", border: "1px solid var(--c-border-2)", borderRadius: 7, color: "var(--c-text)", fontSize: 12, fontFamily: "inherit" }}>
                        {(Object.keys(SEV) as Severity[]).map((s) => <option key={s} value={s}>{SEV[s].label}</option>)}
                      </select>
                      <input value={m.note ?? ""} onChange={(e) => setMarks((arr) => arr.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} placeholder="nota (ex: risco porta)" style={{ flex: 1, height: 28, background: "var(--c-bg)", border: "1px solid var(--c-border-2)", borderRadius: 7, color: "var(--c-text)", fontSize: 12, padding: "0 8px", outline: "none", fontFamily: "inherit", minWidth: 80 }} />
                      <button onClick={() => { setMarks((arr) => arr.filter((_, j) => j !== i)); setSelMark(null) }} style={{ width: 28, height: 28, borderRadius: 7, background: "transparent", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Trash2 size={12} /></button>
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
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={locked} placeholder="Nível de combustível, km, pertences no veículo, estado geral…" rows={3} style={{ width: "100%", background: "var(--c-bg)", border: "1px solid var(--c-border-2)", borderRadius: 10, color: "var(--c-text)", fontSize: 13, padding: "10px 12px", outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
        </div>

        {/* ASSINATURA */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ ...label, margin: 0, display: "flex", alignItems: "center", gap: 6 }}><PenLine size={13} /> Assinatura do cliente</p>
            {!locked && <button onClick={clearSig} style={{ background: "none", border: "none", color: "var(--c-text-3)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Limpar</button>}
          </div>
          {locked && signature ? (
            <img src={signature} alt="assinatura" style={{ width: "100%", maxWidth: 380, height: 120, objectFit: "contain", background: "var(--c-bg)", borderRadius: 10, border: "1px solid var(--c-border)" }} />
          ) : (
            <canvas ref={sigRef} width={760} height={160} onPointerDown={sigDown} onPointerMove={sigMove} onPointerUp={sigUp} onPointerLeave={sigUp} style={{ width: "100%", height: 140, background: "var(--c-bg)", borderRadius: 10, border: "1px solid var(--c-border-2)", touchAction: "none", cursor: locked ? "default" : "crosshair" }} />
          )}
        </div>

        {err && <p style={{ color: "#F87171", fontSize: 13 }}>{err}</p>}

        {/* salvar */}
        {!locked && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={save} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 7, height: 44, padding: "0 22px", borderRadius: 11, background: saved ? "#10B981" : "linear-gradient(135deg,#0066FF,#7C3AED)", color: "white", border: "none", fontSize: 14, fontWeight: 600, cursor: saving ? "wait" : "pointer", fontFamily: "inherit" }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
              {saving ? "Salvando…" : saved ? "Vistoria salva" : "Salvar vistoria"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
