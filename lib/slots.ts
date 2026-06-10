// Geração da GRADE de horários da agenda (paridade com o back: getAvailableSlotsV2).
// É só a grade (de openTime até closeTime, passo = stepMin), NÃO disponibilidade real
// (não checa slots ocupados). Função pura, sem React — testável isoladamente.

/** Converte "HH:MM" em minutos desde 00:00. Retorna NaN se inválido. */
function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return NaN
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return NaN
  return h * 60 + min
}

/** Converte minutos desde 00:00 em "HH:MM". */
function toHHMM(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/**
 * Constrói a grade de horários de "openTime" até "closeTime" com passo de `stepMin`.
 * Retorna `[]` para entradas inválidas (stepMin <= 0, horários malformados ou close <= open).
 */
export function buildSlotGrid(openTime: string, closeTime: string, stepMin: number): string[] {
  if (!Number.isFinite(stepMin) || stepMin <= 0) return []
  const openMin = toMinutes(openTime)
  const closeMin = toMinutes(closeTime)
  if (Number.isNaN(openMin) || Number.isNaN(closeMin)) return []
  if (closeMin <= openMin) return []

  const slots: string[] = []
  for (let m = openMin; m <= closeMin; m += stepMin) {
    slots.push(toHHMM(m))
  }
  return slots
}
