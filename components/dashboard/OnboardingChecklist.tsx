"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { QRCodeSVG } from "qrcode.react"
import { apiGet } from "@/lib/api"
import { useUser } from "@/contexts/UserContext"
import {
  CheckCircle2, ArrowRight, Rocket, ChevronDown, ChevronUp,
  Clock, Tag, CalendarClock, Share2, CalendarPlus, Copy, Sparkles,
} from "lucide-react"

/**
 * O4/O5/O7 — Redesenho do onboarding por OUTCOME (zero → 1º agendamento = o "aha").
 *
 * 4 passos ordenados por valor:
 *   1. Cadastre seu 1º serviço (com preço)
 *   2. Defina seus horários de atendimento
 *   3. Compartilhe o link da sua loja  (card com Copiar + QR)
 *   4. Registre seu 1º agendamento     (o aha)
 *
 * - Barra de progresso persistente (X de 4), passo concluído com check verde.
 * - Recolher/expandir persistido em forbion_onboarding_collapsed_v1.
 * - Os 4 passos são FONTE ÚNICA (ONBOARDING_STEPS) — o WelcomeModal consome os mesmos.
 * - Não quebra os 4 sinais de conclusão da Wave A.
 */

export const COLLAPSED_KEY = "forbion_onboarding_collapsed_v1"
const CELEB_KEY = "forbion_onboarding_celebrated_v1"
// Sinal de que o dono REALMENTE copiou/compartilhou o link (ação de maior valor).
// O slug nasce auto-gerado, então sem isso o passo "Compartilhe" nasceria concluído
// e o dono nunca seria nudgeado a divulgar a loja.
const STORE_SHARED_KEY = "forbion_store_shared_v1"

// ── Fonte única dos passos (consumida também pelo WelcomeModal) ─────────────────
export type OnboardingStepKey = "service" | "hours" | "store" | "schedule"

export interface OnboardingStepMeta {
  key: OnboardingStepKey
  /** Título curto */
  label: string
  /** 1 linha de porquê */
  why: string
  /** Texto do CTA */
  cta: string
  /** Destino do CTA */
  href: string
  /** Cor de acento */
  color: string
}

export const ONBOARDING_STEPS: OnboardingStepMeta[] = [
  {
    key: "service",
    label: "Cadastre seu 1º serviço (com preço)",
    why: "É a base de tudo: sem serviço, não dá pra agendar nem cobrar.",
    cta: "Cadastrar serviço",
    href: "/dashboard/servicos",
    color: "#0066FF",
  },
  {
    key: "hours",
    label: "Defina seus horários de atendimento",
    why: "Diz quando você atende — sua agenda e sua loja online seguem isso.",
    cta: "Definir horários",
    href: "/dashboard/configuracoes?tab=horarios",
    color: "#F59E0B",
  },
  {
    key: "store",
    label: "Compartilhe o link da sua loja",
    why: "Seus clientes agendam sozinhos pelo link — sem você no WhatsApp.",
    cta: "Ver meu link",
    href: "/dashboard/configuracoes?tab=negocio",
    color: "#7C3AED",
  },
  {
    key: "schedule",
    label: "Registre seu 1º agendamento",
    why: "O momento que importa: coloque o 1º carro na agenda.",
    cta: "Abrir a agenda",
    href: "/dashboard/agendamentos",
    color: "#10B981",
  },
]

const STEP_ICON: Record<OnboardingStepKey, React.ReactNode> = {
  service: <Tag size={16} />,
  hours: <CalendarClock size={16} />,
  store: <Share2 size={16} />,
  schedule: <CalendarPlus size={16} />,
}

// Recorte mínimo do /auth/me só pro que o checklist precisa (slug + horários).
interface BusinessSignal {
  slug?: string | null
  hours?: { isOpen?: boolean }[] | null
}

