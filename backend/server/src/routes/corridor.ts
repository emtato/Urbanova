import { Router } from 'express';
import { corridor,interventionCatalog,dataVersion } from '../services/bundle.js';
import { reviewedPolicy } from '../services/policy.js';
import { CorridorSchema } from '../shared/schemas.js';
export function corridorRouter(){const r=Router();r.get('/',(_q,s)=>s.json(CorridorSchema.parse(corridor)));r.get('/interventions',(_q,s)=>s.json({format_version:'reviewed-interventions-v1',scenario_template:'demo',data_version:dataVersion,source_ids:interventionCatalog.source_ids,catalogue:interventionCatalog.catalogue,policies:[240,300,360].map(n=>({headway_s:n,policy:reviewedPolicy(n as 240|300|360)})),notice:'Costs transferred from published budgets are assumptions, not project quotes. Lane travel-time savings are an explicitly simulated team assumption; fleet availability and occupancy dates remain scenario inputs.'}));return r;}
