import type { PlanStatus } from "@/types"

/**
 * Acesso PRO da loja — FONTE ÚNICA do gating no front. Usa o `effectiveTier` que o
 * backend resolve (/auth/me), NÃO o `plan`. Por quê: todo pagante é plan="PRO"
 * (Essencial/Pro/Premium se distinguem pelo tier), então `plan === "PRO"` liberava
 * indevidamente o Essencial-pagante e não dava PRO ao trial. effectiveTier já trata:
 * trial ativo → "pro" (reverse trial), pago-essencial → "essencial", PRO/Premium → topo.
 *
 * Sem effectiveTier (carregando / resposta antiga) → false (mostra o gate; corrige no
 * próximo fetch). Nunca libera PRO por engano.
 */
export function hasProAccess(planStatus: PlanStatus | null | undefined): boolean {
  const t = planStatus?.effectiveTier
  return t === "pro" || t === "premium"
}
