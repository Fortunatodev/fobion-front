"use client"

import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full font-medium transition-colors duration-200",
  {
    variants: {
      variant: {
        default:
          "bg-[#1A1A1A] text-[#A1A1AA] border border-[#1F1F1F]",
        primary:
          "bg-primary/10 text-primary border border-primary/20",
        success:
          "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
        warning:
          "bg-amber-500/10 text-amber-400 border border-amber-500/20",
        danger:
          "bg-red-500/10 text-red-400 border border-red-500/20",
      },
      size: {
        sm: "text-xs px-2 py-0.5",
        md: "text-xs px-2.5 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode
  className?: string
}

export default function Badge({ children, variant, size, className }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)}>
      {children}
    </span>
  )
}