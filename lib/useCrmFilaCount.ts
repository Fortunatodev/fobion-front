"use client"

import { useEffect, useState } from "react"
import { apiGet } from "@/lib/api"

/**
 * Conta quantos clientes estão "pra cuidar hoje" (badge no menu + card no home).
 * Usa o modo leve do endpoint (?countOnly=1). Atualiza no mount e ao focar a aba.
 * Best-effort: qualquer erro vira 0 (nunca quebra o menu).
 */
export function useCrmFilaCount(): number {
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let alive = true
    const load = () => {
      apiGet<{ total: number }>("/crm/fila", { countOnly: 1 })
        .then((r) => { if (alive) setTotal(r?.total ?? 0) })
        .catch(() => { if (alive) setTotal(0) })
    }
    load()
    const onFocus = () => load()
    window.addEventListener("focus", onFocus)
    return () => { alive = false; window.removeEventListener("focus", onFocus) }
  }, [])

  return total
}
