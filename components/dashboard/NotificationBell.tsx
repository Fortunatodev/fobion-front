"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  Bell, BellRing, Volume2, VolumeX, Check,
  CalendarPlus, CalendarClock, CalendarX, Clock,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useNotificationsSSE } from "@/lib/useNotificationsSSE"
import { useUser } from "@/contexts/UserContext"
import { playNotificationSound, markUserInteracted } from "@/lib/notificationSound"

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

// ── Status colors / ícones ──────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  SCHEDULE_CREATED:   "#10B981",
  SCHEDULE_UPDATED:   "#3B82F6",
  SCHEDULE_CANCELLED: "#EF4444",
}

const STATUS_ICON: Record<string, LucideIcon> = {
  SCHEDULE_CREATED:   CalendarPlus,
  SCHEDULE_UPDATED:   CalendarClock,
  SCHEDULE_CANCELLED: CalendarX,
}

const SOUND_KEY = "forbion_notif_sound"

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
  const [soundOn, setSoundOn] = useState(() => {
    if (typeof window === "undefined") return true
    try { return localStorage.getItem(SOUND_KEY) !== "off" } catch { return true }
  })
  const [ring, setRing]     = useState(false)   // realce do sino ao chegar nova
  const dropRef             = useRef<HTMLDivElement>(null)
  const btnRef              = useRef<HTMLButtonElement>(null)
  const panelRef            = useRef<HTMLDivElement>(null)
  const [dropPos, setDropPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  // refs pra ler valores atualizados dentro do callback do SSE
  const soundOnRef = useRef(soundOn)   // espelha o estado inicial (lido do localStorage no lazy init)
  const ringTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Destravar áudio na 1ª interação do usuário (política de autoplay) ───────
  useEffect(() => {
    function onFirstInteract() { markUserInteracted() }
    window.addEventListener("pointerdown", onFirstInteract, { once: true })
    window.addEventListener("keydown", onFirstInteract, { once: true })
    return () => {
      window.removeEventListener("pointerdown", onFirstInteract)
      window.removeEventListener("keydown", onFirstInteract)
    }
  }, [])

  function toggleSound(e: React.MouseEvent) {
    e.stopPropagation()
    markUserInteracted()
    setSoundOn(prev => {
      const next = !prev
      soundOnRef.current = next
      try { localStorage.setItem(SOUND_KEY, next ? "on" : "off") } catch { /* ignora */ }
      if (next) playNotificationSound() // preview ao ligar
      return next
    })
  }

  // ── SSE listener: cada evento = uma notificação NOVA ───────────────────────
  const handleNotification = useCallback(
    (data: Record<string, unknown>) => {
      const str = (v: unknown): string => (typeof v === "string" ? v : "")
      const item: NotificationItem = {
        id:           str(data.id) || str(data.scheduleId) || Date.now().toString(),
        type:         str(data.type),
        title:        str(data.title),
        message:      str(data.message),
        scheduleId:   str(data.scheduleId),
        status:       str(data.status),
        customerName: str(data.customerName),
        timeISO:      str(data.timeISO),
        createdAt:    str(data.createdAt) || new Date().toISOString(),
        read:         false,
      }
      setItems(prev => [item, ...prev].slice(0, 30))

      // Som discreto se ligado e usuário já interagiu (a fn cuida do gate).
      if (soundOnRef.current) playNotificationSound()

      // Realce breve no sino.
      setRing(true)
      if (ringTimer.current) clearTimeout(ringTimer.current)
      ringTimer.current = setTimeout(() => setRing(false), 900)
    },
    [],
  )

  useNotificationsSSE(handleNotification)

  useEffect(() => () => { if (ringTimer.current) clearTimeout(ringTimer.current) }, [])

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

  // ── Abrir/fechar painel ────────────────────────────────────────────────────
  function toggle() {
    markUserInteracted()
    if (!open) {
      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect()
        const isMobile = window.innerWidth < 768
        if (isMobile) {
          // Mobile: largura segue a viewport (não vaza), ancorado embaixo do sino
          setDropPos({
            top:  rect.bottom + 8,
            left: 8,
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

  function markAllRead() {
    setItems(prev => prev.map(i => ({ ...i, read: true })))
  }

  const unread = items.filter(i => !i.read).length
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768
  const panelWidth = isMobile ? "calc(100vw - 16px)" : 340

  // Não renderizar se não estiver logado
  if (!user) return null

  return (
    <div ref={dropRef} style={{ position: "relative" }}>
      <style>{`
        @keyframes bellDrop  { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes bellPop   { 0%{transform:scale(0)} 60%{transform:scale(1.25)} 100%{transform:scale(1)} }
        @keyframes bellShake { 0%,100%{transform:rotate(0)} 15%{transform:rotate(-14deg)} 30%{transform:rotate(11deg)} 45%{transform:rotate(-8deg)} 60%{transform:rotate(6deg)} 75%{transform:rotate(-3deg)} }
        @keyframes badgePulse{ 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.55)} 70%{box-shadow:0 0 0 6px rgba(239,68,68,0)} }
        .notif-bell-ring { animation: bellShake 0.7s ease; }
        .notif-badge-pulse { animation: badgePulse 1.8s ease-out infinite, bellPop 0.3s ease; }
        .notif-item:hover { background: var(--c-surface-2) !important; }
      `}</style>

      {/* ── Botão do sino ─────────────────────────────────────────────────── */}
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label={unread > 0 ? `Notificações (${unread} não lidas)` : "Notificações"}
        style={{
          position: "relative",
          background: open ? "rgba(255,255,255,0.08)" : "transparent",
          border: "none",
          cursor: "pointer",
          padding: 6,
          borderRadius: 8,
          color: open || unread > 0 ? "var(--c-text)" : "var(--c-text-3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.15s",
        }}
      >
        <span className={ring ? "notif-bell-ring" : undefined} style={{ display: "flex" }}>
          {unread > 0 ? <BellRing size={18} /> : <Bell size={18} />}
        </span>

        {/* Badge */}
        {unread > 0 && (
          <span
            className="notif-badge-pulse"
            style={{
              position: "absolute", top: 2, right: 2,
              minWidth: 16, height: 16,
              borderRadius: 999, padding: "0 4px",
              backgroundColor: "#EF4444",
              color: "#fff", fontSize: 9, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid var(--c-bg)",
              lineHeight: 1,
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* ── Dropdown ──────────────────────────────────────────────────────── */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: dropPos.top,
            left: dropPos.left,
            width: panelWidth,
            maxWidth: 340,
            maxHeight: "min(420px, calc(100vh - 80px))",
            overflowY: "auto",
            backgroundColor: "var(--c-surface)",
            border: "1px solid var(--c-border)",
            borderRadius: 14,
            boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
            zIndex: 9999,
            boxSizing: "border-box",
            animation: "bellDrop 0.18s ease",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "12px 14px 10px",
            borderBottom: "1px solid var(--c-border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            gap: 8,
            position: "sticky", top: 0,
            backgroundColor: "var(--c-surface)",
            zIndex: 1,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)", flex: 1, minWidth: 0 }}>
              Notificações
              {unread > 0 && (
                <span style={{
                  marginLeft: 6, fontSize: 11, fontWeight: 600, color: "var(--c-text-4)",
                }}>
                  {unread} nova{unread > 1 ? "s" : ""}
                </span>
              )}
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
              {/* Toggle de som */}
              <button
                onClick={toggleSound}
                aria-label={soundOn ? "Desativar som das notificações" : "Ativar som das notificações"}
                title={soundOn ? "Som ligado" : "Som desligado"}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: 5, borderRadius: 6, display: "flex",
                  color: soundOn ? "var(--c-text-3)" : "var(--c-text-4)",
                  transition: "color 0.12s",
                }}
              >
                {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>

              {/* Marcar todas como lidas */}
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  aria-label="Marcar todas como lidas"
                  title="Marcar todas como lidas"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: "5px 7px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4,
                    fontSize: 11, color: "var(--c-text-3)", fontFamily: "inherit",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Check size={13} />
                  <span style={{ display: isMobile ? "none" : "inline" }}>Lidas</span>
                </button>
              )}
            </div>
          </div>

          {/* Lista */}
          {items.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center" }}>
              <Bell size={28} color="var(--c-border)" style={{ display: "block", margin: "0 auto 10px" }} />
              <p style={{ fontSize: 13, color: "var(--c-text-4)", margin: 0 }}>
                Nenhuma notificação
              </p>
              <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: "4px 0 0" }}>
                Elas aparecerão em tempo real aqui
              </p>
            </div>
          ) : (
            <div>
              {items.map((item, idx) => {
                const color = STATUS_COLOR[item.type] ?? "var(--c-text-3)"
                const Icon  = STATUS_ICON[item.type]  ?? Bell
                return (
                  <div
                    key={`${item.id}-${idx}`}
                    className="notif-item"
                    style={{
                      padding: "12px 14px",
                      borderBottom: idx < items.length - 1 ? "1px solid var(--c-border)" : "none",
                      cursor: "default",
                      transition: "background 0.12s",
                      position: "relative",
                      // leve indicador de não-lida
                      backgroundColor: item.read ? "transparent" : "var(--c-surface-2)",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10 }}>
                      {/* Ícone com cor do status */}
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        backgroundColor: `${color}14`,
                        border: `1px solid ${color}30`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color,
                      }}>
                        <Icon size={15} />
                      </div>

                      {/* Conteúdo */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                          <span style={{
                            fontSize: 12.5, fontWeight: 700, color: "var(--c-text)",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {item.title}
                          </span>
                          <span style={{ fontSize: 10, color: "var(--c-text-4)", flexShrink: 0, fontWeight: 600 }}>
                            {fmtAgo(item.createdAt)}
                          </span>
                        </div>
                        <p style={{
                          fontSize: 11.5, color: "var(--c-text-3)", margin: "3px 0 0",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {item.message}
                        </p>
                        {item.timeISO && (
                          <span style={{
                            fontSize: 10, color: "var(--c-text-4)", marginTop: 4,
                            display: "inline-flex", alignItems: "center", gap: 3,
                          }}>
                            <Clock size={10} />
                            {fmtTime(item.timeISO)}
                          </span>
                        )}
                      </div>

                      {/* Ponto de não-lida */}
                      {!item.read && (
                        <span style={{
                          width: 7, height: 7, borderRadius: 999, flexShrink: 0,
                          backgroundColor: "#EF4444", marginTop: 4,
                        }} />
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Footer: limpar tudo */}
              <div style={{
                padding: "8px 14px", borderTop: "1px solid var(--c-border)",
                position: "sticky", bottom: 0, backgroundColor: "var(--c-surface)",
                display: "flex", justifyContent: "center",
              }}>
                <button
                  onClick={() => setItems([])}
                  style={{
                    background: "none", border: "none",
                    fontSize: 11, color: "var(--c-text-4)", cursor: "pointer",
                    fontFamily: "inherit", padding: "2px 6px",
                  }}
                >
                  Limpar tudo
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
