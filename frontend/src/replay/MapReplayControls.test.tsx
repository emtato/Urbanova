import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MapReplayControls } from './MapReplayControls'
import { replayClock } from '../lib/replayClock'

describe('map replay clock and controls', () => {
  it('shows the scenario clock rather than elapsed minutes', () => {
    expect(replayClock(25200, 0)).toBe('07:00:00')
    expect(replayClock(27000, 90.9)).toBe('07:31:30')
    expect(replayClock(25200, 7200)).toBe('09:00:00')
    expect(replayClock(23 * 3600, 2 * 3600)).toBe('01:00:00 (+1d)')
  })

  it('includes all four speeds and places the silly toggle immediately after restart', () => {
    const html = renderToString(<MapReplayControls playing={false} time={90} horizon={7200} startTime={25200} speed={1} silly={true}
      onTogglePlay={() => {}} onSeek={() => {}} onSpeed={() => {}} onRestart={() => {}} onToggleSilly={() => {}} />)
    for (const speed of [1, 5, 15, 30]) expect(html).toContain(`aria-label="${speed}x speed"`)
    expect(html).toContain('aria-label="1x speed" aria-pressed="true"')
    expect(html).toContain('07:01:30')
    expect(html).toContain('aria-label="Silly mode: spin streetcars" aria-pressed="true"')
    expect(html).toMatch(/aria-label="Restart simulation replay"[^]*?<\/button><button[^]*?aria-label="Silly mode/)
  })

  it('indicates Space shortcut on the play and pause buttons', () => {
    const playHtml = renderToString(<MapReplayControls playing={false} time={0} horizon={7200} startTime={25200} speed={1} silly={false}
      onTogglePlay={() => {}} onSeek={() => {}} onSpeed={() => {}} onRestart={() => {}} onToggleSilly={() => {}} />)
    expect(playHtml).toContain('title="Play replay (Space)"')

    const pauseHtml = renderToString(<MapReplayControls playing={true} time={0} horizon={7200} startTime={25200} speed={1} silly={false}
      onTogglePlay={() => {}} onSeek={() => {}} onSpeed={() => {}} onRestart={() => {}} onToggleSilly={() => {}} />)
    expect(pauseHtml).toContain('title="Pause replay (Space)"')
  })
})
