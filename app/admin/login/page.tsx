"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import ForbionLogo from "@/components/shared/ForbionLogo"

export default function AdminLoginPage() {
  const router = useRouter()
  const [token, setToken] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) {
      setError("Insira o token de acesso.")
      return
    }
    setLoading(true)
    setError("")

    // Verificar token chamando backend
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
      const res = await fetch(`${API}/api/admin/businesses`, {
        headers: { "x-admin-token": token.trim() },
      })

      if (res.status === 403 || res.status === 401) {
        setError("Token inválido.")
        setLoading(false)
        return
      }

      if (!res.ok) {
        setError("Erro ao verificar token.")
        setLoading(false)
        return
      }

      // Token válido → setar cookie e redirecionar
      document.cookie = `admin-token=${token.trim()}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Strict`
      router.push("/admin")
      router.refresh()
    } catch {
      setError("Erro de conexão com o servidor.")
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#09090B",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
    }}>
      <form onSubmit={handleLogin} style={{
        background: "#18181B", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 16, padding: 40, width: 400, maxWidth: "90vw",
      }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <ForbionLogo size="xl" />
          </div>
          <h1 style={{ color: "#FAFAFA", fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>
            Forbion Admin
          </h1>
          <p style={{ color: "#71717A", fontSize: 14, margin: 0 }}>
            Insira o token de acesso para entrar.
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: "#A1A1AA", fontSize: 12, fontWeight: 500, marginBottom: 6, display: "block" }}>
            Token de acesso
          </label>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="Cole o token aqui..."
            autoFocus
            style={{
              width: "100%", padding: "12px 14px", background: "#09090B",
              border: `1px solid ${error ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 8, color: "#FAFAFA", fontSize: 14, outline: "none",
              boxSizing: "border-box", fontFamily: "monospace",
            }}
            onFocus={e => { if (!error) e.target.style.borderColor = "rgba(0,102,255,0.4)" }}
            onBlur={e => { if (!error) e.target.style.borderColor = "rgba(255,255,255,0.1)" }}
          />
        </div>

        {error && (
          <p style={{
            color: "#EF4444", fontSize: 13, marginBottom: 16, padding: "8px 12px",
            background: "rgba(239,68,68,0.08)", borderRadius: 6, border: "1px solid rgba(239,68,68,0.15)",
          }}>
            ⚠️ {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%", padding: "12px 0", background: "#0066FF",
            color: "white", border: "none", borderRadius: 8, fontWeight: 600,
            fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1, fontFamily: "inherit",
            transition: "opacity 0.15s",
          }}
        >
          {loading ? "Verificando..." : "Entrar"}
        </button>
      </form>
    </div>
  )
}
