/**
 * Utilitários de autenticação para o CLIENTE FINAL da loja pública.
 * Separado completamente do auth do proprietário (lib/auth.ts).
 */
import { decodeJwtPayload } from "@/lib/jwt"

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
  const payload = decodeJwtPayload<{ exp?: number }>(token)
  if (!payload) { removeCustomerToken(); return false }
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp && payload.exp < now) {
    removeCustomerToken()
    return false
  }
  return true
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
  // UTF-8-safe: o token carrega `name` (acentuado) — atob lia como Latin-1 ("VinÃ­cius").
  const payload = decodeJwtPayload<{
    sub: string; name: string; picture: string | null
    businessSlug: string; businessId: string; type: string; exp: number
  }>(token)
  if (!payload) return null
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp && payload.exp < now) {
    removeCustomerToken()
    return null
  }
  return payload
}

// Alias para compatibilidade
export const clearCustomerSession = removeCustomerToken

/**
 * V6: helpers preparados pra cookie httpOnly cross-site.
 *
 * - `credentials: 'include'` faz o browser anexar cookies do domínio do back
 *   (necessário pra cookie httpOnly cross-site). CORS no back já tem
 *   `credentials: true` (lore-back/server.ts:72).
 * - `Authorization: Bearer` mantido como back-compat — quando Bearer está
 *   presente e cookie ausente, middleware aceita. Quando ambos, cookie ganha.
 * - Quando o front migrar 100% pra cookie, basta remover o `getCustomerToken()`
 *   + Bearer e usar só `credentials: 'include'`.
 *
 * Pré-requisito V6 pra cookie cross-site funcionar:
 *   NEXT_PUBLIC_API_URL=https://api.forbion.digital (no Vercel)
 *   COOKIE_DOMAIN=.forbion.digital (no Railway)
 */

const getApiBase = (): string =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

// Headers padrão — Authorization opcional (back-compat localStorage)
const buildHeaders = (extra: HeadersInit = {}): HeadersInit => {
  const token = getCustomerToken()
  const headers: Record<string, string> = { ...(extra as Record<string, string>) }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

// Tratamento padronizado de 401/erro
async function handleResponse<T>(res: Response): Promise<T> {
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

export const customerApiGet = async <T>(path: string): Promise<T> => {
  const res = await fetch(`${getApiBase()}/api${path}`, {
    headers: buildHeaders(),
    credentials: "include", // V6: cookie httpOnly viaja com a requisição
  })
  return handleResponse<T>(res)
}

export const customerApiPut = async <T>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(`${getApiBase()}/api${path}`, {
    method: "PUT",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(body),
  })
  return handleResponse<T>(res)
}

export const customerApiPost = async <T>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(`${getApiBase()}/api${path}`, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(body),
  })
  return handleResponse<T>(res)
}

export const customerApiDelete = async <T>(path: string): Promise<T> => {
  const res = await fetch(`${getApiBase()}/api${path}`, {
    method: "DELETE",
    headers: buildHeaders(),
    credentials: "include",
  })
  return handleResponse<T>(res)
}

/**
 * Verifica sessão via cookie httpOnly (GET /api/customer/session).
 * Use isto QUANDO migrar o front pra depender 100% de cookie e quiser
 * checar autenticação sem ler localStorage.
 */
export const fetchCustomerSession = async (): Promise<{
  id: string
  name: string
  picture: string | null
  businessSlug: string
  businessId: string
} | null> => {
  try {
    const res = await fetch(`${getApiBase()}/api/customer/session`, {
      credentials: "include",
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Logout server-side (limpa cookie httpOnly) + cliente (limpa localStorage).
 * Idempotente. Chama mesmo se não estiver autenticado.
 */
export const customerLogout = async (): Promise<void> => {
  try {
    await fetch(`${getApiBase()}/api/customer/logout`, {
      method: "POST",
      credentials: "include",
    })
  } catch {
    // network error — ainda limpa localStorage
  }
  removeCustomerToken()
}