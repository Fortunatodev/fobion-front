import { useState, useEffect, useRef } from "react"

/**
 * Anima um número de 0 (ou do valor anterior) até o target com easing cúbico.
 * Retorna o valor animado em cada frame.
 *
 * Uso:
 *   const animated = useAnimatedNumber(1500, { duration: 900 })
 *   // animated vai de 0 → 1500 em 900ms com curva suave
 */
export function useAnimatedNumber(
  target: number,
  options?: { duration?: number; delay?: number }
): number {
  const { duration = 900, delay = 0 } = options ?? {}
  const [value, setValue] = useState(0)
  const raf = useRef<number>(0)
  const mounted = useRef(false)

  useEffect(() => {
    // Sempre animar de 0 no primeiro mount (garante animação visível)
    const from = mounted.current ? value : 0
    mounted.current = true

    if (target === 0) { setValue(0); return }

    const timer = setTimeout(() => {
      const start = performance.now()

      function tick(now: number) {
        const elapsed = now - start
        const progress = Math.min(elapsed / duration, 1)
        // Ease out expo — mais dramático que cubic, bom pra dinheiro
        const eased = 1 - Math.pow(2, -10 * progress)
        setValue(from + (target - from) * eased)
        if (progress < 1) {
          raf.current = requestAnimationFrame(tick)
        } else {
          setValue(target)
        }
      }

      raf.current = requestAnimationFrame(tick)
    }, delay)

    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, delay])

  return value
}

/**
 * Formata o número animado como moeda BRL.
 * Aceita centavos (divide por 100) ou reais direto.
 */
export function formatAnimatedCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
