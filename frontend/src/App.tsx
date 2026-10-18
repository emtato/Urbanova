import { useEffect, useState, lazy, Suspense } from 'react'
import { CorridorMapPage } from './pages/CorridorMapPage'
import { sampleComparison } from './lib/sampleComparison'

const ListView = lazy(() => import('./views/ListView'))
const AnalysisPage = lazy(() => import('./pages/AnalysisPage').then(module => ({ default: module.AnalysisPage })))
const route = (raw: string) => {
  const path = raw.replace(/^#\/?/, '/')
  if (path.includes('/analysis')) return '/analysis'
  if (path.includes('/list')) return '/list'
  return '/map'
}

export function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash) return route(window.location.hash)
      return route(window.location.pathname)
    }
    return '/map'
  })

  useEffect(() => {
    if (window.location.hash && route(window.location.hash) === '/map') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    const handleNavigation = () => {
      if (typeof window !== 'undefined') {
        const next = window.location.hash ? route(window.location.hash) : route(window.location.pathname)
        setCurrentPath(next)
      }
    }
    window.addEventListener('popstate', handleNavigation)
    window.addEventListener('hashchange', handleNavigation)
    return () => {
      window.removeEventListener('popstate', handleNavigation)
      window.removeEventListener('hashchange', handleNavigation)
    }
  }, [])

  const navigate = (toPath: string) => {
    if (typeof window !== 'undefined') {
      const next = route(toPath.startsWith('/') ? toPath : `/${toPath}`)
      // The map is the home page, so it lives at the bare URL instead of #/map.
      if (next === '/map') {
        if (window.location.hash) window.history.pushState(null, '', window.location.pathname + window.location.search)
      } else {
        window.location.hash = `#${next}`
      }
      setCurrentPath(next)
    }
  }

  if (currentPath === '/analysis') return <Suspense fallback={<p role="status">Loading scenario workspace…</p>}><AnalysisPage onNavigate={navigate} /></Suspense>

  if (currentPath === '/list') {
    return (
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen w-screen bg-background text-foreground font-mono text-sm">
            Loading 2D Corridor Data Inventory...
          </div>
        }
      >
        <ListView
          comparison={sampleComparison as any}
          onSwitchToMap={() => navigate('/map')}
        />
      </Suspense>
    )
  }

  return <CorridorMapPage onNavigate={navigate} />
}

export default App
