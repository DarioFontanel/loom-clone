import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, Loader2, Pause, Play, Trash2 } from 'lucide-react'
import { useActiveRecording, useStore } from '../store'
import { useDualPlayer } from '../lib/useDualPlayer'
import {
  exportRecording,
  outputDimensions,
  renderThumbnail,
  type ExportProgress,
} from '../lib/export'
import { CompositeStage } from './CompositeStage'
import { CameraPanel } from './CameraPanel'
import { TrimBar } from './TrimBar'
import { Button, Card } from './ui'
import { formatPrecise } from '../lib/format'

export function EditorScreen() {
  const rec = useActiveRecording()
  const { setScreen, updateLayout, updateRecording, removeRecording, setError } =
    useStore()

  const player = useDualPlayer(rec)
  const [exporting, setExporting] = useState<ExportProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const aspect = rec ? rec.width / rec.height : 16 / 9

  useEffect(() => {
    if (!rec) setScreen('home')
  }, [rec, setScreen])

  /**
   * Torna alla libreria rigenerando la miniatura.
   *
   * Rifarla a ogni spostamento di slider costerebbe una decodifica per ogni
   * pixel trascinato; farla all'uscita costa una volta sola e basta perché la
   * griglia mostri il layout aggiornato.
   */
  const backToLibrary = useCallback(() => {
    if (rec) {
      const at = rec.trimStart + Math.min(1, (rec.trimEnd - rec.trimStart) / 2)
      void renderThumbnail(rec, at).then((thumbnailUrl) => {
        if (thumbnailUrl) updateRecording(rec.id, { thumbnailUrl })
      })
    }
    setScreen('home')
  }, [rec, setScreen, updateRecording])

  const handleExport = useCallback(async () => {
    if (!rec) return
    const controller = new AbortController()
    abortRef.current = controller
    setExporting({ progress: 0, stage: 'preparing' })
    try {
      await exportRecording(rec, setExporting, controller.signal)
    } catch (err) {
      const aborted =
        err instanceof DOMException &&
        (err.name === 'AbortError' || err.name === 'NotAllowedError')
      if (!aborted) {
        setError("Esportazione fallita. Riprova o riduci l'intervallo di trim.")
      }
    } finally {
      setExporting(null)
      abortRef.current = null
    }
  }, [rec, setError])

  // Barra spaziatrice per play/pausa, come in ogni editor video.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /INPUT|SELECT|TEXTAREA/.test(target.tagName)) return
      if (e.code === 'Space') {
        e.preventDefault()
        player.toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player])

  if (!rec) return null

  const out = outputDimensions(rec)
  const hasCamera = rec.mode !== 'screen'

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={backToLibrary}
            icon={<ArrowLeft size={16} />}
          >
            Registrazioni
          </Button>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted sm:block">
              {out.width}×{out.height} · 30 fps · MP4
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm('Eliminare questa registrazione?')) removeRecording(rec.id)
              }}
              icon={<Trash2 size={15} />}
            >
              Elimina
            </Button>
            <Button
              onClick={() => void handleExport()}
              disabled={Boolean(exporting)}
              icon={
                exporting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )
              }
            >
              {exporting ? 'Esportazione…' : 'Esporta MP4'}
            </Button>
          </div>
        </div>

        {exporting && (
          <div className="h-1 w-full bg-tint">
            <div
              className="h-full bg-brand transition-[width] duration-200"
              style={{ width: `${Math.round(exporting.progress * 100)}%` }}
            />
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <Card className="overflow-hidden">
              <CompositeStage
                mode={rec.mode}
                layout={rec.layout}
                aspect={aspect}
                // Stessa regola dell'export: nessuna traccia prima del suo
                // inizio, così l'anteprima non mostra ciò che il file non avrà.
                screenEl={
                  player.currentTime >= (rec.screen?.offsetSec ?? 0)
                    ? player.screenEl
                    : null
                }
                cameraEl={
                  player.currentTime >= (rec.camera?.offsetSec ?? 0)
                    ? player.cameraEl
                    : null
                }
                onLayoutChange={
                  rec.mode === 'screen-camera'
                    ? (patch) => updateLayout(rec.id, patch)
                    : undefined
                }
              />
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={player.toggle}
                  disabled={!player.ready}
                  className="lift flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:opacity-40"
                  title={player.playing ? 'Pausa' : 'Riproduci'}
                >
                  {player.playing ? (
                    <Pause size={17} fill="currentColor" />
                  ) : (
                    <Play size={17} fill="currentColor" className="ml-0.5" />
                  )}
                </button>
                <span className="font-mono text-sm text-muted tabular-nums">
                  {formatPrecise(Math.max(0, player.currentTime - rec.trimStart))}
                  {' / '}
                  {formatPrecise(rec.trimEnd - rec.trimStart)}
                </span>
                {!player.ready && (
                  <span className="ml-auto text-xs text-muted">Caricamento…</span>
                )}
              </div>
            </Card>

            <Card className="mt-5 p-5">
              <h3 className="mb-3 text-xs font-bold tracking-wider text-muted uppercase">
                Taglia inizio e fine
              </h3>
              <TrimBar
                duration={rec.durationSec}
                trimStart={rec.trimStart}
                trimEnd={rec.trimEnd}
                currentTime={player.currentTime}
                onSeek={player.seek}
                onTrimChange={(patch) => updateRecording(rec.id, patch)}
              />
            </Card>
          </div>

          <Card className="h-fit p-5">
            <h3 className="mb-1 text-base font-bold">Camera</h3>
            <p className="mb-5 text-xs leading-relaxed text-muted">
              {hasCamera
                ? 'Registrando due tracce separate, questi controlli restano vivi dopo la registrazione — cosa che Loom non permette.'
                : 'Questa registrazione è solo schermo: non c’è una traccia camera da regolare.'}
            </p>
            <CameraPanel
              layout={rec.layout}
              onChange={(patch) => updateLayout(rec.id, patch)}
              disabled={!hasCamera}
              showPlacement={rec.mode === 'screen-camera'}
            />
          </Card>
        </div>
      </main>

      <video
        ref={player.setScreenEl}
        playsInline
        preload="auto"
        className="hidden"
      />
      <video
        ref={player.setCameraEl}
        playsInline
        preload="auto"
        className="hidden"
      />
    </div>
  )
}
