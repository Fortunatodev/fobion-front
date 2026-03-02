import type { TokenPayload } from "@/types"

const TOKEN_KEY = "forbion_token"

/**
 * Retorna o token JWT armazenado ou null se não existir.
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * Persiste o token JWT no localStorage e em cookie para o middleware.
 */
export function setToken(token: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(TOKEN_KEY, token)
  // Persiste em cookie para o middleware Next.js poder ler
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=604800; SameSite=Strict`
}

/**
 * Remove o token JWT do localStorage e invalida o cookie.
 */
export function removeToken(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(TOKEN_KEY)
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; SameSite=Strict`
}

/**
 * Decodifica o payload de um JWT sem verificar a assinatura.
 * Retorna null se o token for inválido.
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const decoded = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(decoded) as TokenPayload
  } catch {
    return null
  }
}

/**
 * Verifica se o usuário está autenticado com token válido e não expirado.
 */
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false
  const token = getToken()
  if (!token) return false
  const payload = decodeToken(token)
  if (!payload) return false
  // Check expiry
  return payload.exp > Date.now() / 1000
}

/**
 * Retorna o payload decodificado do token atual ou null.
 */
export function getTokenPayload(): TokenPayload | null {
  const token = getToken()
  if (!token) return null
  return decodeToken(token)
}

/**
 * Verifica se o token expira em menos de 1 hora.
 */
export function isTokenExpiringSoon(): boolean {
  const payload = getTokenPayload()
  if (!payload) return false
  return payload.exp - Date.now() / 1000 < 3600
}