import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ScenarioEditor } from './ScenarioEditor'
import { sampleComparison } from '../data'

const comparison = sampleComparison as any

function cleanHtml(raw: string): string {
  return raw.replace(/<!--.*?-->/g, '')
}

describe('D7: ScenarioEditor Component Tests', () => {
  it('renders separate simulation clock and planning-phase timeline controls', () => {
    const raw = renderToString(
      <ScenarioEditor
        scenario={comparison.scenario}
        assumptions={comparison.assumptions}
        onClose={() => {}}
      />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('SIMULATION CLOCK (OPERATING HORIZON)')
    expect(html).toContain('07:00 – 09:00 AM')
    expect(html).toContain('PLANNING-PHASE TIMELINE')
    expect(html).toContain('Year 2030')
    expect(html).toContain('Target Occupied Share')
  })

  it('renders minimized pill state with demand case and year', () => {
    const raw = renderToString(
      <ScenarioEditor
        scenario={comparison.scenario}
        assumptions={comparison.assumptions}
        isMinimized={true}
        onToggleMinimize={() => {}}
      />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('Scenario Parameters')
    expect(html).toContain('central')
    expect(html).toContain('▾')
  })
})
