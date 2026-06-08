"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/lib/auth";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");

    if (!token) {
      setError("Erro na autenticação. Tente novamente.");
      return;
    }

    setToken(token);

    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

    // Retry com backoff exponencial: 500ms, 1s, 2s.
    // Por quê: Railway Hobby às vezes está em cold start quando o callback dispara
    // o primeiro /me. Sem retry, o front interpretava o timeout como "auth falhou"
    // e jogava o usuário de volta no login — comportamento "às vezes não loga".
    async function loadUserWithRetry(): Promise<unknown> {
      const delays = [500, 1000, 2000];
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < delays.length + 1; attempt++) {
        try {
          const res = await fetch(`${API}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) return await res.json();
          // 401/403 são definitivos: token inválido, não adianta retry
          if (res.status === 401 || res.status === 403) {
            throw new Error("auth_invalid");
          }
          // 5xx ou network → vale tentar de novo
          lastError = new Error(`http_${res.status}`);
        } catch (e) {
          lastError = e as Error;
          if ((e as Error).message === "auth_invalid") throw e;
        }
        if (attempt < delays.length) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
        }
      }
      throw lastError ?? new Error("auth_failed");
    }

    loadUserWithRetry()
      .then(() => {
        window.location.replace("/dashboard");
      })
      .catch(() => {
        localStorage.removeItem("forbion_token");
        setError("Erro na autenticação. Tente novamente.");
      });
  }, [router]);

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "var(--c-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#EF4444", fontSize: 15 }}>{error}</p>
          <button
            onClick={() => router.push("/auth/login")}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid var(--c-border-2)",
              background: "none",
              color: "var(--c-text-2)",
              cursor: "pointer",
            }}
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--c-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "3px solid var(--c-border)",
          borderTopColor: "#0066FF",
          animation: "spin 0.7s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}