/**
 * Formata o horário de um scheduledAt ISO string.
 * 
 * IMPORTANTE: os horários são salvos em UTC "puro" — ou seja,
 * "08:00" do negócio é armazenado como "08:00Z".
 * Para exibir corretamente, extraímos hora/minuto do UTC,
 * NÃO do fuso local do browser.
 */
export function formatScheduleTime(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso)
  const h = d.getUTCHours().toString().padStart(2, "0")
  const m = d.getUTCMinutes().toString().padStart(2, "0")
  return `${h}:${m}`
}

/**
 * Retorna a data YYYY-MM-DD de um scheduledAt baseado em UTC.
 */
export function formatScheduleDate(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso)
  const y = d.getUTCFullYear()
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0")
  const day = d.getUTCDate().toString().padStart(2, "0")
  return `${y}-${m}-${day}`
}