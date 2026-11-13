# NOTFLİX — Tanıtım Sitesi

Modern, mobil uyumlu tek sayfalık tanıtım sitesi. Uygulamanın kendi renk paletinden
(`Theme.kt`) alınmış kırmızı-merkezli koyu tema kullanır.

## Yapı

```
index.html              # tek sayfa (hero, slider, özellikler, adımlar, indir, SSS, footer)
assets/css/styles.css   # tasarım sistemi + responsive
assets/js/main.js       # slider, akordiyon, scroll spy, reveal animasyonları
assets/img/logo.svg     # marka logosu
assets/img/favicon.svg  # favicon
render.yaml             # Render Static Site blueprint (publish path: kök)
robots.txt / sitemap.xml
```

## Deploy (Render)

1. Render'da **New → Static Site** → repo: `steamixtvlive/steamixtvlive`
2. **Publish path**: `.` (kök klasör) — `build command` boş bırakılabilir.
   Alternatif olarak repodaki `render.yaml` blueprint'i kullanılabilir.
3. Site adresi: `https://notflixlive.onrender.com`

Git'e push yapıldığında Render otomatik yeniden deploy eder.

## İndirme bağlantıları

- Site adresi: `https://notflixlive.onrender.com`
- İndirme bölümü: `https://notflixlive.onrender.com/#indir`
- Android / Android TV (APK):
  `https://www.dropbox.com/scl/fi/v4fkjh9hf1rqvv7twls50/notflix.apk?rlkey=hbtfqitdl57zykf9jfu6i27xp&st=noeu08rr&dl=1`

## Marka

© **RENDIR MEDİA 2027** — TÜM HAKLARI SAKLIDIR
