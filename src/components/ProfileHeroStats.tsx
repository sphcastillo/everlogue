'use client'

import {useEffect, useState} from 'react'

function pad(count: number) {
  return String(count).padStart(2, '0')
}

export function ProfileHeroStats({
  ratings,
  reviews,
  recommendations,
}: {
  ratings: number
  reviews: number
  recommendations: number
}) {
  const [recommendationCount, setRecommendationCount] = useState(recommendations)

  useEffect(() => {
    function onCount(event: Event) {
      const count = (event as CustomEvent<number>).detail
      if (typeof count === 'number' && Number.isFinite(count)) setRecommendationCount(count)
    }
    function onCleared() {
      setRecommendationCount(0)
    }
    window.addEventListener('everlogue:companion-recommendations', onCount)
    window.addEventListener('everlogue:companion-history-cleared', onCleared)
    return () => {
      window.removeEventListener('everlogue:companion-recommendations', onCount)
      window.removeEventListener('everlogue:companion-history-cleared', onCleared)
    }
  }, [])

  return (
    <dl className="flex gap-8 sm:gap-12">
      <div className="text-right">
        <dt className="sr-only">Ratings</dt>
        <dd className="font-display text-[1.85rem] leading-none font-black tracking-[-0.06em]">{pad(ratings)}</dd>
        <p className="mt-2 font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase">Ratings</p>
      </div>
      <div className="text-right">
        <dt className="sr-only">Reviews</dt>
        <dd className="font-display text-[1.85rem] leading-none font-black tracking-[-0.06em]">{pad(reviews)}</dd>
        <p className="mt-2 font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase">Reviews</p>
      </div>
      <div className="text-right">
        <dt className="sr-only">Recommendations</dt>
        <dd className="font-display text-[1.85rem] leading-none font-black tracking-[-0.06em]">{pad(recommendationCount)}</dd>
        <p className="mt-2 font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase">Recommendations</p>
      </div>
    </dl>
  )
}
