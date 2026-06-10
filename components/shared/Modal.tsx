"use client"

import { type ReactNode } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

// Largura máxima por tamanho (em px) — usada inline pra garantir aplicação.
const sizeMaxPx: Record<string, string> = {
  sm: "440px",
  md: "520px",
  lg: "640px",
  xl: "800px",
  full: "95vw",
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  size?: "sm" | "md" | "lg" | "xl" | "full"
  children: ReactNode
  footer?: ReactNode
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50",
            "-translate-x-1/2 -translate-y-1/2",
            "animate-in fade-in zoom-in-95 duration-200"
          )}
          // Padding/largura via inline (garantido: o p-6 do Tailwind não estava surtindo
          // efeito aqui — conteúdo ficava colado nas bordas, botão "Salvar" cortado).
          // Largura responsiva: nunca cola na borda da tela no mobile.
          style={{
            width: `min(${sizeMaxPx[size]}, calc(100vw - 32px))`,
            maxHeight: "90vh",
            overflowY: "auto",
            padding: 24,
            boxSizing: "border-box",
            background: "var(--c-elevated)",
            border: "1px solid var(--c-border)",
            borderRadius: 16,
            boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          }}
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-5">
            <div>
              <Dialog.Title className="text-lg font-semibold text-[var(--c-text)]">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-sm text-[var(--c-text-2)] mt-0.5">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-border)] transition-colors duration-200 ml-4 shrink-0"
              onClick={onClose}
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          {/* Body */}
          {children}

          {/* Footer — flex-wrap + inline pra nunca cortar os botões (web e mobile) */}
          {footer && (
            <div
              style={{
                borderTop: "1px solid var(--c-border)",
                marginTop: 20,
                paddingTop: 20,
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "flex-end",
                gap: 12,
              }}
            >
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}