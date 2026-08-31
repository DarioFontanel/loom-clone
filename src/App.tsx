import { useEffect, useState } from 'react'
import { useStore } from './store'
import { HomeScreen } from './components/HomeScreen'
import { RecordingScreen } from './components/RecordingScreen'
import { EditorScreen } from './components/EditorScreen'
import { LoomWordmark } from './components/LoomMark'
import { Button } from './components/ui'

/**
 * Il clone è dichiaratamente legato a Chrome: WebCodecs è l'unico modo di
 * ricomporre le due tracce senza esportare in tempo reale. Meglio dirlo subito
 * che fallire a metà export.
 */
function useSupportCheck(): string | null {
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setProblem('Questo browser non permette di catturare lo schermo.')
      return
    }
    if (typeof window.VideoEncoder === 'undefined') {
      setProblem(
        "Questo browser non supporta WebCodecs, necessario per l'esportazione. Usa Chrome.",
      )
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      setProblem('Questo browser non supporta MediaRecorder.')
    }
  }, [])

  return problem
}

export default function App() {
  const screen = useStore((s) => s.screen)
  const problem = useSupportCheck()

  if (problem) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
        <LoomWordmark />
        <p className="max-w-md text-muted">{problem}</p>
        <Button
          variant="secondary"
          onClick={() => window.open('https://www.google.com/chrome/', '_blank')}
        >
          Scarica Chrome
        </Button>
      </div>
    )
  }

  if (screen === 'recording') return <RecordingScreen />
  if (screen === 'editor') return <EditorScreen />
  return <HomeScreen />
}
