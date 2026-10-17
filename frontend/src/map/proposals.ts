import catalog from '../data/proposed_developments.json'
import { normalizeDevelopment } from './types'

// Map visibility is a visual overlay, independent of a saved simulation's inputs.
// Keep every reviewed proposal available; prefer saved inputs for matching IDs.
export function mapProposals(simulated: unknown[]) {
  const options = new Map(catalog.map(value => {
    const proposal = normalizeDevelopment(value)
    return [proposal.dev_id, proposal] as const
  }))
  for (const value of simulated) {
    const proposal = normalizeDevelopment(value)
    options.set(proposal.dev_id, proposal)
  }
  return [...options.values()]
}
