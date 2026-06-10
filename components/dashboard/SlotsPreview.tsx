"use client"

import { buildSlotGrid } from "@/lib/slots"

const MAX_CHIPS = 10

interface SlotsPreviewProps {
  slotMinutes: number
  openTime?: string
  closeTime?: string
  dayLabel?: string
}

/**
 * Preview ao vivo da grade de horários. Render puro — deriva os slots SÓ das props
 * via buildSlotGrid (sem useEffect/useState), então atualiza reativo ao trocar o
 * intervalo no select pai. Mostra a GRADE de horários, não disponibilidade real.
 */
export default function SlotsPreview({ slotMinutes, openTime, closeTime, dayLabel }: SlotsPreviewProps) {
  const hasHours = Boolean(openTime && closeTime)
  const grid = hasHours ? buildSlotGrid(openTime as string, closeTime as string, slotMinutes) : []

  // Sem dia de referência (nenhum dia aberto / horário incompleto) → estado vazio.
  if (!hasHours || grid.length === 0) {
    return (
      <div style={{
        marginTop: 12, padding: "14px 16px", borderRadius: 12,
        backgroundColor: "var(--c-elevated)", border: "1px dashed var(--c-border-2)",
      }}>
        <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: 0, lineHeight: 1.5 }}>
          Defina os horários de funcionamento acima pra ver o preview.
        </p>
      </div>
    )
  }

  const shown = grid.slice(0, MAX_CHIPS)
  const remaining = grid.length - shown.length

  return (
    <div style={{
      marginTop: 12, padding: 16, borderRadius: 12,
      backgroundColor: "var(--c-elevated)", border: "1px solid var(--c-border)",
    }}>
      <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: "0 0 10px", letterSpacing: "1px", textTransform: "uppercase" }}>
        Preview{dayLabel ? ` · ${dayLabel}` : ""}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {shown.map((time) => (
          <span
            key={time}
            style={{
              display: "inline-flex", alignItems: "center",
              height: 28, padding: "0 10px", borderRadius: 8,
              backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border-2)",
              fontSize: 12, fontWeight: 500, color: "var(--c-text-2)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {time}
          </span>
        ))}
        {remaining > 0 && (
          <span style={{ fontSize: 12, color: "var(--c-text-4)" }}>
            … {grid.length} horários no dia
          </span>
        )}
      </div>
      {remaining === 0 && (
        <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: "10px 0 0" }}>
          {grid.length} horário{grid.length !== 1 ? "s" : ""} no dia
        </p>
      )}
    </div>
  )
}
