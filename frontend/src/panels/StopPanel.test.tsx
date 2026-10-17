import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { StopPanel } from './StopPanel'
import { mapComparison, todayBaseline } from '../lib/simulationHistory'
const comparison = mapComparison(todayBaseline)
const props = { stop: comparison.corridor.stops[4], stops: comparison.corridor.stops, onClose: () => {} }
const clean = (html: string) => html.replace(/<!--.*?-->/g, '')

describe('saved-configuration inspector', () => {
  it('shows Today with an add picker, not invented custom scenarios', () => {
    const html = clean(renderToString(<StopPanel {...props} />))
    expect(html).toContain('Station')
    expect(html).toContain('Line')
    expect(html).toContain('Add comparison')
    expect(html).toContain('Bundled baseline')
    expect(html).toContain('Existing rider arrivals')
    expect(html).toContain('Existing riders’ average wait')
    expect(html).toContain('All riders’ average wait')
    expect(html).toContain('Total rider arrivals')
    expect(html).toContain('07:00–09:00')
    expect(html).not.toContain('Housing + transit')
    expect(html).not.toContain('<select')
    expect(html).toContain('transit-comparison-columns')
    expect(html).not.toContain('<table')
    expect(html).not.toContain('berth')
  })
  it('preserves missing stop metrics instead of inventing zeros', () => {
    const html = clean(renderToString(<StopPanel stop={{ id: 'missing', name: 'Missing stop' }} onClose={() => {}} />))
    expect(html).toContain('—')
    expect(html).not.toContain('<strong>0%</strong>')
  })
  it('retains in-map view and minimizes without exposing external navigation', () => {
    const html = clean(renderToString(<StopPanel {...props} onViewPlatform={() => {}} />))
    expect(html).toContain('View stop in 3D')
    expect(html).not.toContain('google.com/maps')
    const minimized = clean(renderToString(<StopPanel {...props} isMinimized onToggleMinimize={() => {}} />))
    expect(minimized).toContain('Expand stop details')
    expect(minimized).not.toContain('Existing demand')
  })
})
