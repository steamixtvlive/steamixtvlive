/**
 * Upstream subtitle entries arrive with labels such as "Altyazı - Türkçe",
 * "SubRip (eng)", "Multi-Sub EN/DE" or a bare ISO code. The player has to show
 * the plain language name only, so every shape is folded back to a code first.
 */

const CODE_NAMES: Record<string, { tr: string; en: string }> = {
  tr: { tr: 'Türkçe', en: 'Turkish' },
  en: { tr: 'İngilizce', en: 'English' },
  de: { tr: 'Almanca', en: 'German' },
  fr: { tr: 'Fransızca', en: 'French' },
  es: { tr: 'İspanyolca', en: 'Spanish' },
  it: { tr: 'İtalyanca', en: 'Italian' },
  pt: { tr: 'Portekizce', en: 'Portuguese' },
  nl: { tr: 'Felemenkçe', en: 'Dutch' },
  pl: { tr: 'Lehçe', en: 'Polish' },
  cs: { tr: 'Çekçe', en: 'Czech' },
  sv: { tr: 'İsveççe', en: 'Swedish' },
  da: { tr: 'Danca', en: 'Danish' },
  no: { tr: 'Norveççe', en: 'Norwegian' },
  fi: { tr: 'Fince', en: 'Finnish' },
  el: { tr: 'Yunanca', en: 'Greek' },
  ru: { tr: 'Rusça', en: 'Russian' },
  uk: { tr: 'Ukraynaca', en: 'Ukrainian' },
  ro: { tr: 'Rumence', en: 'Romanian' },
  hu: { tr: 'Macarca', en: 'Hungarian' },
  bg: { tr: 'Bulgarca', en: 'Bulgarian' },
  hr: { tr: 'Hırvatça', en: 'Croatian' },
  sr: { tr: 'Sırpça', en: 'Serbian' },
  bs: { tr: 'Boşnakça', en: 'Bosnian' },
  sq: { tr: 'Arnavutça', en: 'Albanian' },
  mk: { tr: 'Makedonca', en: 'Macedonian' },
  sl: { tr: 'Slovence', en: 'Slovenian' },
  sk: { tr: 'Slovakça', en: 'Slovak' },
  et: { tr: 'Estonca', en: 'Estonian' },
  lv: { tr: 'Letonca', en: 'Latvian' },
  lt: { tr: 'Litvanca', en: 'Lithuanian' },
  is: { tr: 'İzlandaca', en: 'Icelandic' },
  ga: { tr: 'İrlandaca', en: 'Irish' },
  ca: { tr: 'Katalanca', en: 'Catalan' },
  eu: { tr: 'Baskça', en: 'Basque' },
  gl: { tr: 'Galiçyaca', en: 'Galician' },
  ar: { tr: 'Arapça', en: 'Arabic' },
  fa: { tr: 'Farsça', en: 'Persian' },
  he: { tr: 'İbranice', en: 'Hebrew' },
  ku: { tr: 'Kürtçe', en: 'Kurdish' },
  az: { tr: 'Azerice', en: 'Azerbaijani' },
  kk: { tr: 'Kazakça', en: 'Kazakh' },
  hi: { tr: 'Hintçe', en: 'Hindi' },
  bn: { tr: 'Bengalce', en: 'Bengali' },
  ur: { tr: 'Urduca', en: 'Urdu' },
  ta: { tr: 'Tamilce', en: 'Tamil' },
  te: { tr: 'Teluguca', en: 'Telugu' },
  th: { tr: 'Tayca', en: 'Thai' },
  vi: { tr: 'Vietnamca', en: 'Vietnamese' },
  id: { tr: 'Endonezce', en: 'Indonesian' },
  ms: { tr: 'Malayca', en: 'Malay' },
  zh: { tr: 'Çince', en: 'Chinese' },
  ja: { tr: 'Japonca', en: 'Japanese' },
  ko: { tr: 'Korece', en: 'Korean' },
  af: { tr: 'Afrikanca', en: 'Afrikaans' },
}

