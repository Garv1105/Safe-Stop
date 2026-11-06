import { lazy, Suspense, useEffect, useState } from 'react'
import { Spinner } from './components/ui'
import About from './pages/About'
import Landing from './pages/Landing'

// The map page pulls in MapLibre + deck.gl, so load it only when opened.
const Explorer = lazy(() => import('./pages/Explorer'))

// Hash routing keeps the app a plain static site (works with `vite preview` and file hosting).
const getRoute = () => window.location.hash.replace(/^#/, '') || '/'

export default function App() {
  const [route, setRoute] = useState(getRoute)
  useEffect(() => {
    const onHash = () => {
      setRoute(getRoute())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (route.startsWith('/map'))
    return (
      <Suspense
        fallback={
          <div className="grid h-full place-items-center bg-zinc-950">
            <Spinner label="Loading map…" />
          </div>
        }
      >
        <Explorer />
      </Suspense>
    )
  if (route.startsWith('/about')) return <About />
  return <Landing />
}
