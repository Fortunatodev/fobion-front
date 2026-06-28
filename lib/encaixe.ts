import { toast } from "sonner"

/**
 * "Encaixe" — ao FECHAR uma comanda, a vaga dela é liberada na agenda (o backend tira
 * DONE da contagem de capacidade). Em vez de fechar em silêncio, oferecemos encaixar
 * alguém naquele horário. Usado no Calendário, Comandas e Pátio.
 */

export interface ClosedSlotLike {
  scheduledAt: string            // ISO pseudo-UTC (ex.: "2026-07-01T14:00:00.000Z")
  employeeId?: string | null
}

export interface FreedSlot {
  date: string        // "YYYY-MM-DD"
  time: string        // "HH:MM"
  employeeId: string  // id do profissional ou "owner" (lane do dono)
}

/** Deriva a vaga liberada (data/hora/profissional) do agendamento que foi fechado. */
export function freedSlot(s: ClosedSlotLike): FreedSlot {
  // scheduledAt é pseudo-UTC (o "14:00" da loja é gravado como 14:00Z) — fatiar o ISO
  // devolve o horário de parede, na mesma convenção que a grade de slots usa.
  const iso = s.scheduledAt
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
    employeeId: s.employeeId ?? "owner",
  }
}

/**
 * Toast "abriu vaga — encaixar?". `onEncaixar` recebe a vaga: na própria página de
 * Comandas abre o modal pré-preenchido; no Pátio/Calendário navega pra lá.
 */
export function promptEncaixe(s: ClosedSlotLike, onEncaixar: (slot: FreedSlot) => void): void {
  const slot = freedSlot(s)
  toast.success(`Comanda fechada — abriu vaga às ${slot.time}.`, {
    description: "Quer encaixar alguém nesse horário?",
    duration: 8000,
    action: { label: "Encaixar", onClick: () => onEncaixar(slot) },
  })
}

/** URL pra abrir o modal de novo agendamento já no encaixe (Pátio/Calendário → Comandas). */
export function encaixeUrl(slot: FreedSlot): string {
  const q = new URLSearchParams({ novo: "1", data: slot.date, hora: slot.time, emp: slot.employeeId })
  return `/dashboard/agendamentos?${q.toString()}`
}
