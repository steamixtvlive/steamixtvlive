import type { GeilItem } from './types'
import { channelStation, qualityRank } from './api'

/** The viewer's own national line-up: every station they listed, in the order they listed it,
    as one ready-made category. Providers scatter these stations across their own groups and
    repeat each one per picture quality, so the category is matched against the live catalogue at
    runtime — a station only appears when the provider actually serves it, on its best variant. */
export const NATIONAL_GROUP_ID = 'turkiye-ulusal'
export const NATIONAL_GROUP_NAME = 'Türkiye Ulusal'

/** The provider writes the same station several ways ('360' and '360 TV', 'NOW' and 'NOW TV'),
    so an entry may carry alternatives separated by "|". */
const STATIONS = [
  'TRT 1 HD',
  'TRT 2 HD',
  'TRT Haber',
  'TRT Spor|TRTSPOR',
  'TRT Spor Yıldız',
  'TRT Belgesel',
  'TRT Çocuk',
  'TRT Müzik',
  'TRT Türk',
  'TRT Avaz',
  'Star TV HD|Star',
  'Show TV HD|Show',
  'Kanal D HD|Kanal D',
  'ATV HD|ATV',
  'NOW TV HD|NOW|Fox TV|Fox',
  'TV8 HD|TV 8',
  'Kanal 7 HD|Kanal 7',
  'Beyaz TV HD|Beyaz',
  'TGRT Haber HD',
  'TV8,5 HD|TV8.5|TV 8.5',
  'Teve2 HD',
  '360 TV|360',
  'TLC Türkiye|TLC',
  'DMAX Türkiye|DMAX',
  'Flash Haber TV|Flash Haber',
  'Tele 1|Tele1',
  'Habertürk HD|Habertuerk',
  'CNN Türk HD|CNN Turk',
  'NTV HD|NTV',
  'A Haber HD',
  'Sözcü TV|Sozcu',
  'Halk TV|Halk',
  'TV100|TV 100',
  'KRT TV|KRT',
  '24 TV|24',
  'Ülke TV|Ulke',
  'Bloomberg HT',
  'TGRT Belgesel',
  'Ekotürk|Ekoturk',
  'A Para',
  'Sinema TV',
  'Sinema TV 2',
  'Sinema Aksiyon',
  'Sinema Aile',
  'Sinema Komedi',
  'Sinema Yerli',
  'FilmBox HD|Filmbox',
  'BeIN Movies Premiere HD|beIN Movies Premiere|BeeIN Movies Premiere',
  'BeIN Movies Stars HD|beIN Movies Stars',
  'BeIN Movies Action HD|beIN Movies Action',
  'BeIN Movies Family HD|beIN Movies Family',
  'BeIN Movies Comedy HD|beIN Movies Comedy',
  'Tivibu Sinema 1',
  'Tivibu Sinema 2',
  'S Cinema',
  'Smart Sinema',
  'Movie Smart Platin',
  'Movie Smart Gold',
  'Turkishtime Sinema',
  'Aksiyon Türk|Aksiyon Turkmovie',
  'BeIN Sports 1 HD|beIN Sports 1',
  'BeIN Sports 2 HD|beIN Sports 2',
  'BeIN Sports 3 HD|beIN Sports 3',
  'BeIN Sports 4 HD|beIN Sports 4',
  'BeIN Sports 5 HD|beIN Sports 5',
  'BeIN Sports Haber|beIN Sports Haber',
  'S Sport 1 HD|S Sport|S-SPORT 1',
  'S Sport 2 HD|S Sport 2',
  'S Sport Plus',
  'Tivibu Spor 1',
  'Tivibu Spor 2',
  'Tivibu Spor 3',
  'Tivibu Spor 4',
  'Exxen Spor 1|Exxen TV Spor 1',
  'Exxen Spor 2|Exxen Sports 2',
  'Exxen Spor 3|Exxen Sports 3',
  'Exxen Spor 4|Exxen Sports 4',
  'Smart Spor HD',
  'Spor Smart 2',
  'TRT Spor 2|TRT Spor Yildiz 2',
  'A Spor HD|A Spor',
  'TJK TV|TJK',
  'FB TV|FB',
  'GS TV|GS',
  'BJK TV|BJK',
  'Eurosport 1 HD',
  'Eurosport 2 HD',
  'Motorsport TV|Motorsport',
  'Fight Network',
  'Sports TV|Sports',
  'National Geographic HD|Nat Geo|National Geographic',
  'National Geographic Wild HD|Nat Geo Wild|National Geographic Wild',
  'Discovery Channel HD|Discovery',
  'Discovery Science HD',
  'Animal Planet HD',
  'BBC Earth HD|BBC Earth',
  'History Channel HD|History',
  'Love Nature HD',
  'Viasat History',
  'Viasat Explore',
  'Viasat Nature',
  'Crime + Investigation|Crime and Investigation|Crime Investigation',
  'Food Network',
  'HGTV',
  'Travel Channel|Travel',
  'ID Discovery|Investigation Discovery',
  'TRT Docu',
  'Da Vinci Kids',
  'CNN International',
  'BBC World News',
  'Al Jazeera English',
  'France 24 English|France 24',
  'DW English|DW',
  'Euronews Türkçe|Euronews Turkce|Euronews',
  'TRT World HD',
  'TRT Arabi',
  'TRT Kurdi',
  'TRT Int|TRT Turk',
  'TRT Müzik HD',
  'Kral TV|KRAL',
  'Kral Pop TV|Kral Pop',
  'Number One Türk|Number One|Number 1 Turk',
  'Number One TV|Number One|Number1 TV',
  'Power Türk|Power Turk',
  'Power TV',
  'Dream Türk|Dream Turk',
  'MTV Hits',
  'MTV 90s',
  'MTV 80s',
  'Club MTV',
  'Trace Urban',
  'Mezzo HD|Mezzo',
  'Deluxe Music',
  'Power Love',
  'Kral Akustik',
  'TRT Çocuk HD',
  'Cartoon Network',
  'Disney Channel',
  'Disney Junior',
  'Minika GO|Minika Go',
  'Minika Çocuk',
  'Boomerang HD|Boomerang',
  'Nick Jr.|Nick Jr',
  'Nickelodeon',
  'Duck TV|Duck',
  'Baby TV|Baby',
  'JimJam',
  'Tiji',
  'TRT Diyanet Çocuk',
  'Cartoonito',
  'Diyanet TV|Diyanet',
  'Diyanet Kur\'an|Diyanet Kurani|Kuran TV',
  'Dost TV|Dost',
  'Hilal TV|Hilal',
  'Semerkand TV|Semerkand',
  'Berat TV|Berat',
  'Vuslat TV|Vuslat',
  'Kabe Canlı (Mekke)|Kabe|Kaaba|Mekke',
  'Medine Canlı|Medine',
  'Olay TV (Karadeniz)|Olay TV|Olay',
  'Karadeniz TV|Karadeniz BRTV|Mavi Karadeniz',
  'Kontv|Kon TV',
  'Kanal 26',
  'Bursa Hakimiyet TV|Bursa Hakimiyet',
  'Edirne TV|Edirne',
  'Ordu TV|Ordu',
  'Ordu Medya TV|Ordu Medya',
  'TV 52|TV52',
  'Çay TV|Cay',
  'Güven TV|Guven',
  'Kadırga TV|Kadirga',
  'Akdeniz TV|Akdeniz',
  'Ege TV|Ege|Ege Turk TV',
  'Meltem TV|Meltem',
  'Mesudiye TV|Mesudiye',
  'Ünye TV|Unye',
  'Fatsa Güneş TV|Fatsa Gunes',
  'Denizli RTV|Denizli Deha TV',
  'Kayseri Mega TV|Kayseri|TV Kayseri',
  'Konya TV|Konya',
  'Van TV|Van',
  'Diyar TV|Diyar',
  'Line TV Bursa|Line TV',
  'DRT Denizli',
  'Antalya TV|Antalya',
  'Alanya TV|Alanya',
  'Manisa TV|Manisa|ETV Manisa',
  'Sakarya TV|Sakarya',
  'Kocaeli TV|Kocaeli',
  'Tek Rumeli TV|Tek Rumeli|Rumeli TV',
  'TGRT FM Görsel|TGRT FM',
  'Kral FM Görsel|Kral FM',
  'Power FM Görsel|Power FM',
  'Süper FM Görsel|Super FM',
  'Metro FM Görsel|Metro FM',
  'Alem FM Görsel|Alem FM',
  'Show Radyo Görsel|Show Radyo',
  'Joy Turk Görsel|Joy Turk|JoyTurk',
  'Slow Türk Görsel|Slow Turk',
  'TRT Nağme Görsel|TRT NAGME|TRT Nağme',
]

