import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { SimulationPicker } from './SimulationPicker'
import { todayBaseline, type SavedSimulation } from '../lib/simulationHistory'

const mockSimulations: SavedSimulation[] = [
  {
    id: 'sim-1',
    name: 'Morning Peak 239 Dundas',
    createdAt: '2026-10-18T08:00:00.000Z',
    batch: todayBaseline,
  },
  {
    id: 'sim-2',
    name: 'Evening Service Baseline',
    createdAt: '2026-10-18T17:40:00.000Z',
    batch: todayBaseline,
  },
]

describe('SimulationPicker batch delete functionality', () => {
  it('renders trigger button when closed and does not mount popup', () => {
    const html = renderToString(
      <SimulationPicker
        label="Past sims"
        history={mockSimulations}
        onSelect={() => {}}
      />
    )
    expect(html).toContain('Past sims')
    expect(html).not.toContain('Morning Peak 239 Dundas')
    expect(html).not.toContain('Batch delete')
  })

  it('renders batch delete button in heading when open with simulations', () => {
    const html = renderToString(
      <SimulationPicker
        label="Past sims"
        history={mockSimulations}
        onSelect={() => {}}
        initialOpen={true}
      />
    )
    expect(html).toContain('Load a saved simulation')
    expect(html).toContain('Morning Peak 239 Dundas')
    expect(html).toContain('Evening Service Baseline')
    expect(html).toContain('Batch delete')
    expect(html).toContain('class="simulation-picker-delete"')
    // When not in batch mode, checkboxes should not be present
    expect(html).not.toContain('simulation-picker-checkbox')
    expect(html).not.toContain('Cancel')
  })

  it('renders floating checkboxes and Cancel button in batch mode with 0 selected', () => {
    const html = renderToString(
      <SimulationPicker
        label="Past sims"
        history={mockSimulations}
        onSelect={() => {}}
        initialOpen={true}
        initialBatchMode={true}
        initialSelectedIds={[]}
      />
    )
    expect(html).toContain('Cancel')
    expect(html).toContain('Batch delete')
    expect(html).not.toContain('confirm delete')
    // Checkboxes should exist inside wrapper
    expect(html).toContain('class="simulation-picker-checkbox-wrapper"')
    expect(html).toContain('class="simulation-picker-checkbox"')
    // No row should be selected
    expect(html).not.toContain('simulation-picker-option-selected')
  })

  it('changes button text to "confirm delete" and highlights selected rows when > 0 items are selected', () => {
    const html = renderToString(
      <SimulationPicker
        label="Past sims"
        history={mockSimulations}
        onSelect={() => {}}
        initialOpen={true}
        initialBatchMode={true}
        initialSelectedIds={['sim-1']}
      />
    )
    expect(html).toContain('confirm delete')
    expect(html).not.toContain('Batch delete</button>')
    expect(html).toContain('simulation-picker-option-selected')
    expect(html).toContain('checked=""')
  })
})
