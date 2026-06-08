"use client"

import { useEffect, useState } from "react"
import { Rocket, Calendar, Sparkles, ListChecks, X } from "lucide-react"

/**
 * B16 — boas-vindas no 1º login. Em vez de um dashboard sem orientação, dá um
 * empurrão de ativação: o que fazer agora. Aparece UMA vez (localStorage) e some.
 * Robusto (modal central, não balões ancorados que quebram em layout responsivo).
 */
const KEY = "forbion_welcome_done_v1"

export default function WelcomeModal({ firstName }: { firstName?: string }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // mostra só no 1º acesso (client-only)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (localStorage.getItem(KEY) !== "1") setShow(true)
  }, [])

  if (!show) return null

  function close() {
    localStorage.setItem(KEY, "1")
    setShow(false)
  }

  const items = [
    { icon: <ListChecks size={16} />, color: "#0066FF", title: "Configure sua loja", text: "Seus serviços já vêm pré-carregados — ajuste preços e horários." },
    { icon: <Calendar size={16} />, color: "#10B981", title: "Coloque o 1º carro na agenda", text: "Use “Nova comanda” pra registrar um atendimento em segundos." },
    { icon: <Sparkles size={16} />, color: "#7C3AED", title: "Sua loja online + IA", text: "Divulgue seu link de agendamento; a Carla responde clientes no automático." },
  ]

  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: "100%", maxWidth: 440, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 20, padding: 26, position: "relative" }}>
        <button onClick={close} aria-label="Fechar" style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "var(--c-text-4)", cursor: "pointer", display: "flex" }}><X size={18} /></button>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#0066FF,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <Rocket size={22} color="var(--c-on-primary)" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>
          Bem-vindo{firstName ? `, ${firstName}` : ""}! 👋
        </h2>
        <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "6px 0 18px" }}>
          Em 3 passos sua oficina já está recebendo agendamentos. Bora?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: `${it.color}1A`, border: `1px solid ${it.color}33`, color: it.color, display: "flex", alignItems: "center", justifyContent: "center" }}>{it.icon}</div>
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>{it.title}</p>
                <p style={{ fontSize: 12.5, color: "var(--c-text-3)", margin: "1px 0 0", lineHeight: 1.5 }}>{it.text}</p>
              </div>
            </div>
          ))}
        </div>
        <button onClick={close} style={{ width: "100%", height: 44, borderRadius: 12, border: "none", background: "linear-gradient(135deg,#0066FF,#7C3AED)", color: "var(--c-on-primary)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Bora começar
        </button>
      </div>
    </div>
  )
}
