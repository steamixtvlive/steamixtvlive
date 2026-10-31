/**
 * Splash ident, built entirely in code. The wordmark flies in letter by letter, so the refrain
 * walks up the scale one note per letter; the letters then hold while the arrangement climbs,
 * and the full weight of the cue lands on the exact frame the band of light crosses the
 * wordmark. After that the theme comes back triumphant and cadences home to C.
 * Nothing is downloaded and no recording is replayed.
 */

import { LETTER_AT, LIGHT_OVER_WORDMARK_AT } from '@/lib/splash-timing'

type AudioCtor = new () => AudioContext

const STING_LENGTH = 16.4

let context: AudioContext | null = null
let live: GainNode | null = null

function audioContext(): AudioContext | null {
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
  if (!Ctor) return null
  if (!context) context = new Ctor()
  return context
}

function reverbBuffer(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 2.8)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let index = 0; index < length; index += 1) {
      const decay = 1 - index / length
      // Smoothed noise gives a dark hall tail instead of a bright hiss.
      const previous = index === 0 ? 0 : data[index - 1]
      data[index] = (previous * 0.7 + (Math.random() * 2 - 1) * 0.3) * Math.pow(decay, 2.4)
    }
  }
  return buffer
}

interface NoteOptions {
  type?: OscillatorType
  frequency: number
  start: number
  duration: number
  peak: number
  attack?: number
  hold?: number
  releaseTo?: number
  glideFrom?: number
  vibratoHz?: number
  vibratoDepth?: number
  cutoff?: number
  resonance?: number
  octaveBelow?: number
}

/** One voice: optional lowpass so saw tones stay warm, optional octave doubling for weight. */
function note(ctx: AudioContext, destination: AudioNode, options: NoteOptions): void {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = options.type || 'sine'
  oscillator.frequency.setValueAtTime(options.frequency, options.start)
  if (options.glideFrom) {
    oscillator.frequency.setValueAtTime(options.glideFrom, options.start)
    oscillator.frequency.exponentialRampToValueAtTime(options.frequency, options.start + 0.07)
  }

  const attack = options.attack ?? Math.min(0.05, options.duration * 0.2)
  const hold = options.hold ?? 0.2
  const peak = Math.max(0.0002, options.peak)
  gain.gain.setValueAtTime(0.0001, options.start)
  gain.gain.exponentialRampToValueAtTime(peak, options.start + attack)
  gain.gain.setValueAtTime(peak, options.start + options.duration * hold)
  gain.gain.exponentialRampToValueAtTime(0.0001, options.start + options.duration)
  oscillator.connect(gain)

  let tail: AudioNode = gain
  if (options.cutoff) {
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = options.cutoff
    filter.Q.value = options.resonance ?? 0.8
    gain.connect(filter)
    tail = filter
  }
  tail.connect(destination)

  if (options.octaveBelow) {
    const sub = ctx.createOscillator()
    const subGain = ctx.createGain()
    sub.type = 'sine'
    sub.frequency.value = options.frequency / 2
    subGain.gain.setValueAtTime(0.0001, options.start)
    subGain.gain.exponentialRampToValueAtTime(options.octaveBelow, options.start + attack)
    subGain.gain.exponentialRampToValueAtTime(0.0001, options.start + options.duration)
    sub.connect(subGain).connect(destination)
    sub.start(options.start)
    sub.stop(options.start + options.duration + 0.1)
  }

  if (options.vibratoHz && options.vibratoDepth) {
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    lfo.frequency.value = options.vibratoHz
    depth.gain.value = options.vibratoDepth
    lfo.connect(depth).connect(oscillator.frequency)
    lfo.start(options.start)
    lfo.stop(options.start + options.duration + 0.1)
  }

  oscillator.start(options.start)
  oscillator.stop(options.start + options.duration + 0.1)
}

