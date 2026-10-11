import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LangProvider } from '@/lib/language'
import Landing from '@/pages/Landing'
import AnimatedBackground from '@/sections/AnimatedBackground'
import MaintenanceOverlay from '@/sections/MaintenanceOverlay'

// true = bakım ekranı aktif
const MAINTENANCE_MODE = true

export default function App() {
  if (MAINTENANCE_MODE) {
    return (
      <BrowserRouter>
        <LangProvider>
          <MaintenanceOverlay />
        </LangProvider>
      </BrowserRouter>
    )
  }
  return (
    <BrowserRouter>
      <LangProvider>
        <AnimatedBackground />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </LangProvider>
    </BrowserRouter>
  )
}
