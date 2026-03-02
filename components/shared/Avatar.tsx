"use client"

import { getInitials } from "@/lib/utils"

interface AvatarProps {
  name: string
  imageUrl?: string
  size?: "sm" | "md" | "lg" | "xl"
}

const sizeMap = {
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
  xl: "w-12 h-12 text-base",
}

export default function Avatar({ name, imageUrl, size = "md" }: AvatarProps) {
  const sizeClass = sizeMap[size]

  return (
    <div
      className={`
        ${sizeClass}
        relative inline-flex items-center justify-center
        rounded-full border border-white/10
        overflow-hidden shrink-0
        hover:scale-105 transition-transform duration-200
      `}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover rounded-full"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-blue-400 font-semibold text-white select-none">
          {getInitials(name)}
        </div>
      )}
    </div>
  )
}