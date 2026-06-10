"use client"

import { buildSlotGrid } from "@/lib/slots"

interface SlotsPreviewProps {
  slotMinutes: number
  openTime?: string
  closeTime?: string
  dayLabel?: string
  /** Cor de destaque da loja (vinda das configs). Default = azul Forbion. */
  accent?: string
}

type Period = "Manhã" | "Tarde" | "Noite"
const PERIOD_ORDER: Period[] = ["Manhã", "Tarde", "Noite"]

/** "HH:MM" → minutos desde 00:00 (pra classificar por período). */
function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Manhã < 12:00, Tarde 12:00–17:59, Noite ≥ 18:00. */
function periodOf(hhmm: string): Period {
  const min = minutesOf(hhmm)
  if (min < 12 * 60) return "Manhã"
  if (min < 18 * 60) return "Tarde"
  return "Noite"
}

/**
 * Preview ao vivo da agenda do ponto de vista do cliente. Render puro — deriva os
 * slots SÓ das props via buildSlotGrid (sem useEffect/useState), então atualiza
 * reativo ao trocar o intervalo / horários no pai. Agrupa por período (Manhã/Tarde/
 * Noite) e marca 1-2 horários como "ocupado" só pra ilustrar. NÃO é disponibilidade
 * real — é um exemplo de como a vitrine pública apresenta a grade.
 */
export default function SlotsPreview({ slotMinutes, openTime, closeTime, dayLabel, accent = "#0066FF" }: SlotsPreviewProps) {
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
          Defina os horários de funcionamento acima pra ver como sua agenda aparece pro cliente.
        </p>
      </div>
    )
  }

  // Marca alguns horários como "ocupado" só pra ilustrar (visual). Usa índices
  // determinísticos (2º slot e ~meio da grade) pra não pular ao mudar o intervalo.
  const busyIdx = new Set<number>()
  if (grid.length > 1) busyIdx.add(1)
  if (grid.length > 5) busyIdx.add(Math.floor(grid.length / 2))

  // Agrupa por período preservando a ordem dos horários dentro de cada bloco.
  const groups: Record<Period, { time: string; busy: boolean }[]> = {
    "Manhã": [], "Tarde": [], "Noite": [],
  }
  grid.forEach((time, i) => {
    groups[periodOf(time)].push({ time, busy: busyIdx.has(i) })
  })
  const activePeriods = PERIOD_ORDER.filter((p) => groups[p].length > 0)

  return (
    <div style={{
      marginTop: 12, borderRadius: 14, overflow: "hidden",
      backgroundColor: "var(--c-elevated)", border: "1px solid var(--c-border)",
    }}>
      {/* Cabeçalho estilo "mini vitrine" */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--c-border)",
        background: `linear-gradient(135deg, ${accent}14, transparent)`,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
      }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
            Como o cliente vê sua agenda
          </p>
          <p style={{ fontSize: 11, color: "var(--c-text-3)", margin: "3px 0 0" }}>
            {dayLabel ? `Exemplo de ${dayLabel} · ` : ""}intervalos de {slotMinutes} min
          </p>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, color: accent,
          backgroundColor: `${accent}1A`, border: `1px solid ${accent}33`,
          borderRadius: 100, padding: "3px 10px", whiteSpace: "nowrap",
        }}>
          {grid.length} horário{grid.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Períodos */}
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        {activePeriods.map((period) => (
          <div key={period}>
            <p style={{
              fontSize: 10, fontWeight: 700, color: "var(--c-text-4)",
              margin: "0 0 8px", letterSpacing: "1px", textTransform: "uppercase",
            }}>
              {period}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {groups[period].map(({ time, busy }) => (
                <span
                  key={time}
                  title={busy ? "Horário ocupado (exemplo)" : "Horário disponível"}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    height: 32, minWidth: 58, padding: "0 12px", borderRadius: 9,
                    fontSize: 12.5, fontWeight: 600, fontVariantNumeric: "tabular-nums",
                    transition: "all 0.15s",
                    ...(busy
                      ? {
                          backgroundColor: "var(--c-surface-2)",
                          border: "1px solid var(--c-border-2)",
                          color: "var(--c-text-4)",
                          textDecoration: "line-through",
                          cursor: "not-allowed",
                        }
                      : {
                          backgroundColor: "var(--c-bg)",
                          border: `1px solid ${accent}40`,
                          color: "var(--c-text)",
                          cursor: "pointer",
                        }),
                  }}
                >
                  {time}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legenda */}
      <div style={{
        padding: "10px 16px", borderTop: "1px solid var(--c-border)",
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--c-text-3)" }}>
          <span style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: "var(--c-bg)", border: `1px solid ${accent}40` }} />
          Disponível
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--c-text-3)" }}>
          <span style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: "var(--c-surface-2)", border: "1px solid var(--c-border-2)" }} />
          Ocupado
        </span>
        <span style={{ fontSize: 11, color: "var(--c-text-4)", marginLeft: "auto" }}>
          Exemplo ilustrativo
        </span>
      </div>
    </div>
  )
}
