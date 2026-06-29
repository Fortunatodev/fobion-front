/**
 * Decodifica o PAYLOAD de um JWT (sem verificar assinatura — só pra ler exp/nome no client),
 * de forma UTF-8-SAFE.
 *
 * Bug que isto corrige: `atob()` devolve uma "binary string" onde cada caractere é 1 byte
 * (Latin-1). Um nome acentuado vai no token como UTF-8 multibyte (ex.: "í" = bytes C3 AD);
 * lido como Latin-1 vira "Ã­" → "Vinícius" aparecia como "VinÃ­cius" na área do cliente.
 * Aqui pegamos os bytes do atob e reinterpretamos como UTF-8 (TextDecoder).
 */
export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const part = token.split(".")[1]
    if (!part) return null
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/")
    const bin = atob(b64)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const json = new TextDecoder("utf-8").decode(bytes)
    return JSON.parse(json) as T
  } catch {
    return null
  }
}
