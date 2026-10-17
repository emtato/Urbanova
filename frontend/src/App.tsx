import { useEffect, useState, lazy, Suspense } from 'react'
import { ContractLandingPage } from './pages/ContractLandingPage'
import { sampleComparison } from './lib/sampleComparison'

const CorridorMapPage = lazy(() => import('./pages/CorridorMapPage'))
const ListView = lazy(() => import('./views/ListView'))

export function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/map')) return '/map'
      if (window.location.pathname.startsWith('/list')) return '/list'
      return '/'
    }
    return '/'
  })

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname
        setCurrentPath(
          path.startsWith('/map') ? '/map' : path.startsWith('/list') ? '/list' : '/'
        )
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (toPath: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', toPath)
      setCurrentPath(
        toPath.startsWith('/map') ? '/map' : toPath.startsWith('/list') ? '/list' : '/'
      )
    }
  }

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
