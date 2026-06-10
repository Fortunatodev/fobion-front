"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Rocket, Tag, CalendarClock, Share2, CalendarPlus, ArrowRight, X } from "lucide-react"
import { ONBOARDING_STEPS, COLLAPSED_KEY, type OnboardingStepKey } from "@/components/dashboard/OnboardingChecklist"

/**
 * B16 / O7 — boas-vindas no 1º login. Aponta para os MESMOS 4 passos do
 * checklist (fonte única = ONBOARDING_STEPS). Aparece UMA vez (localStorage)
 * e some. Ao fechar, chama onDone() pra page garantir que o checklist fica
 * visível/expandido.
 */
const KEY = "forbion_welcome_done_v1"

const STEP_ICON: Record<OnboardingStepKey, React.ReactNode> = {
  service: <Tag size={17} />,
  hours: <CalendarClock size={17} />,
  store: <Share2 size={17} />,
  schedule: <CalendarPlus size={17} />,
}

export default function WelcomeModal({
  firstName,
  onDone,
}: {
  firstName?: string
  /** Chamado quando o welcome fecha (por X, clique fora ou CTA) — page expande o checklist. */
  onDone?: () => void
}) {
  const router = useRouter()
  const [show, setShow] = useState(false)

  useEffect(() => {
    // mostra só no 1º acesso (client-only)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (localStorage.getItem(KEY) !== "1") setShow(true)
  }, [])

  if (!show) return null

  function finish() {
    localStorage.setItem(KEY, "1")
    // garante que o checklist apareça expandido após o welcome (O7)
    localStorage.setItem(COLLAPSED_KEY, "0")
    setShow(false)
    onDone?.()
  }

  function close() {
    finish()
  }

  function go(href: string) {
    finish()
    router.push(href)
  }

  return (
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--c-surface)",
          border: "1px solid var(--c-border)",
          borderRadius: 20,
          padding: 26,
          position: "relative",
        }}
      >
        <button
          onClick={close}
          aria-label="Fechar"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            color: "var(--c-text-4)",
            cursor: "pointer",
            display: "flex",
          }}
        >
          <X size={18} />
        </button>

        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 13,
            background: "linear-gradient(135deg,#0066FF,#7C3AED)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14,
          }}
        >
          <Rocket size={22} color="#FFFFFF" />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>
          Bem-vindo{firstName ? `, ${firstName}` : ""}!
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--c-text-3)", margin: "8px 0 20px", lineHeight: 1.55 }}>
          Chega de caderno e WhatsApp espalhado: aqui sua agenda, sua loja online de agendamento e a
          recorrência dos clientes ficam no mesmo lugar. São 4 passos do zero ao seu 1º agendamento.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {ONBOARDING_STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => go(s.href)}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                textAlign: "left",
                width: "100%",
                background: "var(--c-bg)",
                border: "1px solid var(--c-border)",
                borderRadius: 13,
                padding: "12px 14px",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = s.color)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--c-border)")}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  flexShrink: 0,
                  background: `${s.color}1A`,
                  border: `1px solid ${s.color}33`,
                  color: s.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                {STEP_ICON[s.key]}
                <span
                  style={{
                    position: "absolute",
                    top: -6,
                    left: -6,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: s.color,
                    color: "#FFFFFF",
                    fontSize: 10,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {i + 1}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>{s.label}</p>
                <p style={{ fontSize: 12.5, color: "var(--c-text-3)", margin: "2px 0 0", lineHeight: 1.5 }}>{s.why}</p>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 700,
                    color: s.color,
                    marginTop: 6,
                  }}
                >
                  {s.cta} <ArrowRight size={13} />
                </span>
              </div>
            </button>
          ))}
        </div>

        <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: 0, textAlign: "center" }}>
          Pode fechar e continuar pelo checklist no painel quando quiser.
        </p>
      </div>
    </div>
  )
}
