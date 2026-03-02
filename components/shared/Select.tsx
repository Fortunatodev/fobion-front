"use client";

import { type ReactNode } from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface SelectProps {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export default function Select({
  label,
  placeholder = "Selecionar...",
  options,
  value,
  onChange,
  error,
  disabled,
  className,
}: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-white/80">{label}</label>
      )}
      <RadixSelect.Root
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <RadixSelect.Trigger
          className={cn(
            "inline-flex items-center justify-between",
            "h-10 w-full px-3 rounded-xl",
            "bg-[#111111] border text-sm",
            "focus:outline-none focus:ring-1 transition-all duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 text-white"
              : "border-[#1F1F1F] focus:border-primary focus:ring-primary/30 text-white",
            !value && "text-[#A1A1AA]",
            className
          )}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <ChevronDown
              size={14}
              className="text-[#A1A1AA] transition-transform duration-200 [[data-state=open]_&]:rotate-180"
            />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            className="z-50 overflow-hidden bg-[#111111] border border-[#2F2F2F] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-150"
            position="popper"
            sideOffset={4}
          >
            <RadixSelect.Viewport className="p-1">
              {options.map((opt) => (
                <RadixSelect.Item
                  key={opt.value}
                  value={opt.value}
                  className={cn(
                    "relative flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer select-none",
                    "text-white outline-none transition-colors duration-150",
                    "data-[highlighted]:bg-[#1A1A1A]",
                    "data-[state=checked]:text-primary"
                  )}
                >
                  {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                  <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator className="absolute right-3">
                    <Check size={12} />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
      {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
    </div>
  );
}