"use client";

import { getStatusLabel, getStatusColor } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const label = getStatusLabel(status);
  const color = getStatusColor(status);
  const isInProgress = status === "IN_PROGRESS";
  const padding = size === "sm" ? "px-2 py-0.5" : "px-3 py-1";

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full
        ${padding} text-xs font-medium
      `}
      style={{
        backgroundColor: color.bg,
        color: color.text,
        border: `1px solid ${color.border}`,
      }}
    >
      {isInProgress && (
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: color.text }}
        />
      )}
      {label}
    </span>
  )
}
