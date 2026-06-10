"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Rocket, ArrowRight, X } from "lucide-react"
import { apiGet } from "@/lib/api"
import { ONBOARDING_STEPS, COLLAPSED_KEY } from "@/components/dashboard/OnboardingChecklist"

/**
 * B16 / O7 — boas-vindas no 1º acesso. Hero enxuto + os 4 passos do checklist
 * (fonte única = ONBOARDING_STEPS) como lista fina + 1 CTA. Aparece UMA vez
 * (localStorage) e SÓ pra conta nova (sem nenhum agendamento ainda) — conta já
 * rodando não é interrompida. Ao fechar, onDone() deixa o checklist expandido.
 */
const KEY = "forbion_welcome_done_v1"

export default function WelcomeModal({
  firstName,
  onDone,
}: {
  firstName?: string
  onDone?: () => void
}) {
  const router = useRouter()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (localStorage.getItem(KEY) === "1") return
    let cancelled = false
    ;(async () => {
      // Só mostra pra conta NOVA. Se já existe agendamento, a loja já está rodando →
      // não interrompe (marca como visto silenciosamente).
      try {
        const r = await apiGet<unknown>("/schedules")
        const arr = Array.isArray(r)
          ? r
          : (r && typeof r === "object" && Array.isArray((r as { schedules?: unknown[] }).schedules)
              ? (r as { schedules: unknown[] }).schedules
              : [])
        if (!cancelled && arr.length > 0) {
          localStorage.setItem(KEY, "1")
          return
        }
      } catch {
        /* se a checagem falhar, mostra mesmo assim (provavelmente conta nova) */
      }
      if (!cancelled) setShow(true)
    })()
    return () => { cancelled = true }
  }, [])

  if (!show) return null

  function finish() {
    localStorage.setItem(KEY, "1")
    localStorage.setItem(COLLAPSED_KEY, "0") // checklist expandido após o welcome (O7)
    setShow(false)
    onDone?.()
  }
  function close() { finish() }
  function start() {
    finish()
    router.push(ONBOARDING_STEPS[0]?.href ?? "/dashboard/servicos")
  }

  return createPortal(
    <div
      onClick={close}
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "rgba(0,0,0,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          width: "100%", maxWidth: 400, maxHeight: "90vh", overflowY: "auto",
          background: "var(--c-surface)", border: "1px solid var(--c-border)",
          borderRadius: 20, padding: 24, position: "relative", boxSizing: "border-box",
        }}
      >
        <button
          onClick={close}
          aria-label="Fechar"
          style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "var(--c-text-4)", cursor: "pointer", display: "flex" }}
        >
          <X size={18} />
        </button>

        {/* Hero */}
        <div style={{ width: 44, height: 44, borderRadius: 13, background: "linear-gradient(135deg,#0066FF,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <Rocket size={21} color="#FFFFFF" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.5px" }}>
          Bem-vindo{firstName ? `, ${firstName}` : ""}!
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--c-text-3)", margin: "8px 0 18px", lineHeight: 1.55 }}>
          Sua agenda, sua loja online de agendamento e a recorrência dos clientes num lugar só. Em 4 passos você sai do zero ao 1º agendamento.
        </p>

        {/* Lista slim dos 4 passos */}
        <ol style={{ listStyle: "none", margin: "0 0 20px", padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {ONBOARDING_STEPS.map((s, i) => {
            const last = i === ONBOARDING_STEPS.length - 1
            return (
              <li key={s.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 4px", borderTop: i === 0 ? "none" : "1px solid var(--c-border)" }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: `${s.color}1A`, border: `1px solid ${s.color}40`, color: s.color, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: last ? 700 : 500, color: last ? "var(--c-text)" : "var(--c-text-2)" }}>
                  {s.label}
                </span>
                {last && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#10B981", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 6, padding: "2px 7px", flexShrink: 0 }}>
                    o que importa
                  </span>
                )}
              </li>
            )
          })}
        </ol>

        {/* CTA único */}
        <button
          onClick={start}
          style={{
            width: "100%", height: 46, borderRadius: 13, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg,#0066FF,#7C3AED)", color: "#FFFFFF",
            fontSize: 14.5, fontWeight: 700, fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}
        >
          Bora configurar <ArrowRight size={16} />
        </button>
        <button
          onClick={close}
          style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: "var(--c-text-4)", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}
        >
          Fechar e ver pelo checklist depois
        </button>
      </div>
    </div>,
    document.body,
  )
}
