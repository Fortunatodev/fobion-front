"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet } from "@/lib/api"
import { CheckCircle2, ArrowRight, Rocket, X } from "lucide-react"

/**
 * V2-B1 — Checklist de ativação no dashboard (referência: onboarding gamificado
 * da CERA — missões + % de progresso). Em vez de o dono cair num dashboard vazio
 * e passivo, mostra os passos pra chegar ao 1º agendamento, com barra de progresso.
 * Some sozinho quando 100% completo ou se o dono dispensar.
 */

const DISMISS_KEY = "forbion_onboarding_dismissed_v1"

interface Step {
  key: string
  label: string
  hint: string
  done: boolean
  href: string
}

export default function OnboardingChecklist({
  totalCustomers,
  hasScheduleToday,
}: {
  totalCustomers: number
  hasScheduleToday: boolean
}) {
  const router = useRouter()
  const [servicesCount, setServicesCount] = useState<number | null>(null)
  const [dismissed, setDismissed] = useState(true) // começa escondido até resolver

  useEffect(() => {
    const isDismissed = typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1"
    // leitura única de localStorage no mount (client-only) — não causa cascata
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(isDismissed)
    // conta serviços (sinal do 1º passo) — tolerante ao formato da resposta
    apiGet<unknown>("/services")
      .then((res) => {
        const obj = res as { services?: unknown[]; data?: unknown[] }
        const list = Array.isArray(res) ? res : (obj?.services ?? obj?.data ?? [])
        setServicesCount(Array.isArray(list) ? list.length : 0)
      })
      .catch(() => setServicesCount(0))
  }, [])

  // ainda carregando os serviços → não pisca nada
  if (servicesCount === null || dismissed) return null

  const steps: Step[] = [
    { key: "service",  label: "Cadastre seu 1º serviço",   hint: "Lavagem, polimento, vitrificação…", done: servicesCount > 0,   href: "/dashboard/servicos" },
    { key: "customer", label: "Cadastre seu 1º cliente",    hint: "Comece sua base de clientes",        done: totalCustomers > 0,   href: "/dashboard/clientes" },
    { key: "schedule", label: "Faça seu 1º agendamento",    hint: "Coloque um carro na agenda",         done: hasScheduleToday,     href: "/dashboard/agendamentos" },
    { key: "store",    label: "Divulgue sua loja online",   hint: "Seu link de agendamento próprio",    done: servicesCount > 0,    href: "/dashboard/configuracoes" },
  ]

  const doneCount = steps.filter((s) => s.done).length
  const total = steps.length
  const pct = Math.round((doneCount / total) * 100)

  // tudo pronto → não mostra (e marca como dispensado pra não voltar)
  if (doneCount === total) {
    if (typeof window !== "undefined") localStorage.setItem(DISMISS_KEY, "1")
    return null
  }

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1")
    setDismissed(true)
  }

  return (
    <div
      style={{
        backgroundColor: "#111111",
        border: "1px solid #1F1F1F",
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* glow sutil de marca */}
      <div style={{ position: "absolute", top: -40, right: -20, width: 180, height: 180, background: "radial-gradient(circle, rgba(0,102,255,0.12), transparent 70%)", pointerEvents: "none" }} />

      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#0066FF,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Rocket size={17} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>Configure sua loja</p>
            <p style={{ fontSize: 12, color: "#71717A", margin: "2px 0 0" }}>
              {doneCount} de {total} concluídos · termine pra começar a receber agendamentos
            </p>
          </div>
        </div>
        <button
          onClick={dismiss}
          title="Dispensar"
          style={{ background: "none", border: "none", color: "#52525B", cursor: "pointer", padding: 4, display: "flex" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#A1A1AA")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#52525B")}
        >
          <X size={16} />
        </button>
      </div>

      {/* barra de progresso */}
      <div style={{ height: 6, borderRadius: 4, background: "#1F1F1F", overflow: "hidden", marginBottom: 18 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#0066FF,#7C3AED)", borderRadius: 4, transition: "width 0.4s ease" }} />
      </div>

      {/* passos */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((s) => (
          <button
            key={s.key}
            onClick={() => !s.done && router.push(s.href)}
            disabled={s.done}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              textAlign: "left", width: "100%",
              background: s.done ? "transparent" : "#0A0A0A",
              border: `1px solid ${s.done ? "transparent" : "#1F1F1F"}`,
              borderRadius: 12, padding: "11px 14px",
              cursor: s.done ? "default" : "pointer",
              fontFamily: "inherit", transition: "all 0.15s",
              opacity: s.done ? 0.55 : 1,
            }}
            onMouseEnter={(e) => { if (!s.done) e.currentTarget.style.borderColor = "#0066FF" }}
            onMouseLeave={(e) => { if (!s.done) e.currentTarget.style.borderColor = "#1F1F1F" }}
          >
            {s.done ? (
              <CheckCircle2 size={20} color="#10B981" style={{ flexShrink: 0 }} />
            ) : (
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #3F3F46", flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: s.done ? "#71717A" : "#fff", margin: 0, textDecoration: s.done ? "line-through" : "none" }}>
                {s.label}
              </p>
              {!s.done && <p style={{ fontSize: 12, color: "#71717A", margin: "1px 0 0" }}>{s.hint}</p>}
            </div>
            {!s.done && <ArrowRight size={16} color="#0066FF" style={{ flexShrink: 0 }} />}
          </button>
        ))}
      </div>
    </div>
  )
}
