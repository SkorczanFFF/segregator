import type { ComponentProps } from 'react'

// In a 20 by 38 box, as public/logo.svg draws it for the browser tab.
const BODY = 'M3 0h14a3 3 0 0 1 3 3v32a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3z'
const HOLE = 'M10 23.8a4.2 4.2 0 1 0 0 8.4a4.2 4.2 0 1 0 0-8.4z'
const LABEL = 'M5.5 5h9a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 12.5v-6A1.5 1.5 0 0 1 5.5 5z'

type SpineMarkProps = ComponentProps<'svg'> & {
  // The spine's and its label's colors. Without them the mark takes the text color, with the label cut out.
  colors?: { body: string; label: string }
}

// The brand's mark, a binder's spine: a label at the top and the hole for a finger below, cut out so the ground
// shows through.
export default function SpineMark({ colors, ...props }: SpineMarkProps) {
  return (
    <svg viewBox="0 0 20 38" aria-hidden {...props}>
      {colors ? (
        <>
          <path fillRule="evenodd" fill={colors.body} d={BODY + HOLE} />
          <path fill={colors.label} d={LABEL} />
        </>
      ) : (
        <path fillRule="evenodd" fill="currentColor" d={BODY + HOLE + LABEL} />
      )}
    </svg>
  )
}
