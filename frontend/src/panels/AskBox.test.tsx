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

  it('contains Higher Phase 1 Occupancy preset for 85% move-in speed by 2028', async () => {
    const { PRESET_QUERIES } = await import('./AskBox')
    const preset = PRESET_QUERIES.find((p) => p.label === 'Higher Phase 1 Occupancy')
    expect(preset).toBeDefined()
    expect(preset?.prompt).toBe('what if move-in speed reaches 85% by 2028?')
    expect(preset?.fields[0].key).toBe('occupied_share')
    expect(preset?.fields[0].interpretedValue).toBe(0.85)
    expect(preset?.fields[0].label).toBe('Occupied Share Target')
  })

  it('correctly parses user prompt "what if move-in speed reaches 85% by 2028?"', async () => {
    const { parseScenarioQuery } = await import('./AskBox')
    const fields = parseScenarioQuery('what if move-in speed reaches 85% by 2028?', comparison.scenario)
    expect(fields.length).toBeGreaterThan(0)
    const field = fields.find((f) => f.key === 'occupied_share')
    expect(field).toBeDefined()
    expect(field?.label).toBe('Occupied Share Target')
    expect(field?.originalValue).toBe(0.5)
    expect(field?.interpretedValue).toBe(0.85)
    expect(field?.unit).toBe('share (85%)')
  })

  it('correctly parses headway and budget queries', async () => {
    const { parseScenarioQuery } = await import('./AskBox')
    const headwayFields = parseScenarioQuery('what if we double streetcar service to 3.0 minute headway?', comparison.scenario)
    expect(headwayFields.find((f) => f.key === 'headway_s')?.interpretedValue).toBe(180)

    const budgetFields = parseScenarioQuery('cap operating budget at $800k', comparison.scenario)
    expect(budgetFields.find((f) => f.key === 'annual_operating_budget_cad')?.interpretedValue).toBe(800000)
  })

  it('generates research analysis citing verified Papiers constraints without altering simulation data', async () => {
    const { generateResearchAnalysis, VERIFIED_PAPIERS_EVIDENCE } = await import('./AskBox')
    const result = generateResearchAnalysis(
      'Why does my stop get worse even when the new building is farther away?',
      comparison.scenario
    )

    expect(result.headline).toContain('Upstream Boarding')
    expect(result.papiersCitation.documentId).toBe(VERIFIED_PAPIERS_EVIDENCE.documentId)
    expect(result.papiersCitation.title).toBe('505 Dundas service constraint')
    expect(result.papiersCitation.signal).toBe('human_judgment')
    expect(result.papiersCitation.excerpt).toContain('No extra vehicles at move-in')
    expect(result.simulationUntouchedNotice).toContain('preserved')
    expect(result.keyObservations.length).toBeGreaterThan(0)
  })

  it('renders Papiers and data-preserved badges in AskBox header', () => {
    const raw = renderToString(
      <AskBox scenario={comparison.scenario} onClose={() => {}} />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('PAPIERS EVIDENCE')
    expect(html).toContain('DATA PRESERVED')
  })

  it('generates customized dynamic analysis for ANY arbitrary prompt', async () => {
    const { generateResearchAnalysis } = await import('./AskBox')
    
    // Custom prompt 1: Snow / Winter
    const snowResult = generateResearchAnalysis(
      'What happens if severe winter snow blocks the tracks?',
      comparison.scenario
    )
    expect(snowResult.headline.toLowerCase()).toContain('weather')
    expect(snowResult.explanation.toLowerCase()).toContain('snow')
    expect(snowResult.papiersCitation.title).toBe('505 Dundas service constraint')

    // Custom prompt 2: Express streetcar
    const expressResult = generateResearchAnalysis(
      'Can we run an express streetcar skipping minor stops?',
      comparison.scenario
    )
    expect(expressResult.headline.toLowerCase()).toContain('express')
    expect(expressResult.explanation.toLowerCase()).toContain('express')
    expect(expressResult.papiersCitation.title).toBe('505 Dundas service constraint')

    // Custom prompt 3: Completely unique query
    const uniqueResult = generateResearchAnalysis(
      'Will nighttime construction noise affect morning passenger boardings?',
      comparison.scenario
    )
    expect(uniqueResult.headline).toContain('Operational Synthesis')
    expect(uniqueResult.papiersCitation.title).toBe('505 Dundas service constraint')
    expect(uniqueResult.keyObservations.length).toBeGreaterThan(0)
  })
})
