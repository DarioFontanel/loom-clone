import { MonitorPlay, Monitor, Video } from 'lucide-react'
import type { CaptureMode } from '../types'

const MODES: {
  id: CaptureMode
  label: string
  hint: string
  Icon: typeof Monitor
}[] = [
  {
    id: 'screen-camera',
    label: 'Schermo e camera',
    hint: 'Il tuo schermo con la bolla camera',
    Icon: MonitorPlay,
  },
  {
    id: 'screen',
    label: 'Solo schermo',
    hint: 'Racconta senza mostrarti',
    Icon: Monitor,
  },
  {
    id: 'camera',
    label: 'Solo camera',
    hint: 'Parla direttamente in camera',
    Icon: Video,
  },
]

/** Il selettore a tre modalità è la schermata d'ingresso di Loom. */
export function ModeSelector({
  value,
  onChange,
  disabled,
}: {
  value: CaptureMode
  onChange: (m: CaptureMode) => void
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {MODES.map(({ id, label, hint, Icon }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(id)}
            aria-pressed={active}
            className={`lift group flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-4 text-center transition-colors disabled:opacity-40 ${
              active
                ? 'border-brand bg-tint'
                : 'border-line bg-white hover:border-brand-200'
            }`}
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                active ? 'bg-brand text-white' : 'bg-canvas text-muted'
              }`}
            >
              <Icon size={20} strokeWidth={2} />
            </span>
            <span className="text-[13px] leading-tight font-semibold">{label}</span>
            <span className="text-[11px] leading-tight text-muted">{hint}</span>
          </button>
        )
      })}
    </div>
  )
}
