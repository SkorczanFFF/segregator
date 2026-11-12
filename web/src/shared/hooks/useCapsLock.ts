import { useState, type KeyboardEvent } from 'react'

// Tracks Caps Lock while a password field has focus.
export function useCapsLock() {
  const [capsLock, setCapsLock] = useState(false)
  return {
    capsLock,
    onKeyUp: (event: KeyboardEvent) => setCapsLock(event.getModifierState('CapsLock')),
    reset: () => setCapsLock(false),
  }
}
