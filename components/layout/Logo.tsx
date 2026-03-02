"use client"

type LogoSize = "sm" | "md" | "lg"

interface LogoProps {
  size?: LogoSize
  showText?: boolean
}

const SIZE_MAP = {
  sm: { icon: 30, text: 15, radius: 9,  gap: 8  },
  md: { icon: 38, text: 18, radius: 11, gap: 10 },
  lg: { icon: 48, text: 22, radius: 14, gap: 12 },
} as const

export default function Logo({ size = "md", showText = true }: LogoProps) {
  const s = SIZE_MAP[size]
  const svgSize = Math.round(s.icon * 0.5)

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: s.gap,
        userSelect: "none",
      }}
    >
      {/* Ícone */}
      <div
        style={{
          width: s.icon,
          height: s.icon,
          borderRadius: s.radius,
          background: "linear-gradient(135deg, #0066FF 0%, #7C3AED 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(0,102,255,0.3)",
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Brilho interno */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.18), transparent)",
          }}
        />
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 24 24"
          fill="none"
          style={{ position: "relative", zIndex: 1 }}
        >
          <path
            d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Texto */}
      {showText && (
        <span
          style={{
            fontSize: s.text,
            fontWeight: 800,
            background: "linear-gradient(135deg, #ffffff 0%, #a0b4ff 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: "-0.3px",
            lineHeight: 1,
          }}
        >
          Forbion
        </span>
      )}
    </div>
  )
}