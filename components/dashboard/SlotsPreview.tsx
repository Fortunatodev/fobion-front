"use client"

import { useMemo, useState } from "react"
import { Calendar, Check, Clock } from "lucide-react"
import { buildSlotGrid } from "@/lib/slots"

/** Um dia do expediente — espelha o BusinessHour da página de configurações. */
export interface PreviewDay {
  dayOfWeek: number
  isOpen: boolean
  openTime: string
  closeTime: string
}

interface SlotsPreviewProps {
  slotMinutes: number
  /** Semana inteira do expediente (7 itens, dom→sáb). O preview deriva tudo daqui. */
  hours: PreviewDay[]
  /** Cor de destaque da loja (vinda das configs). Default = azul Forbion. */
  accent?: string
}

type Period = "Manhã" | "Tarde" | "Noite"
const PERIOD_ORDER: Period[] = ["Manhã", "Tarde", "Noite"]

const DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const DAY_LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

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
 * Mini-calendário ao vivo da agenda do ponto de vista do cliente. Mostra uma faixa
 * de dias da semana selecionável + os horários do dia escolhido em "pílulas",
 * agrupados por Manhã/Tarde/Noite. Deriva os slots de buildSlotGrid(expediente +
 * slotMinutes), então atualiza reativo ao mudar intervalo/horários no pai. Alguns
 * slots aparecem como "ocupado" (riscado) e ao clicar num livre ele fica selecionado
 * (cor de destaque), ilustrando o fluxo de agendamento. NÃO é disponibilidade real.
 */
