"use client"

import { useEffect, useState } from "react"
import { apiGet } from "@/lib/api"
import { useUser } from "@/contexts/UserContext"
import { hasProAccess } from "@/lib/plan"

/**
 * Conta quantos clientes estão "pra cuidar hoje" (badge no menu + card no home).
 * Usa o modo leve do endpoint (?countOnly=1). Atualiza no mount e ao focar a aba.
 * Best-effort: qualquer erro vira 0 (nunca quebra o menu).
 *
 * Pós-venda é feature PRO: no Essencial nem chamamos o endpoint (daria 403 e poluiria o
 * console em toda página). Sem badge pra quem não tem o recurso.
 */
export function useCrmFilaCount(): number {
  const [total, setTotal] = useState(0)
  const { planStatus } = useUser()
  const isPro = hasProAccess(planStatus)

  useEffect(() => {
    if (!isPro) { setTotal(0); return }
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
  }, [isPro])

  return total
}
