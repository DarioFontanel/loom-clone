export function formatDuration(sec: number): string {
  const total = Math.max(0, Math.floor(sec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Tempo preciso per il trim, con i decimi. */
export function formatPrecise(sec: number): string {
  const total = Math.max(0, sec)
  const m = Math.floor(total / 60)
  const s = Math.floor(total % 60)
  const d = Math.floor((total % 1) * 10)
  return `${m}:${String(s).padStart(2, '0')}.${d}`
}

export function formatRelativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'poco fa'
  if (diff < 3600) return `${Math.floor(diff / 60)} min fa`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h fa`
  return new Date(ts).toLocaleDateString('it-IT')
}
