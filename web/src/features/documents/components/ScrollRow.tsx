import { useEffect, useRef, type ComponentProps } from 'react'
import classes from '~/features/documents/components/filters.module.css'

// Remembers on this device that the row has shown it moves.
const NUDGED_KEY = 'filtersNudged'

// How far the row slides to show it moves: most of a button.
const NUDGE_DISTANCE = 56

function nudgedBefore() {
  try {
    return localStorage.getItem(NUDGED_KEY) !== null
  } catch {
    return false
  }
}

function rememberNudge() {
  try {
    localStorage.setItem(NUDGED_KEY, '1')
  } catch {
    // Without storage the row shows it again next time.
  }
}

// Marks the edges that have more of the row behind them.
function markEdges(row: HTMLElement) {
  row.toggleAttribute('data-more-start', row.scrollLeft > 1)
  row.toggleAttribute('data-more-end', row.scrollLeft + row.clientWidth < row.scrollWidth - 1)
}

type ScrollRowProps = ComponentProps<'div'> & {
  // Slides a little and back the first time it shows on this device, so it is plain that it moves.
  nudge?: boolean
}

// A row of buttons that scrolls sideways. An edge with more buttons behind it fades out.
export default function ScrollRow({ nudge = false, className, ...props }: ScrollRowProps) {
  const ref = useRef<HTMLDivElement>(null)

  // After every render too, as the buttons inside change width when chosen.
  useEffect(() => {
    if (ref.current) markEdges(ref.current)
  })

  useEffect(() => {
    const row = ref.current
    if (!row) return
    const update = () => markEdges(row)
    row.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(row)
    return () => {
      row.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const row = ref.current
    if (!nudge || !row || row.scrollWidth <= row.clientWidth || nudgedBefore()) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // A row the person has already moved needs no showing, and one they hold stays where they put it.
    const there = setTimeout(() => {
      rememberNudge()
      if (row.scrollLeft === 0) row.scrollTo({ left: NUDGE_DISTANCE, behavior: 'smooth' })
    }, 600)
    const back = setTimeout(() => {
      if (Math.abs(row.scrollLeft - NUDGE_DISTANCE) < 2) row.scrollTo({ left: 0, behavior: 'smooth' })
    }, 1300)
    return () => {
      clearTimeout(there)
      clearTimeout(back)
    }
  }, [nudge])

  return <div ref={ref} className={`${classes.scroller} ${className ?? ''}`} {...props} />
}
