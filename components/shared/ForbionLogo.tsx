"use client"

/**
 * ForbionLogo — typographic brand mark.
 *
 * Renders "forbion" in white + a blue dot "."
 * Uses inline styles only (no Tailwind) to match project conventions.
 *
 * Props
 * ─────
 *  size   → sm | md | lg | xl  (font-size preset)
 *  as     → HTML tag: "h1" | "div" | "span" | "p"  (default "h1")
 *  color  → text colour override (default "#FFFFFF")
 *  style  → extra CSSProperties merged onto the root element
 *
 * Usage
 * ─────
 *  <ForbionLogo />                       → h1, md (20 px)
 *  <ForbionLogo size="xl" />             → h1, 32 px — login heroes
 *  <ForbionLogo as="span" size="sm" />   → span, 16 px — footers
 */

import React from "react"

type LogoSize = "sm" | "md" | "lg" | "xl"
type LogoTag  = "h1" | "div" | "span" | "p"

interface ForbionLogoProps {
  /** Font-size preset */
  size?: LogoSize
  /** Which HTML element to render (default "h1") */
  as?: LogoTag
  /** Base text colour (default white) */
  color?: string
  /** Extra inline styles on the root element */
  style?: React.CSSProperties
}

const SIZE_MAP: Record<LogoSize, number> = {
  sm: 16,
  md: 20,
  lg: 26,
  xl: 32,
}

const DOT_COLOR = "#0066FF"

export default function ForbionLogo({
  size = "md",
  as: Tag = "h1",
  color = "#FFFFFF",
  style,
}: ForbionLogoProps) {
  const fontSize = SIZE_MAP[size]

  return (
    <Tag
      style={{
        margin: 0,
        padding: 0,
        fontSize,
        fontWeight: 800,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        letterSpacing: "-0.03em",
        lineHeight: 1,
        userSelect: "none",
        whiteSpace: "nowrap",
        color,
        ...style,
      }}
    >
      forbion
      <span
        style={{
          color: DOT_COLOR,
          textShadow: `0 0 8px ${DOT_COLOR}66`,
        }}
      >
        .
      </span>
    </Tag>
  )
}
