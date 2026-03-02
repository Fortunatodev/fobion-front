"use client"

import { type ReactNode } from "react"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  backHref?: string
}

export default function PageHeader({
  title,
  subtitle,
  action,
  backHref,
}: PageHeaderProps) {
  return (
    <div className="flex justify-between items-start mb-6">
      <div className="flex items-start gap-3">
        {backHref && (
          <Link
            href={backHref}
            className="mt-1 w-8 h-8 flex items-center justify-center rounded-lg text-[#A1A1AA] hover:text-white hover:bg-[#1A1A1A] transition-colors duration-200 shrink-0"
          >
            <ChevronLeft size={18} />
          </Link>
        )}
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && (
            <p className="text-sm text-[#A1A1AA] mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}