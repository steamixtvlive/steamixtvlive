import NotflixLogo from '@/sections/NotflixLogo'
import NotflixTagline from '@/sections/NotflixTagline'
import NotflixFooter from '@/sections/NotflixFooter'

export default function NotflixHome() {
  return (
    <div className="notflix-home">
      <div className="notflix-home__glow" />
      <main className="notflix-home__center">
        <NotflixLogo />
        <NotflixTagline />
      </main>
      <NotflixFooter />
    </div>
  )
}
