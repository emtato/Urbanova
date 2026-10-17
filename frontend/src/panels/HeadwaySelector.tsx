import { useState } from 'react'
import { CUSTOM_MAX_S, CUSTOM_MIN_S, HEADWAY_PRESETS, validateCustomHeadway } from '../lib/serviceOptions'

interface Props {
  value: number
  onChange: (headway_s: number) => void
  /** False while the custom field is open but empty or out of range; block submit then. */
  onValidityChange?: (valid: boolean) => void
  disabled?: boolean
}

/** Today's 420 s plus the three A10 extra-service headways; a bounded custom value sits behind "Custom…". */
export function HeadwaySelector({ value, onChange, onValidityChange, disabled }: Props) {
  const isPreset = HEADWAY_PRESETS.some(p => p.headway_s === value)
  const [customOpen, setCustomOpen] = useState(!isPreset)
  const [draft, setDraft] = useState(isPreset ? '' : String(value))
  const [error, setError] = useState<string | null>(null)

  function pickPreset(headway_s: number) {
    setCustomOpen(false)
    setError(null)
    onValidityChange?.(true)
    onChange(headway_s)
  }

  function editCustom(text: string) {
    setDraft(text)
    const problem = validateCustomHeadway(Number(text))
    const valid = text !== '' && !problem
    setError(text === '' ? 'Enter a headway in seconds' : problem)
    onValidityChange?.(valid)
    if (valid) onChange(Number(text))
  }

  return <div className="headway-selector" role="group" aria-labelledby="headway-selector-label">
    <p id="headway-selector-label" className="headway-selector-label">Headway (time between streetcars)</p>
    <div className="headway-options">
      {HEADWAY_PRESETS.map(preset => {
        const selected = !customOpen && preset.headway_s === value
        return <button
          key={preset.headway_s}
          type="button"
          className={`headway-option${selected ? ' is-selected' : ''}${preset.current ? ' is-current' : ''}`}
          aria-pressed={selected}
          disabled={disabled}
          onClick={() => pickPreset(preset.headway_s)}
        >
          <span className="headway-option-label">{preset.label}</span>
          <span className="headway-option-detail">{preset.detail}</span>
        </button>
      })}
      <button
        type="button"
        className={`headway-option${customOpen ? ' is-selected' : ''}`}
        aria-pressed={customOpen}
        aria-expanded={customOpen}
        disabled={disabled}
        onClick={() => { setCustomOpen(true); editCustom(draft) }}
      >
        <span className="headway-option-label">Custom…</span>
        <span className="headway-option-detail">{CUSTOM_MIN_S}–{CUSTOM_MAX_S} s</span>
      </button>
    </div>
    {customOpen && <label className="headway-custom">
      Custom headway (s)
      <input
        type="number"
        min={CUSTOM_MIN_S}
        max={CUSTOM_MAX_S}
        step={1}
        value={draft}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby="headway-custom-help"
        onChange={e => editCustom(e.target.value)}
      />
      <span id="headway-custom-help" className={error ? 'headway-custom-error' : 'headway-custom-help'}>
        {error ?? 'Not one of the reviewed options; costs use the same formula and are indicative.'}
      </span>
    </label>}
  </div>
}
