"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { isAuthenticated } from "@/lib/auth"
import {
  CalendarClock, Repeat, ShieldCheck, Camera, BarChart3, Users,
  ArrowRight, Sparkles,
} from "lucide-react"

/**
 * Landing pública do app (repaginada). Dark-first.
 * - Logado → /dashboard.
 * - Deslogado → landing enxuta (também serve de homepage pro consent screen do Google OAuth).
 * Marketing completo fica em forbion.digital.
 */
const FEATURES = [
  { icon: CalendarClock, color: "#0066FF", title: "Agenda + loja online", desc: "Seu link próprio: o cliente agenda sozinho, 24h, sem você no WhatsApp." },
  { icon: Repeat, color: "#7C3AED", title: "Clube de assinatura", desc: "Transforme lavagem avulsa em receita recorrente todo mês." },
  { icon: ShieldCheck, color: "#10B981", title: "Recall de garantia", desc: "O sistema chama o cliente de volta na revisão — recompra no automático." },
  { icon: Camera, color: "#F59E0B", title: "Vistoria com fotos", desc: "Registre o estado do veículo na entrada, com fotos e assinatura." },
  { icon: BarChart3, color: "#0066FF", title: "Relatórios e retenção", desc: "Faturamento, ticket médio e quem está esfriando — decida com número." },
  { icon: Users, color: "#7C3AED", title: "Equipe e repasses", desc: "Cada profissional com acesso e comissão calculada sozinha." },
]

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated()) router.replace("/dashboard")
  }, [router])

  return (
    <div data-theme="dark" style={{ minHeight: "100vh", background: "var(--c-bg)", color: "var(--c-text)", position: "relative", overflow: "hidden" }}>
      {/* glow + dot grid */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(60% 40% at 50% 0%, rgba(0,102,255,0.14), transparent 70%)" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5, backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)", backgroundSize: "64px 64px", maskImage: "radial-gradient(70% 50% at 50% 0%, #000, transparent)" }} />

      <div style={{ position: "relative", maxWidth: 1080, margin: "0 auto", padding: "0 20px" }}>
        {/* NAV */}
        <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 68 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,#0066FF,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "#fff" }}>F</div>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.4px" }}>Forbion</span>
          </div>
          <Link href="/auth/login" style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text-2)", textDecoration: "none", padding: "8px 16px", borderRadius: 10, border: "1px solid var(--c-border)" }}>
            Entrar
          </Link>
        </nav>

        {/* HERO */}
        <header style={{ textAlign: "center", padding: "72px 0 56px", maxWidth: 760, margin: "0 auto" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 999, padding: "6px 14px" }}>
            <Sparkles size={13} color="#0066FF" /> Gestão para estética automotiva
          </span>
          <h1 style={{ fontSize: "clamp(34px, 6vw, 60px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-1.5px", margin: "22px 0 0" }}>
            Sua estética{" "}
            <span style={{ color: "#0066FF" }}>no controle</span>,<br />
            sem o caos do WhatsApp
          </h1>
          <p style={{ fontSize: "clamp(15px, 2.2vw, 19px)", color: "var(--c-text-3)", lineHeight: 1.55, margin: "20px auto 0", maxWidth: 560 }}>
            Agenda online, loja de agendamento, clube de assinatura e relatórios — tudo num lugar só.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 32 }}>
            <Link href="/auth/login" style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 50, padding: "0 26px", borderRadius: 13, background: "linear-gradient(135deg,#0066FF,#7C3AED)", color: "#fff", fontSize: 15.5, fontWeight: 700, textDecoration: "none", boxShadow: "0 8px 30px rgba(0,102,255,0.35)" }}>
              Começar 7 dias grátis <ArrowRight size={17} />
            </Link>
            <a href="https://forbion.digital" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", height: 50, padding: "0 24px", borderRadius: 13, background: "var(--c-surface)", color: "var(--c-text)", fontSize: 15.5, fontWeight: 600, textDecoration: "none", border: "1px solid var(--c-border)" }}>
              Conhecer
            </a>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--c-text-4)", marginTop: 16 }}>Sem cartão de crédito · Cancele quando quiser</p>
        </header>

        {/* FEATURES */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 14, paddingBottom: 64 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, padding: 22 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: `${f.color}1A`, border: `1px solid ${f.color}33`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <f.icon size={20} color={f.color} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{f.title}</h3>
              <p style={{ fontSize: 13.5, color: "var(--c-text-3)", lineHeight: 1.5, margin: "6px 0 0" }}>{f.desc}</p>
            </div>
          ))}
        </section>

        {/* CTA band */}
        <section style={{ textAlign: "center", background: "linear-gradient(135deg, rgba(0,102,255,0.12), rgba(124,58,237,0.12))", border: "1px solid var(--c-border)", borderRadius: 20, padding: "44px 24px", marginBottom: 56 }}>
          <h2 style={{ fontSize: "clamp(22px,3.5vw,30px)", fontWeight: 800, letterSpacing: "-0.8px", margin: 0 }}>Pronto pra tirar a estética do caderno?</h2>
          <p style={{ fontSize: 15, color: "var(--c-text-3)", margin: "10px 0 24px" }}>Comece grátis hoje. Leva 2 minutos pra configurar.</p>
          <Link href="/auth/login" style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 50, padding: "0 28px", borderRadius: 13, background: "linear-gradient(135deg,#0066FF,#7C3AED)", color: "#fff", fontSize: 15.5, fontWeight: 700, textDecoration: "none" }}>
            Criar minha conta <ArrowRight size={17} />
          </Link>
        </section>

        {/* FOOTER */}
        <footer style={{ borderTop: "1px solid var(--c-border)", padding: "26px 0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--c-text-4)" }}>© {new Date().getFullYear()} Forbion</span>
          <div style={{ display: "flex", gap: 20 }}>
            <a href="https://forbion.digital" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--c-text-3)", textDecoration: "none" }}>Site</a>
            <Link href="/terms" style={{ fontSize: 13, color: "var(--c-text-3)", textDecoration: "none" }}>Termos</Link>
            <Link href="/privacy" style={{ fontSize: 13, color: "var(--c-text-3)", textDecoration: "none" }}>Privacidade</Link>
          </div>
        </footer>
      </div>
    </div>
  )
}
