"use client"

import { useEffect, useRef, useState } from "react"
import { apiGet, apiPost } from "@/lib/api"
import { MessageCircle, X, Send, Sparkles } from "lucide-react"

/**
 * V2-B2 — Widget do assistente (Carla) in-app. Botão flutuante + chat.
 * Checa /api/ai/status: se a IA não estiver configurada (sem GROQ_API_KEY),
 * mostra como ativar; se estiver, conversa via /api/ai/assist. Pronto pra ligar.
 */
interface Msg { role: "user" | "assistant"; content: string }

export default function CarlaWidget() {
  const [open, setOpen] = useState(false)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && configured === null) {
      apiGet<{ configured: boolean }>("/ai/status").then((r) => setConfigured(!!r.configured)).catch(() => setConfigured(false))
    }
  }, [open, configured])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs, open])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setInput("")
    const next = [...msgs, { role: "user" as const, content: text }]
    setMsgs(next)
    setSending(true)
    try {
      const r = await apiPost<{ answer?: string; error?: string }>("/ai/assist", { message: text, history: msgs.slice(-6) })
      setMsgs((m) => [...m, { role: "assistant", content: r.answer ?? "Não consegui responder agora." }])
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Estou indisponível no momento. Tente de novo." }])
    } finally { setSending(false) }
  }

  return (
    <>
      {/* botão flutuante */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Assistente"
        style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 60,
          width: 54, height: 54, borderRadius: "50%", border: "none",
          background: "linear-gradient(135deg,#0066FF,#7C3AED)",
          color: "#fff", cursor: "pointer", boxShadow: "0 8px 30px rgba(0,102,255,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {open && (
        <div style={{
          position: "fixed", bottom: 86, right: 20, zIndex: 60,
          width: "min(360px, calc(100vw - 40px))", height: 460,
          background: "#0D0D0D", border: "1px solid #1F1F1F", borderRadius: 16,
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}>
          {/* header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid #1F1F1F", background: "linear-gradient(135deg,rgba(0,102,255,0.12),rgba(124,58,237,0.12))" }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#0066FF,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>Carla · assistente</p>
              <p style={{ fontSize: 11, color: "#71717A", margin: 0 }}>tira dúvidas e ajuda a agendar</p>
            </div>
          </div>

          {/* corpo */}
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {configured === null && <p style={{ fontSize: 13, color: "#71717A" }}>Carregando…</p>}

            {configured === false && (
              <div style={{ background: "#111", border: "1px solid #1F1F1F", borderRadius: 12, padding: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: "0 0 6px" }}>⚡ Ative o assistente</p>
                <p style={{ fontSize: 12, color: "#A1A1AA", margin: 0, lineHeight: 1.6 }}>
                  A Carla responde clientes e tira dúvidas com IA. Pra ligar (grátis): crie uma chave em
                  <strong style={{ color: "#fff" }}> console.groq.com</strong> e defina <code style={{ color: "#0066FF" }}>GROQ_API_KEY</code> no servidor.
                  O motor já está pronto — é só a chave.
                </p>
              </div>
            )}

            {configured && msgs.length === 0 && (
              <div style={{ background: "#111", border: "1px solid #1F1F1F", borderRadius: 12, padding: 14 }}>
                <p style={{ fontSize: 13, color: "#A1A1AA", margin: 0 }}>Oi! 👋 Posso ajudar a tirar dúvida de serviço, sugerir o ideal pro carro do cliente, ou ajudar a agendar. Pergunte algo.</p>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                <div style={{
                  background: m.role === "user" ? "#0066FF" : "#1A1A1A",
                  color: m.role === "user" ? "#fff" : "#E5E5E5",
                  borderRadius: 12, padding: "9px 12px", fontSize: 13, lineHeight: 1.5,
                }}>{m.content}</div>
              </div>
            ))}
            {sending && <p style={{ fontSize: 12, color: "#71717A", alignSelf: "flex-start" }}>Carla está digitando…</p>}
            <div ref={endRef} />
          </div>

          {/* input */}
          {configured && (
            <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid #1F1F1F" }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send() }}
                placeholder="Escreva sua pergunta…"
                style={{ flex: 1, height: 40, padding: "0 14px", background: "#0A0A0A", border: "1px solid #252525", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit" }}
              />
              <button onClick={send} disabled={sending || !input.trim()} style={{ width: 40, height: 40, borderRadius: 10, border: "none", background: input.trim() ? "#0066FF" : "#1A1A1A", color: input.trim() ? "#fff" : "#3F3F46", cursor: input.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Send size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
