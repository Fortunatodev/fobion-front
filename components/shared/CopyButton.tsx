"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface CopyButtonProps {
  value: string
  label?: string
  className?: string
}

export default function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success("Link copiado!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Não foi possível copiar.")
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm transition-colors duration-200",
        copied ? "text-emerald-400" : "text-[#A1A1AA] hover:text-white",
        className
      )}
      type="button"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {label && <span>{label}</span>}
    </button>
  )
}