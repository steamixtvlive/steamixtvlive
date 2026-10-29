import { Compass, History, Home, Info, LayoutTemplate, Settings, type LucideIcon } from 'lucide-react'
import { PAGE_TITLES, type PageId } from '@/lib/navigation'

type TemplatePageId = Exclude<PageId, 'live'>

const TEMPLATE_COPY: Record<
  TemplatePageId,
  { eyebrow: string; description: string; icon: LucideIcon }
> = {
  home: {
    eyebrow: 'ANA SAYFA ŞABLONU',
    description: 'Kişiselleştirilmiş ana sayfa akışı için ayrılmış boş alan.',
    icon: Home,
  },
  discover: {
    eyebrow: 'KEŞFET ŞABLONU',
    description: 'Film, dizi ve yeni içerik keşif alanı için ayrılmış boş alan.',
    icon: Compass,
  },
  continue: {
    eyebrow: 'DEVAM ET ŞABLONU',
    description: 'Yarım kalan içerikler ve izleme geçmişi için ayrılmış boş alan.',
    icon: History,
  },
  about: {
    eyebrow: 'HAKKINDA ŞABLONU',
    description: 'NOTFLİX ve RENDİR MEDİA bilgileri için ayrılmış boş alan.',
    icon: Info,
  },
  settings: {
    eyebrow: 'AYARLAR ŞABLONU',
    description: 'Hesap, oynatıcı ve uygulama tercihleri için ayrılmış boş alan.',
    icon: Settings,
  },
}

interface NotflixTemplatePageProps {
  page: TemplatePageId
}

export default function NotflixTemplatePage({ page }: NotflixTemplatePageProps) {
  const copy = TEMPLATE_COPY[page]
  const Icon = copy.icon

  return (
    <section className="nf-template" aria-labelledby={`template-title-${page}`}>
      <header className="nf-template__head">
        <span className="nf-kicker">
          <LayoutTemplate size={13} />
          {copy.eyebrow}
        </span>
        <h1 id={`template-title-${page}`}>{PAGE_TITLES[page]}</h1>
        <p>{copy.description}</p>
      </header>

      <div className="nf-template__canvas">
        <span className="nf-template__watermark" aria-hidden="true">
          N
        </span>
        <div className="nf-template__placeholder">
          <span className="nf-template__icon">
            <Icon size={22} strokeWidth={1.7} />
          </span>
          <strong>İçerik alanı hazır</strong>
          <p>Bu sayfa boş şablon olarak bırakıldı.</p>
        </div>
        <span className="nf-template__corner">
          <i />
          NOTFLİX · 2027
        </span>
      </div>
    </section>
  )
}
