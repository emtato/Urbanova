import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ListView } from './ListView'
import { sampleComparison } from '../data'

const comparison = sampleComparison as any

function cleanHtml(raw: string): string {
  return raw.replace(/<!--.*?-->/g, '')
}

describe('D6: ListView Component Tests', () => {
  it('renders 2D list alternative header, stats, and corridor stops', () => {
    const raw = renderToString(
      <ListView comparison={comparison} onSwitchToMap={() => {}} />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('Corridor Data Inventory &amp; 2D Fallback')
    expect(html).toContain('Switch to 3D Map')
    expect(html).toContain('CORRIDOR STOPS')
    expect(html).toContain('PROPOSED HOMES (P1+P2)')
    expect(html).toContain('Broadview Ave at Dundas St East')
    expect(html).toContain('Dundas St East at River St')
  })

  it('renders bottleneck status on affected stops', () => {
    const raw = renderToString(
      <ListView comparison={comparison} />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('BOTTLENECK')
  })

  it('contains search filter input for accessible search', () => {
    const raw = renderToString(
      <ListView comparison={comparison} />
    )

    expect(raw).toContain('placeholder="Filter by name, address, or GTFS ID..."')
  })
})
