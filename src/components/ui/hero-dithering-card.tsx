import { Upload, Loader2, Sparkles, MessagesSquare } from 'lucide-react'
import { useState, Suspense, lazy, useRef } from 'react'
import { cn } from '@/lib/utils'

const Dithering = lazy(() =>
  import('@paper-design/shaders-react').then((mod) => ({ default: mod.Dithering }))
)

interface HeroUploadProps {
  // Either a fully parsed { messages, mediaMap } result, or — for Instagram
  // exports bundling multiple conversations — { needsThreadSelection: true, threads, zip, mediaMap }.
  onParsed: (result: Record<string, unknown>, fileName: string) => void
}

export function HeroUpload({ onParsed }: HeroUploadProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const ALLOWED_TYPES = new Set(['application/zip', 'application/x-zip-compressed', 'application/json', 'text/plain'])
  const ALLOWED_EXTS = /\.(zip|txt|json)$/i

  async function handleFile(file: File | null | undefined) {
    if (!file) return
    // Validate by extension and MIME type (MIME can be empty on some OS)
    if (!ALLOWED_EXTS.test(file.name) || (file.type && !ALLOWED_TYPES.has(file.type))) {
      setError('Unsupported file type. Upload a WhatsApp .zip/.txt, Telegram .zip/.json, or Instagram .zip export.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { parseFile } = await import('@/utils/whatsappParser.js')
      const result = await parseFile(file)
      onParsed(result, file.name)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to parse file.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-[#03040a]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── Full-viewport dithering ──────────────────────────────── */}
      <Suspense fallback={null}>
        <div className="absolute inset-0 z-0 pointer-events-none">
          <Dithering
            colorBack="#03040a"
            colorFront="#1d4ed8"
            shape="warp"
            type="4x4"
            speed={dragging ? 1.4 : isHovered ? 0.55 : 0.2}
            className="size-full"
            minPixelRatio={1}
          />
        </div>
      </Suspense>

      {/* ── Vignette layers ──────────────────────────────────────── */}
      <div className="absolute inset-0 z-[1] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 15%, #03040a 75%)' }}
      />
      <div className="absolute inset-0 z-[2] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 55% 50% at 50% 45%, rgba(3,4,10,0.5) 0%, transparent 100%)' }}
      />

      {/* ── Top accent line ──────────────────────────────────────── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-[3] pointer-events-none"
        style={{ width: '50%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.5), transparent)' }}
      />

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 sm:px-6 w-full max-w-xl mx-auto py-16 gap-6">

        {/* Icon */}
        <div className="relative">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-950/60"
            style={{ background: 'linear-gradient(135deg, #0f1f3d 0%, #1e3a8a 60%, #2563eb 100%)', border: '1px solid rgba(59,130,246,0.25)' }}>
            <MessagesSquare size={32} className="text-white" strokeWidth={1.5} />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 h-3 bg-blue-500/30 blur-xl rounded-full" />
        </div>

        {/* Headline */}
        <div className="space-y-1">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight">
            <span className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #e0eaff 0%, #93c5fd 30%, #3b82f6 65%, #1d4ed8 100%)' }}>
              ChatView
            </span>
          </h1>
          <p className="text-[#6b7a99] text-sm sm:text-base leading-relaxed"
            style={{ textShadow: '0 1px 10px rgba(3,4,10,0.9)' }}>
            Relive your conversations — beautifully rendered, instantly parsed.
          </p>
        </div>

        {/* ── Dropzone ─────────────────────────────────────────── */}
        <div
          className={cn(
            'w-full rounded-2xl border-2 border-dashed cursor-pointer select-none',
            'transition-all duration-300 py-9 px-6',
            dragging
              ? 'border-blue-500/70 bg-blue-950/30 scale-[1.02]'
              : 'border-white/[0.12] bg-white/[0.02] hover:border-blue-500/40 hover:bg-blue-950/10 hover:scale-[1.005]'
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFile(e.dataTransfer.files[0]) }}
        >
          <input ref={inputRef} type="file" accept=".zip,.txt,.json" className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])} />

          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="text-blue-400 animate-spin" strokeWidth={1.5} />
              <p className="text-white font-semibold text-sm">Parsing your chat…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Upload
                size={28}
                className={cn('transition-colors', dragging ? 'text-blue-300' : 'text-blue-500')}
                strokeWidth={1.5}
              />
              <div className="space-y-1">
                <p className="text-white font-bold text-base">
                  {dragging ? 'Drop to load your chat' : 'Click or drag & drop'}
                </p>
                <p className="text-[#4a5568] text-xs sm:text-sm">
                  WhatsApp, Telegram &amp; Instagram exports
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="w-full flex items-start gap-2.5 text-sm bg-red-950/30 border border-red-500/25 text-red-300 rounded-xl px-4 py-3 text-left">
            <span className="shrink-0">⚠</span>{error}
          </div>
        )}
      </div>

      {/* Corner sparkles */}
      <div className="absolute top-5 left-5 z-[3] pointer-events-none opacity-15">
        <Sparkles size={16} className="text-blue-400" />
      </div>
      <div className="absolute top-5 right-5 z-[3] pointer-events-none opacity-15">
        <Sparkles size={12} className="text-blue-400" />
      </div>
    </div>
  )
}
