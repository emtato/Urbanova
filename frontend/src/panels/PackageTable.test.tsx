import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { PackageTable } from './PackageTable'
import { sampleComparison } from '../data'

const comparison = sampleComparison as any

function cleanHtml(raw: string): string {
  return raw.replace(/<!--.*?-->/g, '')
}

describe('D10: PackageTable Component Tests', () => {
  it('renders mitigation packages with feasibility and criterion status', () => {
    const raw = renderToString(
      <PackageTable comparison={comparison} onClose={() => {}} />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('Mitigation Packages &amp; Feasibility Matrix')
    expect(html).toContain('FEASIBLE')
    expect(html).toContain('TARGET FAILED') // Failed targets must never be hidden
    expect(html).toContain('high-bound costs fit the budgets')
  })

  it('renders minimized pill state with count', () => {
    const raw = renderToString(
      <PackageTable comparison={comparison} isMinimized={true} onToggleMinimize={() => {}} />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('Intervention Packages')
    expect(html).toContain('▾')
  })
})
