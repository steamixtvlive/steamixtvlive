import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import NotflixActivation from '@/sections/NotflixActivation'
import NotflixLoading from '@/sections/NotflixLoading'
import GeilApp from '@/geil/GeilApp'
import NotflixVodWatch from '@/pages/NotflixVodWatch'
import { useEffect, useState } from 'react'
import { isActivated } from '@/geil/storage'

export default function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>
}

function AppContent() {
  const location = useLocation()
  const isVodWatch = location.pathname.startsWith('/notflix/watch/')
  const [activated, setActivated] = useState(isActivated)

  useEffect(() => {
    const handler = () => setActivated(false)
    window.addEventListener('notflix-activation-reset', handler)
    return () => window.removeEventListener('notflix-activation-reset', handler)
  }, [])

  // The ident is a cold-start ritual, not a doorbell: a viewer who has not been given a code yet
  // must be able to type it, so the shell only takes the screen once the code is in.
  if (!activated) return <><NotflixActivation onActivated={() => setActivated(true)} /><NotflixLoading intro={false} /></>

  return (
    <>
      {isVodWatch ? (
        <Routes><Route path="/notflix/watch/:type/:id" element={<NotflixVodWatch />} /><Route path="*" element={<NotflixVodWatch />} /></Routes>
      ) : (
        <div className="notflix-app-enter nf-shell-enter">
          <GeilApp />
        </div>
      )}
      <NotflixLoading />
    </>
  )
}
