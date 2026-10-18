import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { AnalysisPage } from './AnalysisPage'
import { todayBaseline } from '../lib/simulationHistory'
import type { NativeBatch } from '../lib/liveTypes'

const mockSim1: NativeBatch = {
  ...todayBaseline,
  id: 'batch-sim-1',
  name: 'Trial 1 - Peak 239 Dundas',
}

const mockSim2: NativeBatch = {
  ...todayBaseline,
  id: 'batch-sim-2',
  name: 'Trial 2 - Offpeak Baseline',
}

function cleanHtml(raw: string): string {
  return raw.replace(/<!--.*?-->/g, '')
}

describe('AnalysisPage batch delete functionality', () => {
  it('renders Batch delete button in saved simulations header with matching delete button style', () => {
    const raw = renderToString(
      <AnalysisPage
        onNavigate={() => {}}
        initialSimulations={[mockSim1, mockSim2]}
        initialBatchMode={false}
      />
    )
    const html = cleanHtml(raw)
    expect(html).toContain('Saved simulations (2)')
    expect(html).toContain('Batch delete')
    expect(html).toContain('class="analysis-delete-button"')
    // When not in batch mode, checkboxes and cancel should not exist
    expect(html).not.toContain('analysis-saved-checkbox')
    expect(html).not.toContain('analysis-saved-checkbox-wrapper')
    expect(html).not.toContain('Cancel')
  })

  it('renders Cancel button and floating checkboxes when batch mode is active with 0 selected', () => {
    const raw = renderToString(
      <AnalysisPage
        onNavigate={() => {}}
        initialSimulations={[mockSim1, mockSim2]}
        initialBatchMode={true}
        initialSelectedIds={[]}
      />
    )
    const html = cleanHtml(raw)
    expect(html).toContain('Cancel')
    expect(html).toContain('Batch delete')
    expect(html).not.toContain('confirm delete')
    expect(html).toContain('class="analysis-saved-checkbox-wrapper"')
    expect(html).toContain('class="analysis-saved-checkbox"')
    expect(html).toContain('is-batch-mode')
    expect(html).not.toContain('is-batch-selected')
  })

  it('changes button text to "confirm delete" and applies selection highlight when items are selected', () => {
    const raw = renderToString(
      <AnalysisPage
        onNavigate={() => {}}
        initialSimulations={[mockSim1, mockSim2]}
        initialBatchMode={true}
        initialSelectedIds={['batch-sim-1']}
      />
    )
    const html = cleanHtml(raw)
    expect(html).toContain('confirm delete')
    expect(html).not.toContain('Batch delete</button>')
    expect(html).toContain('is-batch-selected')
    expect(html).toContain('checked=""')
  })
})
