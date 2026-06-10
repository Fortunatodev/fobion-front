"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Rota legada: "Retenção de clientes (RFM)" mudou pra tab Pós-venda.
 * Mantida pra não quebrar links antigos — redireciona pra /dashboard/pos-venda?tab=retencao.
 */
export default function RetencaoRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/dashboard/pos-venda?tab=retencao")
  }, [router])

  return null
}
