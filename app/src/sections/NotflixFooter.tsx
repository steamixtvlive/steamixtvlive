interface NotflixFooterProps {
  animated?: boolean
}

export default function NotflixFooter({ animated = false }: NotflixFooterProps) {
  return (
    <footer className={`notflix-footer ${animated ? 'notflix-footer--animated' : ''}`.trim()}>
      © 2027 RENDIR MEDİA™ — TÜM HAKLARI SAKLIDIR.
    </footer>
  )
}
