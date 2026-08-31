/**
 * Il segno di Loom: un intreccio ("weave") di linee che si irradiano da un
 * cerchio centrale. Ricostruito — la media-kit di Loom pubblica il logo solo
 * dentro cartelle Google Drive, quindi non è una copia dell'originale ma una
 * reinterpretazione della stessa idea geometrica.
 */
export function LoomMark({ size = 28 }: { size?: number }) {
  const rays = Array.from({ length: 12 }, (_, i) => (i * 360) / 12)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      {rays.map((deg) => (
        <line
          key={deg}
          x1="50"
          y1="50"
          x2="50"
          y2="6"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          transform={`rotate(${deg} 50 50)`}
          opacity={0.9}
        />
      ))}
      <circle cx="50" cy="50" r="15" fill="#fff" />
      <circle cx="50" cy="50" r="8" fill="currentColor" />
    </svg>
  )
}

export function LoomWordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-brand">
        <LoomMark size={26} />
      </span>
      <span className="text-[19px] font-extrabold tracking-tight text-ink">
        Loom<span className="text-muted"> clone</span>
      </span>
    </div>
  )
}
