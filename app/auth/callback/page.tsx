"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");

    console.log("[auth callback] token query:", token?.slice(0, 20));

    if (!token) {
      setError("Erro na autenticação. Tente novamente.");
      return;
    }

    localStorage.setItem("forbion_token", token);

    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("auth_failed");
        return res.json();
      })
      .then(() => {
        router.replace("/dashboard");
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
          backgroundColor: "#0A0A0A",
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
              border: "1px solid #2A2A2A",
              background: "none",
              color: "#A1A1AA",
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
        backgroundColor: "#0A0A0A",
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
          border: "3px solid #1F1F1F",
          borderTopColor: "#0066FF",
          animation: "spin 0.7s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}