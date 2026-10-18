import './StopPanel.css'

interface Props {
  vehicleId: string
  vehicle?: { load?: number | null; capacity?: number }
  onClose: () => void
}

export function StreetcarPanel({ vehicleId, vehicle, onClose }: Props) {
  const known = typeof vehicle?.load === 'number' && Number.isFinite(vehicle.load)
  const capacity = typeof vehicle?.capacity === 'number' && vehicle.capacity > 0 ? vehicle.capacity : null
  return <aside aria-label="Streetcar passengers" className="liquid-glass-panel map-glass-panel transit-inspector">
    <header className="transit-inspector-header"><span className="transit-eyebrow">STREETCAR · REPLAY</span>
      <div className="transit-window-controls"><button type="button" aria-label="Close streetcar details" onClick={onClose}>✕</button></div>
    </header>
    <div className="transit-inspector-content">
      <div className="transit-identity"><h2>Streetcar {vehicleId}</h2></div>
      <div className="transit-metric inspector-stat-card"><span>Current passengers / maximum passengers</span>
        <strong>{known ? vehicle!.load!.toLocaleString() : 'N/A'} / {capacity?.toLocaleString() ?? 'N/A'}</strong>
        <small>{!vehicle ? 'Streetcar is not active at this replay time' : known && capacity ? `${Math.round(vehicle!.load! / capacity * 100)}% full` : 'Passenger history unavailable'}</small>
      </div>
    </div>
  </aside>
}
