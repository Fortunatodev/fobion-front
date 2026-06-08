"use client"

import { useState } from "react"
import { apiGet, apiPost } from "@/lib/api"
import { FileText, Check, Loader2 } from "lucide-react"

/**
 * V2-B4 — Botão "Emitir NF-e" numa comanda concluída (status DONE).
 *
 * Degrada com elegância: checa /api/nfse/status só na 1ª interação (cache de
 * módulo, compartilhado por todos os botões da lista — não dispara 1 request por
 * linha). Sem PLUGNOTAS_API_KEY → mostra como ativar, não quebra. Com chave →
 * POST /api/nfse/schedule/:id e exibe o protocolo. Pronto pra ligar.
 */

// status do tenant cacheado entre montagens — 1 fetch pra lista inteira
let _statusPromise: Promise<boolean> | null = null
function fetchNfseConfigured(): Promise<boolean> {
  if (!_statusPromise) {
    _statusPromise = apiGet<{ configured: boolean }>("/nfse/status")
      .then((r) => !!r.configured)
      .catch(() => false)
  }
  return _statusPromise
}

type State = "idle" | "checking" | "emitting" | "done" | "off" | "error"

export default function NfseButton({ scheduleId }: { scheduleId: string }) {
  const [state, setState] = useState<State>("idle")
  const [msg, setMsg] = useState<string>("")

  async function handle() {
    if (state === "checking" || state === "emitting" || state === "done") return
    setState("checking")
    const configured = await fetchNfseConfigured()
    if (!configured) {
      setState("off")
      setMsg("NF-e não configurada. Defina PLUGNOTAS_API_KEY (sandbox grátis) + CNPJ da loja.")
      return
    }
    setState("emitting")
    try {
      const r = await apiPost<{ ok?: boolean; protocolo?: string; error?: string }>(
        `/nfse/schedule/${scheduleId}`,
        {},
      )
      if (r.ok) {
        setState("done")
        setMsg(r.protocolo ? `NF-e em processamento · protocolo ${r.protocolo}` : "NF-e enviada — em processamento.")
      } else {
        setState("error")
        setMsg(r.error ?? "Não foi possível emitir agora.")
      }
    } catch {
      setState("error")
      setMsg("Falha ao falar com o emissor. Tente de novo.")
    }
  }

  if (state === "done") {
    return (
      <span title={msg} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#10B981" }}>
        <Check size={12} /> NF-e enviada
      </span>
    )
  }

  const busy = state === "checking" || state === "emitting"
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}>
      <button
        onClick={handle}
        disabled={busy}
        title="Emitir nota fiscal de serviço desta comanda"
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "5px 9px", borderRadius: 8, cursor: busy ? "wait" : "pointer",
          background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.22)",
          color: "#A5B4FC", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
          whiteSpace: "nowrap",
        }}
      >
        {busy ? <Loader2 size={13} className="spin" /> : <FileText size={13} />}
        {state === "emitting" ? "Emitindo…" : "Emitir NF-e"}
      </button>
      {(state === "off" || state === "error") && msg && (
        <span style={{ fontSize: 10, color: state === "off" ? "var(--c-text-3)" : "#F87171", maxWidth: 220, lineHeight: 1.4 }}>
          {msg}
        </span>
      )}
    </span>
  )
}
