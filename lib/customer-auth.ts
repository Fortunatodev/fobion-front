/**
 * Utilitários de autenticação para o CLIENTE FINAL da loja pública.
 * Separado completamente do auth do proprietário (lib/auth.ts).
 */

const KEY = "forbion_customer_token"
const AUTH_EVENT = "forbion_customer_auth_change"

export const AUTH_CHANGE_EVENT = AUTH_EVENT

export const setCustomerToken = (token: string): void => {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY, token)
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { token } }))
}

export const removeCustomerToken = (): void => {
  if (typeof window === "undefined") return
  localStorage.removeItem(KEY)
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { token: null } }))
}

export const getCustomerToken = (): string | null => {
  if (typeof window === "undefined") return null
  return localStorage.getItem(KEY)
}

export const isCustomerAuthenticated = (): boolean => {
  const token = getCustomerToken()
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) {
      removeCustomerToken()
      return false
    }
    return true
  } catch {
    removeCustomerToken()
    return false
  }
}

export const getCustomerPayload = (): {
  sub: string
  name: string
  picture: string | null
  businessSlug: string
  businessId: string
  type: string
  exp: number
} | null => {
  const token = getCustomerToken()
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) {
      removeCustomerToken()
      return null
    }
    return payload
  } catch {
    return null
  }
}

// Alias para compatibilidade
export const clearCustomerSession = removeCustomerToken

export const customerApiGet = async <T>(path: string): Promise<T> => {
  const token = getCustomerToken()
  if (!token) throw new Error("Não autenticado")
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
  const res = await fetch(`${API}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    removeCustomerToken()
    throw new Error("Sessão expirada")
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as Record<string, string>).message || "Erro na requisição")
  }
  return res.json() as Promise<T>
}

export const customerApiPut = async <T>(path: string, body: unknown): Promise<T> => {
  const token = getCustomerToken()
  if (!token) throw new Error("Não autenticado")
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
  const res = await fetch(`${API}/api${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  if (res.status === 401) {
    removeCustomerToken()
    throw new Error("Sessão expirada")
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as Record<string, string>).message || "Erro na requisição")
  }
  return res.json() as Promise<T>
}

export const customerApiPost = async <T>(path: string, body: unknown): Promise<T> => {
  const token = getCustomerToken()
  if (!token) throw new Error("Não autenticado")
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
  const res = await fetch(`${API}/api${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  if (res.status === 401) {
    removeCustomerToken()
    throw new Error("Sessão expirada")
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as Record<string, string>).message || "Erro na requisição")
  }
  return res.json() as Promise<T>
}