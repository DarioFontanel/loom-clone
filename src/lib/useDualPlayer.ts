import { useCallback, useEffect, useRef, useState } from 'react'
import type { Recording } from '../types'

/** Oltre questo scarto le due tracce si vedono fuori sincrono: riallineiamo. */
const RESYNC_THRESHOLD = 0.12

export interface DualPlayer {
  screenEl: HTMLVideoElement | null
  cameraEl: HTMLVideoElement | null
  setScreenEl: (el: HTMLVideoElement | null) => void
  setCameraEl: (el: HTMLVideoElement | null) => void
  playing: boolean
  currentTime: number
  toggle: () => void
  seek: (t: number) => void
  ready: boolean
}

/**
 * Riproduce le due tracce come se fossero una sola.
 *
 * Ogni traccia ha un proprio istante di partenza: il tempo "globale" viene
 * tradotto nel tempo locale di ciascun video. Lo stesso calcolo dell'export,
 * così ciò che vedi qui è ciò che otterrai nel file.
 */
export function useDualPlayer(rec: Recording | undefined): DualPlayer {
  const [screenEl, setScreenEl] = useState<HTMLVideoElement | null>(null)
  const [cameraEl, setCameraEl] = useState<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [ready, setReady] = useState(false)
  const rafRef = useRef(0)

  const screenOffset = rec?.screen?.offsetSec ?? 0
  const cameraOffset = rec?.camera?.offsetSec ?? 0
  const trimStart = rec?.trimStart ?? 0
  const trimEnd = rec?.trimEnd ?? 0

  /**
   * Un elemento `<video>` resta montato anche per una traccia che questa
   * modalità non ha (in "solo camera" non esiste traccia schermo). Senza
   * sorgente il suo `currentTime` non avanzerà mai: usarlo come guida
   * congelerebbe l'intera riproduzione. La logica deve basarsi sull'esistenza
   * della TRACCIA, non su quella del nodo DOM.
   */
  const activeScreenEl = rec?.screen ? screenEl : null
  const activeCameraEl = rec?.camera ? cameraEl : null

  // Sorgenti: un object URL per traccia, revocato al cambio registrazione.
  useEffect(() => {
    if (!rec) return
    const urls: string[] = []
    const attach = (el: HTMLVideoElement | null, blob: Blob | undefined, muted: boolean) => {
      if (!el || !blob) return
      const url = URL.createObjectURL(blob)
      urls.push(url)
      el.src = url
      el.muted = muted
      el.load()
    }
    // L'audio esce da una sola traccia: quella che lo trasporta.
    attach(screenEl, rec.screen?.blob, !rec.screen?.hasAudio)
    attach(cameraEl, rec.camera?.blob, !rec.camera?.hasAudio)
    setReady(false)

    const check = () => {
      const okScreen = !rec.screen || (screenEl?.readyState ?? 0) >= 2
      const okCamera = !rec.camera || (cameraEl?.readyState ?? 0) >= 2
      if (okScreen && okCamera) setReady(true)
    }
    screenEl?.addEventListener('loadeddata', check)
    cameraEl?.addEventListener('loadeddata', check)
    check()

    return () => {
      screenEl?.removeEventListener('loadeddata', check)
      cameraEl?.removeEventListener('loadeddata', check)
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [rec, screenEl, cameraEl])

  const applyTime = useCallback(
    (t: number, isPlaying: boolean) => {
      const align = (el: HTMLVideoElement | null, offset: number) => {
        if (!el) return
        // Prima del proprio inizio la traccia va tenuta ferma a zero: lasciarla
        // correre la porterebbe avanti dell'offset, e la riproduzione mostrerebbe
        // un fotogramma diverso da quello che l'export mette nel file.
        if (t < offset) {
          if (!el.paused) el.pause()
          if (el.currentTime !== 0) el.currentTime = 0
          return
        }
        if (isPlaying && el.paused) void el.play().catch(() => {})
        const local = t - offset
        if (Math.abs(el.currentTime - local) > RESYNC_THRESHOLD) {
          el.currentTime = local
        }
      }
      align(activeScreenEl, screenOffset)
      align(activeCameraEl, cameraOffset)
    },
    [activeScreenEl, activeCameraEl, screenOffset, cameraOffset],
  )

  const seek = useCallback(
    (t: number) => {
      const clamped = Math.min(Math.max(t, trimStart), trimEnd)
      setCurrentTime(clamped)
      if (activeScreenEl) activeScreenEl.currentTime = Math.max(0, clamped - screenOffset)
      if (activeCameraEl) activeCameraEl.currentTime = Math.max(0, clamped - cameraOffset)
    },
    [activeScreenEl, activeCameraEl, screenOffset, cameraOffset, trimStart, trimEnd],
  )

  const pause = useCallback(() => {
    activeScreenEl?.pause()
    activeCameraEl?.pause()
    setPlaying(false)
  }, [activeScreenEl, activeCameraEl])

  const toggle = useCallback(() => {
    if (playing) {
      pause()
      return
    }
    // Ripartire dall'inizio quando si è già alla fine è ciò che ci si aspetta.
    if (currentTime >= trimEnd - 0.05) seek(trimStart)
    const from = currentTime >= trimEnd - 0.05 ? trimStart : currentTime
    // Si avvia solo ciò che a questo istante è già cominciato; al resto pensa
    // `applyTime` quando ne arriva il momento.
    if (activeScreenEl && from >= screenOffset) void activeScreenEl.play().catch(() => {})
    if (activeCameraEl && from >= cameraOffset) void activeCameraEl.play().catch(() => {})
    setPlaying(true)
  }, [
    playing,
    pause,
    currentTime,
    trimEnd,
    trimStart,
    seek,
    activeScreenEl,
    activeCameraEl,
    screenOffset,
    cameraOffset,
  ])

  // Il tempo globale segue la traccia principale, e l'altra viene riagganciata
  // solo quando scivola: correggerla a ogni frame produrrebbe scatti.
  useEffect(() => {
    if (!playing) return

    // La guida dev'essere la traccia partita per prima: è l'unica che non viene
    // mai messa in pausa dal gating, quindi l'unica il cui orologio avanza
    // sempre. Scegliere l'altra bloccherebbe il tempo globale.
    const screenLeads = Boolean(activeScreenEl) && (!activeCameraEl || screenOffset <= cameraOffset)
    const leader = screenLeads ? activeScreenEl : (activeCameraEl ?? activeScreenEl)
    const leaderOffset = screenLeads ? screenOffset : activeCameraEl ? cameraOffset : screenOffset
    if (!leader) return

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)
      const t = leader.currentTime + leaderOffset
      setCurrentTime(t)
      if (t >= trimEnd) {
        pause()
        seek(trimEnd)
        return
      }
      applyTime(t, true)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, activeScreenEl, activeCameraEl, screenOffset, cameraOffset, trimEnd, applyTime, pause, seek])

  // Se il trim si stringe attorno alla testina, riportiamola dentro.
  useEffect(() => {
    if (currentTime < trimStart || currentTime > trimEnd) {
      seek(Math.min(Math.max(currentTime, trimStart), trimEnd))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimStart, trimEnd])

  useEffect(() => {
    if (ready) seek(trimStart)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  return {
    // Verso l'esterno si espongono solo gli elementi delle tracce che esistono
    // davvero, così nemmeno l'anteprima può disegnare da un video senza sorgente.
    screenEl: activeScreenEl,
    cameraEl: activeCameraEl,
    setScreenEl,
    setCameraEl,
    playing,
    currentTime,
    toggle,
    seek,
    ready,
  }
}
