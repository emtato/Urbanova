import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { AskBox } from './AskBox'
import { sampleComparison } from '../data'

const comparison = sampleComparison as any

function cleanHtml(raw: string): string {
  return raw.replace(/<!--.*?-->/g, '')
}

describe('D13: AskBox Component Tests', () => {
  it('renders Gemini scenario copilot header, question input, and presets', () => {
    const raw = renderToString(
      <AskBox scenario={comparison.scenario} onClose={() => {}} />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('Ask Gemini: Scenario Question Copilot')
    expect(html).toContain('YOUR PLANNING QUESTION')
    expect(html).toContain('Double Streetcar Frequency')
    expect(html).toContain('Interpret')
  })

  it('renders minimized pill state', () => {
    const raw = renderToString(
      <AskBox scenario={comparison.scenario} isMinimized={true} onToggleMinimize={() => {}} />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('Ask Gemini Scenario Copilot')
    expect(html).toContain('▾')
  })
})
