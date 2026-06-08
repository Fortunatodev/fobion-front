"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log para o console do navegador. Quando integrar Sentry, captureException(error) aqui.
    console.error("[app/error.tsx]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--c-bg)",
        color: "#E4E4E7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <h2 style={{ fontSize: 22, marginBottom: 12, color: "var(--c-text)" }}>
          Algo deu errado
        </h2>
        <p style={{ color: "var(--c-text-2)", fontSize: 14, lineHeight: 1.6 }}>
          Tivemos um problema ao carregar essa página. Tente novamente em alguns segundos.
          Se persistir, recarregue a página.
        </p>
        {error.digest && (
          <p style={{ color: "var(--c-text-4)", fontSize: 12, marginTop: 12 }}>
            Código: {error.digest}
          </p>
        )}
        <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid var(--c-border-2)",
              background: "#0066FF",
              color: "var(--c-text)",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Tentar novamente
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid var(--c-border-2)",
              background: "none",
              color: "var(--c-text-2)",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Voltar ao início
          </button>
        </div>
      </div>
    </div>
  );
}
