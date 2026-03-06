"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { isAuthenticated } from "@/lib/auth"
import ForbionLogo from "@/components/shared/ForbionLogo"

/**
 * Página raiz — redireciona para dashboard ou login conforme autenticação.
 */
export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/dashboard")
    } else {
      router.replace("/auth/login")
    }
  }, [router])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
      {/* Logo tipográfico */}
      <ForbionLogo size="xl" />

      {/* Spinner minimalista */}
      <div className="w-5 h-5 rounded-full border-2 border-border-2 border-t-primary animate-spin" />
    </div>
  )
}