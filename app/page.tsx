"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { isAuthenticated } from "@/lib/auth"

/**
 * Landing page pública da Forbion.
 *
 * - Visível por qualquer pessoa sem login (exigência Google OAuth verification).
 * - Explica a finalidade do app (agendamento para estéticas automotivas).
 * - Usuários já autenticados são redirecionados automaticamente ao dashboard.
 */
export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/dashboard")
    }
  }, [router])

  return (
    <div style={{
      minHeight: "100vh",
      background: "#09090B",
      color: "#FAFAFA",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 40px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        maxWidth: 1200,
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 800, color: "#fff",
          }}>F</div>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Forbion</span>
        </div>
        <Link href="/auth/login" style={{
          background: "#3B82F6",
          color: "#fff",
          padding: "8px 20px",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
        }}>
          Entrar
        </Link>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px" }}>
        <section style={{
          textAlign: "center",
          padding: "80px 0 60px",
        }}>
          <span style={{
            display: "inline-block",
            background: "rgba(59,130,246,0.15)",
            border: "1px solid rgba(59,130,246,0.3)",
            color: "#93C5FD",
            padding: "4px 14px",
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 24,
          }}>
            Plataforma de gestão para estéticas automotivas
          </span>

          <h1 style={{
            fontSize: "clamp(32px, 5vw, 56px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            margin: "0 0 20px",
            background: "linear-gradient(135deg, #FAFAFA 0%, #94A3B8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            Gerencie sua estética<br />de forma profissional
          </h1>

          <p style={{
            fontSize: 18,
            color: "#94A3B8",
            maxWidth: 520,
            margin: "0 auto 40px",
            lineHeight: 1.6,
          }}>
            A Forbion é uma plataforma completa para estéticas automotivas agendarem serviços,
            gerenciarem clientes, funcionários e acompanharem o desempenho do negócio em tempo real.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/auth/login" style={{
              background: "#3B82F6",
              color: "#fff",
              padding: "12px 28px",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}>
              Acessar minha conta →
            </Link>
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────────────── */}
        <section style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
          padding: "40px 0 80px",
        }}>
          {[
            {
              icon: "📅",
              title: "Agendamento online",
              desc: "Seus clientes agendam serviços diretamente pelo link da sua loja, 24 horas por dia.",
            },
            {
              icon: "👥",
              title: "Gestão de clientes",
              desc: "Cadastro completo de clientes com histórico de serviços, veículos e contatos.",
            },
            {
              icon: "🔔",
              title: "Notificações automáticas",
              desc: "Lembretes por e-mail para clientes e para você antes de cada agendamento.",
            },
            {
              icon: "📊",
              title: "Relatórios e métricas",
              desc: "Acompanhe faturamento, serviços mais populares e desempenho do seu negócio.",
            },
            {
              icon: "🧑‍🔧",
              title: "Controle de funcionários",
              desc: "Gerencie sua equipe, defina serviços por funcionário e acompanhe a agenda.",
            },
            {
              icon: "💳",
              title: "Planos de fidelidade",
              desc: "Crie planos com descontos em serviços para fidelizar seus melhores clientes.",
            },
          ].map((f) => (
            <div key={f.title} style={{
              background: "#111113",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: "24px",
            }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "#94A3B8", margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "24px 40px",
        textAlign: "center",
        color: "#64748B",
        fontSize: 13,
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          <span>© {new Date().getFullYear()} Forbion. Todos os direitos reservados.</span>
          <Link href="/terms" style={{ color: "#64748B", textDecoration: "none" }}>Termos de Serviço</Link>
          <Link href="/privacy" style={{ color: "#64748B", textDecoration: "none" }}>Política de Privacidade</Link>
        </div>
      </footer>
    </div>
  )
}