const ALIASES: Record<string, string> = {
  turkce: 'tr', turkish: 'tr', turkey: 'tr', tur: 'tr', tck: 'tr',
  ingilizce: 'en', english: 'en', eng: 'en', uk: 'en', gb: 'en', us: 'en',
  almanca: 'de', deutsch: 'de', german: 'de', ger: 'de',
  fransizca: 'fr', francais: 'fr', french: 'fr', fre: 'fr', fra: 'fr',
  ispanyolca: 'es', espanol: 'es', spanish: 'es', spa: 'es',
  italyanca: 'it', italiano: 'it', italian: 'it', ita: 'it',
  portekizce: 'pt', portugues: 'pt', portuguese: 'pt', por: 'pt',
  hollandaca: 'nl', nederlands: 'nl', dutch: 'nl', hollands: 'nl', nld: 'nl', felemenkce: 'nl',
  lehce: 'pl', polski: 'pl', polish: 'pl', pol: 'pl',
  cekce: 'cs', cesky: 'cs', czech: 'cs',
  isvecce: 'sv', svensk: 'sv', swedish: 'sv', swe: 'sv',
  danca: 'da', dansk: 'da', danish: 'da', dan: 'da',
  norvecce: 'no', norsk: 'no', norwegian: 'no', nor: 'no',
  fince: 'fi', suomi: 'fi', finnish: 'fi', fin: 'fi',
  yunanca: 'el', ellinika: 'el', greek: 'el', gre: 'el',
  rusca: 'ru', russkiy: 'ru', russian: 'ru', rus: 'ru',
  ukraynca: 'uk', ukrainska: 'uk', ucrainian: 'uk', ukrainian: 'uk', ukr: 'uk',
  rumence: 'ro', romana: 'ro', romanian: 'ro', rum: 'ro',
  macarca: 'hu', magyar: 'hu', hungarian: 'hu', hun: 'hu',
  bulgarca: 'bg', bulgarian: 'bg', bul: 'bg',
  hirvatca: 'hr', croatian: 'hr', hrvatski: 'hr', hrv: 'hr',
  sirpca: 'sr', serbian: 'sr', srp: 'sr',
  bosnakca: 'bs', bosnian: 'bs', bosanski: 'bs',
  arnavutca: 'sq', albanian: 'sq', alb: 'sq',
  makedonca: 'mk', macedonian: 'mk',
  slovence: 'sl', slovenian: 'sl', slovakca: 'sk', slovak: 'sk',
  estonca: 'et', estonian: 'et',
  letonca: 'lv', latvian: 'lv', litvanca: 'lt', lithuanian: 'lt',
  islandaca: 'is', icelandic: 'is', irlandaca: 'ga', irish: 'ga',
  katalanca: 'ca', catalan: 'ca', baskca: 'eu', basque: 'eu', galicyaca: 'gl', galician: 'gl',
  arapca: 'ar', arabic: 'ar', ara: 'ar',
  farsca: 'fa', persian: 'fa', fas: 'fa',
  ibranice: 'he', hebrew: 'he', hbr: 'he', israilce: 'he',
  kurdce: 'ku', kurdish: 'ku', kurmanci: 'ku', kur: 'ku',
  azerice: 'az', azerbaijani: 'az', aze: 'az', azerbaycanca: 'az',
  kazakca: 'kk', kazakh: 'kk',
  hintce: 'hi', hindi: 'hi', hin: 'hi',
  bengalce: 'bn', bengali: 'bn', urduca: 'ur', urdu: 'ur',
  tamilce: 'ta', tamil: 'ta', teluguca: 'te', telugu: 'te',
  tayca: 'th', thai: 'th', vietnamca: 'vi', vietnamese: 'vi',
  endonezce: 'id', indonesian: 'id', malayca: 'ms', malay: 'ms',
  cince: 'zh', chinese: 'zh', chi: 'zh', mandarin: 'zh',
  japonca: 'ja', japanese: 'ja', jap: 'ja', korece: 'ko', korean: 'ko', kor: 'ko',
  afrikanca: 'af', afrikaans: 'af',
}

const NOISE = /^(altyazi|subtitles?|subs?|captions?|closed.?captions|cc|sd|hdtv|xvid|divx|subrip|srt|vtt|ass|webrip|webdl|bluray|dvdrip|multilang|multi|dualaudio|dual|audio|ses|file|dosya|film|dizi|episode|season|full|hd|engsub|traltyazi)$/i

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function subtitleLanguageCode(...candidates: Array<string | undefined | null>): string {
  for (const raw of candidates) {
    const text = normalize(String(raw || ''))
    if (!text) continue
    const tokens = text.split(' ').filter((token) => token && !NOISE.test(token))
    for (const token of tokens) {
      if (CODE_NAMES[token]) return token
      const alias = ALIASES[token]
      if (alias) return alias
    }
    for (const [alias, code] of Object.entries(ALIASES)) {
      if (alias.length >= 4 && text.includes(alias)) return code
    }
  }
  return ''
}

export function subtitleLanguageLabel(candidates: Array<string | undefined | null>, lang: string, fallback: string): string {
  const code = subtitleLanguageCode(...candidates)
  if (!code) return fallback
  return CODE_NAMES[code][lang === 'tr' ? 'tr' : 'en']
}
