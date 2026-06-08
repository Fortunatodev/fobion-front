"use client"

import { type ReactNode } from "react"
import Button from "./Button"

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 flex items-center justify-center bg-[var(--c-border)] rounded-2xl text-[var(--c-text-2)] mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-[var(--c-text)] mt-2">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--c-text-2)] mt-1 max-w-sm">{description}</p>
      )}
      {action && (
        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  )
}