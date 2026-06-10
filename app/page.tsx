"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { isAuthenticated } from "@/lib/auth"

/**
 * Landing page pública do produto.
 *
 * Visual alinhado ao padrão do site marketing (forbion.digital):
 * - Background com dots pattern + glow azul radial
 * - Tipografia hierárquica com gradient text no título
 * - Cards com border sutil + backdrop blur
 *
 * Comportamento:
 * - Visível sem login (exigência do Google OAuth verification)
 * - Usuário autenticado vai direto pro /dashboard
 */
export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/dashboard")
    }
  }, [router])

  return (
    <div
      data-theme="dark"
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#0A0A0B",
        color: "var(--c-text)",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        overflow: "hidden",
      }}
    >
      {/* ── Background: dots pattern + glow azul ────────────────────────── */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.08) 1.35px, transparent 1.35px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse 80% 50% at 50% 0%, black 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 50% at 50% 0%, black 40%, transparent 100%)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -120,
          left: "50%",
          transform: "translateX(-50%)",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "rgba(0, 102, 255, 0.18)",
          filter: "blur(140px)",
          pointerEvents: "none",
        }}
      />

      {/* ── Conteúdo ────────────────────────────────────────────────────── */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 32px",
            maxWidth: 1200,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <Link
            href="/"
            style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, #0066FF, #7C3AED)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 800,
                color: "var(--c-text)",
                boxShadow: "0 4px 16px rgba(0,102,255,0.35)",
              }}
            >
              F
            </div>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--c-text)",
              }}
            >
              Forbion
            </span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a
              href="https://forbion.digital"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--c-text-2)",
                padding: "8px 14px",
                textDecoration: "none",
              }}
            >
              Conhecer
            </a>
            <Link
              href="/auth/login"
              style={{
                background: "var(--c-text)",
                color: "#0A0A0B",
                padding: "9px 20px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Entrar
            </Link>
          </div>
        </header>

        {/* Hero */}
        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px" }}>
          <section
            style={{
              textAlign: "center",
              padding: "80px 0 70px",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#E4E4E7",
                padding: "6px 14px 6px 6px",
                borderRadius: 100,
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 28,
                backdropFilter: "blur(8px)",
              }}
            >
              <span
                style={{
                  background: "var(--c-text)",
                  color: "#0A0A0B",
                  padding: "2px 10px",
                  borderRadius: 100,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                New
              </span>
              Plataforma de gestão para estéticas automotivas
            </span>

            <h1
              style={{
                fontSize: "clamp(36px, 6vw, 64px)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                margin: "0 0 24px",
                color: "var(--c-text)",
              }}
            >
              Gerencie sua{" "}
              <span
                style={{
                  background:
                    "linear-gradient(135deg, #0066FF 0%, #3B82F6 50%, #0066FF 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                estética
              </span>
              <br />
              de forma profissional
            </h1>

            <p
              style={{
                fontSize: 17,
                color: "var(--c-text-2)",
                maxWidth: 560,
                margin: "0 auto 36px",
                lineHeight: 1.65,
              }}
            >
              Saia do caos do WhatsApp. Organize sua agenda, crie planos de assinatura e
              veja em números o quanto sua estética está crescendo.
            </p>

            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/auth/login"
                style={{
                  background: "linear-gradient(135deg, #0066FF, #2563EB)",
                  color: "var(--c-text)",
                  padding: "14px 28px",
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow:
                    "0 8px 24px rgba(0,102,255,0.35), 0 2px 4px rgba(0,102,255,0.2)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                Começar 7 dias grátis
                <span style={{ fontSize: 16 }}>→</span>
              </Link>
              <a
                href="https://forbion.digital#como-funciona"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#E4E4E7",
                  padding: "13px 26px",
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  backdropFilter: "blur(8px)",
                }}
              >
                Como funciona?
              </a>
            </div>

            <p style={{ fontSize: 12, color: "var(--c-text-4)", marginTop: 20 }}>
              Sem cartão de crédito para começar · Cancele quando quiser
            </p>
          </section>

          {/* Features grid */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
              padding: "20px 0 100px",
            }}
          >
            {[
              {
                title: "Agendamento online",
                desc:
                  "Seus clientes agendam serviços diretamente pelo link da sua loja, 24 horas por dia.",
              },
              {
                title: "Gestão de clientes",
                desc:
                  "Cadastro completo de clientes com histórico de serviços, veículos e contatos.",
              },
              {
                title: "Notificações automáticas",
                desc:
                  "Lembretes por e-mail para clientes e para você antes de cada agendamento.",
              },
              {
                title: "Relatórios e métricas",
                desc:
                  "Acompanhe faturamento, serviços mais populares e desempenho do seu negócio.",
              },
              {
                title: "Controle de funcionários",
                desc:
                  "Gerencie sua equipe, defina serviços por funcionário e acompanhe a agenda.",
              },
              {
                title: "Planos de fidelidade",
                desc:
                  "Crie planos com descontos em serviços para fidelizar seus melhores clientes.",
              },
            ].map((f) => (
              <div
                key={f.title}
                style={{
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 16,
                  padding: "24px 22px",
                  backdropFilter: "blur(8px)",
                  transition: "border-color 0.2s, transform 0.2s",
                }}
              >
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    margin: "0 0 10px",
                    color: "var(--c-text)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--c-text-2)",
                    margin: 0,
                    lineHeight: 1.6,
                  }}
                >
                  {f.desc}
                </p>
              </div>
            ))}
          </section>
        </main>

        {/* Footer */}
        <footer
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            padding: "28px 32px",
            textAlign: "center",
            color: "var(--c-text-3)",
            fontSize: 13,
          }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              display: "flex",
              justifyContent: "center",
              gap: 28,
              flexWrap: "wrap",
            }}
          >
            <span>© {new Date().getFullYear()} Forbion. Todos os direitos reservados.</span>
            <a href="https://forbion.digital" style={{ color: "var(--c-text-3)", textDecoration: "none" }}>
              Site
            </a>
            <Link href="/terms" style={{ color: "var(--c-text-3)", textDecoration: "none" }}>
              Termos
            </Link>
            <Link href="/privacy" style={{ color: "var(--c-text-3)", textDecoration: "none" }}>
              Privacidade
            </Link>
          </div>
        </footer>
      </div>
    </div>
  )
}
