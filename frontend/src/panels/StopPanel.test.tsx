import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { StopPanel } from './StopPanel'
import { sampleComparison } from '../data'
import type { CorridorDevelopment, CorridorStop } from '../map/types'
import type { CaseResult } from '../lib/types'

const comparison = sampleComparison as any
const developments = comparison.scenario.developments as CorridorDevelopment[]
const stops = comparison.corridor.stops as CorridorStop[]
const currentCase = comparison.cases.find((c: any) => c.kind === 'current') as CaseResult
const growthCase = comparison.cases.find((c: any) => c.kind === 'growth') as CaseResult
const supportedCase = comparison.cases.find((c: any) => c.kind === 'supported_growth') as CaseResult

function cleanHtml(raw: string): string {
  return raw.replace(/<!--.*?-->/g, '')
}

describe('D5: StopPanel Component Tests', () => {
  it('renders Broadview stop with GTFS stop id, sequence, and background demand', () => {
    const stop1756 = stops.find((s) => s.stop_id === 'ttc-stop-1756')!
    expect(stop1756).toBeDefined()

    const raw = renderToString(
      <StopPanel
        stop={stop1756}
        stops={stops}
        developments={developments}
        currentCase={currentCase}
        growthCase={growthCase}
        supportedCase={supportedCase}
        berths={1}
        onClose={() => {}}
      />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('Broadview Ave at Dundas St East')
    expect(html).toContain('TTC STOP #1756')
    expect(html).toContain('Sequence 1 of 7')
    expect(html).toContain('BACKGROUND DEMAND (EXISTING RIDERS)')
    expect(html).toContain('5') // 5 baseline riders
    expect(html).toContain('12s') // 12s mean wait
  })

  it('renders bottleneck warning and added development demand for River St stop', () => {
    const stop2127 = stops.find((s) => s.stop_id === 'ttc-stop-2127')!
    expect(stop2127).toBeDefined()

    const raw = renderToString(
      <StopPanel
        stop={stop2127}
        stops={stops}
        developments={developments}
        currentCase={currentCase}
        growthCase={growthCase}
        supportedCase={supportedCase}
        berths={1}
        onClose={() => {}}
      />
    )
    const html = cleanHtml(raw)

    // Check connected development (761 Dundas St E)
    expect(html).toContain('761 DUNDAS ST E')
    expect(html).toContain('1,197')
    expect(html).toContain('270m')

    // Bottleneck detection under growth
    expect(html).toContain('Capacity Bottleneck Under Growth')
    expect(html).toContain('100%') // 100% denied boarding share under growth

    // Mitigated under Supported Growth
    expect(html).toContain('Supported Growth (Mitigated)')
  })

  it('renders service headway and platform berths', () => {
    const stop2125 = stops.find((s) => s.stop_id === 'ttc-stop-2125')!
    const raw = renderToString(
      <StopPanel
        stop={stop2125}
        stops={stops}
        developments={developments}
        currentCase={currentCase}
        growthCase={growthCase}
        supportedCase={supportedCase}
        berths={1}
        onClose={() => {}}
      />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('SERVICE &amp; HEADWAY')
    expect(html).toContain('CV 0.00')
    expect(html).toContain('Regular Service')
    expect(html).toContain('1')
    expect(html).toContain('streetcar berth')
  })

  it('renders an in-map 3D button without coordinates or an external link', () => {
    const stop1756 = stops.find((s) => s.stop_id === 'ttc-stop-1756')!
    const raw = renderToString(
      <StopPanel
        stop={stop1756}
        stops={stops}
        developments={developments}
        currentCase={currentCase}
        growthCase={growthCase}
        supportedCase={supportedCase}
        berths={1}
        onClose={() => {}}
        onViewPlatform={() => {}}
      />
    )

    const html = cleanHtml(raw)
    expect(html).toContain('View stop in 3D')
    expect(html).toContain('Westbound')
    expect(html).not.toContain('Inbound')
    expect(html).not.toContain('Coordinates:')
    expect(html).not.toContain('google.com/maps')
  })

  it('renders minimized pill state with pulse indicator and expand button', () => {
    const stop1756 = stops.find((s) => s.stop_id === 'ttc-stop-1756')!
    const raw = renderToString(
      <StopPanel
        stop={stop1756}
        stops={stops}
        developments={developments}
        currentCase={currentCase}
        growthCase={growthCase}
        supportedCase={supportedCase}
        isMinimized={true}
        onToggleMinimize={() => {}}
        onClose={() => {}}
      />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('Broadview Ave at Dundas St East')
    expect(html).toContain('#1756')
    expect(html).toContain('▾')
    expect(html).toContain('✕')
  })

  it('handles stop with no connected major developments gracefully', () => {
    const stop1756 = stops.find((s) => s.stop_id === 'ttc-stop-1756')!
    const raw = renderToString(
      <StopPanel
        stop={stop1756}
        stops={stops}
        developments={developments}
        currentCase={currentCase}
        growthCase={growthCase}
        supportedCase={supportedCase}
        onClose={() => {}}
      />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('No major pipeline development directly walks to this stop')
  })
})
