import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Square, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { startCapture, type ActiveCapture } from '../lib/recorder'
import { probeDuration, renderThumbnail } from '../lib/export'
import { clampLayoutPosition } from '../lib/geometry'
import { CompositeStage } from './CompositeStage'
import { formatDuration } from '../lib/format'
import type { Recording } from '../types'

type Phase = 'countdown' | 'starting' | 'recording' | 'saving'

export function RecordingScreen() {
  const {
    mode,
    cameraDeviceId,
    micDeviceId,
    micEnabled,
    countdownEnabled,
    draftLayout,
    updateDraftLayout,
    setScreen,
    addRecording,
    setError,
  } = useStore()

  const [phase, setPhase] = useState<Phase>(
    countdownEnabled ? 'countdown' : 'starting',
  )
  const [count, setCount] = useState(3)
  const [elapsed, setElapsed] = useState(0)
  const [muted, setMuted] = useState(false)

  const captureRef = useRef<ActiveCapture | null>(null)
  const screenVideoRef = useRef<HTMLVideoElement | null>(null)
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null)
  const [screenEl, setScreenEl] = useState<HTMLVideoElement | null>(null)
  const [cameraEl, setCameraEl] = useState<HTMLVideoElement | null>(null)
  const [aspect, setAspect] = useState(16 / 9)
  const abandonRef = useRef(false)

  // --- Conto alla rovescia --------------------------------------------------
  useEffect(() => {
    if (phase !== 'countdown') return
    if (count === 0) {
      setPhase('starting')
      return
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, count])

  // --- Avvio della cattura --------------------------------------------------
  useEffect(() => {
    if (phase !== 'starting') return
    let cancelled = false

    startCapture({ mode, cameraDeviceId, micDeviceId, micEnabled })
      .then((capture) => {
        if (cancelled) {
          capture.cancel()
          return
        }
        captureRef.current = capture
        capture.onExternalStop = () => void finish()

        if (screenVideoRef.current && capture.screenStream) {
          screenVideoRef.current.srcObject = capture.screenStream
          void screenVideoRef.current.play().catch(() => {})
          const track = capture.screenStream.getVideoTracks()[0]
          const s = track?.getSettings()
          if (s?.width && s?.height) setAspect(s.width / s.height)
        }
        if (cameraVideoRef.current && capture.cameraStream) {
          cameraVideoRef.current.srcObject = capture.cameraStream
          void cameraVideoRef.current.play().catch(() => {})
          if (mode === 'camera') {
            const s = capture.cameraStream.getVideoTracks()[0]?.getSettings()
            if (s?.width && s?.height) setAspect(s.width / s.height)
          }
        }
        setPhase('recording')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const aborted = err instanceof DOMException && err.name === 'NotAllowedError'
        setError(
          aborted
            ? 'Condivisione annullata: nessuna registrazione avviata.'
            : 'Impossibile avviare la registrazione. Controlla i permessi di Chrome.',
        )
        setScreen('home')
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // --- Cronometro -----------------------------------------------------------
  useEffect(() => {
    if (phase !== 'recording') return
    const started = performance.now()
    const id = setInterval(() => setElapsed((performance.now() - started) / 1000), 200)
    return () => clearInterval(id)
  }, [phase])

  // Il mute non interrompe la traccia: la disabilita, così la timeline audio
  // resta continua e allineata al video.
  useEffect(() => {
    captureRef.current?.micStream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted
    })
  }, [muted])

  const finish = useCallback(async () => {
    const capture = captureRef.current
    if (!capture || abandonRef.current) return
    abandonRef.current = true
    captureRef.current = null
    setPhase('saving')

    try {
      const result = await capture.stop()
      const screenOffset = result.screen?.offsetSec ?? 0
      const cameraOffset = result.camera?.offsetSec ?? 0
      const probed = await probeDuration(
        result.screen?.blob,
        result.camera?.blob,
        screenOffset,
        cameraOffset,
      )
      const duration = probed ?? result.durationSec

      // Il video comincia quando TUTTE le tracce sono partite. I due recorder
      // non si avviano nello stesso millisecondo, e partire dall'istante del
      // più veloce lascerebbe un lampo senza l'altra traccia.
      const startsWhenBothLive = Math.max(screenOffset, cameraOffset)

      const layout = clampLayoutPosition(draftLayout, result.width, result.height)
      const recording: Recording = {
        id: crypto.randomUUID(),
        mode,
        createdAt: Date.now(),
        durationSec: duration,
        screen: result.screen,
        camera: result.camera,
        width: result.width,
        height: result.height,
        layout,
        trimStart: Math.min(startsWhenBothLive, Math.max(0, duration - 0.1)),
        trimEnd: duration,
      }

      addRecording(recording)
      setScreen('editor')

      // L'anteprima arriva dopo: non deve far aspettare l'apertura dell'editor.
      void renderThumbnail(recording, Math.min(1, duration / 2)).then((thumbnailUrl) => {
        if (thumbnailUrl) {
          useStore.getState().updateRecording(recording.id, { thumbnailUrl })
        }
      })
    } catch {
      setError('Errore durante il salvataggio della registrazione.')
      setScreen('home')
    }
  }, [addRecording, draftLayout, mode, setError, setScreen])

  const discard = () => {
    abandonRef.current = true
    captureRef.current?.cancel()
    captureRef.current = null
    setScreen('home')
  }

  useEffect(() => {
    return () => {
      if (!abandonRef.current) captureRef.current?.cancel()
    }
  }, [])

  // Scorciatoia: Esc annulla. Loom ha proprie scorciatoie, ma la ricerca non ha
  // saputo verificarle, quindi non ne inventiamo di "ufficiali".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase === 'recording') discard()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (phase === 'countdown') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink text-white">
        <div key={count} className="animate-countdown-pop text-[140px] leading-none font-extrabold">
          {count}
        </div>
        <p className="mt-4 text-white/60">Preparati…</p>
        <button
          onClick={() => setScreen('home')}
          className="mt-8 rounded-full border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
        >
          Annulla
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-4xl">
          <div className="mb-3 flex items-center gap-2 text-sm text-white/60">
            <span className="h-2 w-2 rounded-full bg-rec animate-rec-pulse" />
            {phase === 'saving'
              ? 'Salvataggio…'
              : phase === 'starting'
                ? 'Avvio…'
                : 'Registrazione in corso — anteprima, non finisce nel file'}
          </div>

          <div className="overflow-hidden rounded-[var(--radius-card)] shadow-2xl">
            <CompositeStage
              mode={mode}
              layout={draftLayout}
              aspect={aspect}
              screenEl={screenEl}
              cameraEl={cameraEl}
              onLayoutChange={mode === 'screen-camera' ? updateDraftLayout : undefined}
            />
          </div>

          <p className="mt-3 text-center text-xs text-white/40">
            Puoi cambiare idea dopo: posizione, dimensione e zoom della camera
            restano modificabili nell'editor.
          </p>
        </div>
      </div>

      {/*
        Barra di controllo in basso a sinistra: è la posizione che Loom usa nel
        recorder da browser (verificato sui doc Atlassian).
      */}
      <div className="fixed bottom-6 left-6 flex items-center gap-2 rounded-full bg-ink-soft/95 p-2 shadow-2xl ring-1 ring-white/10 backdrop-blur">
        <button
          onClick={() => void finish()}
          disabled={phase !== 'recording'}
          className="lift flex h-11 w-11 items-center justify-center rounded-full bg-rec text-white disabled:opacity-40"
          title="Termina registrazione"
        >
          <Square size={16} fill="currentColor" />
        </button>

        <div className="px-2 font-mono text-sm tabular-nums">
          {formatDuration(elapsed)}
        </div>

        <div className="mx-1 h-6 w-px bg-white/15" />

        <button
          onClick={() => setMuted((m) => !m)}
          disabled={!micEnabled || phase !== 'recording'}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 disabled:opacity-30"
          title={muted ? 'Riattiva microfono' : 'Silenzia microfono'}
        >
          {muted || !micEnabled ? <MicOff size={17} /> : <Mic size={17} />}
        </button>

        <button
          onClick={discard}
          disabled={phase === 'saving'}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-rec/20 hover:text-rec disabled:opacity-30"
          title="Elimina registrazione"
        >
          <Trash2 size={17} />
        </button>
      </div>

      <video
        ref={(el) => {
          screenVideoRef.current = el
          setScreenEl(el)
        }}
        muted
        playsInline
        className="hidden"
      />
      <video
        ref={(el) => {
          cameraVideoRef.current = el
          setCameraEl(el)
        }}
        muted
        playsInline
        className="hidden"
      />
    </div>
  )
}
