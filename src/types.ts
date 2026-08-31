/** Le tre modalità di cattura di Loom (verificato 3-0 sui doc Atlassian). */
export type CaptureMode = 'screen-camera' | 'screen' | 'camera'

/** Loom offre bolla tonda o rettangolare. */
export type BubbleShape = 'circle' | 'rounded'

/**
 * Loom espone esattamente TRE preset di dimensione, scelti da un overlay che
 * appare al passaggio del mouse sulla bolla stessa (verificato 3-0).
 * Il resize libero in aggiunta ai preset è una divergenza voluta dall'originale.
 */
export type SizePreset = 'small' | 'medium' | 'large'

export const SIZE_PRESETS: Record<SizePreset, number> = {
  small: 0.16,
  medium: 0.22,
  large: 0.3,
}

/**
 * Layout della camera. Cinque gruppi di numeri, nessuna dipendenza dal tempo:
 * l'inquadratura è fissa per tutta la registrazione (decisione D5).
 *
 * Poiché registriamo due tracce separate, tutto questo resta modificabile
 * DOPO la registrazione — cosa che Loom stesso non permette.
 */
export interface CameraLayout {
  /** Centro della bolla, normalizzato 0..1 sul frame di output. */
  x: number
  y: number
  /** Altezza della bolla come frazione dell'altezza di output. */
  size: number
  shape: BubbleShape
  /** Inquadratura interna: ingrandimento del volto, 1 = nessuno. */
  zoom: number
  /** Spostamento del ritaglio, -1..1, entro il margine disponibile. */
  panX: number
  panY: number
  /** Effetto specchio. */
  mirrored: boolean
}

export const DEFAULT_CAMERA_LAYOUT: CameraLayout = {
  x: 0.11,
  y: 0.83,
  size: SIZE_PRESETS.medium,
  shape: 'circle',
  zoom: 1,
  panX: 0,
  panY: 0,
  mirrored: true,
}

/** Una traccia registrata, con il suo sfasamento rispetto all'inizio globale. */
export interface RecordedTrack {
  blob: Blob
  /** Secondi fra l'inizio globale della registrazione e l'inizio di QUESTA traccia. */
  offsetSec: number
  hasAudio: boolean
}

export interface Recording {
  id: string
  mode: CaptureMode
  createdAt: number
  /** Durata grezza in secondi, prima del trim. */
  durationSec: number
  screen?: RecordedTrack
  camera?: RecordedTrack
  /** Risoluzione di output, derivata dalla sorgente principale. */
  width: number
  height: number
  layout: CameraLayout
  trimStart: number
  trimEnd: number
  thumbnailUrl?: string
}

export interface DeviceOption {
  deviceId: string
  label: string
}
