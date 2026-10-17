import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ROOT } from '../config.js';
import { hash } from '../core/cache.js';
import { FixtureComparisonSchema, type Comparison, type Scenario } from '../shared/schemas.js';
const read = (path: string) => JSON.parse(readFileSync(resolve(ROOT,path),'utf8'));
export const fixture = FixtureComparisonSchema.parse(read('data/fixtures/sample_comparison.json'));
export const reviewed = read('data/reviewed/simulation_input.json');
export const rawCorridor = read('data/reviewed/corridor.json');
export const sourceManifest = read('data/reviewed/simulation_sources.json') as Comparison['sources'];
const digest=(path:string)=>createHash('sha256').update(readFileSync(resolve(ROOT,path),'utf8').replaceAll('\r\n','\n')).digest('hex');
const simulationFiles=['runner.py','metrics.py','commute.py','streetcars.py','inputs.py','paired_runs.py',...readdirSync(resolve(ROOT,'backend/simulation/objects')).filter(f=>f.endsWith('.py')).map(f=>'objects/'+f)];
export const simulationModelVersion='b11-'+hash([...simulationFiles.map(f=>[f,digest('backend/simulation/'+f)]),['adapter',digest('backend/integration/b11.py')],['packages',digest('backend/server/dist/backend/server/src/packages/materialize.js')],['feasibility',digest('backend/server/dist/backend/server/src/packages/feasibility.js')]]).slice(0,20);
const commuteFiles=['workplaces_2021.json','line1_stations.json','workplaces_sources.json'];
export const dataVersion = 'reviewed-'+hash({reviewed,rawCorridor,sourceManifest,commute:commuteFiles.map(f=>[f,digest('data/reviewed/'+f)])}).slice(0,20);
export const defaultScenario: Scenario = {
  ...structuredClone(fixture.scenario), scenario_id:'505-westbound-planning', version:1,
  developments: reviewed.inputs.developments,
  phases:[{phase_id:'phase-1',year:2030,development_ids:reviewed.inputs.developments.map((d:{id:string})=>d.id),occupied_share:1}],
  // No quoted intervention costs exist in the reviewed bundle. Forms must supply
  // an approved policy before real evaluation can be enabled.
  interventions:[],intervention_availability:{},capital_budget_cad:0,annual_operating_budget_cad:0,fleet_allowance:0,
  planning_criterion:{...fixture.scenario.planning_criterion,meaning:'User-editable illustrative criterion initialized from contract defaults; not a TTC service standard.'},
};
export const corridor: Comparison['corridor'] = {
  ...structuredClone(fixture.corridor),corridor_id:rawCorridor.corridor_id,
  stops:reviewed.inputs.stops.map((s:object)=>({...s,waiting_passenger_ids:[],serving_streetcar_id:null})),
  links:rawCorridor.links.map((link:any)=>({link_id:link.link_id,from_stop:link.from_stop,to_stop:link.to_stop,length_m:link.length_m,base_time_s:link.scheduled_time_s,source_ids:link.source_ids})),
  peak_window:{start_s:reviewed.inputs.start_time_s,end_s:reviewed.inputs.end_time_s,timezone:'America/Toronto',service_date:rawCorridor.service_date},
  source_ids:rawCorridor.source_ids,
  incoming_load:{...fixture.corridor.incoming_load,low:reviewed.inputs.incoming_load_range[0],central:(reviewed.inputs.incoming_load_range[0]+reviewed.inputs.incoming_load_range[1])/2,high:reviewed.inputs.incoming_load_range[1],allowed_range:{low:0,high:reviewed.inputs.streetcar_capacity},meaning:'B11 uniform incoming-load assumption; observed incoming occupancy is unavailable.',status:'assumed',source_ids:[]},
};
