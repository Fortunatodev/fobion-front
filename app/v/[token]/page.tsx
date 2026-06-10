"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  ShieldCheck, AlertTriangle, Car, Calendar, User, MapPin,
  FileText, PenLine, Image as ImageIcon, X, BadgeCheck,
} from "lucide-react"
import ForbionLogo from "@/components/shared/ForbionLogo"

/**
 * V6 — Página PÚBLICA do relatório de vistoria (read-only, sem auth/sidebar).
 * O cliente abre pelo link enviado no WhatsApp e vê fotos + avarias + assinatura.
 * Vira a prova: estado documentado do carro na entrada, com selo de aprovação.
 * Back: GET /api/public/inspection/:token (público).
 */
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

type Severity = "small" | "medium" | "large"

interface DamageMark { x: number; y: number; severity: Severity; note?: string | null }

interface PublicReport {
  business: {
    name: string
    cnpj?: string | null
    address?: string | null
    whatsapp?: string | null
    coverImage?: string | null
    ownerAvatarUrl?: string | null
  }
  schedule: {
    scheduledAt: string
    services: string[]
    totalPrice?: number | null
  }
  customer: { name: string | null }
  vehicle: {
    plate?: string | null
    model?: string | null
    color?: string | null
  }
  inspection: {
    photoUrls: string[]
    damageMarks: DamageMark[]
    notes: string | null
    signature: string | null
    lockedAt: string | null
  }
  // back: severityCounts = { verde(leve), amarelo(médio), vermelho(grave) }
  summary: {
    severityCounts: { verde: number; amarelo: number; vermelho: number }
    total: number
    status: "aprovado" | "com_avarias"
  }
}