/** Soft timpani-style pulse: a pitched sine falling away quickly. */
function drum(ctx: AudioContext, destination: AudioNode, start: number, peak: number, low = 44): void {
  const body = ctx.createOscillator()
  const bodyGain = ctx.createGain()
  body.type = 'sine'
  body.frequency.setValueAtTime(low * 2.2, start)
  body.frequency.exponentialRampToValueAtTime(low, start + 0.35)
  bodyGain.gain.setValueAtTime(0.0001, start)
  bodyGain.gain.exponentialRampToValueAtTime(peak, start + 0.01)
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7)
  body.connect(bodyGain).connect(destination)
  body.start(start)
  body.stop(start + 0.8)
}

/** Bright noise burst that decays like a cymbal — the shimmer a pure low-end hit lacks. */
function crash(ctx: AudioContext, destination: AudioNode, start: number, peak: number): void {
  const duration = 1.9
  const frames = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(2, frames, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let index = 0; index < frames; index += 1) {
      data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / frames, 2.8)
    }
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 3000
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.014)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  source.connect(filter).connect(gain).connect(destination)
  source.start(start)
  source.stop(start + duration + 0.1)
}

/** Reverse-cymbal style crescendo into the brand hit, kept dull by a lowpass. */
function swell(ctx: AudioContext, destination: AudioNode, start: number, duration: number, peak: number): void {
  const frames = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < frames; index += 1) {
    const ramp = Math.pow(index / frames, 2.2)
    data[index] = (Math.random() * 2 - 1) * ramp
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.1
  filter.frequency.setValueAtTime(600, start)
  filter.frequency.exponentialRampToValueAtTime(2600, start + duration)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + duration * 0.92)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration + 0.12)
  source.connect(filter).connect(gain).connect(destination)
  source.start(start)
  source.stop(start + duration + 0.2)
}

/** Slow string bed: the chord breathes with a gentle tremolo. */
function strings(ctx: AudioContext, destination: AudioNode, frequencies: number[], start: number, duration: number, peak: number): void {
  const tremolo = ctx.createGain()
  tremolo.gain.setValueAtTime(0.0001, start)
  tremolo.gain.exponentialRampToValueAtTime(peak, start + duration * 0.3)
  tremolo.gain.setValueAtTime(peak, start + duration * 0.72)
  tremolo.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  const warmth = ctx.createBiquadFilter()
  warmth.type = 'lowpass'
  warmth.Q.value = 0.7
  warmth.frequency.value = 1500
  warmth.connect(tremolo).connect(destination)

  const lfo = ctx.createOscillator()
  const lfoDepth = ctx.createGain()
  lfo.frequency.value = 5.4
  lfoDepth.gain.value = peak * 0.16
  lfo.connect(lfoDepth).connect(tremolo.gain)
  lfo.start(start)
  lfo.stop(start + duration + 0.1)

  frequencies.forEach((frequency, index) => {
    note(ctx, warmth, {
      type: index === 0 ? 'triangle' : 'sawtooth',
      frequency,
      start,
      duration,
      peak: 0.42 / (1 + index * 0.4),
      attack: duration * 0.25,
      hold: 0.8,
      cutoff: 1700,
      vibratoHz: 4.8 + index * 0.3,
      vibratoDepth: frequency * 0.0035,
    })
  })
}

/** The theme voice: warm brass-leaning sustain with a little portamento and body below. */
function theme(ctx: AudioContext, destination: AudioNode, frequency: number, start: number, duration: number, peak: number, attack = 0.09): void {
  note(ctx, destination, {
    type: 'sawtooth', frequency, start, duration, peak,
    attack, hold: 0.5, cutoff: 2100, resonance: 1.4,
    octaveBelow: peak * 0.4,
    vibratoHz: 5.1, vibratoDepth: frequency * 0.006,
    glideFrom: frequency * 0.985,
  })
}

/** The ident gesture: drums, a sub drop, a wide brass fanfare and cymbal on one frame. */
function impact(ctx: AudioContext, destination: AudioNode, at: number): void {
  drum(ctx, destination, at, 0.4)
  drum(ctx, destination, at + 0.015, 0.26, 30)
  note(ctx, destination, { frequency: 65.41, start: at, duration: 3.4, peak: 0.3, attack: 0.008, hold: 0.25 })
  note(ctx, destination, { frequency: 32.7, start: at, duration: 2.4, peak: 0.2, attack: 0.03, hold: 0.3 })
  ;[261.63, 329.63, 392.0, 523.25, 659.25].forEach((frequency, index) => {
    note(ctx, destination, {
      type: 'sawtooth', frequency, start: at + index * 0.012, duration: 2.4,
      peak: 0.13 - index * 0.014, attack: 0.03, hold: 0.35, cutoff: 2400, resonance: 1.1,
      vibratoHz: 4.9, vibratoDepth: frequency * 0.003,
    })
  })
  crash(ctx, destination, at, 0.07)
}

