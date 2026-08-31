import type { CameraLayout, CaptureMode } from '../types'

/**
 * Astrazione su "qualcosa che si può disegnare ritagliandolo".
 *
 * Esiste per una ragione precisa: l'anteprima live disegna da un <video> mentre
 * l'export disegna da un VideoSample di Mediabunny. Se i due percorsi avessero
 * matematiche separate divergerebbero, e l'anteprima mentirebbe. Qui c'è una
 * sola implementazione della composizione, usata da entrambi.
 */
export interface FrameSource {
  width: number
  height: number
  drawCrop(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void
}

export function videoElementSource(video: HTMLVideoElement): FrameSource {
  return {
    width: video.videoWidth,
    height: video.videoHeight,
    drawCrop: (ctx, sx, sy, sw, sh, dx, dy, dw, dh) =>
      ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh),
  }
}

/** Rapporto larghezza/altezza della bolla, per forma. */
export function bubbleAspect(shape: CameraLayout['shape']): number {
  return shape === 'circle' ? 1 : 16 / 9
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Ritaglio interno del feed webcam: è QUI che vivono zoom e pan.
 *
 * Partiamo dal rettangolo più grande con l'aspect della bolla che entra nella
 * sorgente (così la bolla non è mai deformata), lo restringiamo di `zoom`, e lo
 * spostiamo con `panX/panY` entro il margine che lo zoom ha liberato. Con
 * zoom = 1 il margine è nullo e il pan non ha effetto, il che è corretto:
 * non c'è nulla fuori campo da andare a cercare.
 */
export function cameraCropRect(
  srcW: number,
  srcH: number,
  layout: CameraLayout,
): Rect {
  const aspect = bubbleAspect(layout.shape)

  let w = Math.min(srcW, srcH * aspect)
  let h = w / aspect

  const zoom = Math.max(1, layout.zoom)
  w /= zoom
  h /= zoom

  const marginX = (srcW - w) / 2
  const marginY = (srcH - h) / 2

  // In modalità specchio ciò che l'utente vede è ribaltato: invertiamo il pan
  // orizzontale perché "sposta a destra" muova l'inquadratura a destra sullo
  // schermo, non nei pixel della sorgente.
  const panX = layout.mirrored ? -layout.panX : layout.panX

  const cx = srcW / 2 + clamp(panX, -1, 1) * marginX
  const cy = srcH / 2 + clamp(layout.panY, -1, 1) * marginY

  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

/** Rettangolo della bolla sul frame di output, in pixel. */
export function bubbleRect(
  outW: number,
  outH: number,
  layout: CameraLayout,
): Rect {
  const h = layout.size * outH
  const w = h * bubbleAspect(layout.shape)
  return { x: layout.x * outW - w / 2, y: layout.y * outH - h / 2, w, h }
}

/**
 * Tiene la bolla dentro il frame. Applicato al drag e prima del rendering, così
 * una posizione impossibile non può esistere nel modello.
 */
export function clampLayoutPosition(
  layout: CameraLayout,
  outW: number,
  outH: number,
): CameraLayout {
  const h = layout.size
  const w = (h * outH * bubbleAspect(layout.shape)) / outW
  return {
    ...layout,
    x: clamp(layout.x, w / 2, 1 - w / 2),
    y: clamp(layout.y, h / 2, 1 - h / 2),
  }
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  radius: number,
): void {
  const rad = Math.min(radius, r.w / 2, r.h / 2)
  ctx.beginPath()
  ctx.moveTo(r.x + rad, r.y)
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad)
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad)
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad)
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad)
  ctx.closePath()
}

