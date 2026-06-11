"use client"

import { useState } from "react"
import {
  Lock,
  Crown,
  MessageCircle,
  CalendarDays,
  Users,
  ArrowRight,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Shield,
  BarChart2,
  Zap,
} from "lucide-react"
import type { AccountLock } from "@/types"
import { useUser } from "@/contexts/UserContext"
import { apiGet } from "@/lib/api"
import PricingCards from "@/components/shared/PricingCards"

/* ─── Props ────────────────────────────────────────────────────────────────── */

interface BillingLockScreenProps {
  lock: AccountLock
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function planLabel(plan: string): string {
  if (plan === "PRO") return "Pro"
  if (plan === "BASIC") return "Essencial"
  return "Essencial"
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function BillingLockScreen({ lock }: BillingLockScreenProps) {
  const { loadUser } = useUser()
  const [redirecting, setRedirecting] = useState(false)
  const [redirectError, setRedirectError] = useState<string | null>(null)

  const isNoPlan   = lock.code === "NO_PLAN"
  const isInactive = lock.code === "BUSINESS_INACTIVE"
  const isTrial    = lock.isTrial
  const hasStats   = lock.scheduleCount > 0 || lock.customerCount > 0

  // Busca o link de checkout CactoPay e redireciona o usuário.
  // Servidor decide se usa link custom do business ou o global (PRO padrão).
  async function handleSubscribe() {
    setRedirecting(true)
    setRedirectError(null)
    try {
      const res = await apiGet<{ paymentLink: string }>("/billing/payment-link")
      if (res?.paymentLink) {
        window.location.href = res.paymentLink
        return
      }
      setRedirectError("Não foi possível abrir o checkout. Tente novamente.")
    } catch (err) {
      setRedirectError((err as Error).message || "Erro ao abrir checkout.")
    } finally {
      setRedirecting(false)
    }
  }

  // ── Content variants ────────────────────────────────────────────────────
  let icon  = <Lock size={36} color="#EF4444" />
  let title = "Seu acesso ao sistema foi pausado"
  let desc  = ""

  if (isInactive) {
    icon  = <Shield size={36} color="#F59E0B" />
    title = "Acesso temporariamente suspenso"
    desc  = "Seu acesso foi pausado por questões administrativas. Se acredita que houve um engano ou precisa de ajuda, fale com nosso suporte — estamos aqui para resolver."
  } else if (isNoPlan) {
    icon  = <Shield size={36} color="#7C3AED" />
    title = "Escolha um plano para começar"
    desc  = "Você ainda não configurou um plano. Selecione um plano abaixo para começar a usar todas as funcionalidades do sistema."
  } else if (isTrial) {
    icon  = <Sparkles size={36} color="#F59E0B" />
    title = "Seu período de teste terminou"
    desc  = lock.expiredAt
      ? `Seu teste gratuito do plano ${planLabel(lock.plan)} terminou em ${formatDate(lock.expiredAt)}. Para continuar usando o sistema, assine um plano.`
      : `Seu teste gratuito do plano ${planLabel(lock.plan)} terminou. Para continuar usando o sistema, assine um plano.`
  } else {
    title = "Seu plano expirou"
    desc  = lock.expiredAt
      ? `Seu plano ${planLabel(lock.plan)} expirou em ${formatDate(lock.expiredAt)}. Renove para voltar a gerenciar seus agendamentos e clientes.`
      : `Seu plano ${planLabel(lock.plan)} expirou. Renove para voltar a gerenciar seus agendamentos e clientes.`
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "var(--c-bg)",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: "24px 16px",
    }}>
      <div style={{ maxWidth: 520, width: "100%" }}>

        {/* ── Icon badge ─────────────────────────────────────────────── */}
        <div style={{
          width: 80, height: 80, borderRadius: 20,
          background: isInactive
            ? "rgba(245,158,11,0.1)"
            : isNoPlan
              ? "rgba(124,58,237,0.1)"
              : isTrial
                ? "rgba(245,158,11,0.1)"
                : "rgba(239,68,68,0.1)",
          border: `1px solid ${isInactive ? "rgba(245,158,11,0.2)" : isNoPlan ? "rgba(124,58,237,0.2)" : isTrial ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 28px",
        }}>
          {icon}
        </div>

        {/* ── Title ──────────────────────────────────────────────────── */}
        <h1 style={{
          fontSize: 26, fontWeight: 800, color: "var(--c-text)",
          textAlign: "center", margin: "0 0 12px", lineHeight: 1.3,
        }}>
          {title}
        </h1>

        {/* ── Description ────────────────────────────────────────────── */}
        <p style={{
          fontSize: 15, color: "var(--c-text-2)", textAlign: "center",
          lineHeight: 1.7, margin: "0 0 28px", maxWidth: 440,
          marginLeft: "auto", marginRight: "auto",
        }}>
          {desc}
        </p>

        {/* ── Stats cards (upgrade funnel) ───────────────────────────── */}
        {hasStats && (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
            marginBottom: 28,
          }}>
            <div style={{
              background: "var(--c-surface)", borderRadius: 14,
              border: "1px solid var(--c-border)", padding: "16px 18px",
              textAlign: "center",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, marginBottom: 8,
              }}>
                <CalendarDays size={16} color="#3B82F6" />
                <span style={{ fontSize: 12, color: "var(--c-text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Agendamentos
                </span>
              </div>
              <span style={{ fontSize: 28, fontWeight: 800, color: "var(--c-text)" }}>
                {lock.scheduleCount.toLocaleString("pt-BR")}
              </span>
            </div>

            <div style={{
              background: "var(--c-surface)", borderRadius: 14,
              border: "1px solid var(--c-border)", padding: "16px 18px",
              textAlign: "center",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, marginBottom: 8,
              }}>
                <Users size={16} color="#10B981" />
                <span style={{ fontSize: 12, color: "var(--c-text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Clientes
                </span>
              </div>
              <span style={{ fontSize: 28, fontWeight: 800, color: "var(--c-text)" }}>
                {lock.customerCount.toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
        )}

        {/* ── Motivational text ──────────────────────────────────────── */}
        {hasStats && (
          <p style={{
            fontSize: 13, color: "var(--c-text-3)", textAlign: "center",
            lineHeight: 1.6, margin: "0 0 28px", fontStyle: "italic",
          }}>
            Você já gerenciou <strong style={{ color: "var(--c-text-2)" }}>{lock.scheduleCount}</strong> agendamento{lock.scheduleCount !== 1 ? "s" : ""}{" "}
            e <strong style={{ color: "var(--c-text-2)" }}>{lock.customerCount}</strong> cliente{lock.customerCount !== 1 ? "s" : ""} com a nossa plataforma.
            Não perca esse controle.
          </p>
        )}

        {/* ── Plan recommendation card ───────────────────────────────── */}
        {!isInactive && (
        <div style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(0,102,255,0.08))",
          border: "1px solid rgba(124,58,237,0.2)",
          borderRadius: 16, padding: "20px 22px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Crown size={18} color="#F59E0B" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)" }}>
              Recomendado: Plano Pro
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { icon: <CalendarDays size={14} />, text: "Agendamentos ilimitados" },
              { icon: <BarChart2 size={14} />,    text: "Relatórios e métricas detalhadas" },
              { icon: <Users size={14} />,        text: "Planos de assinatura para clientes" },
              { icon: <Zap size={14} />,          text: "Integrações avançadas + Google Calendar" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#7C3AED", flexShrink: 0 }}>{item.icon}</span>
                <span style={{ fontSize: 13, color: "var(--c-text-2)" }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Os 3 tiers reais (Essencial/Premium/Pro) — cliente escolhe e paga aqui */}
        {!isInactive && (
          <div style={{ marginBottom: 20 }}>
            <PricingCards />
          </div>
        )}

        {/* ── CTA buttons ────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* PRIMARY: Subscribe via CactoPay (only for plan-related locks, not BUSINESS_INACTIVE) */}
          {!isInactive && (
            <button
              onClick={handleSubscribe}
              disabled={redirecting}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "15px 24px", borderRadius: 14,
                background: redirecting
                  ? "var(--c-text-4)"
                  : "linear-gradient(135deg, #0066FF, #7C3AED)",
                color: "var(--c-on-primary)", fontSize: 15, fontWeight: 700,
                border: "none", cursor: redirecting ? "wait" : "pointer",
                transition: "all 0.2s ease",
                boxShadow: redirecting ? "none" : "0 4px 20px rgba(0,102,255,0.25)",
                fontFamily: "inherit",
              }}
              onMouseEnter={e => {
                if (!redirecting) {
                  e.currentTarget.style.transform = "translateY(-1px)"
                  e.currentTarget.style.boxShadow = "0 6px 28px rgba(0,102,255,0.35)"
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)"
                e.currentTarget.style.boxShadow = redirecting ? "none" : "0 4px 20px rgba(0,102,255,0.25)"
              }}
            >
              <Crown size={18} />
              {redirecting ? "Abrindo checkout..." : isNoPlan ? "Começar o Pro" : "Renovar o Pro"}
              <ArrowRight size={16} />
            </button>
          )}

          {redirectError && (
            <p style={{ fontSize: 12, color: "#EF4444", textAlign: "center", margin: 0 }}>
              {redirectError}
            </p>
          )}

          {/* SECONDARY: WhatsApp / Support */}
          <a
            href="https://api.whatsapp.com/send/?phone=5547920025084&text=Ol%C3%A1%2C%20gostaria%20de%20renovar%20meu%20plano%20Forbion"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "13px 24px", borderRadius: 14,
              backgroundColor: "var(--c-surface)",
              border: "1px solid var(--c-text-4)",
              color: "var(--c-text-2)", fontSize: 14, fontWeight: 600,
              textDecoration: "none",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "var(--c-text-4)"
              e.currentTarget.style.color = "var(--c-text)"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "var(--c-text-4)"
              e.currentTarget.style.color = "var(--c-text-2)"
            }}
          >
            <MessageCircle size={16} />
            {isInactive ? "Falar com suporte" : "Precisa de ajuda? WhatsApp"}
            <ChevronRight size={14} />
          </a>

          {/* TERTIARY: Retry (check if plan was reactivated) */}
          <button
            onClick={() => loadUser()}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "10px 24px", borderRadius: 14,
              background: "transparent", border: "none",
              color: "var(--c-text-4)", fontSize: 13, fontWeight: 500,
              cursor: "pointer",
              transition: "color 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--c-text-2)" }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--c-text-4)" }}
          >
            <RefreshCw size={14} />
            Já paguei — verificar novamente
          </button>
        </div>

        {/* ── Social proof ───────────────────────────────────────────── */}
        <p style={{
          fontSize: 12, color: "var(--c-text-4)", textAlign: "center",
          marginTop: 32, lineHeight: 1.6,
        }}>
          {isInactive
            ? "Nosso time de suporte está pronto para ajudar. Estamos à disposição para esclarecer qualquer dúvida."
            : "Centenas de negócios como o seu usam o Forbion para manter seus agendamentos e faturamento organizados. Não fique no escuro."
          }
        </p>
      </div>
    </div>
  )
}
