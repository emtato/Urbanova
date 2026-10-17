import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Sensitivity } from './Sensitivity'
import { sampleComparison } from '../data'

const comparison = sampleComparison as any

function cleanHtml(raw: string): string {
  return raw.replace(/<!--.*?-->/g, '')
}

describe('D11: Sensitivity Component Tests', () => {
  it('renders stress scenarios and identifies persistent worst stops', () => {
    const raw = renderToString(
      <Sensitivity comparison={comparison} onClose={() => {}} />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('Sensitivity &amp; Stress Analysis')
    expect(html).toContain('Low Demand')
    expect(html).toContain('Central Demand')
    expect(html).toContain('High Demand')
    expect(html).toContain('Delay Case')
    expect(html).toContain('WORST STOPS EVERY TIME (PERSISTENT BOTTLENECKS)')
    expect(html).toContain('Dundas St East at River St')
    expect(html).toContain('Dundas St East at Parliament St')
  })

  it('renders parameter sweep experiments from Contract 2.0.0', () => {
    const raw = renderToString(
      <Sensitivity comparison={comparison} />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('PARAMETER SWEEP EXPERIMENTS')
    expect(html).toContain('vehicle_capacity')
  })

  it('renders minimized pill state', () => {
    const raw = renderToString(
      <Sensitivity comparison={comparison} isMinimized={true} onToggleMinimize={() => {}} />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('Sensitivity &amp; Stress Tests')
    expect(html).toContain('▾')
  })
})
