import type { TokenPayload } from "@/types"
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// ── Tailwind merge ──────────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ── Auth / Token ────────────────────────────────────────────────────────────

const TOKEN_KEY = "forbion_token"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(TOKEN_KEY, token)
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=604800; SameSite=Strict`
}

export function removeToken(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(TOKEN_KEY)
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; SameSite=Strict`
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const payload = parts[1]
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(decoded) as TokenPayload
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false
  const token = getToken()
  if (!token) return false
  const payload = decodeToken(token)
  if (!payload) return false
  return payload.exp > Date.now() / 1000
}

export function getTokenPayload(): TokenPayload | null {
  const token = getToken()
  if (!token) return null
  return decodeToken(token)
}

export function isTokenExpiringSoon(): boolean {
  const payload = getTokenPayload()
  if (!payload) return false
  return payload.exp - Date.now() / 1000 < 3600
}

// ── Formatters ──────────────────────────────────────────────────────────────

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("")
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

// ── Status ──────────────────────────────────────────────────────────────────

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING:     "Pendente",
    CONFIRMED:   "Confirmado",
    IN_PROGRESS: "Em andamento",
    DONE:        "Concluído",
    CANCELLED:   "Cancelado",
  }
  return labels[status] ?? status
}

export function getStatusColor(status: string): {
  bg: string
  text: string
  border: string
} {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    PENDING: {
      bg:     "rgba(245,158,11,0.1)",
      text:   "#F59E0B",
      border: "rgba(245,158,11,0.2)",
    },
    CONFIRMED: {
      bg:     "rgba(0,102,255,0.1)",
      text:   "#0066FF",
      border: "rgba(0,102,255,0.2)",
    },
    IN_PROGRESS: {
      bg:     "rgba(124,58,237,0.1)",
      text:   "#7C3AED",
      border: "rgba(124,58,237,0.2)",
    },
    DONE: {
      bg:     "rgba(16,185,129,0.1)",
      text:   "#10B981",
      border: "rgba(16,185,129,0.2)",
    },
    CANCELLED: {
      bg:     "rgba(239,68,68,0.1)",
      text:   "#EF4444",
      border: "rgba(239,68,68,0.2)",
    },
  }
  return colors[status] ?? {
    bg:     "rgba(161,161,170,0.1)",
    text:   "#A1A1AA",
    border: "rgba(161,161,170,0.2)",
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function buildWhatsAppLink(phone: string, message: string): string {
  return `https://api.whatsapp.com/send/?phone=${phone}&text=${encodeURIComponent(message)}`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}