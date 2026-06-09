"use client"

import { type ReactNode, type CSSProperties } from "react"
import { useAutoAnimate } from "@formkit/auto-animate/react"

/**
 * Wrapper que anima add/remove/reorder dos filhos (auto-animate, ~2.5kb). Útil em
 * listas dinâmicas onde não dá pra chamar o hook direto (ex.: dentro de um .map de
 * colunas). É só trocar o <div> container da lista por <AutoAnimate>.
 */
export default function AutoAnimate({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const [ref] = useAutoAnimate<HTMLDivElement>()
  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  )
}
