// Tipos + helpers do CRM de relacionamento (aba "Relacionamento").

export type FilaTipo =
  | "recall"
  | "inativo"
  | "perdido"
  | "aniversario"
  | "pos_servico"
  | "follow_up"

export interface FilaItem {
  tipo: FilaTipo
  customerId: string
  nome: string
  phone: string | null
  motivo: string
  contexto: string
  prioridade: number
  refId: string
  dueISO: string | null
  serviceId?: string | null
}

export interface FilaCounts {
  recall: number
  inativo: number
  perdido: number
  aniversario: number
  pos_servico: number
  follow_up: number
}

export interface FilaResponse {
  itens: FilaItem[]
  counts: FilaCounts
  total: number
}

/** Rótulo + cor por tipo (faixa do card + chip de filtro). */
export const TIPO_META: Record<FilaTipo, { label: string; color: string }> = {
  recall:      { label: "Retorno",        color: "#10B981" },
  follow_up:   { label: "Follow-up",      color: "#0066FF" },
  pos_servico: { label: "Avaliação",      color: "#7C3AED" },
  inativo:     { label: "Inativo",        color: "#F59E0B" },
  perdido:     { label: "Perdido",        color: "#EF4444" },
  aniversario: { label: "Aniversário",    color: "#EC4899" },
}

function firstName(nome: string): string {
  return nome?.split(" ").filter(Boolean)[0] ?? ""
}

/** Mensagem contextual de WhatsApp pro motivo do contato (sem depender de telefone). */
export function waMessage(item: Pick<FilaItem, "tipo" | "nome">): string {
  const nome = firstName(item.nome)
  const oi = nome ? `Oi, ${nome}!` : "Oi!"
  switch (item.tipo) {
    case "recall":
      return `${oi} Passando pra lembrar que está chegando a hora de cuidar do seu carro de novo. Quer que eu já reserve um horário pra você?`
    case "follow_up":
      return `${oi} Tudo bem? Passando pra falar com você como combinei. Quando fica bom pra agendar?`
    case "pos_servico":
      return `${oi} Como ficou seu carro depois do nosso serviço? Sua opinião ajuda demais — e se precisar de qualquer ajuste é só falar!`
    case "inativo":
    case "perdido":
      return `${oi} Faz um tempinho que a gente não cuida do seu carro por aqui. Que tal agendar uma passada? Tô com horário essa semana 😉`
    case "aniversario":
      return `${oi} Feliz aniversário! 🎉 Que tal comemorar deixando seu carro brilhando? Tenho um mimo especial pra você esse mês.`
    default:
      return `${oi} Tudo bem?`
  }
}

/** Só os dígitos com DDI 55, ou null se telefone inválido.
 *  Decide DDI por COMPRIMENTO, não por startsWith("55") — senão um número de
 *  DDD 55 (Santa Maria/RS), ex.: 55 99999-8888, seria tratado como se já tivesse
 *  DDI e ficaria sem o 55 nacional. 10/11 díg = nacional (prepend 55); 12/13 = com DDI. */
export function waDigits(phone: string | null | undefined): string | null {
  if (!phone) return null
  const d = phone.replace(/\D/g, "")
  if (d.length < 10) return null
  if (d.length === 10 || d.length === 11) return `55${d}`
  return d
}

/**
 * Link de WhatsApp pro contato.
 * - Com telefone válido → wa.me/<numero>?text=... (abre direto na conversa do cliente).
 * - Sem telefone → wa.me/?text=... (abre o WhatsApp pro dono escolher o contato).
 * Use `waMessage` + CopyButton pra dar a opção de copiar a mensagem.
 */
export function buildWaLink(item: Pick<FilaItem, "tipo" | "nome" | "phone">): string {
  const msg = encodeURIComponent(waMessage(item))
  const num = waDigits(item.phone)
  return num ? `https://wa.me/${num}?text=${msg}` : `https://wa.me/?text=${msg}`
}

/** true se há telefone válido (link abre direto na conversa). */
export function hasPhone(phone: string | null | undefined): boolean {
  return waDigits(phone) !== null
}
