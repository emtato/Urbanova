import * as z from 'zod';
import { reviewed, dataVersion, simulationModelVersion, allSourceIds } from '../services/bundle.js';
import { hash } from '../core/cache.js';
import { ApiError } from '../core/errors.js';
import { readFileSync } from 'node:fs';
import { resolve,dirname,extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from '../config.js';

export const auditVersion='assumption-auditor-v1';
// Independent auditor versioning leaves existing B11 package caches intact.
const modulePath=fileURLToPath(import.meta.url);
export const auditorDigest=hash(['contracts','analysis','service','knowledge','repository','worker'].map(name=>readFileSync(resolve(dirname(modulePath),name+extname(modulePath)),'utf8')).concat(readFileSync(resolve(ROOT,'backend/integration/assumption_audit.py'),'utf8')).map(source=>source.replace(/\r\n/g,'\n')));
export const knobs=['incoming_load','demand_case','service_frequency'] as const;
export type Knob=typeof knobs[number];
const capacity=reviewed.inputs.streetcar_capacity as number;
export const Incoming=z.tuple([z.number().int().min(0).max(capacity),z.number().int().min(0).max(capacity)]).refine(v=>v[0]<=v[1],'Lower incoming load must not exceed upper load.');
export const StartAudit=z.strictObject({
  stop_id:z.string().optional(),
  seeds:z.array(z.number().int().min(0).max(2147483647)).min(3).max(20).refine(v=>new Set(v).size===v.length,'Seeds must be distinct.').default([101,102,103,104,105,106,107,108]),
  incoming_load_range:Incoming.default(reviewed.inputs.incoming_load_range),
  minimum_effect:z.number().min(.001).max(.5).default(.02),
});
export const Redirect=z.strictObject({
  author:z.string().trim().min(1).max(100),note:z.string().trim().min(5).max(4000),
  no_extra_vehicles:z.boolean(),
  incoming_load_range:Incoming.optional(),
  demand_case:z.enum(['low','central','high']).optional(),
  headway_s:z.number().min(reviewed.inputs.headway_s*.5).max(reviewed.inputs.headway_s).optional(),
});
export const Note=z.strictObject({id:z.string().min(1).max(200),title:z.string().min(1).max(300),author:z.string().min(1).max(100),
  text:z.string().min(1).max(12000),knob:z.enum(knobs),
  source_url:z.string().url().optional(),locator:z.string().max(300).optional(),
  // Explicit human-reviewed bounds; never extract and silently apply paper numbers.
  incoming_load_range:Incoming.optional(),demand_case:z.enum(['low','central','high']).optional(),
  headway_s:z.number().min(reviewed.inputs.headway_s*.5).max(reviewed.inputs.headway_s).optional(),
}).superRefine((n,ctx)=>{
  for(const [field,knob] of [['incoming_load_range','incoming_load'],['demand_case','demand_case'],['headway_s','service_frequency']] as const)
    if(n[field]!==undefined&&n.knob!==knob)ctx.addIssue({code:'custom',path:[field],message:`This bound requires knob=${knob}. Add a separate note for another assumption.`});
});
export type KnowledgeNote=z.infer<typeof Note>&{mode:'manual_copy'|'papiers_live';retrieved_at:string};
export type Recipe={id:string;incoming_load_range:[number,number];demand_factor:number;headway_s:number;new_homes:boolean};
export type Run={inputs:{seed:number;existing_cohort_signature:string};summary:any};
export type Experiment={recipe:Recipe;batch_id:string;overall_results:any;runs:Run[]};
export type Entry={sequence:number;at:string;type:string;actor:'agent'|'human'|'system';payload:unknown};
export type Investigation={id:string;revision:number;status:'queued'|'running'|'awaiting_human'|'completed'|'failed';
  stage:'screen'|'followup';request:z.infer<typeof StartAudit>;stop_id?:string;events:Entry[];
  experiments:Experiment[];selection?:{knob:Knob;reason:string;scores:unknown};
  redirect?:z.infer<typeof Redirect>;notes:KnowledgeNote[];finding?:any;error?:string;
  provenance:{data_version:string;model_version:string;auditor_version:string;auditor_digest:string;source_ids:string[];input_hash:string};
  writeback:{status:'pending_connection'|'written';receipt?:string};lease_token?:string;
};
export function append(a:Investigation,type:string,payload:unknown,actor:Entry['actor']='agent'){
  a.events.push({sequence:a.events.length+1,at:new Date().toISOString(),type,actor,payload});
}
export function provenance(request:unknown){return {data_version:dataVersion,model_version:simulationModelVersion,auditor_version:auditVersion,auditor_digest:auditorDigest,source_ids:allSourceIds,input_hash:hash({request,dataVersion,simulationModelVersion,auditVersion,auditorDigest})};}
export function assertCurrent(a:Investigation){if(a.provenance.data_version!==dataVersion||a.provenance.model_version!==simulationModelVersion||a.provenance.auditor_version!==auditVersion||a.provenance.auditor_digest!==auditorDigest)throw new ApiError(409,'Investigation uses earlier data, model or auditor code. Start a new investigation.');}
