"use client"

import { forwardRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className, disabled, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-white/80">{label}</label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] w-4 h-4 flex items-center justify-center">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            disabled={disabled}
            className={cn(
              "h-10 w-full rounded-xl bg-[#111111] border text-white text-sm placeholder:text-[#A1A1AA]",
              "focus:outline-none focus:ring-1 transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error
                ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
                : "border-[#1F1F1F] focus:border-primary focus:ring-primary/30",
              leftIcon ? "pl-[38px]" : "px-3",
              rightIcon ? "pr-[38px]" : "pr-3",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] w-4 h-4 flex items-center justify-center">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-400 mt-0.5">{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs text-[#A1A1AA] mt-0.5">{hint}</p>
        )}
      </div>
    )
  }
)

Input.displayName = "Input"

export default Input