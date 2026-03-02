"use client"

import { type ReactNode, forwardRef } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-primary hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(0,102,255,0.2)] hover:shadow-[0_0_30px_rgba(0,102,255,0.3)]",
        secondary:
          "bg-[#1A1A1A] hover:bg-[#2F2F2F] text-white border border-[#2F2F2F] hover:border-[#3F3F3F]",
        ghost:
          "hover:bg-[#1A1A1A] text-[#A1A1AA] hover:text-white",
        danger:
          "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30",
        outline:
          "border border-[#2F2F2F] hover:border-primary/50 text-white hover:bg-primary/5",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    )
  }
)

Button.displayName = "Button"

export default Button
export { buttonVariants }