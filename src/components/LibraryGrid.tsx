import { MonitorPlay, Monitor, Play, Video } from 'lucide-react'
import { useStore } from '../store'
import { formatDuration, formatRelativeTime } from '../lib/format'
import type { CaptureMode } from '../types'

const MODE_META: Record<CaptureMode, { label: string; Icon: typeof Monitor }> = {
  'screen-camera': { label: 'Schermo e camera', Icon: MonitorPlay },
  screen: { label: 'Solo schermo', Icon: Monitor },
  camera: { label: 'Solo camera', Icon: Video },
}

/**
 * La griglia dei video è la schermata più riconoscibile di Loom.
 * Qui vive solo in memoria: al refresh sparisce, per scelta.
 */
export function LibraryGrid() {
  const recordings = useStore((s) => s.recordings)
  const openRecording = useStore((s) => s.openRecording)

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {recordings.map((r) => {
          const { label, Icon } = MODE_META[r.mode]
          return (
            <button
              key={r.id}
              onClick={() => openRecording(r.id)}
              className="lift group overflow-hidden rounded-[var(--radius-card)] border border-line bg-white text-left shadow-[var(--shadow-soft)]"
            >
              <div className="relative aspect-video overflow-hidden bg-ink">
                {r.thumbnailUrl ? (
                  <img
                    src={r.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-white/25">
                    <Icon size={28} strokeWidth={1.5} />
                  </div>
                )}

                <span className="absolute inset-0 flex items-center justify-center bg-ink/35 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-brand">
                    <Play size={20} fill="currentColor" className="ml-0.5" />
                  </span>
                </span>

                <span className="absolute right-2 bottom-2 rounded-full bg-ink/80 px-2 py-0.5 font-mono text-[11px] text-white tabular-nums">
                  {formatDuration(r.trimEnd - r.trimStart)}
                </span>
              </div>

              <div className="px-4 py-3">
                <p className="truncate text-sm font-semibold">
                  Registrazione delle{' '}
                  {new Date(r.createdAt).toLocaleTimeString('it-IT', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  <Icon size={12} />
                  {label} · {formatRelativeTime(r.createdAt)}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      <p className="mt-4 text-xs text-muted">
        Queste registrazioni vivono solo in memoria: ricaricando la pagina spariscono.
        Esporta ciò che vuoi conservare.
      </p>
    </>
  )
}
