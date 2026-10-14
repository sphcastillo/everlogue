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
        <dd>
          <a href="#profile-ratings" className="group block">
            <span className="block font-display text-[1.85rem] leading-none font-black tracking-[-0.06em]">{pad(ratings)}</span>
            <span className="mt-2 block font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase group-hover:text-ink">Ratings</span>
          </a>
        </dd>
      </div>
      <div className="text-right">
        <dt className="sr-only">Reviews</dt>
        <dd>
          <a href="#profile-reviews" className="group block">
            <span className="block font-display text-[1.85rem] leading-none font-black tracking-[-0.06em]">{pad(reviews)}</span>
            <span className="mt-2 block font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase group-hover:text-ink">Reviews</span>
          </a>
        </dd>
      </div>
      <div className="text-right">
        <dt className="sr-only">Recommendations</dt>
        <dd>
          <a href="#profile-recommendations" className="group block">
            <span className="block font-display text-[1.85rem] leading-none font-black tracking-[-0.06em]">{pad(recommendationCount)}</span>
            <span className="mt-2 block font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase group-hover:text-ink">Recommendations</span>
          </a>
        </dd>
      </div>
    </dl>
  )
}