/** One note of the refrain per letter, so the melody *is* the wordmark assembling. */
const LETTER_MELODY = [329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99] // E4 G4 A4 C5 D5 E5 G5
const LETTER_BASS = [130.81, 130.81, 174.61, 174.61, 196.0, 196.0, 246.94]   // C C F F G G B

function schedule(ctx: AudioContext, destination: AudioNode, at: number): void {
  // The finale is pinned to the frame the light band is centred on the wordmark.
  const hit = LIGHT_OVER_WORDMARK_AT
  const settle = LETTER_AT[LETTER_AT.length - 1] + 0.55

  // A low C pedal and a string bed rise out of the silence underneath the build.
  note(ctx, destination, { frequency: 65.41, start: at, duration: hit + 3.4, peak: 0.2, attack: hit * 0.55, hold: 0.7 })
  strings(ctx, destination, [130.81, 196.0, 261.63], at, hit, 0.13)

  LETTER_AT.forEach((offset, index) => {
    const frequency = LETTER_MELODY[index]
    const last = index === LETTER_AT.length - 1
    theme(ctx, destination, frequency, at + offset, last ? 1.0 : 0.62, 0.16, 0.03)
    // A bright pluck on the same frame keeps the sync readable as articulation, not just pitch.
    note(ctx, destination, { type: 'triangle', frequency: frequency * 2, start: at + offset, duration: 0.45, peak: 0.05, attack: 0.004, hold: 0.06, cutoff: 4200 })
    note(ctx, destination, { frequency: LETTER_BASS[index], start: at + offset, duration: last ? 1.2 : 0.8, peak: 0.14, attack: 0.02, hold: 0.35 })
  })

  // The letters hold, and everything left climbs into the light: a long reverse cymbal, a
  // timpani roll that tightens as it goes, and a staccato run stepping up an octave.
  swell(ctx, destination, at + settle, hit - settle, 0.2)
  ;[1.75, 1.3, 0.95, 0.68, 0.46, 0.3, 0.18, 0.1].forEach((gap, index, roll) => {
    drum(ctx, destination, at + hit - gap, 0.07 + (index / roll.length) * 0.11)
  })
  ;[523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51].forEach((frequency, index) => {
    note(ctx, destination, {
      type: 'triangle', frequency, start: at + hit - 1.5 + index * 0.18, duration: 0.34,
      peak: 0.045 + index * 0.006, attack: 0.005, hold: 0.12, cutoff: 5200,
    })
  })

  impact(ctx, destination, at + hit)

  // ---- Finale: the refrain returns grander and cadences C – F – Am – G – C -----------------
  const bars: Array<[number, number, number[]]> = [
    [hit, 1.6, [130.81, 261.63, 329.63, 392.0, 523.25]],
    [hit + 1.6, 1.5, [174.61, 261.63, 349.23, 440.0, 523.25]],
    [hit + 3.1, 1.5, [110.0, 220.0, 261.63, 329.63, 440.0]],
    [hit + 4.6, 1.2, [98.0, 196.0, 246.94, 293.66, 392.0]],
    [hit + 5.8, STING_LENGTH - hit - 5.8, [130.81, 261.63, 329.63, 392.0, 523.25]],
  ]
  const finalIndex = bars.length - 1
  bars.forEach(([offset, duration, chord], index) => {
    const final = index === finalIndex
    strings(ctx, destination, chord.slice(1), at + offset, duration + (final ? 2.4 : 0), final ? 0.26 : 0.2)
    note(ctx, destination, { frequency: chord[0], start: at + offset, duration: duration + 0.6, peak: final ? 0.26 : 0.2, attack: 0.1, hold: final ? 0.75 : 0.6 })
    if (final) {
      // The resolution gets its own weight: a sub drop, one drum and a wash of cymbal.
      drum(ctx, destination, at + offset, 0.3)
      note(ctx, destination, { frequency: 65.41, start: at + offset, duration: 3.6, peak: 0.24, attack: 0.01, hold: 0.3 })
      crash(ctx, destination, at + offset, 0.05)
    }
  })

  // A flourish straight off the hit, then the broad closing phrase that lands on the final C.
  const melody: Array<[number, number, number]> = [
    [hit + 0.18, 523.25, 0.4], [hit + 0.58, 659.25, 0.4], [hit + 0.98, 783.99, 0.4], [hit + 1.38, 1046.5, 0.6],
    [hit + 1.95, 880.0, 0.85], [hit + 2.8, 783.99, 0.7], [hit + 3.5, 659.25, 0.85],
    [hit + 4.35, 587.33, 0.75], [hit + 5.1, 523.25, 0.6], [hit + 5.8, 523.25, 3.0],
  ]
  melody.forEach(([offset, frequency, duration], index) => {
    theme(ctx, destination, frequency, at + offset, duration, index === melody.length - 1 ? 0.22 : 0.17, index < 4 ? 0.02 : 0.12)
  })

  // High C and E ringing over the last chord while the hall finishes the cue.
  note(ctx, destination, { frequency: 1046.5, start: at + hit + 5.9, duration: 2.6, peak: 0.055, attack: 0.03, hold: 0.15 })
  note(ctx, destination, { frequency: 1318.51, start: at + hit + 6.35, duration: 2.2, peak: 0.04, attack: 0.03, hold: 0.15 })
}

