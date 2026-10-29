import { useState } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import NotflixLogo from '@/sections/NotflixLogo'

export default function NotflixEmbed() {
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  return (
    <section className="nf-embed" aria-label="NOTFLİX içerik kitaplığı">
      <div className="nf-embed__brand-stamp" aria-label="NOTFLİX"><NotflixLogo /></div>
      {failed ? (
        <div className="nf-embed__error" role="alert">
          <AlertTriangle size={27} />
          <h1>Kitaplık açılamadı</h1>
          <p>İçerik sağlayıcısı çerçeve içinde açılmaya izin vermiyor veya şu an yanıt vermiyor.</p>
          <button type="button" onClick={() => { setFailed(false); setReloadKey((key) => key + 1) }}><RotateCcw size={17}/> Yeniden dene</button>
        </div>
      ) : (
        <iframe
          key={reloadKey}
          className="nf-embed__frame"
          src="https://geil.to/"
          title="NOTFLİX içerikleri"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setFailed(false)}
        />
      )}
    </section>
  )
}
