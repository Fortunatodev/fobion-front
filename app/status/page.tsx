// /status — página pública de smoke test (mesma info do /api/status, visível no browser).
// Server component (lê env no servidor, sem useEffect/fetch).
// Origem: fluxo Hermes multi-agente, Jira FOR-7.

export default function StatusPage() {
  const commit = process.env.NEXT_PUBLIC_GIT_SHA ?? "dev";
  const payload = { status: "ok", commit };

  return (
    <main
      style={{
        padding: "2rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: "560px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ marginBottom: "1rem" }}>Forbion — Status</h1>
      <pre
        style={{
          background: "#f3f4f6",
          padding: "1rem",
          borderRadius: "8px",
          fontSize: "0.95rem",
          overflow: "auto",
        }}
      >
        {JSON.stringify(payload, null, 2)}
      </pre>
      <p style={{ color: "#6b7280", fontSize: "0.85rem", marginTop: "1rem" }}>
        Smoke test do fluxo Hermes multi-agente (Jira FOR-7).
      </p>
    </main>
  );
}
