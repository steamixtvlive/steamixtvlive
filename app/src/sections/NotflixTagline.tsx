import { Clapperboard, Tv } from 'lucide-react'

export default function NotflixTagline() {
  return (
    <>
      <p className="notflix-slogan">İzle, keşfet, yaşa.</p>
      <div className="notflix-media-icons" aria-hidden="true">
        <span className="notflix-media-icon">
          <Clapperboard />
        </span>
        <span className="notflix-media-icon notflix-media-icon--live">
          <Tv />
        </span>
      </div>
    </>
  )
}
