"use client"

import { useEffect, useState } from "react"
import { Sparkles, X } from "lucide-react"

/**
 * Tutorial reutilizável por aba — extraído do PlanosTutorial.
 *
 * Mostra um cartão didático (3-4 passos) só na primeira vez que o dono abre a aba.
 * Dispensável: "Entendi" / X grava em localStorage `forbion_tutorial_<tabKey>` e
 * não aparece de novo. Pensado pro dono leigo que "se perde" — linguagem simples.
 *
 * Uso:
 *   <TabTutorial
 *     tabKey="calendario"
 *     title="Como usar a Agenda"
 *     subtitle="Seus horários organizados em 3 passos"
 *     steps={[{ icon: Calendar, title: "...", text: "..." }, ...]}
 *   />
 */
export interface TutorialStep {
  icon: React.ComponentType<{ size?: number; color?: string }>
  title: string
  text: string
}

export default function TabTutorial({
  tabKey, title, subtitle, steps,
}: {
  tabKey: string
  title: string
  subtitle: string
  steps: TutorialStep[]
}) {
  const storageKey = `forbion_tutorial_${tabKey}`
  const [show, setShow] = useState(false)
  const [closeHov, setCloseHov] = useState(false)
  const [gotItHov, setGotItHov] = useState(false)

  useEffect(() => {
    // localStorage só existe no cliente (pós-hidratação); sincronizar aqui é o
    // caminho correto pra um aviso dispensável que não deve piscar no SSR.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(storageKey) !== "1") setShow(true)
    } catch { /* localStorage indisponível — não mostra */ }
  }, [storageKey])

  function dismiss() {
    setShow(false)
    try { localStorage.setItem(storageKey, "1") } catch { /* ignore */ }
  }

  if (!show) return null

  return (
    <div style={{
      position: "relative", overflow: "hidden",
      background: "linear-gradient(135deg, rgba(0,102,255,0.10), rgba(124,58,237,0.10))",
      border: "1px solid rgba(124,58,237,0.22)",
      borderRadius: 20, padding: "20px 22px", marginBottom: 22,
      animation: "tabTutFade 0.35s ease both",
    }}>
      <style>{`@keyframes tabTutFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Glow decorativo */}
      <div style={{
        position: "absolute", top: -60, right: -40,
        width: 200, height: 200, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(124,58,237,0.14), transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Cabeçalho */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, position: "relative" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg,#0066FF,#7C3AED)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Sparkles size={17} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>{title}</p>
            <p style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 2 }}>{subtitle}</p>
          </div>
        </div>

        <button
          title="Fechar tutorial"
          onClick={dismiss}
          onMouseEnter={() => setCloseHov(true)}
          onMouseLeave={() => setCloseHov(false)}
          style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: closeHov ? "var(--c-border)" : "var(--c-surface-2)",
            border: "1px solid var(--c-border-2)", color: "var(--c-text-3)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", transition: "background-color 0.15s",
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Passos */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14, marginTop: 18, position: "relative",
      }}>
        {steps.map((step) => {
          const Icon = step.icon
          return (
            <div key={step.title} style={{
              backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)",
              borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: 9,
                backgroundColor: "rgba(0,102,255,0.10)", border: "1px solid rgba(0,102,255,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={15} color="#0066FF" />
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", margin: 0, lineHeight: 1.35 }}>{step.title}</p>
              <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: 0, lineHeight: 1.55 }}>{step.text}</p>
            </div>
          )
        })}
      </div>

      {/* Rodapé */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, position: "relative" }}>
        <button
          onClick={dismiss}
          onMouseEnter={() => setGotItHov(true)}
          onMouseLeave={() => setGotItHov(false)}
          style={{
            height: 38, padding: "0 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
            background: "linear-gradient(135deg,#0066FF,#7C3AED)", border: "none", color: "#fff",
            boxShadow: gotItHov ? "0 8px 24px rgba(0,102,255,0.45)" : "0 4px 16px rgba(0,102,255,0.28)",
            transform: gotItHov ? "scale(1.02)" : "scale(1)", transition: "all 0.2s", fontFamily: "inherit",
          }}
        >
          Entendi
        </button>
      </div>
    </div>
  )
}
