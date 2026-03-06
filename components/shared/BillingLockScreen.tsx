"use client"

import Link from "next/link"
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
  if (plan === "PRO") return "PRO"
  if (plan === "BASIC") return "Basic"
  return "Basic"
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function BillingLockScreen({ lock }: BillingLockScreenProps) {
  const { loadUser } = useUser()

  const isNoPlan   = lock.code === "NO_PLAN"
  const isInactive = lock.code === "BUSINESS_INACTIVE"
  const isTrial    = lock.isTrial
  const hasStats   = lock.scheduleCount > 0 || lock.customerCount > 0

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
      backgroundColor: "#09090B",
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
          fontSize: 26, fontWeight: 800, color: "#FAFAFA",
          textAlign: "center", margin: "0 0 12px", lineHeight: 1.3,
        }}>
          {title}
        </h1>

        {/* ── Description ────────────────────────────────────────────── */}
        <p style={{
          fontSize: 15, color: "#A1A1AA", textAlign: "center",
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
              background: "#111113", borderRadius: 14,
              border: "1px solid #1F1F23", padding: "16px 18px",
              textAlign: "center",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, marginBottom: 8,
              }}>
                <CalendarDays size={16} color="#3B82F6" />
                <span style={{ fontSize: 12, color: "#71717A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Agendamentos
                </span>
              </div>
              <span style={{ fontSize: 28, fontWeight: 800, color: "#FAFAFA" }}>
                {lock.scheduleCount.toLocaleString("pt-BR")}
              </span>
            </div>

            <div style={{
              background: "#111113", borderRadius: 14,
              border: "1px solid #1F1F23", padding: "16px 18px",
              textAlign: "center",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, marginBottom: 8,
              }}>
                <Users size={16} color="#10B981" />
                <span style={{ fontSize: 12, color: "#71717A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Clientes
                </span>
              </div>
              <span style={{ fontSize: 28, fontWeight: 800, color: "#FAFAFA" }}>
                {lock.customerCount.toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
        )}

        {/* ── Motivational text ──────────────────────────────────────── */}
        {hasStats && (
          <p style={{
            fontSize: 13, color: "#71717A", textAlign: "center",
            lineHeight: 1.6, margin: "0 0 28px", fontStyle: "italic",
          }}>
            Você já gerenciou <strong style={{ color: "#A1A1AA" }}>{lock.scheduleCount}</strong> agendamento{lock.scheduleCount !== 1 ? "s" : ""}{" "}
            e <strong style={{ color: "#A1A1AA" }}>{lock.customerCount}</strong> cliente{lock.customerCount !== 1 ? "s" : ""} com a nossa plataforma.
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
            <span style={{ fontSize: 14, fontWeight: 700, color: "#FAFAFA" }}>
              Recomendado: Plano PRO
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
                <span style={{ fontSize: 13, color: "#A1A1AA" }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* ── CTA buttons ────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Primary: WhatsApp / Support */}
          <a
            href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20gostaria%20de%20renovar%20meu%20plano%20Forbion"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "15px 24px", borderRadius: 14,
              background: "linear-gradient(135deg, #0066FF, #7C3AED)",
              color: "#fff", fontSize: 15, fontWeight: 700,
              textDecoration: "none",
              transition: "all 0.2s ease",
              boxShadow: "0 4px 20px rgba(0,102,255,0.25)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-1px)"
              e.currentTarget.style.boxShadow = "0 6px 28px rgba(0,102,255,0.35)"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "translateY(0)"
              e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,102,255,0.25)"
            }}
          >
            <MessageCircle size={18} />
            {isInactive ? "Falar com suporte" : isNoPlan ? "Falar com vendas" : "Renovar agora via WhatsApp"}
            <ArrowRight size={16} />
          </a>

          {/* Secondary: View plans (goes to configuracoes which is allowed) */}
          {!isInactive && (
          <Link
            href="/dashboard/configuracoes?tab=plano"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "14px 24px", borderRadius: 14,
              backgroundColor: "#111113",
              border: "1px solid #27272A",
              color: "#A1A1AA", fontSize: 14, fontWeight: 600,
              textDecoration: "none",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "#3F3F46"
              e.currentTarget.style.color = "#FAFAFA"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "#27272A"
              e.currentTarget.style.color = "#A1A1AA"
            }}
          >
            <Crown size={16} />
            Ver planos disponíveis
            <ChevronRight size={14} />
          </Link>
          )}

          {/* Tertiary: Retry (check if plan was reactivated) */}
          <button
            onClick={() => loadUser()}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 24px", borderRadius: 14,
              background: "transparent", border: "none",
              color: "#52525B", fontSize: 13, fontWeight: 500,
              cursor: "pointer",
              transition: "color 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#A1A1AA" }}
            onMouseLeave={e => { e.currentTarget.style.color = "#52525B" }}
          >
            <RefreshCw size={14} />
            Já renovei — verificar novamente
          </button>
        </div>

        {/* ── Social proof ───────────────────────────────────────────── */}
        <p style={{
          fontSize: 12, color: "#3F3F46", textAlign: "center",
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
