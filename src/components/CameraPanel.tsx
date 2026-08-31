import { RotateCcw, SwitchCamera } from 'lucide-react'
import { SIZE_PRESETS, type CameraLayout, type SizePreset } from '../types'
import { SectionTitle, Slider } from './ui'

/**
 * Controlli della camera.
 *
 * Attenzione: questo pannello NON esiste in Loom. La ricerca ha stabilito che
 * Loom non offre zoom o pan della camera da nessuna parte, e che il suo editor
 * non permette di riposizionare la bolla dopo la registrazione. Registrando due
 * tracce separate possiamo permetterlo: è una funzione originale, disegnata nel
 * linguaggio visivo di Loom ma senza un originale da copiare.
 */
export function CameraPanel({
  layout,
  onChange,
  disabled,
  showPlacement,
}: {
  layout: CameraLayout
  onChange: (patch: Partial<CameraLayout>) => void
  disabled?: boolean
  showPlacement: boolean
}) {
  const activePreset = (Object.keys(SIZE_PRESETS) as SizePreset[]).find(
    (k) => Math.abs(SIZE_PRESETS[k] - layout.size) < 0.005,
  )

  return (
    <div className={disabled ? 'pointer-events-none opacity-40' : undefined}>
      {showPlacement && (
        <>
          <SectionTitle>Forma</SectionTitle>
          <div className="mb-5 flex gap-2">
            {(['circle', 'rounded'] as const).map((shape) => (
              <button
                key={shape}
                onClick={() => onChange({ shape })}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full border-2 px-3 py-2 text-sm font-medium transition-colors ${
                  layout.shape === shape
                    ? 'border-brand bg-tint text-brand'
                    : 'border-line hover:border-brand-200'
                }`}
              >
                <span
                  className={`block bg-current ${
                    shape === 'circle' ? 'h-4 w-4 rounded-full' : 'h-3.5 w-6 rounded-[4px]'
                  }`}
                />
                {shape === 'circle' ? 'Cerchio' : 'Rettangolo'}
              </button>
            ))}
          </div>

          <SectionTitle>Dimensione</SectionTitle>
          <div className="mb-2 flex gap-2">
            {(['small', 'medium', 'large'] as SizePreset[]).map((p) => (
              <button
                key={p}
                onClick={() => onChange({ size: SIZE_PRESETS[p] })}
                className={`flex-1 rounded-full border-2 py-1.5 text-sm font-medium transition-colors ${
                  activePreset === p
                    ? 'border-brand bg-tint text-brand'
                    : 'border-line hover:border-brand-200'
                }`}
              >
                {p === 'small' ? 'Piccola' : p === 'medium' ? 'Media' : 'Grande'}
              </button>
            ))}
          </div>
          <div className="mb-5">
            <Slider
              label="Regolazione libera"
              value={layout.size}
              min={0.08}
              max={0.6}
              step={0.005}
              onChange={(size) => onChange({ size })}
              format={(v) => `${Math.round(v * 100)}% altezza`}
            />
          </div>
        </>
      )}

      <SectionTitle>Inquadratura del volto</SectionTitle>
      <div className="space-y-4">
        <Slider
          label="Zoom"
          value={layout.zoom}
          min={1}
          max={3}
          step={0.01}
          onChange={(zoom) => onChange({ zoom })}
          format={(v) => `${v.toFixed(2)}×`}
          onReset={
            layout.zoom !== 1 ? () => onChange({ zoom: 1, panX: 0, panY: 0 }) : undefined
          }
        />
        <Slider
          label="Sposta orizzontale"
          value={layout.panX}
          min={-1}
          max={1}
          step={0.01}
          disabled={layout.zoom <= 1.001}
          onChange={(panX) => onChange({ panX })}
          format={(v) => (v === 0 ? 'centro' : v.toFixed(2))}
        />
        <Slider
          label="Sposta verticale"
          value={layout.panY}
          min={-1}
          max={1}
          step={0.01}
          disabled={layout.zoom <= 1.001}
          onChange={(panY) => onChange({ panY })}
          format={(v) => (v === 0 ? 'centro' : v.toFixed(2))}
        />
        {layout.zoom <= 1.001 && (
          <p className="text-xs text-muted">
            Aumenta lo zoom per poter spostare l'inquadratura.
          </p>
        )}
      </div>

      <div className="mt-5 flex gap-2 border-t border-line pt-4">
        <button
          onClick={() => onChange({ mirrored: !layout.mirrored })}
          className="lift flex flex-1 items-center justify-center gap-2 rounded-full border border-line px-3 py-2 text-sm font-medium hover:border-muted"
        >
          <SwitchCamera size={15} />
          {layout.mirrored ? 'Specchiata' : 'Normale'}
        </button>
        <button
          onClick={() => onChange({ zoom: 1, panX: 0, panY: 0 })}
          className="lift flex items-center justify-center gap-2 rounded-full border border-line px-3 py-2 text-sm font-medium hover:border-muted"
          title="Ripristina inquadratura"
        >
          <RotateCcw size={15} />
        </button>
      </div>
    </div>
  )
}
