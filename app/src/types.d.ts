declare module 'ffmpeg-wasm-mkv' {
  interface StreamInfo {
    id: string
    lang: string
    formatDescription: string
  }
  interface LoadMediaResult {
    src: string
    videoStreams: StreamInfo[]
    audioStreams: StreamInfo[]
  }
  class Ffwm {
    constructor(
      coreURL: string,
      wasmURL: string,
      nuxjsURL?: string,
      bufferSizeSec?: number,
      bufferRefillSec?: number,
      workerURL?: string
    )
    loadedMediaMetadata?: { durationSeconds: number }
    loadMedia(file: File): Promise<LoadMediaResult>
    start(videoStreamId: string, audioStreamId: string | null): Promise<void>
    onTimeUpdate(time: number): Promise<void>
    clean(): void
  }
  export default Ffwm
}

declare module 'mux.js' {
  const muxjs: any
  export default muxjs
}

interface Window {
  muxjs: any
}

// The address the provider site is served from. Set at build time; empty means our own
// server answers it, which is the fallback when no worker is configured.
interface ImportMetaEnv {
  readonly VITE_GEIL_EDGE_URL?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
