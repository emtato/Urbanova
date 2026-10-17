import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, settings } from '../config.js';
import { hash } from '../core/cache.js';
import type { Comparison, Scenario } from '../shared/schemas.js';
import { defaultScenario, reviewed, corridor, dataVersion } from '../services/bundle.js';
import { ApiError } from '../core/errors.js';
import { checkedComparison } from '../services/comparisonIntegrity.js';
export type Job={job_id:string;scenario_id:string;scenario_version:number;status:'queued'|'running'|'completed'|'failed';comparison_id:string|null;error:string|null;stale:boolean;notice:string;package_screen:unknown;payload:any;lease_token:string};
export type EvaluationResult={comparison:Comparison;delayedComparison?:Comparison;package_screen:unknown;notice:string};
export interface Store {
  ping():Promise<void>;init():Promise<void>;close():Promise<void>;
  scenario(id:string,version?:number):Promise<Scenario|null>;saveScenario(s:Scenario):Promise<void>;
  enqueue(s:Scenario,key:string,payload:unknown):Promise<Job>;job(id:string):Promise<Job|null>;claim():Promise<Job|null>;
  finish(job:Job,result:EvaluationResult):Promise<void>;
  fail(job:Job):Promise<void>;comparison(id:string):Promise<Comparison|null>;
  staleComparison(id:string):Promise<boolean>;
  delayedComparison(id:string):Promise<Comparison|null>;
  audit(entry:{call_id:string;purpose:string;model:string;prompt_hash:string;status:string;duration_ms:number}):Promise<void>;
}
export class PgStore implements Store {
  pool:Pool;
  constructor(url=settings.databaseUrl) {
    // Preserve the URL's libpq sslmode semantics, matching the existing psycopg
    // service. In particular require encrypts; verify-full verifies hostname/CA.
    if(url){const parsed=new URL(url);if(parsed.searchParams.get('sslmode')==='require'&&!parsed.searchParams.has('uselibpqcompat')){parsed.searchParams.set('uselibpqcompat','true');url=parsed.toString();}}
    this.pool=new Pool({connectionString:url,max:5,connectionTimeoutMillis:5000,statement_timeout:10000});this.pool.on('error',()=>console.error('Database pool unavailable'));
  }
  async ping(){await this.pool.query('SELECT 1');}
  async close(){await this.pool.end();}
  async init(){
    if(!settings.databaseUrl) throw new Error('DATABASE_URL is required.');
    await this.pool.query(readFileSync(resolve(ROOT,'server/db/schema.sql'),'utf8'));
    await this.pool.query('INSERT INTO c_scenarios(scenario_id,version,payload) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[defaultScenario.scenario_id,defaultScenario.version,defaultScenario]);
    for(const stop of corridor.stops) await this.pool.query('INSERT INTO c_stops VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[dataVersion,stop.id,stop.name]);
    for(const d of reviewed.inputs.developments) for(const stop of d.accessible_stop_ids) await this.pool.query('INSERT INTO c_development_access VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[dataVersion,d.id,stop,JSON.stringify(reviewed.source_ids)]);
  }
  async scenario(id:string,version?:number){const r=await this.pool.query('SELECT payload FROM c_scenarios WHERE scenario_id=$1 AND ($2::int IS NULL OR version=$2) ORDER BY version DESC LIMIT 1',[id,version??null]);return r.rows[0]?.payload??null;}
  async saveScenario(s:Scenario){
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      // Serialize edits per scenario; a stale browser cannot overwrite a version.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[s.scenario_id]);
      const latest=await client.query('SELECT max(version) AS version FROM c_scenarios WHERE scenario_id=$1',[s.scenario_id]);
      if(s.version!==(latest.rows[0].version??0)+1) throw new ApiError(409,'Scenario version changed; reload before editing.');
      await client.query('INSERT INTO c_scenarios VALUES($1,$2,$3,now())',[s.scenario_id,s.version,s]);
      await client.query('UPDATE c_jobs SET stale=true WHERE scenario_id=$1 AND scenario_version<$2',[s.scenario_id,s.version]);
      await client.query('COMMIT');
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  async enqueue(s:Scenario,key:string,payload:unknown){
    const client=await this.pool.connect();
    try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[s.scenario_id]);
      const latest=await client.query('SELECT max(version) AS version FROM c_scenarios WHERE scenario_id=$1',[s.scenario_id]);
      if(latest.rows[0].version!==s.version)throw new ApiError(409,'Scenario changed before enqueue; reload the latest version.');
      const r=await client.query(`INSERT INTO c_jobs(job_id,scenario_id,scenario_version,cache_key,payload) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(cache_key) DO UPDATE SET status=CASE WHEN c_jobs.status='failed' THEN 'queued' ELSE c_jobs.status END,
        error=CASE WHEN c_jobs.status='failed' THEN NULL ELSE c_jobs.error END RETURNING *`,[randomUUID(),s.scenario_id,s.version,key,payload]);
      await client.query('COMMIT');return r.rows[0];
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  async job(id:string){const r=await this.pool.query('SELECT * FROM c_jobs WHERE job_id=$1',[id]);return r.rows[0]??null;}
  async claim(){
    const r=await this.pool.query(`UPDATE c_jobs SET status='running',lease_token=$1,lease_until=now()+interval '150 seconds'
      WHERE job_id=(SELECT job_id FROM c_jobs WHERE status='queued' OR (status='running' AND lease_until<now())
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,[randomUUID()]);return r.rows[0]??null;
  }
  async fail(job:Job){await this.pool.query("UPDATE c_jobs SET status='failed',error='Evaluation unavailable; retry with a new job after checking worker logs.',lease_until=NULL WHERE job_id=$1 AND lease_token=$2 AND status='running'",[job.job_id,job.lease_token]);}
  async finish(job:Job,result:EvaluationResult){
    checkedComparison(result.comparison);
    if(result.delayedComparison)checkedComparison(result.delayedComparison);
    const client=await this.pool.connect(); const id=randomUUID();
    try{await client.query('BEGIN');
      const owned=await client.query("SELECT job_id FROM c_jobs WHERE job_id=$1 AND lease_token=$2 AND status='running' FOR UPDATE",[job.job_id,job.lease_token]);
      if(!owned.rowCount){await client.query('ROLLBACK');return;}
      const persist=async(input:Comparison,comparisonId:string,retainReplay:boolean)=>{
        const c=structuredClone(input),replay=retainReplay?c.replay:null;
        c.replay=null;c.comparison_id=comparisonId;
        await client.query('INSERT INTO c_comparisons VALUES($1,$2,$3,$4,$5,$6,now())',[comparisonId,c,job.payload.execution_versions?.model_version??settings.modelVersion,job.payload.execution_versions?.data_version??dataVersion,job.scenario_id,job.scenario_version]);
        for(const caseResult of c.cases){
        for(const [i,run] of caseResult.runs.entries()) await client.query(`INSERT INTO c_run_aggregates VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [comparisonId,run.run_id,c.scenario.scenario_id,caseResult.phase_id,caseResult.package_id,caseResult.demand_case,run.model_version,run.data_version,hash(c.assumptions),JSON.stringify(run.seed_ids),JSON.stringify(c.sources.map(s=>s.source_id)),{...run.diagnostics,p95_wait_s:caseResult.per_run_p95_wait_s[i],denied_share:caseResult.per_run_denied_share[i]},c.fixture]);
        for(const stop of caseResult.stops) await client.query('INSERT INTO c_stop_aggregates VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[comparisonId,caseResult.case_id,caseResult.phase_id,caseResult.package_id,caseResult.demand_case,stop.stop_id,stop.rider_group,stop]);
        }
        if(replay) await client.query('INSERT INTO c_replays VALUES($1,$2,$3)',[comparisonId,replay.run_id,replay]);
      };
      await persist(result.comparison,id,Boolean(job.payload.retain_replay));
      if(result.delayedComparison){
        const delayedId=randomUUID();
        await persist(result.delayedComparison,delayedId,false);
        await client.query('INSERT INTO c_delayed_comparisons VALUES($1,$2)',[id,delayedId]);
      }
      await client.query("UPDATE c_jobs SET status='completed',comparison_id=$3,notice=$4,package_screen=$5,lease_until=NULL WHERE job_id=$1 AND lease_token=$2",[job.job_id,job.lease_token,id,result.notice,JSON.stringify(result.package_screen)]);
      await client.query('COMMIT');
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  async comparison(id:string){
    const r=await this.pool.query('SELECT payload FROM c_comparisons WHERE comparison_id=$1',[id]);if(!r.rows.length)return null;
    const replay=await this.pool.query('SELECT payload FROM c_replays WHERE comparison_id=$1',[id]);
    return {...r.rows[0].payload,replay:replay.rows[0]?.payload??null};
  }
  async staleComparison(id:string){const r=await this.pool.query('SELECT j.stale,c.data_version,c.model_version FROM c_comparisons c LEFT JOIN c_jobs j USING(comparison_id) WHERE c.comparison_id=$1',[id]);const row=r.rows[0];return Boolean(row&&(row.stale||row.data_version!==dataVersion||row.model_version!==settings.modelVersion));}
  async delayedComparison(id:string){const r=await this.pool.query('SELECT c.payload FROM c_delayed_comparisons d JOIN c_comparisons c ON c.comparison_id=d.delayed_comparison_id WHERE d.comparison_id=$1',[id]);return r.rows[0]?.payload??null;}
  async audit(e:{call_id:string;purpose:string;model:string;prompt_hash:string;status:string;duration_ms:number}){await this.pool.query('INSERT INTO c_ai_calls(call_id,purpose,model,prompt_hash,status,duration_ms) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(call_id) DO UPDATE SET status=EXCLUDED.status,duration_ms=EXCLUDED.duration_ms',[e.call_id,e.purpose,e.model,e.prompt_hash,e.status,e.duration_ms]);}
}
