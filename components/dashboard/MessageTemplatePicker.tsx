"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MessageCircle, Copy, Plus, Pencil, Trash2, Check, X, Zap, Smile, Heart, CheckCheck, Sparkles } from "lucide-react"
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

/** Variáveis que o dono pode inserir no editor de modelo (clicáveis). */
const VAR_CHIPS = ["primeiroNome", "servico", "loja", "data", "placa", "valor"] as const

/** Ícone + cor por "tom" da mensagem, inferido pelo nome do modelo (deixa a lista escaneável). */
function toneMeta(label: string): { Icon: typeof MessageCircle; color: string } {
  const l = label.toLowerCase()
  if (l.includes("emoji")) return { Icon: Smile, color: "#F59E0B" }
  if (l.includes("direto")) return { Icon: Zap, color: "#0EA5E9" }
  if (l.includes("gentil") || l.includes("carinho")) return { Icon: Heart, color: "#EC4899" }
  return { Icon: MessageCircle, color: "#7C3AED" }
}

/** Hora atual HH:MM pra prévia do balão (visual). */
function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
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
  const [selectedId, setSelectedId] = useState<string | null>(null) // modelo destacado
  const [editId, setEditId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")
  const [editBody, setEditBody] = useState("")
  const [creating, setCreating] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)

  // vars/initialText sempre ATUAIS via ref: o load roda na abertura, mas o picker
  // reabre pra outro cliente sem trocar de context — sem a ref, o closure capturava
  // as variáveis do cliente ANTERIOR (texto saía vazio/errado). Bug P1.4/P1.5.
  const varsRef = useRef(vars)
  const initialTextRef = useRef(initialText)
  // Mantém os refs em dia FORA do render (efeito sem deps = roda a cada commit,
  // antes do efeito de abertura abaixo, então o load() lê sempre o valor atual).
  useEffect(() => {
    varsRef.current = vars
    initialTextRef.current = initialText
  })

  const load = useCallback(() => {
    setLoading(true)
    // Reseta o editor de modelo a cada abertura (senão reabre pré-preenchido no
    // modelo da vez anterior — bug P2.6).
    setEditId(null); setCreating(false); setEditLabel(""); setEditBody("")
    apiGet<{ templates: Template[] }>(`/crm/templates?context=${encodeURIComponent(context)}`)
      .then((r) => {
        const list = r.templates ?? []
        setTemplates(list)
        // Texto inicial: o pronto recebido (proposta itemizada) tem prioridade; senão o 1º modelo.
        // Usa os refs pra pegar as variáveis do cliente ATUAL, não as da abertura anterior.
        if (initialTextRef.current) { setText(initialTextRef.current); setSelectedId(null) }
        else if (list[0]) { setText(render(list[0].body, varsRef.current)); setSelectedId(list[0].id) }
      })
      .catch(() => toast.error("Não consegui carregar as mensagens."))
      .finally(() => setLoading(false))
  }, [context])

  // eslint-disable-next-line react-hooks/set-state-in-effect
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

  function selecionar(t: Template) {
    setSelectedId(t.id)
    setText(render(t.body, varsRef.current))
  }

  // Insere {variavel} na posição do cursor do editor de modelo.
  function inserirVar(name: string) {
    const el = bodyRef.current
    const token = `{${name}}`
    if (!el) { setEditBody((b) => b + token); return }
    const start = el.selectionStart ?? editBody.length
    const end = el.selectionEnd ?? editBody.length
    setEditBody((b) => b.slice(0, start) + token + b.slice(end))
    requestAnimationFrame(() => { el.focus(); const p = start + token.length; el.setSelectionRange(p, p) })
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

  const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--c-text-4)", textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }
  const clamp2: React.CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 12, lineHeight: 1.45, color: "var(--c-text-3)", margin: "3px 0 0", wordBreak: "break-word" }
  const lojaNome = (vars.loja && String(vars.loja).trim()) || "Sua loja"

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Escolher mensagem" description="Escolha um modelo, ajuste o texto e veja a prévia antes de enviar.">
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* ── MODELOS ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={sectionLabel}>Modelos prontos</p>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[0, 1, 2].map((i) => <div key={i} style={{ height: 60, borderRadius: 12, background: "var(--c-surface)", border: "1px solid var(--c-border)", opacity: 0.5 }} />)}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 232, overflowY: "auto", paddingRight: 2 }}>
              {templates.map((t) => {
                const { Icon, color } = toneMeta(t.label)
                const active = selectedId === t.id
                return (
                  <div
                    key={t.id}
                    style={{
                      display: "flex", alignItems: "stretch", gap: 8, padding: "11px 12px", borderRadius: 12,
                      border: `1.5px solid ${active ? color : "var(--c-border)"}`,
                      background: active ? `${color}14` : "var(--c-bg)",
                      boxShadow: active ? `0 0 0 3px ${color}22` : "none",
                      transition: "border-color .15s, background .15s, box-shadow .15s",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => selecionar(t)}
                      style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start", gap: 10, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                    >
                      <span style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 9, background: `${color}1f`, border: `1px solid ${color}3a`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
                        <Icon size={16} />
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</span>
                          {t.isDefault && <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--c-text-4)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 5, padding: "1px 5px", flexShrink: 0 }}>PRONTO</span>}
                          {active && <Check size={14} color={color} style={{ marginLeft: "auto", flexShrink: 0 }} />}
                        </span>
                        <span style={clamp2}>{render(t.body, vars)}</span>
                      </span>
                    </button>
                    <span style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, justifyContent: "center" }}>
                      <button type="button" onClick={() => abrirEdicao(t)} title="Editar modelo" style={{ width: 28, height: 28, borderRadius: 7, background: "transparent", border: "1px solid var(--c-border)", cursor: "pointer", color: "var(--c-text-3)", display: "flex", alignItems: "center", justifyContent: "center" }}><Pencil size={13} /></button>
                      {!t.isDefault && (
                        <button type="button" onClick={() => excluirModelo(t.id)} title="Remover modelo" style={{ width: 28, height: 28, borderRadius: 7, background: "transparent", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer", color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={13} /></button>
                      )}
                    </span>
                  </div>
                )
              })}
              {!editandoOuCriando && (
                <button type="button" onClick={abrirNovo} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px", borderRadius: 12, background: "transparent", border: "1.5px dashed var(--c-border-2)", color: "var(--c-text-3)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  <Plus size={15} /> Criar minha mensagem
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── EDITOR DE MODELO (criar/editar com {variáveis}) ── */}
        {editandoOuCriando && (
          <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ ...sectionLabel, color: "#0066FF" }}>{creating ? "Nova mensagem" : "Editar mensagem"}</p>
            <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Nome (ex.: Retorno especial)" style={{ ...fieldStyle, height: 36 }} />
            <textarea ref={bodyRef} value={editBody} onChange={(e) => setEditBody(e.target.value)} placeholder="Use {primeiroNome}, {servico}, {loja}…" style={{ ...fieldStyle, minHeight: 72, resize: "vertical", lineHeight: 1.5 }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--c-text-4)" }}>Inserir:</span>
              {VAR_CHIPS.map((v) => (
                <button key={v} type="button" onClick={() => inserirVar(v)} style={{ fontSize: 11, fontWeight: 600, color: "#0066FF", background: "rgba(0,102,255,0.08)", border: "1px solid rgba(0,102,255,0.2)", borderRadius: 999, padding: "3px 9px", cursor: "pointer", fontFamily: "inherit" }}>
                  {"{" + v + "}"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={salvarModelo} style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 16px", borderRadius: 9, background: "#0066FF", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Check size={15} /> Salvar modelo</button>
              <button type="button" onClick={() => { setEditId(null); setCreating(false) }} style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", borderRadius: 9, background: "transparent", border: "1px solid var(--c-border)", color: "var(--c-text-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}><X size={15} /> Cancelar</button>
            </div>
          </div>
        )}

        {/* ── SUA MENSAGEM (editável só pra este envio) ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <p style={sectionLabel}>Sua mensagem</p>
            <span style={{ fontSize: 11, color: text.length > 700 ? "#F59E0B" : "var(--c-text-4)", fontVariantNumeric: "tabular-nums" }}>{text.length} caracteres</span>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} style={{ ...fieldStyle, minHeight: 88, resize: "vertical", lineHeight: 1.5 }} />
        </div>

        {/* ── PRÉVIA DO WHATSAPP (o diferencial: o dono vê o que o cliente recebe) ── */}
        <div>
          <p style={{ ...sectionLabel, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={12} color="#10B981" /> Prévia no WhatsApp</p>
          <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--c-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "#1F2C33" }}>
              <span style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,#25D366,#128C7E)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <MessageCircle size={14} color="#fff" />
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#E9EDEF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{lojaNome}</span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#8696A0", border: "1px solid #2A3942", borderRadius: 5, padding: "1px 6px", flexShrink: 0 }}>PRÉVIA</span>
            </div>
            <div style={{ background: "#0B141A", padding: "16px 12px", display: "flex", justifyContent: "flex-end", minHeight: 64 }}>
              <div style={{ maxWidth: "82%", background: "#005C4B", borderRadius: "10px 4px 10px 10px", padding: "7px 10px 5px", boxShadow: "0 1px 1px rgba(0,0,0,0.25)" }}>
                <p style={{ fontSize: 13.5, lineHeight: 1.45, color: "#E9EDEF", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {text.trim() || <span style={{ color: "#8696A0" }}>Sua mensagem aparece aqui…</span>}
                </p>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3, marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: "#8696A0" }}>{nowHHMM()}</span>
                  <CheckCheck size={13} color="#53BDEB" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--c-border)", marginTop: 18, paddingTop: 18, display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 10 }}>
        <button type="button" onClick={copiar} style={{ display: "flex", alignItems: "center", gap: 7, height: 44, padding: "0 18px", borderRadius: 11, background: "transparent", border: "1px solid var(--c-border-2)", color: "var(--c-text-2)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          <Copy size={16} /> Copiar
        </button>
        <a href={waHref} target="_blank" rel="noopener noreferrer" onClick={() => { onSend?.(); onClose() }} style={{ display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 22px", borderRadius: 11, background: "#25D366", border: "none", color: "#0A0A0A", fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 16px rgba(37,211,102,0.32)" }}>
          <MessageCircle size={17} /> {temFone ? "Enviar no WhatsApp" : "Abrir WhatsApp"}
        </a>
      </div>
    </Modal>
  )
}
