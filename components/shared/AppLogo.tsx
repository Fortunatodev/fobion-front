"use client"

/**
 * AppLogo — backwards-compatible wrapper around ForbionLogo.
 *
 * All new code should import `ForbionLogo` directly.
 * This file exists so existing `<AppLogo size="md" />` calls keep working
 * without updating every import at once.
 */

import ForbionLogo from "./ForbionLogo"

type OldSize = "xs" | "sm" | "md" | "lg" | "xl"

interface AppLogoProps {
  size?: OldSize
  height?: number
  width?: number
  className?: string
  style?: React.CSSProperties
}

/** Map the old size tokens to the new ForbionLogo size tokens */
const SIZE_BRIDGE: Record<OldSize, "sm" | "md" | "lg" | "xl"> = {
  xs: "sm",
  sm: "sm",
  md: "md",
  lg: "lg",
  xl: "xl",
}

export default function AppLogo({ size = "md", style }: AppLogoProps) {
  return <ForbionLogo size={SIZE_BRIDGE[size]} as="div" style={style} />
}
