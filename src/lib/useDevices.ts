import { useCallback, useEffect, useState } from 'react'
import type { DeviceOption } from '../types'

export interface DeviceLists {
  cameras: DeviceOption[]
  microphones: DeviceOption[]
  /** I nomi dei dispositivi restano nascosti finché non si concede il permesso. */
  labelsAvailable: boolean
  refresh: () => void
}

export function useDevices(): DeviceLists {
  const [cameras, setCameras] = useState<DeviceOption[]>([])
  const [microphones, setMicrophones] = useState<DeviceOption[]>([])
  const [labelsAvailable, setLabelsAvailable] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const toOption = (d: MediaDeviceInfo, i: number, kind: string) => ({
        deviceId: d.deviceId,
        label: d.label || `${kind} ${i + 1}`,
      })
      const cams = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => toOption(d, i, 'Camera'))
      const mics = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => toOption(d, i, 'Microfono'))
      setCameras(cams)
      setMicrophones(mics)
      setLabelsAvailable([...cams, ...mics].some((d) => d.label && !/^\w+ \d+$/.test(d.label)))
    } catch {
      setCameras([])
      setMicrophones([])
    }
  }, [])

  useEffect(() => {
    void refresh()
    navigator.mediaDevices.addEventListener('devicechange', refresh)
    return () => navigator.mediaDevices.removeEventListener('devicechange', refresh)
  }, [refresh])

  return { cameras, microphones, labelsAvailable, refresh }
}

/** Livello del microfono, 0..1, per l'indicatore che si muove mentre parli. */
export function useMicLevel(stream: MediaStream | null): number {
  const [level, setLevel] = useState(0)

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setLevel(0)
      return
    }
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.75
    ctx.createMediaStreamSource(stream).connect(analyser)

    const data = new Uint8Array(analyser.frequencyBinCount)
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      analyser.getByteTimeDomainData(data)
      let peak = 0
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128)
      setLevel((prev) => Math.max(peak, prev * 0.82))
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      void ctx.close()
    }
  }, [stream])

  return level
}
