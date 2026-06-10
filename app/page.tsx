"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { isAuthenticated } from "@/lib/auth"

/**
 * Root do app. Não tem landing de marketing aqui (essa vive no site forbion.digital).
 * Redireciona: logado → /dashboard; deslogado → /auth/login.
 */
export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace(isAuthenticated() ? "/dashboard" : "/auth/login")
  }, [router])

  return (
    <div
      data-theme="dark"
      style={{
        minHeight: "100vh",
        background: "var(--c-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "3px solid var(--c-border)",
          borderTopColor: "#0066FF",
          animation: "spin 0.7s linear infinite",
        }}
      />
    </div>
  )
}
