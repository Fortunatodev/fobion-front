"use client"

import { useState } from "react"
import { apiPut } from "@/lib/api"

/**
 * IMP-301 — conectar o Telegram do dono pra receber alerta de novo agendamento.
 * Componente isolado. Salva Business.ownerTelegramChatId via PUT /api/auth/business.
 * Pra pegar o chat_id, o dono manda /start pro @userinfobot (ou pro bot da Forbion)
 * e cola o número aqui.
 */
export default function TelegramCard({
  isMobile = false,
  initialChatId = "",
}: { isMobile?: boolean; initialChatId?: string }) {
  const [open, setOpen]       = useState(false)
  const [chatId, setChatId]   = useState(initialChatId)
  const [saved, setSaved]     = useState(initialChatId)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  const connected = !!saved

  const handleSave = async () => {
    setLoading(true)
    setMsg(null)
    try {
      await apiPut("/auth/business", { ownerTelegramChatId: chatId.trim() })
      setSaved(chatId.trim())
      setMsg({ kind: "ok", text: chatId.trim() ? "Telegram conectado!" : "Telegram desconectado." })
      setTimeout(() => { setOpen(false); setMsg(null) }, 1400)
    } catch {
      setMsg({ kind: "err", text: "Não foi possível salvar. Tente novamente." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      backgroundColor: "#0A0A0A", border: "1px solid #1F1F1F",
      borderRadius: 12, padding: isMobile ? "14px 14px" : "14px 16px", marginBottom: 24,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 18 }}>📲</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#fff", margin: 0 }}>Alerta no Telegram</p>
            <p style={{ fontSize: 12, color: "#71717A", marginTop: 2 }}>
              {connected ? "Você recebe cada novo agendamento na hora" : "Receba cada novo agendamento no seu celular (grátis)"}
            </p>
          </div>
        </div>
        {connected
          ? <span style={{ fontSize: 12, color: "#10B981", fontWeight: 500, marginRight: 8 }}>Conectado</span>
          : null}
        <button
          onClick={() => { setOpen(o => !o); setChatId(saved); setMsg(null) }}
          style={{
            height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid #1F1F1F",
            backgroundColor: "transparent", color: "#A1A1AA", fontSize: 12, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          {open ? "Cancelar" : connected ? "Editar" : "Conectar"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 12, color: "#71717A", margin: "0 0 10px", lineHeight: 1.6 }}>
            1. No Telegram, abra <strong style={{ color: "#A1A1AA" }}>@userinfobot</strong> e mande <strong style={{ color: "#A1A1AA" }}>/start</strong>.<br />
            2. Ele responde com seu <strong style={{ color: "#A1A1AA" }}>Id</strong> (um número). Cole abaixo.
          </p>
          <input
            value={chatId}
            onChange={e => setChatId(e.target.value)}
            placeholder="ex: 5006810460"
            inputMode="numeric"
            style={{
              width: "100%", height: 42, background: "#000", border: "1px solid #1F1F1F",
              borderRadius: 10, padding: "0 14px", color: "#fff", fontSize: 14, fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
          {msg && (
            <p style={{ color: msg.kind === "ok" ? "#10B981" : "#F87171", fontSize: 13, margin: "10px 0 0" }}>{msg.text}</p>
          )}
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              marginTop: 14, height: 40, padding: "0 18px", borderRadius: 10, border: "none",
              background: loading ? "#1A1A1A" : "#0066FF", color: loading ? "#3F3F46" : "#fff",
              fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
            }}
          >
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      )}
    </div>
  )
}
