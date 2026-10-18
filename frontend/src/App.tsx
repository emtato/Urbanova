import { useEffect, useState, lazy, Suspense } from 'react'
import { ContractLandingPage } from './pages/ContractLandingPage'
import { sampleComparison } from './lib/sampleComparison'

const CorridorMapPage = lazy(() => import('./pages/CorridorMapPage'))
const ListView = lazy(() => import('./views/ListView'))
const AnalysisPage = lazy(() => import('./pages/AnalysisPage').then(module => ({ default: module.AnalysisPage })))
const route = (raw: string) => {
  const path = raw.replace(/^#\/?/, '/')
  if (path.includes('/analysis')) return '/analysis'
  if (path.includes('/map')) return '/map'
  if (path.includes('/list')) return '/list'
  return '/'
}

export function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash) return route(window.location.hash)
      return route(window.location.pathname)
    }
    return '/'
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

  if (currentPath === '/map') {
    return (
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen w-screen bg-[#081424] text-cyan-300 font-serif text-2xl">
            Loading 3D Corridor...
          </div>
        }
      >
        <CorridorMapPage onNavigate={navigate} />
      </Suspense>
    )
  }

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

  return <ContractLandingPage onNavigate={navigate} />
}

export default App
