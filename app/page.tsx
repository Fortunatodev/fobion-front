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
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#0A0A0B",
        color: "#FAFAFA",
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
                color: "#fff",
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
                color: "#FAFAFA",
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
                color: "#A1A1AA",
                padding: "8px 14px",
                textDecoration: "none",
              }}
            >
              Conhecer
            </a>
            <Link
              href="/auth/login"
              style={{
                background: "#FAFAFA",
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
                  background: "#FAFAFA",
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
                color: "#FAFAFA",
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
                color: "#A1A1AA",
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
                  color: "#fff",
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

            <p style={{ fontSize: 12, color: "#52525B", marginTop: 20 }}>
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
                    color: "#FAFAFA",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: "#A1A1AA",
                    margin: 0,
                    lineHeight: 1.6,
                  }}
                >
                  {f.desc}
                </p>
              </div>
            ))}
          </section>

          {/* Pricing tiers */}
          <section style={{ padding: "60px 0 100px" }}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <h2
                style={{
                  fontSize: "clamp(28px, 4vw, 40px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "#FAFAFA",
                  margin: "0 0 12px",
                }}
              >
                Planos simples,{" "}
                <span
                  style={{
                    background:
                      "linear-gradient(135deg, #0066FF 0%, #3B82F6 50%, #0066FF 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  sem surpresa
                </span>
              </h2>
              <p style={{ fontSize: 15, color: "#A1A1AA", margin: 0, maxWidth: 480, marginInline: "auto", lineHeight: 1.6 }}>
                7 dias grátis em qualquer plano. Cancele quando quiser.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 20,
                maxWidth: 960,
                margin: "0 auto",
              }}
            >
              {[
                {
                  name: "Basic",
                  price: "R$79",
                  period: "/mês",
                  desc: "Ideal para começar",
                  features: [
                    "Agendamento online ilimitado",
                    "Gestão de clientes e veículos",
                    "Notificações por e-mail",
                    "1 funcionário incluso",
                    "Suporte por e-mail",
                  ],
                  highlighted: false,
                },
                {
                  name: "Pro",
                  price: "R$129",
                  period: "/mês",
                  desc: "O mais popular",
                  features: [
                    "Tudo do Basic",
                    "Relatórios e métricas",
                    "Planos de fidelidade",
                    "Até 5 funcionários",
                    "Suporte prioritário",
                  ],
                  highlighted: true,
                },
                {
                  name: "Business",
                  price: "R$179",
                  period: "/mês",
                  desc: "Para crescer sem limites",
                  features: [
                    "Tudo do Pro",
                    "Funcionários ilimitados",
                    "Integrações avançadas",
                    "API de acesso",
                    "Suporte dedicado",
                  ],
                  highlighted: false,
                },
              ].map((tier) => (
                <div
                  key={tier.name}
                  style={{
                    position: "relative",
                    background: tier.highlighted
                      ? "rgba(0,102,255,0.06)"
                      : "rgba(255,255,255,0.025)",
                    border: tier.highlighted
                      ? "1px solid rgba(0,102,255,0.25)"
                      : "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 20,
                    padding: "32px 28px",
                    backdropFilter: "blur(8px)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                  }}
                >
                  {tier.highlighted && (
                    <div
                      style={{
                        position: "absolute",
                        top: -12,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "linear-gradient(135deg, #0066FF, #2563EB)",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "5px 14px",
                        borderRadius: 100,
                        letterSpacing: "0.02em",
                      }}
                    >
                      Mais popular
                    </div>
                  )}

                  <div>
                    <h3
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "#FAFAFA",
                        margin: "0 0 4px",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {tier.name}
                    </h3>
                    <p style={{ fontSize: 13, color: "#71717A", margin: 0 }}>{tier.desc}</p>
                  </div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 36, fontWeight: 700, color: "#FAFAFA", letterSpacing: "-0.03em" }}>
                      {tier.price}
                    </span>
                    <span style={{ fontSize: 14, color: "#71717A", fontWeight: 500 }}>{tier.period}</span>
                  </div>

                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                    {tier.features.map((feat) => (
                      <li key={feat} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#E4E4E7" }}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="8" fill={tier.highlighted ? "rgba(0,102,255,0.15)" : "rgba(255,255,255,0.06)"} />
                          <path d="M5 8L7 10L11 6" stroke={tier.highlighted ? "#3B82F6" : "#A1A1AA"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {feat}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/auth/login"
                    style={{
                      display: "block",
                      textAlign: "center",
                      textDecoration: "none",
                      fontSize: 14,
                      fontWeight: 600,
                      padding: "12px 0",
                      borderRadius: 12,
                      background: tier.highlighted
                        ? "linear-gradient(135deg, #0066FF, #2563EB)"
                        : "rgba(255,255,255,0.04)",
                      color: tier.highlighted ? "#fff" : "#E4E4E7",
                      border: tier.highlighted ? "none" : "1px solid rgba(255,255,255,0.1)",
                      boxShadow: tier.highlighted
                        ? "0 8px 24px rgba(0,102,255,0.3)"
                        : undefined,
                      transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    }}
                  >
                    Começar 7 dias grátis
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            padding: "28px 32px",
            textAlign: "center",
            color: "#71717A",
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
            <a href="https://forbion.digital" style={{ color: "#71717A", textDecoration: "none" }}>
              Site
            </a>
            <Link href="/terms" style={{ color: "#71717A", textDecoration: "none" }}>
              Termos
            </Link>
            <Link href="/privacy" style={{ color: "#71717A", textDecoration: "none" }}>
              Privacidade
            </Link>
          </div>
        </footer>
      </div>
    </div>
  )
}
