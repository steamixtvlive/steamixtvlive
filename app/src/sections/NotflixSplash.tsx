import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import NotflixLogo from '@/sections/NotflixLogo'
import NotflixTagline from '@/sections/NotflixTagline'
import NotflixFooter from '@/sections/NotflixFooter'

const PARTICLES = [
  [6, 74, 5, 0.2, 5.4], [12, 62, 3, 1.1, 4.8], [18, 82, 6, 2.3, 6.1],
  [24, 58, 4, 0.6, 5.2], [30, 76, 3, 1.8, 4.6], [36, 64, 5, 0.1, 5.9],
  [42, 84, 4, 2.6, 5.0], [48, 60, 3, 1.4, 5.6], [54, 78, 6, 0.4, 6.3],
  [60, 66, 4, 2.0, 4.9], [66, 83, 3, 0.9, 5.7], [72, 59, 5, 1.6, 5.1],
  [78, 75, 4, 2.8, 6.0], [84, 63, 3, 0.3, 4.7], [90, 80, 5, 1.9, 5.5],
  [95, 68, 4, 2.4, 5.3],
] as const

const LEAVE_ANIMATION_MS = 900

export default function NotflixSplash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const leaveTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current)
    }
  }, [])

  function handleSkip() {
    if (leaving) return
    setLeaving(true)
    leaveTimer.current = window.setTimeout(onDone, LEAVE_ANIMATION_MS)
  }

  return (
    <div
      className={`notflix-splash fixed inset-0 z-[9999] overflow-hidden bg-black ${leaving ? 'is-leaving' : ''}`}
      aria-label="NOTFLİX açılış ekranı"
    >
      <style>{`
        .notflix-splash {
          isolation: isolate;
          animation: notflixSplashIn 600ms ease-out both;
          --notflix-logo-size: clamp(58px, 15vw, 210px);
        }
        .notflix-splash-bg {
          position: absolute;
          inset: -18%;
          background:
            radial-gradient(ellipse at 50% 44%, rgba(229,9,20,.3) 0%, rgba(229,9,20,.08) 36%, transparent 66%),
            radial-gradient(ellipse at 50% 118%, rgba(110,0,0,.26), transparent 56%),
            #000;
          animation: notflixBgPulse 11s ease-in-out both;
        }
        .notflix-splash-grain {
          position: absolute;
          inset: 0;
          opacity: .055;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E");
          mix-blend-mode: screen;
        }
        .notflix-vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(ellipse at center, transparent 32%, rgba(0,0,0,.74) 84%, #000 100%);
        }
        .notflix-stage {
          position: relative;
          z-index: 3;
          display: flex;
          height: 100%;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0 4vw;
          will-change: transform, opacity, filter;
        }
        .notflix-wordmark {
          position: relative;
          filter: none;
          animation: notflixBrandZoom 11s cubic-bezier(.22,.61,.36,1) both;
          will-change: filter, transform;
        }
        .notflix-wordmark::before {
          content: '';
          position: absolute;
          inset: -22% -10%;
          z-index: -1;
          pointer-events: none;
          background: radial-gradient(ellipse at 50% 50%, rgba(229,9,20,.28), rgba(229,9,20,.08) 42%, transparent 70%);
          filter: blur(46px);
          animation: notflixHalo 11s ease-in-out both;
        }
        .notflix-sweep {
          position: absolute;
          inset: -30% -12%;
          pointer-events: none;
          background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,.5) 47%, rgba(255,120,120,.28) 52%, transparent 64%);
          transform: translateX(-140%) skewX(-14deg);
          animation: notflixSweep 3s cubic-bezier(.4,0,.2,1) 6.4s both;
          mix-blend-mode: screen;
        }
        .notflix-splash .notflix-slogan {
          opacity: 0;
          animation: notflixSlogan 2s cubic-bezier(.16,.84,.24,1) 6.1s both;
        }
        .notflix-splash .notflix-media-icons {
          opacity: 0;
          animation: notflixIconsIn 1.8s cubic-bezier(.16,.84,.24,1) 7.1s both;
        }
        @keyframes notflixIconsIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .notflix-smoke {
          position: absolute;
          inset: 0;
          z-index: 1;
          overflow: hidden;
          pointer-events: none;
        }
        .notflix-smoke span {
          position: absolute;
          display: block;
          border-radius: 50%;
          opacity: 0;
          filter: blur(64px);
          mix-blend-mode: screen;
          animation: notflixSmokeDrift 11s ease-in-out both;
          will-change: transform, opacity;
        }
        .notflix-smoke span:nth-child(1) {
          left: 2%;
          top: 28%;
          width: 58vw;
          height: 30vw;
          background: radial-gradient(circle, rgba(229,9,20,.28), transparent 68%);
          animation-delay: .1s;
        }
        .notflix-smoke span:nth-child(2) {
          right: -6%;
          top: 40%;
          width: 62vw;
          height: 32vw;
          background: radial-gradient(circle, rgba(255,255,255,.12), rgba(229,9,20,.16) 38%, transparent 70%);
          animation-delay: .7s;
        }
        .notflix-smoke span:nth-child(3) {
          left: 22%;
          bottom: 8%;
          width: 70vw;
          height: 26vw;
          background: radial-gradient(circle, rgba(229,9,20,.2), transparent 66%);
          animation-delay: 1.4s;
        }
        .notflix-particles {
          position: absolute;
          inset: 0;
          z-index: 2;
          overflow: hidden;
          pointer-events: none;
        }
        .notflix-particles span {
          position: absolute;
          border-radius: 9999px;
          opacity: 0;
          filter: blur(.7px);
          animation-name: notflixParticle;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform, opacity;
        }
        .nf-splash__skip {
          position: absolute;
          right: clamp(20px, 4vw, 58px);
          bottom: max(50px, calc(env(safe-area-inset-bottom) + 46px));
          z-index: 8;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 11px 16px 11px 20px;
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 999px;
          background: rgba(12, 12, 14, .5);
          color: rgba(255,255,255,.78);
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .18em;
          text-transform: uppercase;
          cursor: pointer;
          opacity: 0;
          backdrop-filter: blur(14px);
          box-shadow: 0 14px 40px rgba(0,0,0,.35);
          animation: nfSplashSkipIn .6s cubic-bezier(.2,.8,.2,1) 2.15s both;
          transition: border-color .25s ease, color .25s ease, background .25s ease, transform .25s ease;
        }
        .nf-splash__skip:hover {
          border-color: rgba(229,9,20,.55);
          background: rgba(229,9,20,.12);
          color: #fff;
          transform: translateY(-1px);
        }
        .nf-splash__skip:focus-visible {
          outline: 2px solid rgba(229,9,20,.8);
          outline-offset: 3px;
        }
        .nf-splash__skip:disabled {
          pointer-events: none;
          opacity: .45;
        }
        .notflix-splash.is-leaving .nf-splash__skip {
          opacity: 0;
          transition: opacity .35s ease;
        }
        .notflix-splash.is-leaving {
          animation: notflixFade .9s ease-in both;
        }
        .notflix-splash.is-leaving .notflix-stage {
          animation: notflixStageLeave .9s cubic-bezier(.4,0,.8,.4) both;
        }
        @keyframes nfSplashSkipIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes notflixSplashIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes notflixBrandZoom {
          0% { transform: scale(1.05); }
          45% { transform: scale(1); }
          100% { transform: scale(1.018); }
        }
        @keyframes notflixHalo {
          0% { opacity: 0; transform: scale(.8); }
          35% { opacity: .9; transform: scale(1); }
          78% { opacity: .7; transform: scale(1.05); }
          100% { opacity: 0; transform: scale(1.18); }
        }
        @keyframes notflixSweep {
          0% { transform: translateX(-140%) skewX(-14deg); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translateX(140%) skewX(-14deg); opacity: 0; }
        }
        @keyframes notflixSlogan {
          from { opacity: 0; transform: translateY(12px); filter: blur(8px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes notflixBgPulse {
          0% { opacity: .25; transform: scale(.95); }
          38% { opacity: 1; transform: scale(1); }
          100% { opacity: .68; transform: scale(1.07); }
        }
        @keyframes notflixSmokeDrift {
          0% { opacity: 0; transform: translate3d(-4%, 8%, 0) scale(.9); }
          30% { opacity: .85; }
          72% { opacity: .5; }
          100% { opacity: 0; transform: translate3d(6%, -12%, 0) scale(1.16); }
        }
        @keyframes notflixParticle {
          0% { transform: translate3d(0, 0, 0) scale(.7); opacity: 0; }
          14% { opacity: .9; }
          100% { transform: translate3d(22px, -42vh, 0) scale(1.3); opacity: 0; }
        }
        @keyframes notflixStageLeave {
          0% { opacity: 1; transform: scale(1); filter: blur(0); }
          100% { opacity: 0; transform: scale(1.04); filter: blur(2px); }
        }
        @keyframes notflixFade {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .notflix-wordmark, .notflix-logo__letter, .notflix-slogan, .notflix-media-icons,
          .notflix-sweep, .notflix-splash-bg, .notflix-smoke span, .notflix-particles span {
            animation-duration: .01ms !important;
            animation-delay: 0ms !important;
          }
          .notflix-media-icon, .notflix-media-icon--live::after {
            animation: none !important;
          }
          .notflix-splash.is-leaving {
            animation-duration: 400ms !important;
          }
          .notflix-splash.is-leaving .notflix-stage {
            animation-duration: 400ms !important;
          }
        }
      `}</style>

      <svg width="0" height="0" className="absolute" aria-hidden="true">
         <filter id="notflixSmoke" x="-25%" y="-35%" width="150%" height="170%"><feDisplacementMap in="SourceGraphic" in2="SourceGraphic" scale="0" /></filter>
      </svg>

      <div className="notflix-splash-bg" />
      <div className="notflix-splash-grain" />
      <div className="notflix-smoke" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="notflix-particles" aria-hidden="true">
        {PARTICLES.map(([left, top, size, delay, duration], index) => (
          <span
            key={`${left}-${top}-${index}`}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              background: index % 3 === 0 ? 'rgba(255,255,255,.78)' : 'rgba(229,9,20,.88)',
              boxShadow: index % 3 === 0
                ? '0 0 8px rgba(255,255,255,.35)'
                : '0 0 14px rgba(229,9,20,.8)',
            }}
          />
        ))}
      </div>

      <div className="notflix-stage">
        <div className="notflix-wordmark">
          <NotflixLogo animated startDelay={0.9} stagger={0.4} />
          <div className="notflix-sweep" />
        </div>
        <NotflixTagline />
      </div>

      <button
        type="button"
        className="nf-splash__skip"
        onClick={handleSkip}
        disabled={leaving}
        aria-label="Giriş ekranına geç"
      >
        <span>Geç</span>
        <ArrowRight size={15} aria-hidden="true" />
      </button>

      <div className="notflix-vignette" />
      <NotflixFooter animated />
    </div>
  )
}
