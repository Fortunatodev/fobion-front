"use client"

import { type ReactNode } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const cardVariants = cva("", {
  variants: {
    variant: {
      default:
        "bg-[#111111] border border-[#1F1F1F] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.4)]",
      hover:
        "bg-[#111111] border border-[#1F1F1F] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:border-primary/20 hover:shadow-[0_4px_32px_rgba(0,102,255,0.08)] cursor-pointer transition-all duration-200",
      glass:
        "backdrop-blur-[12px] bg-[rgba(17,17,17,0.9)] border border-white/10 rounded-2xl",
    },
    padding: {
      none: "p-0",
      sm: "p-3",
      md: "p-5",
      lg: "p-6",
    },
  },
  defaultVariants: {
    variant: "default",
    padding: "md",
  },
})

interface CardProps extends VariantProps<typeof cardVariants> {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export default function Card({
  children,
  className,
  variant,
  padding,
  onClick,
}: CardProps) {
  return (
    <div
      className={cn(cardVariants({ variant, padding }), className)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick()
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}