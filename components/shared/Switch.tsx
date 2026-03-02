"use client"

import * as RadixSwitch from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
}

export default function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  className,
}: SwitchProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <RadixSwitch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          "relative inline-flex w-11 h-6 rounded-full transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          checked ? "bg-primary" : "bg-[#2F2F2F]"
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            "block w-5 h-5 bg-white rounded-full shadow-sm",
            "transition-transform duration-200",
            "translate-x-0.5",
            "data-[state=checked]:translate-x-[22px]"
          )}
        />
      </RadixSwitch.Root>
      {label && (
        <span className="text-sm text-white select-none">{label}</span>
      )}
    </div>
  )
}