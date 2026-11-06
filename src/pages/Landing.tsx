import { useRef } from 'react'
import { MotionConfig, motion, useScroll, useTransform } from 'framer-motion'
import Hero from './landing/Hero'
import NightScroll from './landing/NightScroll'
import RouteStory from './landing/RouteStory'
import ScoreAnatomy from './landing/ScoreAnatomy'
import ShareWalk from './landing/ShareWalk'
import { Grain, LandingNav, Marquee, ScrollProgress } from './landing/effects'
import { useLandingData } from './landing/geometry'

const SOURCES = ['OpenStreetMap street lamps', 'OpenCity police stations', 'Shops & opening hours', 'BMTC bus stops', 'Namma Metro stations', 'Hospitals', 'H3 hexagon blocks', 'Walking routes on real roads']

export default function Landing() {
  const data = useLandingData()
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-full overflow-x-clip bg-night text-paper selection:bg-sodium selection:text-night">
        <ScrollProgress />
        <Grain />
        <LandingNav />
        <main>
          <Hero data={data} />
          <Marquee items={SOURCES} />
          <NightScroll data={data} />
          <RouteStory data={data} />
          <ScoreAnatomy data={data} />
          <ShareWalk data={data} />
          <FinalCta />
        </main>
        <footer className="border-t border-white/10 px-5 py-10 text-center text-sm text-moon/50">
          Prototype for a college project. Map data © OpenStreetMap contributors. Police locations from OpenCity. Community reports are simulated.
        </footer>
      </div>
    </MotionConfig>
  )
}

function FinalCta() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] })
  const glow = useTransform(scrollYProgress, [0, 1], [0.4, 1.15])
  const glowOpacity = useTransform(scrollYProgress, [0, 1], [0, 1])
  return (
    <section ref={ref} className="relative isolate overflow-hidden px-5 py-40 text-center">
      <motion.div
        aria-hidden
        className="absolute top-full left-1/2 -z-10 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ scale: glow, opacity: glowOpacity, background: 'radial-gradient(circle, rgb(255 181 71 / 0.35), rgb(255 181 71 / 0.08) 40%, transparent 70%)' }}
      />
      <h2 className="mx-auto max-w-4xl font-display text-[clamp(2.8rem,8vw,6.5rem)] leading-[1] font-bold tracking-[-0.03em] text-paper">See your walk home, block by block.</h2>
      <p className="mx-auto mt-6 max-w-lg text-lg text-moon/80">Pick a time of night, click any block, compare routes. Everything runs in your browser.</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <a
          href="#/map"
          className="group relative inline-flex h-14 items-center overflow-hidden rounded-2xl bg-sodium px-9 text-base font-semibold text-night shadow-[0_0_60px_-8px_#ffb547] transition-shadow hover:shadow-[0_0_90px_-6px_#ffb547]"
        >
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          <span className="relative">Open the map</span>
        </a>
        <a href="#/about" className="glass-night inline-flex h-14 items-center rounded-2xl px-9 text-base font-medium text-paper transition-colors hover:bg-white/10">
          About the data
        </a>
      </div>
    </section>
  )
}
