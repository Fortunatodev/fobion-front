import { cn } from "@/lib/utils"

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
}

export default function Skeleton({ className, width, height }: SkeletonProps) {
  return (
    <div
      className={cn("bg-[#1A1A1A] rounded-lg animate-pulse", className)}
      style={{
        width: width !== undefined ? (typeof width === "number" ? `${width}px` : width) : undefined,
        height: height !== undefined ? (typeof height === "number" ? `${height}px` : height) : undefined,
      }}
    />
  )
}

export function SkeletonText({ className, width }: { className?: string; width?: string }) {
  return (
    <Skeleton
      className={cn("h-4 rounded", className)}
      width={width}
    />
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return <Skeleton className={cn("rounded-2xl h-32 w-full", className)} />
}

export function SkeletonAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeMap = { sm: "w-6 h-6", md: "w-8 h-8", lg: "w-10 h-10" }
  return <Skeleton className={cn("rounded-full shrink-0", sizeMap[size])} />
}

export function SkeletonButton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-10 rounded-xl", className)} />
}

export function SkeletonMetricCard() {
  return (
    <div className="bg-[#111111] border border-[#1F1F1F] rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-7 w-20 rounded" />
        </div>
        <Skeleton className="w-10 h-10 rounded-xl" />
      </div>
      <Skeleton className="h-3 w-32 rounded" />
    </div>
  )
}