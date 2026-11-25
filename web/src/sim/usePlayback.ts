import { useCallback, useEffect, useRef, useState } from 'react'

// Playback clock for replaying a finished simulation.
// `timeRef` changes every animation frame (read by the canvas);
// `time` is React state refreshed about 10 times per second (for text and slider).

export type PlayState = 'idle' | 'playing' | 'paused' | 'finished'

export function usePlayback(duration: number) {
  const timeRef = useRef(0)
  const [time, setTime] = useState(0)
  const [state, setState] = useState<PlayState>('idle')
  const [speed, setSpeed] = useState(5) // simulated minutes per real second
  const speedRef = useRef(speed)
  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    if (state !== 'playing') return
    let frame = 0
    let last = performance.now()
    let lastUi = 0
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      timeRef.current = Math.min(duration, timeRef.current + dt * speedRef.current)
      if (now - lastUi > 100) {
        lastUi = now
        setTime(timeRef.current)
      }
      if (timeRef.current >= duration) {
        setTime(duration)
        setState('finished')
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [state, duration])

  const seek = useCallback(
    (t: number) => {
      timeRef.current = Math.max(0, Math.min(duration, t))
      setTime(timeRef.current)
      if (timeRef.current >= duration) setState('finished')
      else setState((s) => (s === 'finished' || s === 'idle' ? 'paused' : s))
    },
    [duration],
  )

  const play = useCallback(() => {
    timeRef.current = 0
    setTime(0)
    setState('playing')
  }, [])
  const pause = useCallback(() => {
    setTime(timeRef.current) // keep text in step with the canvas
    setState((s) => (s === 'playing' ? 'paused' : s))
  }, [])
  const resume = useCallback(() => setState((s) => (s === 'paused' ? 'playing' : s)), [])
  const reset = useCallback(() => {
    timeRef.current = 0
    setTime(0)
    setState('idle')
  }, [])
  const skipToEnd = useCallback(() => seek(duration), [seek, duration])

  return { timeRef, time, state, speed, setSpeed, play, pause, resume, reset, seek, skipToEnd }
}
