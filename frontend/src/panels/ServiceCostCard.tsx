import { BASELINE_VEHICLES, COST_PER_HOUR, PEAK_HOURS, SERVICE_DAYS, formatCad, isBaseline, serviceCost } from '../lib/serviceOptions'

/** Vehicles and yearly operating cost of the selected headway, from Lane A's A10 data. */
export function ServiceCostCard({ headway_s }: { headway_s: number }) {
  const cost = serviceCost(headway_s)
  const baseline = isBaseline(headway_s)
  return <section className="service-card" aria-labelledby="service-cost-title">
    <h2 id="service-cost-title">Cost of this service level</h2>
    {baseline
      ? <p>Today's service: {BASELINE_VEHICLES} streetcars, no extra cost. Pick a shorter headway to see what extra service would cost.</p>
      : <>
        <dl className="service-stats">
          <div><dt>Streetcars needed</dt><dd>{cost.vehicles} <span className="service-sub">today {BASELINE_VEHICLES}</span></dd></div>
          <div><dt>Extra streetcars</dt><dd>+{cost.extra_vehicles}</dd></div>
          <div><dt>Extra operating cost</dt><dd>{formatCad(cost.annual_operating_cad.central)}<span className="service-sub">/year</span></dd></div>
          <div><dt>Range</dt><dd className="service-range">{formatCad(cost.annual_operating_cad.low)} – {formatCad(cost.annual_operating_cad.high)}</dd></div>
        </dl>
        <p className="service-note">
          {cost.extra_vehicles} cars × {PEAK_HOURS} h/day (AM peak plus carhouse travel) × {SERVICE_DAYS} weekdays ×
          ${COST_PER_HOUR.central}/streetcar-hour (TTC's 2025 system-wide average in {cost.price_year} dollars; range ${COST_PER_HOUR.low}–${COST_PER_HOUR.high}).
          {' '}No new vehicles purchased: assumes the TTC has {cost.extra_vehicles} spare streetcars at the AM peak.
          Estimates from budgets and cost factors, not TTC quotes.
        </p>
      </>}
  </section>
}
