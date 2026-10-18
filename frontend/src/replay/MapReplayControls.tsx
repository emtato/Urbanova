import { Pause, Play, RotateCcw } from 'lucide-react'
import { replayClock } from '../lib/replayClock'
import './MapReplayControls.css'

interface Props {
  playing: boolean
  time: number
  horizon: number
  startTime: number
  speed: number
  silly: boolean
  onTogglePlay: () => void
  onSeek: (time: number) => void
  onSpeed: (speed: number) => void
  onRestart: () => void
  onToggleSilly: () => void
}

export function MapReplayControls({ playing, time, horizon, startTime, speed, silly, onTogglePlay, onSeek, onSpeed, onRestart, onToggleSilly }: Props) {
  const clock = replayClock(startTime, time)
  return <section className="map-replay-controls" aria-label="Simulation replay controls">
    <button type="button" data-testid="sim-replay-play-btn" className="map-replay-play"
      onClick={onTogglePlay} aria-label={playing ? 'Pause simulation replay' : 'Play simulation replay'} title={playing ? 'Pause replay (Space)' : 'Play replay (Space)'}>
      {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
    </button>
    <output className="map-replay-clock" aria-label="Simulation clock">{clock}</output>
    <input aria-label="Simulation replay timeline" aria-valuetext={clock} type="range" min={0} max={horizon} step={1}
      value={Math.floor(time)} onChange={event => onSeek(Number(event.target.value))} />
    <span className="map-replay-end">{replayClock(startTime, horizon)}</span>
    <div className="map-replay-speeds" role="group" aria-label="Playback speed">
      {[1, 5, 15, 30].map(value => <button key={value} type="button" aria-label={`${value}x speed`} aria-pressed={speed === value}
        onClick={() => onSpeed(value)}>{value}×</button>)}
    </div>
    <button type="button" onClick={onRestart} aria-label="Restart simulation replay" title="Restart replay"><RotateCcw size={14} /></button>
    <button type="button" className="map-replay-silly" onClick={onToggleSilly} aria-label="Silly mode: spin streetcars"
      aria-pressed={silly} title="Silly mode: spin streetcars">{'>'}w{'<'}</button>
  </section>
}
