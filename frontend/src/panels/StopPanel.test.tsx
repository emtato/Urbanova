import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { StopPanel } from './StopPanel'
import { mapComparison, todayBaseline } from '../lib/simulationHistory'
const comparison = mapComparison(todayBaseline)
const props = { stop: comparison.corridor.stops[4], stops: comparison.corridor.stops }
const clean = (html: string) => html.replace(/<!--.*?-->/g, '')

describe('saved-configuration inspector', () => {
  it('shows current station queue separately from historical comparison metrics', () => {
    const live = clean(renderToString(<StopPanel {...props} liveWaiting={27} />))
    expect(live).toContain('Currently waiting · replay')
    expect(live).toContain('<strong>27</strong>')
    const empty = clean(renderToString(<StopPanel {...props} liveWaiting={0} />))
    expect(empty).toContain('<strong>0</strong>')
    const unknown = clean(renderToString(<StopPanel {...props} liveWaiting={null} />))
    expect(unknown).toContain('Passenger history unavailable')
  })
  it('shows Today with an add picker, not invented custom scenarios', () => {
    const html = clean(renderToString(<StopPanel {...props} />))
    expect(html).toContain('Station')
    expect(html).toContain('Line')
    expect(html).toContain('Add comparison')
    expect(html).toContain('Bundled baseline')
    expect(html).toContain('Impact on existing riders')
    expect(html).toContain('New development &amp; total demand')
    expect(html).toContain('Existing rider arrivals')
    expect(html).toContain('Average wait for existing riders')
    expect(html).toContain('Average wait for all riders')
    expect(html).toContain('Total rider arrivals')
    expect(html).toContain('07:00–09:00')
    expect(html).not.toContain('Housing + transit')
    expect(html).not.toContain('<select')
    expect(html).toContain('transit-comparison-columns')
    expect(html).not.toContain('<table')
    expect(html).not.toContain('berth')
  })
  it('preserves missing stop metrics instead of inventing zeros', () => {
    const html = clean(renderToString(<StopPanel stop={{ id: 'missing', name: 'Missing stop' }} />))
    expect(html).toContain('N/A')
    expect(html).not.toContain('<strong>0%</strong>')
  })
  it('retains in-map view and minimizes without exposing external navigation', () => {
    const html = clean(renderToString(<StopPanel {...props} onViewPlatform={() => {}} />))
    expect(html).toContain('View station in street view')
    expect(html).not.toContain('google.com/maps')
    const minimized = clean(renderToString(<StopPanel {...props} isMinimized onToggleMinimize={() => {}} />))
    expect(minimized).toContain('Expand stop details')
    expect(minimized).not.toContain('Existing demand')
  })
})
