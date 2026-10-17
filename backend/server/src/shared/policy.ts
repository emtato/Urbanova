import * as z from 'zod';
const amount=z.number().finite().min(0).max(1e9);
const range=z.strictObject({low:amount,central:amount,high:amount}).refine(r=>r.low<=r.central&&r.central<=r.high,'Cost range must satisfy 0 <= low <= central <= high.');
const seconds=z.number().finite().min(1).max(86400);
export const PolicySchema=z.strictObject({
  cycle_s:seconds,lane_cycle_s:seconds,baseline_headway_s:seconds,service_headway_s:seconds,
  peak_hours:z.number().finite().min(0).max(24),service_days:z.int().min(0).max(366),
  cost_per_hour:range,lane_capital:range,lane_operating:range,
  price_year:z.int().min(2000).max(2100),earliest_phase:z.string().min(1),
  availability:z.strictObject({lane:z.string().min(1),extra_service:z.string().min(1)}).optional(),
  lane_travel_time_multiplier:z.number().finite().min(.01).max(1).optional(),
  lane_link_ids:z.array(z.string().min(1)).min(1).optional(),
  source_ids:z.array(z.string().min(1)).max(100),assumption_label:z.string().min(1).max(2000),
});
