import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

function cx(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ')
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
}

/** Bottone a pillola: Loom usa border-radius 9999px su tutti i suoi bottoni. */
export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonProps) {
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-brand text-white hover:bg-brand-hover active:bg-brand-active',
    secondary:
      'bg-white text-slate-ink border border-line hover:border-muted shadow-[var(--shadow-soft)]',
    ghost: 'bg-transparent text-slate-ink hover:bg-black/5',
    danger: 'bg-rec text-white hover:brightness-95',
  }
  const sizes: Record<ButtonSize, string> = {
    sm: 'text-sm px-3 py-1.5 gap-1.5',
    md: 'text-base px-4 py-2 gap-2',
    lg: 'text-base px-6 py-3 gap-2 font-semibold',
  }
  return (
    <button
      className={cx(
        'lift inline-flex items-center justify-center rounded-full font-medium',
        'disabled:opacity-40 disabled:shadow-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  icon?: ReactNode
}

export function Select({ label, icon, className, ...rest }: SelectProps) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase">
          {label}
        </span>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
            {icon}
          </span>
        )}
        <select
          className={cx(
            'w-full appearance-none rounded-full border border-line bg-white py-2.5 pr-9 text-sm',
            'transition-colors hover:border-muted focus:border-brand focus:outline-none',
            'disabled:bg-canvas disabled:text-muted',
            icon ? 'pl-9' : 'pl-4',
            className,
          )}
          {...rest}
        />
        <svg
          className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-muted"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </label>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors',
        disabled ? 'opacity-40' : 'hover:bg-black/[0.03]',
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span
        className={cx(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand' : 'bg-line',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  disabled,
  onReset,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
  disabled?: boolean
  onReset?: () => void
}) {
  return (
    <div className={disabled ? 'opacity-40' : undefined}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">
          {label}
        </span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted tabular-nums">
            {format ? format(value) : value.toFixed(2)}
          </span>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              disabled={disabled}
              className="text-xs text-brand hover:underline"
            >
              azzera
            </button>
          )}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="loom-range w-full"
      />
    </div>
  )
}

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cx(
        'rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-soft)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-bold tracking-wider text-muted uppercase">
      {children}
    </h3>
  )
}
