import { create } from 'zustand'
import {
  DEFAULT_CAMERA_LAYOUT,
  type CameraLayout,
  type CaptureMode,
  type Recording,
} from './types'

export type Screen = 'home' | 'recording' | 'editor'

interface AppState {
  screen: Screen
  mode: CaptureMode
  cameraDeviceId?: string
  micDeviceId?: string
  micEnabled: boolean
  countdownEnabled: boolean
  mirrored: boolean

  /** Layout usato dalla prossima registrazione; ereditato da quella corrente. */
  draftLayout: CameraLayout

  /** Libreria della sessione corrente. Volatile per scelta: sparisce al refresh. */
  recordings: Recording[]
  activeRecordingId: string | null

  error: string | null

  setScreen: (s: Screen) => void
  setMode: (m: CaptureMode) => void
  setCameraDeviceId: (id?: string) => void
  setMicDeviceId: (id?: string) => void
  setMicEnabled: (v: boolean) => void
  setCountdownEnabled: (v: boolean) => void
  setMirrored: (v: boolean) => void
  updateDraftLayout: (patch: Partial<CameraLayout>) => void

  addRecording: (r: Recording) => void
  updateRecording: (id: string, patch: Partial<Recording>) => void
  updateLayout: (id: string, patch: Partial<CameraLayout>) => void
  removeRecording: (id: string) => void
  openRecording: (id: string) => void

  setError: (e: string | null) => void
}

export const useStore = create<AppState>((set, get) => ({
  screen: 'home',
  mode: 'screen-camera',
  micEnabled: true,
  countdownEnabled: true,
  mirrored: true,
  draftLayout: DEFAULT_CAMERA_LAYOUT,
  recordings: [],
  activeRecordingId: null,
  error: null,

  setScreen: (screen) => set({ screen }),
  setMode: (mode) => set({ mode }),
  setCameraDeviceId: (cameraDeviceId) => set({ cameraDeviceId }),
  setMicDeviceId: (micDeviceId) => set({ micDeviceId }),
  setMicEnabled: (micEnabled) => set({ micEnabled }),
  setCountdownEnabled: (countdownEnabled) => set({ countdownEnabled }),
  setMirrored: (mirrored) =>
    set((s) => ({
      mirrored,
      draftLayout: { ...s.draftLayout, mirrored },
    })),

  updateDraftLayout: (patch) =>
    set((s) => ({ draftLayout: { ...s.draftLayout, ...patch } })),

  addRecording: (r) =>
    set((s) => ({ recordings: [r, ...s.recordings], activeRecordingId: r.id })),

  updateRecording: (id, patch) =>
    set((s) => ({
      recordings: s.recordings.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),

  updateLayout: (id, patch) =>
    set((s) => ({
      recordings: s.recordings.map((r) =>
        r.id === id ? { ...r, layout: { ...r.layout, ...patch } } : r,
      ),
      // La prossima registrazione parte da come hai lasciato questa.
      draftLayout: { ...s.draftLayout, ...patch },
    })),

  removeRecording: (id) => {
    const next = get().recordings.filter((r) => r.id !== id)
    set({
      recordings: next,
      activeRecordingId: get().activeRecordingId === id ? null : get().activeRecordingId,
      screen: get().activeRecordingId === id ? 'home' : get().screen,
    })
  },

  openRecording: (id) => set({ activeRecordingId: id, screen: 'editor' }),

  setError: (error) => set({ error }),
}))

export function useActiveRecording(): Recording | undefined {
  return useStore((s) => s.recordings.find((r) => r.id === s.activeRecordingId))
}