function play(ctx: AudioContext): void {
  const master = ctx.createGain()
  master.gain.value = 0.42
  const silk = ctx.createBiquadFilter()
  silk.type = 'lowpass'
  silk.Q.value = 0.6
  silk.frequency.value = 6200
  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -18
  compressor.knee.value = 26
  compressor.ratio.value = 4
  compressor.attack.value = 0.012
  compressor.release.value = 0.28

  const reverb = ctx.createConvolver()
  reverb.buffer = reverbBuffer(ctx)
  const reverbDamp = ctx.createBiquadFilter()
  reverbDamp.type = 'lowpass'
  reverbDamp.frequency.value = 3000
  const wet = ctx.createGain()
  wet.gain.value = 0.3

  master.connect(silk).connect(compressor).connect(ctx.destination)
  wet.connect(reverb).connect(reverbDamp).connect(compressor)
  const send = ctx.createGain()
  send.gain.value = 1
  silk.connect(send).connect(wet)

  schedule(ctx, master, ctx.currentTime + 0.05)
  if (live) {
    const previous = live
    previous.gain.cancelScheduledValues(ctx.currentTime)
    previous.gain.setTargetAtTime(0, ctx.currentTime, 0.2)
    window.setTimeout(() => previous.disconnect(), 1000)
  }
  live = master
}

/** Fades the cue out when the splash goes away before the tail has finished. */
export function stopSplashSting(): void {
  const ctx = context
  const current = live
  if (!ctx || !current) return
  live = null
  current.gain.cancelScheduledValues(ctx.currentTime)
  current.gain.setTargetAtTime(0, ctx.currentTime, 0.15)
  window.setTimeout(() => current.disconnect(), 800)
}

export function playSplashSting(): void {
  const ctx = audioContext()
  if (!ctx) return
  if (ctx.state === 'running') {
    play(ctx)
    return
  }
  const start = () => {
    window.removeEventListener('pointerdown', start)
    window.removeEventListener('keydown', start)
    window.clearTimeout(guard)
    void ctx.resume().then(() => play(ctx)).catch(() => {})
  }
  // Browsers keep a fresh context suspended until the viewer touches something.
  const guard = window.setTimeout(start, 30000)
  void ctx.resume().then(() => {
    window.clearTimeout(guard)
    play(ctx)
  }).catch(() => {
    window.addEventListener('pointerdown', start, { once: true })
    window.addEventListener('keydown', start, { once: true })
  })
}
