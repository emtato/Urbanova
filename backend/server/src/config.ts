import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import * as z from 'zod';

export const ROOT = resolve(process.cwd(), existsSync('data/contracts') ? '.' : existsSync('../../data/contracts') ? '../..' : '..');
config({ path: resolve(ROOT, '.env'), quiet: true });
config({ path: resolve(ROOT, 'backend/server/.env'), quiet: true });
export function parseSettings(env:NodeJS.ProcessEnv){
  let origins:unknown=['http://localhost:5173','http://127.0.0.1:5173'];
  try{if(env.CORS_ORIGINS)origins=JSON.parse(env.CORS_ORIGINS);}catch{throw Error('Invalid configuration: CORS_ORIGINS must be a JSON array of origins.');}
  const schema=z.object({
    port:z.coerce.number().int().min(1).max(65535),
    databaseUrl:z.string().url().refine(value=>/^postgres(ql)?:\/\//.test(value),'Use a PostgreSQL URL'),
    model:z.string().min(1),modelVersion:z.string().min(1),
    origins:z.array(z.string().url().refine(value=>new URL(value).origin===value,'Use an origin without a path')).min(1),
    geminiEnabled:z.boolean(),geminiKey:z.string(),jobTimeoutMs:z.coerce.number().int().min(100).max(3600000),
  }).superRefine((value,ctx)=>{if(value.geminiEnabled&&!value.geminiKey)ctx.addIssue({code:'custom',path:['GEMINI_API_KEY'],message:'Required unless GEMINI_ENABLED=false'});});
  const result=schema.safeParse({port:env.PORT??8010,databaseUrl:env.DATABASE_URL,model:env.GEMINI_MODEL??'gemini-3.8-flash',modelVersion:env.MODEL_VERSION??'lane-c-b11-v2',origins,geminiEnabled:env.GEMINI_ENABLED!=='false',geminiKey:env.GEMINI_API_KEY??'',jobTimeoutMs:env.JOB_TIMEOUT_MS??1200000});
  if(!result.success)throw Error('Invalid configuration: '+result.error.issues.map(issue=>issue.path.join('.')+': '+issue.message).join('; '));
  return result.data;
}
export const settings=parseSettings(process.env);
