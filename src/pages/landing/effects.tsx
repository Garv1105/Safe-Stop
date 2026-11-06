import { useRef, useState, type ReactNode } from 'react'
import { motion, useMotionValueEvent, useScroll, useSpring } from 'framer-motion'
import { cn } from '../../components/ui'

/** Thin sodium-lamp line at the top showing how far down the page you are. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30 })
  return <motion.div className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-sodium shadow-[0_0_12px_#ffb547]" style={{ scaleX }} />
}

/** Film grain over the whole page, for texture. */
export function Grain() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.55'/></svg>`
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 opacity-[0.07] mix-blend-overlay"
      style={{ backgroundImage: `url("data:image/svg+xml;utf8,${svg}")` }}
    />
  )
}

/** Glass card whose border and surface glow where the pointer is. */
export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect()
        ref.current!.style.setProperty('--mx', `${e.clientX - r.left}px`)
        ref.current!.style.setProperty('--my', `${e.clientY - r.top}px`)
      }}
      className={cn('glass-night group relative overflow-hidden rounded-3xl', className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(420px circle at var(--mx) var(--my), rgb(255 181 71 / 0.13), transparent 60%)' }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  )
}

export function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items]
  return (
    <div className="relative overflow-hidden bg-[#03040b]/90 py-5 backdrop-blur-xl [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
      <div className="marquee flex w-max gap-12 pr-12 font-display text-xl text-moon/80 md:text-2xl">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-12 whitespace-nowrap">
            {t}
            <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden className="text-sodium">
              <path d="M7 0l7 4v8l-7 4-7-4V4z" fill="currentColor" />
            </svg>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Fixed nav that turns into a glass bar once you scroll. */
export function LandingNav() {
  const { scrollY } = useScroll()
  const [solid, setSolid] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => setSolid(y > 40))
  return (
    <header className="fixed inset-x-0 top-3 z-30 px-3 md:top-4">
      <nav
        className={cn(
          'mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl px-4 transition-all duration-300 ease-out md:px-5',
          solid ? 'glass-night' : 'border border-transparent',
        )}
      >
        <a href="#/" className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight text-paper">
          <img src="/favicon.svg" alt="" className="h-7 w-7" />
          SafeStop
        </a>
        <div className="flex items-center gap-1 text-sm">
          <a href="#/about" className="hidden rounded-xl px-3 py-2 text-moon/80 transition-colors hover:text-paper sm:block">
            About the data
          </a>
          <a href="#/map" className="rounded-xl bg-paper px-4 py-2 font-medium text-night transition-colors hover:bg-sodium">
            Open the map
          </a>
        </div>
      </nav>
    </header>
  )
}

/** Fade + rise when scrolled into view. Used sparingly. */
export function Reveal({ children, delay = 0, x = 0, className }: { children: ReactNode; delay?: number; x?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: x ? 0 : 28, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: '-12% 0px' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  )
}
