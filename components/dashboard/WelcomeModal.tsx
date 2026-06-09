"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Rocket, Tag, Store, CalendarPlus, Users, ArrowRight, X } from "lucide-react"

/**
 * B16 — boas-vindas no 1º login. Em vez de um dashboard sem orientação, dá um
 * empurrão de ativação: o que fazer agora e POR QUÊ. Aparece UMA vez
 * (localStorage) e some. Robusto (modal central, não balões ancorados que
 * quebram em layout responsivo).
 */
const KEY = "forbion_welcome_done_v1"

interface Step {
  icon: React.ReactNode
  color: string
  title: string
  text: string
  cta: string
  href: string
}

export default function WelcomeModal({ firstName }: { firstName?: string }) {
  const router = useRouter()
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

  function go(href: string) {
    localStorage.setItem(KEY, "1")
    setShow(false)
    router.push(href)
  }

  const steps: Step[] = [
    {
      icon: <Tag size={17} />,
      color: "#0066FF",
      title: "Cadastre seus serviços e preços",
      text: "Defina o valor de cada serviço por porte do carro — a base de tudo.",
      cta: "Cadastrar serviços",
      href: "/dashboard/servicos",
    },
    {
      icon: <Store size={17} />,
      color: "#7C3AED",
      title: "Configure sua loja pública de agendamento",
      text: "Seu link próprio para o cliente agendar sozinho, sem você no WhatsApp.",
      cta: "Configurar a loja",
      href: "/dashboard/configuracoes",
    },
    {
      icon: <CalendarPlus size={17} />,
      color: "#10B981",
      title: "Crie seu primeiro agendamento",
      text: "Coloque um carro na agenda e veja a recorrência acontecer.",
      cta: "Abrir a agenda",
      href: "/dashboard/agendamentos",
    },
    {
      icon: <Users size={17} />,
      color: "#F59E0B",
      title: "Convide sua equipe",
      text: "Cada profissional com seu acesso e seus atendimentos no lugar.",
      cta: "Convidar equipe",
      href: "/dashboard/employees",
    },
  ]

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
          <Rocket size={22} color="var(--c-on-primary)" />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>
          Bem-vindo{firstName ? `, ${firstName}` : ""}! 👋
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--c-text-3)", margin: "8px 0 20px", lineHeight: 1.55 }}>
          Chega de caderno e WhatsApp espalhado: aqui sua agenda, sua loja online de agendamento e a
          recorrência dos clientes ficam no mesmo lugar. Vamos deixar tudo no ponto.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {steps.map((s, i) => (
            <button
              key={i}
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
                }}
              >
                {s.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>{s.title}</p>
                <p style={{ fontSize: 12.5, color: "var(--c-text-3)", margin: "2px 0 0", lineHeight: 1.5 }}>{s.text}</p>
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
          Pode fechar e voltar quando quiser.
        </p>
      </div>
    </div>
  )
}