const TURKISH_FOLD: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u', '’': '', "'": '',
}

/** 'TV8,5 HD', '(7)'-suffixes and '4K TR:' decorations all collapse to the same bare key, so the
    viewer's spelling and the provider's spelling meet in the middle. */
function foldKey(value: string): string {
  const stripped = channelStation(value).toLocaleLowerCase('tr')
  let out = ''
  for (const char of stripped) {
    const folded = TURKISH_FOLD[char] ?? char
    if (/[a-z0-9]/.test(folded)) out += folded
  }
  return out
}

type Pool = Array<{ key: string; item: GeilItem }>

function pick(pool: Pool, key: string): GeilItem | null {
  let best: GeilItem | null = null
  for (const entry of pool) {
    if (entry.key !== key) continue
    if (!best || qualityRank(entry.item.name) > qualityRank(best.name)) best = entry.item
  }
  if (best) return best
  // Providers shorten names ('360' for '360 TV'); accept the closest prefix rather than dropping
  // a station the viewer asked for, but only when one candidate clearly sits nearest.
  let runner: { key: string; item: GeilItem } | null = null
  for (const entry of pool) {
    const shares = entry.key.startsWith(key) || key.startsWith(entry.key)
    if (!shares || Math.min(entry.key.length, key.length) < 4) continue
    if (!runner || Math.abs(entry.key.length - key.length) < Math.abs(runner.key.length - key.length)) runner = entry
  }
  return runner?.item || null
}

export function nationalChannels(items: GeilItem[]): GeilItem[] {
  const pool: Pool = []
  for (const item of items) {
    const key = foldKey(item.name)
    if (key) pool.push({ key, item })
  }
  const taken = new Set<string>()
  const out: GeilItem[] = []
  for (const station of STATIONS) {
    for (const alternative of station.split('|')) {
      const hit = pick(pool, foldKey(alternative))
      if (hit && !taken.has(hit.id)) {
        taken.add(hit.id)
        out.push(hit)
        break
      }
    }
  }
  return out
}

/** Names the viewer asked for that the live catalogue does not carry — the reason a station is
    missing from the category instead of silently dropped. */
export function nationalMissing(items: GeilItem[]): string[] {
  const keys = new Set(items.map((item) => foldKey(item.name)))
  const missing: string[] = []
  for (const station of STATIONS) {
    const alternatives = station.split('|').map(foldKey)
    if (!alternatives.some((key) => keys.has(key))) missing.push(alternatives[0])
  }
  return missing
}
