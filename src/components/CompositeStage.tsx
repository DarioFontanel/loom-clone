import { useCallback, useEffect, useRef, useState } from 'react'
import {
  bubbleAspect,
  bubbleRect,
  clamp,
  clampLayoutPosition,
  composeFrame,
  videoElementSource,
} from '../lib/geometry'
import { SIZE_PRESETS, type CameraLayout, type CaptureMode, type SizePreset } from '../types'

interface CompositeStageProps {
  mode: CaptureMode
  layout: CameraLayout
  aspect: number
  screenEl: HTMLVideoElement | null
  cameraEl: HTMLVideoElement | null
  /** Se assente, il palco è di sola visualizzazione. */
  onLayoutChange?: (patch: Partial<CameraLayout>) => void
  /** Sfondo mostrato quando non c'è ancora una sorgente schermo. */
  placeholder?: React.ReactNode
  className?: string
}

/**
 * Mostra la composizione esatta che finirà nel file.
 *
 * Disegna con la stessa funzione usata dall'export (`composeFrame`), così
 * l'anteprima non può divergere dal risultato.
 */
export function CompositeStage({
  mode,
  layout,
  aspect,
  screenEl,
  cameraEl,
  onLayoutChange,
  placeholder,
  className,
}: CompositeStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [hovering, setHovering] = useState(false)
  const [dragging, setDragging] = useState(false)

  // I riferimenti mutabili evitano di far ripartire il loop di rendering a ogni
  // micro-modifica del layout: il loop legge sempre l'ultimo valore.
  const stateRef = useRef({ mode, layout, screenEl, cameraEl })
  useEffect(() => {
    stateRef.current = { mode, layout, screenEl, cameraEl }
  }, [mode, layout, screenEl, cameraEl])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setBox({ width: r.width, height: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) return

      const s = stateRef.current
      const screen =
        s.screenEl && s.screenEl.videoWidth ? videoElementSource(s.screenEl) : null
      const camera =
        s.cameraEl && s.cameraEl.videoWidth ? videoElementSource(s.cameraEl) : null

      composeFrame(
        ctx,
        canvas.width,
        canvas.height,
        s.mode,
        s.layout,
        screen,
        camera,
      )
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Risoluzione di anteprima contenuta: serve solo agli occhi, non al file.
  const canvasW = 960
  const canvasH = Math.round(canvasW / aspect)

  const rect =
    box.width > 0 && mode === 'screen-camera'
      ? bubbleRect(box.width, box.width / aspect, layout)
      : null

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!onLayoutChange || !containerRef.current) return
      e.preventDefault()
      const container = containerRef.current
      const cRect = container.getBoundingClientRect()
      const start = bubbleRect(cRect.width, cRect.height, layout)
      const grabX = e.clientX - cRect.left - (start.x + start.w / 2)
      const grabY = e.clientY - cRect.top - (start.y + start.h / 2)
      setDragging(true)

      const move = (ev: PointerEvent) => {
        const nx = (ev.clientX - cRect.left - grabX) / cRect.width
        const ny = (ev.clientY - cRect.top - grabY) / cRect.height
        const next = clampLayoutPosition(
          { ...layout, x: nx, y: ny },
          cRect.width,
          cRect.height,
        )
        onLayoutChange({ x: next.x, y: next.y })
      }
      const up = () => {
        setDragging(false)
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [layout, onLayoutChange],
  )

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      if (!onLayoutChange || !containerRef.current) return
      e.preventDefault()
      e.stopPropagation()
      const cRect = containerRef.current.getBoundingClientRect()
      const centerX = cRect.left + layout.x * cRect.width
      const centerY = cRect.top + layout.y * cRect.height

      const move = (ev: PointerEvent) => {
        // La dimensione segue la distanza dal centro della bolla: gesto diretto,
        // senza salti quando si afferra la maniglia.
        const dx = Math.abs(ev.clientX - centerX)
        const dy = Math.abs(ev.clientY - centerY)
        const halfH = Math.max(dy, dx / bubbleAspect(layout.shape))
        const size = clamp((halfH * 2) / cRect.height, 0.08, 0.6)
        const next = clampLayoutPosition({ ...layout, size }, cRect.width, cRect.height)
        onLayoutChange({ size, x: next.x, y: next.y })
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [layout, onLayoutChange],
  )

  const setPreset = (preset: SizePreset) => {
    if (!onLayoutChange || !containerRef.current) return
    const cRect = containerRef.current.getBoundingClientRect()
    const size = SIZE_PRESETS[preset]
    const next = clampLayoutPosition({ ...layout, size }, cRect.width, cRect.height)
    onLayoutChange({ size, x: next.x, y: next.y })
  }

  const activePreset = (Object.keys(SIZE_PRESETS) as SizePreset[]).find(
    (k) => Math.abs(SIZE_PRESETS[k] - layout.size) < 0.005,
  )

  const showControls = Boolean(onLayoutChange) && (hovering || dragging)

  /**
   * Geometria dell'overlay dei preset.
   *
   * Due vincoli imparati sul campo. Primo: i chip devono stare DENTRO l'area che
   * ascolta l'hover, altrimenti fra bolla e chip si apre una fascia morta in cui
   * `pointerleave` li smonta prima che il mouse li raggiunga — e i preset
   * diventano incliccabili. Secondo: il palco ha `overflow: hidden`, quindi con
   * la bolla in basso i chip finirebbero tagliati: in quel caso vanno sopra.
   */
  const CHIP_H = 28
  const CHIP_GAP = 8
  const CHIP_W = 104
  const band = CHIP_H + CHIP_GAP

  const stageH = box.width > 0 ? box.width / aspect : 0
  const chipsBelow = rect ? rect.y + rect.h + band <= stageH : true
  const bandTop = chipsBelow ? 0 : band
  const bandBottom = chipsBelow ? band : 0

  // I chip restano centrati sulla bolla, ma non escono mai dai bordi del palco.
  const chipLeft = rect
    ? clamp(rect.x + rect.w / 2 - CHIP_W / 2, 4, Math.max(4, box.width - CHIP_W - 4)) -
      rect.x
    : 0

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-ink ${className ?? ''}`}
      style={{ aspectRatio: String(aspect) }}
    >
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        className="absolute inset-0 h-full w-full"
      />

      {placeholder}

      {rect && onLayoutChange && (
        <div
          className="absolute"
          style={{
            left: rect.x,
            top: rect.y - bandTop,
            width: rect.w,
            height: rect.h + bandTop + bandBottom,
          }}
          onPointerEnter={() => setHovering(true)}
          onPointerLeave={() => setHovering(false)}
        >
          {/* Superficie di trascinamento sopra la bolla disegnata sul canvas. */}
          <div
            onPointerDown={startDrag}
            style={{ position: 'absolute', top: bandTop, height: rect.h, width: '100%' }}
            className={`${dragging ? 'cursor-grabbing' : 'cursor-grab'} ${
              layout.shape === 'circle' ? 'rounded-full' : 'rounded-2xl'
            } ${showControls ? 'ring-2 ring-white/80' : ''}`}
            title="Trascina per spostare la camera"
          />

          {/*
            Loom rivela i tre preset passando il mouse SULLA BOLLA, non dalla
            barra di controllo (verificato sui doc Atlassian).
          */}
          {showControls && (
            <div
              style={{
                position: 'absolute',
                left: chipLeft,
                width: CHIP_W,
                height: CHIP_H,
                top: chipsBelow ? bandTop + rect.h + CHIP_GAP : 0,
              }}
              className="flex items-center justify-center gap-1 rounded-full bg-ink/90 p-1 whitespace-nowrap shadow-lg backdrop-blur"
            >
              {(['small', 'medium', 'large'] as SizePreset[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    activePreset === p
                      ? 'bg-brand text-white'
                      : 'text-white/70 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  {p === 'small' ? 'S' : p === 'medium' ? 'M' : 'L'}
                </button>
              ))}
            </div>
          )}

          {/* Resize libero: aggiunta nostra, Loom offre solo i tre preset. */}
          {showControls && (
            <div
              onPointerDown={startResize}
              style={{ position: 'absolute', top: bandTop + rect.h - 10, right: -6 }}
              className="h-4 w-4 cursor-nwse-resize rounded-full border-2 border-brand bg-white shadow"
              title="Trascina per ridimensionare liberamente"
            />
          )}
        </div>
      )}
    </div>
  )
}