/** Disegna la bolla camera (ritagliata, eventualmente specchiata) sul contesto. */
export function drawCameraBubble(
  ctx: CanvasRenderingContext2D,
  camera: FrameSource,
  layout: CameraLayout,
  outW: number,
  outH: number,
): void {
  if (!camera.width || !camera.height) return

  const dest = bubbleRect(outW, outH, layout)
  const crop = cameraCropRect(camera.width, camera.height, layout)
  const radius = layout.shape === 'circle' ? dest.h / 2 : dest.h * 0.14

  ctx.save()

  // Ombra portata sotto la bolla, come Loom.
  ctx.shadowColor = 'rgba(0,0,0,0.32)'
  ctx.shadowBlur = Math.max(8, dest.h * 0.06)
  ctx.shadowOffsetY = Math.max(2, dest.h * 0.02)
  roundedRectPath(ctx, dest, radius)
  ctx.fillStyle = '#101214'
  ctx.fill()
  ctx.restore()

  ctx.save()
  roundedRectPath(ctx, dest, radius)
  ctx.clip()

  if (layout.mirrored) {
    ctx.translate(dest.x + dest.w, dest.y)
    ctx.scale(-1, 1)
    ctx.translate(-dest.x, -dest.y)
  }

  camera.drawCrop(
    ctx,
    crop.x,
    crop.y,
    crop.w,
    crop.h,
    dest.x,
    dest.y,
    dest.w,
    dest.h,
  )
  ctx.restore()

  // Bordo sottile: stacca la bolla da sfondi chiari.
  ctx.save()
  roundedRectPath(ctx, dest, radius)
  ctx.lineWidth = Math.max(1, dest.h * 0.012)
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.stroke()
  ctx.restore()
}

/** Disegna una sorgente riempiendo il frame senza deformarla (cover). */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  source: FrameSource,
  outW: number,
  outH: number,
): void {
  if (!source.width || !source.height) return
  const scale = Math.max(outW / source.width, outH / source.height)
  const w = source.width * scale
  const h = source.height * scale
  source.drawCrop(
    ctx,
    0,
    0,
    source.width,
    source.height,
    (outW - w) / 2,
    (outH - h) / 2,
    w,
    h,
  )
}

/** Disegna una sorgente per intero dentro il frame (contain), con bande. */
export function drawContain(
  ctx: CanvasRenderingContext2D,
  source: FrameSource,
  outW: number,
  outH: number,
): void {
  if (!source.width || !source.height) return
  const scale = Math.min(outW / source.width, outH / source.height)
  const w = source.width * scale
  const h = source.height * scale
  source.drawCrop(
    ctx,
    0,
    0,
    source.width,
    source.height,
    (outW - w) / 2,
    (outH - h) / 2,
    w,
    h,
  )
}

/**
 * Composizione di un singolo frame. Chiamata identica dall'anteprima live e dal
 * renderer di export: se cambia qui, cambia in entrambi.
 */
export function composeFrame(
  ctx: CanvasRenderingContext2D,
  outW: number,
  outH: number,
  mode: CaptureMode,
  layout: CameraLayout,
  screen: FrameSource | null,
  camera: FrameSource | null,
): void {
  ctx.save()
  ctx.fillStyle = '#101214'
  ctx.fillRect(0, 0, outW, outH)
  ctx.restore()

  if (mode === 'camera') {
    if (camera) {
      // In "solo camera" il feed riempie il frame, con zoom e pan applicati
      // esattamente come nella bolla.
      const crop = cameraCropRectForFullFrame(camera, layout, outW / outH)
      ctx.save()
      if (layout.mirrored) {
        ctx.translate(outW, 0)
        ctx.scale(-1, 1)
      }
      camera.drawCrop(ctx, crop.x, crop.y, crop.w, crop.h, 0, 0, outW, outH)
      ctx.restore()
    }
    return
  }

  if (screen) drawContain(ctx, screen, outW, outH)
  if (mode === 'screen-camera' && camera) {
    drawCameraBubble(ctx, camera, layout, outW, outH)
  }
}

/** Variante del ritaglio camera per il frame pieno (modalità "solo camera"). */
export function cameraCropRectForFullFrame(
  camera: FrameSource,
  layout: CameraLayout,
  aspect: number,
): Rect {
  const srcW = camera.width
  const srcH = camera.height
  let w = Math.min(srcW, srcH * aspect)
  let h = w / aspect

  const zoom = Math.max(1, layout.zoom)
  w /= zoom
  h /= zoom

  const marginX = (srcW - w) / 2
  const marginY = (srcH - h) / 2
  const panX = layout.mirrored ? -layout.panX : layout.panX

  const cx = srcW / 2 + clamp(panX, -1, 1) * marginX
  const cy = srcH / 2 + clamp(layout.panY, -1, 1) * marginY
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}
