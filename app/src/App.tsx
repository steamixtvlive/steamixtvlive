import { useCallback, useState } from 'react'
import NotflixSplash from '@/sections/NotflixSplash'
import NotflixLogin from '@/pages/NotflixLogin'
import NotflixLoading from '@/pages/NotflixLoading'
import NotflixShell from '@/sections/NotflixShell'
import type { VavooCatalog } from '@/lib/vavoo'

type Stage = 'splash' | 'login' | 'loading' | 'app'

export default function App() {
  const [stage, setStage] = useState<Stage>('splash')
  const [catalog, setCatalog] = useState<VavooCatalog | null>(null)

  const handleReady = useCallback((nextCatalog: VavooCatalog) => {
    setCatalog(nextCatalog)
    setStage('app')
  }, [])

  return (
    <>
      {stage === 'splash' && <NotflixSplash onDone={() => setStage('login')} />}

      {stage === 'login' && (
        <div className="notflix-app-enter">
          <NotflixLogin onActivated={() => setStage('loading')} />
        </div>
      )}

      {stage === 'loading' && (
        <NotflixLoading onReady={handleReady} onCancel={() => setStage('login')} />
      )}

      {stage === 'app' && catalog && (
        <div className="notflix-app-enter nf-shell-enter">
          <NotflixShell catalog={catalog} />
        </div>
      )}
    </>
  )
}
