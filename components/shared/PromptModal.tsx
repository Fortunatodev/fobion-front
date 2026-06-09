"use client"

import { useEffect, useRef, useState } from "react"
import Modal from "./Modal"
import Input from "./Input"
import Button from "./Button"

/**
 * Modal de entrada (substitui window.prompt). Reutilizável: texto ou número, com
 * validação opcional, foco automático e submit no Enter. Tema dark via var(--c-*).
 */
interface PromptModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (value: string) => void
  title: string
  description?: string
  label?: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  cancelLabel?: string
  type?: "text" | "number"
  min?: number
  max?: number
  loading?: boolean
  /** Retorna mensagem de erro (string) se inválido, ou null se ok. */
  validate?: (value: string) => string | null
}

export default function PromptModal({
  open,
  onClose,
  onSubmit,
  title,
  description,
  label,
  placeholder,
  defaultValue = "",
  confirmLabel = "Salvar",
  cancelLabel = "Cancelar",
  type = "text",
  min,
  max,
  loading = false,
  validate,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    // reset ao abrir (padrão do codebase p/ modais controlados)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(defaultValue)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null)
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open, defaultValue])

  function handleSubmit() {
    const v = value.trim()
    const err = validate ? validate(v) : v ? null : "Preencha o campo."
    if (err) {
      setError(err)
      return
    }
    onSubmit(v)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Input
        ref={inputRef}
        label={label}
        type={type}
        inputMode={type === "number" ? "numeric" : undefined}
        min={min}
        max={max}
        placeholder={placeholder}
        value={value}
        error={error ?? undefined}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit()
        }}
      />
    </Modal>
  )
}
