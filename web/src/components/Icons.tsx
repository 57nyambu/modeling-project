// Small hand-drawn line icons (20 x 20) so the app needs no icon library.

interface IconProps {
  size?: number
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

/** Store floor with a moving customer. */
export function IconSimulation({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="2.5" y="3" width="15" height="14" rx="2" />
      <path d="M2.5 13h15" />
      <path d="M6 6.5h3M11 6.5h3" />
      <circle cx="7" cy="10" r="1.2" fill="currentColor" stroke="none" />
      <path d="M11 10h3.5" strokeDasharray="1 2" />
    </svg>
  )
}

/** Three bars with whiskers. */
export function IconCompare({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 17h14" />
      <rect x="4" y="9" width="3" height="8" rx="0.8" />
      <rect x="8.5" y="11.5" width="3" height="5.5" rx="0.8" />
      <rect x="13" y="5" width="3" height="12" rx="0.8" />
      <path d="M14.5 3v2M5.5 7v2" />
    </svg>
  )
}

/** Connected nodes: a flow diagram. */
export function IconDiagrams({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="2.5" y="3" width="6" height="4.5" rx="1.2" />
      <rect x="11.5" y="12.5" width="6" height="4.5" rx="1.2" />
      <path d="M5.5 7.5v3.5a2 2 0 0 0 2 2h4" />
      <path d="M10 11.2l1.6 1.8-1.6 1.8" />
      <circle cx="14.5" cy="5.2" r="2.2" />
    </svg>
  )
}

/** A check against a target line. */
export function IconValidation({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M10 2.5l6 2.3v4.6c0 3.8-2.6 6.6-6 8.1-3.4-1.5-6-4.3-6-8.1V4.8z" />
      <path d="M7.2 10l2 2 3.8-4" />
    </svg>
  )
}

/** Clock with a return arrow. */
export function IconHistory({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3.5 10a6.5 6.5 0 1 0 2-4.7" />
      <path d="M3 3.5v2.8h2.8" />
      <path d="M10 6.5V10l2.5 1.6" />
    </svg>
  )
}

export function IconPlay({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6.5 4.5v11l9-5.5z" fill="currentColor" />
    </svg>
  )
}

export function IconPause({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="5" y="4.5" width="3" height="11" rx="0.6" fill="currentColor" />
      <rect x="12" y="4.5" width="3" height="11" rx="0.6" fill="currentColor" />
    </svg>
  )
}

export function IconReset({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4.5 10a5.5 5.5 0 1 0 1.7-4" />
      <path d="M4 3.5V7h3.5" />
    </svg>
  )
}

export function IconEnd({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4.5 4.5v11l7.5-5.5z" fill="currentColor" />
      <path d="M15 4.5v11" />
    </svg>
  )
}

export function IconDownload({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M10 3v10M6 9.5l4 4 4-4M4 16.5h12" />
    </svg>
  )
}

export function IconSliders({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 6h8M15 6h2M3 14h2M9 14h8" />
      <circle cx="13" cy="6" r="2" />
      <circle cx="7" cy="14" r="2" />
    </svg>
  )
}

export function IconExpand({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3.5 7.5v-4h4M16.5 7.5v-4h-4M3.5 12.5v4h4M16.5 12.5v4h-4" />
    </svg>
  )
}

export function IconChevron({ size = 16, dir = 'right' }: IconProps & { dir?: 'left' | 'right' }) {
  return (
    <svg {...base(size)}>
      <path d={dir === 'right' ? 'M8 4.5l5.5 5.5L8 15.5' : 'M12 4.5L6.5 10l5.5 5.5'} />
    </svg>
  )
}

export function IconInfo({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 9v5" />
      <circle cx="10" cy="6.3" r="0.6" fill="currentColor" />
    </svg>
  )
}

/** Logomark: three checkout lanes, each with a queue of a different length. */
export function Logomark({ size = 30 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="0.5" y="0.5" width="31" height="31" rx="7" fill="#ffffff" fillOpacity="0.08" stroke="#ffffff" strokeOpacity="0.18" />
      {[8, 16, 24].map((x, i) => (
        <g key={x}>
          <rect x={x - 2.2} y="23" width="4.4" height="3.2" rx="1" fill="#ffffff" />
          {Array.from({ length: [3, 1, 2][i] }, (_, k) => (
            <circle key={k} cx={x} cy={19 - k * 4.6} r="1.7" fill={k % 2 === 0 ? '#d6cefc' : '#a99af3'} />
          ))}
        </g>
      ))}
    </svg>
  )
}
