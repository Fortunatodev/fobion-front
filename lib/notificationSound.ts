"use client"

/**
 * Som de notificação gerado via Web Audio API — sem depender de arquivo.
 *
 * Política de autoplay: navegadores bloqueiam áudio até a primeira interação
 * do usuário. Por isso só tentamos criar/retomar o AudioContext depois que
 * `markUserInteracted()` for chamado (ex.: primeiro clique/tecla na página).
 *
 * Tudo é defensivo: se o AudioContext não existir ou falhar, simplesmente
 * não toca — nunca lança erro pra quem chama.
 */

// AudioContext pode não existir em SSR ou navegadores antigos.
type AudioCtor = typeof AudioContext

let ctx: AudioContext | null = null
let userInteracted = false

function getAudioCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

/**
 * Deve ser chamado a partir de um gesto do usuário (click/keydown) para
 * destravar o áudio conforme a política de autoplay dos navegadores.
 */
export function markUserInteracted(): void {
  userInteracted = true
  // Tenta retomar um contexto que tenha ficado suspenso.
  try {
    if (ctx && ctx.state === "suspended") void ctx.resume()
  } catch {
    /* ignora */
  }
}

function ensureCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = getAudioCtor()
      if (!Ctor) return null
      ctx = new Ctor()
    }
    if (ctx.state === "suspended") void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/**
 * Toca um beep curto, discreto e agradável (dois tons rápidos com fade-out).
 * No-op silencioso se o usuário ainda não interagiu ou se o áudio falhar.
 */
export function playNotificationSound(): void {
  if (!userInteracted) return
  try {
    const ac = ensureCtx()
    if (!ac) return

    const now = ac.currentTime
    const master = ac.createGain()
    master.gain.value = 0.0001
    master.connect(ac.destination)

    // Envelope geral: ataque rápido, decaimento suave (~0.32s no total).
    master.gain.setValueAtTime(0.0001, now)
    master.gain.exponentialRampToValueAtTime(0.16, now + 0.012)
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.34)

    // Dois tons em sequência (ding-dong suave) usando senoide pura.
    const tones: Array<{ freq: number; at: number; dur: number }> = [
      { freq: 880, at: 0, dur: 0.18 },     // A5
      { freq: 1174.66, at: 0.085, dur: 0.2 }, // D6
    ]

    for (const t of tones) {
      const osc = ac.createOscillator()
      const g = ac.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(t.freq, now + t.at)

      g.gain.setValueAtTime(0.0001, now + t.at)
      g.gain.exponentialRampToValueAtTime(1, now + t.at + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, now + t.at + t.dur)

      osc.connect(g)
      g.connect(master)
      osc.start(now + t.at)
      osc.stop(now + t.at + t.dur + 0.02)
    }
  } catch {
    /* nunca quebra a UI por causa de som */
  }
}
