import axios, { AxiosError, AxiosRequestConfig } from "axios"

/** Instância central do Axios para comunicação com a API */
const api = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}/api`,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
})

// ── Retry com backoff exponencial ─────────────────────────────────────────────
// Backend Railway Hobby pode ter cold start ou crash transitório. Sem retry,
// o usuário via erro imediatamente no primeiro hiccup. Política:
// - Retry em network error (sem response) e em 5xx
// - NÃO retry em 4xx (erro do cliente, retentar não muda nada)
// - NÃO retry em métodos não-idempotentes (POST/PATCH) por default — só GET/PUT/DELETE
// - Máximo 2 retries (3 tentativas no total): 400ms, 1200ms
type RetryConfig = AxiosRequestConfig & { _retryCount?: number }
const MAX_RETRIES = 2
const BACKOFF_MS  = [400, 1200]

function isRetryableMethod(method?: string): boolean {
  const m = (method || "GET").toUpperCase()
  return m === "GET" || m === "PUT" || m === "DELETE" || m === "HEAD" || m === "OPTIONS"
}

function isRetryableStatus(status?: number): boolean {
  if (!status) return true  // network error
  return status >= 500 && status < 600
}

/** Interceptor de requisição: injeta o token JWT se disponível */
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("forbion_token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

/**
 * Custom event emitted when the backend returns PLAN_EXPIRED or NO_PLAN.
 * The UserContext listens for this and sets accountLock accordingly.
 * This avoids full-page reloads and keeps the lock state centralized.
 */
export const ACCOUNT_LOCK_EVENT = "forbion:account-lock"

export interface AccountLockEventDetail {
  code: "PLAN_EXPIRED" | "NO_PLAN" | "BUSINESS_INACTIVE"
  plan: string
  isTrial: boolean
  expiredAt: string | null
  scheduleCount: number
  customerCount: number
}

/** Interceptor de resposta: trata erros globais (com retry antes do erro final) */
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string; code?: string }>) => {
    const config = error.config as RetryConfig | undefined

    // ── Retry antes de tudo (só GET/HEAD/PUT/DELETE em network error/5xx) ──
    if (
      config &&
      isRetryableMethod(config.method) &&
      isRetryableStatus(error.response?.status)
    ) {
      const attempt = (config._retryCount ?? 0)
      if (attempt < MAX_RETRIES) {
        config._retryCount = attempt + 1
        const delay = BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1]
        await new Promise((r) => setTimeout(r, delay))
        return api.request(config)
      }
    }

    if (!error.response) {
      return Promise.reject(new Error("Sem conexão com o servidor"))
    }

    const data = error.response.data as Record<string, unknown> | undefined

    // ── Plan expired / No plan / Business inactive → emit custom event ───
    if (
      error.response.status === 403 &&
      data?.code &&
      (data.code === "PLAN_EXPIRED" || data.code === "NO_PLAN" || data.code === "BUSINESS_INACTIVE")
    ) {
      if (typeof window !== "undefined") {
        const detail: AccountLockEventDetail = {
          code:          data.code as "PLAN_EXPIRED" | "NO_PLAN" | "BUSINESS_INACTIVE",
          plan:          (data.plan as string) ?? "BASIC",
          isTrial:       (data.isTrial as boolean) ?? false,
          expiredAt:     (data.expiredAt as string) ?? null,
          scheduleCount: (data.scheduleCount as number) ?? 0,
          customerCount: (data.customerCount as number) ?? 0,
        }
        window.dispatchEvent(
          new CustomEvent(ACCOUNT_LOCK_EVENT, { detail })
        )
      }
      return Promise.reject(new Error(
        data.code === "NO_PLAN"
          ? "Plano não configurado."
          : data.code === "BUSINESS_INACTIVE"
            ? "Negócio desativado."
            : "Plano expirado."
      ))
    }

    if (error.response.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("forbion_token")
        window.location.replace("/auth/login")
      }
    }

    const message =
      error.response.data?.message ?? "Erro inesperado. Tente novamente."

    return Promise.reject(new Error(message))
  }
)

/**
 * Realiza uma requisição GET tipada.
 */
export async function apiGet<T>(url: string, params?: object): Promise<T> {
  const response = await api.get<T>(url, { params })
  return response.data
}

/**
 * Realiza uma requisição POST tipada.
 */
export async function apiPost<T>(url: string, data?: object): Promise<T> {
  const response = await api.post<T>(url, data)
  return response.data
}

/**
 * Realiza uma requisição PUT tipada.
 */
export async function apiPut<T>(url: string, data?: object): Promise<T> {
  const response = await api.put<T>(url, data)
  return response.data
}

/**
 * Realiza uma requisição DELETE tipada.
 */
export async function apiDelete<T>(url: string): Promise<T> {
  const response = await api.delete<T>(url)
  return response.data
}

export default api