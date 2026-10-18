import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { Investigation } from './contracts.js';
import { ApiError } from '../core/errors.js';
import { dataVersion,simulationModelVersion } from '../services/bundle.js';
import { auditVersion,auditorDigest } from './contracts.js';

export interface AuditRepository {
  create(a:Investigation):Promise<void>;get(id:string):Promise<Investigation|null>;
  save(a:Investigation,revision:number):Promise<void>;
  claim():Promise<Investigation|null>;renew(a:Investigation):Promise<boolean>;
}
export class PgAuditRepository implements AuditRepository{
  constructor(private pool:Pool){}
  async create(a:Investigation){await this.pool.query('INSERT INTO c_investigations(id,payload,status,revision) VALUES($1,$2,$3,$4)',[a.id,a,a.status,a.revision]);}
  async get(id:string){const r=await this.pool.query('SELECT payload FROM c_investigations WHERE id=$1',[id]);return r.rows[0]?.payload??null;}
  async save(a:Investigation,revision:number){
    const r=await this.pool.query(`UPDATE c_investigations SET payload=$2, status=$3,revision=revision+1, lease_until=NULL,updated_at=now()
      WHERE id=$1 AND revision=$4 AND (lease_token IS NULL OR lease_token=$5) RETURNING id`,[a.id,{...a,revision:revision+1},a.status,revision,a.lease_token??null]);
    if(!r.rowCount)throw new ApiError(409,'Investigation changed; reload before continuing.');a.revision=revision+1;
  }
  async claim(){
    const token=randomUUID();
    const r=await this.pool.query(`UPDATE c_investigations SET status='running',lease_token=$1,lease_until=now()+interval '90 seconds',
      revision=revision+1,payload=jsonb_set(jsonb_set(jsonb_set(payload,'{status}','"running"'),'{lease_token}',to_jsonb(($1::uuid)::text)),'{revision}',to_jsonb(revision+1))
      WHERE id=(SELECT id FROM c_investigations WHERE (status='queued' OR (status='running' AND lease_until<now()))
      AND payload->'provenance'->>'data_version'=$2 AND payload->'provenance'->>'model_version'=$3
      AND payload->'provenance'->>'auditor_version'=$4 AND payload->'provenance'->>'auditor_digest'=$5 ORDER BY updated_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING payload`,[token,dataVersion,simulationModelVersion,auditVersion,auditorDigest]);
    return r.rows[0]?.payload??null;
  }
  async renew(a:Investigation){const r=await this.pool.query("UPDATE c_investigations SET lease_until=now()+interval '90 seconds' WHERE id=$1 AND lease_token=$2 AND status='running'",[a.id,a.lease_token]);return Boolean(r.rowCount);}
}
export function memoryAuditRepository():AuditRepository{
  const rows=new Map<string,Investigation>();
  return {async create(a){rows.set(a.id,structuredClone(a));},async get(id){return structuredClone(rows.get(id)??null);},
    async save(a,revision){if(rows.get(a.id)?.revision!==revision)throw new ApiError(409,'Investigation changed');a.revision++;rows.set(a.id,structuredClone(a));},
    async claim(){const a=[...rows.values()].find(a=>a.status==='queued');if(!a)return null;a.status='running';a.revision++;return structuredClone(a);},async renew(){return true;}};
}
