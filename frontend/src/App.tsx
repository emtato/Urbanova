import { useEffect, useState, lazy, Suspense } from 'react'
import { ContractLandingPage } from './pages/ContractLandingPage'

const CorridorMapPage = lazy(() => import('./pages/CorridorMapPage'))
const AnalysisPage = lazy(() => import('./pages/AnalysisPage').then(module => ({ default: module.AnalysisPage })))
const route = (path: string) => path.startsWith('/analysis') ? '/analysis' : path.startsWith('/map') ? '/map' : '/'

export function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return route(window.location.pathname)
    }
    return '/'
  })

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        setCurrentPath(route(window.location.pathname))
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (toPath: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', toPath)
      setCurrentPath(route(toPath))
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

  return <ContractLandingPage onNavigate={navigate} />
}

export default App
