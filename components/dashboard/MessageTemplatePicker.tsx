"use client"

import { useCallback, useEffect, useState } from "react"
import { MessageCircle, Copy, Plus, Pencil, Trash2, Check, X } from "lucide-react"
import Modal from "@/components/shared/Modal"
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api"
import { waDigits } from "@/lib/crm"
import { toast } from "sonner"

/**
 * Picker de mensagens salváveis (Estágio B). Aparece no fluxo de envio — sem aba.
 * O dono escolhe entre várias opções (renderizadas com as variáveis do cliente),
 * edita o texto pra ESTE envio, e pode editar/criar/excluir MODELOS (com {variáveis})
 * pra reusar sempre. Envia por WhatsApp (direto se tem telefone, senão picker) ou copia.
 */

interface Template {
  id: string
  context: string
  label: string
  body: string
  isDefault: boolean
}

export interface TemplateVars {
  primeiroNome?: string | null
  nomeCompleto?: string | null
  servico?: string | null
  loja?: string | null
  data?: string | null
  placa?: string | null
  valor?: string | null
  diasRestantes?: string | number | null
}

/** Mesma regra do back: {variavel} → valor, ausente vira "". */
function render(body: string, vars: TemplateVars): string {
  return body.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const value = (vars as Record<string, string | number | null | undefined>)[key]
    return value === null || value === undefined ? "" : String(value)
  })
}

const fieldStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", background: "var(--c-surface)",
  border: "1px solid var(--c-border)", borderRadius: 8, color: "var(--c-text)",
  fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
}

