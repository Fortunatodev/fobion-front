"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"

/**
 * Pós-venda virou sub-aba de Relacionamento. Mantemos a rota como redirect
 * pra não quebrar links antigos (?tab=garantia|retencao → ?aba=...).
 */
function PosVendaRedirect() {
  const router = useRouter()
  const params = useSearchParams()
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    const tab = params.get("tab")
    const aba = tab === "retencao" ? "retencao" : tab === "garantia" ? "garantia" : "hoje"
    router.replace(`/dashboard/relacionamento?aba=${aba}`)
  }, [router, params])
  return null
}

export default function PosVendaPage() {
  return (
    <Suspense fallback={null}>
      <PosVendaRedirect />
    </Suspense>
  )
}
