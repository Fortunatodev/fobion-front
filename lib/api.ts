import axios, { AxiosError } from "axios"

/** Instância central do Axios para comunicação com a API */
const api = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}/api`,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
})

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

/** Interceptor de resposta: trata erros globais */
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    if (!error.response) {
      return Promise.reject(new Error("Sem conexão com o servidor"))
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