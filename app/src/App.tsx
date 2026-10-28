import { useState } from 'react'
import NotflixSplash from '@/sections/NotflixSplash'
import NotflixHome from '@/pages/NotflixHome'

export default function App() {
  const [introDone, setIntroDone] = useState(false)

  return (
    <>
      {introDone && (
        <div className="notflix-app-enter">
          <NotflixHome />
        </div>
      )}
      {!introDone && <NotflixSplash onDone={() => setIntroDone(true)} />}
    </>
  )
}
