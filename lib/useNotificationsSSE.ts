"use client"

import { useEffect, useRef } from "react"
import { getToken } from "@/lib/auth"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

/**
 * Hook que abre uma conexão SSE para receber notificações em tempo real.
 * O token JWT é passado via query param (EventSource não suporta headers).
 *
 * @param onNotification callback chamado para cada evento `notification`.
 */
export function useNotificationsSSE(
  onNotification: (data: Record<string, unknown>) => void,
) {
  const cbRef = useRef(onNotification)

  useEffect(() => {
    cbRef.current = onNotification
  }, [onNotification])

  useEffect(() => {
    const token = getToken()
    if (!token) return

    const url = `${API}/api/notifications/events?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)

    es.addEventListener("notification", (evt) => {
      try {
        const data = JSON.parse(evt.data)
        cbRef.current(data)
      } catch (e) {
        console.error("[SSE] parse error:", e)
      }
    })

    es.addEventListener("connected", () => {
      // connected successfully
    })

    es.onerror = () => {
      // EventSource reconecta automaticamente — apenas loga
      console.warn("[SSE] erro / reconectando…")
    }

    return () => {
      es.close()
    }
  }, [])
}
