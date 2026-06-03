"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { User, Phone, Mail, MessageCircle, AlertCircle } from "lucide-react"
import Modal from "@/components/shared/Modal"
import Input from "@/components/shared/Input"
import Switch from "@/components/shared/Switch"

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomerDraft {
  name: string
  phone: string
  email?: string | null
  allowWhatsApp?: boolean
}

interface RichCustomerModalProps {
  open: boolean
  onClose: () => void
  mode: "create" | "edit"
  initialData?: CustomerDraft | null
  onSubmit: (payload: {
    name: string
    phone: string
    email?: string
    allowWhatsApp: boolean
  }) => void | Promise<void>
  loading?: boolean
  serverError?: string | null
}

// ── Validation rules ──────────────────────────────────────────────────────────

function validateName(name: string): string | undefined {
  const trimmed = name.trim()
  if (!trimmed) return "Nome é obrigatório"
  if (trimmed.length < 2) return "Mínimo 2 caracteres"
  if (/[0-9]/.test(trimmed)) return "Nome não pode conter números"
  return undefined
}

function validatePhone(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, "")
  if (!digits) return "Telefone é obrigatório"
  if (digits.length < 10) return "Mínimo 10 dígitos"
  if (digits.length > 11) return "Máximo 11 dígitos"
  // Valid DDD (11-99)
  const ddd = parseInt(digits.slice(0, 2), 10)
  if (ddd < 11 || ddd > 99) return "DDD inválido"
  return undefined
}

function validateEmail(email: string): string | undefined {
  if (!email) return undefined
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "E-mail inválido"
  return undefined
}

