import type { CaptureMode, RecordedTrack } from '../types'

/** Codec di registrazione: WebM è ciò che MediaRecorder produce in Chrome. */
function pickMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? 'video/webm'
}

interface TrackRecorder {
  recorder: MediaRecorder
  chunks: Blob[]
  /** performance.now() al momento in cui QUESTO recorder è realmente partito. */
  startedAt: number
  hasAudio: boolean
}

export interface ActiveCapture {
  mode: CaptureMode
  screenStream: MediaStream | null
  cameraStream: MediaStream | null
  micStream: MediaStream | null
  stop(): Promise<CaptureResult>
  cancel(): void
  /** Invocato se l'utente ferma la condivisione dal banner nativo di Chrome. */
  onExternalStop?: () => void
}

export interface CaptureResult {
  screen?: RecordedTrack
  camera?: RecordedTrack
  durationSec: number
  width: number
  height: number
}

export interface StartCaptureOptions {
  mode: CaptureMode
  cameraDeviceId?: string
  micDeviceId?: string
  micEnabled: boolean
}

export async function getCameraStream(deviceId?: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  })
}

export async function getMicStream(deviceId?: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      echoCancellation: true,
      noiseSuppression: true,
    },
  })
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => t.stop())
}

function startTrackRecorder(
  stream: MediaStream,
  clockOrigin: number,
): TrackRecorder {
  const recorder = new MediaRecorder(stream, {
    mimeType: pickMimeType(),
    videoBitsPerSecond: 8_000_000,
  })
  const state: TrackRecorder = {
    recorder,
    chunks: [],
    startedAt: clockOrigin,
    hasAudio: stream.getAudioTracks().length > 0,
  }
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) state.chunks.push(e.data)
  }
  // Lo sfasamento reale fra le due tracce si misura QUI: il momento in cui il
  // recorder è davvero partito, non quello in cui gliel'abbiamo chiesto.
  recorder.onstart = () => {
    state.startedAt = performance.now()
  }
  recorder.start(1000)
  return state
}

function finishTrackRecorder(
  state: TrackRecorder,
  globalStart: number,
): Promise<RecordedTrack> {
  return new Promise((resolve) => {
    const done = () => {
      resolve({
        blob: new Blob(state.chunks, { type: state.recorder.mimeType }),
        offsetSec: Math.max(0, (state.startedAt - globalStart) / 1000),
        hasAudio: state.hasAudio,
      })
    }
    if (state.recorder.state === 'inactive') {
      done()
      return
    }
    state.recorder.onstop = done
    state.recorder.stop()
  })
}

export async function startCapture(
  options: StartCaptureOptions,
): Promise<ActiveCapture> {
  const { mode, cameraDeviceId, micDeviceId, micEnabled } = options

  let screenStream: MediaStream | null = null
  let cameraStream: MediaStream | null = null
  let micStream: MediaStream | null = null

  try {
    if (mode !== 'camera') {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        // Solo microfono (decisione D7): non chiediamo l'audio di sistema, che
        // su macOS Chrome non è comunque disponibile per schermo e finestre.
        audio: false,
      })
    }
    if (mode !== 'screen') {
      cameraStream = await getCameraStream(cameraDeviceId)
    }
    if (micEnabled) {
      micStream = await getMicStream(micDeviceId)
    }
  } catch (err) {
    stopStream(screenStream)
    stopStream(cameraStream)
    stopStream(micStream)
    throw err
  }

  const micTrack = micStream?.getAudioTracks()[0]

  // Il microfono viaggia con la traccia "principale" della modalità, così
  // l'audio ha un solo percorso e non serve mixare nulla.
  const screenRecordStream = screenStream
    ? new MediaStream([
        ...screenStream.getVideoTracks(),
        ...(micTrack ? [micTrack] : []),
      ])
    : null

  const cameraRecordStream = cameraStream
    ? new MediaStream([
        ...cameraStream.getVideoTracks(),
        ...(micTrack && !screenRecordStream ? [micTrack] : []),
      ])
    : null

  const clockOrigin = performance.now()
  const screenRec = screenRecordStream
    ? startTrackRecorder(screenRecordStream, clockOrigin)
    : null
  const cameraRec = cameraRecordStream
    ? startTrackRecorder(cameraRecordStream, clockOrigin)
    : null

  const capture: ActiveCapture = {
    mode,
    screenStream,
    cameraStream,
    micStream,
    async stop(): Promise<CaptureResult> {
      const globalStart = Math.min(
        screenRec?.startedAt ?? Infinity,
        cameraRec?.startedAt ?? Infinity,
      )
      const durationSec = (performance.now() - globalStart) / 1000

      const [screen, camera] = await Promise.all([
        screenRec ? finishTrackRecorder(screenRec, globalStart) : undefined,
        cameraRec ? finishTrackRecorder(cameraRec, globalStart) : undefined,
      ])

      const primaryTrack =
        mode === 'camera'
          ? cameraStream?.getVideoTracks()[0]
          : screenStream?.getVideoTracks()[0]
      const settings = primaryTrack?.getSettings()

      stopStream(screenStream)
      stopStream(cameraStream)
      stopStream(micStream)

      return {
        screen,
        camera,
        durationSec,
        width: settings?.width ?? 1920,
        height: settings?.height ?? 1080,
      }
    },
    cancel(): void {
      for (const rec of [screenRec, cameraRec]) {
        if (rec && rec.recorder.state !== 'inactive') rec.recorder.stop()
      }
      stopStream(screenStream)
      stopStream(cameraStream)
      stopStream(micStream)
    },
  }

  // Chrome mostra un banner "Interrompi condivisione" fuori dalla nostra pagina:
  // se l'utente lo usa, per lui la registrazione è finita, e deve finire davvero.
  screenStream?.getVideoTracks()[0]?.addEventListener('ended', () => {
    capture.onExternalStop?.()
  })

  return capture
}
