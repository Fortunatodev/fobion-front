import Link from "next/link";
import type { ReactNode } from "react";

/** Casca compartilhada das páginas legais (pública, tema escuro, leitura confortável). */
export function LegalShell({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <main style={{ minHeight: "100dvh", background: "var(--c-bg, #0A0A0A)", color: "var(--c-text, #FAFAFA)" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 22px 72px" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 22,
            borderBottom: "1px solid var(--c-border, #1F1F1F)",
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
            <span
              style={{
                display: "grid",
                placeItems: "center",
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "#0066FF",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              F
            </span>
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" }}>
              forbion<span style={{ color: "#0066FF" }}>.</span>
            </span>
          </Link>
          <Link href="/" style={{ fontSize: 13, color: "var(--c-text-2, #A1A1AA)", textDecoration: "none" }}>
            ← Início
          </Link>
        </header>

        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", margin: "34px 0 6px" }}>{title}</h1>
        <p style={{ color: "var(--c-text-2, #A1A1AA)", fontSize: 13, margin: 0 }}>Última atualização: {updatedAt}</p>

        <div
          style={{
            marginTop: 28,
            fontSize: 15.5,
            lineHeight: 1.75,
            color: "var(--c-text-2, #C4C4CC)",
          }}
        >
          {children}
        </div>

        <footer style={{ marginTop: 48, paddingTop: 20, borderTop: "1px solid var(--c-border, #1F1F1F)", fontSize: 13, color: "var(--c-text-3, #71717A)" }}>
          <span style={{ fontWeight: 700, color: "var(--c-text-2, #A1A1AA)" }}>forbion<span style={{ color: "#0066FF" }}>.</span></span>
          &nbsp;·&nbsp; Gestão para estética automotiva ·{" "}
          <a href="mailto:contato@forbion.digital" style={{ color: "#4d94ff", textDecoration: "none" }}>contato@forbion.digital</a>
        </footer>
      </div>
    </main>
  );
}

/** Título de seção das páginas legais. */
export function H2({ children }: { children: ReactNode }) {
  return <h2 style={{ fontSize: 19, fontWeight: 650, color: "var(--c-text, #FAFAFA)", margin: "30px 0 8px" }}>{children}</h2>;
}
