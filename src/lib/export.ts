import {
  ALL_FORMATS,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  StreamTarget,
  VideoSampleSink,
  type VideoSample,
} from 'mediabunny'
import type { Recording } from '../types'
import { composeFrame, type FrameSource } from './geometry'

export const EXPORT_FPS = 30
const TARGET_HEIGHT = 1080

function videoSampleSource(sample: VideoSample): FrameSource {
  return {
    width: sample.displayWidth,
    height: sample.displayHeight,
    drawCrop: (ctx, sx, sy, sw, sh, dx, dy, dw, dh) =>
      sample.draw(ctx, sx, sy, sw, sh, dx, dy, dw, dh),
  }
}

/** Dimensioni di output: altezza 1080, larghezza dall'aspect della sorgente. */
export function outputDimensions(rec: Recording): { width: number; height: number } {
  const aspect = rec.width / rec.height || 16 / 9
  const height = Math.min(TARGET_HEIGHT, rec.height || TARGET_HEIGHT)
  // H.264 richiede dimensioni pari.
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)
  return { width: even(height * aspect), height: even(height) }
}

async function openTrack(blob: Blob | undefined) {
  if (!blob) return null
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) })
  const track = await input.getPrimaryVideoTrack()
  if (!track) return null
  return { input, sink: new VideoSampleSink(track) }
}

/**
 * Estrae l'audio del microfono e lo ritaglia sull'intervallo di trim.
 *
 * L'audio vive nella traccia che lo trasporta, che ha un proprio sfasamento
 * rispetto all'inizio globale: il taglio va fatto nel tempo di QUELLA traccia,
 * altrimenti la voce scivola rispetto al video.
 */
async function extractTrimmedAudio(
  rec: Recording,
): Promise<AudioBuffer | null> {
  const carrier = rec.screen?.hasAudio
    ? rec.screen
    : rec.camera?.hasAudio
      ? rec.camera
      : null
  if (!carrier) return null

  const ctx = new AudioContext()
  try {
    const decoded = await ctx.decodeAudioData(await carrier.blob.arrayBuffer())
    const rate = decoded.sampleRate

    const localStart = rec.trimStart - carrier.offsetSec
    const localEnd = rec.trimEnd - carrier.offsetSec

    const startSample = Math.max(0, Math.floor(localStart * rate))
    const endSample = Math.min(decoded.length, Math.ceil(localEnd * rate))
    const length = endSample - startSample
    if (length <= 0) return null

    // Il segmento richiesto può iniziare prima dell'audio disponibile: in quel
    // caso il silenzio iniziale va preservato, o il labiale si disallinea.
    const leadSilence = Math.max(0, Math.round(-localStart * rate))
    const out = ctx.createBuffer(
      decoded.numberOfChannels,
      leadSilence + length,
      rate,
    )
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      out
        .getChannelData(ch)
        .set(decoded.getChannelData(ch).subarray(startSample, endSample), leadSilence)
    }
    return out
  } catch {
    return null
  } finally {
    void ctx.close()
  }
}

export interface ExportHandle {
  /** Nome file suggerito. */
  suggestedName: string
}

export interface ExportProgress {
  /** 0..1 */
  progress: number
  stage: 'preparing' | 'rendering' | 'finalizing'
}

/**
 * Compone le due tracce e produce l'MP4.
 *
 * Scrive direttamente su disco via File System Access API quando disponibile
 * (decisione D-C): l'MP4 non passa mai per la RAM, quindi la durata della
 * registrazione non è limitata dalla memoria del browser.
 */
