import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {PgStore} from '../storage/store.js';
import {ROOT,settings} from '../config.js';
import {dataVersion,simulationModelVersion} from '../services/bundle.js';
import {checkedComparison} from '../services/comparisonIntegrity.js';
const store=new PgStore();
try{
  await store.ping();
  const manifest=JSON.parse(readFileSync(resolve(ROOT,'data/cache/demo/manifest.json'),'utf8'));
  if(manifest.run_count<20||manifest.phases!==2||manifest.data_version!==dataVersion||manifest.model_version!==simulationModelVersion||manifest.orchestrator_version!==settings.modelVersion)throw Error('Demo manifest is missing the current 20-seed, two-phase grid. Run npm run pipeline --prefix backend/server.');
  const base=checkedComparison(await store.comparison(manifest.comparison_id)),delayed=await store.delayedComparison(manifest.comparison_id);
  if(base.fixture||!delayed||await store.staleComparison(manifest.comparison_id))throw Error('Cached demo is a fixture, stale or missing its delay comparison.');
  const checkedDelay=checkedComparison(delayed);
  for(const comparison of [base,checkedDelay])for(const phase of comparison.scenario.phases)for(const demand of ['low','central','high']){
    for(const p of comparison.packages){
      const applicable=p.evaluations.filter(e=>e.phase_id===phase.phase_id&&e.demand_case===demand&&e.feasible);
      if(!applicable.length)continue;
      if(!comparison.cases.some(c=>c.phase_id===phase.phase_id&&c.demand_case===demand&&c.package_id===p.package_id&&c.run_count>=20&&c.runs.every(r=>r.diagnostics.conservation)))throw Error('A feasible package is missing its verified paired runs.');
    }
  }
  if(!await store.nativeReplay(manifest.comparison_id))throw Error('Selected illustrative replay is missing.');
  console.log(JSON.stringify({status:'ok',database:'ok',cache:'current',port:settings.port,comparison_id:manifest.comparison_id,runs:manifest.run_count,phases:2,upgrade_delay:'stored',fixture:false}));
}catch(error){console.error(error instanceof Error?error.message:'Demo prerequisites failed');process.exitCode=1;}
finally{await store.close();}