export default function OnboardingChecklist({
  reopenSignal = 0,
  onStateChange,
}: {
  /** Bump deste número (vindo do WelcomeModal ao fechar) força expandir o checklist. */
  reopenSignal?: number
  /** Reporta estado pra page renderizar o botão flutuante "Continuar configuração". */
  onStateChange?: (s: { ready: boolean; collapsed: boolean; allDone: boolean }) => void
}) {
  const router = useRouter()
  const { planStatus } = useUser()

  const [servicesCount, setServicesCount] = useState<number | null>(null)
  // O3/Wave A — "qualquer agendamento" (o aha real), não só os de hoje
  const [hasFirstSchedule, setHasFirstSchedule] = useState<boolean | null>(null)
  // Wave A — loja pronta = slug definido + pelo menos 1 dia de funcionamento aberto.
  // Aqui mantemos os DOIS sinais separados (slug, horário aberto) pra que os passos
  // "Defina horários" e "Compartilhe a loja" sejam independentes no O4. O sinal
  // composto storeReady = hasSlug && hasOpenDay (Wave A) é derivado abaixo.
  const [hasSlug, setHasSlug] = useState<boolean | null>(null)
  const [hasOpenDay, setHasOpenDay] = useState<boolean | null>(null)
  const [slug, setSlug] = useState<string>("")

  const [collapsed, setCollapsed] = useState(false)
  const [openStore, setOpenStore] = useState(false)
  const [storeShared, setStoreShared] = useState(false)

  // B17 — countdown do trial (urgência pra conversão; CERA mantém sempre visível)
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

  // mount: lê estado recolhido + busca os 4 sinais
  useEffect(() => {
    const isCollapsed = typeof window !== "undefined" && localStorage.getItem(COLLAPSED_KEY) === "1"
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(isCollapsed)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStoreShared(typeof window !== "undefined" && localStorage.getItem(STORE_SHARED_KEY) === "1")

    apiGet<unknown>("/services")
      .then((res) => {
        const obj = res as { services?: unknown[]; data?: unknown[] }
        const list = Array.isArray(res) ? res : (obj?.services ?? obj?.data ?? [])
        setServicesCount(Array.isArray(list) ? list.length : 0)
      })
      .catch(() => setServicesCount(0))

    apiGet<{ schedules?: unknown[] }>("/schedules")
      .then((res) => setHasFirstSchedule((res?.schedules ?? []).length > 0))
      .catch(() => setHasFirstSchedule(false))

    apiGet<{ business?: BusinessSignal }>("/auth/me")
      .then((res) => {
        const biz = res?.business
        const s = (biz?.slug ?? "").trim()
        setSlug(s)
        setHasSlug(s.length > 0)
        setHasOpenDay(Array.isArray(biz?.hours) && biz.hours.some((h) => h?.isOpen))
      })
      .catch(() => { setHasSlug(false); setHasOpenDay(false) })
  }, [])

  // O7 — WelcomeModal pediu pra reabrir/expandir
  useEffect(() => {
    if (reopenSignal > 0) {
      localStorage.setItem(COLLAPSED_KEY, "0")
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(false)
    }
  }, [reopenSignal])

  const ready =
    servicesCount !== null && hasFirstSchedule !== null && hasSlug !== null && hasOpenDay !== null

  const doneMap: Record<OnboardingStepKey, boolean> = {
    service: (servicesCount ?? 0) > 0,
    hours: hasOpenDay === true, // pelo menos 1 dia de atendimento aberto
    // O slug nasce auto-gerado; só conta como "compartilhou" se o dono copiou o link
    // (storeShared) OU já tem agendamento (loja claramente rodando — não nudgeia conta ativa).
    store: hasSlug === true && (storeShared || hasFirstSchedule === true),
    schedule: hasFirstSchedule === true,
  }
  const doneCount = ready ? ONBOARDING_STEPS.filter((s) => doneMap[s.key]).length : 0
  const total = ONBOARDING_STEPS.length
  const pct = Math.round((doneCount / total) * 100)
  const allDone = ready && doneCount === total

  // B15 — celebra cada etapa recém-concluída (reforço positivo = mais ativação)
  useEffect(() => {
    if (!ready) return
    const prev = Number(localStorage.getItem(CELEB_KEY) ?? "0")
    if (doneCount > prev) {
      if (doneCount < total) toast.success(`Etapa concluída — ${Math.round((doneCount / total) * 100)}% da configuração pronta`)
      else toast.success("Loja configurada! Bora receber agendamentos.")
      localStorage.setItem(CELEB_KEY, String(doneCount))
    }
  }, [ready, doneCount, total])

  // O7 — reporta estado pra page decidir o botão flutuante "Continuar configuração"
  useEffect(() => {
    onStateChange?.({ ready, collapsed, allDone })
  }, [onStateChange, ready, collapsed, allDone])

  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0")
      return next
    })
  }, [])

  // ── Link público da loja ──────────────────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "https://app.forbion.digital")
  const publicUrl = `${appUrl.replace(/\/$/, "")}/${slug}`
  const displayHost = appUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
  const displayUrl = `${/localhost|127\.0\.0\.1/.test(displayHost) ? "app.forbion.digital" : displayHost}/${slug}`

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      localStorage.setItem(STORE_SHARED_KEY, "1") // marca o passo "Compartilhe" como concluído
      setStoreShared(true)
      toast.success("Link copiado! Cole no Instagram ou WhatsApp")
    } catch {
      toast.error("Não consegui copiar — copie manualmente o link acima")
    }
  }, [publicUrl])

  // ainda carregando os sinais → não pisca nada
  if (!ready) return null

  // tudo pronto → estado discreto "tudo pronto!" (sem toast falso)
  if (allDone) {
    return (
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10,
          backgroundColor: "var(--c-surface)",
          border: "1px solid var(--c-border)",
          borderRadius: 12, padding: "12px 16px", marginBottom: 24,
        }}
      >
        <CheckCircle2 size={18} color="#10B981" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>
          Tudo pronto! Sua loja está configurada e recebendo agendamentos.
        </span>
      </div>
    )
  }

  // recolhido → some o card; o botão flutuante (na page) reabre
  if (collapsed) return null

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#0066FF,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Rocket size={17} color="#FFFFFF" />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>Configure sua loja</p>
            <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "2px 0 0" }}>
              {doneCount} de {total} concluídos · termine pra começar a receber agendamentos
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
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
                whiteSpace: "nowrap",
              }}
            >
              <Clock size={12} /> {trialDaysLeft === 0 ? "Teste expira hoje" : `Teste: ${trialDaysLeft}d restante${trialDaysLeft !== 1 ? "s" : ""}`}
            </span>
          )}
          <button
            onClick={toggleCollapse}
            title="Recolher"
            aria-label="Recolher checklist"
            style={{ background: "none", border: "none", color: "var(--c-text-4)", cursor: "pointer", padding: 4, display: "flex" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--c-text-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--c-text-4)")}
          >
            <ChevronUp size={18} />
          </button>
        </div>
      </div>

      {/* barra de progresso PERSISTENTE */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 4, background: "var(--c-border)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#0066FF,#7C3AED)", borderRadius: 4, transition: "width 0.4s ease" }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--c-text-3)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
          {doneCount}/{total}
        </span>
      </div>

      {/* passos */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ONBOARDING_STEPS.map((s) => {
          const done = doneMap[s.key]
          const isStore = s.key === "store"
          const expanded = isStore && openStore && !done

          return (
            <div
              key={s.key}
              style={{
                background: done ? "transparent" : "var(--c-bg)",
                border: `1px solid ${done ? "transparent" : "var(--c-border)"}`,
                borderRadius: 12,
                overflow: "hidden",
                transition: "border-color 0.15s",
              }}
            >
              <button
                onClick={() => {
                  if (done) return
                  if (isStore) { setOpenStore((v) => !v); return }
                  router.push(s.href)
                }}
                disabled={done}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  textAlign: "left", width: "100%",
                  background: "transparent", border: "none",
                  padding: "11px 14px",
                  cursor: done ? "default" : "pointer",
                  fontFamily: "inherit",
                  opacity: done ? 0.55 : 1,
                }}
                onMouseEnter={(e) => { if (!done) e.currentTarget.parentElement!.style.borderColor = s.color }}
                onMouseLeave={(e) => { if (!done) e.currentTarget.parentElement!.style.borderColor = "var(--c-border)" }}
              >
                {done ? (
                  <CheckCircle2 size={20} color="#10B981" style={{ flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid var(--c-text-4)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: s.color }}>
                    <span style={{ transform: "scale(0.62)" }}>{STEP_ICON[s.key]}</span>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: done ? "var(--c-text-3)" : "var(--c-text)", margin: 0, textDecoration: done ? "line-through" : "none" }}>
                    {s.label}
                  </p>
                  {!done && <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "1px 0 0" }}>{s.why}</p>}
                </div>
                {!done && (
                  isStore
                    ? (expanded ? <ChevronUp size={16} color="var(--c-text-4)" style={{ flexShrink: 0 }} /> : <ChevronDown size={16} color="var(--c-text-4)" style={{ flexShrink: 0 }} />)
                    : <ArrowRight size={16} color={s.color} style={{ flexShrink: 0 }} />
                )}
              </button>

              {/* O5 — card do link da loja (Copiar + QR) dentro do passo "Compartilhe sua loja" */}
              {expanded && (
                <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
                  {slug ? (
                    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ background: "#FFFFFF", padding: 8, borderRadius: 10, flexShrink: 0, lineHeight: 0 }}>
                        <QRCodeSVG value={publicUrl} size={120} />
                      </div>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: "0 0 4px" }}>Link público da sua loja</p>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 6,
                          background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
                          borderRadius: 8, padding: "8px 10px", marginBottom: 10,
                        }}>
                          <span style={{ fontSize: 12.5, color: "var(--c-text-2)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                            {displayUrl}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            onClick={copyLink}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              background: "linear-gradient(135deg,#0066FF,#7C3AED)", border: "none",
                              borderRadius: 9, padding: "8px 14px", color: "#FFFFFF",
                              fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                            }}
                          >
                            <Copy size={13} /> Copiar link
                          </button>
                          <button
                            onClick={() => router.push("/dashboard/configuracoes?tab=negocio")}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              background: "transparent", border: "1px solid var(--c-border)",
                              borderRadius: 9, padding: "8px 14px", color: "var(--c-text-2)",
                              fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                            }}
                          >
                            Personalizar loja <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                      background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
                      borderRadius: 10, padding: "12px 14px", flexWrap: "wrap",
                    }}>
                      <span style={{ fontSize: 12.5, color: "var(--c-text-2)" }}>
                        Defina o link (apelido) da sua loja para começar a compartilhar.
                      </span>
                      <button
                        onClick={() => router.push("/dashboard/configuracoes?tab=negocio")}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          background: "linear-gradient(135deg,#0066FF,#7C3AED)", border: "none",
                          borderRadius: 9, padding: "8px 14px", color: "#FFFFFF",
                          fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        Definir link <ArrowRight size={13} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* dica final discreta */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14 }}>
        <Sparkles size={12} color="var(--c-text-4)" />
        <span style={{ fontSize: 11.5, color: "var(--c-text-4)" }}>
          Você pode recolher e voltar quando quiser pelo botão &quot;Continuar configuração&quot;.
        </span>
      </div>
    </div>
  )
}
