import { describe, expect, it } from 'vitest'
import { mapProposals } from './proposals'

describe('visual proposal options', () => {
  it('keeps all three reviewed controls available for Today without altering its inputs', () => {
    const inputs: unknown[] = []
    const choices = mapProposals(inputs)
    expect(choices).toHaveLength(3)
    expect(choices.map(value => (value.name ?? '').toLowerCase())).toEqual(expect.arrayContaining(['239 dundas', '500 dundas', '761 dundas']))
    expect(inputs).toEqual([])
  })
  it('uses saved configuration values without duplicating a reviewed proposal', () => {
    const first = mapProposals([])[0]
    const choices = mapProposals([{ ...first, units: 123 }])
    expect(choices).toHaveLength(3)
    expect(choices.find(value => value.dev_id === first.dev_id)?.units).toBe(123)
  })
})
