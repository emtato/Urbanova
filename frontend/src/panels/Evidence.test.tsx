import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Evidence } from './Evidence'
import { sampleComparison } from '../data'

const comparison = sampleComparison as any

function cleanHtml(raw: string): string {
  return raw.replace(/<!--.*?-->/g, '')
}

describe('D12: Evidence Component Tests', () => {
  it('renders assumptions registry with status, units, and original sources', () => {
    const raw = renderToString(
      <Evidence comparison={comparison} onClose={() => {}} />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('Evidence &amp; Provenance Registry')
    expect(html).toContain('Sourced')
    expect(html).toContain('Assumed')
    expect(html).toContain('vehicle capacity')
  })

  it('renders external links to official City/TTC sources', () => {
    const raw = renderToString(
      <Evidence comparison={comparison} />
    )

    expect(raw).toContain('target="_blank"')
    expect(raw).toContain('rel="noopener noreferrer"')
  })

  it('renders minimized pill state', () => {
    const raw = renderToString(
      <Evidence comparison={comparison} isMinimized={true} onToggleMinimize={() => {}} />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('Evidence &amp; Traceability')
    expect(html).toContain('▾')
  })
})
