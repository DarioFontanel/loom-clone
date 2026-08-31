import { useCallback, useRef } from 'react'
import { clamp } from '../lib/geometry'
import { formatPrecise } from '../lib/format'

interface TrimBarProps {
  duration: number
  trimStart: number
  trimEnd: number
  currentTime: number
  onTrimChange: (patch: { trimStart?: number; trimEnd?: number }) => void
  onSeek: (t: number) => void
}

const MIN_SPAN = 0.4

/**
 * Le due maniglie del trim. È l'unica operazione di editing temporale prevista:
 * elimina i secondi morti in testa e in coda, che sono il 90% del bisogno reale.
 */
export function TrimBar({
  duration,
  trimStart,
  trimEnd,
  currentTime,
  onTrimChange,
  onSeek,
}: TrimBarProps) {
  const trackRef = useRef<HTMLDivElement>(null)

  const timeAt = useCallback(
    (clientX: number) => {
      const el = trackRef.current
      if (!el) return 0
      const r = el.getBoundingClientRect()
      return clamp((clientX - r.left) / r.width, 0, 1) * duration
    },
    [duration],
  )

  const dragHandle = (which: 'start' | 'end') => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const move = (ev: PointerEvent) => {
      const t = timeAt(ev.clientX)
      // Con registrazioni più corte di MIN_SPAN il vincolo va allentato: 0,4 s
      // di minimo su una clip da 0,2 s spingerebbe il limite sotto zero, e un
      // trimStart negativo farebbe esportare fotogrammi duplicati e silenzio
      // mai registrati. Il minimo scende a metà durata invece che alla durata
      // intera, altrimenti le clip corte resterebbero del tutto intagliabili.
      const span = Math.min(MIN_SPAN, duration / 2)
      if (which === 'start') {
        onTrimChange({ trimStart: clamp(t, 0, Math.max(0, trimEnd - span)) })
      } else {
        onTrimChange({ trimEnd: clamp(t, Math.min(trimStart + span, duration), duration) })
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const scrub = (e: React.PointerEvent) => {
    const seekTo = (clientX: number) =>
      onSeek(clamp(timeAt(clientX), trimStart, trimEnd))
    seekTo(e.clientX)
    const move = (ev: PointerEvent) => seekTo(ev.clientX)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const pct = (t: number) => `${(t / Math.max(duration, 0.001)) * 100}%`

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span className="font-mono tabular-nums">{formatPrecise(trimStart)}</span>
        <span className="font-semibold text-slate-ink">
          Durata finale {formatPrecise(trimEnd - trimStart)}
        </span>
        <span className="font-mono tabular-nums">{formatPrecise(trimEnd)}</span>
      </div>

      <div
        ref={trackRef}
        onPointerDown={scrub}
        className="relative h-14 cursor-pointer touch-none rounded-2xl bg-canvas ring-1 ring-line select-none"
      >
        {/* Porzioni scartate dal trim. */}
        <div
          className="absolute inset-y-0 left-0 rounded-l-2xl bg-ink/8"
          style={{ width: pct(trimStart) }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded-r-2xl bg-ink/8"
          style={{ left: pct(trimEnd) }}
        />

        {/* Porzione conservata. */}
        <div
          className="absolute inset-y-0 border-y-2 border-brand bg-brand/10"
          style={{ left: pct(trimStart), width: pct(trimEnd - trimStart) }}
        />

        {/* Testina di riproduzione. */}
        <div
          className="pointer-events-none absolute inset-y-1 w-0.5 rounded bg-ink"
          style={{ left: pct(currentTime) }}
        >
          <span className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-ink" />
        </div>

        <Handle position={pct(trimStart)} onPointerDown={dragHandle('start')} side="start" />
        <Handle position={pct(trimEnd)} onPointerDown={dragHandle('end')} side="end" />
      </div>
    </div>
  )
}

function Handle({
  position,
  onPointerDown,
  side,
}: {
  position: string
  onPointerDown: (e: React.PointerEvent) => void
  side: 'start' | 'end'
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute inset-y-0 flex w-4 cursor-ew-resize items-center justify-center"
      style={{ left: position, transform: 'translateX(-50%)' }}
      title={side === 'start' ? 'Inizio' : 'Fine'}
    >
      <span className="flex h-full w-3.5 flex-col items-center justify-center gap-0.5 rounded-md bg-brand shadow">
        <span className="h-3 w-px bg-white/70" />
        <span className="h-3 w-px bg-white/70" />
      </span>
    </div>
  )
}
