import { BrowserRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import NotflixSplash from '@/sections/NotflixSplash'
import GeilApp from '@/geil/GeilApp'
import NotflixVodWatch from '@/pages/NotflixVodWatch'
import { useEffect, useState } from 'react'

export default function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>
}

function AppContent() {
  const location = useLocation()
  const isVodWatch = location.pathname.startsWith('/notflix/watch/')
  const [showSplash, setShowSplash] = useState(() => {
    try {
      const lastShown = Number(localStorage.getItem('notflix_splash_last_shown') || 0)
      return !lastShown || Date.now() - lastShown >= 24 * 60 * 60 * 1000
    } catch { return true }
  })

  useEffect(() => {
    if (!showSplash) return
    try { localStorage.setItem('notflix_splash_last_shown', String(Date.now())) } catch { /* Splash still works without storage. */ }
  }, [showSplash])

  return (
    <>
      {isVodWatch ? (
        <Routes><Route path="/notflix/watch/:type/:id" element={<NotflixVodWatch />} /><Route path="*" element={<NotflixVodWatch />} /></Routes>
      ) : (
        <div className="notflix-app-enter nf-shell-enter">
          <GeilApp />
        </div>
      )}
      {showSplash && !isVodWatch && <NotflixSplash onDone={() => setShowSplash(false)} />}
    </>
  )
}
