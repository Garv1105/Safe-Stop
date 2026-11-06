export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-100 bg-white/80 backdrop-blur-md dark:border-zinc-900 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#/" className="flex items-center gap-2 font-semibold tracking-tight">
          <img src="/favicon.svg" alt="" className="h-7 w-7" />
          SafeStop
        </a>
        <nav className="flex items-center gap-1 text-sm">
          <a href="#/about" className="rounded-lg px-3 py-2 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white">
            About &amp; data
          </a>
          <a href="#/map" className="rounded-lg bg-zinc-900 px-3 py-2 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
            Open the map
          </a>
        </nav>
      </div>
    </header>
  )
}