export async function exportRecording(
  rec: Recording,
  onProgress: (p: ExportProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  onProgress({ progress: 0, stage: 'preparing' })

  const { width, height } = outputDimensions(rec)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Impossibile creare il contesto 2D')
  ctx.imageSmoothingQuality = 'high'

  const suggestedName = `loom-clone-${new Date(rec.createdAt)
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, '-')}.mp4`

  // --- Destinazione: disco diretto, con ripiego su download in memoria -------
  let target: StreamTarget | BufferTarget
  let fileWritable: FileSystemWritableFileStream | null = null

  const picker = (
    window as unknown as {
      showSaveFilePicker?: (o: unknown) => Promise<FileSystemFileHandle>
    }
  ).showSaveFilePicker

  if (picker) {
    const handle = await picker({
      suggestedName,
      types: [{ description: 'Video MP4', accept: { 'video/mp4': ['.mp4'] } }],
    })
    fileWritable = await handle.createWritable()
    target = new StreamTarget(
      fileWritable as unknown as WritableStream<{
        type: 'write'
        data: Uint8Array<ArrayBuffer>
        position: number
      }>,
      { chunked: true },
    )
  } else {
    target = new BufferTarget()
  }

  const output = new Output({ format: new Mp4OutputFormat(), target })

  const videoSource = new CanvasSource(canvas, {
    codec: 'avc',
    quality: QUALITY_HIGH,
    keyFrameInterval: 2,
  })
  output.addVideoTrack(videoSource, { frameRate: EXPORT_FPS })

  const audioBuffer = await extractTrimmedAudio(rec)
  let audioSource: AudioBufferSource | null = null
  if (audioBuffer) {
    audioSource = new AudioBufferSource({
      codec: 'aac',
      quality: QUALITY_HIGH,
      transform: {
        numberOfChannels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate,
      },
    })
    output.addAudioTrack(audioSource)
  }

  const screenTrack = await openTrack(rec.screen?.blob)
  const cameraTrack = await openTrack(rec.camera?.blob)

  await output.start()

  // --- Rendering frame per frame -------------------------------------------
  const duration = Math.max(0, rec.trimEnd - rec.trimStart)
  const frameCount = Math.max(1, Math.round(duration * EXPORT_FPS))

  const screenOffset = rec.screen?.offsetSec ?? 0
  const cameraOffset = rec.camera?.offsetSec ?? 0

  // Ogni frame globale viene tradotto nel tempo LOCALE di ciascuna traccia:
  // è così che le due registrazioni restano allineate nonostante partano in
  // istanti leggermente diversi.
  const screenTimes: number[] = []
  const cameraTimes: number[] = []
  for (let i = 0; i < frameCount; i++) {
    const t = rec.trimStart + i / EXPORT_FPS
    screenTimes.push(Math.max(0, t - screenOffset))
    cameraTimes.push(Math.max(0, t - cameraOffset))
  }

  const screenIter = screenTrack?.sink.samplesAtTimestamps(screenTimes)
  const cameraIter = cameraTrack?.sink.samplesAtTimestamps(cameraTimes)

  onProgress({ progress: 0, stage: 'rendering' })

  /**
   * Un fotogramma resta sullo schermo finché non arriva il successivo.
   *
   * La cattura schermo è a frame rate variabile: se nulla si muove, Chrome non
   * produce nuovi fotogrammi e la richiesta di un istante oltre la durata
   * dell'ultimo restituisce null. Senza trattenere l'ultimo valido, ogni pausa
   * dell'utente — una slide ferma, una pagina che si legge — diventerebbe nera.
   */
  let heldScreen: VideoSample | null = null
  let heldCamera: VideoSample | null = null

  try {
    for (let i = 0; i < frameCount; i++) {
      if (signal?.aborted) throw new DOMException('Annullato', 'AbortError')

      if (screenIter) {
        const next = (await screenIter.next()).value
        if (next) {
          heldScreen?.close()
          heldScreen = next
        }
      }
      if (cameraIter) {
        const next = (await cameraIter.next()).value
        if (next) {
          heldCamera?.close()
          heldCamera = next
        }
      }

      // Una traccia che parte in ritardo non esiste ancora prima del proprio
      // inizio: mostrarne il primo fotogramma congelato inventerebbe immagine
      // che non è mai stata registrata.
      const tGlobal = rec.trimStart + i / EXPORT_FPS
      const screenStarted = tGlobal >= screenOffset - 1e-6
      const cameraStarted = tGlobal >= cameraOffset - 1e-6

      composeFrame(
        ctx,
        width,
        height,
        rec.mode,
        rec.layout,
        heldScreen && screenStarted ? videoSampleSource(heldScreen) : null,
        heldCamera && cameraStarted ? videoSampleSource(heldCamera) : null,
      )

      // Attendere l'add propaga la contropressione di encoder e disco: senza,
      // la coda cresce senza limite e vanifica la scrittura in streaming.
      await videoSource.add(i / EXPORT_FPS, 1 / EXPORT_FPS)

      if (i % 15 === 0) {
        onProgress({ progress: i / frameCount, stage: 'rendering' })
      }
    }

    if (audioSource && audioBuffer) {
      await audioSource.add(audioBuffer)
    }

    onProgress({ progress: 1, stage: 'finalizing' })
    videoSource.close()
    audioSource?.close()
    await output.finalize()

    if (target instanceof BufferTarget && target.buffer) {
      downloadBuffer(target.buffer, suggestedName)
    }
  } catch (err) {
    try {
      await output.cancel()
    } catch {
      /* la cancellazione non deve mascherare l'errore originale */
    }
    await fileWritable?.abort().catch(() => {})
    fileWritable = null
    throw err
  } finally {
    heldScreen?.close()
    heldCamera?.close()
    screenTrack?.input.dispose()
    cameraTrack?.input.dispose()
  }
}

function downloadBuffer(buffer: ArrayBuffer, name: string): void {
  const url = URL.createObjectURL(new Blob([buffer], { type: 'video/mp4' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Compone un singolo frame — usato per le anteprime della libreria. */
export async function renderThumbnail(
  rec: Recording,
  atSec: number,
  maxWidth = 480,
): Promise<string | undefined> {
  const { width, height } = outputDimensions(rec)
  const scale = Math.min(1, maxWidth / width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(2, Math.round(width * scale))
  canvas.height = Math.max(2, Math.round(height * scale))
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return undefined

  const screenTrack = await openTrack(rec.screen?.blob)
  const cameraTrack = await openTrack(rec.camera?.blob)
  try {
    // Stesso motivo dell'export: a frame rate variabile l'istante richiesto può
    // cadere dopo l'ultimo fotogramma disponibile. Si arretra finché non se ne
    // trova uno, invece di produrre una miniatura nera.
    const sampleNear = async (
      sink: VideoSampleSink,
      t: number,
    ): Promise<VideoSample | null> => {
      for (const candidate of [t, t / 2, 0]) {
        const s = await sink.getSample(Math.max(0, candidate))
        if (s) return s
      }
      return null
    }

    const screenSample = screenTrack
      ? await sampleNear(screenTrack.sink, atSec - (rec.screen?.offsetSec ?? 0))
      : null
    const cameraSample = cameraTrack
      ? await sampleNear(cameraTrack.sink, atSec - (rec.camera?.offsetSec ?? 0))
      : null

    composeFrame(
      ctx,
      canvas.width,
      canvas.height,
      rec.mode,
      rec.layout,
      screenSample ? videoSampleSource(screenSample) : null,
      cameraSample ? videoSampleSource(cameraSample) : null,
    )
    screenSample?.close()
    cameraSample?.close()
    return canvas.toDataURL('image/jpeg', 0.7)
  } catch {
    return undefined
  } finally {
    screenTrack?.input.dispose()
    cameraTrack?.input.dispose()
  }
}

/**
 * Durata reale della registrazione, letta dai file prodotti.
 *
 * Il cronometro a parete sovrastima: MediaRecorder smette di raccogliere frame
 * un istante prima dello stop. Usare quel valore come fine del trim farebbe
 * ripetere l'ultimo fotogramma per qualche decimo di secondo.
 */
export async function probeDuration(
  screenBlob: Blob | undefined,
  cameraBlob: Blob | undefined,
  screenOffset: number,
  cameraOffset: number,
): Promise<number | null> {
  const measure = async (blob: Blob | undefined, offset: number) => {
    if (!blob) return 0
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) })
    try {
      return offset + (await input.computeDuration())
    } catch {
      return 0
    } finally {
      input.dispose()
    }
  }
  const [a, b] = await Promise.all([
    measure(screenBlob, screenOffset),
    measure(cameraBlob, cameraOffset),
  ])
  const longest = Math.max(a, b)
  return longest > 0 ? longest : null
}
