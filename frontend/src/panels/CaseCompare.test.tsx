import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { CaseCompare } from './CaseCompare'
import { sampleComparison } from '../data'

const comparison = sampleComparison as any

function cleanHtml(raw: string): string {
  return raw.replace(/<!--.*?-->/g, '')
}

describe('D9: CaseCompare Component Tests', () => {
  it('renders Current, Growth, and Supported Growth side-by-side with metrics', () => {
    const raw = renderToString(
      <CaseCompare comparison={comparison} onClose={() => {}} />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('Current (Baseline)')
    expect(html).toContain('Growth (Unmitigated)')
    expect(html).toContain('Supported Growth')
    expect(html).toContain('Mean Wait')
    expect(html).toContain('P95 Wait')
    expect(html).toContain('Denied Boardings')
    expect(html).toContain('Remaining Queue')
  })

  it('renders cohort split and cost/vehicle requirements', () => {
    const raw = renderToString(
      <CaseCompare comparison={comparison} />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('Cohort Breakdown')
    expect(html).toContain('Existing:')
    expect(html).toContain('New Riders:')
    expect(html).toContain('Cap Cost:')
    expect(html).toContain('Op Cost:')
    expect(html).toContain('Extra Veh:')
  })

  it('renders minimized pill state with demand case', () => {
    const raw = renderToString(
      <CaseCompare comparison={comparison} isMinimized={true} onToggleMinimize={() => {}} />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('Case Comparison:')
    expect(html).toContain('central')
    expect(html).toContain('▾')
  })

  it('renders metrics filtered by selectedDemandCase="high"', () => {
    const raw = renderToString(
      <CaseCompare comparison={comparison} selectedDemandCase="high" />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('data-testid="case-demand-high"')
    // Under high demand, denied share for growth is 67%
    expect(html).toContain('67%')
  })
})