export default function MessageTemplatePicker({
  open, onClose, context, vars, phone, initialText, onSend,
}: {
  open: boolean
  onClose: () => void
  context: string
  vars: TemplateVars
  phone: string | null
  /** Texto inicial pronto (ex.: proposta de orçamento itemizada). Se ausente, usa o 1º modelo. */
  initialText?: string
  /** Disparado quando o dono clica em enviar/abrir o WhatsApp (ex.: marcar orçamento como enviado). */
  onSend?: () => void
}) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState("") // texto final (renderizado) deste envio
  const [editId, setEditId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")
  const [editBody, setEditBody] = useState("")
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    apiGet<{ templates: Template[] }>(`/crm/templates?context=${encodeURIComponent(context)}`)
      .then((r) => {
        const list = r.templates ?? []
        setTemplates(list)
        // Texto inicial: o pronto recebido (proposta itemizada) tem prioridade; senão o 1º modelo.
        if (initialText) setText(initialText)
        else if (list[0]) setText(render(list[0].body, vars))
      })
      .catch(() => toast.error("Não consegui carregar as mensagens."))
      .finally(() => setLoading(false))
  // vars muda a cada render; intencional usar só context+initialText (estáveis na abertura)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, initialText])

  useEffect(() => { if (open) load() }, [open, load])

  const temFone = waDigits(phone) !== null
  const num = waDigits(phone)
  const waHref = `https://wa.me/${num ?? ""}?text=${encodeURIComponent(text)}`

  async function copiar() {
    try { await navigator.clipboard.writeText(text); toast.success("Mensagem copiada!") }
    catch { toast.error("Não consegui copiar.") }
  }

  function abrirEdicao(t: Template) {
    setEditId(t.id); setEditLabel(t.label); setEditBody(t.body); setCreating(false)
  }

  function abrirNovo() {
    setCreating(true); setEditId(null); setEditLabel(""); setEditBody("")
  }

  async function salvarModelo() {
    if (!editLabel.trim() || !editBody.trim()) { toast.error("Preencha nome e mensagem."); return }
    try {
      if (creating) {
        const r = await apiPost<{ template: Template }>("/crm/templates", { context, label: editLabel.trim(), body: editBody.trim() })
        setTemplates((prev) => [...prev, r.template])
        toast.success("Modelo salvo!")
      } else if (editId) {
        await apiPatch(`/crm/templates/${editId}`, { label: editLabel.trim(), body: editBody.trim() })
        setTemplates((prev) => prev.map((t) => (t.id === editId ? { ...t, label: editLabel.trim(), body: editBody.trim() } : t)))
        toast.success("Modelo atualizado!")
      }
      setEditId(null); setCreating(false)
    } catch { toast.error("Não consegui salvar o modelo.") }
  }

  async function excluirModelo(id: string) {
    try {
      await apiDelete(`/crm/templates/${id}`)
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      toast.success("Modelo removido.")
    } catch { toast.error("Não consegui remover.") }
  }

  const editandoOuCriando = creating || editId !== null

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Escolher mensagem" description="Toque numa opção, ajuste o texto e envie. Você pode salvar suas próprias mensagens.">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Lista de modelos */}
        {loading ? (
          <p style={{ fontSize: 13, color: "var(--c-text-3)" }}>Carregando mensagens…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
            {templates.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--c-border)", background: "var(--c-bg)" }}>
                <button
                  type="button"
                  onClick={() => setText(render(t.body, vars))}
                  style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text)" }}>{t.label}</span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--c-text-3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {render(t.body, vars)}
                  </span>
                </button>
                <button type="button" onClick={() => abrirEdicao(t)} title="Editar modelo" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-4)", padding: 2 }}><Pencil size={14} /></button>
                {!t.isDefault && (
                  <button type="button" onClick={() => excluirModelo(t.id)} title="Remover modelo" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-4)", padding: 2 }}><Trash2 size={14} /></button>
                )}
              </div>
            ))}
            {!editandoOuCriando && (
              <button type="button" onClick={abrirNovo} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8, background: "transparent", border: "1px dashed var(--c-border)", color: "var(--c-text-3)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                <Plus size={14} /> Salvar uma mensagem minha
              </button>
            )}
          </div>
        )}

        {/* Editor de modelo (criar/editar o corpo com {variáveis}) */}
        {editandoOuCriando && (
          <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--c-text-4)", textTransform: "uppercase", margin: 0 }}>{creating ? "Nova mensagem" : "Editar mensagem"}</p>
            <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Nome (ex.: Retorno especial)" style={{ ...fieldStyle, height: 34 }} />
            <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} placeholder="Use {primeiroNome}, {servico}, {loja}, {placa}…" style={{ ...fieldStyle, minHeight: 70, resize: "vertical" }} />
            <p style={{ fontSize: 10, color: "var(--c-text-4)", margin: 0 }}>Variáveis: {"{primeiroNome} {nomeCompleto} {servico} {loja} {data} {placa} {valor}"}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={salvarModelo} style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px", borderRadius: 8, background: "#0066FF", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Check size={15} /> Salvar</button>
              <button type="button" onClick={() => { setEditId(null); setCreating(false) }} style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 8, background: "transparent", border: "1px solid var(--c-border)", color: "var(--c-text-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}><X size={15} /> Cancelar</button>
            </div>
          </div>
        )}

        {/* Texto final do envio (editável só pra este disparo) */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--c-text-4)", textTransform: "uppercase", margin: "0 0 6px" }}>Mensagem a enviar</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} style={{ ...fieldStyle, minHeight: 90, resize: "vertical" }} />
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--c-border)", marginTop: 18, paddingTop: 18, display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 10 }}>
        <button type="button" onClick={copiar} style={{ display: "flex", alignItems: "center", gap: 7, height: 42, padding: "0 16px", borderRadius: 10, background: "transparent", border: "1px solid var(--c-border)", color: "var(--c-text-2)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          <Copy size={16} /> Copiar
        </button>
        <a href={waHref} target="_blank" rel="noopener noreferrer" onClick={() => { onSend?.(); onClose() }} style={{ display: "flex", alignItems: "center", gap: 7, height: 42, padding: "0 18px", borderRadius: 10, background: "rgba(16,185,129,0.14)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
          <MessageCircle size={17} /> {temFone ? "Enviar no WhatsApp" : "Abrir WhatsApp"}
        </a>
      </div>
    </Modal>
  )
}
