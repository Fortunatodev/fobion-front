/**
 * Configurações centralizadas do frontend.
 * Todas as variáveis de ambiente e constantes globais ficam aqui.
 * Nunca use process.env diretamente em outros arquivos — importe daqui.
 */

export const config = {
  /** URL base da API backend */
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",

  /** URL base do frontend (para links absolutos, OG, etc.) */
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",

  /** Nome da aplicação */
  appName: "Forbion",

  /** Chave do localStorage para o token JWT */
  tokenKey: "forbion_token",

  /** Chave do localStorage para dados do usuário */
  userKey: "forbion_user",

  /** Duração padrão do debounce em ms */
  debounceMs: 300,

  /** Máximo de itens por página */
  pageSize: 20,
} as const

export type Config = typeof config
