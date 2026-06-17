"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Phone, Copy, Check, ExternalLink, Eye } from "lucide-react"

interface BusinessHourLite {
  dayOfWeek: number
  isOpen: boolean
  openTime: string
  closeTime: string
}

interface PublicStorePreviewProps {
  /** Nome do negócio (reativo ao input). */
  name: string
  /** Descrição (reativa ao input). */
  description: string
  /** Telefone (reativo ao input). */
  phone: string
  /** Avatar do proprietário (URL) ou null pra cair na inicial. */
  avatarUrl: string | null
  /** Cor de destaque da loja. */
  accent: string
  /** Horários de funcionamento — definem o "Aberto agora". */
  hours: BusinessHourLite[]
  /** URL pública real (a que abre a loja de verdade). */
  publicUrl: string
  /** Como o link aparece pro dono (domínio "bonito" + slug). */
  displayUrl: string
}

const DAY_LABELS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"]

// "#RRGGBB" → "r, g, b" pra montar rgba() com transparência.
function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "")
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `${r || 0}, ${g || 0}, ${b || 0}`
}

// Replica a lógica de "Aberto agora" da vitrine pública (inclui expediente que
// cruza a meia-noite). Render puro: deriva do horário atual + props.
function isOpenNow(hours: BusinessHourLite[]): boolean {
  const now = new Date()
  const dow = now.getDay()
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  const today = hours.find((h) => h.dayOfWeek === dow)
  if (!today || !today.isOpen) return false
  if (today.closeTime < today.openTime) {
    return hhmm >= today.openTime || hhmm <= today.closeTime
  }
  return hhmm >= today.openTime && hhmm <= today.closeTime
}

/**
 * Mini-preview ao vivo de como o negócio aparece pro cliente na loja pública.
 * Render puro (sem fetch) — tudo deriva das props, então atualiza reativo
 * conforme o dono digita nome/descrição/telefone, troca a cor ou o avatar.
 * NÃO é a vitrine real; é um espelho fiel do cabeçalho dela pra dar confiança
 * antes de salvar/compartilhar.
 */
export default function PublicStorePreview({
  name, description, phone, avatarUrl, accent, hours, publicUrl, displayUrl,
}: PublicStorePreviewProps) {
  const [copied, setCopied] = useState(false)
  const rgb = hexToRgb(accent)
  const open = isOpenNow(hours)
  const safeName = name.trim() || "Sua loja"
  const initial = safeName.charAt(0).toUpperCase()
  const today = hours.find((h) => h.dayOfWeek === new Date().getDay())

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      toast.success("Link copiado! Cole no Instagram ou WhatsApp.")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Não foi possível copiar. Copie o link manualmente.")
    }
  }

  return (
    <div style={{
      borderRadius: 16, overflow: "hidden",
      backgroundColor: "var(--c-elevated)", border: "1px solid var(--c-border)",
    }}>
      {/* Rótulo do preview */}
      <div style={{
        padding: "10px 16px", borderBottom: "1px solid var(--c-border)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <Eye size={13} color="var(--c-text-4)" />
        <span style={{ fontSize: 11, color: "var(--c-text-4)", letterSpacing: "1px", textTransform: "uppercase", fontWeight: 600 }}>
          Como o cliente vê sua loja
        </span>
      </div>

      {/* "Hero" mini — espelha o cabeçalho da vitrine pública */}
      <div style={{
        padding: "22px 16px 18px",
        background: `linear-gradient(180deg, rgba(${rgb},0.10), transparent 70%)`,
        display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
      }}>
        {/* Badge aberto/fechado */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 11, fontWeight: 600, marginBottom: 14,
          color: open ? "#10B981" : "var(--c-text-3)",
          backgroundColor: open ? "rgba(16,185,129,0.1)" : "var(--c-surface-2)",
          border: `1px solid ${open ? "rgba(16,185,129,0.25)" : "var(--c-border-2)"}`,
          borderRadius: 100, padding: "4px 12px",
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: open ? "#10B981" : "var(--c-text-4)" }} />
          {open ? "Aberto agora" : "Fechado no momento"}
        </span>

        {/* Avatar (foto ou inicial) com selo de status, igual à vitrine */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={safeName}
              style={{
                width: 72, height: 72, borderRadius: "50%", objectFit: "cover",
                border: "3px solid var(--c-border)", display: "block",
              }}
            />
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: `linear-gradient(135deg, ${accent}, ${accent}99)`,
              border: "3px solid var(--c-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, fontWeight: 800, color: "var(--c-on-primary)",
            }}>
              {initial}
            </div>
          )}
          {open && (
            <span style={{
              position: "absolute", bottom: 2, right: 2,
              width: 16, height: 16, borderRadius: "50%",
              backgroundColor: "#10B981", border: "2px solid var(--c-elevated)",
            }} />
          )}
        </div>

        {/* Nome */}
        <p style={{
          fontSize: 17, fontWeight: 800, color: "var(--c-text)", margin: 0,
          letterSpacing: "-0.3px", lineHeight: 1.25, maxWidth: "100%", wordBreak: "break-word",
        }}>
          {safeName}
        </p>

        {/* Descrição (ou placeholder discreto) */}
        <p style={{
          fontSize: 12.5, color: description.trim() ? "var(--c-text-3)" : "var(--c-text-4)",
          margin: "6px 0 0", lineHeight: 1.5, maxWidth: 320,
          fontStyle: description.trim() ? "normal" : "italic",
        }}>
          {description.trim() || "Adicione uma descrição pra atrair seus clientes."}
        </p>

        {/* Telefone */}
        {phone.trim() && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 12, color: "var(--c-text-3)", marginTop: 10,
          }}>
            <Phone size={12} /> {phone.trim()}
          </span>
        )}

        {/* Horário de hoje — contexto do "Aberto agora" */}
        {today && (
          <span style={{ fontSize: 11, color: "var(--c-text-4)", marginTop: 8 }}>
            {DAY_LABELS[today.dayOfWeek]}: {today.isOpen ? `${today.openTime} às ${today.closeTime}` : "Fechado"}
          </span>
        )}
      </div>

      {/* Link público + ações */}
      <div style={{ padding: "14px 16px", borderTop: "1px solid var(--c-border)" }}>
        <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: "0 0 8px" }}>
          Seu link de agendamento
        </p>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          backgroundColor: "var(--c-bg)", border: `1px solid rgba(${rgb},0.3)`,
          borderRadius: 10, padding: "9px 12px", marginBottom: 10,
        }}>
          <span style={{
            flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--c-text)", fontFamily: "monospace",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {displayUrl}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={handleCopy}
            style={{
              flex: 1, minWidth: 130, height: 38, borderRadius: 10, border: "none",
              background: copied ? "rgba(16,185,129,0.12)" : accent,
              color: copied ? "#10B981" : "var(--c-on-primary)",
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all 0.15s",
            }}
          >
            {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar link</>}
          </button>
          <button
            onClick={() => window.open(publicUrl, "_blank", "noopener,noreferrer")}
            style={{
              flex: 1, minWidth: 130, height: 38, borderRadius: 10,
              border: "1px solid var(--c-border-2)", backgroundColor: "transparent",
              color: "var(--c-text-2)", fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <ExternalLink size={14} /> Abrir loja
          </button>
        </div>
      </div>
    </div>
  )
}
