import { useEffect, useState, lazy, Suspense } from 'react'
import { ContractLandingPage } from './pages/ContractLandingPage'

const CorridorMapPage = lazy(() => import('./pages/CorridorMapPage'))

export function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname.startsWith('/map') ? '/map' : '/'
    }
    return '/'
  })

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        setCurrentPath(window.location.pathname.startsWith('/map') ? '/map' : '/')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (toPath: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', toPath)
      setCurrentPath(toPath.startsWith('/map') ? '/map' : '/')
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

  return <ContractLandingPage onNavigate={navigate} />
}

export default App
