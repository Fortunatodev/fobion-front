/**
 * Fetch único da loja pública (GET /api/public/:slug) com cache de promise
 * por slug a nível de módulo (TTL 60s).
 *
 * Hoje layout.tsx, page.tsx e agendar/page.tsx da rota /[slug] disparavam
 * cada um o próprio fetch do MESMO endpoint. Este helper deduplica: a
 * primeira chamada cria a promise, as seguintes (mesmo slug, dentro do TTL)
 * reaproveitam — inclusive na navegação vitrine → /agendar.
 *
 * Shape da resposta (unificado a partir dos 3 consumidores):
 *   - normal:  { business: {...} }
 *   - legado:  objeto da loja direto no corpo (agendar fazia `data.business ?? data`)
 *   - legado:  ownerAvatarUrl no topo do corpo (layout fazia fallback `d?.ownerAvatarUrl`)
 *
 * Contrato de retorno:
 *   - 200       → PublicBusinessData
 *   - 404       → null (loja não existe; também cacheado pelo TTL)
 *   - outro !ok → throw PublicBusinessHttpError (entrada sai do cache p/ retry)
 *   - rede      → throw TypeError do fetch (entrada sai do cache p/ retry)
 */

import type { PublicBusiness } from "@/types"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
const TTL_MS = 60_000

/** Loja pública + extras que a API envia e a vitrine usa (avatar do dono, cor do tema). */
export type PublicBusinessData = PublicBusiness & {
  ownerAvatarUrl?: string | null
  themeColor?: string | null
}

/** Erro HTTP ≠ 404 — permite ao consumidor distinguir "servidor com problema" de "sem rede". */
export class PublicBusinessHttpError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`Erro ao carregar loja (HTTP ${status})`)
    this.name = "PublicBusinessHttpError"
    this.status = status
  }
}

type PublicBusinessResponse = Partial<PublicBusinessData> & {
  business?: PublicBusinessData
  ownerAvatarUrl?: string | null
}

interface CacheEntry {
  promise: Promise<PublicBusinessData | null>
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

async function doFetch(slug: string): Promise<PublicBusinessData | null> {
  const res = await fetch(`${API}/api/public/${slug}`)
  if (res.status === 404) return null
  if (!res.ok) throw new PublicBusinessHttpError(res.status)

  const data = (await res.json()) as PublicBusinessResponse
  const biz = data.business ?? (data as PublicBusinessData)
  return {
    ...biz,
    // compat: algumas respostas trazem ownerAvatarUrl no topo do corpo
    ownerAvatarUrl: biz.ownerAvatarUrl ?? data.ownerAvatarUrl ?? null,
  }
}

export function fetchPublicBusiness(slug: string): Promise<PublicBusinessData | null> {
  const now = Date.now()
  const hit = cache.get(slug)
  if (hit && hit.expiresAt > now) return hit.promise

  const promise = doFetch(slug)
  cache.set(slug, { promise, expiresAt: now + TTL_MS })

  // Falha (HTTP ≠ 404 ou rede) não fica cacheada — próxima chamada tenta de novo.
  promise.catch(() => {
    if (cache.get(slug)?.promise === promise) cache.delete(slug)
  })

  return promise
}
