"use client"

import { type ReactNode } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const sizeMap = {
  sm: "max-w-[400px]",
  md: "max-w-[520px]",
  lg: "max-w-[640px]",
  xl: "max-w-[800px]",
  full: "max-w-[95vw]",
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
            "w-full p-6",
            "backdrop-blur-[12px] bg-[rgba(17,17,17,0.95)] border border-white/10 rounded-2xl",
            "max-h-[90vh] overflow-y-auto",
            "shadow-[0_24px_80px_rgba(0,0,0,0.8)]",
            "animate-in fade-in zoom-in-95 duration-200",
            sizeMap[size]
          )}
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-5">
            <div>
              <Dialog.Title className="text-lg font-semibold text-white">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-sm text-[#A1A1AA] mt-0.5">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#A1A1AA] hover:text-white hover:bg-[#1A1A1A] transition-colors duration-200 ml-4 shrink-0"
              onClick={onClose}
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          {/* Body */}
          {children}

          {/* Footer */}
          {footer && (
            <div className="border-t border-[#1F1F1F] mt-5 pt-5 flex justify-end gap-3">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}