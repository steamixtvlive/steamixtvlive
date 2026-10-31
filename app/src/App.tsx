import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import NotflixSplash from '@/sections/NotflixSplash'
import NotflixActivation from '@/sections/NotflixActivation'
import GeilApp from '@/geil/GeilApp'
import NotflixVodWatch from '@/pages/NotflixVodWatch'
import { useEffect, useRef, useState } from 'react'
import { isActivated } from '@/geil/storage'

const IDLE_LIMIT_MS = 10 * 60 * 1000
const IDLE_SPLASH_SECONDS = 12

export default function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>
}

function AppContent() {
  const location = useLocation()
  const isVodWatch = location.pathname.startsWith('/notflix/watch/')
  const [activated, setActivated] = useState(isActivated)
  const [showSplash, setShowSplash] = useState(true)
  const [splashSeconds, setSplashSeconds] = useState(0)
  const [splashKey, setSplashKey] = useState(0)
  const [resetKey, setResetKey] = useState(0)
  const idleTimer = useRef<number | null>(null)

  useEffect(() => {
    const handler = () => setActivated(false)
    window.addEventListener('notflix-activation-reset', handler)
    return () => window.removeEventListener('notflix-activation-reset', handler)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('splash-lock', (showSplash || !activated) && !isVodWatch)
    return () => document.documentElement.classList.remove('splash-lock')
  }, [showSplash, activated, isVodWatch])

  useEffect(() => {
    if (isVodWatch || !activated) return
    const arm = () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current)
      idleTimer.current = window.setTimeout(() => {
        window.history.replaceState({ notflixRoute: '#/' }, '', '#/')
        setResetKey((value) => value + 1)
        setSplashSeconds(IDLE_SPLASH_SECONDS)
        setSplashKey((value) => value + 1)
        setShowSplash(true)
      }, IDLE_LIMIT_MS)
    }
    const events: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel']
    const onActivity = () => arm()
    events.forEach((name) => window.addEventListener(name, onActivity, { passive: true }))
    arm()
    return () => {
      events.forEach((name) => window.removeEventListener(name, onActivity))
      if (idleTimer.current) window.clearTimeout(idleTimer.current)
    }
  }, [isVodWatch, activated])

  function handleActivated() {
    setActivated(true)
    setSplashSeconds(0)
    setSplashKey((value) => value + 1)
    setShowSplash(true)
  }

  if (!activated) return <NotflixActivation onActivated={handleActivated} />

  return (
    <>
      {isVodWatch ? (
        <Routes><Route path="/notflix/watch/:type/:id" element={<NotflixVodWatch />} /><Route path="*" element={<NotflixVodWatch />} /></Routes>
      ) : (
        <div className="notflix-app-enter nf-shell-enter" key={resetKey}>
          <GeilApp />
        </div>
      )}
      {showSplash && !isVodWatch && (
        <NotflixSplash key={splashKey} seconds={splashSeconds} onDone={() => setShowSplash(false)} />
      )}
    </>
  )
}
