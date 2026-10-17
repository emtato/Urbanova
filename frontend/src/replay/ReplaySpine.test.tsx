import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ReplaySpine } from './ReplaySpine'
import { sampleComparison } from '../data'

const comparison = sampleComparison as any
const replay = comparison.replay
const stops = comparison.corridor.stops

function cleanHtml(raw: string): string {
  return raw.replace(/<!--.*?-->/g, '')
}

describe('D8: ReplaySpine Component Tests', () => {
  it('renders "one illustrative run" label, vehicles, and stop queues', () => {
    const raw = renderToString(
      <ReplaySpine replay={replay} stops={stops} onClose={() => {}} />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('one illustrative run')
    expect(html).toContain('Corridor Replay Spine')
    expect(html).toContain('fixture-car-1')
    expect(html).toContain('fixture-car-2')
    expect(html).toContain('Cap: 4')
    expect(html).toContain('STOP QUEUES &amp; DENIALS')
    expect(html).toContain('Broadview Ave at Dundas St East')
  })

  it('renders scrubber and playback controls', () => {
    const raw = renderToString(
      <ReplaySpine replay={replay} stops={stops} />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('Play')
    expect(html).toContain('1x')
    expect(html).toContain('2x')
    expect(html).toContain('5x')
    expect(html).toContain('10x')
  })

  it('renders minimized pill state with current time', () => {
    const raw = renderToString(
      <ReplaySpine replay={replay} stops={stops} isMinimized={true} onToggleMinimize={() => {}} />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('Replay:')
    expect(html).toContain('▾')
  })
})