// ── Phone formatter ───────────────────────────────────────────────────────────

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RichCustomerModal({
  open,
  onClose,
  mode,
  initialData,
  onSubmit,
  loading = false,
  serverError,
}: RichCustomerModalProps) {
  // ── Form state ─────────────────────────────────────────────────────────────
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [allowWhatsApp, setAllowWhatsApp] = useState(true)

  // Track which fields have been touched (for inline validation)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // ── Init / reset ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      if (initialData) {
        setName(initialData.name)
        setPhone(initialData.phone)
        setEmail(initialData.email ?? "")
        setAllowWhatsApp(initialData.allowWhatsApp ?? true)
      } else {
        setName("")
        setPhone("")
        setEmail("")
        setAllowWhatsApp(true)
      }
      setTouched({})
    }
  }, [open, initialData])

  // ── Inline errors (computed) ──────────────────────────────────────────────
  const nameError = touched.name ? validateName(name) : undefined
  const phoneError = touched.phone ? validatePhone(phone) : undefined
  const emailError = touched.email ? validateEmail(email) : undefined

  // ── Progressive disclosure triggers ────────────────────────────────────────
  const nameValid = !validateName(name) && name.trim().length >= 2
  const phoneValid = !validatePhone(phone) && phone.replace(/\D/g, "").length >= 10

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleBlur = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }, [])

  const handlePhoneChange = useCallback((value: string) => {
    setPhone(formatPhone(value))
  }, [])

  const handleSubmit = useCallback(async () => {
    // Touch all fields so validation shows
    setTouched({ name: true, phone: true, email: true })

    const nErr = validateName(name)
    const pErr = validatePhone(phone)
    const eErr = validateEmail(email)

    if (nErr || pErr || eErr) return

    await onSubmit({
      name: name.trim(),
      phone: phone.replace(/\D/g, ""),
      email: email.trim() || undefined,
      allowWhatsApp,
    })
  }, [name, phone, email, allowWhatsApp, onSubmit])

  const title = mode === "create" ? "Novo cliente" : "Editar cliente"
  const description = mode === "create"
    ? "Preencha os dados do cliente. Mostramos apenas o que for necessário."
    : `Atualize os dados de ${initialData?.name ?? ""}.`

  // ── Derived footer ──────────────────────────────────────────────────────────
  const isFormValid = !validateName(name) && !validatePhone(phone) && !validateEmail(email)

  const footer = (
    <div className="flex items-center justify-between w-full">
      <button
        type="button"
        onClick={onClose}
        disabled={loading}
        className="h-10 px-5 rounded-xl text-sm font-semibold text-[#A1A1AA] border border-[#252525] hover:text-white hover:border-[#3F3F46] transition-colors duration-200 disabled:opacity-50"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || !isFormValid}
        className="h-10 px-5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#0066FF] to-[#7C3AED] hover:opacity-90 transition-opacity duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {loading && (
          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
        )}
        {mode === "create" ? (loading ? "Criando..." : "Criar cliente") : (loading ? "Salvando..." : "Salvar alterações")}
      </button>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="md"
      footer={footer}
    >
      <div className="flex flex-col gap-5">

        {/* Server error banner */}
        {serverError && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3.5 py-2.5">
            <AlertCircle size={14} className="text-red-400 shrink-0" />
            <span className="text-xs text-red-400">{serverError}</span>
          </div>
        )}

        {/* ── Step 1: Name (always visible) ───────────────────────── */}
        <div className="flex flex-col gap-1.5">
          <Input
            label="Nome completo"
            placeholder="João da Silva"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => handleBlur("name")}
            error={nameError}
            leftIcon={<User size={16} />}
            disabled={loading}
          />
          {!nameError && name.trim().length > 0 && (
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="inline-block w-1 h-1 rounded-full bg-emerald-400" />
              Nome válido
            </span>
          )}
        </div>

        {/* ── Step 2: Phone + WhatsApp toggle (revealed when name valid) ── */}
        <div
          className={`flex flex-col gap-5 transition-all duration-300 ease-out ${
            nameValid ? "opacity-100 translate-y-0 max-h-60" : "opacity-0 -translate-y-2 max-h-0 overflow-hidden pointer-events-none"
          }`}
        >
          <div className="flex flex-col gap-1.5">
            <Input
              label="Telefone"
              placeholder="(47) 99999-0000"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              onBlur={() => handleBlur("phone")}
              error={phoneError}
              leftIcon={<Phone size={16} />}
              disabled={loading}
              inputMode="tel"
            />
            {!phoneError && phone.replace(/\D/g, "").length >= 10 && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="inline-block w-1 h-1 rounded-full bg-emerald-400" />
                Telefone válido
              </span>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-[#111111] border border-[#1F1F1F] px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <MessageCircle size={16} className="text-[#10B981]" />
              <span className="text-sm text-white">Recebe mensagens no WhatsApp</span>
            </div>
            <Switch
              checked={allowWhatsApp}
              onCheckedChange={setAllowWhatsApp}
              disabled={loading}
            />
          </div>
        </div>

        {/* ── Step 3: Email (revealed when phone valid) ───────────── */}
        <div
          className={`transition-all duration-300 ease-out ${
            phoneValid ? "opacity-100 translate-y-0 max-h-40" : "opacity-0 -translate-y-2 max-h-0 overflow-hidden pointer-events-none"
          }`}
        >
          <div className="flex flex-col gap-1.5">
            <Input
              label="E-mail (opcional)"
              placeholder="cliente@email.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => handleBlur("email")}
              error={emailError}
              leftIcon={<Mail size={16} />}
              disabled={loading}
              hint="Usado para notificações e acesso ao portal do cliente"
            />
          </div>
        </div>

        {/* ── Summary chip (progressive completeness) ─────────────── */}
        <div className="flex flex-wrap gap-2 pt-1">
          <CompletionChip done={nameValid} label="Nome" />
          <CompletionChip done={phoneValid} label="Telefone" />
          <CompletionChip done={email.length === 0 || !emailError} label="E-mail" optional />
        </div>
      </div>
    </Modal>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CompletionChip({ done, label, optional }: { done: boolean; label: string; optional?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors duration-200 ${
        done
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          : "bg-[#161616] border-[#1F1F1F] text-[#52525B]"
      }`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${done ? "bg-emerald-400" : "bg-[#52525B]"}`} />
      {label}
      {optional && <span className="text-[10px] opacity-60">opcional</span>}
    </span>
  )
}
