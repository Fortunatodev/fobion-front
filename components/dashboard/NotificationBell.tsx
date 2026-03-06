"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Bell } from "lucide-react"
import { useNotificationsSSE } from "@/lib/useNotificationsSSE"
import { useUser } from "@/contexts/UserContext"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface NotificationItem {
  id:           string
  type:         string
  title:        string
  message:      string
  scheduleId:   string
  status:       string
  customerName: string
  timeISO:      string
  createdAt:    string
  read:         boolean
}

// ── Status colors ─────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  SCHEDULE_CREATED:   "#10B981",
  SCHEDULE_UPDATED:   "#3B82F6",
  SCHEDULE_CANCELLED: "#EF4444",
}

const STATUS_ICON: Record<string, string> = {
  SCHEDULE_CREATED:   "📋",
  SCHEDULE_UPDATED:   "🔄",
  SCHEDULE_CANCELLED: "❌",
}

// ── Formato hora UTC ──────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const h = d.getUTCHours().toString().padStart(2, "0")
  const m = d.getUTCMinutes().toString().padStart(2, "0")
  return `${h}:${m}`
}

function fmtAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec  = Math.floor(diff / 1000)
  if (sec < 60)  return "agora"
  const min = Math.floor(sec / 60)
  if (min < 60)  return `${min}min`
  const hrs = Math.floor(min / 60)
  if (hrs < 24)  return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const { user } = useUser()
  const [items, setItems]   = useState<NotificationItem[]>([])
  const [open, setOpen]     = useState(false)
  const dropRef             = useRef<HTMLDivElement>(null)
  const btnRef              = useRef<HTMLButtonElement>(null)
  const panelRef            = useRef<HTMLDivElement>(null)
  const [dropPos, setDropPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  // ── SSE listener ──────────────────────────────────────────────────────────
  const handleNotification = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data: any) => {
      const item: NotificationItem = {
        id:           data.id ?? data.scheduleId ?? Date.now().toString(),
        type:         data.type,
        title:        data.title,
        message:      data.message,
        scheduleId:   data.scheduleId,
        status:       data.status,
        customerName: data.customerName,
        timeISO:      data.timeISO,
        createdAt:    data.createdAt ?? new Date().toISOString(),
        read:         false,
      }
      setItems(prev => [item, ...prev].slice(0, 30))
    },
    [],
  )

  useNotificationsSSE(handleNotification)

  // ── Fechar dropdown ao clicar fora ────────────────────────────────────────
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node
      const inBtn   = dropRef.current?.contains(target)
      const inPanel = panelRef.current?.contains(target)
      if (!inBtn && !inPanel) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [open])

  // ── Marcar todas como lidas ao abrir ──────────────────────────────────────
  function toggle() {
    if (!open) {
      setItems(prev => prev.map(i => ({ ...i, read: true })))
      // Calcular posição do dropdown baseado no botão
      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect()
        const isMobile = window.innerWidth < 768
        if (isMobile) {
          // Mobile: alinhar à direita da tela com margem
          setDropPos({
            top:  rect.bottom + 8,
            left: Math.max(8, window.innerWidth - 340 - 8),
          })
        } else {
          // Desktop: abrir à direita do sino (ao lado da sidebar)
          setDropPos({
            top:  rect.top,
            left: rect.right + 8,
          })
        }
      }
    }
    setOpen(o => !o)
  }

  const unread = items.filter(i => !i.read).length

  // Não renderizar se não estiver logado
  if (!user) return null

  return (
    <div ref={dropRef} style={{ position: "relative" }}>
      {/* ── Botão do sino ─────────────────────────────────────────────────── */}
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="Notificações"
        style={{
          position: "relative",
          background: open ? "rgba(255,255,255,0.08)" : "transparent",
          border: "none",
          cursor: "pointer",
          padding: 6,
          borderRadius: 8,
          color: open ? "#fff" : "#71717A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.15s",
        }}
      >
        <Bell size={18} />

        {/* Badge */}
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 2, right: 2,
            minWidth: 16, height: 16,
            borderRadius: 999, padding: "0 4px",
            backgroundColor: "#EF4444",
            color: "#fff", fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #0A0A0A",
            lineHeight: 1,
            animation: "bellPulse 0.3s ease",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* ── Dropdown ──────────────────────────────────────────────────────── */}
      {open && (
        <>
          <style>{`
            @keyframes bellDrop  { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
            @keyframes bellPulse { 0%{transform:scale(0.5)} 60%{transform:scale(1.2)} 100%{transform:scale(1)} }
            .notif-item:hover { background: #161616 !important; }
          `}</style>

          <div ref={panelRef} style={{
            position: "fixed",
            top: dropPos.top,
            left: dropPos.left,
            width: 340,
            maxHeight: 420,
            overflowY: "auto",
            backgroundColor: "#111",
            border: "1px solid #1F1F1F",
            borderRadius: 14,
            boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
            zIndex: 9999,
            animation: "bellDrop 0.18s ease",
          }}>
            {/* Header */}
            <div style={{
              padding: "14px 16px 10px",
              borderBottom: "1px solid #1A1A1A",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                Notificações
              </span>
              {items.length > 0 && (
                <button
                  onClick={() => setItems([])}
                  style={{
                    background: "none", border: "none",
                    fontSize: 11, color: "#52525B", cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Lista */}
            {items.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <Bell size={28} color="#1F1F1F" style={{ display: "block", margin: "0 auto 10px" }} />
                <p style={{ fontSize: 13, color: "#52525B", margin: 0 }}>
                  Nenhuma notificação
                </p>
                <p style={{ fontSize: 11, color: "#3F3F46", margin: "4px 0 0" }}>
                  Elas aparecerão em tempo real aqui
                </p>
              </div>
            ) : (
              <div>
                {items.map((item, idx) => {
                  const color = STATUS_COLOR[item.type] ?? "#71717A"
                  const icon  = STATUS_ICON[item.type]  ?? "🔔"
                  return (
                    <div
                      key={`${item.id}-${idx}`}
                      className="notif-item"
                      style={{
                        padding: "12px 16px",
                        borderBottom: idx < items.length - 1 ? "1px solid #141414" : "none",
                        cursor: "default",
                        transition: "background 0.12s",
                      }}
                    >
                      <div style={{ display: "flex", gap: 10 }}>
                        {/* Ícone / linha colorida */}
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          backgroundColor: `${color}14`,
                          border: `1px solid ${color}30`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14,
                        }}>
                          {icon}
                        </div>

                        {/* Conteúdo */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                            <span style={{
                              fontSize: 12, fontWeight: 600, color: "#E5E7EB",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {item.title}
                            </span>
                            <span style={{ fontSize: 10, color: "#3F3F46", flexShrink: 0 }}>
                              {fmtAgo(item.createdAt)}
                            </span>
                          </div>
                          <p style={{
                            fontSize: 11, color: "#71717A", margin: "3px 0 0",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {item.message}
                          </p>
                          <span style={{
                            fontSize: 10, color: "#52525B", marginTop: 2, display: "inline-block",
                          }}>
                            🕐 {fmtTime(item.timeISO)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