export default function SlotsPreview({ slotMinutes, hours, accent = "#0066FF" }: SlotsPreviewProps) {
  // Primeiro dia aberto vira a referência inicial; fallback pro primeiro dia da lista.
  const firstOpen = hours.find((h) => h.isOpen)?.dayOfWeek ?? hours[0]?.dayOfWeek ?? 1
  const [selectedDay, setSelectedDay] = useState<number>(firstOpen)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  // Dia atualmente exibido. Se sumiu/fechou, cai pra o primeiro aberto.
  const day = useMemo(() => {
    const exact = hours.find((h) => h.dayOfWeek === selectedDay)
    if (exact && exact.isOpen) return exact
    return hours.find((h) => h.isOpen) ?? null
  }, [hours, selectedDay])

  const grid = useMemo(() => {
    if (!day || !day.isOpen) return []
    return buildSlotGrid(day.openTime, day.closeTime, slotMinutes)
  }, [day, slotMinutes])

  // Marca alguns horários como "ocupado" só pra ilustrar (visual). Índices
  // determinísticos (2º slot e ~meio da grade) pra não pular ao mudar intervalo.
  const busyIdx = useMemo(() => {
    const s = new Set<number>()
    if (grid.length > 1) s.add(1)
    if (grid.length > 5) s.add(Math.floor(grid.length / 2))
    return s
  }, [grid])

  // Agrupa por período preservando a ordem dos horários dentro de cada bloco.
  const { groups, activePeriods } = useMemo(() => {
    const g: Record<Period, { time: string; busy: boolean }[]> = { "Manhã": [], "Tarde": [], "Noite": [] }
    grid.forEach((time, i) => g[periodOf(time)].push({ time, busy: busyIdx.has(i) }))
    return { groups: g, activePeriods: PERIOD_ORDER.filter((p) => g[p].length > 0) }
  }, [grid, busyIdx])

  // Seleção só vale se o horário ainda existe na grade do dia atual e está livre
  // (deriva em render — evita useEffect que setaria estado e quebraria o lint do Next).
  const activeSlot = selectedSlot && grid.includes(selectedSlot) && !busyIdx.has(grid.indexOf(selectedSlot))
    ? selectedSlot
    : null

  function pickDay(dow: number) {
    setSelectedDay(dow)
    setSelectedSlot(null)
  }

  // Ordena os dias dom→sáb pra a faixa do topo (independe da ordem do array recebido).
  const weekStrip = useMemo(
    () => [...hours].sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    [hours],
  )

  const noneOpen = !hours.some((h) => h.isOpen)

  return (
    <div style={{
      marginTop: 12, borderRadius: 16, overflow: "hidden",
      backgroundColor: "var(--c-elevated)", border: "1px solid var(--c-border)",
      boxShadow: "0 8px 28px -18px rgba(0,0,0,0.55)",
    }}>
      {/* Cabeçalho estilo "mini vitrine" */}
      <div style={{
        padding: "14px 16px",
        borderBottom: "1px solid var(--c-border)",
        background: `linear-gradient(135deg, ${accent}1f, transparent 70%)`,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            backgroundColor: `${accent}1f`, border: `1px solid ${accent}3d`,
          }}>
            <Calendar size={17} color={accent} />
          </span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
              Como o cliente vê sua agenda
            </p>
            <p style={{ fontSize: 11, color: "var(--c-text-3)", margin: "2px 0 0" }}>
              Intervalos de {slotMinutes} min · prévia ao vivo
            </p>
          </div>
        </div>
        {grid.length > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 600, color: accent,
            backgroundColor: `${accent}1A`, border: `1px solid ${accent}33`,
            borderRadius: 100, padding: "3px 10px", whiteSpace: "nowrap",
          }}>
            {grid.length} horário{grid.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Faixa de dias da semana (seg-dom) — selecionável */}
      <div style={{
        display: "flex", gap: 6, padding: "12px 16px",
        overflowX: "auto", borderBottom: "1px solid var(--c-border)",
        WebkitOverflowScrolling: "touch",
      }}>
        {weekStrip.map((d) => {
          const isSel = day?.dayOfWeek === d.dayOfWeek
          const closed = !d.isOpen
          return (
            <button
              key={d.dayOfWeek}
              type="button"
              onClick={() => !closed && pickDay(d.dayOfWeek)}
              disabled={closed}
              aria-pressed={isSel}
              title={closed ? `${DAY_LONG[d.dayOfWeek]} · fechado` : DAY_LONG[d.dayOfWeek]}
              style={{
                flex: "0 0 auto", minWidth: 48, padding: "8px 4px 7px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                borderRadius: 11, fontFamily: "inherit",
                transition: "all 0.15s ease",
                cursor: closed ? "not-allowed" : "pointer",
                opacity: closed ? 0.4 : 1,
                ...(isSel
                  ? {
                      backgroundColor: accent,
                      border: `1px solid ${accent}`,
                      boxShadow: `0 6px 16px -8px ${accent}`,
                    }
                  : {
                      backgroundColor: "var(--c-bg)",
                      border: "1px solid var(--c-border-2)",
                    }),
              }}
            >
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase",
                color: isSel ? "#fff" : "var(--c-text-4)",
              }}>
                {DAY_SHORT[d.dayOfWeek]}
              </span>
              <span style={{
                fontSize: 12.5, fontWeight: 600,
                color: isSel ? "#fff" : closed ? "var(--c-text-4)" : "var(--c-text-2)",
              }}>
                {closed ? "—" : d.openTime}
              </span>
            </button>
          )
        })}
      </div>

      {/* Corpo: horários do dia / estados vazios */}
      {noneOpen ? (
        <EmptyBody accent={accent} text="Abra ao menos um dia acima pra ver como sua agenda aparece pro cliente." />
      ) : !day || grid.length === 0 ? (
        <EmptyBody accent={accent} text="Defina os horários de funcionamento deste dia pra ver os slots." />
      ) : (
        <div style={{ padding: "16px 16px 6px", display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{
            fontSize: 12, color: "var(--c-text-3)", margin: 0,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Clock size={13} color="var(--c-text-4)" />
            Horários de <strong style={{ color: "var(--c-text-2)" }}>{DAY_LONG[day.dayOfWeek]}</strong>
            <span style={{ color: "var(--c-text-4)" }}>· {day.openTime}–{day.closeTime}</span>
          </p>

          {activePeriods.map((period) => (
            <div key={period}>
              <p style={{
                fontSize: 10, fontWeight: 700, color: "var(--c-text-4)",
                margin: "0 0 8px", letterSpacing: "1px", textTransform: "uppercase",
              }}>
                {period}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {groups[period].map(({ time, busy }) => {
                  const isSel = activeSlot === time
                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => !busy && setSelectedSlot(isSel ? null : time)}
                      disabled={busy}
                      aria-pressed={isSel}
                      title={busy ? "Horário ocupado (exemplo)" : "Horário disponível — clique pra ver o fluxo"}
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                        height: 34, minWidth: 60, padding: "0 12px", borderRadius: 10,
                        fontSize: 12.5, fontWeight: 600, fontVariantNumeric: "tabular-nums",
                        fontFamily: "inherit", transition: "all 0.15s ease",
                        ...(busy
                          ? {
                              backgroundColor: "var(--c-surface-2)",
                              border: "1px solid var(--c-border-2)",
                              color: "var(--c-text-4)",
                              textDecoration: "line-through",
                              cursor: "not-allowed",
                            }
                          : isSel
                          ? {
                              backgroundColor: accent,
                              border: `1px solid ${accent}`,
                              color: "#fff",
                              cursor: "pointer",
                              boxShadow: `0 6px 16px -8px ${accent}`,
                            }
                          : {
                              backgroundColor: "var(--c-bg)",
                              border: `1px solid ${accent}40`,
                              color: "var(--c-text)",
                              cursor: "pointer",
                            }),
                      }}
                    >
                      {isSel && <Check size={13} color="#fff" />}
                      {time}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Mini-resumo do fluxo de agendamento (aparece ao selecionar) */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "11px 13px", borderRadius: 11, marginTop: 2,
            transition: "all 0.18s ease",
            ...(activeSlot
              ? { backgroundColor: `${accent}14`, border: `1px solid ${accent}3d` }
              : { backgroundColor: "var(--c-bg)", border: "1px dashed var(--c-border-2)" }),
          }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              backgroundColor: activeSlot ? accent : "var(--c-surface-2)",
            }}>
              <Check size={15} color={activeSlot ? "#fff" : "var(--c-text-4)"} />
            </span>
            <span style={{ fontSize: 12.5, color: "var(--c-text-2)", lineHeight: 1.4 }}>
              {activeSlot ? (
                <>
                  O cliente escolheria{" "}
                  <strong style={{ color: "var(--c-text)" }}>
                    {DAY_SHORT[day.dayOfWeek]} {activeSlot}
                  </strong>{" "}
                  e confirmaria o agendamento.
                </>
              ) : (
                "Clique num horário livre pra ver o que o cliente faria."
              )}
            </span>
          </div>
        </div>
      )}

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

/** Estado vazio compartilhado (sem dias abertos / sem horário). */
function EmptyBody({ accent, text }: { accent: string; text: string }) {
  return (
    <div style={{ padding: "22px 16px", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        backgroundColor: `${accent}14`, border: `1px solid ${accent}2e`,
      }}>
        <Clock size={15} color={accent} />
      </span>
      <p style={{ fontSize: 12.5, color: "var(--c-text-3)", margin: 0, lineHeight: 1.5 }}>
        {text}
      </p>
    </div>
  )
}
