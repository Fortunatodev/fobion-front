import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 32,
}

export default function LoadingSpinner({
  size = "md",
  className,
}: LoadingSpinnerProps) {
  const px = sizeMap[size]
  const r = (px - 4) / 2
  const circumference = 2 * Math.PI * r

  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      className={cn("text-primary animate-spin", className)}
      style={{ display: "block" }}
    >
      <circle
        cx={px / 2}
        cy={px / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.2"
      />
      <circle
        cx={px / 2}
        cy={px / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * 0.75}
        strokeLinecap="round"
      />
    </svg>
  )
}

export function FullPageSpinner() {
  return (
    <div className="fixed inset-0 bg-[#0A0A0A] flex flex-col items-center justify-center gap-4 z-50">
      <span className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent select-none">
        Forbion
      </span>
      <LoadingSpinner size="md" />
    </div>
  )
}