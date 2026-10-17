import { useEffect, useState } from 'react'
import type { NativeReplay } from '../lib/liveTypes'
import { replayState } from '../lib/replayState'

export function NativeReplayPanel({ replay }: { replay: NativeReplay }) {
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => setTime(value => Math.min(replay.horizon_s, value + 30)), 100)
    return () => clearInterval(timer)
  }, [playing, replay.horizon_s])
  const state = replayState(replay, time)
  const x = (position: number) => 40 + position * 920 / Math.max(1, replay.stops.length - 1)
  return <section aria-label="B11 replay">
    <h2>Selected simulation replay</h2>
    <p>Vehicles interpolate between recorded departures and arrivals. Queue counts come from event snapshots and include timed passenger arrivals; incoming riders occupy vehicle capacity.</p>
    <p className="analysis-id">Run: {replay.run_id}</p>
    <button type="button" onClick={() => { if (time >= replay.horizon_s) setTime(0); setPlaying(!playing) }}>{playing ? 'Pause' : 'Play'}</button>{' '}
    <label>Elapsed {Math.floor(time / 60)}m {Math.floor(time % 60)}s
      <input aria-label="B11 replay time" type="range" min={0} max={replay.horizon_s} step={1} value={time} onChange={event => setTime(Number(event.target.value))} />
    </label>
    <div className="table-scroll"><svg viewBox="0 0 1000 230" role="img" aria-label="Westbound vehicles and stop queues" style={{ minWidth: 700, width: '100%' }}>
      <line x1="40" x2="960" y1="65" y2="65" stroke="currentColor" opacity=".4" />
      {replay.stops.map((stop, index) => <g key={stop.id}>
        <circle cx={x(index)} cy="65" r="5" fill="currentColor" />
        <text x={x(index)} y="105" textAnchor="middle" fill="currentColor" fontSize="13">{state.queues[stop.id] ?? 0} queued</text>
        <text transform={`translate(${x(index)},145) rotate(-40)`} textAnchor="middle" fill="currentColor" fontSize="12"><title>{stop.name}</title>{stop.name.replace(/Dundas St (East|West) at /, '').replace('Broadview Ave at Dundas St E', 'Broadview')}</text>
      </g>)}
      {state.vehicles.map(car => <rect key={car.id} x={x(car.position) - 10} y="45" width="20" height="13" rx="3" fill={car.onboard_passenger_ids.length >= car.capacity ? '#f87171' : '#22d3ee'}><title>{car.id}: {car.onboard_passenger_ids.length}/{car.capacity} aboard</title></rect>)}
    </svg></div>
    <p>{state.vehicles.length} active vehicles · {Object.values(state.queues).reduce((sum, value) => sum + value, 0)} waiting at stops</p>
    <details><summary>Vehicle occupancy</summary><ul>{state.vehicles.map(car => <li key={car.id}>{car.id}: {car.onboard_passenger_ids.length} / {car.capacity} aboard</li>)}</ul></details>
  </section>
}
