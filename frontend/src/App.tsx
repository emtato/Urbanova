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
      const normalized = toPath.startsWith('/') ? toPath : `/${toPath}`
      window.location.hash = `#${normalized}`
      setCurrentPath(route(normalized))
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