const SEV: Record<Severity, { label: string; color: string }> = {
  small:  { label: "Leve",  color: "#F59E0B" },
  medium: { label: "Médio", color: "#F97316" },
  large:  { label: "Grave", color: "#EF4444" },
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d)
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PublicReportPage() {
  const { token } = useParams<{ token: string }>()

  const [report, setReport] = useState<PublicReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [zoom, setZoom] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const r = await fetch(`${API}/api/public/inspection/${token}`)
        if (cancelled) return
        if (!r.ok) {
          setNotFound(true)
          return
        }
        const d = (await r.json()) as PublicReport
        setReport(d)
      } catch {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [token])

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--c-bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "'Inter',-apple-system,sans-serif" }}>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid var(--c-border)", borderTopColor: "#0066FF", animation: "sp 0.7s linear infinite" }} />
        <p style={{ fontSize: 14, color: "var(--c-text-4)" }}>Carregando relatório…</p>
      </div>
    )
  }

  // ── 404 ─────────────────────────────────────────────────────────────────────
  if (notFound || !report) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--c-bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, fontFamily: "'Inter',-apple-system,sans-serif", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FileText size={28} color="var(--c-text-4)" />
        </div>
        <p style={{ fontSize: 20, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>Relatório não encontrado</p>
        <p style={{ fontSize: 14, color: "var(--c-text-3)", margin: 0, maxWidth: 360, lineHeight: 1.6 }}>
          O link pode ter expirado ou estar incorreto. Confira o endereço com a estética que enviou.
        </p>
        <div style={{ marginTop: 16 }}>
          <ForbionLogo size="sm" as="span" color="var(--c-text-4)" />
        </div>
      </div>
    )
  }

  const { business, schedule, customer, vehicle, inspection, summary } = report
  const theme = "#0066FF"
  const logo = business.coverImage || business.ownerAvatarUrl || null
  const sev = summary.severityCounts
  const approved = summary.status === "aprovado"

  // Selo: verde se aprovado/sem avarias; senão âmbar/vermelho conforme a pior gravidade.
  const sealColor = approved
    ? "#10B981"
    : sev.vermelho > 0
      ? "#EF4444"
      : "#F59E0B"

  const card: React.CSSProperties = {
    background: "var(--c-elevated)",
    border: "1px solid var(--c-border)",
    borderRadius: 16,
    padding: 18,
  }
  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 800, color: "var(--c-text-3)",
    textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px",
    display: "flex", alignItems: "center", gap: 7,
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)", color: "var(--c-text)", fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif" }}>
      <style>{`* { box-sizing: border-box; }`}</style>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 16px 48px" }}>

        {/* ── CABEÇALHO DA ESTÉTICA ── */}
        <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
          {logo ? (
            <img
              src={logo}
              alt={business.name}
              style={{ width: 52, height: 52, borderRadius: 14, objectFit: "cover", border: "1px solid var(--c-border)", flexShrink: 0 }}
            />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${theme}, ${theme}99)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
              {business.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.4px", lineHeight: 1.2 }}>{business.name}</p>
            {business.cnpj && <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "3px 0 0" }}>CNPJ {business.cnpj}</p>}
            {business.address && (
              <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin size={11} /> {business.address}
              </p>
            )}
          </div>
        </header>

        {/* ── SELO DE STATUS ── */}
        <div style={{ background: `${sealColor}14`, border: `1px solid ${sealColor}40`, borderRadius: 16, padding: "16px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${sealColor}26`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {approved ? <ShieldCheck size={24} color={sealColor} /> : <AlertTriangle size={24} color={sealColor} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: sealColor, margin: 0, letterSpacing: "-0.3px" }}>
              {approved ? "Aprovado — sem avarias" : "Veículo com avarias registradas"}
            </p>
            <p style={{ fontSize: 12.5, color: "var(--c-text-2)", margin: "3px 0 0" }}>
              {approved
                ? "Nenhum ponto de avaria foi marcado nesta vistoria de entrada."
                : `${sev.verde} leve${sev.verde === 1 ? "" : "s"} · ${sev.amarelo} médi${sev.amarelo === 1 ? "a" : "as"} · ${sev.vermelho} grave${sev.vermelho === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>

        {/* ── ATENDIMENTO (cliente / veículo / data / serviços) ── */}
        <div style={{ ...card, marginBottom: 16 }}>
          <p style={sectionLabel}><BadgeCheck size={13} /> Vistoria de entrada</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
            <InfoItem icon={<User size={14} />} label="Cliente" value={customer.name || "—"} />
            <InfoItem icon={<Car size={14} />} label="Veículo" value={[vehicle.model, vehicle.color].filter(Boolean).join(" · ") || "—"} />
            <InfoItem icon={<FileText size={14} />} label="Placa" value={vehicle.plate || "—"} mono />
            <InfoItem icon={<Calendar size={14} />} label="Data" value={formatDateTime(schedule.scheduledAt)} />
          </div>

          {(schedule.services.length > 0 || (schedule.totalPrice != null && schedule.totalPrice > 0)) && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--c-border)" }}>
              {schedule.services.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: schedule.totalPrice != null && schedule.totalPrice > 0 ? 12 : 0 }}>
                  {schedule.services.map((s, i) => (
                    <span key={i} style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: "5px 10px" }}>{s}</span>
                  ))}
                </div>
              )}
              {schedule.totalPrice != null && schedule.totalPrice > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, color: "var(--c-text-3)" }}>Valor do atendimento</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "var(--c-text)", letterSpacing: "-0.5px" }}>{formatCurrency(schedule.totalPrice)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── FOTOS ── */}
        {inspection.photoUrls.length > 0 && (
          <div style={{ ...card, marginBottom: 16 }}>
            <p style={sectionLabel}><ImageIcon size={13} /> Fotos da chegada ({inspection.photoUrls.length})</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
              {inspection.photoUrls.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setZoom(url)}
                  style={{ aspectRatio: "4/3", borderRadius: 10, overflow: "hidden", border: "1px solid var(--c-border)", padding: 0, cursor: "zoom-in", background: "var(--c-bg)" }}
                >
                  <img src={url} alt={`Foto ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── AVARIAS (diagrama + lista) ── */}
        <div style={{ ...card, marginBottom: 16 }}>
          <p style={sectionLabel}><AlertTriangle size={13} /> Pontos de avaria</p>
          {inspection.damageMarks.length === 0 ? (
            <p style={{ fontSize: 13.5, color: "var(--c-text-3)", margin: 0, display: "flex", alignItems: "center", gap: 7 }}>
              <ShieldCheck size={15} color="#10B981" /> Nenhuma avaria registrada na entrada.
            </p>
          ) : (
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              {/* diagrama */}
              <div style={{ position: "relative", width: 200, height: 340, flexShrink: 0, background: "var(--c-bg)", borderRadius: 16, border: "1px solid var(--c-border)", margin: "0 auto" }}>
                <svg viewBox="0 0 200 340" width="200" height="340" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                  <rect x="38" y="20" width="124" height="300" rx="48" fill="none" stroke="var(--c-border-2)" strokeWidth="2" />
                  <path d="M58 70 L142 70 L128 110 L72 110 Z" fill="none" stroke="var(--c-border-2)" strokeWidth="1.5" />
                  <path d="M72 230 L128 230 L142 270 L58 270 Z" fill="none" stroke="var(--c-border-2)" strokeWidth="1.5" />
                  <rect x="62" y="120" width="76" height="100" rx="6" fill="none" stroke="var(--c-border-2)" strokeWidth="1" />
                  <text x="100" y="174" textAnchor="middle" fill="var(--c-border-2)" fontSize="10">frente ↑</text>
                </svg>
                {inspection.damageMarks.map((m, i) => (
                  <span
                    key={i}
                    title={m.note ?? SEV[m.severity].label}
                    style={{ position: "absolute", left: `${m.x * 100}%`, top: `${m.y * 100}%`, transform: "translate(-50%,-50%)", width: 18, height: 18, borderRadius: "50%", background: SEV[m.severity].color, border: "2px solid rgba(0,0,0,0.5)", fontSize: 9, fontWeight: 800, color: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {i + 1}
                  </span>
                ))}
              </div>
              {/* lista */}
              <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 6 }}>
                {inspection.damageMarks.map((m, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 9, background: "var(--c-bg)", border: `1px solid ${SEV[m.severity].color}40` }}>
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: SEV[m.severity].color, color: "#000", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: SEV[m.severity].color, textTransform: "uppercase", letterSpacing: "0.03em", flexShrink: 0 }}>{SEV[m.severity].label}</span>
                    {m.note && <span style={{ fontSize: 12.5, color: "var(--c-text-2)", flex: 1, minWidth: 0 }}>— {m.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── OBSERVAÇÕES ── */}
        {inspection.notes && (
          <div style={{ ...card, marginBottom: 16 }}>
            <p style={sectionLabel}><FileText size={13} /> Observações</p>
            <p style={{ fontSize: 13.5, color: "var(--c-text-2)", margin: 0, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{inspection.notes}</p>
          </div>
        )}

        {/* ── ASSINATURA ── */}
        {inspection.signature && (
          <div style={{ ...card, marginBottom: 16 }}>
            <p style={sectionLabel}><PenLine size={13} /> Assinatura do cliente</p>
            <img
              src={inspection.signature}
              alt="Assinatura do cliente"
              style={{ width: "100%", maxWidth: 380, height: 120, objectFit: "contain", background: "var(--c-bg)", borderRadius: 10, border: "1px solid var(--c-border)" }}
            />
            {inspection.lockedAt && (
              <p style={{ fontSize: 11.5, color: "var(--c-text-4)", margin: "10px 0 0" }}>
                Vistoria registrada e travada em {formatDateTime(inspection.lockedAt)} — documento imutável.
              </p>
            )}
          </div>
        )}

        {/* ── RODAPÉ ── */}
        <footer style={{ marginTop: 28, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: 0, display: "flex", alignItems: "center", gap: 5 }}>
            Powered by <ForbionLogo size="sm" as="span" color="var(--c-text-4)" />
          </p>
        </footer>
      </div>

      {/* ── LIGHTBOX ── */}
      {zoom && (
        <div
          onClick={() => setZoom(null)}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out" }}
        >
          <button
            onClick={() => setZoom(null)}
            aria-label="Fechar"
            style={{ position: "absolute", top: 16, right: 16, width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Foto ampliada" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 12 }} />
        </div>
      )}
    </div>
  )
}

// ── Sub-componente ───────────────────────────────────────────────────────────────

function InfoItem({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
        {icon} {label}
      </p>
      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)", margin: 0, letterSpacing: mono ? "0.06em" : undefined, fontFamily: mono ? "ui-monospace, monospace" : undefined, wordBreak: "break-word" }}>{value}</p>
    </div>
  )
}
