import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { DevelopmentPanel, REVIEWED_METADATA } from './DevelopmentPanel'
import { sampleComparison } from '../lib/sampleComparison'
import type { Comparison, Development } from '../lib/types'

const comparison = sampleComparison as unknown as Comparison
const developments = comparison.scenario.developments
const stops = comparison.corridor.stops

function cleanHtml(raw: string): string {
  return raw.replace(/<!--.*?-->/g, '')
}

describe('D4: DevelopmentPanel Component Tests', () => {
  it('contains reviewed metadata for all three official corridor proposals', () => {
    expect(REVIEWED_METADATA['toronto-app-22-124214-ste-13-oz']).toBeDefined()
    expect(REVIEWED_METADATA['toronto-app-26-122451-ste-13-oz']).toBeDefined()
    expect(REVIEWED_METADATA['toronto-app-25-236949-ste-13-oz']).toBeDefined()

    // 239 Dundas St E
    expect(REVIEWED_METADATA['toronto-app-22-124214-ste-13-oz'].applicationUrl).toContain('folderRsn')
    expect(REVIEWED_METADATA['toronto-app-22-124214-ste-13-oz'].lat).toBeCloseTo(43.6577, 3)

    // 761 Dundas St E
    expect(REVIEWED_METADATA['toronto-app-25-236949-ste-13-oz'].reviewNote).toContain('East end')
  })

  it('renders 239 Dundas St E (Phase 1) with address, units, and active stage', () => {
    const dev239 = developments.find((d) => d.address === '239 DUNDAS ST E')!
    expect(dev239).toBeDefined()

    const raw = renderToString(
      <DevelopmentPanel
        development={dev239}
        stops={stops}
        onClose={() => {}}
      />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('239 DUNDAS ST E')
    expect(html).toContain('630')
    expect(html).toContain('Phase 1 Proposal')
    expect(html).toContain('Active')
    expect(html).toContain('22 124214 STE 13 OZ')
    expect(html).toContain('2022-03-18')
  })

  it('renders 761 Dundas St E (Phase 2) with formatted units and under review stage', () => {
    const dev761 = developments.find((d) => d.address === '761 DUNDAS ST E')!
    expect(dev761).toBeDefined()

    const raw = renderToString(
      <DevelopmentPanel
        development={dev761}
        stops={stops}
        onClose={() => {}}
      />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('761 DUNDAS ST E')
    expect(html).toContain('1,197') // Check comma formatting
    expect(html).toContain('Phase 2 Proposal')
    expect(html).toContain('Under Review')
    expect(html).toContain('2030') // Phase 2 target year
  })

  it('renders walking access stops with distance and time estimate', () => {
    const dev500 = developments.find((d) => d.address === '500 DUNDAS ST E')!
    expect(dev500).toBeDefined()

    const raw = renderToString(
      <DevelopmentPanel
        development={dev500}
        stops={stops}
        onClose={() => {}}
      />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('WALKING ACCESS TO STOPS')
    expect(html).toContain('Dundas St East at Parliament St')
    expect(html).toContain('229m')
    expect(html).toContain('min')
  })

  it('renders external links for Street View and City of Toronto AIC record', () => {
    const dev239 = developments.find((d) => d.address === '239 DUNDAS ST E')!
    const raw = renderToString(
      <DevelopmentPanel
        development={dev239}
        stops={stops}
        onClose={() => {}}
      />
    )

    // Street View link (satisfies D4/4.4)
    expect(raw).toContain('https://www.google.com/maps/@?api=1&amp;map_action=pano&amp;viewpoint=')
    expect(raw).toContain('target="_blank"')
    expect(raw).toContain('rel="noopener noreferrer"')

    // Official City of Toronto Planning AIC link
    expect(raw).toContain('app.toronto.ca/AIC')
  })

  it('renders review audit note from the data pipeline', () => {
    const dev239 = developments.find((d) => d.address === '239 DUNDAS ST E')!
    const raw = renderToString(
      <DevelopmentPanel
        development={dev239}
        stops={stops}
        onClose={() => {}}
      />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('Audit Review Note')
    expect(html).toContain('West end; numeric units agree with the current description.')
  })

  it('handles development with missing metadata gracefully', () => {
    const hypotheticalDev: Development = {
      dev_id: 'hypothetical-test',
      pipeline_ref: null,
      address: '999 DUNDAS ST E',
      units: 300,
      stage: 'Concept',
      record_date: '2026-10-17',
      kind: 'hypothetical',
      footprint: null,
      footprint_status: 'unavailable',
      access: [
        {
          stop_id: 'ttc-stop-1756',
          walk_m: 150,
          status: 'estimated',
          source_ids: [],
        },
      ],
      source_ids: [],
    }

    const raw = renderToString(
      <DevelopmentPanel
        development={hypotheticalDev}
        stops={stops}
        onClose={() => {}}
      />
    )
    const html = cleanHtml(raw)

    expect(html).toContain('999 DUNDAS ST E')
    expect(html).toContain('300')
    expect(html).toContain('Broadview Ave at Dundas St East')
    expect(html).toContain('150m')
  })
})
