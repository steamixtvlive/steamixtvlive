import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import NotflixSplash from '@/sections/NotflixSplash'
import GeilApp from '@/geil/GeilApp'
import NotflixVodWatch from '@/pages/NotflixVodWatch'
import { useEffect, useRef, useState } from 'react'

const IDLE_LIMIT_MS = 10 * 60 * 1000
const SPLASH_KEY = 'notflix_splash_last_shown'

function shouldShowStartSplash(): boolean {
  try {
    const lastShown = Number(localStorage.getItem(SPLASH_KEY) || 0)
    return !lastShown || Date.now() - lastShown >= 24 * 60 * 60 * 1000
  } catch {
    return true
  }
}

export default function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>
}

function AppContent() {
  const location = useLocation()
  const isVodWatch = location.pathname.startsWith('/notflix/watch/')
  const [showSplash, setShowSplash] = useState(shouldShowStartSplash)
  const [splashKey, setSplashKey] = useState(0)
  const [resetKey, setResetKey] = useState(0)
  const idleTimer = useRef<number | null>(null)
  const initialSplash = useRef(showSplash)

  useEffect(() => {
    if (!initialSplash.current) return
    try { localStorage.setItem(SPLASH_KEY, String(Date.now())) } catch { /* Splash still works without storage. */ }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('splash-lock', showSplash && !isVodWatch)
    return () => document.documentElement.classList.remove('splash-lock')
  }, [showSplash, isVodWatch])

  useEffect(() => {
    if (isVodWatch) return
    const arm = () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current)
      idleTimer.current = window.setTimeout(() => {
        window.history.replaceState({ notflixRoute: '#/' }, '', '#/')
        setResetKey((value) => value + 1)
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
  }, [isVodWatch])

  return (
    <>
      {isVodWatch ? (
        <Routes><Route path="/notflix/watch/:type/:id" element={<NotflixVodWatch />} /><Route path="*" element={<NotflixVodWatch />} /></Routes>
      ) : (
        <div className="notflix-app-enter nf-shell-enter" key={resetKey}>
          <GeilApp />
        </div>
      )}
      {showSplash && !isVodWatch && <NotflixSplash key={splashKey} onDone={() => setShowSplash(false)} />}
    </>
  )
}
