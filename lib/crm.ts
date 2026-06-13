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

/**
 * Link wa.me com mensagem contextual pro motivo do contato. Normaliza o telefone
 * (dígitos + DDI 55). Retorna null se não houver telefone válido.
 */
export function buildWaLink(item: Pick<FilaItem, "tipo" | "nome" | "phone" | "motivo">): string | null {
  if (!item.phone) return null
  const digits = item.phone.replace(/\D/g, "")
  if (digits.length < 10) return null
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`
  const nome = firstName(item.nome)
  const oi = nome ? `Oi, ${nome}!` : "Oi!"

  let msg: string
  switch (item.tipo) {
    case "recall":
      msg = `${oi} Passando pra lembrar que está chegando a hora de cuidar do seu carro de novo. Quer que eu já reserve um horário pra você?`
      break
    case "follow_up":
      msg = `${oi} Tudo bem? Passando pra falar com você como combinei. Quando fica bom pra agendar?`
      break
    case "pos_servico":
      msg = `${oi} Como ficou seu carro depois do nosso serviço? Sua opinião ajuda demais — e se precisar de qualquer ajuste é só falar!`
      break
    case "inativo":
    case "perdido":
      msg = `${oi} Faz um tempinho que a gente não cuida do seu carro por aqui. Que tal agendar uma passada? Tô com horário essa semana 😉`
      break
    case "aniversario":
      msg = `${oi} Feliz aniversário! 🎉 Que tal comemorar deixando seu carro brilhando? Tenho um mimo especial pra você esse mês.`
      break
    default:
      msg = `${oi} Tudo bem?`
  }
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(msg)}`
}
