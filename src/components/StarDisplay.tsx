const STAR_PATH =
  'M12 2.6 14.7 9l6.8.6-5.2 4.5 1.6 6.6L12 17.8 6.1 20.7 7.7 14.1 2.5 9.6 9.3 9z'

export function fillFor(star: number, value: number | null) {
  if (value === null || Number.isNaN(value)) return 0
  if (value >= star) return 1
  if (value >= star - 0.5) return 0.5
  return 0
}

export function formatRating(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

export function StarGlyph({fill, clipId}: {fill: 0 | 0.5 | 1; clipId: string}) {
  return (
    <svg viewBox="0 0 24 24" className="star-glyph" aria-hidden="true">
      {fill === 0.5 ? (
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width="12" height="24" />
          </clipPath>
        </defs>
      ) : null}
      <path d={STAR_PATH} className="star-glyph-empty" />
      {fill > 0 ? (
        <path
          d={STAR_PATH}
          className="star-glyph-fill"
          clipPath={fill === 0.5 ? `url(#${clipId})` : undefined}
        />
      ) : null}
    </svg>
  )
}

export function StarDisplay({
  value,
  id,
  size = 'md',
}: {
  value: number
  id: string
  size?: 'sm' | 'md'
}) {
  const safe = Number(value)
  const clip = id.replace(/[^a-zA-Z0-9_-]/g, '')
  return (
    <span
      className={`inline-flex items-center ${size === 'sm' ? 'gap-px' : 'gap-0.5'}`}
      aria-label={`${formatRating(safe)} stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={size === 'sm' ? 'inline-block size-4' : 'star-pair'}
        >
          <StarGlyph fill={fillFor(star, safe) as 0 | 0.5 | 1} clipId={`${clip}-${star}`} />
        </span>
      ))}
    </span>
  )
}
