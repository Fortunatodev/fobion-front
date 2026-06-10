"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Rota legada: "Retornos & Garantias" mudou pra tab Pós-venda.
 * Mantida pra não quebrar links antigos — redireciona pra /dashboard/pos-venda?tab=garantia.
 */
export default function RecallsRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/dashboard/pos-venda?tab=garantia")
  }, [router])

  return null
}
