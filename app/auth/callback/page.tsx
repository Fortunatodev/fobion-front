"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken } from "@/lib/auth";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error || !token) {
      router.replace(`/auth/login?error=${error ?? "auth_failed"}`);
      return;
    }

    // setToken salva no localStorage E no cookie (para o middleware)
    setToken(token);
    router.replace("/dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← VAZIO — roda só uma vez

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0A0A",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "3px solid #1F1F1F",
          borderTopColor: "#0066FF",
          animation: "spin 0.7s linear infinite",
        }}
      />
      <p style={{ color: "#52525B", fontSize: 14 }}>
        Entrando no painel...
      </p>
    </div>
  );
}