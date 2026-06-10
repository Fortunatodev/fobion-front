"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { apiGet } from "@/lib/api"
import { useUser } from "@/contexts/UserContext"
import { CheckCircle2, ArrowRight, Rocket, X, Clock } from "lucide-react"

const CELEB_KEY = "forbion_onboarding_celebrated_v1"

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

// Recorte mínimo do /auth/me só pro que o checklist precisa (slug + horários).
interface BusinessSignal {
  slug?: string | null
  hours?: { isOpen?: boolean }[] | null
}

export default function OnboardingChecklist({
  totalCustomers,
}: {
  totalCustomers: number
}) {
  const router = useRouter()
  const { planStatus } = useUser()
  const [servicesCount, setServicesCount] = useState<number | null>(null)
  // O3 — "qualquer agendamento" (o aha real), não só os de hoje
  const [hasFirstSchedule, setHasFirstSchedule] = useState<boolean | null>(null)
  // O1 — loja pronta pra divulgar = slug definido + pelo menos 1 dia de funcionamento aberto
  const [storeReady, setStoreReady] = useState<boolean | null>(null)
  const [dismissed, setDismissed] = useState(true) // começa escondido até resolver

  // B17 — countdown do trial (gatilho de urgência pra conversão; CERA mantém sempre visível)
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
  useEffect(() => {
    let d: number | null = null
    if (planStatus?.isTrial && planStatus.planExpiresAt) {
      const ms = new Date(planStatus.planExpiresAt).getTime() - Date.now()
      d = ms > 0 ? Math.ceil(ms / 86_400_000) : 0
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTrialDaysLeft(d)
  }, [planStatus?.isTrial, planStatus?.planExpiresAt])

  // B15 — celebra cada etapa recém-concluída (reforço positivo = mais ativação)
  // O2 — 4 sinais DISTINTOS: serviço, cliente, 1º agendamento, loja pronta.
  useEffect(() => {
    if (servicesCount === null || hasFirstSchedule === null || storeReady === null) return
    const done = [servicesCount > 0, totalCustomers > 0, hasFirstSchedule, storeReady].filter(Boolean).length
    const prev = Number(localStorage.getItem(CELEB_KEY) ?? "0")
    if (done > prev) {
      if (done < 4) toast.success(`🎉 Etapa concluída! ${Math.round((done / 4) * 100)}% da configuração pronta`)
      else toast.success("🚀 Loja configurada! Bora receber agendamentos.")
      localStorage.setItem(CELEB_KEY, String(done))
    }
  }, [servicesCount, totalCustomers, hasFirstSchedule, storeReady])

  useEffect(() => {
    const isDismissed = typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1"
    // leitura única de localStorage no mount (client-only) — não causa cascata
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(isDismissed)
    // conta serviços (sinal do passo de serviços) — tolerante ao formato da resposta
    apiGet<unknown>("/services")
      .then((res) => {
        const obj = res as { services?: unknown[]; data?: unknown[] }
        const list = Array.isArray(res) ? res : (obj?.services ?? obj?.data ?? [])
        setServicesCount(Array.isArray(list) ? list.length : 0)
      })
      .catch(() => setServicesCount(0))

    // O3 — qualquer agendamento já feito (sem filtro de data = todos do negócio)
    apiGet<{ schedules?: unknown[] }>("/schedules")
      .then((res) => setHasFirstSchedule((res?.schedules ?? []).length > 0))
      .catch(() => setHasFirstSchedule(false))

    // O1 — loja pronta pra divulgar = slug + pelo menos 1 dia de funcionamento aberto
    apiGet<{ business?: BusinessSignal }>("/auth/me")
      .then((res) => {
        const biz = res?.business
        const hasSlug = !!biz?.slug && biz.slug.trim().length > 0
        const hasOpenDay = Array.isArray(biz?.hours) && biz.hours.some((h) => h?.isOpen)
        setStoreReady(hasSlug && hasOpenDay)
      })
      .catch(() => setStoreReady(false))
  }, [])

  // ainda carregando os sinais → não pisca nada
  if (servicesCount === null || hasFirstSchedule === null || storeReady === null || dismissed) return null

  const steps: Step[] = [
    { key: "service",  label: "Cadastre seu 1º serviço",   hint: "Lavagem, polimento, vitrificação…",      done: servicesCount > 0,   href: "/dashboard/servicos" },
    { key: "customer", label: "Cadastre seu 1º cliente",    hint: "Comece sua base de clientes",             done: totalCustomers > 0,  href: "/dashboard/clientes" },
    { key: "schedule", label: "Faça seu 1º agendamento",    hint: "Coloque um carro na agenda",              done: hasFirstSchedule,    href: "/dashboard/agendamentos" },
    { key: "store",    label: "Divulgue sua loja online",   hint: "Defina link e horário de funcionamento",  done: storeReady,          href: "/dashboard/configuracoes" },
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
        backgroundColor: "var(--c-surface)",
        border: "1px solid var(--c-border)",
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
            <Rocket size={17} color="var(--c-text)" />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>Configure sua loja</p>
            <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "2px 0 0" }}>
              {doneCount} de {total} concluídos · termine pra começar a receber agendamentos
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {trialDaysLeft !== null && (
            <span
              onClick={() => router.push("/dashboard/configuracoes?tab=plano")}
              title="Ver planos"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
                fontSize: 11, fontWeight: 700, padding: "4px 9px", borderRadius: 8,
                color: trialDaysLeft <= 2 ? "#EF4444" : "#F59E0B",
                background: trialDaysLeft <= 2 ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                border: `1px solid ${trialDaysLeft <= 2 ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}`,
              }}
            >
              <Clock size={12} /> {trialDaysLeft === 0 ? "Teste expira hoje" : `Teste: ${trialDaysLeft}d restante${trialDaysLeft !== 1 ? "s" : ""}`}
            </span>
          )}
          <button
            onClick={dismiss}
            title="Dispensar"
            style={{ background: "none", border: "none", color: "var(--c-text-4)", cursor: "pointer", padding: 4, display: "flex" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--c-text-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--c-text-4)")}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* barra de progresso */}
      <div style={{ height: 6, borderRadius: 4, background: "var(--c-border)", overflow: "hidden", marginBottom: 18 }}>
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
              background: s.done ? "transparent" : "var(--c-bg)",
              border: `1px solid ${s.done ? "transparent" : "var(--c-border)"}`,
              borderRadius: 12, padding: "11px 14px",
              cursor: s.done ? "default" : "pointer",
              fontFamily: "inherit", transition: "all 0.15s",
              opacity: s.done ? 0.55 : 1,
            }}
            onMouseEnter={(e) => { if (!s.done) e.currentTarget.style.borderColor = "#0066FF" }}
            onMouseLeave={(e) => { if (!s.done) e.currentTarget.style.borderColor = "var(--c-border)" }}
          >
            {s.done ? (
              <CheckCircle2 size={20} color="#10B981" style={{ flexShrink: 0 }} />
            ) : (
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid var(--c-text-4)", flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: s.done ? "var(--c-text-3)" : "var(--c-text)", margin: 0, textDecoration: s.done ? "line-through" : "none" }}>
                {s.label}
              </p>
              {!s.done && <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "1px 0 0" }}>{s.hint}</p>}
            </div>
            {!s.done && <ArrowRight size={16} color="#0066FF" style={{ flexShrink: 0 }} />}
          </button>
        ))}
      </div>
    </div>
  )
}
