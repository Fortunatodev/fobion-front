"use client";

// Pegador de último recurso — usado quando o erro acontece no próprio layout root.
// Precisa renderizar html + body porque substitui a árvore inteira.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          backgroundColor: "#0A0A0A",
          color: "#E4E4E7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <h2 style={{ fontSize: 22, marginBottom: 12 }}>Erro inesperado</h2>
          <p style={{ color: "#A1A1AA", fontSize: 14 }}>
            Não conseguimos carregar a aplicação. Recarregue a página em alguns
            segundos.
          </p>
          {error.digest && (
            <p style={{ color: "#52525B", fontSize: 12, marginTop: 12 }}>
              Código: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              marginTop: 24,
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid #2A2A2A",
              background: "#0066FF",
              color: "#FFFFFF",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
