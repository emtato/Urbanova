import { useEffect, useState, type CSSProperties } from 'react'
import { BASELINE_HEADWAY_S, CUSTOM_MIN_S, isBaseline } from '../lib/serviceOptions'

interface Props {
  value: number
  onChange: (headway_s: number) => void
  onValidityChange?: (valid: boolean) => void
  disabled?: boolean
}

const maximum = Math.ceil(BASELINE_HEADWAY_S)
const display = (value: number) => String(isBaseline(value) ? maximum : value)

/** The rounded "today" endpoint retains the reviewed baseline's exact seconds. */
export function HeadwaySelector({ value, onChange, onValidityChange, disabled }: Props) {
  const [draft, setDraft] = useState(display(value))
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setDraft(display(value)) }, [value])

  function edit(text: string) {
    setDraft(text)
    const number = Number(text)
    const valid = text.trim() !== '' && Number.isFinite(number) && number >= CUSTOM_MIN_S && number <= maximum
    setError(valid ? null : `Enter ${CUSTOM_MIN_S}–${maximum} seconds.`)
    onValidityChange?.(valid)
    if (valid) onChange(number === maximum ? BASELINE_HEADWAY_S : number)
  }

  return <div className="headway-selector" role="group" aria-labelledby="headway-selector-label">
    <div className="analysis-control-heading">
      <div><label id="headway-selector-label" htmlFor="headway-slider">Headway</label><p className="analysis-help">Time between streetcars</p></div>
      <span className="analysis-value">{Number((value / 60).toFixed(2))}<small> min</small></span>
    </div>
    <input id="headway-slider" type="range" min={CUSTOM_MIN_S} max={maximum} step={1}
      value={Math.round(value)} disabled={disabled} aria-valuetext={`${display(value)} seconds between streetcars`}
      style={{ '--range-progress': `${(value - CUSTOM_MIN_S) / (maximum - CUSTOM_MIN_S) * 100}%` } as CSSProperties}
      onChange={event => edit(event.target.value)} />
    <div className="analysis-range-labels"><span>3 min · more frequent</span><span>7 min · today</span></div>
    <div className="headway-custom-row">
      <label className="headway-custom" htmlFor="headway-custom">Custom headway (s)
        <input id="headway-custom" type="number" required min={CUSTOM_MIN_S} max={maximum} step="any"
          value={draft} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={error ? 'headway-custom-help' : undefined}
          onChange={event => edit(event.target.value)} />
      </label>
      <button type="button" className="analysis-text-button" disabled={disabled} onClick={() => edit(String(maximum))}>Use today’s service ↗</button>
    </div>
    {error && <p id="headway-custom-help" className="analysis-field-error">{error}</p>}
  </div>
}
