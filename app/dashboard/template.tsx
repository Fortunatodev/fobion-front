"use client"

import { type ReactNode } from "react"
import { LazyMotion, domAnimation, m } from "motion/react"

/**
 * Transição de página do dashboard. O template.tsx do App Router re-monta a cada
 * navegação entre rotas — então um fade-up sutil aqui dá entrada suave a TODA aba,
 * sem tocar em cada page. LazyMotion + `m` (pack domAnimation) ~20kb, carregado 1x.
 */
export default function DashboardTemplate({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </m.div>
    </LazyMotion>
  )
}
