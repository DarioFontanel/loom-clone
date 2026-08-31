import { useEffect, useRef, useState } from 'react'
import { Camera, Circle, Mic, MicOff, Square, SwitchCamera } from 'lucide-react'
import { useStore } from '../store'
import { useDevices, useMicLevel } from '../lib/useDevices'
import { getCameraStream, getMicStream, stopStream } from '../lib/recorder'
import { Button, Card, SectionTitle, Select, Toggle } from './ui'
import { ModeSelector } from './ModeSelector'
import { CompositeStage } from './CompositeStage'
import { LibraryGrid } from './LibraryGrid'
import { LoomWordmark } from './LoomMark'
import type { BubbleShape } from '../types'

export function HomeScreen() {
  const {
    mode,
    setMode,
    cameraDeviceId,
    setCameraDeviceId,
    micDeviceId,
    setMicDeviceId,
    micEnabled,
    setMicEnabled,
    countdownEnabled,
    setCountdownEnabled,
    draftLayout,
    updateDraftLayout,
    setScreen,
    recordings,
    error,
    setError,
  } = useStore()

  const { cameras, microphones, refresh } = useDevices()
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [micStream, setMicStream] = useState<MediaStream | null>(null)
  const [permissionAsked, setPermissionAsked] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)
  const level = useMicLevel(micStream)

  const needsCamera = mode !== 'screen'

  // Anteprima camera viva sulla home, come in Loom.
  useEffect(() => {
    let cancelled = false
    let created: MediaStream | null = null

    if (!needsCamera) {
      setCameraStream((prev) => {
        stopStream(prev)
        return null
      })
      return
    }

    getCameraStream(cameraDeviceId)
      .then((s) => {
        if (cancelled) {
          stopStream(s)
          return
        }
        created = s
        setCameraStream((prev) => {
          stopStream(prev)
          return s
        })
        setPermissionAsked(true)
        void refresh()
      })
      .catch(() => {
        if (!cancelled) setError('Nessuna webcam disponibile o permesso negato.')
      })

    return () => {
      cancelled = true
      if (created) stopStream(created)
    }
  }, [needsCamera, cameraDeviceId, refresh, setError])

  useEffect(() => {
    let cancelled = false
    let created: MediaStream | null = null

    if (!micEnabled) {
      setMicStream((prev) => {
        stopStream(prev)
        return null
      })
      return
    }

    getMicStream(micDeviceId)
      .then((s) => {
        if (cancelled) {
          stopStream(s)
          return
        }
        created = s
        setMicStream((prev) => {
          stopStream(prev)
          return s
        })
        void refresh()
      })
      .catch(() => {
        if (!cancelled) setError('Microfono non disponibile o permesso negato.')
      })

    return () => {
      cancelled = true
      if (created) stopStream(created)
    }
  }, [micEnabled, micDeviceId, refresh, setError])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.srcObject = cameraStream
    if (cameraStream) void v.play().catch(() => {})
  }, [cameraStream])

  const startRecording = () => {
    // Le sorgenti di anteprima vengono rilasciate: la registrazione apre le
    // proprie, così i vincoli richiesti sono quelli giusti dal primo frame.
    stopStream(cameraStream)
    stopStream(micStream)
    setCameraStream(null)
    setMicStream(null)
    setScreen('recording')
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <LoomWordmark />
          <span className="rounded-full bg-tint px-3 py-1 text-xs font-semibold text-brand">
            Sessione locale
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-[40px] leading-tight font-extrabold text-ink">
          Registra il tuo schermo.
          <br />
          <span className="text-brand">Mostrati mentre lo fai.</span>
        </h1>
        <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-muted">
          Schermo e camera vengono registrati come tracce separate: posizione,
          dimensione e inquadratura del volto restano modificabili anche dopo.
        </p>

        {error && (
          <div className="mt-6 flex items-start justify-between gap-4 rounded-2xl border border-rec/30 bg-rec/5 px-4 py-3 text-sm text-rec">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-semibold underline">
              chiudi
            </button>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          {/* --- Anteprima ---------------------------------------------- */}
          <Card className="h-fit overflow-hidden">
            <CompositeStage
              mode={mode}
              layout={draftLayout}
              aspect={16 / 9}
              screenEl={null}
              cameraEl={mode === 'screen' ? null : videoEl}
              onLayoutChange={mode === 'screen-camera' ? updateDraftLayout : undefined}
              placeholder={
                mode !== 'camera' ? <ScreenPlaceholder /> : undefined
              }
            />
            <div className="flex items-center justify-between gap-3 px-5 py-3.5">
              <p className="text-xs text-muted">
                {mode === 'screen-camera'
                  ? 'Trascina la bolla per posizionarla. Passaci sopra per le tre dimensioni.'
                  : mode === 'screen'
                    ? 'Sceglierai schermo o finestra al via della registrazione.'
                    : 'La camera occuperà tutto il fotogramma.'}
              </p>
              {mode !== 'screen' && (
                <button
                  onClick={() =>
                    updateDraftLayout({ mirrored: !draftLayout.mirrored })
                  }
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold transition-colors hover:border-muted"
                  title="Effetto specchio"
                >
                  <SwitchCamera size={14} />
                  {draftLayout.mirrored ? 'Specchiata' : 'Normale'}
                </button>
              )}
            </div>
          </Card>

          {/* --- Impostazioni -------------------------------------------- */}
          <Card className="p-5">
            <SectionTitle>Modalità di cattura</SectionTitle>
            <ModeSelector value={mode} onChange={setMode} />

            <div className="mt-6 space-y-4">
              <SectionTitle>Sorgenti</SectionTitle>

              {mode !== 'screen' && (
                <Select
                  label="Camera"
                  icon={<Camera size={15} />}
                  value={cameraDeviceId ?? ''}
                  onChange={(e) => setCameraDeviceId(e.target.value || undefined)}
                >
                  <option value="">Camera predefinita</option>
                  {cameras.map((c) => (
                    <option key={c.deviceId} value={c.deviceId}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              )}

              <div>
                <Select
                  label="Microfono"
                  icon={micEnabled ? <Mic size={15} /> : <MicOff size={15} />}
                  value={micDeviceId ?? ''}
                  disabled={!micEnabled}
                  onChange={(e) => setMicDeviceId(e.target.value || undefined)}
                >
                  <option value="">Microfono predefinito</option>
                  {microphones.map((m) => (
                    <option key={m.deviceId} value={m.deviceId}>
                      {m.label}
                    </option>
                  ))}
                </Select>
                <MicMeter level={micEnabled ? level : 0} />
              </div>
            </div>

            <div className="mt-4 space-y-0.5 border-t border-line pt-3">
              <Toggle
                label="Microfono"
                hint="L'audio di sistema non è catturabile su macOS da browser"
                checked={micEnabled}
                onChange={setMicEnabled}
              />
              <Toggle
                label="Conto alla rovescia"
                hint="Tre secondi prima di partire"
                checked={countdownEnabled}
                onChange={setCountdownEnabled}
              />
            </div>

            {mode === 'screen-camera' && (
              <div className="mt-4 border-t border-line pt-4">
                <SectionTitle>Forma della bolla</SectionTitle>
                <ShapePicker
                  value={draftLayout.shape}
                  onChange={(shape) => updateDraftLayout({ shape })}
                />
              </div>
            )}

            <Button
              size="lg"
              className="mt-6 w-full"
              onClick={startRecording}
              icon={<Circle size={16} fill="currentColor" />}
            >
              Avvia registrazione
            </Button>

            {!permissionAsked && needsCamera && (
              <p className="mt-3 text-center text-xs text-muted">
                Chrome chiederà l'accesso a camera e microfono.
              </p>
            )}
          </Card>
        </div>

        {recordings.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-4 text-xl font-bold">Le tue registrazioni</h2>
            <LibraryGrid />
          </section>
        )}
      </main>

      <video
        ref={(el) => {
          videoRef.current = el
          setVideoEl(el)
        }}
        muted
        playsInline
        className="hidden"
      />
    </div>
  )
}

function ScreenPlaceholder() {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/25">
      <Square size={40} strokeWidth={1.5} />
      <span className="text-sm font-medium">Il tuo schermo apparirà qui</span>
    </div>
  )
}

function MicMeter({ level }: { level: number }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-success transition-[width] duration-75"
          style={{ width: `${Math.min(100, level * 140)}%` }}
        />
      </div>
      <span className="w-16 text-right text-[11px] text-muted">
        {level > 0.02 ? 'ti sento' : 'silenzio'}
      </span>
    </div>
  )
}

function ShapePicker({
  value,
  onChange,
}: {
  value: BubbleShape
  onChange: (s: BubbleShape) => void
}) {
  const options: { id: BubbleShape; label: string }[] = [
    { id: 'circle', label: 'Cerchio' },
    { id: 'rounded', label: 'Rettangolo' },
  ]
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-full border-2 px-3 py-2 text-sm font-medium transition-colors ${
            value === o.id
              ? 'border-brand bg-tint text-brand'
              : 'border-line hover:border-brand-200'
          }`}
        >
          <span
            className={`block bg-current ${
              o.id === 'circle' ? 'h-4 w-4 rounded-full' : 'h-3.5 w-6 rounded-[4px]'
            }`}
          />
          {o.label}
        </button>
      ))}
    </div>
  )
}
